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

  /**
   * REGISTRO PÚBLICO
   */
  async register(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId: _, ...userDto } = createUserDto;

      // --- VALIDACIÓN CORREGIDA PARA RENDER ---
      const isProduction = process.env.NODE_ENV === 'production';

      const res = await deepEmailValidator.validate({
        email: email,
        validateRegex: true,
        validateTypo: true,
        validateDisposable: true,
        // MX sí funciona en Render (revisa si el dominio es real)
        validateMx: isProduction,
        // SMTP DEBE SER FALSE: Render bloquea el puerto 25 y causa AggregateError
        validateSMTP: false, 
      });

      if (!res.valid) {
        const errorReason = res.reason;
        const details = errorReason ? res.validators[errorReason] : null;
        const message = details?.reason || errorReason || 'Desconocida';

        throw new BadRequestException(
          `El correo electrónico no es válido o no existe. Razón: ${message}`
        );
      }
      // --------------------------------------

      const role = await this.prisma.role.findFirst({
        where: { name: 'USER' }, 
      });

      if (!role) {
        throw new InternalServerErrorException(
          "El rol por defecto 'user' no existe. Asegúrate de haber ejecutado el seed de la base de datos."
        );
      }

      const hashedPassword = bcrypt.hashSync(password, 10);

      const user = await this.prisma.user.create({
        data: {
          ...userDto,
          email: email.toLowerCase(),
          password: hashedPassword,
          roleId: role.id, 
        },
      });

      const { password: __, ...result } = user;
      
      return {
        user: result,
        token: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }),
      };
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  /**
   * REGISTRO ADMINISTRATIVO
   */
  async registerAdmin(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId, ...userDto } = createUserDto;
      
      if (!roleId) {
        throw new BadRequestException("El roleId es obligatorio para registros administrativos");
      }

      // --- VALIDACIÓN CORREGIDA PARA RENDER ---
      const isProduction = process.env.NODE_ENV === 'production';

      const res = await deepEmailValidator.validate({
        email: email,
        validateRegex: true,
        validateTypo: true,
        validateDisposable: true,
        validateMx: isProduction, 
        validateSMTP: false, // Evita AggregateError en producción
      });

      if (!res.valid) {
        const errorReason = res.reason;
        const details = errorReason ? res.validators[errorReason] : null;
        const message = details?.reason || errorReason || 'Desconocida';

        throw new BadRequestException(
          `No se puede registrar al usuario. El correo electrónico es inválido. Razón: ${message}`
        );
      }
      // --------------------------------------

      const hashedPassword = bcrypt.hashSync(password, 10);

      const user = await this.prisma.user.create({
        data: {
          ...userDto,
          email: email.toLowerCase(),
          password: hashedPassword,
          roleId: roleId, 
        },
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
      include: {
        role: true, 
      },
    });

    if (!user) throw new UnauthorizedException("Credenciales no válidas (Email)");
    
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException("Credenciales no válidas (Password)");

    const accessToken = this.getJwtToken({ id: user.id }, { expiresIn: "2d" });
    const refreshToken = this.getJwtToken({ id: user.id }, { expiresIn: "7d" });

    return {
      userId: user.id,
      userRole: user.role.name,
      userName: user.name,
      accessToken,
      refreshToken,
    };
  }

  /**
   * REFRESCO DE TOKEN
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

  // =================================================================
  //  RECUPERACIÓN DE CONTRASEÑA
  // =================================================================

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new NotFoundException('Correo no encontrado');

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); 

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
      }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    const mailOptions = {
      from: `Soporte RepoDigital <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Recuperación de Contraseña - RepoDigital',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #0891b2; text-align: center;">Recuperación de Contraseña</h2>
          <p>Hola <strong>${user.name}</strong>,</p>
          <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta institucional.</p>
          <p>Para continuar, haz clic en el siguiente botón:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #0891b2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Restablecer Contraseña</a>
          </div>
          <p style="font-size: 13px; color: #666; text-align: center;">Este enlace expirará en 1 hora.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return { message: 'Correo enviado. Revisa tu bandeja de entrada.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() } 
      }
    });

    if (!user) throw new BadRequestException('El enlace es inválido o ha expirado.');

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    return { message: 'Contraseña actualizada correctamente' };
  }
  
  // =================================================================

  private getJwtToken(payload: JwtPayload, options?: JwtSignOptions) {
    return this.jwtService.sign(payload, options);
  }

  private handleDBErrors(error: any): never {
    console.error("AuthService Error:", error);
    if (error.code === 'P2002') {
      throw new BadRequestException('El correo electrónico ya se encuentra registrado');
    }
    if (error instanceof InternalServerErrorException) throw error;
    if (error instanceof BadRequestException) throw error; 
    
    throw new InternalServerErrorException("Error interno del servidor, verifique los logs.");
  }
}