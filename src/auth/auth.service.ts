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

  // --- 1. LISTA BLANCA DE DOMINIOS Y EXTENSIONES ---
  private isDomainAllowed(email: string): boolean {
    const domain = email.split('@')[1].toLowerCase();
    
    const allowedDomains = [
      'sudamericano.edu.ec', 'gmail.com', 'outlook.com', 'hotmail.com',
      'yahoo.com', 'yahoo.es', 'icloud.com', 'live.com', 'msn.com', 
      'me.com', 'zoho.com'
    ];

    const allowedExtensions = [
      '.edu.ec', '.gob.ec', '.org.ec', '.com.ec', '.net.ec',
      '.eu.ec', '.ec', '.com', '.edu', '.gob', '.gov', '.org'
    ];

    const isInList = allowedDomains.includes(domain);
    const hasValidExtension = allowedExtensions.some(ext => domain.endsWith(ext));

    return isInList || hasValidExtension;
  }

  // --- 2. DETECTOR DINÁMICO DE PROVEEDORES (GMAIL, OUTLOOK, YAHOO) ---
  private getSmtpConfig() {
    const emailUser = this.configService.get<string>('EMAIL_USER') || '';
    const domain = emailUser.split('@')[1]?.toLowerCase() || '';

    // GMAIL / GOOGLE WORKSPACE / SUDAMERICANO
    if (domain.includes('gmail') || domain.includes('sudamericano.edu.ec')) {
      return { host: 'smtp.gmail.com', port: 465, secure: true };
    }

    // MICROSOFT (Outlook, Hotmail, Live, MSN)
    if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live') || domain.includes('msn')) {
      return { host: 'smtp-mail.outlook.com', port: 587, secure: false };
    }

    // YAHOO
    if (domain.includes('yahoo')) {
      return { host: 'smtp.mail.yahoo.com', port: 465, secure: true };
    }

    // CONFIGURACIÓN POR DEFECTO (Puerto seguro 465)
    return { host: 'smtp.gmail.com', port: 465, secure: true };
  }

  /**
   * REGISTRO DE USUARIOS (Con corrección de nulos)
   */
  async register(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId: _, ...userDto } = createUserDto;

      if (!this.isDomainAllowed(email)) {
        throw new BadRequestException('Dominio de correo no permitido.');
      }

      const res = await deepEmailValidator.validate({
        email, validateRegex: true, validateTypo: false, validateDisposable: true,
        validateMx: false, validateSMTP: false, 
      });

      if (!res.valid) throw new BadRequestException('Correo inválido.');

      const role = await this.prisma.role.findFirst({ where: { name: 'USER' } });
      
      // Validación para evitar el error 'possibly null'
      if (!role) {
        throw new InternalServerErrorException("Error: El rol 'USER' no existe.");
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await this.prisma.user.create({
        data: { 
          ...userDto, 
          email: email.toLowerCase(), 
          password: hashedPassword, 
          roleId: role.id 
        },
      });

      return { user, token: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }) };
    } catch (error) { this.handleDBErrors(error); }
  }

  /**
   * REGISTRO ADMINISTRATIVO
   */
  async registerAdmin(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId, ...userDto } = createUserDto;
      if (!roleId) throw new BadRequestException("El roleId es obligatorio.");

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
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });

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

      if (!user) throw new UnauthorizedException("Token inválido");

      return {
        userId: user.id, userRole: user.role.name,
        accessToken: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }),
        refreshToken: this.getJwtToken({ id: user.id }, { expiresIn: "7d" }),
      };
    } catch (error) { throw new UnauthorizedException("Token expirado"); }
  }

  /**
   * RECUPERACIÓN DE CONTRASEÑA (Soporte Universal Multi-Proveedor)
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new NotFoundException('Correo no encontrado');

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); 

    try {
      await this.prisma.user.update({ where: { id: user.id }, data: { resetToken, resetTokenExpiry } });

      // Selecciona automáticamente la configuración según el dominio del correo emisor
      const smtp = this.getSmtpConfig();

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { 
          user: this.configService.get('EMAIL_USER'), 
          pass: this.configService.get('EMAIL_PASS') 
        },
        tls: { rejectUnauthorized: false }
      });

      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

      await transporter.sendMail({
        from: `"Soporte RepoDigital" <${this.configService.get('EMAIL_USER')}>`,
        to: user.email,
        subject: 'Recuperación de Contraseña - RepoDigital',
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
            <h2 style="color: #0891b2;">Recuperación de Contraseña</h2>
            <p>Hola <strong>${user.name}</strong>,</p>
            <p>Has solicitado restablecer tu contraseña para el repositorio institucional.</p>
            <p>Haz clic en el botón de abajo para continuar:</p>
            <a href="${resetUrl}" style="background: #0891b2; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Restablecer Contraseña</a>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">Si no solicitaste esto, ignora este correo.</p>
          </div>
        `
      });

      return { message: 'Correo enviado correctamente.' };
    } catch (error) {
      console.error("Error crítico en Render:", error);
      throw new InternalServerErrorException("Error de conexión SMTP con el proveedor seleccionado.");
    }
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } }
    });

    if (!user) throw new BadRequestException('El enlace es inválido o ha expirado.');

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null }
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  private getJwtToken(payload: JwtPayload, options?: JwtSignOptions) {
    return this.jwtService.sign(payload, options);
  }

  private handleDBErrors(error: any): never {
    if (error.code === 'P2002') throw new BadRequestException('Correo ya registrado');
    throw new InternalServerErrorException("Error interno del servidor.");
  }
}