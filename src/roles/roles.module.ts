import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [RolesController],
  providers: [RolesService],
  imports: [AuthModule, PrismaModule],
})
export class RolesModule {}
