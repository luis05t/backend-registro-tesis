import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePeriodDto } from './create-period.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PeriodService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPeriodDto: CreatePeriodDto) {
    return this.prisma.period.create({
      data: createPeriodDto,
    });
  }

  async findAll() {
    return this.prisma.period.findMany({
      orderBy: {
        createdAt: 'desc', // Ordenar por fecha de creación (opcional)
      },
    });
  }

  async findOne(id: string) {
    const period = await this.prisma.period.findUnique({
      where: { id },
    });
    if (!period) throw new NotFoundException(`Period with ID ${id} not found`);
    return period;
  }

  async remove(id: string) {
    // Primero verificamos que exista para lanzar error 404 si no
    await this.findOne(id);

    return this.prisma.period.delete({
      where: { id },
    });
  }
}