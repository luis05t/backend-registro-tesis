import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ApiTags } from '@nestjs/swagger';
import { PaginationDto } from 'src/Libs/common';
import { Auth, GetUser } from 'src/auth/decorators';
import { UserModel as User } from 'src/prisma/generated/models/User';
import { ValidRoles } from 'src/auth/enums/valid-roles.enum'; // <--- IMPORTANTE: Importar roles

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Auth()
  create(
    @Body() createProjectDto: CreateProjectDto,
    @GetUser() user: User
  ) {
    return this.projectsService.createWithUser(createProjectDto, user);
  }

  @Get()
  @Auth()
  findAll(
    @Query() paginationDto: PaginationDto,
    @GetUser() user: User
  ) {
    return this.projectsService.findAll(paginationDto, user);
  }

  // =================================================================
  // ENDPOINTS DE PERIODOS (Agregados aquí para evitar conflicto de rutas)
  // =================================================================

  // 1. Crear Periodo (SOLO ADMIN) -> POST /api/projects/periods
  @Post('periods')
  @Auth(ValidRoles.ADMIN)
  createPeriod(@Body('name') name: string) {
    return this.projectsService.createPeriod(name);
  }

  // 2. Listar Periodos (PÚBLICO) -> GET /api/projects/periods
  @Get('periods')
  findAllPeriods() {
    return this.projectsService.getPeriods();
  }

  // 3. Eliminar Periodo (SOLO ADMIN) -> DELETE /api/projects/periods/:id
  @Delete('periods/:id')
  @Auth(ValidRoles.ADMIN)
  deletePeriod(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.deletePeriod(id);
  }
  // =================================================================

  @Get('skill/:skillId')
  findBySkill(@Param('skillId') skillId: string) {
     return this.projectsService.findBySkill(skillId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @Auth()
  update(
    @Param('id') id: string, 
    @Body() updateProjectDto: UpdateProjectDto,
    @GetUser() user: User
  ) {
    return this.projectsService.updateWithPermission(id, updateProjectDto, user);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}