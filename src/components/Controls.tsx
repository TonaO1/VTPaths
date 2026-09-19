import { useEffect, useRef, useState } from 'react';
import { searchPlaces, type Place } from '../lib/geocode';
import { nearestNode } from '../lib/nearest';
import type { Node, Prefs } from '../lib/types';

export interface Endpoint {
  nodeId: string;
  label: string;
}

interface Suggestion {
  key: string;
  name: string;
  context: string;
  /** Campus buildings resolve straight to a node; places must be snapped. */
  nodeId?: string;
  lon?: number;
  lat?: number;
}

const DEBOUNCE_MS = 250;
const MAX_LOCAL = 4;

function PlaceField({
  label,
  dot,
  value,
  buildings,
  nodes,
  onPick,
}: {
  label: string;
  dot: string;
  value: Endpoint | null;
  buildings: { id: string; name: string }[];
  nodes: Map<string, Node>;
  onPick: (endpoint: Endpoint | null) => void;
}) {
  const [text, setText] = useState(value?.label ?? '');
  const [places, setPlaces] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(value?.label ?? '');
  }, [value]);

  // Campus buildings match instantly from memory; Mapbox is asked only after
  // the typing pauses, so a five letter query is one request rather than five.
  useEffect(() => {
    if (text.trim().length < 3 || text === value?.label) {
      setPlaces([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchPlaces(text, controller.signal).then(setPlaces);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, value?.label]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const query = text.trim().toLowerCase();
  const local: Suggestion[] =
    query.length === 0
      ? []
      : buildings
          .filter((b) => b.name.toLowerCase().includes(query))
          .slice(0, MAX_LOCAL)
          .map((b) => ({
            key: b.id,
            name: b.name,
            context: 'Virginia Tech',
            nodeId: b.id,
          }));

  const localNames = new Set(local.map((l) => l.name.toLowerCase()));
  const remote: Suggestion[] = places
    .filter((p) => !localNames.has(p.name.toLowerCase()))
    .map((p) => ({
      key: p.id,
      name: p.name,
      context: p.context,
      lon: p.lon,
      lat: p.lat,
    }));

  const suggestions = [...local, ...remote].slice(0, 7);

  function choose(s: Suggestion) {
    setError('');

    if (s.nodeId) {
      onPick({ nodeId: s.nodeId, label: s.name });
      setOpen(false);
      return;
    }

    // A geocoded place can be anywhere in Blacksburg, so it has to be attached
    // to the accessible network before it can be routed to.
    const node = nearestNode([s.lon!, s.lat!], nodes.values(), 150);
    if (!node) {
      setError(`${s.name} is not near any mapped accessible path`);
      return;
    }
    onPick({ nodeId: node.id, label: s.name });
    setOpen(false);
  }

  return (
    <div className="field" ref={box}>
      <span className={`dot ${dot}`} />
      <div className="combo">
        <input
          type="text"
          className="search"
          value={text}
          placeholder={label}
          aria-label={label}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={`${dot}-list`}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
            setError('');
            if (e.target.value === '') onPick(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Typed text that was never confirmed against a suggestion is not
            // a destination. Leaving it in the box makes an unset field look
            // set, and the route silently never appears.
            setTimeout(() => setText(value?.label ?? ''), 150);
          }}
          onKeyDown={(e) => {
            if (!open || suggestions.length === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => (a + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              choose(suggestions[active]!);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />

        {open && suggestions.length > 0 && (
          <ul className="suggestions" id={`${dot}-list`} role="listbox">
            {suggestions.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? 'active' : ''}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(s)}
                >
                  <span className="s-name">{s.name}</span>
                  {s.context && <span className="s-context">{s.context}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="field-error">{error}</p>}
      </div>
    </div>
  );
}

interface Props {
  buildings: { id: string; name: string }[];
  nodes: Map<string, Node>;
  from: Endpoint | null;
  to: Endpoint | null;
  prefs: Prefs;
  onFrom: (endpoint: Endpoint | null) => void;
  onTo: (endpoint: Endpoint | null) => void;
  onPrefs: (prefs: Prefs) => void;
  show3D: boolean;
  onShow3D: (show3D: boolean) => void;
}

export default function Controls({
  buildings,
  nodes,
  from,
  to,
  prefs,
  onFrom,
  onTo,
  onPrefs,
  show3D,
  onShow3D,
}: Props) {
  return (
    <div className="panel controls">
      <PlaceField
        label="Search a starting point"
        dot="dot-start"
        value={from}
        buildings={buildings}
        nodes={nodes}
        onPick={onFrom}
      />
      <PlaceField
        label="Search a destination"
        dot="dot-end"
        value={to}
        buildings={buildings}
        nodes={nodes}
        onPick={onTo}
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
        <button
          type="button"
          className={show3D ? 'chip chip-on' : 'chip'}
          aria-pressed={show3D}
          onClick={() => onShow3D(!show3D)}
        >
          3D buildings
        </button>
      </div>

      <p className="hint">
        Search anywhere in Blacksburg, or click any path on the map to report a
        barrier there.
      </p>
    </div>
  );
}
