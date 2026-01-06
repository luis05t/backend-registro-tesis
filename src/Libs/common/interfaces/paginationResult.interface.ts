export interface PaginatedResult<T> {
	data: T[];
	meta: {
		total: number;
		pagination: {
			page: number;
			limit: number;
			order: "asc" | "desc";
		};
		totalPages: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	};
}
