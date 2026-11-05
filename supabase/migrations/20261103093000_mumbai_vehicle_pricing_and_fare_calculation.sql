-- Migration: Mumbai-specific vehicle categories, fixed pricing rules, and automatic fare calculation
-- Implements verified Mumbai vehicle categories, airport transfer, local rental (4hr/40km, 8hr/80km),
-- and outstation pricing rules with night surcharge (₹150 between 22:00 and 06:00 Asia/Kolkata).

begin;

-- 1. Ensure Mumbai vehicle categories exist with verified capacities and active status
insert into public.vehicle_categories (id, code, name, passenger_capacity, luggage_capacity, display_order, is_active)
values
  ('a0000000-0000-4000-8000-000000000010', 'MUMBAI_SEDAN', 'Sedan', 4, 2, 1, true),
  ('a0000000-0000-4000-8000-000000000011', 'MUMBAI_SUV', 'SUV', 6, 4, 2, true),
  ('a0000000-0000-4000-8000-000000000013', 'MUMBAI_PREMIUM_SUV', 'Premium SUV', 7, 4, 3, true),
  ('a0000000-0000-4000-8000-000000000014', 'MUMBAI_HYCROSS_INVICTO', 'Innova Hycross / Maruti Suzuki Invicto', 7, 4, 4, true),
  ('a0000000-0000-4000-8000-000000000015', 'MUMBAI_EXCLUSIVE_SUV', 'Exclusive SUV', 7, 4, 5, true),
  ('a0000000-0000-4000-8000-000000000016', 'MUMBAI_PREMIUM_SEDAN', 'Premium Sedan', 4, 3, 6, true),
  ('a0000000-0000-4000-8000-000000000012', 'MUMBAI_LUXURY_SEDAN', 'Luxury Sedan', 4, 3, 7, true),
  ('a0000000-0000-4000-8000-000000000017', 'MUMBAI_LUXURY_VAN', 'Luxury Van', 7, 6, 8, true),
  ('a0000000-0000-4000-8000-000000000018', 'MUMBAI_GROUP_COACH', 'Group / Coach', 45, 45, 9, true)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  passenger_capacity = excluded.passenger_capacity,
  luggage_capacity = excluded.luggage_capacity,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

-- 2. Link all Mumbai vehicle categories to Mumbai city
insert into public.city_vehicle_categories (city_id, vehicle_category_id, is_available, valid_from, valid_until)
values
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000010', true, now() - interval '1 day', null),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000011', true, now() - interval '1 day', null),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000013', true, now() - interval '1 day', null),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000014', true, now() - interval '1 day', null),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000015', true, now() - interval '1 day', null),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000016', true, now() - interval '1 day', null),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000012', true, now() - interval '1 day', null),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000017', true, now() - interval '1 day', null),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000018', true, now() - interval '1 day', null)
on conflict (city_id, vehicle_category_id) do update set
  is_available = excluded.is_available,
  valid_from = excluded.valid_from,
  valid_until = excluded.valid_until,
  updated_at = now();

