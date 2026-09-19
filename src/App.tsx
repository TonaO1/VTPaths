import { useEffect, useState } from 'react';
import AlertPanel from './components/AlertPanel';
import Controls from './components/Controls';
import MapView from './components/Map';
import campusUrl from './data/campus.geojson?url';
import { buildGraph, type CampusGeoJSON } from './lib/graph';
import { clearAllReports, subscribeReports } from './lib/reports';
import { findRoute } from './lib/route';
import { supabase } from './lib/supabase';
import type { Prefs, Report } from './lib/types';

// Owns all state. Everything below is a pure function of props: a report lands,
// `reports` changes, the graph is rebuilt, the route is recomputed, the map
// redraws. Nothing imperatively calls "redraw".
export default function App() {
  const [campus, setCampus] = useState<CampusGeoJSON | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [prefs, setPrefs] = useState<Prefs>({
    avoidStairs: true,
    avoidSteep: false,
  });

  // Fetched rather than imported: the graph is ~880 KB and has no business
  // sitting in the JS bundle.
  useEffect(() => {
    void fetch(campusUrl)
      .then((r) => r.json())
      .then(setCampus)
      .catch((e: unknown) => console.error('campus.geojson', e));
  }, []);

  useEffect(() => subscribeReports(setReports), []);

  if (!campus) return <main>Loading campus&hellip;</main>;

  const graph = buildGraph(campus, reports, prefs);
  const route = from && to ? findRoute(graph, from, to) : null;

  const buildings = [...graph.nodes.values()]
    .filter((n) => n.building)
    .map((n) => ({ id: n.id, name: n.building! }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="app">
      <h1>VTPaths</h1>

      <Controls
        buildings={buildings}
        from={from}
        to={to}
        prefs={prefs}
        onFrom={setFrom}
        onTo={setTo}
        onPrefs={setPrefs}
      />

      <MapView campus={campus} graph={graph} route={route} reports={reports} />

      <section className="route">
        {!from || !to ? (
          <p>Pick a start and a destination.</p>
        ) : route ? (
          <p>
            <strong>{Math.round(route.distance)} m</strong> &middot;{' '}
            {route.edgeIds.length} segments
          </p>
        ) : (
          <p>No step-free route between those two points right now.</p>
        )}
      </section>

      <AlertPanel
        reports={reports}
        online={supabase !== null}
        onReset={() => void clearAllReports()}
      />
    </main>
  );
}
