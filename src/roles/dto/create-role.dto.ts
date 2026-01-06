import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CreateRoleDto {
    @ApiProperty()
    @IsString()
    name: string;
    
    @ApiProperty()
    @IsOptional()
    @IsString()
    description?: string;
}