-- 3. Upsert Mumbai-specific fixed pricing rules (Categories 1–3)
-- Airport Transfers (30 km / 2 hours included)
insert into public.pricing_rules (
  id, vehicle_category_id, trip_type, package_tier, origin_city_id, destination_city_id,
  base_fare, included_hours, included_km, minimum_daily_km,
  extra_km_rate, extra_hour_rate, driver_allowance_per_day,
  night_surcharge, airport_charge, tolls_charge, tax_rate_percent,
  currency_code, effective_from, effective_until, is_active, internal_notes
) values
  -- Sedan (Dzire / Alma) Airport Transfer: ₹1,199 base (30 km, 2 hrs), extra: ₹15/km, ₹150/hr, night: ₹150
  ('a0000000-0000-4000-8000-000000000501', 'a0000000-0000-4000-8000-000000000010', 'airport_transfer', 'airport_transfer',
   'a0000000-0000-4000-8000-000000000003', null,
   1199, 2, 30, null, 15, 150, 0, 150, 0, 0, 0, 'INR', '2026-01-01 00:00:00+00', null, true,
   'Mumbai Airport Transfer - Sedan (Dzire / Alma). Includes 30 km and 2 hrs. Extra: ₹15/km, ₹150/hr.'),

  -- SUV (Ertiga group) Airport Transfer: ₹1,899 base (30 km, 2 hrs), extra: ₹17/km, ₹175/hr, night: ₹150
  ('a0000000-0000-4000-8000-000000000502', 'a0000000-0000-4000-8000-000000000011', 'airport_transfer', 'airport_transfer',
   'a0000000-0000-4000-8000-000000000003', null,
   1899, 2, 30, null, 17, 175, 0, 150, 0, 0, 0, 'INR', '2026-01-01 00:00:00+00', null, true,
   'Mumbai Airport Transfer - SUV (Ertiga group). Includes 30 km and 2 hrs. Extra: ₹17/km, ₹175/hr.'),

  -- Premium SUV (Innova Crysta) Airport Transfer: ₹2,499 base (30 km, 2 hrs), extra: ₹21/km, ₹210/hr, night: ₹150
  ('a0000000-0000-4000-8000-000000000503', 'a0000000-0000-4000-8000-000000000013', 'airport_transfer', 'airport_transfer',
   'a0000000-0000-4000-8000-000000000003', null,
   2499, 2, 30, null, 21, 210, 0, 150, 0, 0, 0, 'INR', '2026-01-01 00:00:00+00', null, true,
   'Mumbai Airport Transfer - Premium SUV (Innova Crysta). Includes 30 km and 2 hrs. Extra: ₹21/km, ₹210/hr.'),

  -- Local Rentals 4hr / 40km
  -- Sedan: ₹1,449 base (40 km, 4 hrs), extra: ₹15/km, ₹150/hr, night: ₹150
  ('a0000000-0000-4000-8000-000000000504', 'a0000000-0000-4000-8000-000000000010', 'local', '4hr_40km',
   'a0000000-0000-4000-8000-000000000003', null,
   1449, 4, 40, null, 15, 150, 0, 150, 0, 0, 0, 'INR', '2026-01-01 00:00:00+00', null, true,
   'Mumbai Local Rental 4hr/40km - Sedan (Dzire / Alma). Extra: ₹15/km, ₹150/hr.'),

  -- SUV: ₹2,199 base (40 km, 4 hrs), extra: ₹17/km, ₹175/hr, night: ₹150
  ('a0000000-0000-4000-8000-000000000505', 'a0000000-0000-4000-8000-000000000011', 'local', '4hr_40km',
   'a0000000-0000-4000-8000-000000000003', null,
   2199, 4, 40, null, 17, 175, 0, 150, 0, 0, 0, 'INR', '2026-01-01 00:00:00+00', null, true,
   'Mumbai Local Rental 4hr/40km - SUV (Ertiga group). Extra: ₹17/km, ₹175/hr.'),

  -- Premium SUV: ₹2,599 base (40 km, 4 hrs), extra: ₹21/km, ₹210/hr, night: ₹150
  ('a0000000-0000-4000-8000-000000000506', 'a0000000-0000-4000-8000-000000000013', 'local', '4hr_40km',
   'a0000000-0000-4000-8000-000000000003', null,
   2599, 4, 40, null, 21, 210, 0, 150, 0, 0, 0, 'INR', '2026-01-01 00:00:00+00', null, true,
   'Mumbai Local Rental 4hr/40km - Premium SUV (Innova Crysta). Extra: ₹21/km, ₹210/hr.'),

  -- Local Rentals 8hr / 80km
  -- Sedan: ₹2,499 base (80 km, 8 hrs), extra: ₹15/km, ₹150/hr, night: ₹150
  ('a0000000-0000-4000-8000-000000000507', 'a0000000-0000-4000-8000-000000000010', 'local', '8hr_80km',
   'a0000000-0000-4000-8000-000000000003', null,
   2499, 8, 80, null, 15, 150, 0, 150, 0, 0, 0, 'INR', '2026-01-01 00:00:00+00', null, true,
   'Mumbai Local Rental 8hr/80km - Sedan (Dzire / Alma). Extra: ₹15/km, ₹150/hr.'),

  -- SUV: ₹3,249 base (80 km, 8 hrs), extra: ₹17/km, ₹175/hr, night: ₹150
  ('a0000000-0000-4000-8000-000000000508', 'a0000000-0000-4000-8000-000000000011', 'local', '8hr_80km',
   'a0000000-0000-4000-8000-000000000003', null,
   3249, 8, 80, null, 17, 175, 0, 150, 0, 0, 0, 'INR', '2026-01-01 00:00:00+00', null, true,
   'Mumbai Local Rental 8hr/80km - SUV (Ertiga group). Extra: ₹17/km, ₹175/hr.'),

  -- Premium SUV: ₹3,499 base (80 km, 8 hrs), extra: ₹21/km, ₹210/hr, night: ₹150
  ('a0000000-0000-4000-8000-000000000509', 'a0000000-0000-4000-8000-000000000013', 'local', '8hr_80km',
   'a0000000-0000-4000-8000-000000000003', null,
   3499, 8, 80, null, 21, 210, 0, 150, 0, 0, 0, 'INR', '2026-01-01 00:00:00+00', null, true,
   'Mumbai Local Rental 8hr/80km - Premium SUV (Innova Crysta). Extra: ₹21/km, ₹210/hr.'),

  -- Outstation (300 km min billing, applicable per-km rate, ₹150 night charge)
  -- Sedan: ₹4,500 base (300 km min billing), ₹15/km, ₹450/day driver allowance
  ('a0000000-0000-4000-8000-000000000510', 'a0000000-0000-4000-8000-000000000010', 'outstation', 'outstation',
   'a0000000-0000-4000-8000-000000000003', null,
   4500, null, 300, 300, 15, 0, 450, 150, 0, 0, 0, 'INR', '2026-01-01 00:00:00+00', null, true,
   'Configured calculated rate: 300 km min billing @ ₹15/km + ₹450/day driver allowance.'),

  -- SUV: ₹5,100 base (300 km min billing), ₹17/km, driver allowance unconfigured (0)
  ('a0000000-0000-4000-8000-000000000511', 'a0000000-0000-4000-8000-000000000011', 'outstation', 'outstation',
   'a0000000-0000-4000-8000-000000000003', null,
   5100, null, 300, 300, 17, 0, 0, 150, 0, 0, 0, 'INR', '2026-01-01 00:00:00+00', null, true,
   'Configured calculated rate: 300 km min billing @ ₹17/km. Driver allowance unconfigured until confirmed.'),

  -- Premium SUV: ₹6,300 base (300 km min billing), ₹21/km, driver allowance unconfigured (0)
  ('a0000000-0000-4000-8000-000000000512', 'a0000000-0000-4000-8000-000000000013', 'outstation', 'outstation',
   'a0000000-0000-4000-8000-000000000003', null,
   6300, null, 300, 300, 21, 0, 0, 150, 0, 0, 0, 'INR', '2026-01-01 00:00:00+00', null, true,
   'Configured calculated rate: 300 km min billing @ ₹21/km. Driver allowance unconfigured until confirmed.')
