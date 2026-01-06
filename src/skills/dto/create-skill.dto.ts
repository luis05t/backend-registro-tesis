import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Prisma } from 'src/prisma/generated/client';

export class CreateSkillDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsOptional()
  // Quitamos @IsJSON() porque Prisma.JsonValue ya acepta objetos directamente
  details?: Prisma.JsonValue; 

  @IsOptional()
  @IsString()
  createdBy?: string;
}