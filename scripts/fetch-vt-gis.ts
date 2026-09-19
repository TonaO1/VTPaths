// Pulls VT's Access Route layer (the pedestrian accessible-path network).
// READ ONLY. GET /query and nothing else, ever. See AGENTS.md rule 1.

import { writeFileSync } from 'node:fs';

const BASE =
  'https://arcgis-central.gis.vt.edu/arcgis/rest/services/vtcampusmap';
const ROUTES = `${BASE}/Accessibility/FeatureServer/4/query`;
const BUILDINGS = `${BASE}/Buildings/FeatureServer/0/query`;
const ROUTES_OUT = 'data/raw-access-route.geojson';
const BUILDINGS_OUT = 'data/raw-buildings.json';

interface Feature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null;
  properties: Record<string, unknown>;
}

// outSR=4326 is mandatory on anything with geometry: the native SR is 102747
// (Virginia State Plane, feet) and Mapbox silently renders nothing without
// reprojection.
async function queryAll<T>(
  endpoint: string,
  extra: Record<string, string>,
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;

  for (;;) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      ...extra,
      resultOffset: String(offset),
    });
    const res = await fetch(`${endpoint}?${params}`);
    if (!res.ok) throw new Error(`ArcGIS ${res.status} at offset ${offset}`);

    const page = (await res.json()) as {
      features: T[];
      exceededTransferLimit?: boolean;
    };
    out.push(...page.features);

    // MaxRecordCount is 2000, so a full page means there is more behind it.
    if (!page.exceededTransferLimit || page.features.length === 0) return out;
    offset += page.features.length;
  }
}

const routes = await queryAll<Feature>(ROUTES, {
  returnGeometry: 'true',
  outSR: '4326',
  f: 'geojson',
});
writeFileSync(
  ROUTES_OUT,
  JSON.stringify({ type: 'FeatureCollection', features: routes }),
);
console.log(`${routes.length} access route features -> ${ROUTES_OUT}`);

// Buildings carry latitude/longitude as plain attributes, so there is no
// geometry to reproject and no polygon to carry around.
const buildings = await queryAll<{ attributes: Record<string, unknown> }>(
  BUILDINGS,
  { returnGeometry: 'false', f: 'json' },
);
writeFileSync(BUILDINGS_OUT, JSON.stringify(buildings.map((b) => b.attributes)));
console.log(`${buildings.length} buildings -> ${BUILDINGS_OUT}`);
