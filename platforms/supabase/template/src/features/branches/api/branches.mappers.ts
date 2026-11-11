import { z } from 'zod';
import { AppError, type ListResult } from '@/lib/contracts';
import type { Branch, BranchListParams, BranchSortField } from '../types/branch';

// ---- backend → domain --------------------------------------------------------
// The backend shape is validated at runtime: a migration that renames a column
// fails here, loudly, instead of rendering `undefined` in a table.

const branchRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  is_archived: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
const branchListSchema = z.object({ rows: z.array(branchRowSchema), total: z.number().int().nonnegative() });

export type BranchRow = z.infer<typeof branchRowSchema>;

export function toBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isArchived: row.is_archived,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError('UNKNOWN', { detail: `Unexpected branch response: ${result.error.message}` });
  return result.data;
}

export const parseBranch = (data: unknown): Branch => toBranch(parse(branchRowSchema, data));

export function parseBranchList(data: unknown): ListResult<Branch> {
  const list = parse(branchListSchema, data);
  return { rows: list.rows.map(toBranch), total: list.total };
}

// ---- domain → backend --------------------------------------------------------
const sortColumns: Record<BranchSortField, string> = { name: 'name', code: 'code', createdAt: 'created_at' };

export function toListArgs(params: BranchListParams) {
  const sortField = (params.sort?.id ?? 'name') as BranchSortField;
  return {
    p_search: params.search?.trim() || undefined,
    p_include_archived: params.includeArchived,
    p_limit: params.pageSize,
    p_offset: params.page * params.pageSize,
    p_sort: sortColumns[sortField] ?? 'name',
    p_dir: params.sort?.desc ? 'desc' : 'asc',
  };
}
