-- Local-only integration checks. All fixture rows are rolled back at the end.
begin;

insert into public.countries (id, iso2, name, currency_code, is_active)
values ('10000000-0000-4000-8000-000000000001', 'IN', 'India', 'INR', true);
insert into public.regions (id, country_id, kind, name, is_active)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'state', 'Maharashtra', true);
insert into public.cities (id, country_id, region_id, name, slug, timezone, is_active)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Mumbai', 'mumbai', 'Asia/Kolkata', true),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Pune', 'pune', 'Asia/Kolkata', true);
insert into public.locations (id, city_id, kind, name, is_active)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'airport', 'Test Airport', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'railway_station', 'Test Station', true);
insert into public.vehicle_categories (id, code, name, passenger_capacity, is_active)
values
  ('50000000-0000-4000-8000-000000000001', 'TEST', 'Test category', 4, true),
  ('50000000-0000-4000-8000-000000000002', 'INACTIVE', 'Inactive category', 4, false),
  ('50000000-0000-4000-8000-000000000003', 'UNAVAILABLE', 'Unavailable category', 4, true);
insert into public.city_vehicle_categories (city_id, vehicle_category_id, is_available)
values ('30000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', true);

insert into public.pricing_rules (
  id, vehicle_category_id, trip_type, package_tier, origin_city_id, origin_location_id,
  destination_city_id, destination_location_id, base_fare, included_hours, included_km,
  extra_km_rate, extra_hour_rate, driver_allowance_per_day, night_surcharge,
  airport_charge, tolls_charge, tax_rate_percent, currency_code, effective_from, is_active
) values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'local', '4hr_40km', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 1000, 4, 40, 10, 50, 5, 20, 100, 25, 18, 'INR', now() - interval '1 day', true),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 'local', '4hr_40km', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', null, 800, 4, 40, 10, 50, 5, 20, 100, 25, 18, 'INR', now() - interval '1 day', true),
  ('60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', 'local', '4hr_40km', '30000000-0000-4000-8000-000000000001', null, '30000000-0000-4000-8000-000000000002', null, 600, 4, 40, 10, 50, 5, 20, 100, 25, 18, 'INR', now() - interval '1 day', true),
  ('60000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000001', 'local', '4hr_40km', '30000000-0000-4000-8000-000000000001', null, null, null, 400, 4, 40, 10, 50, 5, 20, 100, 25, 18, 'INR', now() - interval '1 day', true);

