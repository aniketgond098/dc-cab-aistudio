-- DC Cabs booking platform database foundation.
-- Deliberately contains no public pricing data or operational seed data.

create schema if not exists extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
grant usage on schema public to anon, authenticated, service_role;

do $$ begin create type public.region_kind as enum ('state','province','emirate','territory','region','canton'); exception when duplicate_object then null; end $$;
do $$ begin create type public.location_kind as enum ('airport','railway_station','bus_terminal','business_district','hotel','landmark','address','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.trip_type as enum ('local','outstation','airport_transfer','point_to_point','tour'); exception when duplicate_object then null; end $$;
do $$ begin create type public.package_tier as enum ('4hr_40km','8hr_80km','12hr_120km','outstation','airport_transfer','point_to_point','custom'); exception when duplicate_object then null; end $$;
do $$ begin create type public.quote_status as enum ('open','claimed','converted','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type public.booking_status as enum ('payment_pending','confirmed','driver_assigned','in_progress','completed','cancelled','abandoned_unpaid','refund_processed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.booking_payment_status as enum ('pending','paid','partially_refunded','refunded','failed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.vehicle_status as enum ('active','maintenance','inactive'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_provider as enum ('razorpay'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('pending','paid','failed','partially_refunded','refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_attempt_status as enum ('created','authorized','successful','failed','abandoned'); exception when duplicate_object then null; end $$;
do $$ begin create type public.admin_role as enum ('admin','operations','dispatch','finance'); exception when duplicate_object then null; end $$;
do $$ begin create type public.outbox_status as enum ('pending','processing','sent','failed'); exception when duplicate_object then null; end $$;

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  iso2 char(2) not null unique check (iso2 = upper(iso2)),
  iso3 char(3) unique check (iso3 is null or iso3 = upper(iso3)),
  name text not null check (length(trim(name)) > 0),
  currency_code char(3) check (currency_code is null or currency_code = upper(currency_code)),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete restrict,
  kind public.region_kind not null,
  code text,
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, kind, name),
  unique (id, country_id)
);

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete restrict,
  region_id uuid,
  name text not null check (length(trim(name)) > 0),
  slug text not null check (length(trim(slug)) > 0),
  timezone text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, slug),
  unique (id, country_id),
  foreign key (region_id, country_id) references public.regions(id, country_id) on delete restrict
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete restrict,
  kind public.location_kind not null default 'other',
  name text not null check (length(trim(name)) > 0),
  address text,
  latitude numeric(9,6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9,6) check (longitude is null or longitude between -180 and 180),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, name),
  unique (id, city_id)
);

