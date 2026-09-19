# CLAUDE.md

Read `AGENTS.md` for the working agreement (commands, conventions, hard rules)
and `CONTEXT.md` for what this project is. Everything in both applies. This file
covers what is specific to working with Claude Code here.

## Situation

Hackathon build. 12 hours, hard deadline, live demo at the end. Three people
committing to `main` at the same time. Optimize for working software over clean
software, and for not blocking teammates over being thorough.

## Before you change anything

Check whether the file you are about to touch belongs to someone else's track:

- `src/data/campus.geojson` and `scripts/` are the data track.
- `src/lib/graph.ts`, `src/lib/route.ts` are the routing track.
- `src/components/`, `src/App.tsx` are the UI track.

`src/lib/types.ts` belongs to everyone. Do not change an exported interface
without saying so first.

## How to work

- Make the smallest change that satisfies the request. Do not clean up nearby
  code, rename things, or restructure while you are in there.
- If a request is ambiguous, pick the interpretation that ships sooner and say
  which one you picked in one line. Do not ask a clarifying question when a
  reasonable default exists.
- If you notice something broken outside the current task, mention it, do not
  fix it.
- Run `npm test` after touching `graph.ts` or `route.ts`. Run `npm run build`
  before declaring anything done.

## Push back when it matters

Say so plainly, in one or two sentences, when:

- A request would add a feature listed as out of scope in `CONTEXT.md`.
- A request would require writing to a VT ArcGIS endpoint.
- A change would break the `types.ts` contract other people are building
  against.
- A task looks like it will take more time than the remaining schedule allows.
- There is a materially simpler way to get the same demo result.

Then do what was asked if the answer is still yes. One round of pushback, not
an argument.

## Things that are easy to get wrong here

- **`outSR=4326`.** Every VT ArcGIS query needs it. Native SR is feet-based
  state plane and Mapbox silently renders nothing without reprojection.
- **Supabase realtime.** The table must be added to the `supabase_realtime`
  publication. If sync does nothing, check this before debugging anything else.
- **RLS.** On by default. Anon writes fail until it is disabled.
- **Vite env vars.** Only `VITE_`-prefixed vars reach the browser, and missing
  ones fail quietly in the Vercel build while working locally.
- **SPA rewrite.** `/report` 404s on a direct hit without the `vercel.json`
  rewrite. If a QR scan lands on a 404, check that file before anything else.
- **Graph connectivity.** VT's polylines only form a routable graph if endpoints
  snap to shared nodes. If routing returns nothing, count connected components
  before suspecting Dijkstra.
- **Reports are keyed by `edge_id`.** A second report is an upsert that
  increments `count`, never a new row.

## Demo-critical code

These exist for the live demo and must not be removed, "cleaned up", or hidden
behind a build flag:

- The reset button that clears all reports.
- The seed script that puts the demo into a known state.
- The `/report` route, which must work standalone on a phone without the map.

## What "done" means

`npm run build` passes, the change works on the deployed Vercel URL (not just
localhost), and the live reroute still happens end to end: report on one client,
route redraws on another.
