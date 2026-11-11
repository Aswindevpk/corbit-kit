# Outbox: side effects that must not be lost

Push notifications, SMS, emails, PDFs and third-party calls never run inside a
business transaction. The RPC records the intent in the same transaction as the
change; a worker delivers it later, with retries.

```
RPC (one transaction)                     process-outbox (every minute)
  update business rows                      outbox_claim(20)  ← skip locked
  internal.enqueue('push.send', …, key)     run handler for each job
commit ─────────────────────────────────►   outbox_complete / outbox_fail (backoff)
```

## Enqueue

```sql
perform internal.enqueue(
  'push.send',
  jsonb_build_object('userId', v_student_id, 'title', 'Payment received'),
  'payment-push:' || p_payment_id        -- idempotency key: enqueued at most once
);
```

## Handlers

`template/supabase/functions/process-outbox/handlers/index.ts` maps topics to functions.
Handlers must be idempotent: a job can run twice if the worker dies after the side
effect but before marking it done.

## Scheduling the worker

```bash
supabase secrets set WORKER_SECRET=$(openssl rand -hex 32)
supabase functions deploy process-outbox --no-verify-jwt
```

Store the URL and secret in Vault, then schedule (SQL editor, per environment):

```sql
select vault.create_secret('https://<project>.supabase.co/functions/v1/process-outbox', 'outbox_url');
select vault.create_secret('<WORKER_SECRET>', 'outbox_secret');

select cron.schedule('process-outbox', '* * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'outbox_url'),
    headers := jsonb_build_object('x-worker-secret',
               (select decrypted_secret from vault.decrypted_secrets where name = 'outbox_secret'))
  );
$$);
```

Requires the `pg_cron` and `pg_net` extensions (Database → Extensions).

## Operating it

```sql
-- stuck or failed jobs
select id, topic, attempts, last_error, run_after from internal.outbox
 where status in ('failed', 'pending') order by id desc limit 50;

-- retry a failed job
update internal.outbox set status = 'pending', attempts = 0, run_after = now() where id = <id>;
```

Archive `done` rows older than 30 days with a second cron job if the table grows.
