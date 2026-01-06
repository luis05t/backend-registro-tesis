import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesPermissionsModule } from './roles-permissions/roles-permissions.module';
import { CareersModule } from './careers/careers.module';
import { ProjectsModule } from './projects/projects.module';
import { UsersProjectsModule } from './users-projects/users-projects.module';
import { SkillsModule } from './skills/skills.module';
import { PorjectsSkillsModule } from './porjects-skills/porjects-skills.module';

@Module({
  imports: [UsersModule, AuthModule, RolesModule, PermissionsModule, RolesPermissionsModule, CareersModule, ProjectsModule, UsersProjectsModule, SkillsModule, PorjectsSkillsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
