// Razorpay webhook receiver. Deploy with --no-verify-jwt (Razorpay can't send a Supabase JWT).
import { createClient } from 'npm:@supabase/supabase-js@2';

const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!;
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function hmacHex(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const body = await req.text(); // raw body: signature is over the exact bytes
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  if (!timingSafeEqual(await hmacHex(body), signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(body);
  const eventId = req.headers.get('x-razorpay-event-id') ?? `${payload.event}:${payload.created_at}`;

  const { error } = await supabase.rpc('record_razorpay_event', {
    p_event_id: eventId,
    p_event_type: payload.event,
    p_payload: payload,
  });
  if (error) {
    console.error('record_razorpay_event failed', error);
    return new Response('Retry later', { status: 500 }); // Razorpay will retry
  }
  return new Response('ok');
});
