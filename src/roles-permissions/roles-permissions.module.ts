import { Module } from '@nestjs/common';
import { RolesPermissionsService } from './roles-permissions.service';
import { RolesPermissionsController } from './roles-permissions.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [RolesPermissionsController],
  providers: [RolesPermissionsService],
  imports: [AuthModule, PrismaModule],
})
export class RolesPermissionsModule {}
