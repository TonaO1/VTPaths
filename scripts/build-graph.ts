// Snaps VT's polylines into a routable node/edge graph.
// Input:  data/raw-access-route.geojson  (npm run fetch-gis)
//         data/overlay.json              (hand-maintained, see below)
// Output: src/data/campus.geojson

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const IN = 'data/raw-access-route.geojson';
const BUILDINGS = 'data/raw-buildings.json';
const OVERLAY = 'data/overlay.json';
const OUT = 'src/data/campus.geojson';

// A building further than this from any accessible path is not somewhere the
// router can honestly claim to take you.
const MAX_BUILDING_SNAP_M = 150;

// ~1.1 m at this latitude. VT's polylines mostly share exact endpoints; this
// absorbs the ones that are a survey hair apart and would otherwise strand a
// path in its own component. It is also how hand-added overlay edges attach to
// the VT network: give them an endpoint within a metre and they snap on.
const SNAP_DECIMALS = 5;

type Coord = [number, number];

interface RawFeature {
  geometry: { type: string; coordinates: Coord[] | Coord[][] } | null;
  properties: { objectid: number; type?: string | null } | null;
}

/**
 * Hand-maintained, because VT's layer does not carry this:
 * - `steep`: every live feature comes back type "Normal", so the ADA grade
 *   classification the toggle needs has to be listed by objectid here.
 * - `extraEdges`: the accessible-path layer excludes stairs by construction,
 *   so stair shortcuts do not exist in it at all and must be drawn.
 */
interface Overlay {
  steep?: string[];
  extraEdges?: { id: string; coords: Coord[]; has_stairs?: boolean; steep?: boolean }[];
}

function key([lon, lat]: Coord): string {
  return `${lon.toFixed(SNAP_DECIMALS)},${lat.toFixed(SNAP_DECIMALS)}`;
}

function metres(a: Coord, b: Coord): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(a[0] - b[0]);
  const lat = toRad((a[1] + b[1]) / 2);
  return Math.hypot(dLon * Math.cos(lat), dLat) * R;
}

function length(coords: Coord[]): number {
  let m = 0;
  for (let i = 1; i < coords.length; i++) m += metres(coords[i - 1]!, coords[i]!);
  return Math.round(m * 10) / 10;
}

const nodeIds = new Map<string, string>();
const nodeCoords = new Map<string, Coord>();

function nodeId(c: Coord): string {
  const k = key(c);
  let id = nodeIds.get(k);
  if (!id) {
    id = `N${nodeIds.size}`;
    nodeIds.set(k, id);
    nodeCoords.set(id, c);
  }
  return id;
}

const raw = JSON.parse(readFileSync(IN, 'utf8')) as { features: RawFeature[] };
const overlay: Overlay = existsSync(OVERLAY)
  ? (JSON.parse(readFileSync(OVERLAY, 'utf8')) as Overlay)
  : {};
const steepIds = new Set(overlay.steep ?? []);

const edges: {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: Coord[] };
  properties: {
    id: string;
    from: string;
    to: string;
    length: number;
    steep: boolean;
    has_stairs: boolean;
  };
}[] = [];

function addEdge(id: string, coords: Coord[], steep: boolean, hasStairs: boolean) {
  if (coords.length < 2) return;
  const from = nodeId(coords[0]!);
  const to = nodeId(coords[coords.length - 1]!);
  if (from === to) return;
  edges.push({
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates: coords },
    properties: { id, from, to, length: length(coords), steep, has_stairs: hasStairs },
  });
}

function partsOf(f: RawFeature): Coord[][] {
  if (!f.geometry) return [];
  return f.geometry.type === 'MultiLineString'
    ? (f.geometry.coordinates as Coord[][])
    : [f.geometry.coordinates as Coord[]];
}

