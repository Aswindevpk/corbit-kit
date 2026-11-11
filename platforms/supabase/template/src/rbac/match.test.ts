import { describe, expect, it } from 'vitest';
import type { PermissionSet } from '@/lib/contracts';
import { can, permissionMatches } from './match';

describe('permissionMatches', () => {
  it.each([
    [['fees.read'], 'fees.read', true],
    [['fees.*'], 'fees.delete', true],
    [['*.read'], 'crm.read', true],
    [['*.*'], 'anything.at_all', true],
    [['fees.read'], 'fees.delete', false],
    [['crm.*'], 'fees.read', false],
  ])('%j grants %s → %s', (granted, required, expected) => {
    expect(permissionMatches(granted, required)).toBe(expected);
  });
});

describe('can', () => {
  const accountant: PermissionSet = {
    userId: 'u1',
    grants: [{ scope: 'tenant', tenantId: 'clt', role: 'accountant', permissions: ['fees.*'] }],
  };
  const admin: PermissionSet = {
    userId: 'u2',
    grants: [{ scope: 'global', tenantId: null, role: 'super_admin', permissions: ['*.*'] }],
  };

  it('tenant grant covers only its tenant', () => {
    expect(can(accountant, 'fees.read', { tenantId: 'clt' })).toBe(true);
    expect(can(accountant, 'fees.read', { tenantId: 'koc' })).toBe(false);
  });
  it('tenant grant never covers global resources', () => {
    expect(can(accountant, 'fees.read', { global: true })).toBe(false);
  });
  it('anywhere is true if any tenant grants it', () => {
    expect(can(accountant, 'fees.read')).toBe(true);
  });
  it('global grant covers everything', () => {
    expect(can(admin, 'branches.create', { global: true })).toBe(true);
    expect(can(admin, 'fees.read', { tenantId: 'koc' })).toBe(true);
  });
  it('no permission set → false', () => {
    expect(can(undefined, 'fees.read')).toBe(false);
  });
});