create table if not exists public.vehicle_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  passenger_capacity smallint not null check (passenger_capacity > 0),
  luggage_capacity smallint check (luggage_capacity is null or luggage_capacity >= 0),
  display_order integer not null default 0,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.city_vehicle_categories (
  city_id uuid not null references public.cities(id) on delete restrict,
  vehicle_category_id uuid not null references public.vehicle_categories(id) on delete restrict,
  is_available boolean not null default false,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (city_id, vehicle_category_id),
  check (valid_until is null or valid_from is null or valid_until > valid_from)
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete restrict,
  vehicle_category_id uuid not null references public.vehicle_categories(id) on delete restrict,
  registration_number text not null unique,
  make text,
  model text,
  model_year smallint check (model_year is null or model_year between 1950 and 2200),
  status public.vehicle_status not null default 'inactive',
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, city_id)
);

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  vehicle_category_id uuid not null references public.vehicle_categories(id) on delete restrict,
  trip_type public.trip_type not null,
  package_tier public.package_tier not null,
  origin_city_id uuid not null references public.cities(id) on delete restrict,
  origin_location_id uuid,
  destination_city_id uuid references public.cities(id) on delete restrict,
  destination_location_id uuid,
  base_fare numeric(12,2) not null check (base_fare >= 0),
  included_hours numeric(7,2) check (included_hours is null or included_hours >= 0),
  included_km numeric(9,2) check (included_km is null or included_km >= 0),
  minimum_daily_km numeric(9,2) check (minimum_daily_km is null or minimum_daily_km >= 0),
  extra_km_rate numeric(12,2) not null default 0 check (extra_km_rate >= 0),
  extra_hour_rate numeric(12,2) not null default 0 check (extra_hour_rate >= 0),
  driver_allowance_per_day numeric(12,2) not null default 0 check (driver_allowance_per_day >= 0),
  night_surcharge numeric(12,2) not null default 0 check (night_surcharge >= 0),
  airport_charge numeric(12,2) not null default 0 check (airport_charge >= 0),
  tolls_charge numeric(12,2) not null default 0 check (tolls_charge >= 0),
  tax_rate_percent numeric(5,2) not null default 0 check (tax_rate_percent between 0 and 100),
  currency_code char(3) not null check (currency_code = upper(currency_code)),
  effective_from timestamptz not null,
  effective_until timestamptz,
  is_active boolean not null default false,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from),
  foreign key (origin_location_id, origin_city_id) references public.locations(id, city_id) on delete restrict,
  foreign key (destination_location_id, destination_city_id) references public.locations(id, city_id) on delete restrict,
  check (destination_location_id is null or destination_city_id is not null),
  check (
    (trip_type = 'local' and package_tier in ('4hr_40km','8hr_80km','12hr_120km','custom'))
    or (trip_type = 'outstation' and package_tier in ('outstation','custom'))
    or (trip_type = 'airport_transfer' and package_tier in ('airport_transfer','custom'))
    or (trip_type = 'point_to_point' and package_tier in ('point_to_point','custom'))
    or (trip_type = 'tour' and package_tier = 'custom')
  )
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null check (length(trim(full_name)) > 0),
  email text not null check (length(trim(email)) > 0),
  phone text not null check (length(trim(phone)) > 0),
  country_code char(2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  vehicle_category_id uuid not null references public.vehicle_categories(id) on delete restrict,
  trip_type public.trip_type not null,
  package_tier public.package_tier not null,
  origin_city_id uuid not null references public.cities(id) on delete restrict,
  origin_location_id uuid,
  destination_city_id uuid references public.cities(id) on delete restrict,
  destination_location_id uuid,
  pickup_at timestamptz not null,
  trip_days smallint not null default 1 check (trip_days > 0),
  passenger_count smallint not null check (passenger_count > 0),
  pricing_rule_id uuid not null references public.pricing_rules(id) on delete restrict,
  currency_code char(3) not null check (currency_code = upper(currency_code)),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  pricing_snapshot jsonb not null check (jsonb_typeof(pricing_snapshot) = 'object'),
  status public.quote_status not null default 'open',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  claimed_at timestamptz,
  converted_at timestamptz,
  check (expires_at = created_at + interval '15 minutes'),
  check (total_amount = subtotal + tax_amount),
  foreign key (origin_location_id, origin_city_id) references public.locations(id, city_id) on delete restrict,
  foreign key (destination_location_id, destination_city_id) references public.locations(id, city_id) on delete restrict,
  check (destination_location_id is null or destination_city_id is not null),
  check (
    (trip_type = 'local' and package_tier in ('4hr_40km','8hr_80km','12hr_120km','custom'))
    or (trip_type = 'outstation' and package_tier in ('outstation','custom'))
    or (trip_type = 'airport_transfer' and package_tier in ('airport_transfer','custom'))
    or (trip_type = 'point_to_point' and package_tier in ('point_to_point','custom'))
    or (trip_type = 'tour' and package_tier = 'custom')
  ),
  check (
    (status = 'open' and claimed_at is null and converted_at is null)
    or (status = 'claimed' and claimed_at is not null and converted_at is null)
    or (status = 'converted' and claimed_at is not null and converted_at is not null)
    or (status = 'expired' and claimed_at is null and converted_at is null)
  )
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  quote_id uuid not null unique references public.quotes(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_category_id uuid not null references public.vehicle_categories(id) on delete restrict,
  assigned_vehicle_id uuid references public.vehicles(id) on delete restrict,
  trip_type public.trip_type not null,
  package_tier public.package_tier not null,
  origin_city_id uuid not null references public.cities(id) on delete restrict,
  origin_location_id uuid,
  destination_city_id uuid references public.cities(id) on delete restrict,
  destination_location_id uuid,
  pickup_at timestamptz not null,
  trip_days smallint not null default 1 check (trip_days > 0),
  passenger_count smallint not null check (passenger_count > 0),
  currency_code char(3) not null check (currency_code = upper(currency_code)),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  pricing_snapshot jsonb not null check (jsonb_typeof(pricing_snapshot) = 'object'),
  status public.booking_status not null default 'payment_pending',
  payment_status public.booking_payment_status not null default 'pending',
  special_instructions text,
  cancellation_reason text,
  confirmed_at timestamptz,
  driver_assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  payment_pending_expires_at timestamptz not null default (now() + interval '60 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_amount = subtotal + tax_amount),
  foreign key (origin_location_id, origin_city_id) references public.locations(id, city_id) on delete restrict,
  foreign key (destination_location_id, destination_city_id) references public.locations(id, city_id) on delete restrict,
  check (destination_location_id is null or destination_city_id is not null),
  check (
    (trip_type = 'local' and package_tier in ('4hr_40km','8hr_80km','12hr_120km','custom'))
    or (trip_type = 'outstation' and package_tier in ('outstation','custom'))
    or (trip_type = 'airport_transfer' and package_tier in ('airport_transfer','custom'))
    or (trip_type = 'point_to_point' and package_tier in ('point_to_point','custom'))
    or (trip_type = 'tour' and package_tier = 'custom')
  ),
  check (payment_pending_expires_at = created_at + interval '60 minutes'),
  check (
    (status not in ('confirmed','driver_assigned','in_progress','completed') or confirmed_at is not null)
    and (status <> 'driver_assigned' or (driver_assigned_at is not null and assigned_vehicle_id is not null))
    and (status not in ('in_progress','completed') or started_at is not null)
    and (status <> 'completed' or completed_at is not null)
    and (status <> 'cancelled' or cancelled_at is not null)
  )
);

create table if not exists public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  old_status public.booking_status,
  new_status public.booking_status not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  provider public.payment_provider not null default 'razorpay',
  status public.payment_status not null default 'pending',
  currency_code char(3) not null check (currency_code = upper(currency_code)),
  amount_due numeric(12,2) not null check (amount_due >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  amount_refunded numeric(12,2) not null default 0 check (amount_refunded >= 0),
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_paid <= amount_due and amount_refunded <= amount_paid)
);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  provider public.payment_provider not null default 'razorpay',
  status public.payment_attempt_status not null default 'created',
  provider_order_id text not null,
  provider_payment_id text,
  amount numeric(12,2) not null check (amount >= 0),
  currency_code char(3) not null check (currency_code = upper(currency_code)),
  provider_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_payload) = 'object'),
  failure_code text,
  failure_description text,
  authorized_at timestamptz,
  succeeded_at timestamptz,
  failed_at timestamptz,
  abandoned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_id, attempt_number),
  unique (provider, provider_order_id),
  unique (provider, provider_payment_id),
  check (
    (status <> 'authorized' or authorized_at is not null)
    and (status <> 'successful' or succeeded_at is not null)
    and (status <> 'failed' or failed_at is not null)
    and (status <> 'abandoned' or abandoned_at is not null)
  )
);

