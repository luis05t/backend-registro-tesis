import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UsersProjectsService } from './users-projects.service';
import { CreateUsersProjectDto } from './dto/create-users-project.dto';
import { UpdateUsersProjectDto } from './dto/update-users-project.dto';
import { PaginationDto } from 'src/Libs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Users-Projects')
@Controller('users-projects')
export class UsersProjectsController {
  constructor(private readonly usersProjectsService: UsersProjectsService) {}

  @Post()
  create(@Body() createUsersProjectDto: CreateUsersProjectDto) {
    return this.usersProjectsService.create(createUsersProjectDto);
  }

  @Get()
  findAll(@Param() paginationDto?: PaginationDto) {
    return this.usersProjectsService.findAll(paginationDto);
  }

  @Get('user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.usersProjectsService.findByUserId(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersProjectsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUsersProjectDto: UpdateUsersProjectDto) {
    return this.usersProjectsService.update(id, updateUsersProjectDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersProjectsService.remove(id);
  }
}
