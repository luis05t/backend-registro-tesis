import { Module } from '@nestjs/common';
import { PorjectsSkillsService } from './porjects-skills.service';
import { PorjectsSkillsController } from './porjects-skills.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [PorjectsSkillsController],
  providers: [PorjectsSkillsService],
  imports: [AuthModule, PrismaModule],
})
export class PorjectsSkillsModule {}