on conflict (id) do update set
  vehicle_category_id = excluded.vehicle_category_id,
  trip_type = excluded.trip_type,
  package_tier = excluded.package_tier,
  origin_city_id = excluded.origin_city_id,
  destination_city_id = excluded.destination_city_id,
  base_fare = excluded.base_fare,
  included_hours = excluded.included_hours,
  included_km = excluded.included_km,
  minimum_daily_km = excluded.minimum_daily_km,
  extra_km_rate = excluded.extra_km_rate,
  extra_hour_rate = excluded.extra_hour_rate,
  driver_allowance_per_day = excluded.driver_allowance_per_day,
  night_surcharge = excluded.night_surcharge,
  airport_charge = excluded.airport_charge,
  tolls_charge = excluded.tolls_charge,
  tax_rate_percent = excluded.tax_rate_percent,
  currency_code = excluded.currency_code,
  effective_from = excluded.effective_from,
  effective_until = excluded.effective_until,
  is_active = excluded.is_active,
  internal_notes = excluded.internal_notes,
  updated_at = now();

-- 4. Pricing rule resolution:
-- Airport transfers must ONLY match airport transfer rules.
-- Local packages must ONLY match local package rules.
-- Outstation rules can match any outstation destination originating in Mumbai.
create or replace function public.resolve_pricing_rule(
  p_vehicle_category_id uuid, p_trip_type public.trip_type, p_package_tier public.package_tier,
  p_origin_city_id uuid, p_origin_location_id uuid, p_destination_city_id uuid,
  p_destination_location_id uuid, p_at timestamptz
)
returns table (resolution_status text, pricing_rule_id uuid)
language plpgsql security definer set search_path = pg_catalog, public, private
as $$
declare
  v_origin_city_id uuid := p_origin_city_id;
  v_destination_city_id uuid := p_destination_city_id;
  v_location_city_id uuid;
  v_rule_id uuid;
