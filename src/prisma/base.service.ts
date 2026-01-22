import { PrismaService } from "./prisma.service";
import { PaginationDto, PaginatedResult } from '../Libs/common/';

interface FindManyOptions {
	where?: any;
	include?: any;
	select?: any;
	orderBy?: any;
}

export class BaseService<T, CreateDto, UpdateDto> {
	constructor(
		protected prisma: PrismaService,
		protected model: { name: string },
	) {}

	async create(data: CreateDto): Promise<T> {
		try {
			const result = await this.prisma[this.model.name].create({ data: data });
			return result;
		} catch (error) {
			throw error;
		}
	}

	async findAll(paginationDto?: PaginationDto): Promise<PaginatedResult<T>> {
		return this.findManyPaginated({}, paginationDto);
	}

	/**
	 * Método principal de paginación flexible
	 * CORREGIDO: Usa Promise.all en lugar de $transaction para evitar bloqueos
	 */
	async findManyPaginated(
		options: FindManyOptions = {},
		paginationDto?: PaginationDto,
	): Promise<PaginatedResult<T>> {
		try {
			const pagination = {
				page: paginationDto?.page ?? 1,
				limit: paginationDto?.limit ?? 10,
				order: paginationDto?.order ?? "desc",
				orderBy: paginationDto?.orderBy ?? "createdAt",
			};

			const skip = (pagination.page - 1) * pagination.limit;

			// Construir la cláusula where
			let whereClause = options.where

			// Agregar búsqueda si está presente
			if (paginationDto?.search) {
				whereClause = await this.buildSearchWhere(
					whereClause,
					paginationDto.search,
				);
			}

			// Construir orderBy dinámicamente
			const orderByClause = {};
			orderByClause[pagination.orderBy] = pagination.order;

			const findManyArgs = {
				where: whereClause,
				take: pagination.limit,
				skip: skip,
				orderBy: options.orderBy || orderByClause,
				...(options.include && { include: options.include }),
				...(options.select && { select: options.select }),
			};

			// CAMBIO IMPORTANTE: Promise.all libera la conexión más rápido
			const [result, totalCount] = await Promise.all([
				this.prisma[this.model.name].findMany(findManyArgs),
				this.prisma[this.model.name].count({
					where: whereClause,
				}),
			]);

			const totalPages = Math.ceil(totalCount / pagination.limit);

			return {
				data: result,
				meta: {
					total: totalCount,
					pagination: {
						page: pagination.page,
						limit: pagination.limit,
						order: pagination.order,
					},
					totalPages,
					hasNextPage: pagination.page < totalPages,
					hasPreviousPage: pagination.page > 1,
				},
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Método para construir búsqueda - puede ser sobrescrito en servicios hijo
	 */
	protected async buildSearchWhere(
		baseWhere: any,
		_searchTerm: string,
	): Promise<any> {
		// Implementación básica - los servicios hijo pueden sobrescribir este método
		return baseWhere;
	}

	async findOne(id: string): Promise<T | null> {
		try {
			const result = await this.prisma[this.model.name].findUnique({
				where: { id, },
			});
			if (!result) {
				throw new Error(`${this.model.name} with id ${id} not found`);
			}
			return result;
		} catch (error) {
			throw error;
		}
	}

	async update(id: string, data: UpdateDto): Promise<T> {
		try {
			const result = await this.prisma[this.model.name].update({
				where: { id },
				data,
			});
			if (!result) {
				throw new Error(`${this.model.name} with id ${id} not found`);
			}
			return result;
		} catch (error) {
			throw error;
		}
	}

	async remove(id: string): Promise<T> {
		try {
			const result = await this.prisma[this.model.name].delete({
				where: { id },
			});
			if (!result) {
				throw new Error(`${this.model.name} with id ${id} not found`);
			}
			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Buscar todos sin paginación para casos específicos
	 */
	async findAllWithoutPagination(): Promise<T[]> {
		try {
			const result = await this.prisma[this.model.name].findMany({
				where: { },
				orderBy: {
					createdAt: "desc",
				},
			});
			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Buscar por múltiples IDs
	 */
	async findByIds(ids: string[]): Promise<T[]> {
		try {
			const result = await this.prisma[this.model.name].findMany({
				where: {
					id: { in: ids },
				},
			});
			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Contar registros con filtros opcionales
	 */
	async count(where?: any): Promise<number> {
		try {
			const whereClause = where
				? { ...where, }
				: { };
			const count = await this.prisma[this.model.name].count({
				where: whereClause,
			});
			return count;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Verificar si existe un registro
	 */
	async exists(id: string): Promise<boolean> {
		try {
			const result = await this.prisma[this.model.name].findUnique({
				where: { id, },
				select: { id: true },
			});
			return !!result;
		} catch (error) {
			console.error(`Error checking existence for ${this.model.name}:`, error);
			return false;
		}
	}

	/**
	 * Delete masivo
	 */
	async removeMany(ids: string[]): Promise<{ count: number }> {
		try {
			const result = await this.prisma[this.model.name].deleteMany({
				where: { id: { in: ids } },
			});
			return result;
		} catch (error) {
			throw error;
		}
	}
}