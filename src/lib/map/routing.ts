export type RouteGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

export type TrafficCondition = "light" | "moderate" | "heavy";

export type RouteEstimate = {
  distanceKm: number;
  durationHours: number;
  geometry: RouteGeometry;
};

export interface RoutingProvider {
  getRoute(
    origin: [number, number],
    destination: [number, number],
    signal?: AbortSignal | [number, number][],
    stops?: [number, number][],
  ): Promise<RouteEstimate>;
}

/**
 * Calculates realistic traffic-aware travel duration in hours.
 *
 * In Indian metropolitan and regional driving (Mumbai, Pune, Delhi, Bengaluru):
 * - Raw theoretical road limits (OSRM default) assume unobstructed 60-80 km/h cruising.
 * - In reality, city driving speeds average 18-25 km/h during daytime, 12-18 km/h during peak
 *   rush hours (8:30-11:30 & 17:00-20:30 IST), and 30-35 km/h during late night.
 * - Outstation routes include city exit/entry buffers (20 km/h) plus expressway cruising (~65 km/h).
 */
export function calculateTrafficAwareDuration(
  distanceKm: number,
  baseDurationHours: number,
  pickupDateOrIso?: string | Date,
): { trafficDurationHours: number; trafficCondition: TrafficCondition; trafficDelayMinutes: number } {
  let hour = 12;
  try {
    const d = pickupDateOrIso ? new Date(pickupDateOrIso) : new Date();
    if (!Number.isNaN(d.getTime())) {
      hour = parseInt(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: "Asia/Kolkata",
        }).format(d),
        10,
      );
    }
  } catch {
    hour = 12;
  }

  const isPeakHour = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 20);
  const isNight = hour >= 23 || hour <= 5;

  let trafficCondition: TrafficCondition = "moderate";
  let multiplier = 1.35;

  if (isPeakHour) {
    trafficCondition = "heavy";
    multiplier = 1.6;
  } else if (isNight) {
    trafficCondition = "light";
    multiplier = 1.1;
  }

  let realisticDuration = baseDurationHours * multiplier;

  // City routes (under 40 km): enforce realistic Indian urban speed ceilings
  if (distanceKm <= 40) {
    const maxUrbanSpeed = isNight ? 32 : (isPeakHour ? 18 : 24);
    const minTimeHours = distanceKm / maxUrbanSpeed;
    realisticDuration = Math.max(realisticDuration, minTimeHours);
  } else {
    // Outstation: 25 km city exit @ 20 km/h + expressway @ 65 km/h
    const cityExitHours = 25 / (isNight ? 28 : 20);
    const highwayHours = (distanceKm - 25) / 65;
    const highwayTotal = (cityExitHours + highwayHours) * (isNight ? 1.05 : 1.15);
    realisticDuration = Math.max(realisticDuration, highwayTotal);
  }

  const roundedDuration = Math.round(realisticDuration * 100) / 100;
  const delayMinutes = Math.max(0, Math.round((roundedDuration - baseDurationHours) * 60));

  return {
    trafficDurationHours: roundedDuration,
    trafficCondition,
    trafficDelayMinutes: delayMinutes,
  };
}

/**
 * Open Source Routing Machine (OSRM) Provider
 *
 * Uses the OSRM driving profile for road network paths. Configurable via VITE_ROUTING_API_URL.
 */
export class OsrmRoutingProvider implements RoutingProvider {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ??
      (import.meta.env["VITE_ROUTING_API_URL"]?.trim() ||
        "https://router.project-osrm.org/route/v1/driving");
  }

  async getRoute(
    origin: [number, number],
    destination: [number, number],
    signalOrStops?: AbortSignal | [number, number][],
    stops?: [number, number][],
  ): Promise<RouteEstimate> {
    const signal =
      signalOrStops && "aborted" in signalOrStops ? signalOrStops : undefined;
    const rawStops = Array.isArray(signalOrStops) ? signalOrStops : stops;
    const validStops = (rawStops ?? []).filter(
      (s): s is [number, number] =>
        Array.isArray(s) &&
        s.length === 2 &&
        Number.isFinite(s[0]) &&
        Number.isFinite(s[1]),
    );
    const allCoords = [origin, ...validStops, destination];
    const coords = allCoords.map((c) => `${c[0]},${c[1]}`).join(";");
    const url = `${this.baseUrl.replace(/\/$/, "")}/${coords}?overview=full&geometries=geojson&steps=false`;

    const response = await fetch(url, {
      signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Routing request failed with HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      code?: string;
      routes?: {
        distance: number;
        duration: number;
        geometry: {
          type: "LineString";
          coordinates: [number, number][];
        };
      }[];
    };

    if (body.code !== "Ok" || !body.routes?.[0]) {
      throw new Error("No route found between selected coordinates");
    }

    const primaryRoute = body.routes[0];
    if (
      !primaryRoute.geometry?.coordinates ||
      primaryRoute.geometry.coordinates.length < 2
    ) {
      throw new Error("Invalid route geometry returned");
    }

    const distanceKm = primaryRoute.distance / 1000;
    const durationHours = primaryRoute.duration / 3600;

    return {
      distanceKm,
      durationHours,
      geometry: primaryRoute.geometry,
    };
  }
}

export const defaultRoutingProvider = new OsrmRoutingProvider();