begin
  if p_vehicle_category_id is null or p_trip_type is null or p_package_tier is null or p_at is null then
    return query select 'ONLINE_PRICING_UNAVAILABLE'::text, null::uuid; return;
  end if;

  if p_origin_location_id is not null then
    select l.city_id into v_location_city_id from public.locations l
    where l.id = p_origin_location_id and l.is_active;
    if not found or (v_origin_city_id is not null and v_origin_city_id <> v_location_city_id) then
      return query select 'ONLINE_PRICING_UNAVAILABLE'::text, null::uuid; return;
    end if;
    v_origin_city_id := v_location_city_id;
  end if;

  if p_destination_location_id is not null then
    select l.city_id into v_location_city_id from public.locations l
    where l.id = p_destination_location_id and l.is_active;
    if not found or (v_destination_city_id is not null and v_destination_city_id <> v_location_city_id) then
      return query select 'ONLINE_PRICING_UNAVAILABLE'::text, null::uuid; return;
    end if;
    v_destination_city_id := v_location_city_id;
  end if;

  if v_origin_city_id is null then
    return query select 'ONLINE_PRICING_UNAVAILABLE'::text, null::uuid; return;
  end if;

  if not exists (select 1 from public.vehicle_categories c where c.id = p_vehicle_category_id and c.is_active)
    or not exists (select 1 from public.cities c where c.id = v_origin_city_id and c.is_active)
    or (v_destination_city_id is not null and not exists (
      select 1 from public.cities c where c.id = v_destination_city_id and c.is_active
    )) then
    return query select 'ONLINE_PRICING_UNAVAILABLE'::text, null::uuid; return;
  end if;

  select r.id into v_rule_id from public.pricing_rules r
  where r.is_active
    and r.vehicle_category_id = p_vehicle_category_id
    and r.trip_type = p_trip_type
    and r.package_tier = p_package_tier
    and r.effective_from <= p_at
    and (r.effective_until is null or p_at < r.effective_until)
    and (
      (p_origin_location_id is not null and p_destination_location_id is not null
        and r.origin_location_id = p_origin_location_id
        and r.destination_location_id = p_destination_location_id)
      or (p_origin_location_id is not null and v_destination_city_id is not null
        and r.origin_location_id = p_origin_location_id
        and r.destination_location_id is null and r.destination_city_id = v_destination_city_id)
      or (r.origin_location_id is null and r.origin_city_id = v_origin_city_id
        and r.destination_location_id is null and r.destination_city_id = v_destination_city_id
        and v_destination_city_id is not null)
      or (r.origin_location_id is null and r.origin_city_id = v_origin_city_id
        and r.destination_location_id is null and r.destination_city_id is null
        and p_trip_type in ('local', 'airport_transfer', 'outstation'))
    )
  order by
    case
      when r.origin_location_id is not null and r.destination_location_id is not null then 1
      when r.origin_location_id is not null and r.destination_city_id is not null then 2
      when r.origin_city_id = v_origin_city_id and r.destination_city_id is not null then 3
      else 4
    end,
    r.effective_from desc, r.created_at desc, r.id
  limit 1;

  if v_rule_id is null then
    return query select 'ONLINE_PRICING_UNAVAILABLE'::text, null::uuid;
  else
    return query select 'AVAILABLE'::text, v_rule_id;
  end if;
end $$;

-- 5. Atomic Quote Creation with exact Mumbai calculations
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
  v_pickup_hour integer;
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

  -- Ensure vehicle category exists, is active, and accommodates requested passenger count
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

  -- Resolve pricing rule
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

  -- Calculate distance and duration extra charges
  if p_trip_type = 'outstation' then
    -- Outstation formula:
    -- Billable distance = max(actual distance, 300 km)
    -- Distance fare = billable distance * per-km rate
    -- base_fare is configured as 300 * extra_km_rate
    v_extra_km := round(greatest(0,
      coalesce(p_estimated_distance_km, 0) - coalesce(v_rule.included_km, 300)
    ) * v_rule.extra_km_rate, 2);
    v_extra_hour := 0;
  else
    v_extra_km := round(greatest(0,
      coalesce(p_estimated_distance_km, 0) - coalesce(v_rule.included_km, 0)
    ) * v_rule.extra_km_rate, 2);
    v_extra_hour := round(greatest(0,
      coalesce(p_estimated_duration_hours, 0) - coalesce(v_rule.included_hours, 0)
    ) * v_rule.extra_hour_rate, 2);
  end if;

  -- Driver allowance (e.g. ₹450/day for Dzire outstation)
  v_driver_allowance := round(v_rule.driver_allowance_per_day * p_trip_days, 2);

  -- Night charge (₹150 if pickup is between 22:00 and 06:00 in origin city timezone)
  v_pickup_hour := extract(hour from (p_pickup_at at time zone v_timezone));
  if v_pickup_hour >= 22 or v_pickup_hour < 6 then
    v_night_charge := v_rule.night_surcharge;
  end if;

  v_airport_charge := v_rule.airport_charge;
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
    'allowances', jsonb_build_object(
      'includedKm', v_rule.included_km,
      'includedHours', v_rule.included_hours,
      'extraKmRate', v_rule.extra_km_rate,
      'extraHourRate', v_rule.extra_hour_rate,
      'driverAllowancePerDay', v_rule.driver_allowance_per_day,
      'nightSurcharge', v_rule.night_surcharge
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

commit;
