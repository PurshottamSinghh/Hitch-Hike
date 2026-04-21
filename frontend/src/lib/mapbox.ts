/**
 * Mapbox helpers — client-side Geocoding (place autocomplete) + Directions.
 *
 * Uses the public token injected via VITE_MAPBOX_PUBLIC_TOKEN.
 */

export const MAPBOX_PUBLIC_TOKEN =
  (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined) ||
  (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ||
  "";

export interface GeocodeResult {
  id: string;
  /** Full formatted address. */
  label: string;
  /** Short name of the primary location. */
  name: string;
  center: [number, number];
}

export async function geocodeSearch(
  query: string,
  opts?: {
    proximity?: [number, number] | { lng: number; lat: number };
    limit?: number;
  },
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed || !MAPBOX_PUBLIC_TOKEN) return [];

  const params = new URLSearchParams({
    access_token: MAPBOX_PUBLIC_TOKEN,
    autocomplete: "true",
    limit: String(opts?.limit ?? 5),
    country: "us",
    types: "address,place,poi,postcode,neighborhood,locality",
  });
  if (opts?.proximity) {
    const [lng, lat] = Array.isArray(opts.proximity)
      ? opts.proximity
      : [opts.proximity.lng, opts.proximity.lat];
    params.set("proximity", `${lng},${lat}`);
  }
  // Bias to Toledo/Ohio for campus-centric searches.
  params.set("bbox", "-84.65,41.35,-82.95,41.95");

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    trimmed,
  )}.json?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();

  return (data?.features || []).map((f: any) => ({
    id: String(f.id),
    label: String(f.place_name || f.text || ""),
    name: String(f.text || f.place_name || ""),
    center: [Number(f.center?.[0] ?? 0), Number(f.center?.[1] ?? 0)],
  }));
}

export async function reverseGeocode(
  input: [number, number] | { lng: number; lat: number },
): Promise<string | null> {
  if (!MAPBOX_PUBLIC_TOKEN) return null;
  const [lng, lat] = Array.isArray(input) ? input : [input.lng, input.lat];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_PUBLIC_TOKEN}&limit=1&types=address,place,poi`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const first = data?.features?.[0];
  return first?.place_name || null;
}

export interface DirectionsResult {
  geometry: GeoJSON.LineString;
  durationSec: number;
  distanceMeters: number;
}

/**
 * Fetch a driving route through an ordered list of (lng,lat) waypoints.
 * Returns a GeoJSON LineString for rendering on Mapbox GL JS.
 */
export async function fetchRoute(
  waypoints: Array<[number, number]>,
): Promise<DirectionsResult | null> {
  if (!MAPBOX_PUBLIC_TOKEN || waypoints.length < 2) return null;

  const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const params = new URLSearchParams({
    access_token: MAPBOX_PUBLIC_TOKEN,
    geometries: "geojson",
    overview: "full",
    steps: "false",
  });

  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route?.geometry) return null;

  return {
    geometry: route.geometry as GeoJSON.LineString,
    durationSec: Number(route.duration || 0),
    distanceMeters: Number(route.distance || 0),
  };
}
