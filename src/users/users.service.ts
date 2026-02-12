import { 
  Injectable, 
  NotFoundException, 
  InternalServerErrorException, 
  ConflictException, 
  BadRequestException 
} from '@nestjs/common';
import { BaseService } from 'src/prisma/base.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserModel } from 'src/prisma/generated/models';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { PaginationDto } from 'src/Libs/common';
import { Prisma } from 'src/prisma/generated/client'; 
import * as deepEmailValidator from 'deep-email-validator';

@Injectable()
export class UsersService extends BaseService<UserModel, CreateUserDto, UpdateUserDto> {
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService, { name: 'user' });
  }

  /**
   * 1. Registro Público / General
   */
  async create(createUserDto: CreateUserDto) {
    const { password, email, roleId: _, ...rest } = createUserDto;

    const role = await this.prismaService.role.findFirst({
      where: { name: 'USER' }
    });

    if (!role) {
      throw new InternalServerErrorException('El rol de lector (user) no ha sido inicializado. Ejecuta el seed.');
    }

    // --- VALIDACIÓN HÍBRIDA DE CORREO (AJUSTE RENDER) ---
    const isProduction = process.env.NODE_ENV === 'production';

    const res = await deepEmailValidator.validate({
      email: email,
      validateRegex: true,
      validateTypo: true,
      validateDisposable: true,
      // MX sí funciona en Render y filtra dominios falsos
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
    // ----------------------------------------------------

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      return await this.prismaService.user.create({
        data: {
          ...rest,
          email: email.toLowerCase(),
          password: hashedPassword,
          roleId: role.id,
        },
        include: { role: true, career: true }
      });
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  /**
   * 2. Registro de Docente (Solo Admin)
   */
  async createTeacher(createUserDto: CreateUserDto) {
    const { password, email, name, careerId } = createUserDto as any; 

    // --- VALIDACIÓN HÍBRIDA DE CORREO (AJUSTE RENDER) ---
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
        `No se puede registrar al docente. El correo es inválido o el dominio no existe. Razón: ${message}`
      );
    }
    // ----------------------------------------------------

    // Buscamos el rol 'TEACHER'
    const role = await this.prismaService.role.findFirst({
      where: { name: 'TEACHER' } 
    });
    
    if (!role) {
      throw new InternalServerErrorException('El rol TEACHER no existe en la base de datos.');
    }

    if (!careerId) {
       throw new BadRequestException('El ID de la carrera (careerId) es obligatorio para registrar un docente.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await this.prismaService.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          roleId: role.id,
          careerId: careerId,
        },
        include: { role: true, career: true }
      });
      
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;

    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  /**
   * 3. Obtener Todos (Paginado)
   */
  async findAll(paginationDto?: PaginationDto) {
    const { limit = 10, page = 1, order = 'desc' } = paginationDto || {};
    const skip = (page - 1) * limit;

    const total = await this.prismaService.user.count();

    const data = await this.prismaService.user.findMany({
      skip: skip,
      take: limit,
      include: {
        role: true,   
        career: true, 
      },
      orderBy: { createdAt: order }
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        pagination: {
          page,
          limit,
          order: order as "asc" | "desc"
        },
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    };
  }

  /**
   * 4. Obtener un usuario específico
   */
  async findOne(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      include: {
        role: true,
        career: true,
      }
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return user;
  }

  /**
   * 5. Actualizar Usuario
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prismaService.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);

    const { password, email, roleId: _, ...rest } = updateUserDto;
    let dataToUpdate: any = { 
      ...rest,
      email: email?.toLowerCase() 
    };

    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    try {
      return await this.prismaService.user.update({
        where: { id },
        data: dataToUpdate,
        include: { role: true, career: true }
      });
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  /**
   * 6. Actualizar Imagen
   */
  async updateImage(id: string, file: Express.Multer.File) {
    const user = await this.prismaService.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);

    const imagePath = `/uploads/${file.filename}`;

    return this.prismaService.user.update({
      where: { id },
      data: { image: imagePath },
      include: { role: true, career: true }
    });
  }

  /**
   * 7. Eliminar Usuario
   */
  async remove(id: string) {
    const user = await this.prismaService.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);

    try {
      return await this.prismaService.user.delete({
        where: { id }
      });
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  // =================================================================
  // MANEJO DE ERRORES PRISMA
  // =================================================================
  private handleDBErrors(error: any): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('El correo electrónico ya se encuentra registrado');
      }
      if (error.code === 'P2003') {
        throw new BadRequestException('La carrera seleccionada (ID) no existe en la base de datos.');
      }
    }
    
    if (error instanceof BadRequestException) {
        throw error;
    }

    console.error(error);
    throw new InternalServerErrorException('Error inesperado en el servidor, revise los logs.');
  }
}