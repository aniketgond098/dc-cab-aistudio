-- Set coordinates for active Mumbai bookable locations using the named OSM feature geometry.
-- Source: © OpenStreetMap contributors, https://www.openstreetmap.org/copyright (ODbL).
-- OSM object references: Terminal 1 way 61569813; Terminal 2 way 315613914;
-- Mumbai Central node 2630075008; Bandra Terminus way 107303403;
-- BKC node 1640262758; Colaba node 1640184983.
-- Coordinates represent the mapped terminal/station/building or named district/place,
-- not fabricated route or address-level points. Preserve existing IDs and relationships.
do $$
declare
  updated_count integer;
begin
  with coordinate_updates (name, kind, latitude, longitude) as (
    values
      ('Mumbai Airport Terminal 1', 'airport'::public.location_kind, 19.092617::numeric, 72.855744::numeric),
      ('Mumbai Airport Terminal 2', 'airport'::public.location_kind, 19.097777::numeric, 72.874347::numeric),
      ('Mumbai Central', 'railway_station'::public.location_kind, 18.969586::numeric, 72.819315::numeric),
      ('Bandra Terminus', 'railway_station'::public.location_kind, 19.064672::numeric, 72.841661::numeric),
      ('Bandra Kurla Complex (BKC)', 'business_district'::public.location_kind, 19.067115::numeric, 72.865725::numeric),
      ('Colaba', 'landmark'::public.location_kind, 18.915091::numeric, 72.825969::numeric)
  )
  update public.locations as location
  set latitude = coordinate_updates.latitude,
      longitude = coordinate_updates.longitude,
      updated_at = now()
  from coordinate_updates, public.cities as city
  where location.city_id = city.id
    and city.slug = 'mumbai'
    and city.is_active
    and location.name = coordinate_updates.name
    and location.kind = coordinate_updates.kind
    and location.is_active
    and location.latitude is null
    and location.longitude is null;

  get diagnostics updated_count = row_count;
  if updated_count <> 6 then
    raise exception 'Expected to populate 6 active Mumbai catalog locations; updated %', updated_count;
  end if;
end
$$;
