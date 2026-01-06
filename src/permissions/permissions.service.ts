import { Injectable } from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { BaseService } from 'src/prisma/base.service';
import { PermissionModel } from 'src/prisma/generated/models';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PermissionsService extends BaseService<PermissionModel, CreatePermissionDto, UpdatePermissionDto> {
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService, { name: 'permission' });
  }
}
