const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

// Search Box forward, not Geocoding v6: v6 has no POI type, so "Torgersen"
// matches a street in Norway while Search Box returns Torgersen Hall.
const ENDPOINT = 'https://api.mapbox.com/search/searchbox/v1/forward';

// Blacksburg and the campus. Anything outside is not somewhere we can route.
const BBOX = '-80.50,37.15,-80.36,37.29';
const PROXIMITY = '-80.4234,37.2284';

export interface Place {
  id: string;
  name: string;
  /** "Blacksburg, Virginia" and the like, shown under the name. */
  context: string;
  lon: number;
  lat: number;
}

interface Response {
  features?: {
    properties?: {
      mapbox_id?: string;
      name?: string;
      place_formatted?: string;
      coordinates?: { longitude: number; latitude: number };
    };
  }[];
}

/**
 * Looks up anywhere in Blacksburg, not just the buildings VT publishes.
 * Returns [] rather than throwing: a failed lookup should quietly leave the
 * local building matches in place.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  if (!TOKEN || query.trim().length < 3) return [];

  const params = new URLSearchParams({
    q: query,
    proximity: PROXIMITY,
    bbox: BBOX,
    limit: '5',
    access_token: TOKEN,
  });

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal });
    if (!res.ok) return [];

    const body = (await res.json()) as Response;
    return (body.features ?? []).flatMap((f) => {
      const p = f.properties;
      if (!p?.name || !p.coordinates) return [];
      return [
        {
          id: p.mapbox_id ?? `${p.name}:${p.coordinates.longitude}`,
          name: p.name,
          context: (p.place_formatted ?? '').replace(/, United States$/, ''),
          lon: p.coordinates.longitude,
          lat: p.coordinates.latitude,
        },
      ];
    });
  } catch {
    // Aborted by the next keystroke, or offline. Either way, no suggestions.
    return [];
  }
}
