import { Injectable } from '@nestjs/common';
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

}
