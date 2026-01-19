import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static'; // <--- IMPORTANTE
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
import { AppController } from './app.controller'; 
import { AppService } from './app.service';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'), 
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}