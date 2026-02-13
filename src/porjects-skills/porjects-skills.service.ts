import { Injectable, ConflictException } from '@nestjs/common';
import { CreatePorjectsSkillDto } from './dto/create-porjects-skill.dto';
import { UpdatePorjectsSkillDto } from './dto/update-porjects-skill.dto';
import { BaseService } from 'src/prisma/base.service';
import { projectSkillsModel } from 'src/prisma/generated/models';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PorjectsSkillsService extends BaseService<projectSkillsModel, CreatePorjectsSkillDto, UpdatePorjectsSkillDto> {  
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService, {name: 'projectSkills'});
  }

  async create(createDto: CreatePorjectsSkillDto) {
    const { projectId, skillId } = createDto;

    // 1. Buscamos si la relación ya existe antes de llamar a super.create
    // Esto evita que Prisma lance el error P2002 en los logs
    const existingRelation = await this.prismaService.projectSkills.findUnique({
      where: {
        projectId_skillId: {
          projectId,
          skillId,
        },
      },
    });

    // 2. Si ya existe, lanzamos la excepción manualmente
    if (existingRelation) {
      throw new ConflictException('Esta habilidad ya está asignada a este proyecto.');
    }

    // 3. Si no existe, procedemos con la creación normal
    try {
      return await super.create(createDto);
    } catch (error) {
      // Manejo de seguridad por si acaso ocurre otro error de concurrencia
      if (error.code === 'P2002') {
        throw new ConflictException('Esta habilidad ya está asignada a este proyecto.');
      }
      throw error;
    }
  }
}