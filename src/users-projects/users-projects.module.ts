import { Module } from '@nestjs/common';
import { UsersProjectsService } from './users-projects.service';
import { UsersProjectsController } from './users-projects.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [UsersProjectsController],
  providers: [UsersProjectsService],
  imports: [AuthModule, PrismaModule],
})
export class UsersProjectsModule {}
