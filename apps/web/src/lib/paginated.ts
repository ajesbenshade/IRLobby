export interface PaginatedResponse<T> {
  results?: T[];
}

export function asArrayResponse<T>(value: T[] | PaginatedResponse<T> | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && Array.isArray(value.results)) {
    return value.results;
  }

  return [];
}