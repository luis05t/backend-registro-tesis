import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException, // Importante para recuperar contraseña
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import * as bcrypt from "bcrypt"; 
import { CreateUserDto } from "src/users/dto/create-user.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { LoginDto } from "./dto/loginDto";
import { RefreshDto } from "./dto/refreshDto";
import { JwtPayload } from "./interfaces/jwt-payload.interface";
// --- NUEVAS IMPORTACIONES ---
import * as crypto from 'crypto'; 
import * as nodemailer from 'nodemailer'; 

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * REGISTRO PÚBLICO:
   * Forza la asignación del rol 'user' (Lector).
   */
  async register(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId: _, ...userDto } = createUserDto;

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
   * REGISTRO ADMINISTRATIVO:
   * Permite crear usuarios con roles específicos (como TEACHER).
   */
  async registerAdmin(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId, ...userDto } = createUserDto;
      
      if (!roleId) {
        throw new BadRequestException("El roleId es obligatorio para registros administrativos");
      }

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
  //  NUEVAS FUNCIONES PARA RECUPERACIÓN DE CONTRASEÑA
  // =================================================================

  /**
   * 1. SOLICITAR RECUPERACIÓN (Genera token y envía correo)
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new NotFoundException('Correo no encontrado');

    // Generar token aleatorio
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora de validez

    // Guardar en BD
    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    });

    // Configurar envío de correo usando VARIABLES DE ENTORNO
    // ESTO ES CLAVE PARA QUE FUNCIONE EN RENDER
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Render leerá esto de tus Environment Variables
        pass: process.env.EMAIL_PASS  // Render leerá esto de tus Environment Variables
      }
    });

    // Lógica inteligente: Si hay variable FRONTEND_URL úsala, sino usa localhost
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
          
          <p style="font-size: 13px; color: #666; text-align: center;">
            Este enlace expirará en 1 hora. Si no solicitaste este cambio, puedes ignorar este mensaje.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return { message: 'Correo enviado. Revisa tu bandeja de entrada.' };
  }

  /**
   * 2. RESTABLECER LA CONTRASEÑA (Recibe token y nueva pass)
   */
  async resetPassword(token: string, newPassword: string) {
    // Buscar usuario con ese token y que no haya expirado
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() } 
      }
    });

    if (!user) throw new BadRequestException('El enlace es inválido o ha expirado.');

    // Hashear nueva contraseña
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    // Actualizar usuario y limpiar el token
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

    if (error instanceof InternalServerErrorException) {
      throw error;
    }

    throw new InternalServerErrorException("Error interno del servidor, verifique los logs.");
  }
}