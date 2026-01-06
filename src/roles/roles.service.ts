import { Injectable } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { BaseService } from 'src/prisma/base.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RoleModel } from 'src/prisma/generated/models';

@Injectable()
export class RolesService extends BaseService<RoleModel, CreateRoleDto, UpdateRoleDto> {
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService, { name: 'role'  });
  }
}
