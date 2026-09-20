import { useEffect, useRef, useState } from 'react';
import About from './components/About';
import AlertPanel, { label } from './components/AlertPanel';
import Controls, { type Endpoint } from './components/Controls';
import Directions from './components/Directions';
// Imported as MapView: `Map` would shadow the global Map constructor.
import MapView, { type Focus, type Theme } from './components/Map';
import ReportPopover from './components/ReportPopover';
import campusUrl from './data/campus.geojson?url';
import { largestComponent } from './lib/components';
import { activeReports } from './lib/expiry';
import { nearestNode } from './lib/nearest';
import { buildGraph, type CampusGeoJSON } from './lib/graph';
import { clearAllReports, submitReport, subscribeReports } from './lib/reports';
import { findRoute } from './lib/route';
import { supabase } from './lib/supabase';
import { minutes, usDistance } from './lib/directions';
import { useCountUp } from './lib/useCountUp';
import type { Prefs, Report, ReportType } from './lib/types';

// Owns all state. Everything below is a pure function of props: a report lands,
// `reports` changes, the graph is rebuilt, the route is recomputed, the map
// redraws. Nothing imperatively calls "redraw".
export default function App() {
  const [campus, setCampus] = useState<CampusGeoJSON | null>(null);
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [from, setFrom] = useState<Endpoint | null>(null);
  const [to, setTo] = useState<Endpoint | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({
    avoidStairs: true,
    avoidSteep: false,
    strict: false,
    avoidCrowds: false,
  });
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<Report | null>(null);
  const [theme, setTheme] = useState<Theme>('light');
  const [picked, setPicked] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [about, setAbout] = useState(false);
  const [notice, setNotice] = useState('');
  const seen = useRef<Set<string> | null>(null);

  // Fetched rather than imported: the graph is ~880 KB and has no business
  // sitting in the JS bundle.
  useEffect(() => {
    void fetch(campusUrl)
      .then((r) => r.json())
      .then(setCampus)
      .catch((e: unknown) => console.error('campus.geojson', e));
  }, []);

  useEffect(() => subscribeReports(setAllReports), []);

  // Reports expire on a timer, so the graph has to be rebuilt as time passes
  // and not only when something else happens to re-render.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Expired reports stop routing, stop drawing and stop being announced, so
  // everything below works from the live set rather than the raw table.
  const reports = activeReports(allReports, now);

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
  const route =
    graph && from && to ? findRoute(graph, from.nodeId, to.nodeId) : null;
  const metres = useCountUp(route?.distance ?? 0);

  if (!campus || !graph) {
    return (
      <div className="boot">
        <span className="boot-mark">VTPaths</span>
        <span className="boot-note">Loading campus paths&hellip;</span>
      </div>
    );
  }

  // Only offer places that can actually be routed to. VT's network has ~119
  // components; a point snapped onto a stranded fragment looks fine and then
  // never finds a route.
  const routableIds = largestComponent(graph.nodes, graph.edges);
  const routable = new Map(
    [...graph.nodes].filter(([id]) => routableIds.has(id)),
  );

  const buildings = [...graph.nodes.values()]
    .filter((n) => n.building)
    .map((n) => ({ id: n.id, name: n.building! }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="app">
      <MapView
        edges={[...graph.edges.values()]}
        route={route}
        reports={reports}
        from={from ? graph.nodes.get(from.nodeId) : undefined}
        to={to ? graph.nodes.get(to.nodeId) : undefined}
        theme={theme}
        focus={focus}
        onPickEdge={setPicked}
        onLocate={(point) => {
          // A fix anywhere in Blacksburg is useless unless it lands on the
          // routable network, so snap it or say plainly that we cannot.
          const node = nearestNode(point, routable.values());
          if (!node) {
            setNotice('You are too far from a mapped accessible path to route from here.');
            setTimeout(() => setNotice(''), 5000);
            return;
          }
          setNotice('');
          setFrom({ nodeId: node.id, label: 'My location' });
        }}
      />

      <nav className="navbar">
        <div className="nav-brand">
          <h1>VTPaths</h1>
          <p>Step-free routing, updated by students</p>
        </div>
        <div className="nav-actions">
          <button
            className="theme"
            aria-expanded={about}
            onClick={() => setAbout(!about)}
          >
            About
          </button>
          <button
            className="theme"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} map`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </nav>

      <div className="stack stack-left">
        {notice && <p className="panel notice">{notice}</p>}

        <Controls
          buildings={buildings}
          nodes={routable}
          from={from}
          to={to}
          prefs={prefs}
          onFrom={setFrom}
          onTo={setTo}
          onPrefs={setPrefs}
        />

        {picked && (
          <ReportPopover
            edgeId={picked}
            onClose={() => setPicked(null)}
            onSubmit={(type: ReportType, note: string) => {
              void submitReport(picked, type, note);
              setPicked(null);
            }}
          />
        )}

        {route && <Directions route={route} />}
      </div>

      <div className="stack stack-right">
        {about && <About onClose={() => setAbout(false)} />}

        <AlertPanel
          reports={reports}
          online={supabase !== null}
          now={now}
          onFocus={(edgeId) =>
            setFocus((f) => ({ edgeId, nonce: (f?.nonce ?? 0) + 1 }))
          }
          onReset={() => {
            setFocus(null);
            void clearAllReports();
          }}
        />
      </div>

      <div className="readout">
        {from && to && route ? (
          <>
            <span className="distance">{usDistance(metres).value}</span>
            <span className="unit">{usDistance(metres).unit}</span>
            <span className="sub">
              {minutes(metres)} min &middot; {route.edgeIds.length} segments
              &middot; step-free
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
            {toast.note ? toast.note : `Reported on ${toast.edge_id}`} &mdash;
            rerouting
          </span>
        </div>
      )}
    </div>
  );
}
