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
    // 1. Verificamos existencia
    const project = await this.prismaService.project.findUnique({ where: { id } });

    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }

    // 2. Verificamos permisos
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

    // 3. Preparación de datos (Limpieza profunda)
    const dto = { ...updateProjectDto } as any;
    
    // Capturamos las habilidades sin importar cómo las mande el frontend
    const rawSkills = dto.skills || dto.projectSkills; 
    
    // Extraemos fechas
    const { startDate, endDate } = dto;

    // Eliminamos TODO lo que no sea un campo plano de la tabla Project
    // Esto evita que Prisma intente hacer "Nested Writes" que rompen la transacción
    const fieldsToId = ['skills', 'projectSkills', 'career', 'user', 'userProjects', 'createdBy'];
    fieldsToId.forEach(field => delete dto[field]);

    return this.prismaService.$transaction(async (tx) => {
      
      // --- SINCRONIZACIÓN DE HABILIDADES ---
      if (rawSkills !== undefined && Array.isArray(rawSkills)) {
        
        // A. Borramos SOLO las de este proyecto (Evita el "salto" entre proyectos)
        await tx.projectSkills.deleteMany({
          where: { projectId: id }
        });

        // B. Si hay habilidades seleccionadas, las insertamos en bloque
        if (rawSkills.length > 0) {
          // Limpiamos los IDs (por si vienen como objetos del frontend)
          const cleanSkillIds = rawSkills.map((s: any) => 
            typeof s === 'object' ? s.skillId || s.id : s
          );
          
          // Eliminamos duplicados por seguridad
          const uniqueIds = [...new Set(cleanSkillIds)] as string[];

          await tx.projectSkills.createMany({
            data: uniqueIds.map((skillId: string) => ({
              projectId: id,
              skillId: skillId,
            })),
            skipDuplicates: true, // Clave para evitar el error de "solo una a la vez"
          });
        }
      }

      // 4. Actualización final de los datos del proyecto
      return tx.project.update({
        where: { id },
        data: {
          ...dto,
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
        },
        include: {
          user: true,
          projectSkills: true,
          career: true,
        }
      });
    }, {
      timeout: 10000 // Aumentamos tiempo para procesos masivos
    });
  }

  async remove(id: string): Promise<ProjectModel> {
    try {
      // Limpiamos relaciones antes de borrar el proyecto (Manual Cascade)
      await this.prismaService.projectSkills.deleteMany({ where: { projectId: id } });
      await this.prismaService.userProject.deleteMany({ where: { projectId: id } });
      return super.remove(id);
    } catch (error) {
      throw error;
    }
  }
}