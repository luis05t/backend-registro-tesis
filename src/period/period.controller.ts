import { Controller, Get, Post, Body } from '@nestjs/common';
import { PeriodService } from './period.service';
import { CreatePeriodDto } from './create-period.dto'; 
import { Auth } from '../auth/decorators'; // Importación correcta de TU proyecto
import { ValidRoles } from '../auth/enums/valid-roles.enum'; // Importación correcta de TU proyecto
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Periods')
@Controller('period')
export class PeriodController {
  constructor(private readonly periodService: PeriodService) {}

  @Post()
  // Usamos tu decorador @Auth pasando el rol del enum (asegúrate que sea 'admin' o 'ADMIN' según tu enum)
  // Si tu enum es ValidRoles.ADMIN, cámbialo aquí. Asumo ValidRoles.admin por convención.
  @Auth(ValidRoles.ADMIN) 
  create(@Body() createPeriodDto: CreatePeriodDto) {
    return this.periodService.create(createPeriodDto);
  }

  @Get()
  @Auth() // Protegido para cualquier usuario logueado
  findAll() {
    return this.periodService.findAll();
  }
}