create unique index if not exists payment_attempts_one_success_per_payment_idx
  on public.payment_attempts (payment_id) where status = 'successful';

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (length(trim(scope)) > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 255),
  request_hash text not null check (length(trim(request_hash)) > 0),
  resource_type text,
  resource_id uuid,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (scope, idempotency_key),
  check (expires_at is null or expires_at > created_at)
);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (length(trim(event_type)) > 0),
  aggregate_type text not null check (length(trim(aggregate_type)) > 0),
  aggregate_id uuid not null,
  idempotency_key text not null unique,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'processing') = (locked_at is not null)),
  check (status <> 'sent' or sent_at is not null)
);

create table if not exists public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.admin_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists regions_country_active_name_idx on public.regions (country_id, name) where is_active;
create index if not exists cities_country_active_name_idx on public.cities (country_id, name) where is_active;
create index if not exists cities_region_active_name_idx on public.cities (region_id, name) where is_active;
create index if not exists locations_city_active_name_idx on public.locations (city_id, name) where is_active;
create index if not exists city_vehicle_categories_available_idx on public.city_vehicle_categories (city_id, vehicle_category_id) where is_available;
create index if not exists vehicles_city_status_idx on public.vehicles (city_id, status, vehicle_category_id);
create index if not exists pricing_rules_exact_location_resolution_idx on public.pricing_rules (vehicle_category_id, trip_type, package_tier, origin_location_id, destination_location_id, effective_from desc) where is_active and origin_location_id is not null and destination_location_id is not null;
create index if not exists pricing_rules_origin_location_city_resolution_idx on public.pricing_rules (vehicle_category_id, trip_type, package_tier, origin_location_id, destination_city_id, effective_from desc) where is_active and origin_location_id is not null and destination_location_id is null and destination_city_id is not null;
create index if not exists pricing_rules_city_pair_resolution_idx on public.pricing_rules (vehicle_category_id, trip_type, package_tier, origin_city_id, destination_city_id, effective_from desc) where is_active and origin_location_id is null and destination_city_id is not null;
create index if not exists pricing_rules_city_general_resolution_idx on public.pricing_rules (vehicle_category_id, trip_type, package_tier, origin_city_id, effective_from desc) where is_active and origin_location_id is null and destination_city_id is null;
create index if not exists quotes_expiration_cleanup_idx on public.quotes (expires_at) where status = 'open';
create index if not exists bookings_status_created_idx on public.bookings (status, created_at desc);
create index if not exists bookings_payment_pending_expiry_idx on public.bookings (payment_pending_expires_at) where status = 'payment_pending';
create index if not exists bookings_pickup_at_idx on public.bookings (pickup_at) where status not in ('cancelled','abandoned_unpaid','completed','refund_processed');
create index if not exists booking_status_history_booking_created_idx on public.booking_status_history (booking_id, created_at desc);
create index if not exists payment_attempts_payment_created_idx on public.payment_attempts (payment_id, created_at desc);
create index if not exists idempotency_keys_expiration_idx on public.idempotency_keys (expires_at) where expires_at is not null;
create index if not exists notification_outbox_pending_idx on public.notification_outbox (available_at, created_at) where status in ('pending','failed');
create index if not exists notification_outbox_processing_idx on public.notification_outbox (locked_at) where status = 'processing';
create index if not exists admin_profiles_active_role_idx on public.admin_profiles (role, user_id) where is_active;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = pg_catalog
as $$ begin new.updated_at := clock_timestamp(); return new; end $$;
revoke all on function private.set_updated_at() from public, anon, authenticated;
grant execute on function private.set_updated_at() to service_role;

