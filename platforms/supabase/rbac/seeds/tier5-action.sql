-- Tier 5: exact actions. Note what is absent: telecallers have no crm.delete or
-- crm.export; auditors only read.
insert into public.roles (key, name, permissions, is_global_only, assignable_by_tenant) values
  ('super_admin',     'Super admin',      '{*.*}', true, false),
  ('auditor',         'Auditor',          '{*.read}', true, false),
  ('branch_manager',  'Branch manager',   '{branches.read,branches.update,users.read,users.manage,crm.*,fees.*}', false, false),
  ('crm_lead',        'CRM lead',         '{branches.read,crm.*}', false, true),
  ('telecaller',      'Telecaller',       '{branches.read,crm.read,crm.create,crm.update}', false, true),
  ('finance_officer', 'Finance officer',  '{branches.read,fees.read,fees.create,fees.update}', false, true)
on conflict (key) do nothing;
