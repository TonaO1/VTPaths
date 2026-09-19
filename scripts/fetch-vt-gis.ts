// Pulls VT's Access Route layer (the pedestrian accessible-path network).
// READ ONLY. GET /query and nothing else, ever. See AGENTS.md rule 1.

import { writeFileSync } from 'node:fs';

const LAYER =
  'https://arcgis-central.gis.vt.edu/arcgis/rest/services/vtcampusmap/Accessibility/FeatureServer/4/query';
const OUT = 'data/raw-access-route.geojson';

interface Feature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null;
  properties: Record<string, unknown>;
}

// outSR=4326 is mandatory: the native SR is 102747 (Virginia State Plane, feet)
// and Mapbox silently renders nothing without reprojection.
function url(offset: number): string {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    resultOffset: String(offset),
  });
  return `${LAYER}?${params}`;
}

const features: Feature[] = [];
let offset = 0;

for (;;) {
  const res = await fetch(url(offset));
  if (!res.ok) throw new Error(`ArcGIS ${res.status} at offset ${offset}`);

  const page = (await res.json()) as {
    features: Feature[];
    exceededTransferLimit?: boolean;
  };

  features.push(...page.features);
  console.log(`offset ${offset}: +${page.features.length} (${features.length})`);

  // MaxRecordCount is 2000, so a full page means there is more behind it.
  if (!page.exceededTransferLimit || page.features.length === 0) break;
  offset += page.features.length;
}

writeFileSync(
  OUT,
  JSON.stringify({ type: 'FeatureCollection', features }, null, 0),
);
console.log(`${features.length} features -> ${OUT}`);
