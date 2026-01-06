import { Module } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { SkillsController } from './skills.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [SkillsController],
  providers: [SkillsService],
  imports: [AuthModule, PrismaModule],
})
export class SkillsModule {}
