import { Test, TestingModule } from '@nestjs/testing';
import { RolesPermissionsController } from './roles-permissions.controller';
import { RolesPermissionsService } from './roles-permissions.service';

describe('RolesPermissionsController', () => {
  let controller: RolesPermissionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesPermissionsController],
      providers: [RolesPermissionsService],
    }).compile();

    controller = module.get<RolesPermissionsController>(RolesPermissionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
