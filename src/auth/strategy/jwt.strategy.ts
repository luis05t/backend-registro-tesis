import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UserModel } from "src/prisma/generated/models";
import { PrismaService } from "src/prisma/prisma.service";
import { JwtPayload } from "../interfaces/jwt-payload.interface";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		private prisma: PrismaService,
		configService: ConfigService,
	) {
		super({
			secretOrKey: configService.get("JWT_SECRET"),
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
		});
	}

	async validate(payload: JwtPayload): Promise<UserModel> {
		const { id } = payload;

		const user = await this.prisma.user.findUnique({
			where: { id: id },
			include: {
				role: true,
				career: true,
			},
		});

		if (!user) throw new UnauthorizedException("Token not valid");

		return user;
	}
}
