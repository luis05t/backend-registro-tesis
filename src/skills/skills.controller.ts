import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { ApiTags } from '@nestjs/swagger';
import { PaginationDto } from 'src/Libs/common';
import { Auth, GetUser } from 'src/auth/decorators';
// CORRECCIÓN AQUÍ: Importamos UserModel y lo renombramos como User
import { UserModel as User } from 'src/prisma/generated/models/User';

@ApiTags('Skills')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Post()
  @Auth()
  create(
    @Body() createSkillDto: CreateSkillDto,
    @GetUser() user: User 
  ) {
    return this.skillsService.createWithUser(createSkillDto, user);
  }

  @Get()
  findAll(@Param() paginationDto?: PaginationDto) {
    return this.skillsService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.skillsService.findOne(id);
  }

  @Patch(':id')
  @Auth()
  update(
    @Param('id') id: string, 
    @Body() updateSkillDto: UpdateSkillDto,
    @GetUser() user: User
  ) {
    return this.skillsService.updateWithPermission(id, updateSkillDto, user);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string) {
    return this.skillsService.remove(id);
  }
}