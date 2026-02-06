import { Module } from '@nestjs/common';
import { PeriodService } from './period.service';
import { PeriodController } from './period.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module'; // <--- IMPORTANTE

@Module({
  imports: [
    PrismaModule,
    AuthModule, // <--- OBLIGATORIO para que funcionen los Guards
  ],
  controllers: [PeriodController],
  providers: [PeriodService],
})
export class PeriodModule {}