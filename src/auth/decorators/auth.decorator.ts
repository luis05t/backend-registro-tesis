import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ValidRoles } from "../enums/valid-roles.enum";
import { UserRoleGuard } from "../guards/user-role.guard";
import { RoleProtected } from "./role-protected.decorator";

export function Auth(...roles: ValidRoles[]) {
	return applyDecorators(
		RoleProtected(...roles),
		UseGuards(AuthGuard(), UserRoleGuard),
	);
}
