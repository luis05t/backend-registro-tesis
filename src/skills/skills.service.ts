import { 
  Injectable, 
  ForbiddenException, 
  NotFoundException, 
  ConflictException, 
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

  async updateWithPermission(id: string, updateSkillDto: UpdateSkillDto, user: User) {
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

  // --- NUEVO: Sobrescribimos el método remove para limpiar relaciones ---
  async remove(id: string): Promise<SkillsModel> {
    try {
      // 1. Primero eliminamos las referencias en la tabla intermedia (projectSkills)
      await this.prismaService.projectSkills.deleteMany({
        where: { skillId: id }
      });

      // 2. Luego llamamos al método remove original del BaseService para borrar la Skill
      return super.remove(id);
    } catch (error) {
      // Si ocurre algo inesperado, relanzamos el error
      throw error;
    }
  }
}