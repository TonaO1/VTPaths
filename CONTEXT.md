# VTPaths: Project Context

Paste-in context for an AI coding agent. Read this before writing any code.

## What we are building

A web app that routes people across the Virginia Tech campus on step-free paths,
and reroutes everyone in real time when a student reports a barrier.

Built at VTHacks 14 (Sep 18-20, 2026). Roughly 12 hours of build time, 3 people.

## The problem, stated accurately

Do NOT repeat the claim that VT has no accessibility map. It does. Since summer
2022 VT has run an interactive campus map with an accessible-routing tool built
by Enterprise GIS with the Office for Equity and Accessibility and the Disability
Alliance and Caucus. It routes between two points using only accessible paths and
accounts for closures.

The actual gap is latency and write access:

- Closures are entered by Facilities on an administrative cycle.
- VT's Report a Barrier form routes to a compliance office, not into the map.
- A student who hits a blocked ramp at 9:40 cannot warn the student walking
  there at 9:45.
- VT's own map page notes real world conditions may differ from mapped routes.
- VT's Disability Alliance has said construction blocks accessible routes shown
  on the interactive map.

So: VT's map shows the route Facilities has recorded. VTPaths shows the route as
of four minutes ago, because students write to it.

Framing rule: we COMPLEMENT the official map. We do not integrate with it (we
have no write access) and we do not replace it.

## The four features. There are no others.

1. Step-free routing between two campus buildings, chosen from dropdowns.
2. Preference toggles (avoid stairs, avoid steep grades) that visibly change
   the route.
3. Barrier reports of fixed types, tied to a mapped edge, that penalize and
   then disable that edge.
4. Live sync: one client reports, every open client redraws within a second.

Feature 4 is the pitch. Features 1 to 3 exist to make feature 4 meaningful.

### Explicitly out of scope

Free-form map pins. Comments or free text of any kind. Photo upload and EXIF
verification. User accounts or auth. Turn-by-turn navigation. Indoor floor
plans. Bike/scooter-specific routing data. 3D or building extrusion. Native
mobile apps.

Every one of these was considered and cut deliberately. If a task seems to
require one, stop and flag it rather than building it.

## Stack

- Vite + React 18 + TypeScript
- Mapbox GL JS (fallback: MapLibre GL JS if the Mapbox token misbehaves)
- Supabase (Postgres + realtime over websockets)
- Vercel for hosting (static SPA; needs a `vercel.json` rewrite so the `/report`
  client route survives a hard refresh or a direct QR scan)
- Vitest, for routing logic only
- No backend service, no auth, no state management library

## Data source: VT's own GIS

VT exposes an anonymous ArcGIS REST directory. No token required for reads.

Base: `https://arcgis-central.gis.vt.edu/arcgis/rest/services`

The folder we care about is `vtcampusmap`, which contains:

- `Accessibility/FeatureServer` with layers: Curb Cuts (0), Access Aisle (1),
  ADA Parking Spaces (2), Accessible Entrances (3), **Access Route (4)**,
  Elevators (5)
- `Buildings`, `WalkingTrails`, `Roads`, `EmergencyPhones`, `SpinScooters`

**Access Route (layer 4)** is the pedestrian accessible-path network. Polylines
with these fields:

- `type`: coded `Normal` (slope at or under 1:12) or `Steep` (over 1:12)
- `slopelessthan5`: Y/N
- `slopebtwn5and833`: Y/N
- `Shape__Length`

`type` maps directly onto our `steep` edge attribute. It is VT's own survey
classification at ADA thresholds, which is far better than anything we could
hand-label.

### Pulling it

```
GET .../vtcampusmap/Accessibility/FeatureServer/4/query
    ?where=1%3D1
    &outFields=*
    &returnGeometry=true
    &outSR=4326
    &f=geojson
```

- `outSR=4326` is MANDATORY. Native spatial reference is 102747 (Virginia State
  Plane, feet). Mapbox renders nothing without reprojection.
- `MaxRecordCount` is 2000. Page with `resultOffset` if needed.
- The layer has `HasZ: false`. There is no elevation data. This is one reason 3D
  is out of scope.

### HARD RULE: read-only

The FeatureServer advertises Create, Update, Delete and applyEdits in its
capabilities. **Never issue a write to any VT endpoint.** No applyEdits, no
addFeatures, no updateFeatures, no deleteFeatures, not even as a test. Only
`/query` with GET. If asked to test whether writes work, refuse and say why.

