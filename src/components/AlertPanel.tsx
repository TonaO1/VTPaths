import type { Report, ReportType } from '../lib/types';

interface Props {
  reports: Report[];
  online: boolean;
  onReset: () => void;
}

const LABELS: Record<ReportType, string> = {
  blocked: 'Path blocked',
  elevator_out: 'Elevator out',
  construction: 'Construction',
  ice: 'Ice',
  crowded: 'Crowded',
};

export function label(type: string): string {
  return LABELS[type as ReportType] ?? type;
}

export default function AlertPanel({ reports, online, onReset }: Props) {
  // Empty state is nothing at all, not a box announcing its own emptiness.
  if (reports.length === 0) {
    return online ? null : (
      <div className="panel alerts">
        <p className="offline">Offline &mdash; routing still works</p>
      </div>
    );
  }

  return (
    <div className="panel alerts">
      <div className="alerts-head">
        <span className="pulse" />
        <h2>
          {reports.length} active {reports.length === 1 ? 'barrier' : 'barriers'}
        </h2>
      </div>

      <ul>
        {[...reports]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((r) => (
            <li key={r.edge_id}>
              <strong>{label(r.type)}</strong>
              {r.note ? (
                <span className="note">&ldquo;{r.note}&rdquo;</span>
              ) : (
                <span className="seg">{r.edge_id}</span>
              )}
              {r.count > 1 && <span className="count">{r.count} reports</span>}
            </li>
          ))}
      </ul>

      {/* Demo-critical: the map fills with dead edges by the fourth judge. */}
      <button className="reset" onClick={onReset}>
        Reset all
      </button>
    </div>
  );
}
