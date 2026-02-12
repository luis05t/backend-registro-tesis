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

  // --- CONFIGURACIÓN DE LISTA BLANCA ESTRICTA ---
  private isDomainAllowed(email: string): boolean {
    const domain = email.split('@')[1].toLowerCase();
    
    // Dominios específicos solicitados
    const allowedDomains = [
      'sudamericano.edu.ec',
      'gmail.com',
      'outlook.com',
      'hotmail.com',
      'yahoo.com',
      'yahoo.es',
      'icloud.com',
      'live.com',
      'msn.com',
      'me.com',
      'zoho.com'
    ];

    // Extensiones institucionales y gubernamentales
    const allowedExtensions = ['.edu.ec', '.edu', '.gob', '.gov'];

    const isInList = allowedDomains.includes(domain);
    const hasValidExtension = allowedExtensions.some(ext => domain.endsWith(ext));

    return isInList || hasValidExtension;
  }

  /**
   * 1. Registro Público / General
   */
  async create(createUserDto: CreateUserDto) {
    const { password, email, roleId: _, ...rest } = createUserDto;

    // --- FILTRO 1: LISTA BLANCA ---
    if (!this.isDomainAllowed(email)) {
      throw new BadRequestException(
        'Dominio de correo no permitido. Use el institucional (@sudamericano.edu.ec) o un proveedor autorizado.'
      );
    }

    const role = await this.prismaService.role.findFirst({
      where: { name: 'USER' }
    });

    if (!role) {
      throw new InternalServerErrorException('El rol de lector (user) no ha sido inicializado.');
    }

    // --- FILTRO 2: VALIDACIÓN TÉCNICA (RENDER) ---
    const isProduction = process.env.NODE_ENV === 'production';
    const res = await deepEmailValidator.validate({
      email: email,
      validateRegex: true,
      validateTypo: false,         // Desactivado para dominios .ec
      validateDisposable: true,
      validateMx: isProduction,    // Solo en producción para evitar bloqueos locales
      validateSMTP: false,         // Desactivado por seguridad en la nube
    });

    if (!res.valid) {
      throw new BadRequestException('El correo electrónico es inválido o el servidor no existe.');
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
   * 2. Registro de Docente (Solo Admin)
   */
  async createTeacher(createUserDto: CreateUserDto) {
    const { password, email, name, careerId } = createUserDto as any; 

    // --- FILTRO 1: LISTA BLANCA ---
    if (!this.isDomainAllowed(email)) {
      throw new BadRequestException(
        'El correo del docente debe ser institucional o de un proveedor comercial válido.'
      );
    }

    // --- FILTRO 2: VALIDACIÓN TÉCNICA (RENDER) ---
    const isProduction = process.env.NODE_ENV === 'production';
    const res = await deepEmailValidator.validate({
      email: email,
      validateRegex: true,
      validateTypo: false,
      validateDisposable: true,
      validateMx: isProduction,    
      validateSMTP: false, 
    });

    if (!res.valid) {
      throw new BadRequestException('El correo del docente no es válido o no existe.');
    }

    const role = await this.prismaService.role.findFirst({
      where: { name: 'TEACHER' } 
    });
    
    if (!role) {
      throw new InternalServerErrorException('El rol TEACHER no existe.');
    }

    if (!careerId) {
       throw new BadRequestException('El ID de la carrera es obligatorio.');
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

  // ... (findAll, findOne, update, updateImage, remove se mantienen igual)

  async findAll(paginationDto?: PaginationDto) {
    const { limit = 10, page = 1, order = 'desc' } = paginationDto || {};
    const skip = (page - 1) * limit;
    const total = await this.prismaService.user.count();
    const data = await this.prismaService.user.findMany({
      skip, take: limit, include: { role: true, career: true }, orderBy: { createdAt: order }
    });
    const totalPages = Math.ceil(total / limit);
    return { data, meta: { total, pagination: { page, limit, order: order as "asc" | "desc" }, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } };
  }

  async findOne(id: string) {
    const user = await this.prismaService.user.findUnique({ where: { id }, include: { role: true, career: true } });
    if (!user) throw new NotFoundException(`Usuario no encontrado`);
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prismaService.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario no encontrado`);
    const { password, email, roleId: _, ...rest } = updateUserDto;
    let dataToUpdate: any = { ...rest, email: email?.toLowerCase() };
    if (password) dataToUpdate.password = await bcrypt.hash(password, 10);
    try {
      return await this.prismaService.user.update({ where: { id }, data: dataToUpdate, include: { role: true, career: true } });
    } catch (error) { this.handleDBErrors(error); }
  }

  async updateImage(id: string, file: Express.Multer.File) {
    const user = await this.prismaService.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario no encontrado`);
    return this.prismaService.user.update({ where: { id }, data: { image: `/uploads/${file.filename}` }, include: { role: true, career: true } });
  }

  async remove(id: string) {
    const user = await this.prismaService.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario no encontrado`);
    try { return await this.prismaService.user.delete({ where: { id } }); } 
    catch (error) { this.handleDBErrors(error); }
  }

  private handleDBErrors(error: any): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException('El correo electrónico ya se encuentra registrado');
      if (error.code === 'P2003') throw new BadRequestException('La carrera seleccionada no existe.');
    }
    if (error instanceof BadRequestException) throw error;
    console.error(error);
    throw new InternalServerErrorException('Error inesperado en el servidor.');
  }
}