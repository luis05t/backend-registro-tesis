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
import { Resend } from 'resend';
import * as deepEmailValidator from 'deep-email-validator';

@Injectable()
export class AuthService {
  private resend: Resend;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    // Inicializar Resend con la API key
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  // --- 1. WHITELIST DE DOMINIOS ---
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
    return allowedDomains.includes(domain) || allowedExtensions.some(ext => domain.endsWith(ext));
  }

  /**
   * RECUPERACIÓN DE CONTRASEÑA (Con Resend - Compatible con Render)
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ 
      where: { email: email.toLowerCase() } 
    });
    
    if (!user) {
      throw new NotFoundException('Correo no encontrado');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora

    try {
      // Guardar token en la base de datos
      await this.prisma.user.update({ 
        where: { id: user.id }, 
        data: { resetToken, resetTokenExpiry } 
      });

      // Construir URL de reset
      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

      // Enviar email usando Resend
      const { data, error } = await this.resend.emails.send({
        from: 'Soporte RepoDigital <onboarding@resend.dev>', // Usa este email en desarrollo
        to: user.email,
        subject: 'Recuperación de Contraseña - RepoDigital',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0891b2;">Hola ${user.name}</h2>
            <p style="font-size: 16px; color: #333;">
              Has solicitado restablecer tu contraseña en RepoDigital.
            </p>
            <p style="font-size: 16px; color: #333;">
              Haz clic en el siguiente botón para crear una nueva contraseña:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #0891b2; 
                        color: white; 
                        padding: 12px 30px; 
                        text-decoration: none; 
                        border-radius: 5px;
                        display: inline-block;
                        font-weight: bold;">
                Restablecer Contraseña
              </a>
            </div>
            <p style="font-size: 14px; color: #666;">
              Si no solicitaste este cambio, ignora este correo.
            </p>
            <p style="font-size: 14px; color: #666;">
              Este enlace expira en 1 hora.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              © ${new Date().getFullYear()} RepoDigital - Sistema de Gestión de Tesis
            </p>
          </div>
        `
      });

      if (error) {
        console.error("Error enviando email con Resend:", error);
        throw new InternalServerErrorException("No se pudo enviar el correo de recuperación.");
      }

      console.log("Email enviado exitosamente:", data);
      return { message: 'Correo enviado. Revisa tu bandeja de entrada.' };

    } catch (error) {
      console.error("Error en forgotPassword:", error);
      
      if (error instanceof InternalServerErrorException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new InternalServerErrorException("Error al procesar la solicitud de recuperación.");
    }
  }

  /**
   * REGISTRO DE ESTUDIANTES
   */
  async register(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId: _, ...userDto } = createUserDto;
      
      // Validar dominio permitido
      if (!this.isDomainAllowed(email)) {
        throw new BadRequestException('Dominio no permitido.');
      }
      
      // Validar formato de email (sin validaciones SMTP/MX que fallan en Render)
      const res = await deepEmailValidator.validate({
        email, 
        validateRegex: true, 
        validateTypo: false, 
        validateDisposable: true,
        validateMx: false,  // Deshabilitado para Render
        validateSMTP: false, // Deshabilitado para Render
      });
      
      if (!res.valid) {
        throw new BadRequestException('Correo electrónico inválido.');
      }

      // Buscar rol de usuario
      const role = await this.prisma.role.findFirst({ 
        where: { name: 'USER' } 
      });
      
      if (!role) {
        throw new InternalServerErrorException("Rol 'USER' no inicializado en la base de datos.");
      }

      // Crear usuario con contraseña hasheada
      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await this.prisma.user.create({
        data: { 
          ...userDto, 
          email: email.toLowerCase(), 
          password: hashedPassword, 
          roleId: role.id 
        },
      });

      // Retornar usuario y token
      return { 
        user, 
        token: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }) 
      };

    } catch (error) { 
      this.handleDBErrors(error); 
    }
  }

  /**
   * REGISTRO ADMIN (Docentes)
   */
  async registerAdmin(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId, ...userDto } = createUserDto;
      
      if (!roleId) {
        throw new BadRequestException("El roleId es obligatorio para registro de administradores.");
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await this.prisma.user.create({
        data: { 
          ...userDto, 
          email: email.toLowerCase(), 
          password: hashedPassword, 
          roleId 
        },
        include: { role: true }
      });

      // No retornar la contraseña
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

    if (!user) {
      throw new UnauthorizedException("Correo no registrado");
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException("Contraseña incorrecta");
    }

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
        include: { role: true } 
      });

      if (!user) {
        throw new UnauthorizedException("Token inválido");
      }

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
   * RESET PASSWORD
   */
  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { 
        resetToken: token, 
        resetTokenExpiry: { gt: new Date() } 
      }
    });

    if (!user) {
      throw new BadRequestException('Enlace inválido o expirado.');
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    
    await this.prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword, 
        resetToken: null, 
        resetTokenExpiry: null 
      }
    });

    return { message: 'Contraseña actualizada exitosamente' };
  }

  /**
   * Generar JWT Token
   */
  private getJwtToken(payload: JwtPayload, options?: JwtSignOptions) {
    return this.jwtService.sign(payload, options);
  }

  /**
   * Manejar errores de base de datos
   */
  private handleDBErrors(error: any): never {
    console.error("Error de base de datos:", error);
    
    if (error.code === 'P2002') {
      throw new BadRequestException('El correo electrónico ya está registrado');
    }
    
    if (error instanceof BadRequestException || 
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException) {
      throw error;
    }
    
    throw new InternalServerErrorException("Error interno del servidor.");
  }
}
