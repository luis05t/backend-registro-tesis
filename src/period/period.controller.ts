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

@Controller('period')
export class PeriodController {
  constructor(private readonly periodService: PeriodService) {}

  @Post()
  @UseGuards(AuthGuard()) 
  create(@Body() createPeriodDto: CreatePeriodDto) {
    return this.periodService.create(createPeriodDto);
  }

  @Get()
  findAll() {
    return this.periodService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.periodService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard()) 
  remove(@Param('id') id: string) {
    return this.periodService.remove(id);
  }
}