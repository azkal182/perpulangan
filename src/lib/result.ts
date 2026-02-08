// src/lib/result.ts
export type PaginatedData<T> = {
  items: T[];
  meta: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
};

export type Result<T> =
  | { success: true; data: T }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { success: false; error: string; issues?: any };

export const success = <T>(data: T): Result<T> => ({ success: true, data });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const failure = (error: string, issues?: any): Result<any> => ({
  success: false,
  error,
  issues,
});
