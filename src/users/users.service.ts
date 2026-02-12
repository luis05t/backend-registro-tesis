import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { BaseService } from 'src/prisma/base.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserModel } from 'src/prisma/generated/models';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { PaginationDto } from 'src/Libs/common';

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
    // IMPORTANTE: Extraemos 'roleId' y lo descartamos (_) para evitar errores de TS
    // ya que en el DTO es opcional (string | undefined) y Prisma lo requiere como string.
    const { password, email, roleId: _, ...rest } = createUserDto;

    // Buscamos el rol de lector por defecto ('user')
    const role = await this.prismaService.role.findFirst({
      where: { name: 'USER' }
    });

    if (!role) {
      throw new InternalServerErrorException('El rol de lector (user) no ha sido inicializado en la base de datos. Ejecuta el seed.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prismaService.user.create({
      data: {
        ...rest,
        email: email.toLowerCase(),
        password: hashedPassword,
        roleId: role.id, // Asignamos el ID obligatorio del rol de lector
      },
      include: { role: true, career: true }
    });
  }

  /**
   * 2. Registro de Docente (Solo Admin):
   * Forza la asignación del rol 'TEACHER'.
   */
  async createTeacher(createUserDto: CreateUserDto) {
    const { password, email, name, careerId } = createUserDto;

    // Buscamos el rol 'TEACHER' (Mayúsculas como se definió en el seed)
    const role = await this.prismaService.role.findFirst({
      where: { name: 'TEACHER' } 
    });
    
    if (!role) {
      throw new InternalServerErrorException('El rol TEACHER no existe en la base de datos. Ejecuta el seed.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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

    // Al igual que en create, descartamos roleId si viniera opcional
    const { password, email, roleId: _, ...rest } = updateUserDto;
    let dataToUpdate: any = { 
      ...rest,
      email: email?.toLowerCase() 
    };

    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    return this.prismaService.user.update({
      where: { id },
      data: dataToUpdate,
      include: { role: true, career: true }
    });
  }

  /**
   * 6. Actualizar Imagen de Perfil
   */
  async updateImage(id: string, file: Express.Multer.File) {
    const user = await this.prismaService.user.findUnique({ where: { id } });
    
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // Ruta estática para acceder a la imagen configurada en main.ts
    const imagePath = `/uploads/${file.filename}`;

    return this.prismaService.user.update({
      where: { id },
      data: {
        image: imagePath,
      },
      include: { role: true, career: true }
    });
  }
}