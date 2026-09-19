import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Edge, Node, Report, RouteResult } from '../lib/types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
if (MAPBOX_TOKEN) mapboxgl.accessToken = MAPBOX_TOKEN;

// Drillfield, centre of campus. Just a starting viewport before data loads.
const VT_CENTER: [number, number] = [-80.4176, 37.2296];

type LineFeature = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
};

interface Props {
  edges: Edge[];
  route: RouteResult | null;
  reports: Report[];
  from?: Node;
  to?: Node;
}

// Mapbox canvas: base network, the current route, and start/end markers.
// No MapLibre fallback yet if the token is bad — logged loudly instead, per
// AGENTS.md error handling (known escape hatch, not built to save the dep).
export default function Map({ edges, route, reports, from, to }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const startMarker = useRef<mapboxgl.Marker | null>(null);
  const endMarker = useRef<mapboxgl.Marker | null>(null);
  // Sources only exist after Mapbox fires `load`. Without gating on this, the
  // first route arrives before the source does, the effect bails, and no line
  // is ever drawn until the user happens to change a dropdown again.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      console.error('VITE_MAPBOX_TOKEN missing; map disabled.');
      return;
    }
    if (!container.current || map.current) return;

    const m = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: VT_CENTER,
      zoom: 16,
    });
    map.current = m;

    m.on('load', () => {
      m.addSource('network', { type: 'geojson', data: toLines(edges, reports) });
      m.addLayer({
        id: 'network',
        type: 'line',
        source: 'network',
        paint: {
          'line-color': ['case', ['get', 'reported'], '#ff6b35', '#3a3f4b'],
          'line-width': ['case', ['get', 'reported'], 4, 2],
        },
      });

      m.addSource('route', { type: 'geojson', data: emptyLine() });
      m.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0d0f13', 'line-width': 13, 'line-opacity': 0.85 },
      });
      m.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#d34d77', 'line-width': 6 },
      });

      setReady(true);
    });

    // The map now fills the viewport, and Mapbox sizes its canvas once at
    // construction. Without this it paints only the rectangle it was born
    // with and leaves the rest of the screen blank.
    const resize = new ResizeObserver(() => m.resize());
    resize.observe(container.current);
    m.on('load', () => m.resize());

    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
      setReady(false);
    };
    // Sources are seeded once on load; later data changes go through the
    // effects below via setData rather than re-creating the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    const source = m?.getSource('network') as mapboxgl.GeoJSONSource | undefined;
    source?.setData(toLines(edges, reports));
  }, [edges, reports, ready]);

  useEffect(() => {
    const m = map.current;
    const source = m?.getSource('route') as mapboxgl.GeoJSONSource | undefined;
    if (!m || !source) return;

    if (!route || route.coords.length === 0) {
      source.setData(emptyLine());
      return;
    }

    source.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: route.coords },
    });

    const bounds = route.coords.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(route.coords[0], route.coords[0]),
    );
    // Panels float over the map, so keep the route clear of them.
    m.fitBounds(bounds, {
      padding: { top: 120, bottom: 200, left: 420, right: 380 },
      maxZoom: 18,
      duration: 900,
    });
  }, [route, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    startMarker.current?.remove();
    startMarker.current = from
      ? new mapboxgl.Marker({ color: '#3ddc84' }).setLngLat([from.lon, from.lat]).addTo(m)
      : null;

    endMarker.current?.remove();
    endMarker.current = to
      ? new mapboxgl.Marker({ color: '#861f41' }).setLngLat([to.lon, to.lat]).addTo(m)
      : null;
  }, [from, to]);

  if (!MAPBOX_TOKEN) {
    return (
      <section className="map map-disabled">
        <p>Map disabled: set VITE_MAPBOX_TOKEN.</p>
      </section>
    );
  }

  return <div ref={container} className="map" />;
}

function toLines(edges: Edge[], reports: Report[]): { type: 'FeatureCollection'; features: LineFeature[] } {
  const reported = new Set(reports.map((r) => r.edge_id));
  return {
    type: 'FeatureCollection',
    features: edges.map((e) => ({
      type: 'Feature',
      properties: { reported: reported.has(e.id) },
      geometry: { type: 'LineString', coordinates: e.coords },
    })),
  };
}

function emptyLine(): LineFeature {
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } };
}
