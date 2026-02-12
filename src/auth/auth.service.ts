import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
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

  /**
   * REGISTRO PÚBLICO:
   * Forza la asignación del rol 'user' (Lector).
   */
  async register(createUserDto: CreateUserDto) {
    try {
      // 1. Extraemos roleId y lo renombramos a '_' para ignorar lo que venga del frontend.
      // Esto limpia el objeto userDto de cualquier propiedad 'undefined'.
      const { password, email, roleId: _, ...userDto } = createUserDto;

      // 2. Buscamos el ID del rol de lector ('user') en la base de datos
      const role = await this.prisma.role.findFirst({
        where: { name: 'USER' }, 
      });

      if (!role) {
        throw new InternalServerErrorException(
          "El rol por defecto 'user' no existe. Asegúrate de haber ejecutado el seed de la base de datos."
        );
      }

      const hashedPassword = bcrypt.hashSync(password, 10);

      // 3. Creamos el usuario pasando el roleId obligatorio manualmente
      const user = await this.prisma.user.create({
        data: {
          ...userDto,
          email: email.toLowerCase(),
          password: hashedPassword,
          roleId: role.id, // Asignamos el string garantizado de la base de datos
        },
      });

      // Limpiamos la respuesta
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
    
    // Comparamos el texto plano con el hash de la BD
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
  
  private getJwtToken(payload: JwtPayload, options?: JwtSignOptions) {
    return this.jwtService.sign(payload, options);
  }

  private handleDBErrors(error: any): never {
    // Log para depuración en consola
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