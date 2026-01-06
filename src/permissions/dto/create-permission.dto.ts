import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CreatePermissionDto {
    @ApiProperty()
    @IsString()
    name: string;
    
    @ApiProperty()
    @IsOptional()
    @IsString()
    description?: string;
}
