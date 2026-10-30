import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { JourneyLocation } from "./LocationSearch";

const MAPBOX_TOKEN = import.meta.env["VITE_MAPBOX_ACCESS_TOKEN"];

export type RouteEstimate = { distanceKm: number; durationHours: number };

export function BookingRouteMap({
  pickup,
  destination,
  onRoute,
}: {
  pickup: JourneyLocation | null;
  destination: JourneyLocation | null;
  onRoute: (estimate: RouteEstimate | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState("");
  const [routeError, setRouteError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const coordinatesUnavailable = Boolean(
    (pickup && !pickup.coordinates) || (destination && !destination.coordinates),
  );

  useEffect(() => {
    onRoute(null);
    setMapError("");
    setRouteError("");
    setMapReady(false);
    if (!MAPBOX_TOKEN || !containerRef.current) return;
    let disposed = false;
    let map: import("mapbox-gl").Map | null = null;
    let pickupMarker: import("mapbox-gl").Marker | null = null;
    let destinationMarker: import("mapbox-gl").Marker | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const pickupCoordinates = pickup?.coordinates ?? null;
    const destinationCoordinates = destination?.coordinates ?? null;
    if ((pickup && !pickupCoordinates) || (destination && !destinationCoordinates)) return;
    if (!pickupCoordinates && !destinationCoordinates) return;

    void import("mapbox-gl")
      .then((module) => {
        if (disposed || !containerRef.current) return;
        const mapboxgl = module.default;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        const center = pickupCoordinates ?? destinationCoordinates;
        if (!center) return;
        map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center,
          zoom: 11,
          attributionControl: true,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        pickupMarker = new mapboxgl.Marker({ color: "#d12b36" });
        destinationMarker = new mapboxgl.Marker({ color: "#f2eee8" });
        const showMapError = () => {
          if (!disposed) {
            setMapReady(false);
            onRoute(null);
            setMapError(
              "The route preview is temporarily unavailable. You can continue with your booking.",
            );
          }
        };
        map.on("error", showMapError);
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            const container = containerRef.current;
            if (container && container.clientWidth > 0 && container.clientHeight > 0) map?.resize();
          });
          resizeObserver.observe(containerRef.current);
        }
        map.once("load", () => {
          if (disposed || !map) return;
          try {
            setMapError("");
            setRouteError("");
            map.resize();
            window.requestAnimationFrame(() => {
              if (!disposed) map?.resize();
            });
            if (pickupCoordinates) pickupMarker?.setLngLat(pickupCoordinates).addTo(map);
            if (destinationCoordinates)
              destinationMarker?.setLngLat(destinationCoordinates).addTo(map);
            setMapReady(true);
            if (pickupCoordinates && destinationCoordinates) {
              const coordinates = `${pickupCoordinates.join(",")};${destinationCoordinates.join(",")}`;
              const params = new URLSearchParams({
                geometries: "geojson",
                overview: "full",
                steps: "false",
                access_token: MAPBOX_TOKEN,
              });
              void fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params}`,
              )
                .then(async (response) => {
                  if (!response.ok)
                    throw new Error(
                      "The route preview is temporarily unavailable. You can continue with your booking.",
                    );
                  const body = (await response.json()) as {
                    routes?: {
                      distance: number;
                      duration: number;
                      geometry: { type: "LineString"; coordinates: [number, number][] };
                    }[];
                  };
                  const route = body.routes?.[0];
                  if (!route || route.geometry.coordinates.length < 2 || disposed || !map)
                    throw new Error(
                      "The route preview is temporarily unavailable. You can continue with your booking.",
                    );
                  map.addSource("dc-route", { type: "geojson", data: route.geometry });
                  map.addLayer({
                    id: "dc-route-line",
                    type: "line",
                    source: "dc-route",
                    layout: { "line-join": "round", "line-cap": "round" },
                    paint: { "line-color": "#d12b36", "line-width": 5, "line-opacity": 0.92 },
                  });
                  const bounds = route.geometry.coordinates.reduce(
                    (bounds, point) => bounds.extend(point),
                    new mapboxgl.LngLatBounds(
                      route.geometry.coordinates[0],
                      route.geometry.coordinates[0],
                    ),
                  );
                  map.fitBounds(bounds, { padding: 58, maxZoom: 13, duration: 700 });
                  setMapReady(true);
                  setRouteError("");
                  onRoute({
                    distanceKm: route.distance / 1000,
                    durationHours: route.duration / 3600,
                  });
                })
                .catch(() => {
                  if (!disposed) {
                    setRouteError(
                      "The route preview is temporarily unavailable. You can continue with your booking.",
                    );
                    onRoute(null);
                  }
                });
            } else {
              map.flyTo({ center, zoom: 13, duration: 600 });
              setMapReady(true);
            }
          } catch {
            showMapError();
            onRoute(null);
          }
        });
      })
      .catch(() => {
        if (!disposed)
          setMapError(
            "The route preview is temporarily unavailable. You can continue with your booking.",
          );
      });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      pickupMarker?.remove();
      destinationMarker?.remove();
      map?.remove();
    };
  }, [pickup, destination, onRoute, retryCount]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex min-h-[300px] items-center justify-center border border-border bg-[radial-gradient(ellipse_at_center,_#242326_0%,_#131315_70%)] p-8 text-center md:min-h-[360px]">
        <div>
          <p className="eyebrow text-primary">Journey preview</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Your route preview is unavailable right now. You can still choose your locations and
            continue to your fare.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[300px] overflow-hidden border border-border bg-charcoal md:min-h-[360px]">
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" aria-label="Interactive route map" />
      </div>
      {!pickup && !destination ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/55 p-8 text-center">
          <p className="max-w-sm text-sm text-foreground/80">
            Select your pickup and destination to preview your journey.
          </p>
        </div>
      ) : null}
      {coordinatesUnavailable ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/80 p-8 text-center">
          <p className="max-w-sm text-sm leading-relaxed text-foreground/80">
            A route preview is not available for this journey yet. You can continue to get your
            fare.
          </p>
        </div>
      ) : null}
      {mapError ? (
        <div
          role="status"
          className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,_#242326_0%,_#131315_70%)] p-8 text-center"
        >
          <div>
            <p className="eyebrow text-primary">Journey preview</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {mapError}
            </p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary underline underline-offset-4"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}
      {routeError && !mapError ? (
        <p
          role="status"
          className="absolute bottom-3 left-3 max-w-[80%] bg-background/90 px-3 py-2 text-xs text-foreground"
        >
          {routeError}{" "}
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="ml-2 underline underline-offset-2"
          >
            Retry
          </button>
        </p>
      ) : null}
      {pickup && destination && !mapReady && !mapError && !coordinatesUnavailable ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-charcoal/70 p-8 text-center">
          <p role="status" className="text-sm text-muted-foreground">
            Loading your route preview…
          </p>
        </div>
      ) : null}
    </div>
  );
}
