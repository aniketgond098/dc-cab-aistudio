export type CatalogLocation = {
  id: string;
  city_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

const CATALOG_LOOKUP_ERROR = "DC Cabs locations are temporarily unavailable. Please try again.";

export class CatalogLookupError extends Error {
  constructor() {
    super(CATALOG_LOOKUP_ERROR);
    this.name = "CatalogLookupError";
  }
}

function isCatalogLocation(value: unknown): value is CatalogLocation {
  if (!value || typeof value !== "object") return false;
  const location = value as Record<string, unknown>;
  return (
    typeof location["id"] === "string" &&
    typeof location["city_id"] === "string" &&
    typeof location["name"] === "string" &&
    (typeof location["address"] === "string" || location["address"] === null) &&
    (typeof location["latitude"] === "number" || location["latitude"] === null) &&
    (typeof location["longitude"] === "number" || location["longitude"] === null)
  );
}

function distanceKm(a: [number, number], b: [number, number]) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const [lonA, latA] = a;
  const [lonB, latB] = b;
  const dLat = radians(latB - latA);
  const dLon = radians(lonB - lonA);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(latA)) * Math.cos(radians(latB)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export async function searchCatalogLocations(
  query: string,
  signal?: AbortSignal,
): Promise<CatalogLocation[]> {
  const params = new URLSearchParams({ search: query });
  try {
    const response = await fetch(
      `/api/v1/catalog/locations?${params}`,
      signal ? { signal } : undefined,
    );
    if (!response.ok) throw new CatalogLookupError();
    const body = (await response.json()) as { data?: unknown };
    if (!Array.isArray(body.data) || !body.data.every(isCatalogLocation))
      throw new CatalogLookupError();
    return body.data;
  } catch {
    throw new CatalogLookupError();
  }
}

export async function findCatalogMatch(query: string, point: [number, number]) {
  const locations = await searchCatalogLocations(query);
  const candidates = locations.filter(
    (entry) => entry.latitude !== null && entry.longitude !== null,
  );
  const closest = candidates
    .map((entry) => ({
      entry,
      distance: distanceKm(point, [Number(entry.longitude), Number(entry.latitude)]),
    }))
    .sort((a, b) => a.distance - b.distance)[0];
  return closest && closest.distance <= 0.1 ? closest.entry : null;
}
