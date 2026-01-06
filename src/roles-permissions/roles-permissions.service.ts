import { Injectable } from '@nestjs/common';
import { CreateRolesPermissionDto } from './dto/create-roles-permission.dto';
import { UpdateRolesPermissionDto } from './dto/update-roles-permission.dto';
import { BaseService } from 'src/prisma/base.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RolePermissionModel } from 'src/prisma/generated/models';

@Injectable()
export class RolesPermissionsService extends BaseService<RolePermissionModel, CreateRolesPermissionDto, UpdateRolesPermissionDto> {
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService, { name: 'rolesPermission' });
  }
}
