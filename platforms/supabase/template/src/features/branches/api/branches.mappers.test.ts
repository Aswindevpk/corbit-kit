import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/contracts';
import { parseBranchList, toListArgs } from './branches.mappers';

const row = {
  id: 'b1', code: 'CLT', name: 'Calicut', is_archived: false,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
};

describe('branch mappers', () => {
  it('maps rows to domain types', () => {
    const result = parseBranchList({ rows: [row], total: 1 });
    expect(result.total).toBe(1);
    expect(result.rows[0]).toMatchObject({ id: 'b1', code: 'CLT', isArchived: false });
    expect(result.rows[0]?.createdAt).toBeInstanceOf(Date);
  });

  it('rejects unexpected shapes with AppError', () => {
    expect(() => parseBranchList({ rows: [{ ...row, is_archived: 'no' }], total: 1 })).toThrow(AppError);
  });

  it('builds RPC args from list params', () => {
    expect(
      toListArgs({ page: 2, pageSize: 20, search: '  koc ', includeArchived: true, sort: { id: 'createdAt', desc: true } }),
    ).toEqual({
      p_search: 'koc', p_include_archived: true, p_limit: 20, p_offset: 40, p_sort: 'created_at', p_dir: 'desc',
    });
  });
});
