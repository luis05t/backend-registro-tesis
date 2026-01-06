import { PartialType } from '@nestjs/swagger';
import { CreatePorjectsSkillDto } from './create-porjects-skill.dto';

export class UpdatePorjectsSkillDto extends PartialType(CreatePorjectsSkillDto) {}
