FROM node:lts-alpine AS builder

# Instalar pnpm globalmente
RUN npm -g install pnpm

WORKDIR /app
RUN chown -R node:node /app
USER node

# 1. Copiamos archivos de dependencias
COPY --chown=node:node package.json pnpm-lock.yaml ./

# 2. Instalamos dependencias (ignorando bloqueo para evitar errores)
RUN pnpm install --no-frozen-lockfile

# 3. TRUCO: Instalamos AQUÍ las librerías que faltan en tu package.json original
# Esto evita que tengas que editar tu archivo package.json manualmemte
RUN pnpm add @nestjs/serve-static @prisma/config

# 4. Copiamos SOLO tus carpetas de código (evita copiar node_modules de Windows)
COPY --chown=node:node tsconfig*.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node src ./src
COPY --chown=node:node prisma.config.ts ./

# 5. Generamos el cliente de Prisma (con base de datos dummy para que no falle)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# 6. Construimos la aplicación
RUN pnpm run build

# --- Etapa de Producción ---
FROM node:lts-alpine AS production

RUN apk add --no-cache tzdata dumb-init openssl && rm -rf /var/cache/apk/*
ENV TZ=America/Guayaquil

RUN npm -g install pnpm
WORKDIR /app

# Creamos carpeta de uploads
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads && chown -R node:node /app

USER node

# Copiamos lo construido desde la etapa anterior
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/pnpm-lock.yaml ./
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts

# Instalación final auto-reparadora:
# Instala todo, agrega parches, genera cliente y limpia
RUN pnpm install --no-frozen-lockfile && \
    pnpm add @nestjs/serve-static @prisma/config && \
    DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm prisma generate && \
    pnpm prune --prod && \
    pnpm store prune

ENV NODE_ENV=production
EXPOSE 8000
ENTRYPOINT ["dumb-init", "--"]

# Comando de inicio (migra y arranca)
CMD ["/bin/sh", "-c", "npx prisma migrate deploy && pnpm run start:prod"]