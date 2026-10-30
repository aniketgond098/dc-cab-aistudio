-- Phase 3B: database-atomic quote pricing and idempotent guest booking drafts.
-- No rate, location, or vehicle data is seeded by this migration.

alter table public.customers
  add column company_name text check (company_name is null or length(trim(company_name)) between 1 and 160);

create or replace function public.create_booking_quote(
  p_trip_type public.trip_type,
  p_package_tier public.package_tier,
  p_origin_location_id uuid,
  p_destination_city_id uuid,
  p_destination_location_id uuid,
  p_pickup_at timestamptz,
  p_vehicle_category_id uuid,
  p_passenger_count smallint,
  p_trip_days smallint,
  p_estimated_distance_km numeric,
  p_estimated_duration_hours numeric
)
returns table (result_status text, quote_id uuid, pricing jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_origin_city_id uuid;
  v_destination_city_id uuid := p_destination_city_id;
  v_origin_kind public.location_kind;
  v_destination_kind public.location_kind;
  v_timezone text;
  v_rule_id uuid;
  v_rule public.pricing_rules%rowtype;
  v_resolution text;
  v_new_quote_id uuid;
  v_extra_km numeric(12,2) := 0;
  v_extra_hour numeric(12,2) := 0;
  v_driver_allowance numeric(12,2) := 0;
  v_night_charge numeric(12,2) := 0;
  v_airport_charge numeric(12,2) := 0;
  v_tolls_charge numeric(12,2) := 0;
  v_subtotal numeric(12,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
  v_breakdown jsonb;
begin
  if p_trip_type is null or p_package_tier is null or p_origin_location_id is null
    or p_pickup_at is null or p_vehicle_category_id is null or p_passenger_count is null
    or p_trip_days is null or p_passenger_count < 1 or p_trip_days < 1
    or (p_estimated_distance_km is not null and p_estimated_distance_km < 0)
    or (p_estimated_duration_hours is not null and p_estimated_duration_hours < 0) then
    return query select 'INVALID_REQUEST'::text, null::uuid, null::jsonb; return;
  end if;
  if p_pickup_at <= clock_timestamp() then
    return query select 'INVALID_REQUEST'::text, null::uuid, null::jsonb; return;
  end if;

  select l.city_id, l.kind into v_origin_city_id, v_origin_kind
  from public.locations l where l.id = p_origin_location_id and l.is_active;
  if not found then
    return query select 'INVALID_LOCATION'::text, null::uuid, null::jsonb; return;
  end if;

  if p_destination_location_id is not null then
    select l.city_id, l.kind into v_destination_city_id, v_destination_kind
    from public.locations l where l.id = p_destination_location_id and l.is_active;
    if not found or (p_destination_city_id is not null and p_destination_city_id <> v_destination_city_id) then
      return query select 'INVALID_LOCATION'::text, null::uuid, null::jsonb; return;
    end if;
  end if;
  if v_destination_city_id is not null then
    if not exists (
      select 1
      from public.cities c
      join public.countries co on co.id = c.country_id and co.is_active
      left join public.regions r on r.id = c.region_id and r.country_id = c.country_id
      where c.id = v_destination_city_id and c.is_active
        and (c.region_id is null or r.is_active)
    ) then
      return query select 'INVALID_LOCATION'::text, null::uuid, null::jsonb; return;
    end if;
  end if;

  select c.timezone into v_timezone
  from public.cities c
  join public.countries co on co.id = c.country_id and co.is_active
  left join public.regions r on r.id = c.region_id and r.country_id = c.country_id
  where c.id = v_origin_city_id and c.is_active
    and (c.region_id is null or r.is_active);
  if not found then
    return query select 'INVALID_LOCATION'::text, null::uuid, null::jsonb; return;
  end if;

  if not exists (
    select 1 from public.vehicle_categories c
    join public.city_vehicle_categories cv on cv.vehicle_category_id = c.id
    where c.id = p_vehicle_category_id and c.is_active
      and p_passenger_count <= c.passenger_capacity
      and cv.city_id = v_origin_city_id and cv.is_available
      and (cv.valid_from is null or cv.valid_from <= p_pickup_at)
      and (cv.valid_until is null or cv.valid_until > p_pickup_at)
  ) then
    return query select 'VEHICLE_UNAVAILABLE'::text, null::uuid, null::jsonb; return;
  end if;

  select r.resolution_status, r.pricing_rule_id into v_resolution, v_rule_id
  from public.resolve_pricing_rule(
    p_vehicle_category_id, p_trip_type, p_package_tier, v_origin_city_id,
    p_origin_location_id, v_destination_city_id, p_destination_location_id, p_pickup_at
  ) r;
  if v_resolution is distinct from 'AVAILABLE' or v_rule_id is null then
    return query select 'ONLINE_PRICING_UNAVAILABLE'::text, null::uuid, null::jsonb; return;
  end if;

  select r.* into v_rule from public.pricing_rules r where r.id = v_rule_id;
  if v_rule.extra_km_rate > 0 and p_estimated_distance_km is null then
    return query select 'DISTANCE_REQUIRED'::text, null::uuid, null::jsonb; return;
  end if;
  if v_rule.extra_hour_rate > 0 and p_estimated_duration_hours is null then
    return query select 'DURATION_REQUIRED'::text, null::uuid, null::jsonb; return;
  end if;

  v_extra_km := round(greatest(0,
    coalesce(p_estimated_distance_km, 0) - coalesce(v_rule.included_km, 0)
  ) * v_rule.extra_km_rate, 2);
  v_extra_hour := round(greatest(0,
    coalesce(p_estimated_duration_hours, 0) - coalesce(v_rule.included_hours, 0)
  ) * v_rule.extra_hour_rate, 2);
  v_driver_allowance := round(v_rule.driver_allowance_per_day * p_trip_days, 2);
  if extract(hour from (p_pickup_at at time zone v_timezone)) >= 22
    or extract(hour from (p_pickup_at at time zone v_timezone)) < 6 then
    v_night_charge := v_rule.night_surcharge;
  end if;
  if p_trip_type = 'airport_transfer'
    or v_origin_kind = 'airport' or v_destination_kind = 'airport' then
    v_airport_charge := v_rule.airport_charge;
  end if;
  v_tolls_charge := v_rule.tolls_charge;

  v_subtotal := round(v_rule.base_fare + v_extra_km + v_extra_hour
    + v_driver_allowance + v_night_charge + v_airport_charge + v_tolls_charge, 2);
  v_tax := round(v_subtotal * v_rule.tax_rate_percent / 100, 2);
  v_total := v_subtotal + v_tax;
  v_breakdown := jsonb_build_object(
    'currency', v_rule.currency_code,
    'pricingRuleId', v_rule.id,
    'components', jsonb_build_object(
      'baseFare', v_rule.base_fare,
      'extraDistance', v_extra_km,
      'extraDuration', v_extra_hour,
      'driverAllowance', v_driver_allowance,
      'nightSurcharge', v_night_charge,
      'airportCharge', v_airport_charge,
      'tolls', v_tolls_charge,
      'subtotal', v_subtotal,
      'taxRatePercent', v_rule.tax_rate_percent,
      'tax', v_tax,
      'total', v_total
    ),
    'inputs', jsonb_build_object(
      'distanceKm', p_estimated_distance_km,
      'durationHours', p_estimated_duration_hours,
      'tripDays', p_trip_days
    )
  );

  insert into public.quotes (
    vehicle_category_id, trip_type, package_tier, origin_city_id, origin_location_id,
    destination_city_id, destination_location_id, pickup_at, trip_days, passenger_count,
    pricing_rule_id, currency_code, subtotal, tax_amount, total_amount, pricing_snapshot
  ) values (
    p_vehicle_category_id, p_trip_type, p_package_tier, v_origin_city_id, p_origin_location_id,
    v_destination_city_id, p_destination_location_id, p_pickup_at, p_trip_days, p_passenger_count,
    v_rule_id, v_rule.currency_code, v_subtotal, v_tax, v_total, v_breakdown
  ) returning id into v_new_quote_id;

  return query select 'CREATED'::text, v_new_quote_id, v_breakdown;
end
$$;

create or replace function public.create_booking_from_quote(
  p_quote_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_country_code char(2),
  p_company_name text,
  p_special_instructions text
)
returns table (result_status text, booking jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_existing public.idempotency_keys%rowtype;
  v_claim_status text;
  v_customer_id uuid;
  v_booking_id uuid;
  v_booking_reference text;
  v_quote public.quotes%rowtype;
  v_response jsonb;
begin
  if p_quote_id is null or p_idempotency_key is null or length(trim(p_idempotency_key)) not between 1 and 255
    or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_full_name is null or length(trim(p_full_name)) not between 1 and 120
    or p_email is null or length(trim(p_email)) not between 3 and 254
    or p_phone is null or length(trim(p_phone)) not between 7 and 32
    or (p_country_code is not null and p_country_code !~ '^[A-Z]{2}$')
    or (p_company_name is not null and length(trim(p_company_name)) not between 1 and 160)
    or (p_special_instructions is not null and length(trim(p_special_instructions)) > 1000) then
    return query select 'INVALID_REQUEST'::text, null::jsonb; return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('booking.create:' || p_idempotency_key, 0));
  select k.* into v_existing from public.idempotency_keys k
  where k.scope = 'booking.create' and k.idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_hash <> p_request_hash then
      return query select 'IDEMPOTENCY_CONFLICT'::text, null::jsonb; return;
    end if;
    if v_existing.response_body is not null then
      return query select 'REPLAYED'::text, v_existing.response_body; return;
    end if;
    return query select 'IN_PROGRESS'::text, null::jsonb; return;
  end if;

  select c.claim_status into v_claim_status
  from public.claim_quote_for_checkout(p_quote_id) c;
  if v_claim_status = 'EXPIRED' then
    return query select 'QUOTE_EXPIRED'::text, null::jsonb; return;
  elsif v_claim_status = 'NOT_FOUND' then
    return query select 'QUOTE_NOT_FOUND'::text, null::jsonb; return;
  elsif v_claim_status <> 'CLAIMED' then
    return query select 'QUOTE_ALREADY_CLAIMED'::text, null::jsonb; return;
  end if;

  select q.* into v_quote from public.quotes q where q.id = p_quote_id;
  insert into public.customers (full_name, email, phone, country_code, company_name)
  values (trim(p_full_name), lower(trim(p_email)), trim(p_phone), p_country_code, nullif(trim(p_company_name), ''))
  returning id into v_customer_id;

  v_booking_id := gen_random_uuid();
  v_booking_reference := 'DC-' || upper(substr(replace(v_booking_id::text, '-', ''), 1, 16));
  insert into public.bookings (
    id, booking_reference, quote_id, customer_id, vehicle_category_id, trip_type, package_tier,
    origin_city_id, origin_location_id, destination_city_id, destination_location_id,
    pickup_at, trip_days, passenger_count, currency_code, subtotal, tax_amount, total_amount,
    pricing_snapshot, status, payment_status, special_instructions
  ) values (
    v_booking_id, v_booking_reference, v_quote.id, v_customer_id, v_quote.vehicle_category_id,
    v_quote.trip_type, v_quote.package_tier, v_quote.origin_city_id, v_quote.origin_location_id,
    v_quote.destination_city_id, v_quote.destination_location_id, v_quote.pickup_at, v_quote.trip_days,
    v_quote.passenger_count, v_quote.currency_code, v_quote.subtotal, v_quote.tax_amount,
    v_quote.total_amount, v_quote.pricing_snapshot, 'payment_pending', 'pending', nullif(trim(p_special_instructions), '')
  );
  update public.quotes q set status = 'converted', converted_at = clock_timestamp()
  where q.id = v_quote.id and q.status = 'claimed';

  v_response := jsonb_build_object(
    'id', v_booking_id,
    'bookingReference', v_booking_reference,
    'quoteId', v_quote.id,
    'status', 'payment_pending',
    'paymentStatus', 'pending',
    'currency', v_quote.currency_code,
    'subtotal', v_quote.subtotal,
    'tax', v_quote.tax_amount,
    'total', v_quote.total_amount
  );
  insert into public.idempotency_keys (
    scope, idempotency_key, request_hash, resource_type, resource_id,
    response_status, response_body
  ) values (
    'booking.create', p_idempotency_key, p_request_hash, 'booking', v_booking_id,
    201, v_response
  );
  return query select 'CREATED'::text, v_response;
end
$$;

revoke all on function public.create_booking_quote(
  public.trip_type, public.package_tier, uuid, uuid, uuid, timestamptz, uuid, smallint, smallint, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.create_booking_quote(
  public.trip_type, public.package_tier, uuid, uuid, uuid, timestamptz, uuid, smallint, smallint, numeric, numeric
) to service_role;

revoke all on function public.create_booking_from_quote(uuid, text, text, text, text, text, char, text, text)
  from public, anon, authenticated;
grant execute on function public.create_booking_from_quote(uuid, text, text, text, text, text, char, text, text)
  to service_role;
