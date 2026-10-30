-- Phase 5A temporary test data for the Asian Paints client rate card.
-- TEST ONLY: these prices are not approved DC Cabs public pricing.
-- Idempotent upserts use stable UUIDs so this seed can be reapplied safely.
-- Effective only from 2026-10-25 through 2026-12-31 (UTC).

begin;

insert into public.countries (id, iso2, iso3, name, currency_code, is_active)
values ('a0000000-0000-4000-8000-000000000001', 'IN', 'IND', 'India', 'INR', true)
on conflict (id) do update set
  iso2 = excluded.iso2,
  iso3 = excluded.iso3,
  name = excluded.name,
  currency_code = excluded.currency_code,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.regions (id, country_id, kind, code, name, is_active)
values ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'state', 'MH', 'Maharashtra', true)
on conflict (id) do update set
  country_id = excluded.country_id,
  kind = excluded.kind,
  code = excluded.code,
  name = excluded.name,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.cities (id, country_id, region_id, name, slug, timezone, is_active)
values ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'Mumbai', 'mumbai', 'Asia/Kolkata', true)
on conflict (id) do update set
  country_id = excluded.country_id,
  region_id = excluded.region_id,
  name = excluded.name,
  slug = excluded.slug,
  timezone = excluded.timezone,
  is_active = excluded.is_active,
  updated_at = now();

-- The existing resolver requires an explicit destination city for outstation pricing.
insert into public.cities (id, country_id, region_id, name, slug, timezone, is_active)
values ('a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'Pune', 'pune', 'Asia/Kolkata', true)
on conflict (id) do update set
  country_id = excluded.country_id,
  region_id = excluded.region_id,
  name = excluded.name,
  slug = excluded.slug,
  timezone = excluded.timezone,
  is_active = excluded.is_active,
  updated_at = now();

-- Coordinates identify the named feature locations. Source: OpenStreetMap contributors
-- (ODbL), objects listed in the production data migration 20261026000100.
insert into public.locations (id, city_id, kind, name, latitude, longitude, is_active)
values
  ('a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000003', 'airport', 'Mumbai Airport Terminal 1', 19.092617, 72.855744, true),
  ('a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000003', 'airport', 'Mumbai Airport Terminal 2', 19.097777, 72.874347, true),
  ('a0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000003', 'railway_station', 'Mumbai Central', 18.969586, 72.819315, true),
  ('a0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000003', 'railway_station', 'Bandra Terminus', 19.064672, 72.841661, true),
  ('a0000000-0000-4000-8000-000000000105', 'a0000000-0000-4000-8000-000000000003', 'business_district', 'Bandra Kurla Complex (BKC)', 19.067115, 72.865725, true),
  ('a0000000-0000-4000-8000-000000000106', 'a0000000-0000-4000-8000-000000000003', 'landmark', 'Colaba', 18.915091, 72.825969, true)
on conflict (id) do update set
  city_id = excluded.city_id,
  kind = excluded.kind,
  name = excluded.name,
  address = null,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  is_active = excluded.is_active,
  updated_at = now();

-- Passenger capacities are required by the existing schema; no vehicle inventory is created.
insert into public.vehicle_categories (id, code, name, passenger_capacity, luggage_capacity, display_order, is_active)
values
  ('a0000000-0000-4000-8000-000000000010', 'SEDAN', 'Sedan', 4, null, 1, true),
  ('a0000000-0000-4000-8000-000000000011', 'SUV', 'SUV', 6, null, 2, true),
  ('a0000000-0000-4000-8000-000000000012', 'SUV_PREMIUM', 'SUV Premium', 6, null, 3, true)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  passenger_capacity = excluded.passenger_capacity,
  luggage_capacity = excluded.luggage_capacity,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.city_vehicle_categories (city_id, vehicle_category_id, is_available, valid_from, valid_until)
values
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000010', true, '2026-10-25 00:00:00+00', '2027-01-01 00:00:00+00'),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000011', true, '2026-10-25 00:00:00+00', '2027-01-01 00:00:00+00'),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000012', true, '2026-10-25 00:00:00+00', '2027-01-01 00:00:00+00')
on conflict (city_id, vehicle_category_id) do update set
  is_available = excluded.is_available,
  valid_from = excluded.valid_from,
  valid_until = excluded.valid_until,
  updated_at = now();

