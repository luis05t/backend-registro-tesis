import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "src/prisma/generated/client";

@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	constructor() {
		const connectionString = process.env.DATABASE_URL;
		if (!connectionString) {
			throw new Error("DATABASE_URL no está definida");
		}

		// Configuración avanzada del Pool de conexiones para evitar Timeouts
		const pool = new Pool({ 
			connectionString,
			connectionTimeoutMillis: 10000, // 10 segundos para conectar
			idleTimeoutMillis: 30000,       // 30 segundos antes de cerrar conexión inactiva
            max: 20                         // Máximo de conexiones simultáneas
		});

		const adapter = new PrismaPg(pool);

		super({ 
            adapter,
            // Aumentar logs para ver qué pasa si falla
            log: ['error', 'warn'] 
        });
	}

	async onModuleInit() {
        // Intento de conexión con reintento simple
		try {
            await this.$connect();
		    console.log("📦 Prisma conectado a la base de datos (PostgreSQL con Pool Optimizado)");
        } catch (error) {
            console.error("Error inicial conectando a Prisma:", error);
        }
	}

	async onModuleDestroy() {
		await this.$disconnect();
		console.log("🔌 Prisma desconectado");
	}
}