import { useEffect, useMemo, useRef, useState } from "react";
import {
  CatalogLookupError,
  findCatalogMatch,
  findNearestCatalogLocation,
  searchCatalogLocations,
  type CatalogLocation,
} from "./catalog-location-match";
import {
  defaultGeocodingProvider,
  type GeocodingProvider,
  type GeocodingSuggestion,
} from "@/lib/map/geocoding";

export type JourneyLocation = {
  id?: string;
  cityId?: string;
  label: string;
  context: string;
  coordinates: [number, number] | null;
  bookable: boolean;
};

export type { GeocodingSuggestion };

export function LocationSearch({
  label,
  value,
  onChange,
  cityLocations,
  cityName,
  placeholder,
  geocodingProvider = defaultGeocodingProvider,
}: {
  label: string;
  value: JourneyLocation | null;
  onChange: (location: JourneyLocation | null) => void;
  cityLocations?: CatalogLocation[];
  cityName?: string;
  placeholder?: string;
  geocodingProvider?: GeocodingProvider;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [catalogLocations, setCatalogLocations] = useState<CatalogLocation[]>([]);
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [geocodingSearching, setGeocodingSearching] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [geocodingError, setGeocodingError] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const selectionRequestRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const isCityScoped = Array.isArray(cityLocations);

  const displayedCatalogLocations = useMemo(() => {
    if (!isCityScoped) return catalogLocations;
    if (!query.trim() || (value && value.label === query)) {
      return cityLocations;
    }
    const needle = query.trim().toLowerCase();
    return cityLocations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(needle) ||
        (loc.address && loc.address.toLowerCase().includes(needle)) ||
        (loc.kind && loc.kind.toLowerCase().includes(needle)),
    );
  }, [isCityScoped, cityLocations, catalogLocations, query, value]);

  useEffect(() => {
    setQuery(value?.label ?? "");
  }, [value?.id, value?.label]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      if (!isCityScoped) setCatalogLocations([]);
      setSuggestions([]);
      setCatalogSearching(false);
      setGeocodingSearching(false);
      return;
    }

    if (value && value.label === query) {
      return;
    }

    if (!isCityScoped) {
      setCatalogLocations([]);
      setCatalogSearching(true);
    }
    setSuggestions([]);
    setGeocodingSearching(true);

    let active = true;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const timer = window.setTimeout(() => {
      // 1. Search authoritative DC Cabs catalog (when not city-scoped)
      if (!isCityScoped) {
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
      }

      // 2. Search geographic places & doorstep addresses via Geocoding provider
      const geocodeQuery = isCityScoped && cityName
        ? `${query.trim()}, ${cityName}, India`
        : query.trim();

      void geocodingProvider
        .search(geocodeQuery, controller.signal)
        .then((results) => {
          if (active) {
            setSuggestions(results);
            setGeocodingError("");
            setGeocodingSearching(false);
          }
        })
        .catch(() => {
          if (active && !controller.signal.aborted) {
            setGeocodingError("Additional place suggestions are temporarily unavailable.");
            setGeocodingSearching(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, retryCount, open, geocodingProvider, isCityScoped, cityName, value]);

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
    setGeocodingSearching(false);
    setCatalogError("");
    setGeocodingError("");
    setSelectionError("");
  }

  function selectCustomAddress(customText: string) {
    if (!isCityScoped || !cityLocations?.length) {
      if (suggestions.length > 0) {
        void selectSuggestion(suggestions[0]);
      }
      return;
    }
    const defaultCityLocation =
      cityLocations.find((loc) => loc.kind === "city_zone" || loc.kind === "doorstep") ??
      cityLocations[0];
    const coords: [number, number] | null =
      defaultCityLocation && defaultCityLocation.longitude !== null && defaultCityLocation.latitude !== null
        ? [Number(defaultCityLocation.longitude), Number(defaultCityLocation.latitude)]
        : null;

    const chosen: JourneyLocation = {
      id: defaultCityLocation.id,
      cityId: defaultCityLocation.city_id,
      label: customText,
      context: `Doorstep address in ${cityName ?? "selected city"}`,
      coordinates: coords,
      bookable: true,
    };
    setQuery(chosen.label);
    onChange(chosen);
    setOpen(false);
    setCatalogError("");
    setGeocodingError("");
    setSelectionError("");
  }

  async function selectSuggestion(suggestion: GeocodingSuggestion) {
    const selectionRequest = ++selectionRequestRef.current;
    setBusy(true);
    setGeocodingError("");
    setSelectionError("");

    try {
      const coordinates = suggestion.coordinates;
      if (selectionRequest !== selectionRequestRef.current) return;

      let catalogMatch =
        (await findCatalogMatch(suggestion.name, coordinates)) ??
        (suggestion.placeFormatted
          ? await findCatalogMatch(suggestion.placeFormatted, coordinates)
          : null);

      if (!catalogMatch && coordinates) {
        catalogMatch = await findNearestCatalogLocation(coordinates);
      }

      if (selectionRequest !== selectionRequestRef.current) return;

      // In city-scoped mode, custom address / home in the city is bookable!
      // Assign to the city's active doorstep or primary location ID.
      const defaultCityLocation =
        cityLocations?.find((loc) => loc.kind === "city_zone" || loc.kind === "doorstep") ??
        cityLocations?.[0];

      const chosenId = catalogMatch?.id ?? (isCityScoped ? defaultCityLocation?.id : undefined);
      const chosenCityId =
        catalogMatch?.city_id ?? (isCityScoped ? (defaultCityLocation?.city_id ?? cityLocations?.[0]?.city_id) : undefined);
      const isBookable = Boolean(chosenId);

      const chosen: JourneyLocation = {
        ...(chosenId ? { id: chosenId } : {}),
        ...(chosenCityId ? { cityId: chosenCityId } : {}),
        label: suggestion.name,
        context: catalogMatch
          ? "Matched to an active DC Cabs location"
          : (suggestion.placeFormatted ?? (isCityScoped && cityName ? `Address in ${cityName}` : "Place location")),
        coordinates,
        bookable: isBookable,
      };

      setQuery(chosen.label);
      onChange(chosen);
      setOpen(false);
      setCatalogError("");

      if (!isBookable) {
        setSelectionError(
          "This location is not available for online booking yet. Choose a listed DC Cabs location or contact our team.",
        );
      }
    } catch (cause) {
      if (selectionRequest !== selectionRequestRef.current) return;
      if (cause instanceof CatalogLookupError) {
        setCatalogError(cause.message);
      } else {
        setGeocodingError(
          cause instanceof Error
            ? cause.message
            : "Location search is unavailable. Please try again.",
        );
      }
    } finally {
      if (selectionRequest === selectionRequestRef.current) setBusy(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="eyebrow block text-foreground/60" htmlFor={`location-${label}`}>
        {label}
      </label>
      <input
        id={`location-${label}`}
        className="mt-2 w-full border border-border bg-background px-4 py-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
        autoComplete="off"
        value={query}
        placeholder={
          placeholder ??
          (isCityScoped
            ? cityName
              ? `Search home address, hotel, colony or airport in ${cityName}…`
              : "Search address or place…"
            : "Search any dropoff address, airport, hotel, city or landmark…")
        }
        aria-expanded={open}
        aria-controls={`location-options-${label}`}
        role="combobox"
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          selectionRequestRef.current += 1;
          setBusy(false);
          setQuery(event.target.value);
          onChange(null);
          setCatalogError("");
          setGeocodingError("");
          setSelectionError("");
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      />
      {open && (isCityScoped ? true : query.trim().length >= 2) ? (
        <div
          id={`location-options-${label}`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto border border-border bg-charcoal shadow-2xl"
        >
          {isCityScoped && !query.trim() ? (
            <div className="border-b border-border bg-surface/40 px-4 py-2.5 text-xs text-muted-foreground">
              💡 Type your exact home address, hotel, apartment, or colony in {cityName} above, or choose a hub below.
            </div>
          ) : null}

          {displayedCatalogLocations.length ? (
            <p className="border-b border-border px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-primary-tint">
              {isCityScoped && cityName ? `${cityName} Key Hubs & Locations` : "DC Cabs locations"}
            </p>
          ) : null}
          {displayedCatalogLocations.map((entry) => (
            <button
              type="button"
              role="option"
              aria-selected={value?.id === entry.id}
              key={entry.id}
              onClick={() => selectCatalog(entry)}
              className="block w-full border-b border-border px-4 py-3 text-left transition hover:bg-surface focus:bg-surface focus:outline-none"
            >
              <div className="flex items-center justify-between">
                <span className="block text-sm font-semibold text-foreground">{entry.name}</span>
                {entry.kind === "airport" ? (
                  <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">Airport</span>
                ) : entry.kind === "railway_station" ? (
                  <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">Station</span>
                ) : null}
              </div>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {entry.address ? `${entry.address} · DC Cabs location` : "DC Cabs location"}
              </span>
            </button>
          ))}

          {suggestions.length ? (
            <p className="border-b border-border px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {isCityScoped ? `Addresses & Localities in ${cityName ?? "city"}` : "Other places · availability checked before booking"}
            </p>
          ) : null}
          {suggestions.map((suggestion) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              key={suggestion.id}
              disabled={busy}
              onClick={() => void selectSuggestion(suggestion)}
              className="block w-full border-b border-border px-4 py-3 text-left transition hover:bg-surface focus:bg-surface focus:outline-none disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="block text-sm font-semibold text-foreground">{suggestion.name}</span>
                {isCityScoped ? (
                  <span className="text-[10px] text-emerald-400 font-medium">Doorstep bookable</span>
                ) : null}
              </div>
              <span className="mt-1 block text-xs text-muted-foreground">
                {suggestion.placeFormatted ?? "Address / Place location"}
              </span>
              {!isCityScoped ? (
                <span className="mt-1 block text-[0.65rem] text-muted-foreground">
                  We’ll confirm whether this place is available for online booking.
                </span>
              ) : null}
            </button>
          ))}

          {isCityScoped && query.trim().length >= 2 && !displayedCatalogLocations.some(l => l.name.toLowerCase() === query.trim().toLowerCase()) ? (
            <button
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => selectCustomAddress(query.trim())}
              className="block w-full border-b border-border bg-surface/30 px-4 py-3 text-left transition hover:bg-surface focus:bg-surface focus:outline-none"
            >
              <span className="block text-sm font-semibold text-primary">
                📍 Use &ldquo;{query.trim()}&rdquo; as doorstep address
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Doorstep pickup or drop anywhere in {cityName ?? "this city"}
              </span>
            </button>
          ) : null}

          {!displayedCatalogLocations.length && !suggestions.length ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {busy || catalogSearching || geocodingSearching
                ? "Searching places…"
                : isCityScoped
                  ? `No matching places found in ${cityName ?? "this city"}. You can type your exact address above.`
                  : "No matching places found."}
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
      {geocodingError ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {geocodingError}{" "}
          <button
            type="button"
            onClick={() => {
              setGeocodingError("");
              setRetryCount((count) => count + 1);
            }}
            className="underline underline-offset-2"
          >
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}
