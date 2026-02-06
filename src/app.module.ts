import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { CareersModule } from './careers/careers.module';
import { RolesModule } from './roles/roles.module';
import { ProjectsModule } from './projects/projects.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesPermissionsModule } from './roles-permissions/roles-permissions.module';
import { SkillsModule } from './skills/skills.module';
import { UsersProjectsModule } from './users-projects/users-projects.module';
import { PeriodModule } from './period/period.module'; // <--- 1. NUEVA IMPORTACIÓN
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // --- CORRECCIÓN AQUÍ: Usamos process.cwd() para la ruta correcta ---
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    PrismaModule,
    CareersModule,
    RolesModule,
    ProjectsModule,
    PermissionsModule,
    RolesPermissionsModule,
    SkillsModule,
    UsersProjectsModule,
    PeriodModule, // <--- 2. AGREGADO AL ARRAY DE IMPORTS
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}