-- Airport transfers may use the existing Mumbai local 4hr/40km test rate when
-- no dedicated airport-transfer rule is configured. A dedicated rule always wins.
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
    and (
      (r.trip_type = p_trip_type and r.package_tier = p_package_tier)
      or (
        p_trip_type = 'airport_transfer'
        and p_package_tier = 'airport_transfer'
        and v_destination_city_id = v_origin_city_id
        and r.trip_type = 'local'
        and r.package_tier = '4hr_40km'
      )
    )
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
        and p_trip_type in ('local', 'airport_transfer')
        and (v_destination_city_id is null or v_destination_city_id = v_origin_city_id))
    )
  order by
    case when r.trip_type = p_trip_type and r.package_tier = p_package_tier then 0 else 1 end,
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