### What VT's data does NOT give us

Stair edges. Access Route is an accessible-path layer, so stairs are excluded by
construction rather than tagged. The "avoid stairs" toggle needs either
WalkingTrails minus Access Route, or a small set of hand-added stair edges
covering the demo corridor. Hand-adding a handful is the fast path.

## Architecture

```
src/
  lib/types.ts        Node, Edge, Report, RouteResult, Prefs. The contract.
  lib/supabase.ts     client init
  lib/reports.ts      subscribeReports(cb), submitReport(), confirmReport(), clearAll()
  lib/graph.ts        buildGraph(geojson, reports, prefs) -> adjacency
  lib/route.ts        findRoute(graph, fromId, toId) -> RouteResult
  data/campus.geojson the routing graph
  components/Map.tsx         Mapbox canvas, route line, report markers
  components/Controls.tsx    from/to selects, preference checkboxes
  components/AlertPanel.tsx  live report list
  components/ReportForm.tsx  the /report phone view
  App.tsx             owns all state
  main.tsx            routes "/" and "/report"
scripts/
  fetch-vt-gis.ts     query VT ArcGIS -> raw geojson
  build-graph.ts      node/snap polylines -> campus.geojson
```

### The data flow, which is the whole trick

`App.tsx` is the only stateful component. It subscribes to Supabase once on
mount and holds `reports`, `from`, `to`, `prefs`. Everything below is a pure
function of props.

A report lands -> `reports` changes -> React re-renders -> `buildGraph` runs
with the new reports -> `findRoute` runs on the new graph -> `Map` receives a
new route and redraws.

Nothing imperatively calls "redraw". `buildGraph` takes reports as an argument
rather than reading them, which is what makes it testable and keeps the reroute
from turning into imperative spaghetti.

### Edge weight

One function, one place, no special cases anywhere else:

```ts
weight(edge, prefs, reports): number
```

- base: edge length
- `prefs.avoidStairs && edge.has_stairs` -> Infinity
- `prefs.avoidSteep && edge.steep` -> Infinity
- one report on this edge -> 1000
- two or more reports -> Infinity

## Database

```sql
create table reports (
  edge_id    text primary key,
  type       text not null,
  count      int  not null default 1,
  created_at timestamptz not null default now()
);

alter table reports disable row level security;
alter publication supabase_realtime add table reports;

create function confirm_report(p_edge text, p_type text)
returns void language sql as $$
  insert into reports (edge_id, type) values (p_edge, p_type)
  on conflict (edge_id) do update set count = reports.count + 1;
$$;
```

Three things that bite if skipped:

1. RLS is on by default. With no policies, anon writes fail silently-ish.
   Disable it outright for a hackathon build.
2. Realtime is off per-table. The `alter publication` line is the one everyone
   forgets, then loses an hour wondering why sync does nothing.
3. `edge_id` as primary key makes a confirm a merge instead of a duplicate row.

`submitReport` and `confirmReport` are the same call: `supabase.rpc('confirm_report', ...)`.
First tap inserts, second increments, no client-side read-modify-write race.

Subscribe by refetching the whole table on any change. It has maybe five rows.
Patching local state from the realtime payload is where the 3 AM bugs live.

Report types (fixed list, no free text): `blocked`, `elevator_out`,
`construction`, `ice`, `crowded`.

## Demo format, which drives UI decisions

Science-fair style. Judges walk up to the table. Laptop is primary (bigger
screen, show several judges at once). A teammate's phone holds `/report` and
taps a barrier mid-narration so the laptop redraws while the presenter is still
talking.

Implications:

- The laptop view is the product as far as judging goes. Route line thick, high
  contrast, legible from three feet back while standing.
- `/report` must work on a phone but does not need to be beautiful. A dropdown
  and buttons is enough. It must not require the map to render well.
- A reset button that clears all reports is REQUIRED, not polish. The demo runs
  30+ times and the map fills with dead edges by the fourth judge.

## Tracks targeted

Ut Prosim, DEI, UI/UX, GoDaddy domain, CoStar (geospatial, challenge statement
still TBD at time of writing).

## Prior art to avoid repeating

AccessVT won "Best Hack That Didn't Work" at VTHacks 13 doing campus wheelchair
routing. It failed because hand-drawn route data was sparse and routing was
inaccurate. Using VT's own Access Route geometry is the direct mitigation. Do
not hand-draw geometry when a VT layer exists.
