import type { Edge, Graph, Neighbour, Node, Prefs, Report } from './types';

/**
 * What one unconfirmed report costs, in metres of detour we are willing to
 * accept to avoid it.
 *
 * Measured against the real graph: the median detour around a single segment
 * is 21 m and the 75th percentile is 64 m, because campus almost always has a
 * parallel sidewalk. At the old 1000 m this was infinity in all but name — one
 * report closed an edge outright, which made both the confirmation mechanic
 * and the strict toggle invisible. At 150 m a single report is avoided about
 * 84% of the time, and the exceptions are the ones that matter: a bridge or a
 * single corridor, where one mistaken report should not strand anybody.
 */
export const REPORT_PENALTY = 150;

export interface CampusGeoJSON {
  type: 'FeatureCollection';
  features: {
    geometry:
      | { type: 'Point'; coordinates: [number, number] }
      | { type: 'LineString'; coordinates: [number, number][] };
    properties: Record<string, unknown>;
  }[];
}

/**
 * The single place an edge is scored. Metres, plus a penalty, or Infinity when
 * the edge is unusable. The penalty is added to the length rather than
 * replacing it, so a detour is preferred but a single report cannot cut a
 * building off: if the only way in is reported once, we still route you there
 * and let the toggle decide otherwise.
 */
export function weight(edge: Edge, prefs: Prefs, reports: Report[]): number {
  if (prefs.avoidStairs && edge.has_stairs) return Infinity;
  if (prefs.avoidSteep && edge.steep) return Infinity;

  const report = reports.find((r) => r.edge_id === edge.id);
  if (!report) return edge.length;

  if (prefs.avoidCrowds && report.type === 'crowded') return Infinity;
  if (prefs.strict) return Infinity;
  if (report.count >= 2) return Infinity;
  return edge.length + REPORT_PENALTY;
}

/**
 * Takes reports as an argument rather than reading them, which is what keeps
 * this testable and the reroute out of imperative territory.
 */
export function buildGraph(
  geojson: CampusGeoJSON,
  reports: Report[],
  prefs: Prefs,
): Graph {
  const nodes = new Map<string, Node>();
  const edges = new Map<string, Edge>();
  const adjacency = new Map<string, Neighbour[]>();

  for (const f of geojson.features) {
    const p = f.properties;
    if (f.geometry.type === 'Point') {
      const [lon, lat] = f.geometry.coordinates;
      nodes.set(p.id as string, {
        id: p.id as string,
        lon,
        lat,
        ...(p.building ? { building: p.building as string } : {}),
      });
      continue;
    }

    const edge: Edge = {
      id: p.id as string,
      from: p.from as string,
      to: p.to as string,
      length: p.length as number,
      steep: Boolean(p.steep),
      has_stairs: Boolean(p.has_stairs),
      coords: f.geometry.coordinates,
    };
    edges.set(edge.id, edge);
  }

  for (const edge of edges.values()) {
    const w = weight(edge, prefs, reports);
    if (w === Infinity) continue;

    for (const [a, b] of [
      [edge.from, edge.to],
      [edge.to, edge.from],
    ]) {
      const list = adjacency.get(a!) ?? [];
      list.push({ edgeId: edge.id, to: b!, weight: w });
      adjacency.set(a!, list);
    }
  }

  return { nodes, edges, adjacency };
}