do $$
declare t text;
begin
  foreach t in array array['countries','regions','cities','locations','vehicle_categories','city_vehicle_categories','vehicles','pricing_rules','customers','bookings','payments','payment_attempts','notification_outbox','admin_profiles'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

create or replace function private.record_booking_status_change()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_status_history (booking_id, old_status, new_status, actor_user_id)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.booking_status_history (booking_id, old_status, new_status, actor_user_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;
revoke all on function private.record_booking_status_change() from public, anon, authenticated;
grant execute on function private.record_booking_status_change() to service_role;
drop trigger if exists record_booking_status_change on public.bookings;
create trigger record_booking_status_change after insert or update of status on public.bookings
for each row execute function private.record_booking_status_change();

-- Match only the requested category, trip type, package tier, and effective
-- date. Priority follows the approved four-level origin/destination hierarchy.
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
        and p_trip_type = 'local'
        and (v_destination_city_id is null or v_destination_city_id = v_origin_city_id))
    )
  order by case
    when r.origin_location_id is not null and r.destination_location_id is not null then 1
    when r.origin_location_id is not null and r.destination_city_id is not null then 2
    when r.origin_city_id = v_origin_city_id and r.destination_city_id is not null then 3
    else 4 end,
    r.effective_from desc, r.created_at desc, r.id
  limit 1;

  if v_rule_id is null then
    return query select 'ONLINE_PRICING_UNAVAILABLE'::text, null::uuid;
  else
    return query select 'AVAILABLE'::text, v_rule_id;
  end if;
