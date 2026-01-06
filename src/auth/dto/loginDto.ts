import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
	@ApiProperty({
		description: "The institutional email of the user",
		example: "john.doe@sudamericano.edu.ec",
	})
    // Validamos que sea un email real. Si falla -> "Correo incorrecto"
	@IsEmail({}, { message: 'Correo incorrecto' })
    // Validamos que no esté vacío. Si falla -> "El correo es obligatorio"
	@IsNotEmpty({ message: 'El correo es obligatorio' })
	email: string;

	@ApiProperty({
		description: "The password for the user account",
		example: "StrongP@ssw0rd",
		minLength: 8,
		maxLength: 20,
	})
    // CAMBIO IMPORTANTE: Quitamos @IsStrongPassword
    // Solo verificamos que sea texto y no esté vacío.
	@IsString({ message: 'Contraseña incorrecta' })
	@IsNotEmpty({ message: 'La contraseña es obligatoria' })
	password: string;
}