// Platform-neutral contracts. Identical in every platform template.
// The UI depends on these shapes; each platform's src/platform/ and api/ produce them.

export type SortState = { id: string; desc: boolean };

export type ListParams = {
  page: number;      // 0-based
  pageSize: number;
  search?: string;
  sort?: SortState;
};

export type ListResult<T> = { rows: T[]; total: number };

/** Every error that leaves api/ or platform/ is an AppError. */
export class AppError extends Error {
  readonly code: string;
  /** Form field name the error belongs to, if any. */
  readonly field?: string;

  constructor(code: string, options?: { field?: string; detail?: string }) {
    super(options?.detail ?? code);
    this.name = 'AppError';
    this.code = code;
    this.field = options?.field;
  }
}

export type Grant = {
  scope: 'global' | 'tenant';
  tenantId: string | null;
  role: string;
  permissions: string[];
};

export type PermissionSet = { userId: string | null; grants: Grant[] };
