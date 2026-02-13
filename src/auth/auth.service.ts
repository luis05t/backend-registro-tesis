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

  // --- 1. CONFIGURACIÓN DE LISTA BLANCA ULTRA-ESTRICTA ---
  private isDomainAllowed(email: string): boolean {
    const domain = email.split('@')[1].toLowerCase();
    
    // Lista de proveedores específicos de confianza (Únicos .com permitidos)
    const allowedDomains = [
      'sudamericano.edu.ec', 
      'gmail.com', 'outlook.com', 'hotmail.com',
      'yahoo.com', 'yahoo.es', 'icloud.com', 
      'live.com', 'msn.com', 'me.com', 'zoho.com'
    ];

    // Lista de extensiones institucionales permitidas
    // ⚠️ Se eliminó '.ec' genérico para bloquear errores como 'eu.ec' o 'a.ec'
    const allowedExtensions = [
      '.edu.ec', '.gob.ec', '.org.ec',
      '.ec',                           // Institucionales Ecuador
      '.edu', '.gob', '.gov',          // Institucionales globales
    ];

    const isInList = allowedDomains.includes(domain);
    const hasValidExtension = allowedExtensions.some(ext => domain.endsWith(ext));

    return isInList || hasValidExtension;
  }

  /**
   * REGISTRO PÚBLICO (Estudiantes)
   */
  async register(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId: _, ...userDto } = createUserDto;

      // Validación de dominio
      if (!this.isDomainAllowed(email)) {
        throw new BadRequestException('Dominio de correo no permitido. Use .edu.ec o proveedores oficiales.');
      }

      const isProduction = process.env.NODE_ENV === 'production';
      
      const res = await deepEmailValidator.validate({
        email, 
        validateRegex: true, 
        validateTypo: false, 
        validateDisposable: true, 
        validateMx: isProduction, 
        validateSMTP: false, 
      });

      if (!res.valid) throw new BadRequestException('Correo electrónico inválido o inexistente.');

      const role = await this.prisma.role.findFirst({ where: { name: 'USER' } });
      if (!role) throw new InternalServerErrorException("El rol 'USER' no ha sido inicializado.");

      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await this.prisma.user.create({
        data: { ...userDto, email: email.toLowerCase(), password: hashedPassword, roleId: role.id },
      });

      const { password: __, ...result } = user;
      return { user: result, token: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }) };
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  /**
   * REGISTRO ADMINISTRATIVO (Docentes - Solo Admin)
   */
  async registerAdmin(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId, ...userDto } = createUserDto;
      if (!roleId) throw new BadRequestException("El roleId es obligatorio.");

      if (!this.isDomainAllowed(email)) throw new BadRequestException('Dominio institucional o comercial autorizado requerido.');

      const isProduction = process.env.NODE_ENV === 'production';
      const res = await deepEmailValidator.validate({
        email, validateRegex: true, validateTypo: false, validateDisposable: true, validateMx: isProduction, validateSMTP: false,
      });

      if (!res.valid) throw new BadRequestException('Correo del docente inválido.');

      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await this.prisma.user.create({
        data: { ...userDto, email: email.toLowerCase(), password: hashedPassword, roleId },
        include: { role: true }
      });

      const { password: _, ...result } = user;
      return result;
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  /**
   * INICIO DE SESIÓN (Con mensajes exactos)
   */
  async login(loginDto: LoginDto) {
    const { password, email } = loginDto;
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });

    // 1. Error si no existe el usuario
    if (!user) throw new UnauthorizedException("correo no registrado");

    // 2. Error si la contraseña está mal
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException("contraseña incorrecta");

    return {
      userId: user.id,
      userRole: user.role.name,
      userName: user.name,
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

      if (!user) throw new UnauthorizedException("Token de refresco inválido");

      return {
        userId: user.id,
        userRole: user.role.name,
        accessToken: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }),
        refreshToken: this.getJwtToken({ id: user.id }, { expiresIn: "7d" }),
      };
    } catch (error) {
      throw new UnauthorizedException("Token de refresco expirado o inválido");
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

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { 
          user: this.configService.get('EMAIL_USER'), 
          pass: this.configService.get('EMAIL_PASS') 
        }
      });

      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

      await transporter.sendMail({
        from: `"Soporte RepoDigital ITS" <${this.configService.get('EMAIL_USER')}>`,
        to: user.email,
        subject: 'Recuperación de Contraseña - RepoDigital',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
            <h2 style="color: #0891b2;">Recuperación de Contraseña</h2>
            <p>Hola <strong>${user.name}</strong>,</p>
            <p>Has solicitado restablecer tu contraseña.</p>
            <p>Haz clic en el enlace de abajo para continuar (expira en 1 hora):</p>
            <a href="${resetUrl}" style="background: #0891b2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Restablecer Contraseña</a>
          </div>
        `
      });

      return { message: 'Correo enviado. Revisa tu bandeja de entrada.' };
    } catch (error) {
      console.error("Error en forgotPassword:", error);
      throw new InternalServerErrorException("No se pudo enviar el correo de recuperación.");
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
    console.error("AuthService Error:", error);
    if (error instanceof BadRequestException || error instanceof UnauthorizedException || error instanceof NotFoundException) throw error;
    throw new InternalServerErrorException("Error interno del servidor.");
  }
}