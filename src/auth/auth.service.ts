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
import { google } from 'googleapis'; 

@Injectable()
export class AuthService {
  private oauth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get('MAIL_CLIENT_ID'),
      this.configService.get('MAIL_CLIENT_SECRET'),
      'https://developers.google.com/oauthplayground'
    );

    this.oauth2Client.setCredentials({
      refresh_token: this.configService.get('MAIL_REFRESH_TOKEN')
    });
  }

  private isDomainAllowed(email: string): boolean {
    const domain = email.split('@')[1].toLowerCase();
    const allowedDomains = ['sudamericano.edu.ec', 'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com'];
    const allowedExtensions = ['.edu.ec', '.gob.ec', '.org.ec', '.com.ec', '.net.ec', '.ec', '.com', '.edu'];
    return allowedDomains.includes(domain) || allowedExtensions.some(ext => domain.endsWith(ext));
  }

  async register(createUserDto: CreateUserDto) {
    try {
      const { password, email, roleId: _, ...userDto } = createUserDto;
      if (!this.isDomainAllowed(email)) throw new BadRequestException('Dominio de correo no permitido.');

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) throw new BadRequestException('Correo inválido.');

      const role = await this.prisma.role.findFirst({ where: { name: 'USER' } });
      if (!role) throw new InternalServerErrorException("Error: El rol 'USER' no existe.");

      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await this.prisma.user.create({
        data: { ...userDto, email: email.toLowerCase(), password: hashedPassword, roleId: role.id },
      });
      return { user, token: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }) };
    } catch (error) { this.handleDBErrors(error); }
  }

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

  async refreshToken(refreshDto: RefreshDto) {
    try {
      const payload = this.jwtService.verify(refreshDto.refreshToken, { secret: this.configService.get<string>("JWT_SECRET") });
      const user = await this.prisma.user.findUnique({ where: { id: payload.id }, include: { role: true } });
      if (!user) throw new UnauthorizedException("Token inválido");
      return {
        userId: user.id, userRole: user.role.name,
        accessToken: this.getJwtToken({ id: user.id }, { expiresIn: "2d" }),
        refreshToken: this.getJwtToken({ id: user.id }, { expiresIn: "7d" }),
      };
    } catch (error) { throw new UnauthorizedException("Token expirado"); }
  }

  private makeBody(to: string, from: string, subject: string, message: string) {
    const str = [
      `To: ${to}`,
      `From: ${from}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      message
    ].join('\n');

    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new NotFoundException('Correo no encontrado');

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); 

    try {
      await this.prisma.user.update({ where: { id: user.id }, data: { resetToken, resetTokenExpiry } });

      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

      const accessToken = await this.oauth2Client.getAccessToken();
      
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      const emailBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #0056b3;">Recuperación de Contraseña</h2>
          <p>Hola <strong>${user.name}</strong>,</p>
          <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
          <a href="${resetUrl}" style="background-color: #0056b3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0;">Restablecer Contraseña</a>
        </div>
      `;

      const raw = this.makeBody(
        user.email,
        `"Soporte Tesis" <${this.configService.get('MAIL_USER')}>`,
        'Recuperación de Contraseña',
        emailBody
      );

      console.log("Enviando correo vía API Gmail (HTTP)...");
      
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: raw },
      });

      console.log("¡Correo enviado con éxito vía API!");
      return { message: 'Correo enviado correctamente.' };
    } catch (error) {
      console.error("Error FATAL enviando correo (API Gmail):", error);
      throw new InternalServerErrorException("Error al enviar el correo.");
    }
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({ where: { resetToken: token, resetTokenExpiry: { gt: new Date() } } });
    if (!user) throw new BadRequestException('El enlace es inválido o ha expirado.');

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null }
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  private getJwtToken(payload: JwtPayload, options?: JwtSignOptions) { return this.jwtService.sign(payload, options); }

  private handleDBErrors(error: any): never {
    if (error.code === 'P2002') throw new BadRequestException('Correo ya registrado');
    throw new InternalServerErrorException("Error interno del servidor.");
  }
}