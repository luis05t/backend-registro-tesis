import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { CreateUserDto } from "src/users/dto/create-user.dto";
import { AuthService } from "./auth.service";
import { Auth } from "./decorators";
import { LoginDto } from "./dto/loginDto";
import { RefreshDto } from "./dto/refreshDto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
	constructor(private authService: AuthService) {}

	@HttpCode(HttpStatus.OK)
	@Post("login")
	async login(@Body() loginDto: LoginDto) {
		return this.authService.login(loginDto);
	}

	@Auth()
	@Post("register")
	async register(@Body() CreateUserDto: CreateUserDto) {
		return this.authService.register(CreateUserDto);
	}

	@Auth()
	@ApiSecurity("bearer", [])
	@Post("register-admin")
	async registeradmin(@Body() createUserDto: CreateUserDto) {
		return this.authService.registerAdmin(createUserDto);
	}

	@HttpCode(HttpStatus.OK)
	@Post("refresh-token")
	async refreshToken(@Body() refreshDto: RefreshDto) {
		return this.authService.refreshToken(refreshDto);
	}
}
