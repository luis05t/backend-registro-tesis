import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException, 
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import * as bcrypt from "bcrypt"; 
import { CreateUserDto } from "src/users/dto/create-user.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { LoginDto } from "./dto/loginDto";
import { RefreshDto } from "./dto/refreshDto";
import { JwtPayload } from "./interfaces/jwt-payload.interface";
import * as crypto from 'crypto'; 
import * as nodemailer from 'nodemailer'; 
import * as deepEmailValidator from 'deep-email-validator';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // --- 1. WHITELIST DE DOMINIOS ---
  private isDomainAllowed(email: string): boolean {
    const domain = email.split('@')[1].toLowerCase();
    const allowedDomains = [
      'sudamericano.edu.ec', 'gmail.com', 'outlook.com', 'hotmail.com',
      'yahoo.com', 'yahoo.es', 'icloud.com', 'live.com', 'msn.com', 'me.com', 'zoho.com'
    ];
    const allowedExtensions = [
      '.edu.ec', '.gob.ec', '.org.ec', '.com.ec', '.net.ec',
      '.eu.ec', '.ec', '.com', '.edu', '.gob', '.gov', '.org'
    ];
    return allowedDomains.includes(domain) || allowedExtensions.some(ext => domain.endsWith(ext));
  }

  // --- 2. DETECTOR DINÁMICO DE PROVEEDORES SMTP ---
  private getSmtpConfig() {
    const emailUser = this.configService.get<string>('EMAIL_USER') || '';
    const domain = emailUser.split('@')[1]?.toLowerCase() || '';
    if (domain.includes('gmail') || domain.includes('sudamericano.edu.ec')) {
      return { host: 'smtp.gmail.com', port: 465, secure: true };
    }
    if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live') || domain.includes('msn')) {
      return { host: 'smtp-mail.outlook.com', port: 587, secure: false };
    }
    if (domain.includes('yahoo')) {
      return { host: 'smtp.mail.yahoo.com', port: 465, secure: true };
    }
    return { host: 'smtp.gmail.com', port: 465, secure: true };
  }

  /**
   * REGISTRO DE ESTUDIANTES
   */
  async register(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId: _, ...userDto } = createUserDto;
      if (!this.isDomainAllowed(email)) throw new BadRequestException('Dominio de correo no permitido.');

      const res = await deepEmailValidator.validate({
        email, validateRegex: true, validateTypo: false, validateDisposable: true,
        validateMx: false, validateSMTP: false, 
      });
      if (!res.valid) throw new BadRequestException('Correo inválido.');

      const role = await this.prisma.role.findFirst({ where: { name: 'USER' } });
      if (!role) throw new InternalServerErrorException("El rol 'USER' no existe.");

      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await this.prisma.user.create({
        data: { ...userDto, email: email.toLowerCase(), password: hashedPassword, roleId: role.id },
      });
      return { user, token: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }) };
    } catch (error) { this.handleDBErrors(error); }
  }

  /**
   * REGISTRO ADMINISTRATIVO (Docentes - Solo Admin)
   * REINTEGRADO PARA EL CONTROLLER
   */
  async registerAdmin(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId, ...userDto } = createUserDto;
      if (!roleId) throw new BadRequestException("El roleId es obligatorio.");
      if (!this.isDomainAllowed(email)) throw new BadRequestException('Dominio no permitido.');

      const res = await deepEmailValidator.validate({
        email, validateRegex: true, validateTypo: false, validateDisposable: true,
        validateMx: false, validateSMTP: false,
      });
      if (!res.valid) throw new BadRequestException('Correo inválido.');

      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await this.prisma.user.create({
        data: { ...userDto, email: email.toLowerCase(), password: hashedPassword, roleId },
        include: { role: true }
      });

      const { password: _, ...result } = user;
      return result;
    } catch (error) { this.handleDBErrors(error); }
  }

  /**
   * INICIO DE SESIÓN
   */
  async login(loginDto: LoginDto) {
    const { password, email } = loginDto;
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { role: true } });
    if (!user) throw new UnauthorizedException("correo no registrado");

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException("contraseña incorrecta");

    return {
      userId: user.id, userRole: user.role.name, userName: user.name,
      accessToken: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }),
      refreshToken: this.getJwtToken({ id: user.id }, { expiresIn: "7d" }),
    };
  }

  /**
   * REFRESH TOKEN
   * REINTEGRADO PARA EL CONTROLLER
   */
  async refreshToken(refreshDto: RefreshDto) {
    try {
      const payload = this.jwtService.verify(refreshDto.refreshToken, {
        secret: this.configService.get<string>("JWT_SECRET"),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        include: { role: true },
      });

      if (!user) throw new UnauthorizedException("Token de refresco inválido");

      return {
        userId: user.id,
        userRole: user.role.name,
        accessToken: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }),
        refreshToken: this.getJwtToken({ id: user.id }, { expiresIn: "7d" }),
      };
    } catch (error) {
      throw new UnauthorizedException("Token expirado o inválido");
    }
  }

  /**
   * RECUPERACIÓN DE CONTRASEÑA
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new NotFoundException('Correo no encontrado');

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); 

    try {
      await this.prisma.user.update({ where: { id: user.id }, data: { resetToken, resetTokenExpiry } });
      const smtp = this.getSmtpConfig();
      const transporter = nodemailer.createTransport({
        host: smtp.host, port: smtp.port, secure: smtp.secure,
        auth: { user: this.configService.get('EMAIL_USER'), pass: this.configService.get('EMAIL_PASS') },
        tls: { rejectUnauthorized: false }
      });

      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

      await transporter.sendMail({
        from: `"Soporte RepoDigital" <${this.configService.get('EMAIL_USER')}>`,
        to: user.email,
        subject: 'Recuperación de Contraseña',
        html: `<p>Hola ${user.name}, haz clic aquí: <a href="${resetUrl}">${resetUrl}</a></p>`
      });
      return { message: 'Correo enviado.' };
    } catch (error) {
      console.error("Error SMTP Render:", error);
      throw new InternalServerErrorException("Error al enviar correo.");
    }
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({ where: { resetToken: token, resetTokenExpiry: { gt: new Date() } } });
    if (!user) throw new BadRequestException('Enlace inválido o expirado.');

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null }
    });
    return { message: 'Contraseña actualizada' };
  }

  private getJwtToken(payload: JwtPayload, options?: JwtSignOptions) { return this.jwtService.sign(payload, options); }

  private handleDBErrors(error: any): never {
    if (error.code === 'P2002') throw new BadRequestException('Correo ya registrado');
    throw new InternalServerErrorException("Error del servidor.");
  }
}