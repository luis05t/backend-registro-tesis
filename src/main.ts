import { ValidationPipe, Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    const logger = new Logger('Bootstrap');

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

    // Prefijo global: Todas las rutas empezarán por /api
    // Ejemplo: https://tu-backend.onrender.com/api/users
    app.setGlobalPrefix("api");

    // Configuración de Documentación (Swagger)
    const config = new DocumentBuilder()
        .setTitle("Registros API")
        .setDescription("Documentación de la API para el sistema de registros")
        .setVersion("1.0")
        .addTag("ITS")
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, document, {
        useGlobalPrefix: true,
    });

    // CONFIGURACIÓN CORS PARA PRODUCCIÓN
    // 'origin: true' refleja el origen de la petición, útil para que Vercel conecte sin problemas.
    app.enableCors({
        origin: true, 
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Accept, Authorization',
    });

    // Render asigna un puerto dinámico en process.env.PORT. 
    // Si no existe, usa el 8000 para local.
    const port = process.env.PORT ?? 8000;
    
    await app.listen(port, "0.0.0.0");
    logger.log(`App running on port ${port}`);
}

bootstrap().catch((err) => {
    console.error("Error during bootstrap:", err);
});