import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { BaseService } from 'src/prisma/base.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectModel } from 'src/prisma/generated/models'; 
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModel as User } from 'src/prisma/generated/models/User';
import { PaginationDto } from 'src/Libs/common';

@Injectable()
export class ProjectsService extends BaseService<ProjectModel, CreateProjectDto, UpdateProjectDto> {
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService, { name: 'project' }); 
  }

  async findAll(paginationDto?: PaginationDto, user?: User) {
    const { limit = 10, page = 1, order = 'desc' } = paginationDto || {};
    const skip = (page - 1) * limit;
    
    let whereCondition: any = {};

    if (user) {
      const userWithRole = await this.prismaService.user.findUnique({
        where: { id: user.id },
        include: { role: true },
      });

      const roleName = userWithRole?.role?.name?.toLowerCase() || '';
      const isAdmin = roleName.includes('admin');

      if (!isAdmin) {
        whereCondition = {
          OR: [
            { status: { not: 'pendiente' } }, 
            { createdBy: user.id }            
          ]
        };
      }
    }

    const total = await this.prismaService.project.count({
      where: whereCondition
    });
    
    const data = await this.prismaService.project.findMany({
      skip: skip,
      take: limit,
      where: whereCondition, 
      include: {
        user: true, 
        projectSkills: true, 
        career: true, 
      },
      orderBy: { createdAt: order }
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        pagination: {
          page,
          limit,
          order: order as "asc" | "desc"
        },
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    };
  }

  async findOne(id: string) {
    const project = await this.prismaService.project.findUnique({
      where: { id },
      include: {
        user: true,
        projectSkills: true,
        career: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }
    return project;
  }

  async createWithUser(createProjectDto: CreateProjectDto, user: User) {
    const { startDate, endDate, ...rest } = createProjectDto;

    return this.prismaService.project.create({
      data: {
        ...rest,
        status: 'pendiente', 
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        createdBy: user.id,
        userProjects: {
          create: {
            userId: user.id
          }
        }
      },
      include: {
        user: true,
        projectSkills: true,
        career: true, 
      }
    });
  }

  async findBySkill(skillId: string) {
    return this.prismaService.project.findMany({
      where: {
        projectSkills: {
          some: {
            skillId: skillId,
          },
        },
      },
      include: {
        user: true,
        projectSkills: true,
        career: true,
      },
    });
  }

  async updateWithPermission(id: string, updateProjectDto: UpdateProjectDto, user: User) {
    const project = await this.prismaService.project.findUnique({ where: { id } });

    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }

    const userWithRole = await this.prismaService.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });

    const roleName = userWithRole?.role?.name?.toLowerCase() || '';
    const isAdmin = roleName.includes('admin');
    const isOwner = project.createdBy === user.id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('No tienes permiso para editar este proyecto.');
    }

    // --- MEJORA DE SINCRONIZACIÓN ---
    const dto = updateProjectDto as any;
    // Capturamos skills o projectSkills (según mande el frontend)
    const skills = dto.skills || dto.projectSkills; 
    const { startDate, endDate, ...rest } = dto;

    // LIMPIEZA DE SEGURIDAD: Eliminamos objetos relacionales que Prisma no acepta en un update directo
    delete rest.projectSkills;
    delete rest.career;
    delete rest.user;
    delete rest.userProjects;
    delete rest.skills; // Ya lo tenemos en la variable 'skills'

    return this.prismaService.$transaction(async (tx) => {
      
      // Si 'skills' está definido (aunque sea un array vacío []), sincronizamos
      if (skills !== undefined && Array.isArray(skills)) {
        // 1. Limpiamos la tabla intermedia por completo para este proyecto
        await tx.projectSkills.deleteMany({
          where: { projectId: id }
        });

        // 2. Insertamos las nuevas (solo si el array trae IDs)
        if (skills.length > 0) {
          // Nos aseguramos de extraer solo strings (IDs) por si vienen objetos
          const cleanSkillIds = skills.map((s: any) => typeof s === 'object' ? s.id || s.skillId : s);

          await tx.projectSkills.createMany({
            data: cleanSkillIds.map((skillId: string) => ({
              projectId: id,
              skillId: skillId,
            })),
          });
        }
      }

      // 3. Actualizamos los datos del proyecto
      return tx.project.update({
        where: { id },
        data: {
          ...rest,
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
        },
        include: {
          user: true,
          projectSkills: true,
          career: true,
        }
      });
    });
  }

  async remove(id: string): Promise<ProjectModel> {
    try {
      await this.prismaService.projectSkills.deleteMany({ where: { projectId: id } });
      await this.prismaService.userProject.deleteMany({ where: { projectId: id } });
      return super.remove(id);
    } catch (error) {
      throw error;
    }
  }
}