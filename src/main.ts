import dns from 'node:dns'; 
// Forzar a Node.js a usar IPv4 primero para evitar errores de red en Render
dns.setDefaultResultOrder('ipv4first'); 

import { ValidationPipe, Logger } from "@nestjs/common"; 
import { NestFactory } from "@nestjs/core"; 
import { AppModule } from "./app.module"; 
import { NestExpressApplication } from "@nestjs/platform-express"; 
import { join } from "path"; 

async function bootstrap() {
    // 1. Mantenemos tu configuración de NestExpressApplication
    const app = await NestFactory.create<NestExpressApplication>(AppModule); 
    const logger = new Logger('Bootstrap'); 

    // 2. Mantenemos tu configuración global de validación
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true })); 
    app.setGlobalPrefix("api"); 

    // 3. Mantenemos tu configuración de archivos estáticos para las imágenes
    app.useStaticAssets(join(__dirname, '..', 'uploads'), {
        prefix: '/uploads/',
    }); 

    // 4. Mantenemos tu lógica de CORS íntegra (con regex y lista blanca)
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
    }); 

    // 5. Mantenemos la detección dinámica del puerto para Render
    const port = process.env.PORT ?? 8000; 
    
    // 6. SOLUCIÓN AL TIMEOUT: Escuchar en 0.0.0.0 es OBLIGATORIO en Docker/Render
    // Esto permite que el tráfico externo llegue al contenedor.
    await app.listen(port, "0.0.0.0"); 

    logger.log(`Backend iniciado en puerto ${port}`); 
    logger.log(`Carpeta de archivos estáticos configurada en: ${join(__dirname, '..', 'uploads')}`); 
}
bootstrap();