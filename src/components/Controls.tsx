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

export default function Controls({
  buildings,
  from,
  to,
  prefs,
  onFrom,
  onTo,
  onPrefs,
}: Props) {
  const options = buildings.map((b) => (
    <option key={b.id} value={b.id}>
      {b.name}
    </option>
  ));

  return (
    <section className="controls">
      <label>
        From
        <select value={from} onChange={(e) => onFrom(e.target.value)}>
          <option value="">Choose a building</option>
          {options}
        </select>
      </label>

      <label>
        To
        <select value={to} onChange={(e) => onTo(e.target.value)}>
          <option value="">Choose a building</option>
          {options}
        </select>
      </label>

      <div className="checks">
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.avoidStairs}
            onChange={(e) => onPrefs({ ...prefs, avoidStairs: e.target.checked })}
          />
          Avoid stairs
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={prefs.avoidSteep}
            onChange={(e) => onPrefs({ ...prefs, avoidSteep: e.target.checked })}
          />
          Avoid steep grades
        </label>
      </div>
    </section>
  );
}
