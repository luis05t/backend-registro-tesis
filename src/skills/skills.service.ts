import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    // 1. Extraemos 'createdBy' para que NO se envíe a Prisma dentro de 'data'
    //    ya que choca con la definición de la relación.
    const { createdBy, ...rest } = createSkillDto;

    return this.prismaService.skills.create({
      data: {
        ...rest,
        // Casteamos el JSON para evitar error de tipos
        details: rest.details as Prisma.InputJsonValue,
        // Asignamos manualmente el ID del usuario creador
        createdById: user.id,
      },
    });
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

    // 2. Extraemos 'createdBy' también aquí
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