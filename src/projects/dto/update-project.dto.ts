import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  
  // Agregamos explícitamente el campo de habilidades
  @IsArray({ message: 'Las habilidades deben ser un arreglo' })
  @IsString({ each: true, message: 'Cada habilidad debe ser un ID de texto' })
  @IsOptional()
  skills?: string[]; // Asegúrate de que el nombre coincida con lo que envías desde el Frontend
}