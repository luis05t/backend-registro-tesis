import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { PrismaModule } from "src/prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UserRoleGuard } from "./guards/user-role.guard";
import { JwtStrategy } from "./strategy/jwt.strategy";

@Module({
	controllers: [AuthController],
	providers: [AuthService, JwtStrategy, UserRoleGuard],
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ".env",
		}),
		PrismaModule,
		PassportModule.register({ defaultStrategy: "jwt" }),
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				return {
					secret: configService.get("JWT_SECRET"),
					signOptions: {
						expiresIn: "2d",
					},
				};
			},
		}),
	],
	exports: [JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}
