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