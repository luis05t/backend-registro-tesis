// ⬇️ DEBE SER LO PRIMERO - Fuerza IPv4 para evitar errores ENETUNREACH en Render
import dns from 'node:dns'; 
dns.setDefaultResultOrder('ipv4first');

import { ValidationPipe, Logger } from "@nestjs/common"; 
import { NestFactory } from "@nestjs/core"; 
import { AppModule } from "./app.module"; 
import { NestExpressApplication } from "@nestjs/platform-express"; 
import { join } from "path"; 

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule); 
    const logger = new Logger('Bootstrap'); 

    // Configuración global de validación
    app.useGlobalPipes(
      new ValidationPipe({ 
        transform: true, 
        whitelist: true 
      })
    ); 
    
    app.setGlobalPrefix("api"); 

    // Configuración de archivos estáticos para imágenes
    app.useStaticAssets(join(__dirname, '..', 'uploads'), {
        prefix: '/uploads/',
    }); 

    // Configuración de CORS con whitelist y regex
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
                logger.warn(`🚫 CORS bloqueado para el origen: ${origin}`);
                callback(new Error('CORS bloqueado'));
            }
        },
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Accept, Authorization',
    }); 

    // Detección dinámica del puerto para Render/Railway/etc
    const port = process.env.PORT ?? 8000; 
    
    // ✅ CRÍTICO: Escuchar en 0.0.0.0 es obligatorio en Docker/Render
    // Esto permite que el tráfico externo llegue al contenedor
    await app.listen(port, "0.0.0.0"); 

    logger.log(`🚀 Backend iniciado en puerto ${port}`); 
    logger.log(`📁 Carpeta de archivos estáticos: ${join(__dirname, '..', 'uploads')}`); 
}

bootstrap();