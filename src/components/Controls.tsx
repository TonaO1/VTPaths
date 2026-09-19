import type { Prefs } from '../lib/types';

interface Props {
  buildings: { id: string; name: string }[];
  from: string;
  to: string;
  prefs: Prefs;
  onFrom: (id: string) => void;
  onTo: (id: string) => void;
  onPrefs: (prefs: Prefs) => void;
}

// Typeahead with a native <datalist>: the browser filters as you type, so there
// is no combobox dependency and no keyboard handling to get wrong. The visible
// value is the building name; the id is resolved on change.
function Field({
  label,
  dot,
  value,
  buildings,
  onChange,
}: {
  label: string;
  dot: string;
  value: string;
  buildings: { id: string; name: string }[];
  onChange: (id: string) => void;
}) {
  const current = buildings.find((b) => b.id === value)?.name ?? '';

  return (
    <div className="field">
      <span className={`dot ${dot}`} />
      <input
        type="text"
        className="search"
        list="vtpaths-buildings"
        placeholder={label}
        aria-label={label}
        defaultValue={current}
        key={current}
        onChange={(e) => {
          const match = buildings.find((b) => b.name === e.target.value);
          if (match) onChange(match.id);
          else if (e.target.value === '') onChange('');
        }}
      />
    </div>
  );
}

export default function Controls({
  buildings,
  from,
  to,
  prefs,
  onFrom,
  onTo,
  onPrefs,
}: Props) {
  return (
    <div className="panel controls">
      <datalist id="vtpaths-buildings">
        {buildings.map((b) => (
          <option key={b.id} value={b.name} />
        ))}
      </datalist>

      <Field
        label="Search a starting point"
        dot="dot-start"
        value={from}
        buildings={buildings}
        onChange={onFrom}
      />
      <Field
        label="Search a destination"
        dot="dot-end"
        value={to}
        buildings={buildings}
        onChange={onTo}
      />

      <div className="toggles">
        <button
          type="button"
          className={prefs.avoidStairs ? 'chip chip-on' : 'chip'}
          aria-pressed={prefs.avoidStairs}
          onClick={() => onPrefs({ ...prefs, avoidStairs: !prefs.avoidStairs })}
        >
          No stairs
        </button>
        <button
          type="button"
          className={prefs.avoidSteep ? 'chip chip-on' : 'chip'}
          aria-pressed={prefs.avoidSteep}
          onClick={() => onPrefs({ ...prefs, avoidSteep: !prefs.avoidSteep })}
        >
          No steep grades
        </button>
      </div>

      <p className="hint">
        Or click any path on the map to report a barrier there.
      </p>
    </div>
  );
}
