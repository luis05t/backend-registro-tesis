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

  // --- 1. CONFIGURACIÓN DE LISTA BLANCA ESTRICTA ---
  private isDomainAllowed(email: string): boolean {
    const domain = email.split('@')[1].toLowerCase();
    
    const allowedDomains = [
      'sudamericano.edu.ec', 'gmail.com', 'outlook.com', 'hotmail.com',
      'yahoo.com', 'yahoo.es', 'icloud.com', 'live.com', 'msn.com',
      'me.com', 'zoho.com'
    ];

    const allowedExtensions = ['.edu.ec', '.edu', '.gob', '.gov'];

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

      // FILTRO DE LISTA BLANCA
      if (!this.isDomainAllowed(email)) {
        throw new BadRequestException(
          'Dominio no permitido. Use el institucional (@sudamericano.edu.ec) o proveedores autorizados.'
        );
      }

      // VALIDACIÓN TÉCNICA (RENDER)
      const isProduction = process.env.NODE_ENV === 'production';
      const res = await deepEmailValidator.validate({
        email: email,
        validateRegex: true,
        validateTypo: false,       // <--- CLAVE: Evita el error de "Likely typo" en .edu.ec
        validateDisposable: true,
        validateMx: isProduction,  
        validateSMTP: false,       // Evita AggregateError en la nube
      });

      if (!res.valid) {
        throw new BadRequestException('El correo electrónico es inválido o el servidor no responde.');
      }

      const role = await this.prisma.role.findFirst({ where: { name: 'USER' } });
      if (!role) throw new InternalServerErrorException("Rol 'USER' no inicializado.");

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
   * REGISTRO ADMINISTRATIVO (Docentes)
   */
  async registerAdmin(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId, ...userDto } = createUserDto;
      if (!roleId) throw new BadRequestException("El roleId es obligatorio.");

      if (!this.isDomainAllowed(email)) {
        throw new BadRequestException('Dominio institucional o comercial autorizado requerido.');
      }

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
   * INICIO DE SESIÓN
   */
  async login(loginDto: LoginDto) {
    const { password, email } = loginDto;
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });

    if (!user) throw new UnauthorizedException("Credenciales no válidas (Email)");
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException("Credenciales no válidas (Password)");

    return {
      userId: user.id,
      userRole: user.role.name,
      userName: user.name,
      accessToken: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }),
      refreshToken: this.getJwtToken({ id: user.id }, { expiresIn: "7d" }),
    };
  }

  /**
   * RECUPERACIÓN DE CONTRASEÑA
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new NotFoundException('Correo no encontrado');

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); 

    await this.prisma.user.update({ where: { id: user.id }, data: { resetToken, resetTokenExpiry } });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    await transporter.sendMail({
      from: `Soporte RepoDigital <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Recuperación de Contraseña',
      html: `<p>Hola <strong>${user.name}</strong>, usa este enlace para cambiar tu clave: <a href="${resetUrl}">${resetUrl}</a></p>`
    });

    return { message: 'Correo enviado. Revisa tu bandeja de entrada.' };
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
    console.error("AuthService Error:", error);
    if (error.code === 'P2002') throw new BadRequestException('El correo ya está registrado');
    if (error instanceof BadRequestException || error instanceof UnauthorizedException || error instanceof NotFoundException) throw error;
    throw new InternalServerErrorException("Error interno del servidor.");
  }
}