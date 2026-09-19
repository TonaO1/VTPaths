export interface Step {
  instruction: string;
  metres: number;
}

const COMPASS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
];

function metresBetween(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat = toRad((a[1] + b[1]) / 2);
  return Math.hypot(dLon * Math.cos(lat), dLat) * R;
}

/** Degrees clockwise from north. */
function bearing(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function turnWords(delta: number): string {
  const side = delta > 0 ? 'right' : 'left';
  const size = Math.abs(delta);
  if (size > 135) return `Sharp ${side}`;
  if (size > 50) return `Turn ${side}`;
  return `Bear ${side}`;
}

export function feet(metres: number): number {
  return metres * 3.28084;
}

/**
 * Turns route geometry into a readable step list. This is a description of a
 * path, not turn-by-turn navigation: there is no GPS, no live position and
 * nothing recalculates as you walk. Turn-by-turn is out of scope
 * (CONTEXT.md); a list of steps is what makes the route legible on a laptop.
 */
export function describeRoute(coords: [number, number][]): Step[] {
  if (coords.length < 2) return [];

  // VT's polylines are surveyed to the metre, so a sidewalk that curves gently
  // produces dozens of tiny bearing changes. A step is only worth printing if
  // the walker would actually notice it: a real turn, after a real distance.
  const MIN_LEG_M = 40;
  const TURN_DEGREES = 45;

  const steps: Step[] = [];
  let legBearing = bearing(coords[0]!, coords[1]!);
  let pending = `Head ${COMPASS[Math.round(legBearing / 45) % 8]}`;
  let run = 0;

  for (let i = 1; i < coords.length; i++) {
    const segment = metresBetween(coords[i - 1]!, coords[i]!);
    run += segment;

    if (i === coords.length - 1) break;

    const next = bearing(coords[i]!, coords[i + 1]!);
    let delta = ((next - legBearing + 540) % 360) - 180;

    if (Math.abs(delta) < TURN_DEGREES || run < MIN_LEG_M) {
      // Keep the leg running; a shallow bend is not a turn.
      if (Math.abs(delta) < TURN_DEGREES) legBearing = next;
      continue;
    }

    steps.push({ instruction: pending, metres: run });
    pending = turnWords(delta);
    legBearing = next;
    run = 0;
  }

  if (run > 0 || steps.length === 0) steps.push({ instruction: pending, metres: run });
  steps.push({ instruction: 'Arrive at destination', metres: 0 });

  return steps;
}
