import { ValidationPipe, Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const logger = new Logger('Bootstrap');

    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.setGlobalPrefix("api");

   // backend-registro-tesis/src/main.ts
app.enableCors({
    origin: (origin, callback) => {
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost',
            /\.vercel\.app$/,      
            /\.devtunnels\.ms$/,   // Permite cualquier túnel de VS Code
        ];
        if (!origin || allowedOrigins.some(pattern => 
            typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
        )) {
            callback(null, true);
        } else {
            callback(new Error('CORS bloqueado'));
        }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
});

    const port = process.env.PORT ?? 8000;
    await app.listen(port, "0.0.0.0");
    logger.log(`Backend iniciado en puerto ${port}`);
}
bootstrap();