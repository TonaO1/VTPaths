import { countdown, remaining } from '../lib/expiry';
import type { Report, ReportType } from '../lib/types';

interface Props {
  reports: Report[];
  online: boolean;
  onReset: () => void;
  onFocus: (edgeId: string) => void;
  /** Passed in rather than read from the clock, to keep this a pure render. */
  now: number;
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

/**
 * Newest few only. The count in the heading is the real total; a list that
 * grows with every report would eat the screen by the fourth judge, and the
 * ones worth reading are the ones that just landed.
 */
const MAX_VISIBLE = 4;

export default function AlertPanel({
  reports,
  online,
  onReset,
  onFocus,
  now,
}: Props) {
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
          .slice(0, MAX_VISIBLE)
          .map((r) => (
            <li key={r.edge_id}>
              <button
                type="button"
                className="alert-item"
                onClick={() => onFocus(r.edge_id)}
                aria-label={`Show ${label(r.type)} on ${r.edge_id} on the map`}
              >
                <strong>{label(r.type)}</strong>
                {r.note ? (
                  <span className="note">&ldquo;{r.note}&rdquo;</span>
                ) : (
                  <span className="seg">{r.edge_id}</span>
                )}
                <span className="meta">
                  {r.count > 1 && <span className="count">{r.count} reports</span>}
                  <span className="ttl">{countdown(remaining(r, now))} left</span>
                </span>
              </button>
            </li>
          ))}
      </ul>

      {reports.length > MAX_VISIBLE && (
        <p className="more">
          and {reports.length - MAX_VISIBLE} more on the map
        </p>
      )}

      {/* Demo-critical: the map fills with dead edges by the fourth judge. */}
      <button className="reset" onClick={onReset}>
        Reset all
      </button>
    </div>
  );
}
