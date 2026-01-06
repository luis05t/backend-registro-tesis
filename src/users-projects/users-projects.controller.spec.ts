import { Test, TestingModule } from '@nestjs/testing';
import { UsersProjectsController } from './users-projects.controller';
import { UsersProjectsService } from './users-projects.service';

describe('UsersProjectsController', () => {
  let controller: UsersProjectsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersProjectsController],
      providers: [UsersProjectsService],
    }).compile();

    controller = module.get<UsersProjectsController>(UsersProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
