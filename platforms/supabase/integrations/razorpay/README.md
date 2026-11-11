# Razorpay webhooks

```
Razorpay ──► razorpay-webhook (Edge Function)
               1. verify HMAC signature on the raw body
               2. call public.record_razorpay_event (service role)
                    ├─ insert into payment_events   (unique event id → duplicates are no-ops)
                    ├─ internal.on_razorpay_event()  ← YOUR domain logic, same transaction
                    └─ enqueue side effects (receipt, push)
               3. return 200 quickly
```

Razorpay retries and can deliver the same event more than once, so idempotency is
enforced by the unique `event_id`. Domain logic (extend fee validity, mark an order
paid) goes in `internal.on_razorpay_event`, which runs only for the first delivery
of each event and in the same transaction as recording it.

## Setup

1. Add `migration.sql` as a new migration. Replace the body of
   `internal.on_razorpay_event` with the project's logic (see the example inside).
2. Copy `webhook.ts` to `supabase/functions/razorpay-webhook/index.ts`.
3. `supabase functions deploy razorpay-webhook --no-verify-jwt`
4. Razorpay Dashboard → Webhooks → URL = function URL, choose events
   (`payment.captured`, `payment.failed`, `refund.processed`, …), set a secret.
5. `supabase secrets set RAZORPAY_WEBHOOK_SECRET='…'`

## Creating orders

Creating a Razorpay order needs the key secret, so it is also an Edge Function
(`create-order`): check the user's permission via an RPC, create the order with the
Razorpay Orders API, store the order id against your domain record, return it to
the client checkout. Never trust an amount sent by the client.

## Reconciliation

Webhooks can be lost. Add a daily scheduled job that lists the day's payments from
the Razorpay API and calls `record_razorpay_event` for any it hasn't seen.
