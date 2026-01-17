import { 
  Injectable, 
  ForbiddenException, 
  NotFoundException, 
  ConflictException, // <--- 1. ASEGÚRATE DE IMPORTAR ESTO
  InternalServerErrorException 
} from '@nestjs/common';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { BaseService } from 'src/prisma/base.service';
import { SkillsModel } from 'src/prisma/generated/models';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModel as User } from 'src/prisma/generated/models/User'; 
import { Prisma } from 'src/prisma/generated/client';

@Injectable()
export class SkillsService extends BaseService<SkillsModel, CreateSkillDto, UpdateSkillDto> {
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService, { name: 'skills' });
  }

  // --- AQUÍ ESTÁ LA CORRECCIÓN ---
  async createWithUser(createSkillDto: CreateSkillDto, user: User) {
    const { createdBy, ...rest } = createSkillDto;

    try {
      // Intentamos crear la habilidad
      return await this.prismaService.skills.create({
        data: {
          ...rest,
          details: rest.details as Prisma.InputJsonValue,
          createdById: user.id,
        },
      });
    } catch (error) {
      // Si falla, verificamos si es por duplicado (código P2002)
      if (error.code === 'P2002') {
        throw new ConflictException('Habilidad ya agregada');
      }
      // Si es otro error, lanzamos error interno
      throw new InternalServerErrorException('Error al crear la habilidad');
    }
  }
  // -------------------------------

  async updateWithPermission(id: string, updateSkillDto: UpdateSkillDto, user: User) {
    // ... (el resto de tu código sigue igual)
    const skill = await this.prismaService.skills.findUnique({ where: { id } });

    if (!skill) {
      throw new NotFoundException(`Skill con ID ${id} no encontrada`);
    }

    const userWithRole = await this.prismaService.user.findUnique({
      where: { id: user.id },
      include: { role: true }
    });

    const roleName = userWithRole?.role?.name?.toLowerCase();
    const isAdmin = roleName === 'admin' || roleName === 'administrador';
    const isOwner = skill.createdById === user.id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('No tienes permiso para editar esta habilidad.');
    }

    const { createdBy, ...rest } = updateSkillDto;

    return this.prismaService.skills.update({
      where: { id },
      data: {
        ...rest,
        details: rest.details as Prisma.InputJsonValue,
      },
    });
  }

  async getSkillsByProjectId(projectId: string): Promise<SkillsModel[]> {
    try{
      const skills = await this.prismaService.skills.findMany({
        where: {
          projectSkills: {
            some: {
              projectId: projectId,
            }
          }
        },
      });
      return skills;
    }catch (error) {
      throw error;
    }
 }
}