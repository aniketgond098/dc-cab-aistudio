import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const catalogLocation = {
  id: "location-1",
  city_id: "city-1",
  name: "Mumbai Airport",
  address: "Terminal 2, Mumbai",
  latitude: 19.0896,
  longitude: 72.8656,
};

const suggestion = {
  type: "Feature",
  properties: {
    osm_id: 101,
    name: "Mumbai Airport",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
  },
  geometry: {
    coordinates: [72.8656, 19.0896],
  },
};

const geocodingResponse = (features: unknown[] = [suggestion]) =>
  ({
    type: "FeatureCollection",
    features,
  }) as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function startSearch() {
  vi.resetModules();
  const { LocationSearch } = await import("@/components/booking/LocationSearch");
  const onChange = vi.fn();
  render(<LocationSearch label="From" value={null} onChange={onChange} />);
  fireEvent.change(screen.getByRole("combobox", { name: "From" }), {
    target: { value: "Mumbai" },
  });
  return onChange;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("LocationSearch catalog validation with pluggable geocoding", () => {
  it("selects a matching active catalog location as bookable", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/catalog/locations"))
        return jsonResponse({ data: [catalogLocation] });
      if (url.includes("photon.komoot.io") || url.includes("/api"))
        return jsonResponse(geocodingResponse([]));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const onChange = await startSearch();
    const option = await screen.findByRole("option", { name: /Mumbai Airport/ });
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "location-1", cityId: "city-1", bookable: true }),
    );
    expect(onChange.mock.lastCall?.[0].coordinates).toEqual([72.8656, 19.0896]);
    expect(screen.getByRole("combobox", { name: "From" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("immediately selects a catalog location without coordinates while geocoding is pending", async () => {
    const locationWithoutCoordinates = {
      ...catalogLocation,
      latitude: null,
      longitude: null,
      name: "Mumbai Airport Terminal 2",
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/catalog/locations"))
        return Promise.resolve(jsonResponse({ data: [locationWithoutCoordinates] }));
      if (url.includes("photon.komoot.io") || url.includes("/api"))
        return new Promise<Response>(() => {});
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const onChange = await startSearch();
    fireEvent.click(await screen.findByRole("option", { name: /Mumbai Airport Terminal 2/ }));

    expect(onChange.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        id: "location-1",
        cityId: "city-1",
        label: "Mumbai Airport Terminal 2",
        coordinates: null,
        bookable: true,
      }),
    );
    expect(screen.getByRole("combobox", { name: "From" })).toHaveValue("Mumbai Airport Terminal 2");
    expect(screen.getByRole("combobox", { name: "From" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps a selected catalog location when the geocoding request fails", async () => {
    const locationWithoutCoordinates = {
      ...catalogLocation,
      latitude: null,
      longitude: null,
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/catalog/locations"))
        return jsonResponse({ data: [locationWithoutCoordinates] });
      if (url.includes("photon.komoot.io") || url.includes("/api")) return jsonResponse({}, 503);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const onChange = await startSearch();
    await screen.findByText(/Additional place suggestions are temporarily unavailable/i);
    fireEvent.click(await screen.findByRole("option", { name: /Mumbai Airport/ }));

    expect(onChange.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ id: "location-1", bookable: true, coordinates: null }),
    );
    expect(screen.getByRole("combobox", { name: "From" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("does not let a stale geocode lookup overwrite a newer catalog selection", async () => {
    let finishCatalogMatch: ((response: Response) => void) | undefined;
    let catalogLookupCount = 0;
    const staleCatalogLocation = {
      ...catalogLocation,
      id: "stale-location",
      name: "Mumbai Airport Other Entrance",
    };
    const staleSuggestion = {
      ...suggestion,
      properties: {
        ...suggestion.properties,
        name: "Mumbai Airport Other Entrance",
      },
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/catalog/locations")) {
        catalogLookupCount += 1;
        if (catalogLookupCount === 1)
          return Promise.resolve(jsonResponse({ data: [catalogLocation] }));
        return new Promise<Response>((resolve) => {
          finishCatalogMatch = resolve;
        });
      }
      if (url.includes("photon.komoot.io") || url.includes("/api"))
        return Promise.resolve(jsonResponse(geocodingResponse([staleSuggestion])));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const onChange = await startSearch();
    fireEvent.click(await screen.findByRole("option", { name: /Mumbai Airport Other Entrance/ }));
    await vi.waitFor(() => expect(finishCatalogMatch).toBeDefined());
    fireEvent.click(screen.getByRole("option", { name: /DC Cabs location/ }));
    finishCatalogMatch?.(jsonResponse({ data: [staleCatalogLocation] }));

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "location-1", bookable: true }),
      ),
    );
    expect(onChange).not.toHaveBeenLastCalledWith(expect.objectContaining({ bookable: false }));
    expect(catalogLookupCount).toBe(2);
    expect(screen.getByRole("combobox", { name: "From" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("keeps a successful catalog lookup with no match unsupported", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/catalog/locations")) return jsonResponse({ data: [] });
      if (url.includes("photon.komoot.io") || url.includes("/api"))
        return jsonResponse(geocodingResponse([suggestion]));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const onChange = await startSearch();
    fireEvent.click(await screen.findByRole("option", { name: /Mumbai Airport/ }));

    expect(await screen.findByText(/not available for online booking yet/i)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ bookable: false }));
    expect(onChange.mock.lastCall?.[0]).not.toHaveProperty("id");
  });

  it.each(["http", "malformed", "network"])(
    "keeps the temporary catalog error visible when geocoding suggestions succeed (%s failure)",
    async (failure) => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/catalog/locations")) {
          if (failure === "http") return jsonResponse({ error: "unavailable" }, 503);
          if (failure === "malformed") return jsonResponse({ data: { locations: [] } });
          throw new TypeError("fetch failed");
        }
        if (url.includes("photon.komoot.io") || url.includes("/api"))
          return jsonResponse(geocodingResponse([suggestion]));
        throw new Error(`Unexpected request: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      const onChange = await startSearch();
      fireEvent.click(await screen.findByRole("option", { name: /Mumbai Airport/ }));

      expect(
        await screen.findByText(/DC Cabs locations are temporarily unavailable/i),
      ).toBeInTheDocument();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(null);
      expect(screen.queryByText(/not available for online booking yet/i)).not.toBeInTheDocument();
    },
  );
});
