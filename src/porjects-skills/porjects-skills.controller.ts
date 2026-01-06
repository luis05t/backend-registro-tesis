import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PorjectsSkillsService } from './porjects-skills.service';
import { CreatePorjectsSkillDto } from './dto/create-porjects-skill.dto';
import { UpdatePorjectsSkillDto } from './dto/update-porjects-skill.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('porjects-skills')
@Controller('porjects-skills')
export class PorjectsSkillsController {
  constructor(private readonly porjectsSkillsService: PorjectsSkillsService) {}

  @Post()
  create(@Body() createPorjectsSkillDto: CreatePorjectsSkillDto) {
    return this.porjectsSkillsService.create(createPorjectsSkillDto);
  }

  @Get()
  findAll() {
    return this.porjectsSkillsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.porjectsSkillsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePorjectsSkillDto: UpdatePorjectsSkillDto) {
    return this.porjectsSkillsService.update(id, updatePorjectsSkillDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.porjectsSkillsService.remove(id);
  }
}
