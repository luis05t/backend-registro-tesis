import { ValidationPipe, Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express"; // 1. Importante para archivos estáticos
import { join } from "path";

async function bootstrap() {
    // 2. Especificamos que es una aplicación de Express
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    const logger = new Logger('Bootstrap');

    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.setGlobalPrefix("api");

    // 3. CONFIGURACIÓN PARA SERVIR IMÁGENES
    // Esto hace que http://tu-url/uploads/foto.jpg funcione
    app.useStaticAssets(join(__dirname, '..', 'uploads'), {
        prefix: '/uploads/',
    });

    // 4. CORS DINÁMICO (Optimizado)
    app.enableCors({
        origin: (origin, callback) => {
            const allowedOrigins = [
                'http://localhost:5173',
                'http://localhost',
                /\.vercel\.app$/,      
                /\.devtunnels\.ms$/,   // Permite cualquier túnel de VS Code
            ];
            
            // Si no hay origin (como apps móviles o Postman) o está en la lista blanca
            if (!origin || allowedOrigins.some(pattern => 
                typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
            )) {
                callback(null, true);
            } else {
                logger.warn(`CORS bloqueado para el origen: ${origin}`);
                callback(new Error('CORS bloqueado'));
            }
        },
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Accept, Authorization',
    });

    const port = process.env.PORT ?? 8000;
    
    // 5. Escuchar en 0.0.0.0 es vital para Docker y Túneles
    await app.listen(port, "0.0.0.0");
    logger.log(`Backend iniciado en puerto ${port}`);
    logger.log(`Carpeta de archivos estáticos configurada en: ${join(__dirname, '..', 'uploads')}`);
}
bootstrap();