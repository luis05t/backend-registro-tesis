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

  // --- 1. Crear Usuario Normal (con Hash de contraseña) ---
  async create(createUserDto: CreateUserDto) {
    const { password, ...rest } = createUserDto;
    
    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prismaService.user.create({
      data: {
        ...rest,
        password: hashedPassword,
      },
    });
  }

  // --- 2. NUEVO: Crear Docente (Solo Admin) ---
  async createTeacher(createUserDto: CreateUserDto) {
    const { password, email, name, careerId } = createUserDto;

    // Buscamos el rol 'TEACHER' (Mayúsculas porque así está en el seed)
    const role = await this.prismaService.role.findFirst({
      where: { name: 'TEACHER' } 
    });
    
    if (!role) {
      throw new InternalServerErrorException('El rol TEACHER no existe en la base de datos');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Creamos el usuario asignándole el rol de profesor
    const user = await this.prismaService.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roleId: role.id,
        careerId: careerId,
      },
    });
    
    // Retornamos el usuario sin la contraseña
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // --- 3. Obtener Todos (Paginado) ---
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

  // --- 4. Obtener Uno ---
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

  // --- 5. Actualizar Usuario ---
  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prismaService.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);

    const { password, ...rest } = updateUserDto;
    let dataToUpdate: any = { ...rest };

    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    return this.prismaService.user.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  // --- 6. Actualizar Imagen ---
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
    });
  }
}