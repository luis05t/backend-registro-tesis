import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty() 
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty() 
  description: string;

  @ApiProperty({ required: false, default: 'in-progress' })
  @IsOptional() 
  @IsString()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional() 
  @IsString()
  problems?: string;
  
  @ApiProperty({ required: false })
  @IsOptional() 
  @IsString()
  summary?: string;

  @ApiProperty({ required: false })
  @IsOptional() 
  @IsString({ each: true })
  objectives?: string[];

  @ApiProperty({ required: false })
  @IsOptional() 
  @IsString()
  cycle?: string;
  
  @ApiProperty({ required: false })
  @IsOptional() 
  @IsString()
  academic_period?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverables?: string[];

  @ApiProperty({ required: false })
  @IsOptional() 
  @IsDateString() 
  startDate?: string; 

  @ApiProperty({ required: false })
  @IsOptional() 
  @IsDateString() 
  endDate?: string; 

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty() 
  careerId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}