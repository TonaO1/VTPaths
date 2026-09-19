import { useEffect, useState } from 'react';
import { clearAllReports, subscribeReports } from './lib/reports';
import type { Prefs, Report } from './lib/types';

// Owns all state. Everything below is a pure function of props: a report lands,
// `reports` changes, the graph is rebuilt, the route is recomputed, the map
// redraws. Nothing imperatively calls "redraw".
export default function App() {
  const [reports, setReports] = useState<Report[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [prefs, setPrefs] = useState<Prefs>({
    avoidStairs: true,
    avoidSteep: false,
  });

  useEffect(() => subscribeReports(setReports), []);

  return (
    <main>
      <h1>VTPaths</h1>
      <p>
        Scaffold only. Controls, Map and AlertPanel land with the UI track;
        routing lands with <code>graph.ts</code> and <code>route.ts</code>.
      </p>
      <p>
        {from || '(from)'} &rarr; {to || '(to)'} &middot; stairs:{' '}
        {String(prefs.avoidStairs)} &middot; steep: {String(prefs.avoidSteep)}
      </p>
      <p>{reports.length} active report(s)</p>
      <button onClick={() => void clearAllReports()}>Reset reports</button>
      {/* Keeps the state setters used until the UI track wires the controls. */}
      <button onClick={() => { setFrom(''); setTo(''); setPrefs(prefs); }}>
        Clear selection
      </button>
    </main>
  );
}
