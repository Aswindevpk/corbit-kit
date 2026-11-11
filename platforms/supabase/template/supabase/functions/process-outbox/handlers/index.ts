// Topic → handler registry. Handlers must be idempotent: a job can run more than
// once if the worker crashes after the side effect but before outbox_complete.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type HandlerContext = { supabase: SupabaseClient; attempt: number };
export type Handler = (payload: Record<string, unknown>, ctx: HandlerContext) => Promise<void>;

export const handlers: Record<string, Handler> = {
  'debug.log': async (payload) => {
    console.log('[outbox] debug.log', JSON.stringify(payload));
  },
  // 'push.send': sendPush,        ← add from platforms/supabase/integrations/fcm-push
  // 'receipt.generate': ...,
};
