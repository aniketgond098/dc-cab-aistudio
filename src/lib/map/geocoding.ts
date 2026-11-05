export type GeocodingSuggestion = {
  id: string;
  name: string;
  placeFormatted?: string;
  coordinates: [number, number];
};

export interface GeocodingProvider {
  search(query: string, signal?: AbortSignal): Promise<GeocodingSuggestion[]>;
}

/**
 * Photon OpenStreetMap Geocoding Provider
 *
 * Open-source search powered by OpenStreetMap data.
 * Configurable via VITE_GEOCODING_API_URL for self-hosted instances or alternative providers
 * (e.g. Pelias, Nominatim, Photon).
 */
export class PhotonGeocodingProvider implements GeocodingProvider {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ??
      (import.meta.env["VITE_GEOCODING_API_URL"]?.trim() || "https://photon.komoot.io/api");
  }

  async search(query: string, signal?: AbortSignal): Promise<GeocodingSuggestion[]> {
    const trimmed = query.trim().replaceAll(";", " ");
    if (trimmed.length < 2) return [];

    const params = new URLSearchParams({
      q: trimmed,
      limit: "6",
      lang: "en",
    });

    const url = `${this.baseUrl.replace(/\/$/, "")}/?${params.toString()}`;
    const response = await fetch(url, {
      signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding request failed with status ${response.status}`);
    }

    const body = (await response.json()) as {
      features?: {
        properties?: {
          osm_id?: number | string;
          name?: string;
          city?: string;
          state?: string;
          country?: string;
          district?: string;
          street?: string;
        };
        geometry?: {
          coordinates?: number[];
        };
      }[];
    };

    if (!Array.isArray(body.features)) return [];

    return body.features.flatMap((feature, index) => {
      const coords = feature.geometry?.coordinates;
      if (
        !coords ||
        coords.length !== 2 ||
        typeof coords[0] !== "number" ||
        typeof coords[1] !== "number" ||
        !Number.isFinite(coords[0]) ||
        !Number.isFinite(coords[1])
      ) {
        return [];
      }

      const props = feature.properties ?? {};
      const name = props.name?.trim() || props.street?.trim();
      if (!name) return [];

      const contextParts = [props.city, props.state, props.country]
        .map((p) => p?.trim())
        .filter(Boolean);
      const placeFormatted = contextParts.join(", ");

      return [
        {
          id: String(props.osm_id ?? `osm-${index}-${coords[0]}-${coords[1]}`),
          name,
          ...(placeFormatted ? { placeFormatted } : {}),
          coordinates: [coords[0], coords[1]] as [number, number],
        },
      ];
    });
  }
}

export const defaultGeocodingProvider = new PhotonGeocodingProvider();
