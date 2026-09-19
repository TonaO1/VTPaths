# AGENTS.md

Working agreement for any AI coding agent in this repo. Read `CONTEXT.md` first
for what the project is and why.

## Commands

```bash
npm install
npm run dev        # vite dev server
npm run build      # tsc && vite build
npm test           # vitest, routing logic only
npm run fetch-gis  # scripts/fetch-vt-gis.ts  -> data/raw-access-route.geojson
npm run build-graph # scripts/build-graph.ts  -> src/data/campus.geojson
```

## Environment

`.env.local`, and the same keys in Vercel's Project Settings -> Environment
Variables:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_MAPBOX_TOKEN=
```

Vite only exposes vars prefixed `VITE_`. A missing one fails silently in
production while working fine locally, so verify against the deployed URL, not
just localhost.

## Hosting

Vercel. Git push to `main` deploys. Do not add `netlify.toml`, a Dockerfile, or
any other platform's config.

`/report` is a client-side route with no file behind it, so a hard refresh or a
QR scan straight to it 404s without an SPA rewrite. `vercel.json` at the repo
root:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

## Hard rules

1. **Never write to any VT ArcGIS endpoint.** GET `/query` only. No applyEdits,
   addFeatures, updateFeatures, deleteFeatures, or any other mutating call, not
   even to test. If a task seems to need one, stop and say so.
2. **Never add a feature outside the four in CONTEXT.md.** If a change request
   implies free-text input, photo upload, auth, 3D, or bike/scooter-specific
   routing, stop and flag it instead of building it.
3. **Never introduce free-form user text.** Report types are a fixed enum. This
   is a deliberate product decision, not an oversight: unmoderated text appears
   on a projector in front of judges.
4. **`src/lib/types.ts` is a contract.** Three people build against it in
   parallel. Changing an exported interface breaks other people's in-flight
   work. Propose the change, do not just make it.
5. **No new dependencies without asking.** The stack is fixed and install time
   is not free during a 12-hour build.

## Programming paradigms

- **If a problem can be solved without a new library, package, or extension,
  solve it that way.** The standard library, the browser platform, and the
  four deps already in the stack cover more than it looks like they do. A
  hand-written 30-line Dijkstra beats pulling in a graph library.
- **Write the simplest, most concise code that works.** Fewest moving parts,
  fewest layers, fewest concepts a teammate has to hold in their head at 3 AM.
- No abstraction for a second use case that does not exist. No config objects
  with one caller. No wrapper around a function that is already the right shape.
- Concise is not the same as clever. Short and obvious beats short and dense.

## Code conventions

- TypeScript, strict. No `any`. Prefer explicit return types on exported
  functions.
- Functional components with hooks. No class components.
- No state management library. `App.tsx` owns state, everything below receives
  props.
- Pure functions in `src/lib/`. They must not read React state, the network, or
  the Supabase client directly. `buildGraph` takes reports as an argument; it
  does not fetch them.
- Side effects live in `src/lib/reports.ts` and `App.tsx`, nowhere else.
- Named exports. Default exports only for React components.
- No comments restating what code does. Comment only non-obvious decisions
  (a coordinate transform, a snapping tolerance, a Supabase quirk).

## Testing

Only `graph.ts` and `route.ts` are tested. Everything else is validated by
looking at it, because there is no time.

A routing test must not depend on `campus.geojson`. Use a small hand-written
fixture graph. The test suite should stay under a second.

Minimum coverage:
- shortest path on a trivial graph
- `avoidStairs` forces the longer path
- a reported edge is avoided
- two reports on an edge make it impassable
- no path available returns a null-ish result rather than throwing

## Git

- **Never commit directly to `main`.** Every change goes on a branch named for
  its track (`data/...`, `routing/...`, `ui/...`, `setup/...`, `fix/...`).
- **Check the current branch before every edit.** `git branch --show-current`.
  An edit made on the wrong branch is worse than a slow edit.
- Open a PR for every branch. Keep the description to what changed and what to
  look at.
- **Never merge to `main` without the repo owner's explicit permission.** Not
  even a green PR, not even a one-line fix. Ask, then merge.
- Commit early and often. Small commits, present-tense messages.
- Never commit `.env.local`.
- Never force push.
- If the build breaks on `main`, fixing it is the highest priority task for
  whoever notices.

## Error handling

Everything user-facing degrades to something visible rather than a blank screen:

- Supabase unreachable -> routing still works, the alert panel shows an offline
  state.
- No route found -> a message in the sidebar, not a crash.
- Mapbox token invalid -> log loudly; falling back to MapLibre is a known
  escape hatch.

## Performance

Do not optimize anything. The graph has a few hundred edges and the reports
table has a handful of rows. Dijkstra running on every render is fine and
simpler than memoizing it. Revisit only if something is visibly slow.

## Scope discipline

This is a 12-hour build with a hard deadline and a live demo. When a task could
be done well or done now, do it now and note the shortcut in the reply. Do not
refactor working code. Do not add abstraction for a second use case that does
not exist yet.
