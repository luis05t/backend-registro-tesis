import { Type } from "class-transformer";
import {
	IsIn,
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
} from "class-validator";

export class PaginationDto {
	@IsOptional()
	@IsNumber()
	@IsPositive()
	@Type(() => Number)
	page?: number = 1;

	@IsOptional()
	@IsNumber()
	@IsPositive()
	@Type(() => Number)
	limit?: number = 10;

	@IsOptional()
	@IsString()
	@IsIn(["asc", "desc"])
	order?: "asc" | "desc" = "desc";

	@IsOptional()
	@IsString()
	orderBy?: string = "createdAt";

	@IsOptional()
	@IsString()
	search?: string;
}
