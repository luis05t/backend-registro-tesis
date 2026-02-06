import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; 
import { CreatePeriodDto } from './create-period.dto'; // Esto funcionará en cuanto crees el archivo del paso 1

@Injectable()
export class PeriodService {
  constructor(private prisma: PrismaService) {}

  async create(createPeriodDto: CreatePeriodDto) {
    const existing = await this.prisma.period.findUnique({
      where: { name: createPeriodDto.name },
    });

    if (existing) {
      throw new ConflictException('El periodo ya existe');
    }

    return this.prisma.period.create({
      data: createPeriodDto,
    });
  }

  async findAll() {
    return this.prisma.period.findMany({
       orderBy: { name: 'desc' }
    });
  }
}