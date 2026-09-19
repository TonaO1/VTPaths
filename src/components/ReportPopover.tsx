import { useState } from 'react';
import { NOTE_LIMIT } from '../lib/reports';
import { REPORT_TYPES, type ReportType } from '../lib/types';
import { label } from './AlertPanel';

interface Props {
  edgeId: string;
  onSubmit: (type: ReportType, note: string) => void;
  onClose: () => void;
}

// Opened by clicking a path on the map. The barrier kind stays a fixed enum
// because it is what drives routing; the note is detail a router cannot use
// but a person walking there can.
export default function ReportPopover({ edgeId, onSubmit, onClose }: Props) {
  const [note, setNote] = useState('');

  return (
    <div className="panel popover">
      <div className="popover-head">
        <h2>Report on this path</h2>
        <button className="close" aria-label="Cancel" onClick={onClose}>
          &times;
        </button>
      </div>

      <p className="seg">{edgeId}</p>

      <label className="note-field">
        Detail (optional)
        <input
          type="text"
          value={note}
          maxLength={NOTE_LIMIT}
          placeholder="Corner closed, people walking in the road"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="popover-buttons">
        {REPORT_TYPES.map((type) => (
          <button key={type} onClick={() => onSubmit(type, note)}>
            {label(type)}
          </button>
        ))}
      </div>
    </div>
  );
}
