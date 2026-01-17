import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CareersService } from './careers.service';
import { CreateCareerDto } from './dto/create-career.dto';
import { UpdateCareerDto } from './dto/update-career.dto';
import { ApiTags } from '@nestjs/swagger';
import { PaginationDto } from 'src/Libs/common';
import { Auth } from 'src/auth/decorators';

@ApiTags('Careers')
@Controller('careers')
export class CareersController {
  constructor(private readonly careersService: CareersService) {}

  @Post()
  @Auth()
  create(@Body() createCareerDto: CreateCareerDto) {
    return this.careersService.create(createCareerDto);
  }

  // --- CORRECCIÓN: Usamos @Query para permitir ?limit=1000 ---
  @Get()
  findAll(@Query() paginationDto?: PaginationDto) {
    return this.careersService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.careersService.findOne(id);
  }

  @Patch(':id')
  @Auth()
  update(@Param('id') id: string, @Body() updateCareerDto: UpdateCareerDto) {
    return this.careersService.update(id, updateCareerDto);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string) {
    return this.careersService.remove(id);
  }
}