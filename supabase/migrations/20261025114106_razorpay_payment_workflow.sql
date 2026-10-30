-- Server-only, row-locked payment attempt lifecycle for Razorpay.
-- Existing payments/payment_attempts tables remain the source of truth.

create or replace function public.begin_booking_payment_attempt(p_booking_id uuid)
returns table (
  result_status text,
  payment_id uuid,
  attempt_id uuid,
  provider_order_id text,
  amount numeric,
  currency_code char(3),
  booking_reference text
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;
  v_attempt public.payment_attempts%rowtype;
  v_placeholder text;
  v_attempt_number integer;
begin
  select b.* into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found then return query select 'NOT_FOUND'::text, null::uuid, null::uuid, null::text, null::numeric, null::char(3), null::text; return; end if;
  if v_booking.status = 'cancelled' then return query select 'CANCELLED'::text, null::uuid, null::uuid, null::text, null::numeric, null::char(3), v_booking.booking_reference; return; end if;
  if v_booking.payment_status = 'paid' then return query select 'ALREADY_PAID'::text, null::uuid, null::uuid, null::text, null::numeric, null::char(3), v_booking.booking_reference; return; end if;
  if v_booking.status <> 'payment_pending' then return query select 'NOT_PAYABLE'::text, null::uuid, null::uuid, null::text, null::numeric, null::char(3), v_booking.booking_reference; return; end if;
  if v_booking.payment_pending_expires_at <= clock_timestamp() then return query select 'EXPIRED'::text, null::uuid, null::uuid, null::text, null::numeric, null::char(3), v_booking.booking_reference; return; end if;
  if v_booking.total_amount <= 0 then return query select 'INVALID_AMOUNT'::text, null::uuid, null::uuid, null::text, null::numeric, null::char(3), v_booking.booking_reference; return; end if;

  insert into public.payments (booking_id, currency_code, amount_due)
  values (v_booking.id, v_booking.currency_code, v_booking.total_amount)
  on conflict (booking_id) do nothing;
  select p.* into v_payment from public.payments p where p.booking_id = v_booking.id for update;
  if v_payment.amount_due <> v_booking.total_amount or v_payment.currency_code <> v_booking.currency_code then
    return query select 'PAYMENT_RECORD_MISMATCH'::text, null::uuid, null::uuid, null::text, null::numeric, null::char(3), v_booking.booking_reference; return;
  end if;
  if v_payment.status = 'paid' then return query select 'ALREADY_PAID'::text, v_payment.id, null::uuid, null::text, v_payment.amount_due, v_payment.currency_code, v_booking.booking_reference; return; end if;

  select a.* into v_attempt from public.payment_attempts a
  where a.payment_id = v_payment.id and a.status = 'created'
  order by a.attempt_number desc limit 1 for update;
  if found then
    if left(v_attempt.provider_order_id, 11) <> 'dc_pending_' then
      return query select 'REUSE'::text, v_payment.id, v_attempt.id, v_attempt.provider_order_id, v_attempt.amount, v_attempt.currency_code, v_booking.booking_reference; return;
    end if;
    if v_attempt.created_at > clock_timestamp() - interval '2 minutes' then
      return query select 'IN_PROGRESS'::text, v_payment.id, v_attempt.id, null::text, v_attempt.amount, v_attempt.currency_code, v_booking.booking_reference; return;
    end if;
    update public.payment_attempts a set status = 'abandoned', abandoned_at = clock_timestamp()
    where a.id = v_attempt.id and a.status = 'created';
  end if;

  select coalesce(max(a.attempt_number), 0) + 1 into v_attempt_number
  from public.payment_attempts a where a.payment_id = v_payment.id;
  v_placeholder := 'dc_pending_' || gen_random_uuid()::text;
  insert into public.payment_attempts (payment_id, attempt_number, status, provider_order_id, amount, currency_code)
  values (v_payment.id, v_attempt_number, 'created', v_placeholder, v_payment.amount_due, v_payment.currency_code)
  returning * into v_attempt;
  return query select 'CREATED'::text, v_payment.id, v_attempt.id, v_placeholder, v_attempt.amount, v_attempt.currency_code, v_booking.booking_reference;
end
$$;

create or replace function public.attach_booking_payment_order(p_attempt_id uuid, p_placeholder text, p_order_id text)
returns boolean
language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if p_order_id is null or p_order_id !~ '^order_[A-Za-z0-9]+$' then return false; end if;
  update public.payment_attempts a set provider_order_id = p_order_id
  where a.id = p_attempt_id and a.provider = 'razorpay' and a.status = 'created'
    and a.provider_order_id = p_placeholder and left(p_placeholder, 11) = 'dc_pending_';
  return found;
end
$$;

create or replace function public.fail_booking_payment_order(p_attempt_id uuid, p_placeholder text)
returns boolean
language plpgsql security definer set search_path = pg_catalog
as $$
begin
  update public.payment_attempts a set status = 'failed', failed_at = clock_timestamp(),
    failure_code = 'order_creation_failed', failure_description = 'Razorpay order creation failed.'
  where a.id = p_attempt_id and a.status = 'created' and a.provider_order_id = p_placeholder;
  return found;
end
$$;

create or replace function public.finalize_razorpay_payment(
  p_order_id text,
  p_payment_id text,
  p_amount numeric,
  p_currency_code char(3),
  p_captured boolean
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
begin
  -- Lock in the same booking -> payment -> attempt order as order creation.
  select a.* into v_attempt from public.payment_attempts a
  where a.provider = 'razorpay' and a.provider_order_id = p_order_id;
  if not found then return 'ORDER_NOT_FOUND'; end if;
  select p.* into v_payment from public.payments p where p.id = v_attempt.payment_id;
  select b.* into v_booking from public.bookings b where b.id = v_payment.booking_id for update;
  select p.* into v_payment from public.payments p where p.id = v_attempt.payment_id for update;
  select a.* into v_attempt from public.payment_attempts a where a.id = v_attempt.id for update;
  if p_amount is distinct from v_attempt.amount or p_currency_code is distinct from v_attempt.currency_code then return 'AMOUNT_OR_CURRENCY_MISMATCH'; end if;
  if v_attempt.status = 'successful' then
    if v_attempt.provider_payment_id = p_payment_id and v_payment.status = 'paid' then return 'REPLAYED'; end if;
    return 'ALREADY_FINALIZED';
  end if;
  if v_booking.status = 'cancelled' then
    if not p_captured then return 'BOOKING_INELIGIBLE'; end if;
    update public.payment_attempts a set status = 'successful', provider_payment_id = p_payment_id,
      succeeded_at = clock_timestamp(), provider_payload = jsonb_build_object('verified', true)
    where a.id = v_attempt.id;
    update public.payments p set status = 'paid', amount_paid = p.amount_due, paid_at = clock_timestamp()
    where p.id = v_payment.id;
    update public.bookings b set payment_status = 'paid' where b.id = v_booking.id;
    return 'CAPTURED_CANCELLED';
  end if;
  if v_booking.status <> 'payment_pending' or (not p_captured and v_booking.payment_pending_expires_at <= clock_timestamp()) then return 'BOOKING_INELIGIBLE'; end if;
  if v_payment.status = 'paid' then return 'ALREADY_FINALIZED'; end if;

  if p_captured then
    update public.payment_attempts a set status = 'successful', provider_payment_id = p_payment_id,
      succeeded_at = clock_timestamp(), provider_payload = jsonb_build_object('verified', true)
    where a.id = v_attempt.id;
    update public.payments p set status = 'paid', amount_paid = p.amount_due, paid_at = clock_timestamp()
    where p.id = v_payment.id;
    update public.bookings b set payment_status = 'paid', status = 'confirmed', confirmed_at = clock_timestamp()
    where b.id = v_booking.id;
    return 'FINALIZED';
  end if;

  if v_attempt.status = 'created' or v_attempt.status = 'authorized' then
    update public.payment_attempts a set status = 'failed', provider_payment_id = p_payment_id,
      failed_at = clock_timestamp(), provider_payload = jsonb_build_object('verified', true)
    where a.id = v_attempt.id;
    update public.payments p set status = 'failed' where p.id = v_payment.id and p.status <> 'paid';
    update public.bookings b set payment_status = 'failed' where b.id = v_booking.id and b.status = 'payment_pending';
  end if;
  return 'PAYMENT_FAILED';
end
$$;

revoke all on function public.begin_booking_payment_attempt(uuid) from public, anon, authenticated;
revoke all on function public.attach_booking_payment_order(uuid, text, text) from public, anon, authenticated;
revoke all on function public.fail_booking_payment_order(uuid, text) from public, anon, authenticated;
revoke all on function public.finalize_razorpay_payment(text, text, numeric, char, boolean) from public, anon, authenticated;
grant execute on function public.begin_booking_payment_attempt(uuid) to service_role;
grant execute on function public.attach_booking_payment_order(uuid, text, text) to service_role;
grant execute on function public.fail_booking_payment_order(uuid, text) to service_role;
grant execute on function public.finalize_razorpay_payment(text, text, numeric, char, boolean) to service_role;
