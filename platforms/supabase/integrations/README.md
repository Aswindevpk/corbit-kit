# Integrations (Supabase)

Each folder is self-contained: README, SQL to add as a migration, and Edge Function code.

| Folder | What it does | Pattern |
|---|---|---|
| `msg91-sms-hook/` | Phone OTP over MSG91 | Supabase Auth "Send SMS" hook → Edge Function |
| `fcm-push/` | Push notifications | Device tokens table + outbox handler `push.send` |
| `razorpay/` | Payment webhooks | Verified webhook → idempotent RPC → outbox |

Common rules:

- Secrets only via `supabase secrets set`. Never in code or the frontend.
- Webhooks verify the signature before parsing anything.
- Every external call is retried by the outbox, so handlers are idempotent.
- Vendor APIs change: check the vendor's current docs for request formats before go-live.
  The places most likely to drift are marked `VERIFY` in the code.
