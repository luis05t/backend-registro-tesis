import { Test, TestingModule } from '@nestjs/testing';
import { PorjectsSkillsService } from './porjects-skills.service';

describe('PorjectsSkillsService', () => {
  let service: PorjectsSkillsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PorjectsSkillsService],
    }).compile();

    service = module.get<PorjectsSkillsService>(PorjectsSkillsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
