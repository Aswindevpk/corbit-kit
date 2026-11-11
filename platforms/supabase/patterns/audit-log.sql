-- Audit log: who did what, to which record, with before/after values.
-- Use it from write RPCs (explicit) rather than generic triggers, so the action name
-- matches the business operation ("fee.waived", not "UPDATE fees").

create table internal.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,                      -- auth.uid(); null for system/webhook actions
  tenant_id  uuid,
  action     text not null,             -- 'branch.archived', 'crm.exported'
  entity     text not null,             -- 'tenants'
  entity_id  text,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on internal.audit_log (entity, entity_id);
create index audit_log_tenant_idx on internal.audit_log (tenant_id, created_at desc);
revoke all on internal.audit_log from public, anon, authenticated;

create or replace function internal.audit(
  p_action text, p_entity text, p_entity_id text,
  p_tenant_id uuid default null, p_before jsonb default null, p_after jsonb default null
) returns void language sql security definer set search_path = '' as $$
  insert into internal.audit_log (actor_id, tenant_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), p_tenant_id, p_action, p_entity, p_entity_id, p_before, p_after);
$$;
grant execute on function internal.audit(text, text, text, uuid, jsonb, jsonb) to authenticated;

-- Usage inside an RPC:
--   perform internal.audit('branch.archived', 'tenants', p_id::text, p_id, to_jsonb(v_before), to_jsonb(v_row));

-- Read access for auditors: an RPC that checks internal.has_permission('audit.read', p_tenant_id).
