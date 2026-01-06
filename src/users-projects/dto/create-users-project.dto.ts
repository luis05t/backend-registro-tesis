import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class CreateUsersProjectDto {
    @ApiProperty()
    @IsUUID()
    userId: string;

    @ApiProperty()
    @IsUUID()
    projectId: string;
}
