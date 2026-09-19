import { useState } from 'react';
import { submitReport } from '../lib/reports';
import { REPORT_TYPES, type ReportType } from '../lib/types';
import { label } from './AlertPanel';

// The /report phone view. Held at arm's length, tapped mid-sentence, and it
// must work with no map rendered.
export default function ReportForm() {
  const [edgeId, setEdgeId] = useState(
    new URLSearchParams(window.location.search).get('edge') ?? '',
  );
  const [sent, setSent] = useState<ReportType | null>(null);

  async function report(type: ReportType) {
    await submitReport(edgeId, type);
    setSent(type);
  }

  return (
    <main className="report">
      <h1>What's in the way?</h1>

      <label className="seg-field">
        Path segment
        <input
          type="text"
          value={edgeId}
          placeholder="E6635"
          onChange={(e) => setEdgeId(e.target.value)}
        />
      </label>

      <div className="report-buttons">
        {REPORT_TYPES.map((type) => (
          <button key={type} disabled={!edgeId} onClick={() => void report(type)}>
            {label(type)}
          </button>
        ))}
      </div>

      {sent && (
        <p className="sent">
          Reported &mdash; everyone&rsquo;s route just updated.
        </p>
      )}
    </main>
  );
}
