import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useState } from 'react';
import { nearestEdge } from '../lib/nearest';
import type { Edge, Node, Report, RouteResult } from '../lib/types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
if (MAPBOX_TOKEN) mapboxgl.accessToken = MAPBOX_TOKEN;

export const STYLES = {
  light: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
} as const;

export type Theme = keyof typeof STYLES;

// Drillfield, centre of campus. Just a starting viewport before data loads.
const VT_CENTER: [number, number] = [-80.4176, 37.2296];

/** Comfortable tap target, converted to metres at the current zoom. */
const TAP_RADIUS_PX = 16;

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
  theme: Theme;
  onPickEdge: (edgeId: string) => void;
}

function toLines(edges: Edge[], reports: Report[]): {
  type: 'FeatureCollection';
  features: LineFeature[];
} {
  const counts: Record<string, number> = {};
  for (const r of reports) counts[r.edge_id] = r.count;
  return {
    type: 'FeatureCollection',
    features: edges.map((e) => ({
      type: 'Feature',
      properties: {
        id: e.id,
        steep: e.steep,
        stairs: e.has_stairs,
        reported: e.id in counts,
        blocked: (counts[e.id] ?? 0) >= 2,
      },
      geometry: { type: 'LineString', coordinates: e.coords },
    })),
  };
}

function emptyLine(): LineFeature {
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } };
}

function boundsOf(coords: [number, number][]): mapboxgl.LngLatBounds {
  return coords.reduce(
    (b, c) => b.extend(c),
    new mapboxgl.LngLatBounds(coords[0], coords[0]),
  );
}

export default function Map({
  edges,
  route,
  reports,
  from,
  to,
  theme,
  onPickEdge,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const startMarker = useRef<mapboxgl.Marker | null>(null);
  const endMarker = useRef<mapboxgl.Marker | null>(null);
  const pick = useRef(onPickEdge);
  pick.current = onPickEdge;
  // The click handler is registered once; keep it reading current edges.
  const graph = useRef(edges);
  graph.current = edges;

  // Sources only exist after Mapbox fires `load`. Without gating on this, the
  // first route arrives before the source does, the effect bails, and no line
  // is ever drawn until the user happens to change a dropdown again.
  const [ready, setReady] = useState(false);
  const applied = useRef<Theme>('light');

  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      console.error('VITE_MAPBOX_TOKEN missing; map disabled.');
      return;
    }
    if (!container.current || map.current) return;

    const m = new mapboxgl.Map({
      container: container.current,
      style: STYLES.light,
      center: VT_CENTER,
      zoom: 15,
    });
    map.current = m;

    m.addControl(
      new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }),
      'bottom-right',
    );

    // setStyle destroys every custom source and layer, so this has to be
    // re-runnable and hang off style.load rather than load.
    function addLayers(m: mapboxgl.Map) {
      m.addSource('network', { type: 'geojson', data: toLines(edges, reports) });

      // The whole accessible network, so a detour reads as a detour.
      m.addLayer({
        id: 'network',
        type: 'line',
        source: 'network',
        paint: {
          'line-color': '#7c8496',
          'line-width': 2,
          'line-opacity': 0.55,
        },
      });

      // Steep and stair segments are the entire point of the two toggles, and
      // they were invisible: you could only tell a toggle worked by watching a
      // number change. Now you can see what it is routing around.
      m.addLayer({
        id: 'steep',
        type: 'line',
        source: 'network',
        filter: ['==', ['get', 'steep'], true],
        paint: { 'line-color': '#f4a11c', 'line-width': 4 },
      });

      m.addLayer({
        id: 'stairs',
        type: 'line',
        source: 'network',
        filter: ['==', ['get', 'stairs'], true],
        paint: {
          'line-color': '#7b3fb8',
          'line-width': 4,
          'line-dasharray': [1.5, 1],
        },
      });

      m.addLayer({
        id: 'reported',
        type: 'line',
        source: 'network',
        filter: ['==', ['get', 'reported'], true],
        paint: {
          'line-color': '#e5243b',
          'line-width': ['case', ['get', 'blocked'], 7, 5],
        },
      });

      m.addSource('route', { type: 'geojson', data: emptyLine() });
      m.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0d0f13', 'line-width': 13, 'line-opacity': 0.8 },
      });
      m.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#861f41', 'line-width': 6 },
      });

      setReady(true);
    }

    m.on('style.load', () => addLayers(m));
    m.once('load', () => m.resize());

    // Click anywhere near a path to report on it. Resolved geometrically
    // against the graph rather than by hit-testing rendered pixels, so it works
    // while tiles are still loading and regardless of which layers are visible.
    m.on('click', (ev: mapboxgl.MapMouseEvent) => {
      // A fixed metre radius is unusable zoomed out, where 30 m is a six pixel
      // target. Convert a comfortable tap radius into metres at the current
      // zoom instead, so the click feels the same at every scale.
      const metresPerPixel =
        (156543.03392 * Math.cos((ev.lngLat.lat * Math.PI) / 180)) /
        2 ** m.getZoom();
      const radius = Math.min(Math.max(TAP_RADIUS_PX * metresPerPixel, 8), 120);

      const hit = nearestEdge([ev.lngLat.lng, ev.lngLat.lat], graph.current, radius);
      if (hit) pick.current(hit.id);
    });
    m.on('mouseenter', 'network', () => {
      m.getCanvas().style.cursor = 'pointer';
    });
    m.on('mouseleave', 'network', () => {
      m.getCanvas().style.cursor = '';
    });

    // Mapbox sizes its canvas once at construction; a full-bleed container
    // otherwise paints only the rectangle it was born with.
    const resize = new ResizeObserver(() => m.resize());
    resize.observe(container.current);

    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || applied.current === theme) return;
    // Track the applied theme explicitly. Sniffing m.getStyle().name does not
    // work - streets-v12 is called "Mapbox Streets", which never contains the
    // word "light" - so the guard never fired and the map restyled forever,
    // wiping its layers on every pass and rendering nothing.
    applied.current = theme;
    setReady(false);
    m.setStyle(STYLES[theme]);
  }, [theme, ready]);

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

    // Panels float over the map, so keep the route clear of them.
    m.fitBounds(boundsOf(route.coords), {
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

  function fitCampus() {
    const m = map.current;
    if (!m || edges.length === 0) return;
    m.fitBounds(boundsOf(edges.flatMap((e) => e.coords)), {
      padding: { top: 100, bottom: 160, left: 400, right: 360 },
      duration: 800,
    });
  }

  if (!MAPBOX_TOKEN) {
    return (
      <section className="map map-disabled">
        <p>Map disabled: set VITE_MAPBOX_TOKEN.</p>
      </section>
    );
  }

  return (
    <>
      <div ref={container} className="map" />
      <button className="fit" onClick={fitCampus} title="Zoom to the whole campus" aria-label="Zoom to the whole campus">
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M15.4 8.6 10.9 10.9 8.6 15.4 13.1 13.1z" fill="currentColor" />
        </svg>
      </button>
      <div className="legend panel">
        <span><i className="sw sw-route" />Route</span>
        <span><i className="sw sw-steep" />Steep &gt;1:12</span>
        <span><i className="sw sw-stairs" />Stairs</span>
        <span><i className="sw sw-reported" />Reported</span>
      </div>
    </>
  );
}
