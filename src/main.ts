import dns from 'node:dns'; //
// Forzar a Node.js a usar IPv4 primero al inicio absoluto del archivo para evitar errores de red en Render
dns.setDefaultResultOrder('ipv4first'); //

import { ValidationPipe, Logger } from "@nestjs/common"; //
import { NestFactory } from "@nestjs/core"; //
import { AppModule } from "./app.module"; //
import { NestExpressApplication } from "@nestjs/platform-express"; //
import { join } from "path"; //

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule); //
    const logger = new Logger('Bootstrap'); //

    // Configuración global de validación
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true })); //
    app.setGlobalPrefix("api"); //

    // Configuración de archivos estáticos para las imágenes
    app.useStaticAssets(join(__dirname, '..', 'uploads'), {
        prefix: '/uploads/',
    }); //

    // Configuración de CORS optimizada para Vercel y Render
    app.enableCors({
        origin: (origin, callback) => {
            const allowedOrigins = [
                'http://localhost:5173',
                'http://localhost',
                /\.vercel\.app$/,      
                /\.devtunnels\.ms$/,  
                /\.onrender\.com$/, 
            ];
            
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
    }); //

    const port = process.env.PORT ?? 8000; //
    
    // Escuchar en 0.0.0.0 es necesario para que Render pueda acceder al contenedor
    await app.listen(port, "0.0.0.0"); //
    logger.log(`Backend iniciado en puerto ${port}`); //
    logger.log(`Carpeta de archivos estáticos configurada en: ${join(__dirname, '..', 'uploads')}`); //
}
bootstrap();