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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // --- VALIDACIONES ---
  private isDomainAllowed(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    
    const allowedPatterns = [
      'sudamericano.edu.ec',
      /^(gmail|outlook|hotmail|yahoo|icloud)\.com$/,
      /\.(edu|gob|org|com|net)\.ec$/,
      /\.(com|edu)$/
    ];
    
    return allowedPatterns.some(pattern => 
      typeof pattern === 'string' ? pattern === domain : pattern.test(domain)
    );
  }

  // --- REGISTRO Y LOGIN ---
  async register(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId: _, ...userDto } = createUserDto;
      if (!this.isDomainAllowed(email)) {
        throw new BadRequestException('Dominio de correo no permitido.');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new BadRequestException('Correo inválido.');
      }

      const role = await this.prisma.role.findFirst({ 
        where: { name: 'USER' } 
      });
      
      if (!role) {
        throw new InternalServerErrorException("Error: El rol 'USER' no existe.");
      }

      // ✅ Cambio: bcrypt asíncrono
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await this.prisma.user.create({
        data: { 
          ...userDto, 
          email: email.toLowerCase(), 
          password: hashedPassword, 
          roleId: role.id 
        },
      });
      
      return { 
        user, 
        token: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }) 
      };
    } catch (error) { 
      this.handleDBErrors(error); 
    }
  }

  async registerAdmin(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId, ...userDto } = createUserDto;
      if (!roleId) {
        throw new BadRequestException("El roleId es obligatorio.");
      }

      // ✅ Cambio: bcrypt asíncrono
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await this.prisma.user.create({
        data: { 
          ...userDto, 
          email: email.toLowerCase(), 
          password: hashedPassword, 
          roleId 
        },
        include: { role: true }
      });

      const { password: _, ...result } = user;
      return result;
    } catch (error) { 
      this.handleDBErrors(error); 
    }
  }

  async login(loginDto: LoginDto) {
    const { password, email } = loginDto;
    
    const user = await this.prisma.user.findUnique({ 
      where: { email: email.toLowerCase() }, 
      include: { role: true } 
    });
    
    if (!user) {
      throw new UnauthorizedException("correo no registrado");
    }
    
    // ✅ Cambio: bcrypt asíncrono
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException("contraseña incorrecta");
    }
    
    return {
      userId: user.id, 
      userRole: user.role.name, 
      userName: user.name,
      accessToken: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }),
      refreshToken: this.getJwtToken({ id: user.id }, { expiresIn: "7d" }),
    };
  }

  async refreshToken(refreshDto: RefreshDto) {
    try {
      const payload = this.jwtService.verify(
        refreshDto.refreshToken, 
        { secret: this.configService.get<string>("JWT_SECRET") }
      );
      
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
      throw new UnauthorizedException("Token expirado"); 
    }
  }

  // --- ENVÍO DE CORREO (CORREGIDO PARA RENDER) ---
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
      await this.prisma.user.update({ 
        where: { id: user.id }, 
        data: { resetToken, resetTokenExpiry } 
      });

      // ✅ Ofuscar email en logs
      const maskedEmail = user.email.replace(/(.{2}).*(@.*)/, '$1***$2');
      console.log("Intentando enviar correo a:", maskedEmail);

      // ✅ CONFIGURACIÓN CORREGIDA CON IPv4
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        family: 4, // ⬅️ CRÍTICO: Fuerza IPv4 para evitar ENETUNREACH
        auth: {
          type: 'OAuth2',
          user: this.configService.get('MAIL_USER'),
          clientId: this.configService.get('MAIL_CLIENT_ID'),
          clientSecret: this.configService.get('MAIL_CLIENT_SECRET'),
          refreshToken: this.configService.get('MAIL_REFRESH_TOKEN'),
        },
        // ✅ SIN tls.rejectUnauthorized: false (Gmail tiene certificados válidos)
      } as any);

      // Verificación previa del servidor SMTP
      try {
        await transporter.verify();
        console.log("✅ Servidor SMTP conectado correctamente (IPv4)");
      } catch (verifyError) {
        console.error("❌ Error verificando conexión SMTP:", verifyError.message);
        throw new InternalServerErrorException(
          "No se pudo conectar con el servidor de correo. Verifica la configuración OAuth2."
        );
      }

      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

      await transporter.sendMail({
        from: `"Soporte Tesis" <${this.configService.get('MAIL_USER')}>`,
        to: user.email, 
        subject: 'Recuperación de Contraseña',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0056b3;">Recuperación de Contraseña</h2>
            <p>Hola <strong>${user.name}</strong>,</p>
            <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
            <p>Haz clic en el siguiente botón para continuar:</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #0056b3; 
                        color: white; 
                        padding: 12px 24px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        display: inline-block;">
                Restablecer Contraseña
              </a>
            </div>
            <p><small style="color: #666;">Este enlace expira en 1 hora.</small></p>
            <p><small style="color: #999;">Si no solicitaste este cambio, ignora este correo.</small></p>
          </div>
        `
      });

      console.log("✅ Correo enviado exitosamente");
      return { message: 'Correo enviado correctamente.' };
      
    } catch (error) {
      console.error("❌ Error FATAL enviando correo:", error);
      throw new InternalServerErrorException(
        "Error al enviar el correo. Verifica los logs del servidor."
      );
    }
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({ 
      where: { 
        resetToken: token, 
        resetTokenExpiry: { gt: new Date() } 
      } 
    });
    
    if (!user) {
      throw new BadRequestException('El enlace es inválido o ha expirado.');
    }

    // ✅ Cambio: bcrypt asíncrono
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
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

  private getJwtToken(payload: JwtPayload, options?: JwtSignOptions) { 
    return this.jwtService.sign(payload, options); 
  }

  private handleDBErrors(error: any): never {
    if (error.code === 'P2002') {
      throw new BadRequestException('Correo ya registrado');
    }
    console.error('Error de base de datos:', error);
    throw new InternalServerErrorException("Error interno del servidor.");
  }
}