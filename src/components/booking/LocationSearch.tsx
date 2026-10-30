import { useEffect, useRef, useState } from "react";
import {
  CatalogLookupError,
  findCatalogMatch,
  searchCatalogLocations,
  type CatalogLocation,
} from "./catalog-location-match";

export type JourneyLocation = {
  id?: string;
  cityId?: string;
  label: string;
  context: string;
  coordinates: [number, number] | null;
  bookable: boolean;
};

type MapboxSuggestion = {
  mapbox_id: string;
  name: string;
  place_formatted?: string;
  coordinates: [number, number];
};

const MAPBOX_TOKEN = import.meta.env["VITE_MAPBOX_ACCESS_TOKEN"];

export function LocationSearch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: JourneyLocation | null;
  onChange: (location: JourneyLocation | null) => void;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [catalogLocations, setCatalogLocations] = useState<CatalogLocation[]>([]);
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [mapboxSearching, setMapboxSearching] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [mapboxError, setMapboxError] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const selectionRequestRef = useRef(0);

  useEffect(() => {
    setQuery(value?.label ?? "");
  }, [value?.id, value?.label]);

  useEffect(
    () => () => {
      selectionRequestRef.current += 1;
      abortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      abortRef.current?.abort();
      setCatalogLocations([]);
      setSuggestions([]);
      setCatalogSearching(false);
      setMapboxSearching(false);
      return;
    }
    setCatalogLocations([]);
    setSuggestions([]);
    setCatalogSearching(true);
    setMapboxSearching(Boolean(MAPBOX_TOKEN));
    let active = true;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const timer = window.setTimeout(() => {
      void searchCatalogLocations(query.trim(), controller.signal)
        .then((locations) => {
          if (active) {
            setCatalogLocations(locations);
            setCatalogError("");
            setCatalogSearching(false);
          }
        })
        .catch(() => {
          if (active && !controller.signal.aborted) {
            setCatalogError("DC Cabs locations are temporarily unavailable. Please try again.");
            setCatalogSearching(false);
          }
        });

      if (!MAPBOX_TOKEN) {
        setSuggestions([]);
        setMapboxSearching(false);
        return;
      }
      const mapboxParams = new URLSearchParams({
        q: query.trim().replaceAll(";", " "),
        language: "en",
        country: "in",
        worldview: "in",
        limit: "6",
        autocomplete: "true",
        access_token: MAPBOX_TOKEN,
      });
      void fetch(`https://api.mapbox.com/search/geocode/v6/forward?${mapboxParams}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Location search is temporarily unavailable.");
          const body = (await response.json()) as {
            features?: {
              properties?: {
                mapbox_id?: string;
                name?: string;
                place_formatted?: string;
              };
              geometry?: { coordinates?: number[] };
            }[];
          };
          if (active) {
            setSuggestions(
              (body.features ?? []).flatMap((feature) => {
                const mapboxId = feature.properties?.mapbox_id;
                const name = feature.properties?.name;
                const coordinates = feature.geometry?.coordinates;
                if (
                  typeof mapboxId !== "string" ||
                  typeof name !== "string" ||
                  !coordinates ||
                  coordinates.length !== 2 ||
                  !coordinates.every(Number.isFinite)
                )
                  return [];
                return [
                  {
                    mapbox_id: mapboxId,
                    name,
                    ...(feature.properties?.place_formatted
                      ? { place_formatted: feature.properties.place_formatted }
                      : {}),
                    coordinates: [coordinates[0]!, coordinates[1]!] as [number, number],
                  },
                ];
              }),
            );
            setMapboxError("");
            setMapboxSearching(false);
          }
        })
        .catch(() => {
          if (active && !controller.signal.aborted) {
            setMapboxError("Additional place suggestions are temporarily unavailable.");
            setMapboxSearching(false);
          }
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, retryCount, open]);

  function selectCatalog(entry: CatalogLocation) {
    selectionRequestRef.current += 1;
    abortRef.current?.abort();
    const location: JourneyLocation = {
      id: entry.id,
      cityId: entry.city_id,
      label: entry.name,
      context: entry.address ?? "DC Cabs bookable location",
      coordinates:
        entry.longitude !== null && entry.latitude !== null
          ? [Number(entry.longitude), Number(entry.latitude)]
          : null,
      bookable: true,
    };
    setQuery(location.label);
    onChange(location);
    setOpen(false);
    setBusy(false);
    setCatalogLocations([]);
    setSuggestions([]);
    setCatalogSearching(false);
    setMapboxSearching(false);
    setCatalogError("");
    setMapboxError("");
    setSelectionError("");
  }

  async function selectMapbox(suggestion: MapboxSuggestion) {
    if (!MAPBOX_TOKEN) return;
    const selectionRequest = ++selectionRequestRef.current;
    setBusy(true);
    setMapboxError("");
    setSelectionError("");
    try {
      const coordinates = suggestion.coordinates;
      if (selectionRequest !== selectionRequestRef.current) return;
      const catalogMatch =
        (await findCatalogMatch(suggestion.name, coordinates)) ??
        (suggestion.place_formatted
          ? await findCatalogMatch(suggestion.place_formatted, coordinates)
          : null);
      if (selectionRequest !== selectionRequestRef.current) return;
      const chosen: JourneyLocation = {
        ...(catalogMatch ? { id: catalogMatch.id, cityId: catalogMatch.city_id } : {}),
        label: catalogMatch?.name ?? suggestion.name,
        context: catalogMatch
          ? "Matched to an active DC Cabs location"
          : (suggestion.place_formatted ?? "Mapbox location"),
        coordinates,
        bookable: Boolean(catalogMatch),
      };
      setQuery(chosen.label);
      onChange(chosen);
      setOpen(false);
      setCatalogError("");
      if (!catalogMatch)
        setSelectionError(
          "This location is not available for online booking yet. Choose a listed DC Cabs location or contact our team.",
        );
    } catch (cause) {
      if (selectionRequest !== selectionRequestRef.current) return;
      if (cause instanceof CatalogLookupError) setCatalogError(cause.message);
      else
        setMapboxError(
          cause instanceof Error
            ? cause.message
            : "Location search is unavailable. Please try again.",
        );
    } finally {
      if (selectionRequest === selectionRequestRef.current) setBusy(false);
    }
  }

  return (
    <div className="relative">
      <label className="eyebrow block text-foreground/60" htmlFor={`location-${label}`}>
        {label}
      </label>
      <input
        id={`location-${label}`}
        className="mt-2 w-full border border-border bg-background px-4 py-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
        autoComplete="off"
        value={query}
        placeholder="Search an airport, address, hotel or landmark"
        aria-expanded={open}
        aria-controls={`location-options-${label}`}
        role="combobox"
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          selectionRequestRef.current += 1;
          setBusy(false);
          setQuery(event.target.value);
          onChange(null);
          setCatalogError("");
          setMapboxError("");
          setSelectionError("");
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      />
      {open && query.trim().length >= 2 ? (
        <div
          id={`location-options-${label}`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto border border-border bg-charcoal shadow-2xl"
        >
          {catalogLocations.length ? (
            <p className="border-b border-border px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-primary-tint">
              DC Cabs locations
            </p>
          ) : null}
          {catalogLocations.map((entry) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              key={entry.id}
              onClick={() => selectCatalog(entry)}
              className="block w-full border-b border-border px-4 py-3 text-left transition hover:bg-surface focus:bg-surface focus:outline-none"
            >
              <span className="block text-sm font-semibold">{entry.name}</span>
              <span className="mt-1 block text-xs text-primary-tint">DC Cabs location</span>
            </button>
          ))}
          {suggestions.length ? (
            <p className="border-b border-border px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Other places · availability checked before booking
            </p>
          ) : null}
          {suggestions.map((suggestion) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              key={suggestion.mapbox_id}
              disabled={busy}
              onClick={() => void selectMapbox(suggestion)}
              className="block w-full border-b border-border px-4 py-3 text-left transition hover:bg-surface focus:bg-surface focus:outline-none disabled:opacity-50"
            >
              <span className="block text-sm font-semibold">{suggestion.name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {suggestion.place_formatted ?? "Additional place suggestion"}
              </span>
              <span className="mt-1 block text-[0.65rem] text-muted-foreground">
                We’ll confirm whether this place is available for online booking.
              </span>
            </button>
          ))}
          {!catalogLocations.length && !suggestions.length ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {busy || catalogSearching || mapboxSearching
                ? "Searching…"
                : MAPBOX_TOKEN
                  ? "No matching places found."
                  : "No matching DC Cabs locations found."}
            </p>
          ) : null}
        </div>
      ) : null}
      {value ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {value.bookable ? "Available for online booking" : "Not available for online booking"}
        </p>
      ) : null}
      {catalogError ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {catalogError}{" "}
          <button
            type="button"
            onClick={() => {
              setCatalogError("");
              setRetryCount((count) => count + 1);
            }}
            className="underline underline-offset-2"
          >
            Try again
          </button>
        </p>
      ) : null}
      {selectionError ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {selectionError}
        </p>
      ) : null}
      {mapboxError ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {mapboxError}{" "}
          <button
            type="button"
            onClick={() => {
              setMapboxError("");
              setRetryCount((count) => count + 1);
            }}
            className="underline underline-offset-2"
          >
            Try again
          </button>
        </p>
      ) : null}
      {!MAPBOX_TOKEN ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Additional place suggestions are unavailable right now. DC Cabs locations remain
          searchable.
        </p>
      ) : null}
    </div>
  );
}
