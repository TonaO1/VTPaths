// Fills data/overlay.json with the two things VT's Access Route layer does not
// carry, from sources that actually have them. Run, then `npm run build-graph`.
//
//   steepness -> USGS NED 10m elevation via opentopodata.org
//   stairs    -> OpenStreetMap highway=steps via Overpass
//
// Both are free and need no key. Neither is a VT endpoint, so the read-only
// rule in AGENTS.md is untouched.

import { readFileSync, writeFileSync } from 'node:fs';

const CAMPUS = 'src/data/campus.geojson';
const OUT = 'data/overlay.json';

// ADA limits a ramp to 1:12. VT's own `type` field was meant to encode exactly
// this threshold, so using anything else would be inventing a standard.
const ADA_GRADE = 1 / 12;

const ELEVATION = 'https://api.opentopodata.org/v1/ned10m';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const BATCH = 100; // opentopodata's per-request cap
const THROTTLE_MS = 1100; // its published rate limit is 1 call/second

type Coord = [number, number];

interface CampusFeature {
  geometry:
    | { type: 'Point'; coordinates: Coord }
    | { type: 'LineString'; coordinates: Coord[] };
  properties: {
    id: string;
    from?: string;
    to?: string;
    length?: number;
  };
}

const campus = JSON.parse(readFileSync(CAMPUS, 'utf8')) as {
  features: CampusFeature[];
};

const nodes = new Map<string, Coord>();
const edges: { id: string; from: string; to: string; length: number }[] = [];

for (const f of campus.features) {
  if (f.geometry.type === 'Point') {
    nodes.set(f.properties.id, f.geometry.coordinates);
  } else if (f.properties.from && f.properties.to) {
    edges.push({
      id: f.properties.id,
      from: f.properties.from,
      to: f.properties.to,
      length: f.properties.length ?? 0,
    });
  }
}

console.log(`${nodes.size} nodes, ${edges.length} edges`);

/* ---------- elevation ---------- */

const ids = [...nodes.keys()];
const elevation = new Map<string, number>();

for (let i = 0; i < ids.length; i += BATCH) {
  const slice = ids.slice(i, i + BATCH);
  const locations = slice
    .map((id) => {
      const [lon, lat] = nodes.get(id)!;
      return `${lat.toFixed(6)},${lon.toFixed(6)}`;
    })
    .join('|');

  const res = await fetch(`${ELEVATION}?locations=${locations}`);
  if (!res.ok) throw new Error(`elevation ${res.status} at ${i}`);

  const body = (await res.json()) as {
    results: { elevation: number | null }[];
  };
  body.results.forEach((r, j) => {
    if (r.elevation !== null) elevation.set(slice[j]!, r.elevation);
  });

  console.log(`elevation ${elevation.size}/${ids.length}`);
  if (i + BATCH < ids.length) {
    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }
}

const steep: string[] = [];
let graded = 0;
let maxGrade = 0;

for (const e of edges) {
  const a = elevation.get(e.from);
  const b = elevation.get(e.to);
  if (a === undefined || b === undefined || e.length < 5) continue;

  graded++;
  const grade = Math.abs(b - a) / e.length;
  maxGrade = Math.max(maxGrade, grade);
  if (grade > ADA_GRADE) steep.push(e.id);
}

console.log(
  `${steep.length} of ${graded} graded edges exceed 1:12 ` +
    `(steepest ${(maxGrade * 100).toFixed(1)}%)`,
);

/* ---------- stairs ---------- */

const [lons, lats] = [
  [...nodes.values()].map((c) => c[0]),
  [...nodes.values()].map((c) => c[1]),
];
const bbox = [
  Math.min(...lats),
  Math.min(...lons),
  Math.max(...lats),
  Math.max(...lons),
]
  .map((n) => n.toFixed(5))
  .join(',');

const query = `[out:json][timeout:90];way["highway"="steps"](${bbox});out geom;`;

const osm = await fetch(OVERPASS, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    // Overpass rejects requests without one.
    'User-Agent': 'VTPaths/0.1 (VTHacks accessibility routing project)',
  },
  body: new URLSearchParams({ data: query }),
});
if (!osm.ok) throw new Error(`overpass ${osm.status}`);

const steps = (await osm.json()) as {
  elements: {
    id: number;
    geometry?: { lat: number; lon: number }[];
    tags?: Record<string, string>;
  }[];
};

const extraEdges = steps.elements
  .filter((w) => (w.geometry?.length ?? 0) >= 2)
  .map((w) => ({
    id: `S${w.id}`,
    coords: w.geometry!.map((p) => [p.lon, p.lat] as Coord),
    has_stairs: true,
    steps: Number(w.tags?.step_count ?? 0) || undefined,
  }));

console.log(`${extraEdges.length} OSM stair ways in the campus bbox`);

writeFileSync(
  OUT,
  JSON.stringify({ steep: steep.sort(), extraEdges }, null, 2),
);
console.log(`-> ${OUT}`);
