import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, IsStrongPassword, IsUUID } from "class-validator";

/**
 * Data Transfer Object para la creación de usuarios y docentes.
 * Define las reglas de validación para los datos recibidos desde el frontend.
 */
export class CreateUserDto {
    @ApiProperty({ description: 'Correo electrónico del usuario' })
    @IsEmail({}, { message: 'El correo electrónico no es válido' })
    email: string;

    @ApiProperty({ description: 'Contraseña segura del usuario' })
    @IsStrongPassword(
        { minLength: 6 }, 
        { message: 'La contraseña no es lo suficientemente fuerte (mínimo 6 caracteres, letras y números)' }
    )
    password: string;

    @ApiProperty({ description: 'Nombre completo del usuario' })
    @IsString({ message: 'El nombre debe ser una cadena de texto' })
    name: string;

    @ApiProperty({ description: 'UUID del rol asignado (Opcional para registro público)' })
    @IsUUID('all', { message: 'El roleId debe ser un UUID válido' })
    @IsOptional() // <--- AGREGADO: Esto permite que el registro público funcione sin enviar roleId
    roleId?: string;

    @ApiProperty({ description: 'UUID de la carrera asignada' })
    @IsUUID('all', { message: 'El careerId debe ser un UUID válido' })
    careerId: string;
}