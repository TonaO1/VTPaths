import type { Edge, Node } from './types';

type Coord = [number, number];

/**
 * Metres per degree at VT's latitude, used to work in a flat local plane.
 * Over a campus the error is centimetres and the arithmetic stays readable.
 */
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = 88_600; // 111320 * cos(37.22 deg)

function toPlane([lon, lat]: Coord): [number, number] {
  return [lon * M_PER_DEG_LON, lat * M_PER_DEG_LAT];
}

/** Perpendicular distance in metres from p to the segment ab. */
function distanceToSegment(p: Coord, a: Coord, b: Coord): number {
  const [px, py] = toPlane(p);
  const [ax, ay] = toPlane(a);
  const [bx, by] = toPlane(b);

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  // Degenerate segment: fall back to point distance.
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));

  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * The edge whose geometry passes closest to a clicked point, or null if
 * nothing is within `withinMetres`.
 *
 * Deliberately geometric rather than asking Mapbox what it rendered: a
 * hit-test only finds painted pixels, so it fails while tiles are still
 * loading and on any layer the current filters have hidden.
 */
export function nearestEdge(
  point: Coord,
  edges: Edge[],
  withinMetres = 30,
): Edge | null {
  let best: Edge | null = null;
  let bestDistance = withinMetres;

  for (const edge of edges) {
    for (let i = 1; i < edge.coords.length; i++) {
      const d = distanceToSegment(point, edge.coords[i - 1]!, edge.coords[i]!);
      if (d < bestDistance) {
        bestDistance = d;
        best = edge;
      }
    }
  }

  return best;
}

/**
 * The routable node closest to a point, or null if the nearest is further than
 * `withinMetres`. Used to attach a geocoded place - which can be anywhere in
 * Blacksburg - to the accessible path network.
 */
export function nearestNode(
  point: Coord,
  nodes: Iterable<Node>,
  withinMetres = 150,
): Node | null {
  let best: Node | null = null;
  let bestDistance = withinMetres;

  for (const node of nodes) {
    const [px, py] = toPlane(point);
    const [nx, ny] = toPlane([node.lon, node.lat]);
    const d = Math.hypot(px - nx, py - ny);
    if (d < bestDistance) {
      bestDistance = d;
      best = node;
    }
  }

  return best;
}
