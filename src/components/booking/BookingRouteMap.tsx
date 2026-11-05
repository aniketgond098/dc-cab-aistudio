import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { JourneyLocation } from "./LocationSearch";
import { getMapStyle } from "@/lib/map/style";
import { defaultRoutingProvider, type RouteEstimate, type RoutingProvider } from "@/lib/map/routing";

export type { RouteEstimate };

function createPickupMarkerElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "dc-map-marker-pickup relative flex items-center justify-center";
  el.style.width = "28px";
  el.style.height = "28px";
  el.setAttribute("aria-label", "Pickup location");

  // Subtle pulsing radar ring
  const pulse = document.createElement("div");
  pulse.className = "absolute inset-0 rounded-full bg-white/20 animate-ping";
  pulse.style.animationDuration = "2.8s";

  // Outer silver/white ring
  const ring = document.createElement("div");
  ring.className =
    "relative flex items-center justify-center size-5 rounded-full border-2 border-foreground bg-charcoal shadow-lg";

  // Center white dot
  const dot = document.createElement("div");
  dot.className = "size-2 rounded-full bg-foreground";

  ring.appendChild(dot);
  el.appendChild(pulse);
  el.appendChild(ring);
  return el;
}

function createDestinationMarkerElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "dc-map-marker-dest relative flex flex-col items-center justify-center";
  el.style.width = "32px";
  el.style.height = "38px";
  el.setAttribute("aria-label", "Destination location");

  // Custom SVG teardrop pin in DC Red with subtle glow
  el.innerHTML = `
    <svg width="28" height="34" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-[0_4px_10px_rgba(209,43,54,0.45)]">
      <path d="M14 0C6.268 0 0 6.268 0 14C0 23.6 12.3 32.9 12.8 33.3C13.1 33.6 13.5 33.8 14 33.8C14.5 33.8 14.9 33.6 15.2 33.3C15.7 32.9 28 23.6 28 14C28 6.268 21.732 0 14 0Z" fill="#d12b36"/>
      <circle cx="14" cy="13" r="5" fill="#f2eee8"/>
    </svg>
  `;
  return el;
}

function createStopMarkerElement(index: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "dc-map-marker-stop relative flex items-center justify-center";
  el.style.width = "26px";
  el.style.height = "26px";
  el.setAttribute("aria-label", `Stop ${index}`);

  const ring = document.createElement("div");
  ring.className =
    "relative flex items-center justify-center size-6 rounded-full border border-primary bg-charcoal text-foreground text-[10px] font-bold shadow-md";
  ring.textContent = String(index);

  el.appendChild(ring);
  return el;
}

const EMPTY_STOPS: JourneyLocation[] = [];

