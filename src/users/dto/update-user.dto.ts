import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  
  @ApiProperty({
    description: 'Ruta de la imagen de perfil del usuario',
    example: '/uploads/archivo.jpg',
    required: false
  })
  @IsOptional()
  @IsString()
  image?: string; // Este es el campo que guardará la ruta en la base de datos
}