import type { StyleSpecification } from "maplibre-gl";

/**
 * DC Cabs Dark Map Style Specification
 *
 * Uses OpenFreeMap's production-grade Dark vector map style:
 * - Free, open-source vector tiles powered by OpenStreetMap data
 * - High-performance vector rendering designed specifically for MapLibre GL JS
 * - Deep charcoal/slate luxury aesthetic matching the DC Cabs dark theme
 * - Zero watermarks and no proprietary API key required
 * - Compliant OpenStreetMap & OpenFreeMap attribution
 *
 * Configurable via VITE_MAP_STYLE_URL if an organization hosts a private tile server
 * (e.g. self-hosted Martin / Tileserver GL or private vector tile cluster).
 */
export const DC_CABS_DEFAULT_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

export function getMapStyle(): string | StyleSpecification {
  const customStyleUrl = import.meta.env["VITE_MAP_STYLE_URL"]?.trim();
  if (customStyleUrl) {
    return customStyleUrl;
  }
  return DC_CABS_DEFAULT_DARK_STYLE;
}
