import { Test, TestingModule } from '@nestjs/testing';
import { RolesPermissionsService } from './roles-permissions.service';

describe('RolesPermissionsService', () => {
  let service: RolesPermissionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesPermissionsService],
    }).compile();

    service = module.get<RolesPermissionsService>(RolesPermissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
