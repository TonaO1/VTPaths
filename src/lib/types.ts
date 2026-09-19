// The contract. Three tracks build against this in parallel.
// Propose changes to an exported interface before making them (AGENTS.md rule 4).

/** Fixed enum. There is deliberately no free-text report (AGENTS.md rule 3). */
export type ReportType =
  | 'blocked'
  | 'elevator_out'
  | 'construction'
  | 'ice'
  | 'crowded';

export const REPORT_TYPES: ReportType[] = [
  'blocked',
  'elevator_out',
  'construction',
  'ice',
  'crowded',
];

export interface Node {
  id: string;
  lon: number;
  lat: number;
  /** Set only on nodes offered as a route endpoint in the dropdowns. */
  building?: string;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  /** Metres. */
  length: number;
  /** VT Access Route `type === 'Steep'`, i.e. grade over 1:12. */
  steep: boolean;
  /** Hand-added: VT's layer excludes stairs by construction, never tags them. */
  has_stairs: boolean;
  /** Full polyline as [lon, lat], for drawing. */
  coords: [number, number][];
}

export interface Report {
  edge_id: string;
  type: ReportType;
  /** 1 on first report, incremented by each confirm. 2 or more disables the edge. */
  count: number;
  created_at: string;
}

export interface Prefs {
  avoidStairs: boolean;
  avoidSteep: boolean;
}

export interface Neighbour {
  edgeId: string;
  to: string;
  /** Infinity means impassable under the current prefs and reports. */
  weight: number;
}

export interface Graph {
  nodes: Map<string, Node>;
  edges: Map<string, Edge>;
  adjacency: Map<string, Neighbour[]>;
}

export interface RouteResult {
  edgeIds: string[];
  /** Concatenated edge geometry as [lon, lat], ready for a GeoJSON LineString. */
  coords: [number, number][];
  /** Metres. */
  distance: number;
}
