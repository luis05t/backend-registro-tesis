import {
	BadRequestException,
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import { META_ROLES } from "../decorators/role-protected.decorator";
import { ValidRoles } from "../enums/valid-roles.enum";

@Injectable()
export class UserRoleGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		let req: any;

		// Detectar si es GraphQL o HTTP
		if (context.getType<any>() === "graphql") {
			const gqlContext = GqlExecutionContext.create(context);
			req = gqlContext.getContext().req;
		} else {
			req = context.switchToHttp().getRequest();
		}

		const user = req?.user;
		if (!user) throw new BadRequestException("User not found");

		const validRoles: ValidRoles[] = this.reflector.get<ValidRoles[]>(
			META_ROLES,
			context.getHandler(),
		);

		// Si no hay roles definidos, permitir acceso
		if (!validRoles || validRoles.length === 0) return true;

		// Verificar si el usuario tiene el role
		if (!user.role) {
			throw new BadRequestException("User does not have a role assigned");
		}

		// Verificar si el nombre del role del usuario está en los roles válidos
		const hasRole = validRoles.includes(user.role.name as ValidRoles);

		if (!hasRole) {
			throw new ForbiddenException(
				`User with role '${user.role.name}' does not have permission. Required roles: ${validRoles.join(", ")}`,
			);
		}

		return true;
	}
}
