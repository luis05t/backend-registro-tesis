import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { BaseService } from 'src/prisma/base.service';
import { ProjectModel } from 'src/prisma/generated/models';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginatedResult, PaginationDto } from 'src/Libs/common';

@Injectable()
export class ProjectsService extends BaseService<ProjectModel, CreateProjectDto, UpdateProjectDto> {
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService, { name: 'project' });
  }

  /**
   * Sobrescribe findAll para incluir información del usuario creador
   */
  async findAll(paginationDto?: PaginationDto): Promise<PaginatedResult<ProjectModel>> {
    return this.findManyPaginated(
      {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      paginationDto,
    );
  }

  /**
   * Sobrescribe findOne para incluir información del usuario creador
   */
  async findOne(id: string): Promise<ProjectModel | null> {
    try {
      const result = await this.prismaService.project.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          career: true,
          projectSkills: {
            include: {
              skill: true,
            },
          },
          userProjects: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
      if (!result) {
        throw new Error(`Project with id ${id} not found`);
      }
      return result;
    } catch (error) {
      throw error;
    }
  }

  async findProjectsBySkillId(skillId: string) {
    try {
      const projects = await this.prismaService.project.findMany({
        where: {
          projectSkills: {
            some: {
              skillId: skillId,
            },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return projects;
    } catch (error) {
      throw error;
    }
  }
}