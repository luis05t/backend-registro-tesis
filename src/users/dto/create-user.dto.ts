import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsStrongPassword, IsUUID } from "class-validator";

export class CreateUserDto {
    @ApiProperty()
    @IsEmail()
    email: string;

    @ApiProperty()
    @IsStrongPassword({ }, {message: 'Password is not strong enough'})
    password: string;

    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty()
    @IsUUID()
    roleId: string;

    @ApiProperty()
    @IsUUID()
    careerId: string;
}
