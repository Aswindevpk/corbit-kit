create table public.payment_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null default 'razorpay',
  event_id    text not null unique,            -- x-razorpay-event-id
  event_type  text not null,                   -- payment.captured, …
  payment_id  text,
  order_id    text,
  amount      bigint,                          -- paise
  currency    text,
  payload     jsonb not null,
  received_at timestamptz not null default now()
);
create index payment_events_order_idx on public.payment_events (order_id);
alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;

-- Project-specific logic. Runs once per event, inside the recording transaction.
create or replace function internal.on_razorpay_event(p_event public.payment_events)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Example (Teachwell fee confirmation):
  -- if p_event.event_type = 'payment.captured' then
  --   update public.fee_accounts
  --      set valid_until = greatest(valid_until, now()) + interval '30 days'
  --    where razorpay_order_id = p_event.order_id;
  --   perform internal.enqueue('receipt.generate', jsonb_build_object('paymentId', p_event.payment_id),
  --                            'receipt:' || p_event.payment_id);
  -- end if;
  return;
end;
$$;

-- Called only by the webhook function with the service-role key.
create or replace function public.record_razorpay_event(p_event_id text, p_event_type text, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_payment jsonb := p_payload #> '{payload,payment,entity}';
  v_row     public.payment_events;
begin
  insert into public.payment_events (event_id, event_type, payment_id, order_id, amount, currency, payload)
  values (
    p_event_id, p_event_type,
    v_payment ->> 'id', v_payment ->> 'order_id',
    (v_payment ->> 'amount')::bigint, v_payment ->> 'currency',
    p_payload
  )
  on conflict (event_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    return false;   -- duplicate delivery
  end if;

  perform internal.on_razorpay_event(v_row);
  return true;
end;
$$;
revoke execute on function public.record_razorpay_event(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_razorpay_event(text, text, jsonb) to service_role;
