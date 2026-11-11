// Drains internal.outbox. Triggered every minute by pg_cron (docs/outbox.md).
// Deploy with: supabase functions deploy process-outbox --no-verify-jwt
// Auth: requires header `x-worker-secret` matching the WORKER_SECRET secret.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handlers } from './handlers/index.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type Job = { id: number; topic: string; payload: Record<string, unknown>; attempts: number };

Deno.serve(async (req) => {
  if (req.headers.get('x-worker-secret') !== Deno.env.get('WORKER_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: jobs, error } = await supabase.rpc('outbox_claim', { p_limit: 20 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results = await Promise.allSettled(
    (jobs as Job[]).map(async (job) => {
      const handler = handlers[job.topic];
      try {
        if (!handler) throw new Error(`No handler for topic "${job.topic}"`);
        await handler(job.payload, { supabase, attempt: job.attempts });
        await supabase.rpc('outbox_complete', { p_id: job.id });
      } catch (e) {
        await supabase.rpc('outbox_fail', { p_id: job.id, p_error: String(e) });
        throw e;
      }
    }),
  );

  return Response.json({
    claimed: results.length,
    failed: results.filter((r) => r.status === 'rejected').length,
  });
});
