import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ApiTags } from '@nestjs/swagger';
import { PaginationDto } from 'src/Libs/common';
import { Auth, GetUser } from 'src/auth/decorators';
import { UserModel as User } from 'src/prisma/generated/models/User';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // 1. Crear proyecto (Usa createWithUser del servicio)
  @Post()
  @Auth()
  create(
    @Body() createProjectDto: CreateProjectDto,
    @GetUser() user: User
  ) {
    return this.projectsService.createWithUser(createProjectDto, user);
  }

  // 2. Obtener todos (CORREGIDO: Usa @Query para aceptar ?limit=1000)
  @Get()
  findAll(@Query() paginationDto?: PaginationDto) {
    return this.projectsService.findAll(paginationDto);
  }

  // 3. Buscar por Skill (Funcionalidad extra que tenías)
  @Get('skill/:skillId')
  findBySkill(@Param('skillId') skillId: string) {
     return this.projectsService.findBySkill(skillId);
  }

  // 4. Obtener uno por ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  // 5. Actualizar (Usa updateWithPermission del servicio)
  @Patch(':id')
  @Auth()
  update(
    @Param('id') id: string, 
    @Body() updateProjectDto: UpdateProjectDto,
    @GetUser() user: User
  ) {
    return this.projectsService.updateWithPermission(id, updateProjectDto, user);
  }

  // 6. Eliminar
  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}