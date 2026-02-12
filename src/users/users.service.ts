import { Injectable, NotFoundException, InternalServerErrorException, ConflictException, BadRequestException } from '@nestjs/common';
import { BaseService } from 'src/prisma/base.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserModel } from 'src/prisma/generated/models';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { PaginationDto } from 'src/Libs/common';
import { Prisma } from 'src/prisma/generated/client'; 

@Injectable()
export class UsersService extends BaseService<UserModel, CreateUserDto, UpdateUserDto> {
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService, { name: 'user' });
  }

  /**
   * 1. Registro Público / General:
   * Forza la asignación del rol 'user' (Lector) a cualquier usuario.
   */
  async create(createUserDto: CreateUserDto) {
    const { password, email, roleId: _, ...rest } = createUserDto;

    // Buscamos el rol de lector por defecto ('user')
    const role = await this.prismaService.role.findFirst({
      where: { name: 'USER' }
    });

    if (!role) {
      throw new InternalServerErrorException('El rol de lector (user) no ha sido inicializado. Ejecuta el seed.');
    }

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
   * 2. Registro de Docente (Solo Admin):
   * Forza la asignación del rol 'TEACHER'.
   */
  async createTeacher(createUserDto: CreateUserDto) {
    const { password, email, name, careerId } = createUserDto;

    // Buscamos el rol 'TEACHER'
    const role = await this.prismaService.role.findFirst({
      where: { name: 'TEACHER' } 
    });
    
    if (!role) {
      throw new InternalServerErrorException('El rol TEACHER no existe en la base de datos.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      // Creamos el usuario asignándole el rol de profesor
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
      
      // Retornamos el usuario sin la contraseña por seguridad
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;

    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  /**
   * 3. Obtener Todos (Paginado) con relaciones incluidas
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
   * 4. Obtener un usuario específico por ID
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
   * 5. Actualizar Usuario (Maneja actualización opcional de contraseña)
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
   * 6. Actualizar Imagen de Perfil
   */
  async updateImage(id: string, file: Express.Multer.File) {
    const user = await this.prismaService.user.findUnique({ where: { id } });
    
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    const imagePath = `/uploads/${file.filename}`;

    return this.prismaService.user.update({
      where: { id },
      data: {
        image: imagePath,
      },
      include: { role: true, career: true }
    });
  }

  /**
   * 7. Eliminar Usuario (Soft delete o Hard delete según config, aquí es Hard Delete)
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
  // HELPER PRIVADO PARA MANEJO DE ERRORES PRISMA
  // =================================================================
  private handleDBErrors(error: any): never {
    // Si es un error conocido de Prisma
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: Violación de restricción única (ej. email duplicado)
      if (error.code === 'P2002') {
        throw new ConflictException('El correo electrónico ya está registrado en el sistema.');
      }
      // P2003: Violación de clave foránea (ej. careerId no existe)
      if (error.code === 'P2003') {
        throw new BadRequestException('La carrera seleccionada (ID) no existe en la base de datos.');
      }
    }

    // Logueamos el error original en consola para debugging
    console.error(error);
    
    // Lanzamos un error 500 genérico si no lo pudimos identificar
    throw new InternalServerErrorException('Error inesperado en el servidor, revise los logs.');
  }
}