// Supabase Auth "Send SMS" hook → MSG91.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

type HookPayload = { user: { phone: string }; sms: { otp: string } };

const hookSecret = Deno.env.get('SEND_SMS_HOOK_SECRET')!.replace('v1,whsec_', '');
const authKey = Deno.env.get('MSG91_AUTH_KEY')!;
const templateId = Deno.env.get('MSG91_TEMPLATE_ID')!;
const otpVar = Deno.env.get('MSG91_OTP_VAR') ?? 'otp';

const fail = (message: string, status = 500) =>
  Response.json({ error: { http_code: status, message } }, { status });

Deno.serve(async (req) => {
  const body = await req.text();
  let payload: HookPayload;
  try {
    payload = new Webhook(hookSecret).verify(body, Object.fromEntries(req.headers)) as HookPayload;
  } catch {
    return fail('Invalid signature', 401);
  }

  // MSG91 expects the number with country code and no '+'.
  const mobile = payload.user.phone.replace(/^\+/, '');

  // VERIFY: request format against the current MSG91 Flow API docs.
  const res = await fetch('https://control.msg91.com/api/v5/flow', {
    method: 'POST',
    headers: { authkey: authKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      template_id: templateId,
      short_url: '0',
      recipients: [{ mobiles: mobile, [otpVar]: payload.sms.otp }],
    }),
  });

  if (!res.ok) {
    console.error('MSG91 error', res.status, await res.text());
    return fail('SMS provider rejected the request');
  }
  return Response.json({});
});