do $$
declare v_status text; v_rule uuid; v_quote uuid; v_airport_quote uuid; v_expired_quote uuid; v_pricing jsonb; v_airport_pricing jsonb; v_booking jsonb; v_booking_again jsonb; v_expiry timestamptz; v_airport_pickup_at timestamptz;
begin
  select r.resolution_status, r.pricing_rule_id into v_status, v_rule
  from public.resolve_pricing_rule('50000000-0000-4000-8000-000000000001', 'local', '4hr_40km', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', now()) r;
  if v_status <> 'AVAILABLE' or v_rule <> '60000000-0000-4000-8000-000000000001' then raise exception 'Exact location pair priority failed'; end if;

  select r.resolution_status, r.pricing_rule_id into v_status, v_rule
  from public.resolve_pricing_rule('50000000-0000-4000-8000-000000000001', 'local', '4hr_40km', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', null, now()) r;
  if v_status <> 'AVAILABLE' or v_rule <> '60000000-0000-4000-8000-000000000002' then raise exception 'Origin location to city priority failed'; end if;

  select r.resolution_status, r.pricing_rule_id into v_status, v_rule
  from public.resolve_pricing_rule('50000000-0000-4000-8000-000000000001', 'local', '4hr_40km', '30000000-0000-4000-8000-000000000001', null, '30000000-0000-4000-8000-000000000002', null, now()) r;
  if v_status <> 'AVAILABLE' or v_rule <> '60000000-0000-4000-8000-000000000003' then raise exception 'City pair priority failed'; end if;

  select r.resolution_status, r.pricing_rule_id into v_status, v_rule
  from public.resolve_pricing_rule('50000000-0000-4000-8000-000000000001', 'local', '4hr_40km', '30000000-0000-4000-8000-000000000001', null, null, null, now()) r;
  if v_status <> 'AVAILABLE' or v_rule <> '60000000-0000-4000-8000-000000000004' then raise exception 'General local city priority failed'; end if;

  select r.resolution_status, r.pricing_rule_id into v_status, v_rule
  from public.resolve_pricing_rule('50000000-0000-4000-8000-000000000001', 'airport_transfer', 'airport_transfer', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', now()) r;
  if v_status <> 'AVAILABLE' or v_rule <> '60000000-0000-4000-8000-000000000001' then raise exception 'Airport transfer did not fall back to the configured local 4hr/40km rate'; end if;

  v_airport_pickup_at := (date_trunc('day', (now() at time zone 'Asia/Kolkata') + interval '1 day') + interval '12 hours') at time zone 'Asia/Kolkata';
  select q.result_status, q.quote_id, q.pricing into v_status, v_airport_quote, v_airport_pricing
  from public.create_booking_quote(
    'airport_transfer', 'airport_transfer', '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
    v_airport_pickup_at, '50000000-0000-4000-8000-000000000001', 3::smallint, 1::smallint, 7.6::numeric, 0.4::numeric
  ) q;
  if v_status <> 'CREATED'
    or v_airport_pricing->>'pricingRuleId' <> '60000000-0000-4000-8000-000000000001'
    or v_airport_pricing #>> '{components,total}' <> '1333.40' then
    raise exception 'Airport transfer quote did not use the server-calculated local fallback: %', v_airport_pricing;
  end if;

  select r.resolution_status into v_status
  from public.resolve_pricing_rule('50000000-0000-4000-8000-000000000001', 'airport_transfer', 'airport_transfer', '30000000-0000-4000-8000-000000000001', null, '30000000-0000-4000-8000-000000000002', null, now()) r;
  if v_status <> 'ONLINE_PRICING_UNAVAILABLE' then raise exception 'Airport transfer incorrectly used local pricing across cities'; end if;

  select r.resolution_status into v_status
  from public.resolve_pricing_rule('50000000-0000-4000-8000-000000000001', 'local', '8hr_80km', '30000000-0000-4000-8000-000000000001', null, null, null, now()) r;
  if v_status <> 'ONLINE_PRICING_UNAVAILABLE' then raise exception 'Strict package tier matching failed'; end if;

  select r.resolution_status into v_status
  from public.resolve_pricing_rule('50000000-0000-4000-8000-000000000002', 'local', '4hr_40km', '30000000-0000-4000-8000-000000000001', null, null, null, now()) r;
  if v_status <> 'ONLINE_PRICING_UNAVAILABLE' then raise exception 'Unavailable pricing status failed'; end if;

  select q.result_status, q.quote_id, q.pricing into v_status, v_quote, v_pricing
  from public.create_booking_quote(
    'local', '4hr_40km', '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
    now() + interval '1 day', '50000000-0000-4000-8000-000000000001', 2::smallint, 2::smallint, 50::numeric, 5::numeric
  ) q;
  if v_status <> 'CREATED' or v_pricing #>> '{components,total}' <> '1516.30' then raise exception 'Quote amount was not server-calculated as expected: %', v_pricing; end if;

  select q.result_status into v_status
  from public.create_booking_quote(
    'local', '4hr_40km', '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001', null,
    now() + interval '1 day', '50000000-0000-4000-8000-000000000003', 2::smallint, 1::smallint, null, null
  ) q;
  if v_status <> 'VEHICLE_UNAVAILABLE' then raise exception 'Inactive city vehicle availability was accepted'; end if;

  select q.result_status into v_status
  from public.create_booking_quote(
    'local', '4hr_40km', '40000000-0000-4000-8000-000000000099',
    null, null, now() + interval '1 day', '50000000-0000-4000-8000-000000000001', 2::smallint, 1::smallint, null, null
  ) q;
  if v_status <> 'INVALID_LOCATION' then raise exception 'Invalid/inactive location was accepted'; end if;

  select b.result_status, b.booking into v_status, v_booking
  from public.create_booking_from_quote(v_quote, 'test-idempotency-key-1', repeat('a',64), 'Test Guest', 'guest@example.com', '+919876543210', 'IN', null, null) b;
  if v_status <> 'CREATED' or v_booking->>'status' <> 'payment_pending' or v_booking->>'paymentStatus' <> 'pending' then raise exception 'Booking did not remain pending'; end if;

  select b.result_status, b.booking into v_status, v_booking_again
  from public.create_booking_from_quote(v_quote, 'test-idempotency-key-1', repeat('a',64), 'Test Guest', 'guest@example.com', '+919876543210', 'IN', null, null) b;
  if v_status <> 'REPLAYED' or v_booking_again->>'id' <> v_booking->>'id' then raise exception 'Idempotent retry did not return the original booking'; end if;

  select b.result_status into v_status
  from public.create_booking_from_quote(v_quote, 'test-idempotency-key-1', repeat('b',64), 'Other Guest', 'other@example.com', '+919876543211', 'IN', null, null) b;
  if v_status <> 'IDEMPOTENCY_CONFLICT' then raise exception 'Idempotency key reuse with changed request was accepted'; end if;

  select b.result_status into v_status
  from public.create_booking_from_quote(v_quote, 'second-key-for-quote', repeat('c',64), 'Other Guest', 'other@example.com', '+919876543211', 'IN', null, null) b;
  if v_status <> 'QUOTE_ALREADY_CLAIMED' then raise exception 'Converted quote was reused'; end if;

  if (select count(*) from public.bookings) <> 1 or (select count(*) from public.customers) <> 1 then raise exception 'Retry created duplicate customer or booking rows'; end if;

  v_expiry := now() - interval '5 minutes';
  insert into public.quotes (
    id, vehicle_category_id, trip_type, package_tier, origin_city_id, origin_location_id,
    pickup_at, passenger_count, pricing_rule_id, currency_code, subtotal, tax_amount,
    total_amount, pricing_snapshot, created_at, expires_at
  ) values (
    '70000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'local', '4hr_40km',
    '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', now() + interval '1 day',
    2, '60000000-0000-4000-8000-000000000001', 'INR', 100, 18, 118, '{}'::jsonb,
    v_expiry - interval '15 minutes', v_expiry
  );
  select b.result_status into v_status
  from public.create_booking_from_quote('70000000-0000-4000-8000-000000000001', 'expired-quote-key', repeat('d',64), 'Test Guest', 'guest@example.com', '+919876543210', 'IN', null, null) b;
  if v_status <> 'QUOTE_EXPIRED' or (select status from public.quotes where id = '70000000-0000-4000-8000-000000000001') <> 'expired' then raise exception 'Expired quote was not rejected and marked expired'; end if;

  if has_table_privilege('anon', 'public.quotes', 'SELECT') or has_table_privilege('anon', 'public.quotes', 'UPDATE')
    or has_table_privilege('authenticated', 'public.quotes', 'SELECT') or has_table_privilege('authenticated', 'public.quotes', 'UPDATE')
    or has_table_privilege('anon', 'public.customers', 'SELECT') or has_table_privilege('authenticated', 'public.bookings', 'SELECT') then
    raise exception 'Public access to protected customer, quote, or booking data is enabled';
  end if;
  if has_function_privilege('anon', 'public.create_booking_quote(public.trip_type,public.package_tier,uuid,uuid,uuid,timestamp with time zone,uuid,smallint,smallint,numeric,numeric)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.create_booking_quote(public.trip_type,public.package_tier,uuid,uuid,uuid,timestamp with time zone,uuid,smallint,smallint,numeric,numeric)', 'EXECUTE')
    or has_function_privilege('anon', 'public.create_booking_from_quote(uuid,text,text,text,text,text,character,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.create_booking_from_quote(uuid,text,text,text,text,text,character,text,text)', 'EXECUTE') then
    raise exception 'Guest or authenticated RPC execution is enabled';
  end if;
  if not has_function_privilege('service_role', 'public.create_booking_quote(public.trip_type,public.package_tier,uuid,uuid,uuid,timestamp with time zone,uuid,smallint,smallint,numeric,numeric)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.create_booking_from_quote(uuid,text,text,text,text,text,character,text,text)', 'EXECUTE') then
    raise exception 'Trusted backend RPC execution is not enabled';
  end if;
end
$$;

rollback;
