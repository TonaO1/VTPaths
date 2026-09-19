import { useState } from 'react';
import { submitReport } from '../lib/reports';
import { REPORT_TYPES, type ReportType } from '../lib/types';

// The /report phone view. Must work standalone, without the map rendering.
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
    <main>
      <h1>Report a barrier</h1>
      <label>
        Path segment
        <input value={edgeId} onChange={(e) => setEdgeId(e.target.value)} />
      </label>
      {REPORT_TYPES.map((type) => (
        <button key={type} disabled={!edgeId} onClick={() => void report(type)}>
          {type.replace('_', ' ')}
        </button>
      ))}
      {sent && <p>Reported: {sent.replace('_', ' ')}</p>}
    </main>
  );
}
