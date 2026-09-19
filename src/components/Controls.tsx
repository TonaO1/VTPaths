import type { Prefs } from '../lib/types';

interface Props {
  buildings: { id: string; name: string }[];
  from: string;
  to: string;
  prefs: Prefs;
  onFrom: (id: string) => void;
  onTo: (id: string) => void;
  onPrefs: (prefs: Prefs) => void;
  show3D: boolean;
  onShow3D: (show3D: boolean) => void;
}

export default function Controls({
  buildings,
  from,
  to,
  prefs,
  onFrom,
  onTo,
  onPrefs,
  show3D,
  onShow3D,
}: Props) {
  const options = buildings.map((b) => (
    <option key={b.id} value={b.id}>
      {b.name}
    </option>
  ));

  return (
    <div className="panel controls">
      <div className="field">
        <span className="dot dot-start" />
        <select value={from} onChange={(e) => onFrom(e.target.value)}>
          <option value="">Starting point</option>
          {options}
        </select>
      </div>

      <div className="field">
        <span className="dot dot-end" />
        <select value={to} onChange={(e) => onTo(e.target.value)}>
          <option value="">Destination</option>
          {options}
        </select>
      </div>

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
        <button
          type="button"
          className={show3D ? 'chip chip-on' : 'chip'}
          aria-pressed={show3D}
          onClick={() => onShow3D(!show3D)}
        >
          3D buildings
        </button>
      </div>
    </div>
  );
}
