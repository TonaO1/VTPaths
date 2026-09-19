# VTPaths

Step-free routing across the Virginia Tech campus that reroutes every open
client in real time when a student reports a barrier.

Read `CONTEXT.md` for what this is and why, `AGENTS.md` for the working
agreement.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Mapbox keys
npm run dev
```

Run `supabase/schema.sql` once in the Supabase SQL editor. All three statements
matter: RLS blocks anon writes until disabled, and realtime is off per-table.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build`, must pass before anything is "done" |
| `npm test` | Vitest, routing logic only |
| `npm run fetch-gis` | Query VT ArcGIS &rarr; `data/raw-access-route.geojson` |
| `npm run build-graph` | Snap polylines &rarr; `src/data/campus.geojson` |

The two script commands use Node's built-in TypeScript stripping, so there is no
`ts-node`/`tsx` dependency.

## Routes

`/` is the laptop view and the product as far as judging goes. `/report` is the
phone view and must work without the map. Both are served by `index.html`; the
`vercel.json` rewrite is what keeps `/report` from 404ing on a QR scan.
