# MSG91 phone OTP

Supabase Auth generates and checks the OTP. This hook only delivers it via MSG91,
so `supabase.auth.signInWithOtp({ phone })` and `verifyOtp` work unchanged.

## Setup

1. In MSG91, create an OTP/Flow template with a variable for the code (e.g. `otp`)
   and get it DLT-approved for India.
2. Copy `index.ts` to `supabase/functions/send-sms-hook/index.ts`.
3. Deploy: `supabase functions deploy send-sms-hook --no-verify-jwt`
4. Dashboard → Authentication → Hooks → **Send SMS hook** → HTTPS → the function URL.
   Copy the generated secret.
5. Secrets:
   ```bash
   supabase secrets set SEND_SMS_HOOK_SECRET='v1,whsec_…' \
     MSG91_AUTH_KEY='…' MSG91_TEMPLATE_ID='…' MSG91_OTP_VAR='otp'
   ```
6. Enable the Phone provider in Authentication → Providers.

## Frontend

Add to the auth feature's `api/`:

```ts
await supabase.auth.signInWithOtp({ phone: '+919876543210' });
await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
```

## Test

Use a test number in Authentication → Providers → Phone → Test OTP so local
development doesn't send real SMS.
