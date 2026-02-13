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
    try {
      return await super.create(createDto);
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Esta habilidad ya está asignada a este proyecto.');
      }
      
      throw error;
    }
  }
}