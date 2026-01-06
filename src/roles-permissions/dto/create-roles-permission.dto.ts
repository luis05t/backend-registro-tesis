import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class CreateRolesPermissionDto {
    @ApiProperty()
    @IsUUID()
    roleId: string;

    @ApiProperty()
    @IsUUID()
    permissionId: string;
}
