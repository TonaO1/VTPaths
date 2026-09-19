import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';
import type { CampusGeoJSON } from '../lib/graph';
import type { Graph, Report, RouteResult } from '../lib/types';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Drillfield, near enough to the middle of anything we route across.
const CENTRE: [number, number] = [-80.4234, 37.2284];

interface Props {
  campus: CampusGeoJSON;
  graph: Graph;
  route: RouteResult | null;
  reports: Report[];
}

function lineOf(coords: [number, number][]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: coords },
  };
}

/**
 * Pure props in, pixels out. It never asks for a route and never touches
 * Supabase; App recomputes and this redraws. That is the whole reason the live
 * reroute is four lines of effect rather than a pile of imperative redraws.
 */
export default function Map({ campus, graph, route, reports }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    if (!container.current || map.current || !TOKEN) return;

    mapboxgl.accessToken = TOKEN;
    const m = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: CENTRE,
      zoom: 15,
    });
    map.current = m;

    m.on('load', () => {
      m.addSource('network', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: campus.features
            .filter((f) => f.geometry.type === 'LineString')
            .map((f) => ({
              type: 'Feature' as const,
              properties: {},
              geometry: f.geometry,
            })),
        },
      });
      m.addLayer({
        id: 'network',
        type: 'line',
        source: 'network',
        paint: { 'line-color': '#7a8699', 'line-width': 1.5, 'line-opacity': 0.5 },
      });

      m.addSource('route', { type: 'geojson', data: lineOf([]) });
      // Two layers: a dark casing under a bright core, so the line stays
      // readable over both pavement and grass from three feet back.
      m.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#1b1d23', 'line-width': 12 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      m.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#ff6b35', 'line-width': 7 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      m.addSource('reports', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'reports',
        type: 'circle',
        source: 'reports',
        paint: {
          'circle-radius': 9,
          'circle-color': '#e5243b',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });

      ready.current = true;
      m.resize();
    });

    m.on('error', (e) => console.error('mapbox', e.error));

    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
  }, [campus]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;

    const source = m.getSource('route') as mapboxgl.GeoJSONSource | undefined;
    source?.setData(lineOf(route?.coords ?? []));

    if (!route || route.coords.length === 0) return;

    const bounds = route.coords.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(route.coords[0], route.coords[0]),
    );
    m.fitBounds(bounds, { padding: 80, duration: 600 });
  }, [route]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;

    const features = reports.flatMap((r) => {
      const edge = graph.edges.get(r.edge_id);
      if (!edge) return [];
      const mid = edge.coords[Math.floor(edge.coords.length / 2)]!;
      return [
        {
          type: 'Feature' as const,
          properties: { type: r.type, count: r.count },
          geometry: { type: 'Point' as const, coordinates: mid },
        },
      ];
    });

    const source = m.getSource('reports') as mapboxgl.GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features });
  }, [reports, graph]);

  if (!TOKEN) {
    return (
      <section className="map-missing">
        <p>VITE_MAPBOX_TOKEN is not set, so the map cannot render.</p>
        <p>Routing still works &mdash; the distance above is real.</p>
      </section>
    );
  }

  return <div className="map" ref={container} />;
}
