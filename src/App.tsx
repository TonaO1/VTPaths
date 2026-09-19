import { useEffect, useRef, useState } from 'react';
import AlertPanel, { label } from './components/AlertPanel';
import Controls from './components/Controls';
import Directions from './components/Directions';
import Map, { type Theme } from './components/Map';
import campusUrl from './data/campus.geojson?url';
import { buildGraph, type CampusGeoJSON } from './lib/graph';
import { clearAllReports, subscribeReports } from './lib/reports';
import { findRoute } from './lib/route';
import { supabase } from './lib/supabase';
import { feet } from './lib/directions';
import { useCountUp } from './lib/useCountUp';
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
  const [toast, setToast] = useState<Report | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [show3D, setShow3D] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  // Fetched rather than imported: the graph is ~880 KB and has no business
  // sitting in the JS bundle.
  useEffect(() => {
    void fetch(campusUrl)
      .then((r) => r.json())
      .then(setCampus)
      .catch((e: unknown) => console.error('campus.geojson', e));
  }, []);

  useEffect(() => subscribeReports(setReports), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Announce barriers that arrived after this client loaded. The first payload
  // seeds the baseline, so opening the page mid-demo does not fire five toasts.
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(reports.map((r) => r.edge_id));
      return;
    }
    const fresh = reports.find((r) => !seen.current!.has(r.edge_id));
    seen.current = new Set(reports.map((r) => r.edge_id));
    if (!fresh) return;

    setToast(fresh);
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [reports]);

  const graph = campus ? buildGraph(campus, reports, prefs) : null;
  const route = graph && from && to ? findRoute(graph, from, to) : null;
  const metres = useCountUp(route?.distance ?? 0);

  if (!campus || !graph) {
    return (
      <div className="boot">
        <span className="boot-mark">VTPaths</span>
        <span className="boot-note">Loading campus paths&hellip;</span>
      </div>
    );
  }

  const buildings = [...graph.nodes.values()]
    .filter((n) => n.building)
    .map((n) => ({ id: n.id, name: n.building! }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="app">
      <Map
        edges={[...graph.edges.values()]}
        route={route}
        reports={reports}
        from={from ? graph.nodes.get(from) : undefined}
        to={to ? graph.nodes.get(to) : undefined}
        theme={theme}
        show3D={show3D}
      />

      <div className="stack stack-left">
        <header className="brand">
          <div>
            <h1>VTPaths</h1>
            <p>Step-free routing, updated by students</p>
          </div>
          <button
            className="theme"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} map`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        <Controls
          buildings={buildings}
          from={from}
          to={to}
          prefs={prefs}
          onFrom={setFrom}
          onTo={setTo}
          onPrefs={setPrefs}
          show3D={show3D}
          onShow3D={setShow3D}
        />

        {route && <Directions route={route} />}
      </div>

      <div className="stack stack-right">
        <AlertPanel
          reports={reports}
          online={supabase !== null}
          onReset={() => void clearAllReports()}
        />
      </div>

      <div className="readout">
        {from && to && route ? (
          <>
            <span className="distance">{Math.round(metres)}</span>
            <span className="unit">m</span>
            <span className="sub">
              {Math.round(feet(metres))} ft &middot; {route.edgeIds.length}{' '}
              segments &middot; step-free
            </span>
          </>
        ) : (
          <span className="sub sub-idle">
            {from && to
              ? 'No step-free route right now'
              : 'Choose a start and a destination'}
          </span>
        )}
      </div>

      {toast && (
        <div className="toast" key={toast.edge_id}>
          <span className="toast-kind">{label(toast.type)}</span>
          <span className="toast-body">
            Reported on {toast.edge_id} &mdash; rerouting
          </span>
        </div>
      )}
    </div>
  );
}
