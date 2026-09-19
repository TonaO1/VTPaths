import type { Report } from '../lib/types';

interface Props {
  reports: Report[];
  online: boolean;
  onReset: () => void;
}

const LABELS: Record<string, string> = {
  blocked: 'Path blocked',
  elevator_out: 'Elevator out',
  construction: 'Construction',
  ice: 'Ice',
  crowded: 'Crowded',
};

export default function AlertPanel({ reports, online, onReset }: Props) {
  return (
    <section className="alerts">
      <h2>Live reports</h2>

      {!online && <p className="offline">Offline &mdash; routing still works.</p>}

      {reports.length === 0 ? (
        <p>No barriers reported.</p>
      ) : (
        <ul>
          {[...reports]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((r) => (
              <li key={r.edge_id}>
                <strong>{LABELS[r.type] ?? r.type}</strong>
                <span> {r.edge_id}</span>
                {r.count > 1 && <span className="count"> &times;{r.count}</span>}
              </li>
            ))}
        </ul>
      )}

      {/* Demo-critical: the map fills with dead edges by the fourth judge. */}
      <button onClick={onReset}>Reset all reports</button>
    </section>
  );
}
