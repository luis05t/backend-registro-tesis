import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class CreatePorjectsSkillDto {
    @ApiProperty()
    @IsUUID()
    projectId: string;

    @ApiProperty()
    @IsUUID()
    skillId: string;
}
