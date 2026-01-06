import * as bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseService } from 'src/prisma/base.service';
import { UserModel } from 'src/prisma/generated/models';

@Injectable()
export class UsersService extends BaseService<
  UserModel,
  CreateUserDto,
  UpdateUserDto
> {
  constructor(
    private readonly prismaService: PrismaService,
  ) {
    super(prismaService, { name: 'user' });
  }

  // --- 1. MÉTODO PARA CREAR (CON ENCRIPTACIÓN) ---
  async create(data: CreateUserDto): Promise<UserModel> {
    // Encripta la contraseña antes de guardar
    if (data.password) {
      data.password = bcrypt.hashSync(data.password, 10);
    }
    return super.create(data);
  }

  // --- 2. MÉTODO PARA ACTUALIZAR (MANEJA IMAGEN Y PASSWORD) ---
  async update(id: string, data: UpdateUserDto): Promise<UserModel> {
    // Si el usuario está cambiando la contraseña, la encriptamos
    if (data.password) {
      data.password = bcrypt.hashSync(data.password, 10);
    }

    // El campo 'image' se guardará automáticamente si viene en el data 
    // porque ya lo agregamos al DTO y a la Base de Datos.
    return super.update(id, data);
  }
}