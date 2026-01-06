import { PartialType } from '@nestjs/swagger';
import { CreateUsersProjectDto } from './create-users-project.dto';

export class UpdateUsersProjectDto extends PartialType(CreateUsersProjectDto) {}