end $$;
revoke all on function public.resolve_pricing_rule(uuid, public.trip_type, public.package_tier, uuid, uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_pricing_rule(uuid, public.trip_type, public.package_tier, uuid, uuid, uuid, uuid, timestamptz) to service_role;

-- Serialize competing claims. Expired quotes are marked expired; all other
-- non-open states remain unusable and are reported as ALREADY_CLAIMED.
create or replace function public.claim_quote_for_checkout(p_quote_id uuid)
returns table (claim_status text, quote_id uuid)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_quote public.quotes%rowtype;
  v_now timestamptz;
begin
  select q.* into v_quote from public.quotes q where q.id = p_quote_id for update;
  if not found then return query select 'NOT_FOUND'::text, p_quote_id; return; end if;
  -- Take the timestamp after the row lock is acquired so a concurrent waiter
  -- cannot use a pre-expiry timestamp after the quote expires while waiting.
  v_now := clock_timestamp();

  if v_quote.status = 'open' and v_quote.expires_at <= v_now then
    update public.quotes q set status = 'expired' where q.id = p_quote_id and q.status = 'open';
    return query select 'EXPIRED'::text, p_quote_id; return;
  end if;

  if v_quote.status <> 'open' then
    if v_quote.status = 'expired' then
      return query select 'EXPIRED'::text, p_quote_id;
    else
      return query select 'ALREADY_CLAIMED'::text, p_quote_id;
    end if;
    return;
  end if;

  update public.quotes q set status = 'claimed', claimed_at = v_now
  where q.id = p_quote_id and q.status = 'open' and q.expires_at > v_now;
  if found then return query select 'CLAIMED'::text, p_quote_id;
  else return query select 'EXPIRED'::text, p_quote_id; end if;
end $$;
revoke all on function public.claim_quote_for_checkout(uuid) from public, anon, authenticated;
grant execute on function public.claim_quote_for_checkout(uuid) to service_role;

alter table public.countries enable row level security;
alter table public.regions enable row level security;
alter table public.cities enable row level security;
alter table public.locations enable row level security;
alter table public.vehicle_categories enable row level security;
alter table public.city_vehicle_categories enable row level security;
alter table public.vehicles enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.customers enable row level security;
alter table public.quotes enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.admin_profiles enable row level security;

revoke all on table
  public.countries, public.regions, public.cities, public.locations,
  public.vehicle_categories, public.city_vehicle_categories, public.vehicles,
  public.pricing_rules, public.customers, public.quotes, public.bookings,
  public.booking_status_history, public.payments, public.payment_attempts,
  public.idempotency_keys, public.notification_outbox, public.admin_profiles
from public, anon, authenticated;

grant all on table
  public.countries, public.regions, public.cities, public.locations,
  public.vehicle_categories, public.city_vehicle_categories, public.vehicles,
  public.pricing_rules, public.customers, public.quotes, public.bookings,
  public.booking_status_history, public.payments, public.payment_attempts,
  public.idempotency_keys, public.notification_outbox, public.admin_profiles
to service_role;

grant select on table public.countries, public.regions, public.cities, public.locations,
  public.vehicle_categories, public.city_vehicle_categories to anon, authenticated;

drop policy if exists countries_public_active_select on public.countries;
create policy countries_public_active_select on public.countries
  for select to anon, authenticated using (is_active);
drop policy if exists regions_public_active_select on public.regions;
create policy regions_public_active_select on public.regions
  for select to anon, authenticated using (
    is_active and exists (select 1 from public.countries c where c.id = country_id and c.is_active)
  );
drop policy if exists cities_public_active_select on public.cities;
create policy cities_public_active_select on public.cities
  for select to anon, authenticated using (
    is_active and exists (select 1 from public.countries c where c.id = country_id and c.is_active)
    and (region_id is null or exists (select 1 from public.regions r where r.id = region_id and r.is_active))
  );
drop policy if exists locations_public_active_select on public.locations;
create policy locations_public_active_select on public.locations
  for select to anon, authenticated using (
    is_active and exists (select 1 from public.cities c where c.id = city_id and c.is_active)
  );
drop policy if exists vehicle_categories_public_active_select on public.vehicle_categories;
create policy vehicle_categories_public_active_select on public.vehicle_categories
  for select to anon, authenticated using (is_active);
drop policy if exists city_vehicle_categories_public_available_select on public.city_vehicle_categories;
create policy city_vehicle_categories_public_available_select on public.city_vehicle_categories
  for select to anon, authenticated using (
    is_available and (valid_from is null or valid_from <= now()) and (valid_until is null or valid_until > now())
    and exists (select 1 from public.cities c where c.id = city_id and c.is_active)
    and exists (select 1 from public.vehicle_categories v where v.id = vehicle_category_id and v.is_active)
  );

-- All transactional, pricing, fleet-unit, payment, staff and operational tables
-- have RLS enabled but no anon/authenticated policies or table grants.
