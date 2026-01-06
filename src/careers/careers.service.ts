import { Injectable } from '@nestjs/common';
import { CreateCareerDto } from './dto/create-career.dto';
import { UpdateCareerDto } from './dto/update-career.dto';
import { BaseService } from 'src/prisma/base.service';
import { CareerModel } from 'src/prisma/generated/models';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CareersService extends BaseService<CareerModel, CreateCareerDto, UpdateCareerDto> {
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService, { name: 'career' });
  }
}
