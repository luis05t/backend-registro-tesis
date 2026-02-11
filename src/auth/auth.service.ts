import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
// CORRECCIÓN: Usamos 'bcrypt' para coincidir con la librería instalada en UsersService
import * as bcrypt from "bcrypt"; 
import { CreateUserDto } from "src/users/dto/create-user.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { LoginDto } from "./dto/loginDto";
import { RefreshDto } from "./dto/refreshDto";
import { JwtPayload } from "./interfaces/jwt-payload.interface";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    try {
      const { password, ...userDto } = createUserDto;

      // --- AGREGADO: Buscar el rol 'user' por defecto ---
      const role = await this.prisma.role.findFirst({
        where: { name: 'user' }, 
      });

      if (!role) {
        throw new InternalServerErrorException("El rol por defecto 'user' no existe en la base de datos");
      }
      // ------------------------------------------------

      const hashedPassword = bcrypt.hashSync(password, 10);

      const user = await this.prisma.user.create({
        data: {
          ...userDto,
          password: hashedPassword,
          roleId: role.id, // Forzamos la asignación del rol 'user'
        },
      });

      return user;
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async registerAdmin(createUserDto: CreateUserDto) {
    try {
      const { password, ...userDto } = createUserDto;
      const hashedPassword = bcrypt.hashSync(password, 10);

      const user = await this.prisma.user.create({
        data: {
          ...userDto,
          password: hashedPassword,
        },
      });

      return user;
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async login(loginDto: LoginDto) {
    const { password, email } = loginDto;

    // Aquí NO necesitamos ?limit=1000 porque buscamos uno solo por email (findUnique)
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        email: true,
        password: true, // Necesitamos traer el password encriptado
        id: true,
        role: true,
      },
    });

    if (!user) throw new UnauthorizedException("Correo incorrecto");
    
    // Esta línea es la magia: compara el texto plano con el hash de la BD
    if (!bcrypt.compareSync(password, user.password))
      throw new UnauthorizedException("Contraseña incorrecta");

    const accessToken = this.getJwtToken({ id: user.id }, { expiresIn: "2d" });
    const refreshToken = this.getJwtToken({ id: user.id }, { expiresIn: "7d" });

    return {
      userId: user.id,
      UserRole: user.role,
      accessToken,
      refreshToken,
    };
  }

  private getJwtToken(payload: JwtPayload, options?: JwtSignOptions) {
    const token = this.jwtService.sign(payload, options);
    return token;
  }

  async refreshToken(refreshDto: RefreshDto) {
    try {
      const payload = this.jwtService.verify(refreshDto.refreshToken, {
        secret: this.configService.get<string>("JWT_SECRET"),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        select: { email: true, password: true, id: true },
      });

      if (!user) throw new UnauthorizedException("Invalid refresh token");
      const accessToken = this.getJwtToken(
        { id: user.id },
        { expiresIn: "2d" },
      );
      const refreshToken = this.getJwtToken(
        { id: user.id },
        { expiresIn: "7d" },
      );

      return {
        ...user,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      throw error;
    }
  }
  
  private handleDBErrors(error): never {
    if (error.code === "23505") throw new BadRequestException(error.detail);
    if (error.code?.startsWith("P")) {
      throw error; 
    }

    throw new InternalServerErrorException("Please check server logs");
  }
}