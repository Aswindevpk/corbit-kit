-- devtest: central record of development and verification events.
--
-- Every project's fidtrack / cortest pushes its append-only event log here
-- (POST /rest/v1/devtest_events, keyed by event id, duplicates ignored).
-- Status is never stored: it is computed from these events, exactly as the
-- tool does locally. The table is insert-only: history cannot be rewritten.
--
-- Apply with the Supabase SQL editor or:  supabase db push
-- Then put in the project's devtest/.env (never commit it):
--   SUPABASE_URL=https://<ref>.supabase.co
--   DEVTEST_SUPABASE_KEY=<service role key>

create table if not exists public.devtest_events (
  id          uuid primary key,
  project     text        not null,
  ts          timestamptz not null,
  type        text        not null,          -- dev | block | result | c2.start | c2.result | c2.abort | gate
  actor_name  text        not null,
  actor_kind  text        not null check (actor_kind in ('human', 'agent', 'automation')),
  commit      text,
  payload     jsonb       not null,          -- the full event as written to devtest/events.jsonl
  received_at timestamptz not null default now()
);

create index if not exists devtest_events_project_ts on public.devtest_events (project, ts);
create index if not exists devtest_events_case on public.devtest_events ((payload ->> 'caseId')) where type = 'result';

-- Insert-only, even for the service role.
create or replace function public.devtest_events_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'devtest_events is append-only';
end;
$$;

drop trigger if exists devtest_events_no_change on public.devtest_events;
create trigger devtest_events_no_change
  before update or delete on public.devtest_events
  for each row execute function public.devtest_events_immutable();

-- Row level security: no anonymous access. The tool writes with the service
-- role key (which bypasses RLS). Signed-in staff may read for dashboards.
alter table public.devtest_events enable row level security;

drop policy if exists devtest_events_read on public.devtest_events;
create policy devtest_events_read on public.devtest_events
  for select to authenticated using (true);

-- Latest result per test case, per project (for dashboards across projects).
create or replace view public.devtest_latest_results
with (security_invoker = true) as
select distinct on (project, payload ->> 'caseId')
  project,
  payload ->> 'caseId'  as case_id,
  payload ->> 'level'   as level,
  payload ->> 'result'  as result,
  payload ->> 'note'    as note,
  payload ->> 'source'  as source,
  actor_name,
  actor_kind,
  commit,
  ts
from public.devtest_events
where type = 'result'
order by project, payload ->> 'caseId', ts desc;

-- Development completion per FID, per project.
create or replace view public.devtest_dev_status
with (security_invoker = true) as
select distinct on (project, payload ->> 'fid', payload ->> 'field')
  project,
  payload ->> 'fid'                as fid,
  payload ->> 'field'              as field,
  (payload ->> 'value')::boolean   as value,
  actor_name,
  ts
from public.devtest_events
where type = 'dev'
order by project, payload ->> 'fid', payload ->> 'field', ts desc;

-- C2 attempt history, per project.
create or replace view public.devtest_c2_attempts
with (security_invoker = true) as
select
  s.project,
  (s.payload ->> 'attempt')::int as attempt,
  s.actor_name                   as started_by,
  s.ts                           as started_at,
  jsonb_array_length(s.payload -> 'itemIds') as items,
  count(r.id) filter (where r.payload ->> 'result' = 'pass')  as passed,
  count(r.id) filter (where r.payload ->> 'result' <> 'pass') as failed,
  max(r.ts)                      as last_result_at
from public.devtest_events s
left join public.devtest_events r
  on r.project = s.project and r.type = 'c2.result' and r.payload ->> 'attempt' = s.payload ->> 'attempt'
where s.type = 'c2.start'
group by s.project, s.payload, s.actor_name, s.ts;
