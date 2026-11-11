-- =============================================================================
-- TRANSACTIONAL OUTBOX
-- Business RPCs call internal.enqueue(...) inside their transaction. The
-- process-outbox Edge Function drains jobs (push, SMS, PDFs, emails) with retries.
-- A failed side effect never rolls back the business change.
-- See platforms/supabase/docs/outbox.md
-- =============================================================================

create table internal.outbox (
  id              bigint generated always as identity primary key,
  topic           text not null,                     -- e.g. 'push.send', 'receipt.generate'
  payload         jsonb not null default '{}'::jsonb,
  idempotency_key text unique,                       -- same key = enqueued once
  status          text not null default 'pending'
                  check (status in ('pending', 'processing', 'done', 'failed')),
  attempts        int not null default 0,
  max_attempts    int not null default 8,
  run_after       timestamptz not null default now(),
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index outbox_ready_idx on internal.outbox (status, run_after);
create trigger outbox_updated_at before update on internal.outbox
  for each row execute function internal.set_updated_at();

revoke all on internal.outbox from public, anon, authenticated;

-- Called from inside business RPCs (which run as definer or invoker).
create or replace function internal.enqueue(p_topic text, p_payload jsonb, p_idempotency_key text default null)
returns void language sql security definer set search_path = '' as $$
  insert into internal.outbox (topic, payload, idempotency_key)
  values (p_topic, p_payload, p_idempotency_key)
  on conflict (idempotency_key) do nothing;
$$;
grant execute on function internal.enqueue(text, jsonb, text) to authenticated;

-- ---- Worker RPCs: service_role only ----------------------------------------
-- Claims ready jobs, plus jobs stuck in 'processing' for 10+ minutes (crashed worker).
create or replace function public.outbox_claim(p_limit int default 20)
returns table (id bigint, topic text, payload jsonb, attempts int)
language sql security definer set search_path = '' as $$
  update internal.outbox o
     set status = 'processing', attempts = o.attempts + 1
   where o.id in (
     select x.id from internal.outbox x
      where (x.status = 'pending' and x.run_after <= now())
         or (x.status = 'processing' and x.updated_at < now() - interval '10 minutes')
      order by x.id
      limit p_limit
      for update skip locked
   )
  returning o.id, o.topic, o.payload, o.attempts;
$$;

create or replace function public.outbox_complete(p_id bigint)
returns void language sql security definer set search_path = '' as $$
  update internal.outbox set status = 'done', last_error = null where id = p_id;
$$;

-- Exponential backoff: 1, 2, 4 … minutes, capped at 1 hour.
create or replace function public.outbox_fail(p_id bigint, p_error text)
returns void language sql security definer set search_path = '' as $$
  update internal.outbox
     set status     = case when attempts >= max_attempts then 'failed' else 'pending' end,
         last_error = left(p_error, 2000),
         run_after  = now() + least(interval '1 hour', interval '1 minute' * power(2, greatest(attempts - 1, 0)))
   where id = p_id;
$$;

revoke execute on function public.outbox_claim(int), public.outbox_complete(bigint), public.outbox_fail(bigint, text)
  from public, anon, authenticated;
grant execute on function public.outbox_claim(int), public.outbox_complete(bigint), public.outbox_fail(bigint, text)
  to service_role;
