import { Injectable } from '@nestjs/common';
import { CreateUsersProjectDto } from './dto/create-users-project.dto';
import { UpdateUsersProjectDto } from './dto/update-users-project.dto';
import { BaseService } from 'src/prisma/base.service';
import { UserProjectModel } from 'src/prisma/generated/models';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersProjectsService extends BaseService<UserProjectModel, CreateUsersProjectDto, UpdateUsersProjectDto> {
  constructor(prismaService: PrismaService) {
    super(prismaService, { name: 'userProject' });
  }

  async findByUserId(userId: string) {
    try {
      const userProjects = await this.prisma.userProject.findMany({
        where: {
          userId: userId,
        },
        include: {
          project: true,
        },
      });
      return userProjects;
    } catch (error) {
      throw error;
    }
  }
}
