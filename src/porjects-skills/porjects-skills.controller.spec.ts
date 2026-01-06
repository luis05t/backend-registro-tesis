import { Test, TestingModule } from '@nestjs/testing';
import { PorjectsSkillsController } from './porjects-skills.controller';
import { PorjectsSkillsService } from './porjects-skills.service';

describe('PorjectsSkillsController', () => {
  let controller: PorjectsSkillsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PorjectsSkillsController],
      providers: [PorjectsSkillsService],
    }).compile();

    controller = module.get<PorjectsSkillsController>(PorjectsSkillsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