-- Local packages are city-wide in Mumbai. Outstation test pricing is scoped to Mumbai–Pune
-- because the existing resolver requires a destination city for non-local trips.
insert into public.pricing_rules (
  id, vehicle_category_id, trip_type, package_tier, origin_city_id, destination_city_id,
  base_fare, included_hours, included_km, minimum_daily_km,
  extra_km_rate, extra_hour_rate, driver_allowance_per_day,
  night_surcharge, airport_charge, tolls_charge, tax_rate_percent,
  currency_code, effective_from, effective_until, is_active, internal_notes
)
values
  ('a0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000010', 'local', '4hr_40km', 'a0000000-0000-4000-8000-000000000003', null, 1100, 4, 40, null, 15, 140, 0, 0, 0, 0, 0, 'INR', '2026-10-25 00:00:00+00', '2027-01-01 00:00:00+00', true, 'Asian Paints temporary client rate card — TEST ONLY; not approved DC Cabs public pricing. Effective 2026-10-25 through 2026-12-31.'),
  ('a0000000-0000-4000-8000-000000000202', 'a0000000-0000-4000-8000-000000000011', 'local', '4hr_40km', 'a0000000-0000-4000-8000-000000000003', null, 1500, 4, 40, null, 17, 190, 0, 0, 0, 0, 0, 'INR', '2026-10-25 00:00:00+00', '2027-01-01 00:00:00+00', true, 'Asian Paints temporary client rate card — TEST ONLY; not approved DC Cabs public pricing. Effective 2026-10-25 through 2026-12-31.'),
  ('a0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000012', 'local', '4hr_40km', 'a0000000-0000-4000-8000-000000000003', null, 1850, 4, 40, null, 20, 220, 0, 0, 0, 0, 0, 'INR', '2026-10-25 00:00:00+00', '2027-01-01 00:00:00+00', true, 'Asian Paints temporary client rate card — TEST ONLY; not approved DC Cabs public pricing. Effective 2026-10-25 through 2026-12-31.'),
  ('a0000000-0000-4000-8000-000000000204', 'a0000000-0000-4000-8000-000000000010', 'local', '8hr_80km', 'a0000000-0000-4000-8000-000000000003', null, 1700, 8, 80, null, 15, 140, 0, 0, 0, 0, 0, 'INR', '2026-10-25 00:00:00+00', '2027-01-01 00:00:00+00', true, 'Asian Paints temporary client rate card — TEST ONLY; not approved DC Cabs public pricing. Effective 2026-10-25 through 2026-12-31.'),
  ('a0000000-0000-4000-8000-000000000205', 'a0000000-0000-4000-8000-000000000011', 'local', '8hr_80km', 'a0000000-0000-4000-8000-000000000003', null, 2500, 8, 80, null, 17, 190, 0, 0, 0, 0, 0, 'INR', '2026-10-25 00:00:00+00', '2027-01-01 00:00:00+00', true, 'Asian Paints temporary client rate card — TEST ONLY; not approved DC Cabs public pricing. Effective 2026-10-25 through 2026-12-31.'),
  ('a0000000-0000-4000-8000-000000000206', 'a0000000-0000-4000-8000-000000000012', 'local', '8hr_80km', 'a0000000-0000-4000-8000-000000000003', null, 3000, 8, 80, null, 20, 220, 0, 0, 0, 0, 0, 'INR', '2026-10-25 00:00:00+00', '2027-01-01 00:00:00+00', true, 'Asian Paints temporary client rate card — TEST ONLY; not approved DC Cabs public pricing. Effective 2026-10-25 through 2026-12-31.'),
  ('a0000000-0000-4000-8000-000000000207', 'a0000000-0000-4000-8000-000000000010', 'outstation', 'outstation', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 4500, null, 300, 300, 15, 0, 500, 0, 0, 0, 0, 'INR', '2026-10-25 00:00:00+00', '2027-01-01 00:00:00+00', true, 'Asian Paints temporary client rate card — TEST ONLY; not approved DC Cabs public pricing. Effective 2026-10-25 through 2026-12-31.'),
  ('a0000000-0000-4000-8000-000000000208', 'a0000000-0000-4000-8000-000000000011', 'outstation', 'outstation', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 5100, null, 300, 300, 17, 0, 500, 0, 0, 0, 0, 'INR', '2026-10-25 00:00:00+00', '2027-01-01 00:00:00+00', true, 'Asian Paints temporary client rate card — TEST ONLY; not approved DC Cabs public pricing. Effective 2026-10-25 through 2026-12-31.'),
  ('a0000000-0000-4000-8000-000000000209', 'a0000000-0000-4000-8000-000000000012', 'outstation', 'outstation', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 6000, null, 300, 300, 20, 0, 500, 0, 0, 0, 0, 'INR', '2026-10-25 00:00:00+00', '2027-01-01 00:00:00+00', true, 'Asian Paints temporary client rate card — TEST ONLY; not approved DC Cabs public pricing. Effective 2026-10-25 through 2026-12-31.')
on conflict (id) do update set
  vehicle_category_id = excluded.vehicle_category_id,
  trip_type = excluded.trip_type,
  package_tier = excluded.package_tier,
  origin_city_id = excluded.origin_city_id,
  origin_location_id = null,
  destination_city_id = excluded.destination_city_id,
  destination_location_id = null,
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

commit;
