import { Module } from '@nestjs/common';
import { CareersService } from './careers.service';
import { CareersController } from './careers.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [CareersController],
  providers: [CareersService],
  imports: [AuthModule, PrismaModule],
})
export class CareersModule {}
