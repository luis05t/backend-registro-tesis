import { Body, Controller, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
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

    /**
     * Inicio de sesión para todos los usuarios.
     * Devuelve los tokens de acceso y refresco.
     */
    @HttpCode(HttpStatus.OK)
    @Post("login")
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    /**
     * REGISTRO PÚBLICO:
     * Se eliminó el decorador @Auth() para permitir que nuevos usuarios (Lectores)
     * puedan crear su cuenta sin estar logueados.
     */
    @Post("register")
    async register(@Body() createUserDto: CreateUserDto) {
        return this.authService.register(createUserDto);
    }

    /**
     * REGISTRO DE ADMINISTRADOR / ESPECIAL:
     * Este endpoint sí permanece protegido porque se usa para crear usuarios
     * con roles específicos desde una cuenta con permisos.
     */
    @Auth()
    @ApiSecurity("bearer", [])
    @Post("register-admin")
    async registeradmin(@Body() createUserDto: CreateUserDto) {
        return this.authService.registerAdmin(createUserDto);
    }

    /**
     * Renovación de tokens.
     */
    @HttpCode(HttpStatus.OK)
    @Post("refresh-token")
    async refreshToken(@Body() refreshDto: RefreshDto) {
        return this.authService.refreshToken(refreshDto);
    }

    // --- NUEVOS ENDPOINTS DE RECUPERACIÓN DE CONTRASEÑA ---

    /**
     * Solicitar correo de recuperación.
     */
    @Post("forgot-password")
    async forgotPassword(@Body("email") email: string) {
        return this.authService.forgotPassword(email);
    }

    /**
     * Restablecer contraseña usando el token.
     */
    @Post("reset-password/:token")
    async resetPassword(
        @Param("token") token: string,
        @Body("password") password: string
    ) {
        return this.authService.resetPassword(token, password);
    }
}