export function BookingRouteMap({
  pickup,
  destination,
  stops,
  onRoute,
  routingProvider = defaultRoutingProvider,
}: {
  pickup: JourneyLocation | null;
  destination: JourneyLocation | null;
  stops?: JourneyLocation[];
  onRoute: (estimate: RouteEstimate | null) => void;
  routingProvider?: RoutingProvider;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const pickupMarkerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const destinationMarkerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const stopMarkersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const routeAbortRef = useRef<AbortController | null>(null);

  const [mapError, setMapError] = useState("");
  const [routeError, setRouteError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const onRouteRef = useRef(onRoute);
  useEffect(() => {
    onRouteRef.current = onRoute;
  });

  const activeStops = stops ?? EMPTY_STOPS;
  const pickupCoordinates = pickup?.coordinates ?? null;
  const destinationCoordinates = destination?.coordinates ?? null;
  const stopCoordinates = activeStops
    .map((s) => s?.coordinates ?? null)
    .filter((c): c is [number, number] => Boolean(c));

  const pickupKey = pickupCoordinates ? `${pickupCoordinates[0]},${pickupCoordinates[1]}` : "";
  const destinationKey = destinationCoordinates
    ? `${destinationCoordinates[0]},${destinationCoordinates[1]}`
    : "";
  const stopsKey = stopCoordinates.map((c) => `${c[0]},${c[1]}`).join(";");

  const coordinatesUnavailable = Boolean(
    (pickup && !pickupCoordinates) ||
      (destination && !destinationCoordinates) ||
      activeStops.some((s) => s && !s.coordinates),
  );

  // If coordinates are explicitly unavailable or journey is cleared, clear route immediately
  useEffect(() => {
    if (coordinatesUnavailable || (!pickup && !destination)) {
      onRouteRef.current(null);
    }
  }, [coordinatesUnavailable, pickup, destination]);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    if ((pickup && !pickupCoordinates) || (destination && !destinationCoordinates)) return;
    if (!pickupCoordinates && !destinationCoordinates) return;

    const center = pickupCoordinates ?? destinationCoordinates;
    if (!center) return;

    routeAbortRef.current?.abort();

    const applyMarkersAndRoute = (
      map: import("maplibre-gl").Map,
      maplibregl: typeof import("maplibre-gl"),
    ) => {
      if (disposed) return;

      // Update pickup marker
      if (pickupCoordinates) {
        if (!pickupMarkerRef.current) {
          const el = createPickupMarkerElement();
          pickupMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" });
        }
        pickupMarkerRef.current.setLngLat(pickupCoordinates).addTo(map);
      } else {
        pickupMarkerRef.current?.remove();
        pickupMarkerRef.current = null;
      }

      // Update stop markers
      stopMarkersRef.current.forEach((m) => m.remove());
      stopMarkersRef.current = [];
      activeStops.forEach((stop, idx) => {
        if (stop.coordinates) {
          const stopEl = createStopMarkerElement(idx + 1);
          const sm = new maplibregl.Marker({ element: stopEl, anchor: "center" });
          sm.setLngLat(stop.coordinates).addTo(map);
          stopMarkersRef.current.push(sm);
        }
      });

      // Update destination marker
      if (destinationCoordinates) {
        if (!destinationMarkerRef.current) {
          const el = createDestinationMarkerElement();
          destinationMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" });
        }
        destinationMarkerRef.current.setLngLat(destinationCoordinates).addTo(map);
      } else {
        destinationMarkerRef.current?.remove();
        destinationMarkerRef.current = null;
      }

      // If both pickup and destination are provided, compute route
      if (pickupCoordinates && destinationCoordinates) {
        const routeAbort = new AbortController();
        routeAbortRef.current = routeAbort;

        routingProvider
          .getRoute(pickupCoordinates, destinationCoordinates, routeAbort.signal, stopCoordinates)
          .then((estimate) => {
            if (disposed || routeAbort.signal.aborted) return;

            const existingSource =
              typeof map.getSource === "function"
                ? (map.getSource("dc-route") as
                    | import("maplibre-gl").GeoJSONSource
                    | undefined)
                : undefined;

            if (existingSource && typeof existingSource.setData === "function") {
              existingSource.setData(estimate.geometry);
            } else {
              try {
                map.addSource("dc-route", {
                  type: "geojson",
                  data: estimate.geometry,
                });

                map.addLayer({
                  id: "dc-route-casing",
                  type: "line",
                  source: "dc-route",
                  layout: { "line-join": "round", "line-cap": "round" },
                  paint: {
                    "line-color": "#170204",
                    "line-width": 8,
                    "line-opacity": 0.6,
                  },
                });

                map.addLayer({
                  id: "dc-route-line",
                  type: "line",
                  source: "dc-route",
                  layout: { "line-join": "round", "line-cap": "round" },
                  paint: {
                    "line-color": "#d12b36",
                    "line-width": 4.5,
                    "line-opacity": 0.95,
                  },
                });
              } catch {
                // Layer or source may already exist
              }
            }

            const bounds = estimate.geometry.coordinates.reduce(
              (b, point) => b.extend(point),
              new maplibregl.LngLatBounds(
                estimate.geometry.coordinates[0],
                estimate.geometry.coordinates[0],
              ),
            );

            map.fitBounds(bounds, { padding: 58, maxZoom: 14, duration: 700 });
            setMapReady(true);
            setRouteError("");
            onRouteRef.current(estimate);
          })
          .catch((err) => {
            if (!disposed && !routeAbort.signal.aborted) {
              console.warn("[BookingRouteMap] routing preview unavailable:", err);
              setRouteError(
                "The route preview is temporarily unavailable. You can retry route calculation or continue with your booking.",
              );
              onRouteRef.current(null);
            }
          });
      } else {
        // Only one point selected so far
        try {
          if (typeof map.getLayer === "function" && map.getLayer("dc-route-line")) {
            map.removeLayer("dc-route-line");
          }
          if (typeof map.getLayer === "function" && map.getLayer("dc-route-casing")) {
            map.removeLayer("dc-route-casing");
          }
          if (typeof map.getSource === "function" && map.getSource("dc-route")) {
            map.removeSource("dc-route");
          }
        } catch {
          // Ignored
        }
        map.flyTo({ center, zoom: 12, duration: 600 });
        setMapReady(true);
        onRouteRef.current(null);
      }
    };

    // If map already exists and is loaded, update directly without tearing down WebGL canvas
    if (mapRef.current && typeof mapRef.current.loaded === "function" && mapRef.current.loaded()) {
      import("maplibre-gl").then((module) => {
        const maplibregl = module.default ?? module;
        if (mapRef.current && !disposed) {
          applyMarkersAndRoute(mapRef.current, maplibregl);
        }
      });
      return;
    }

    // Otherwise initialize MapLibre
    let resizeObserver: ResizeObserver | null = null;

    void Promise.all([
      import("maplibre-gl"),
      import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
    ])
      .then(([module, workerModule]) => {
        if (disposed || !containerRef.current) return;
        const maplibregl = module.default ?? module;
        const workerUrl = (workerModule as { default?: string })?.default ?? workerModule;
        if (workerUrl && typeof maplibregl.setWorkerUrl === "function") {
          maplibregl.setWorkerUrl(String(workerUrl));
        }

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: getMapStyle(),
          center,
          zoom: 11,
          attributionControl: true,
        });
        mapRef.current = map;

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

        const createFallbackImage = () => ({
          width: 1,
          height: 1,
          data: new Uint8Array([0, 0, 0, 0]),
        });

        if (typeof map.setMissingStyleImageResolver === "function") {
          map.setMissingStyleImageResolver((id: string) => {
            if (map && !map.hasImage(id)) {
              try {
                map.addImage(id, createFallbackImage());
              } catch {
                // Ignore concurrent additions
              }
            }
          });
        }

        map.on("styleimagemissing", (e: { id?: string }) => {
          const id = e?.id;
          if (id && map && !map.hasImage(id)) {
            try {
              map.addImage(id, createFallbackImage());
            } catch {
              // Ignore concurrent additions
            }
          }
        });

        const showMapError = (e?: { error?: { message?: string } }) => {
          if (disposed) return;
          const msg = e?.error?.message || "";
          if (
            msg &&
            (msg.includes("Image") ||
              msg.includes("image") ||
              msg.includes("could not be loaded") ||
              msg.includes("wood-pattern") ||
              msg.includes("sprite") ||
              msg.includes("404"))
          ) {
            console.warn("[BookingRouteMap] Non-fatal map warning:", msg);
            return;
          }
          setMapReady(false);
          onRouteRef.current(null);
          setMapError(
            "The route preview is temporarily unavailable. You can continue with your booking.",
          );
        };

        map.on("error", showMapError);

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            const container = containerRef.current;
            if (container && container.clientWidth > 0 && container.clientHeight > 0) {
              map?.resize();
            }
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

            applyMarkersAndRoute(map, maplibregl);
          } catch {
            showMapError();
            onRouteRef.current(null);
          }
        });
      })
      .catch(() => {
        if (!disposed) {
          setMapError(
            "The route preview is temporarily unavailable. You can continue with your booking.",
          );
        }
      });

    return () => {
      disposed = true;
      routeAbortRef.current?.abort();
      resizeObserver?.disconnect();
    };
  }, [pickupKey, destinationKey, stopsKey, retryCount, routingProvider]);

  // Cleanup map only on component unmount or retry
  useEffect(() => {
    return () => {
      routeAbortRef.current?.abort();
      pickupMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      stopMarkersRef.current.forEach((m) => m.remove());
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [retryCount]);

  return (
    <div className="relative min-h-[300px] overflow-hidden border border-border bg-charcoal md:min-h-[360px]">
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" aria-label="Interactive route map" />
      </div>

      {!pickup && !destination ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/55 p-8 text-center backdrop-blur-[1px]">
          <p className="max-w-sm text-sm text-foreground/80">
            Select your pickup and destination to preview your journey.
          </p>
        </div>
      ) : null}

      {coordinatesUnavailable ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/80 p-8 text-center backdrop-blur-[1px]">
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
          className="absolute bottom-3 left-3 max-w-[80%] border border-border/60 bg-background/95 px-3 py-2 text-xs text-foreground shadow-lg backdrop-blur-sm"
        >
          {routeError}{" "}
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="ml-2 font-medium text-primary underline underline-offset-2"
          >
            Retry
          </button>
        </p>
      ) : null}

      {pickup && destination && !mapReady && !mapError && !coordinatesUnavailable ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-charcoal/70 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Loading your route preview…
          </p>
        </div>
      ) : null}
    </div>
  );
}
