import { PartialType } from '@nestjs/swagger';
import { CreateRolesPermissionDto } from './create-roles-permission.dto';

export class UpdateRolesPermissionDto extends PartialType(CreateRolesPermissionDto) {}
