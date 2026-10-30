import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const map = {
    addControl: vi.fn(),
    on: vi.fn(),
    once: vi.fn((_event: string, callback: () => void) => queueMicrotask(callback)),
    resize: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    fitBounds: vi.fn(),
    flyTo: vi.fn(),
    remove: vi.fn(),
  };
  const marker = {
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  };
  const bounds = { extend: vi.fn().mockReturnThis() };
  class MapMock {
    addControl = map.addControl;
    on = map.on;
    once = map.once;
    resize = map.resize;
    addSource = map.addSource;
    addLayer = map.addLayer;
    fitBounds = map.fitBounds;
    flyTo = map.flyTo;
    remove = map.remove;
  }
  class MarkerMock {
    setLngLat = marker.setLngLat;
    addTo = marker.addTo;
    remove = marker.remove;
  }
  class NavigationControlMock {}
  class LngLatBoundsMock {
    extend = bounds.extend;
  }
  return {
    map,
    marker,
    Map: MapMock,
    Marker: MarkerMock,
    NavigationControl: NavigationControlMock,
    LngLatBounds: LngLatBoundsMock,
  };
});

vi.mock("mapbox-gl", () => ({
  default: {
    Map: mocks.Map,
    Marker: mocks.Marker,
    NavigationControl: mocks.NavigationControl,
    LngLatBounds: mocks.LngLatBounds,
    accessToken: "",
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("BookingRouteMap optional coordinates", () => {
  it("keeps a catalog location selected and shows unavailable preview without inventing coordinates", async () => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "pk.test-token");
    vi.resetModules();
    const { BookingRouteMap } = await import("@/components/booking/BookingRouteMap");
    const onRoute = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <BookingRouteMap
        pickup={{
          id: "location-1",
          cityId: "city-1",
          label: "Mumbai Airport Terminal 2",
          context: "DC Cabs bookable location",
          coordinates: null,
          bookable: true,
        }}
        destination={null}
        onRoute={onRoute}
      />,
    );

    expect(
      await screen.findByText(/A route preview is not available for this journey yet/i),
    ).toBeInTheDocument();
    expect(onRoute).toHaveBeenCalledWith(null);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests and displays the actual route when both catalog locations have coordinates", async () => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "pk.test-token");
    vi.resetModules();
    const { BookingRouteMap } = await import("@/components/booking/BookingRouteMap");
    const onRoute = vi.fn();
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
            routes: [
              {
                distance: 7600,
                duration: 1440,
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [72.86, 19.09],
                    [72.88, 19.1],
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <BookingRouteMap
        pickup={{
          id: "pickup",
          cityId: "city-1",
          label: "Mumbai Airport",
          context: "DC Cabs location",
          coordinates: [72.855744, 19.092617],
          bookable: true,
        }}
        destination={{
          id: "destination",
          cityId: "city-1",
          label: "Bandra",
          context: "DC Cabs location",
          coordinates: [72.865725, 19.067115],
          bookable: true,
        }}
        onRoute={onRoute}
      />,
    );

    await act(async () => {
      await vi.waitFor(() =>
        expect(onRoute).toHaveBeenCalledWith({
          distanceKm: 7.6,
          durationHours: 0.4,
        }),
      );
    });
    const directionsUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(directionsUrl.hostname).toBe("api.mapbox.com");
    expect(directionsUrl.pathname).toBe(
      "/directions/v5/mapbox/driving/72.855744,19.092617;72.865725,19.067115",
    );
    expect(directionsUrl.searchParams.get("geometries")).toBe("geojson");
    expect(directionsUrl.searchParams.get("overview")).toBe("full");
    expect(directionsUrl.searchParams.get("steps")).toBe("false");
    expect(directionsUrl.searchParams.get("access_token")).toBe("pk.test-token");
    expect(mocks.map.addSource).toHaveBeenCalledWith(
      "dc-route",
      expect.objectContaining({ type: "geojson" }),
    );
    expect(mocks.map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "dc-route-line", type: "line", source: "dc-route" }),
    );
    expect(mocks.map.resize).toHaveBeenCalled();
    expect(mocks.map.fitBounds).toHaveBeenCalled();
    expect(mocks.map.addControl).toHaveBeenCalled();
    expect(mocks.map.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mocks.marker.setLngLat).toHaveBeenNthCalledWith(1, [72.855744, 19.092617]);
    expect(mocks.marker.setLngLat).toHaveBeenNthCalledWith(2, [72.865725, 19.067115]);
    expect(container.querySelector("[aria-label='Interactive route map']")).toHaveClass(
      "h-full",
      "w-full",
    );
    expect(
      container.querySelector("[aria-label='Interactive route map']")?.parentElement,
    ).toHaveClass("absolute", "inset-0");
  });

  it("shows a full route-preview fallback when Mapbox cannot render the map", async () => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "pk.test-token");
    vi.resetModules();
    const { BookingRouteMap } = await import("@/components/booking/BookingRouteMap");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );

    render(
      <BookingRouteMap
        pickup={{
          id: "pickup",
          cityId: "city-1",
          label: "Mumbai Airport Terminal 1",
          context: "DC Cabs location",
          coordinates: [72.855744, 19.092617],
          bookable: true,
        }}
        destination={{
          id: "destination",
          cityId: "city-1",
          label: "Bandra Kurla Complex (BKC)",
          context: "DC Cabs location",
          coordinates: [72.865725, 19.067115],
          bookable: true,
        }}
        onRoute={vi.fn()}
      />,
    );

    await vi.waitFor(() =>
      expect(mocks.map.on).toHaveBeenCalledWith("error", expect.any(Function)),
    );
    const errorHandler = mocks.map.on.mock.calls.find(([event]) => event === "error")?.[1];
    act(() => errorHandler?.());

    expect(await screen.findByRole("status")).toHaveTextContent(
      /route preview is temporarily unavailable.*continue with your booking/i,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps route failures optional when Mapbox returns unauthorized", async () => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "pk.test-token");
    vi.resetModules();
    const { BookingRouteMap } = await import("@/components/booking/BookingRouteMap");
    const onRoute = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );

    render(
      <BookingRouteMap
        pickup={{
          id: "pickup",
          cityId: "city-1",
          label: "Airport",
          context: "",
          coordinates: [72.86, 19.09],
          bookable: true,
        }}
        destination={{
          id: "destination",
          cityId: "city-1",
          label: "Bandra",
          context: "",
          coordinates: [72.88, 19.1],
          bookable: true,
        }}
        onRoute={onRoute}
      />,
    );

    expect(
      await screen.findByText(
        /route preview is temporarily unavailable.*continue with your booking/i,
      ),
    ).toBeInTheDocument();
    expect(onRoute).toHaveBeenCalledWith(null);
  });

  it("shows the non-blocking fallback when the public token is unavailable", async () => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "");
    vi.resetModules();
    const { BookingRouteMap } = await import("@/components/booking/BookingRouteMap");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<BookingRouteMap pickup={null} destination={null} onRoute={vi.fn()} />);

    expect(
      screen.getByText(/Your route preview is unavailable right now.*continue to your fare/i),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