// VT's polylines touch at interior vertices, not only at their endpoints.
// Splitting only at endpoints leaves the network in hundreds of components and
// routing finds nothing, so any vertex shared by two features becomes a node.
const seen = new Map<string, number>();
for (const f of raw.features) {
  for (const coords of partsOf(f)) {
    for (const k of new Set(coords.map(key))) {
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
  }
}

for (const f of raw.features) {
  if (!f.properties) continue;

  // Edge ids are derived from VT's objectid, not from loop order, so the
  // overlay keeps pointing at the same segment across a refetch.
  const base = `E${f.properties.objectid}`;
  const steep = f.properties.type === 'Steep';
  let part = 0;

  for (const coords of partsOf(f)) {
    let start = 0;
    for (let i = 1; i < coords.length; i++) {
      const junction = (seen.get(key(coords[i]!)) ?? 0) > 1;
      if (!junction && i < coords.length - 1) continue;
      const id = part === 0 ? base : `${base}-${part}`;
      addEdge(id, coords.slice(start, i + 1), steep || steepIds.has(id), false);
      start = i;
      part++;
    }
  }
}

// Overlay edges come from OpenStreetMap, whose geometry was surveyed
// independently of VT's, so their endpoints never coincide with a VT node.
// Attach each end to the nearest one instead, and drop any that cannot reach
// the network at both ends - a stair flight joined at one end is a dead end,
// not a shortcut.
const OVERLAY_SNAP_M = 25;

function nearestNode(at: Coord): { id: string; distance: number } | null {
  let id = '';
  let best = Infinity;
  for (const [candidate, coord] of nodeCoords) {
    const d = metres(at, coord);
    if (d < best) {
      best = d;
      id = candidate;
    }
  }
  return id ? { id, distance: best } : null;
}

let attachedStairs = 0;
let strandedStairs = 0;

for (const e of overlay.extraEdges ?? []) {
  if (e.coords.length < 2) continue;

  const head = nearestNode(e.coords[0]!);
  const tail = nearestNode(e.coords[e.coords.length - 1]!);

  if (
    !head ||
    !tail ||
    head.id === tail.id ||
    head.distance > OVERLAY_SNAP_M ||
    tail.distance > OVERLAY_SNAP_M
  ) {
    strandedStairs++;
    continue;
  }

  // Draw the OSM geometry but bridge both ends to the VT nodes, so the line on
  // the map matches the edge in the graph.
  const coords: Coord[] = [
    nodeCoords.get(head.id)!,
    ...e.coords,
    nodeCoords.get(tail.id)!,
  ];
  addEdge(e.id, coords, e.steep ?? false, e.has_stairs ?? true);
  attachedStairs++;
}

// Connected components. If routing returns nothing, this number is the first
// thing to look at, well before suspecting Dijkstra.
const parent = new Map<string, string>();
for (const id of nodeCoords.keys()) parent.set(id, id);
const find = (x: string): string => {
  let r = x;
  while (parent.get(r) !== r) r = parent.get(r)!;
  return r;
};
for (const e of edges) parent.set(find(e.properties.from), find(e.properties.to));

const sizes = new Map<string, number>();
for (const id of nodeCoords.keys()) {
  const r = find(id);
  sizes.set(r, (sizes.get(r) ?? 0) + 1);
}
const ranked = [...sizes.values()].sort((a, b) => b - a);

// Buildings are the route endpoints the dropdowns offer. VT gives them as
// plain lat/lon attributes, so each one attaches to the nearest path node that
// is actually routable, i.e. in the largest component. Anything that lands on a
// stranded fragment would be selectable and then unreachable.
const mainComponent = [...sizes].sort((a, b) => b[1] - a[1])[0]![0];
const routable = [...nodeCoords.keys()].filter((id) => find(id) === mainComponent);

interface RawBuilding {
  name: string | null;
  bldg_num: string | null;
  community: string | null;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
}

const buildingOf = new Map<string, { name: string; distance: number }>();
let attached = 0;
let tooFar = 0;

if (existsSync(BUILDINGS)) {
  const raw = JSON.parse(readFileSync(BUILDINGS, 'utf8')) as RawBuilding[];
  const named = raw.filter(
    (b) =>
      b.name &&
      b.latitude &&
      b.longitude &&
      b.community === 'VIRGINIA TECH' &&
      b.status === 'Existing Conditions' &&
      b.bldg_num !== '<Null>',
  );

  for (const b of named) {
    const at: Coord = [b.longitude!, b.latitude!];
    let nearest = '';
    let best = Infinity;
    for (const id of routable) {
      const d = metres(at, nodeCoords.get(id)!);
      if (d < best) {
        best = d;
        nearest = id;
      }
    }

    if (best > MAX_BUILDING_SNAP_M) {
      tooFar++;
      continue;
    }

    // Several buildings can share a doorway node; the closest one keeps it,
    // because Node.building is singular in the types contract.
    const held = buildingOf.get(nearest);
    if (!held || best < held.distance) {
      buildingOf.set(nearest, { name: b.name!, distance: best });
    }
    attached++;
  }
}

const nodes = [...nodeCoords].map(([id, c]) => ({
  type: 'Feature' as const,
  geometry: { type: 'Point' as const, coordinates: c },
  properties: buildingOf.has(id)
    ? { id, building: buildingOf.get(id)!.name }
    : { id },
}));

writeFileSync(
  OUT,
  JSON.stringify({ type: 'FeatureCollection', features: [...nodes, ...edges] }),
);

const steepCount = edges.filter((e) => e.properties.steep).length;
const stairCount = edges.filter((e) => e.properties.has_stairs).length;
console.log(
  `stairs: ${attachedStairs} attached, ${strandedStairs} too far from the network`,
);
console.log(`${nodes.length} nodes, ${edges.length} edges -> ${OUT}`);
console.log(`${steepCount} steep, ${stairCount} with stairs`);
console.log(`${ranked.length} components, largest ${ranked[0]} nodes`);
console.log(
  `${buildingOf.size} buildings on the graph ` +
    `(${attached} matched, ${attached - buildingOf.size} shared a node, ${tooFar} too far)`,
);
