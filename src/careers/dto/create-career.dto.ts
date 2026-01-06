import { ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class CreateCareerDto {
    @ApiProperty()
    @IsString()
    @MaxLength(150)
    name: string;
}
