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

  // MODIFICADO: Lógica de permisos de visualización
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

      // Si NO es Admin:
      // Puede ver proyectos 'en progreso' (validados) de TODOS
      // Y TAMBIÉN sus propios proyectos 'pendientes' (para que no desaparezcan para él)
      if (!isAdmin) {
        whereCondition = {
          OR: [
            { status: { not: 'pendiente' } }, // Lo público (10 proyectos)
            { createdBy: user.id }            // Lo mío (3 pendientes)
          ]
        };
      }
      // Si es Admin, ve TODO (13 proyectos)
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
        status: 'pendiente', // Nace pendiente
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        createdBy: user.id, 
      },
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

    const { startDate, endDate, ...rest } = updateProjectDto;

    return this.prismaService.project.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
    });
  }
}