import { Test, TestingModule } from '@nestjs/testing';
import { UsersProjectsService } from './users-projects.service';

describe('UsersProjectsService', () => {
  let service: UsersProjectsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersProjectsService],
    }).compile();

    service = module.get<UsersProjectsService>(UsersProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
