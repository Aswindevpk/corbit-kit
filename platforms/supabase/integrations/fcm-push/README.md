# FCM push notifications

Business RPCs enqueue `push.send`; the outbox worker sends via the FCM HTTP v1 API.

## Setup

1. Add `migration.sql` as a new migration (device tokens + registration RPC).
2. Copy `send-push.ts` to `supabase/functions/process-outbox/handlers/send-push.ts` and
   register it in `handlers/index.ts`:
   ```ts
   import { sendPush } from './send-push.ts';
   export const handlers = { …, 'push.send': sendPush };
   ```
3. Firebase console → Project settings → Service accounts → Generate new private key.
   ```bash
   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"
   ```
4. Mobile app: after login, get the FCM token and call
   `supabase.rpc('register_device_token', { p_token, p_platform: 'android' })`.

## Sending

From any RPC:

```sql
perform internal.enqueue('push.send',
  jsonb_build_object('userIds', jsonb_build_array(v_user_id),
                     'title', 'Fee received', 'body', 'Your access is extended to 12 Dec.',
                     'data', jsonb_build_object('route', '/fees')),
  'fee-push:' || v_payment_id);
```

Invalid tokens (FCM `UNREGISTERED`) are deleted automatically.
