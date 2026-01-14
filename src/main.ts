import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);

	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
			forbidNonWhitelisted: true,
			transformOptions: {
				enableImplicitConversion: true,
			},
		}),
	);

    // Servir archivos estáticos (imágenes)
    app.useStaticAssets(join(process.cwd(), 'uploads'), {
        prefix: '/uploads/',
    });

	app.setGlobalPrefix("api");

	const config = new DocumentBuilder()
		.setTitle("Registros API")
		.setDescription("API documentation for Registros application")
		.setVersion("0.1")
		.addTag("ITS")
		.addBearerAuth()
		.build();

	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup("docs", app, document, {
		useGlobalPrefix: true,
	});

    // CONFIGURACIÓN CORS PARA TÚNELES
	app.enableCors({
		origin: true, // Permite cualquier origen (necesario para el túnel dinámico)
		credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
	});

    // Escuchar en 0.0.0.0 es vital para que VS Code reenvíe el puerto
	await app.listen(process.env.PORT ?? 8000, "0.0.0.0").catch((err) => {
		console.error(err);
	});
}
bootstrap().catch((err) => {
	console.error("Error during bootstrap:", err);
});