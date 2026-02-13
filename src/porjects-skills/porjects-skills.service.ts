import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { BaseService } from '../prisma/base.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePorjectsSkillDto } from './dto/create-porjects-skill.dto';
import { UpdatePorjectsSkillDto } from './dto/update-porjects-skill.dto';

@Injectable()
export class PorjectsSkillsService extends BaseService<any, CreatePorjectsSkillDto, UpdatePorjectsSkillDto> {
  
  constructor(protected readonly prisma: PrismaService) {
    super(prisma, { name: 'projectSkills' }); 
  }

  async create(createPorjectsSkillDto: CreatePorjectsSkillDto) {
    try {
      return await super.create(createPorjectsSkillDto);
    } catch (error) {
      if (error.code === 'P2002') {
        // ESTA ES LA CLAVE: Lanzar BadRequestException en lugar de dejar que explote
        throw new BadRequestException('Esta habilidad ya está asignada a este proyecto.');
      }
      
      console.error(error);
      throw new InternalServerErrorException('Error al asignar la habilidad');
    }
  }
}