import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  UseGuards 
} from '@nestjs/common';
import { PeriodService } from './period.service';
import { CreatePeriodDto } from './create-period.dto';
import { AuthGuard } from '@nestjs/passport';
// Si tienes un guard de roles personalizado, impórtalo también
// import { UserRoleGuard } from 'src/auth/guards/user-role.guard';

@Controller('period')
export class PeriodController {
  constructor(private readonly periodService: PeriodService) {}

  @Post()
  @UseGuards(AuthGuard()) // Protege la creación
  create(@Body() createPeriodDto: CreatePeriodDto) {
    return this.periodService.create(createPeriodDto);
  }

  @Get()
  // @UseGuards(AuthGuard()) // Descomenta si quieres proteger el listado también
  findAll() {
    return this.periodService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.periodService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard()) // Protege la eliminación
  remove(@Param('id') id: string) {
    return this.periodService.remove(id);
  }
}