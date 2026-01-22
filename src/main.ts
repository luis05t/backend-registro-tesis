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

    // --- CORRECCIÓN: Se eliminó app.useStaticAssets porque ya lo maneja AppModule ---

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

    // CONFIGURACIÓN CORS
    app.enableCors({
        origin: true,
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    });

    await app.listen(process.env.PORT ?? 8000, "0.0.0.0").catch((err) => {
        console.error(err);
    });
}
bootstrap().catch((err) => {
    console.error("Error during bootstrap:", err);
});