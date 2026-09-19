import type { Graph, RouteResult } from './types';

/**
 * Dijkstra. Scans for the cheapest unvisited node instead of using a heap: the
 * graph is under two thousand nodes and this runs in a few milliseconds, which
 * is cheaper than the dependency and the code a heap would cost.
 *
 * Returns null when there is no route, rather than throwing.
 */
export function findRoute(
  graph: Graph,
  fromId: string,
  toId: string,
): RouteResult | null {
  if (fromId === toId) return { edgeIds: [], coords: [], distance: 0 };
  if (!graph.adjacency.has(fromId) || !graph.adjacency.has(toId)) return null;

  const dist = new Map<string, number>([[fromId, 0]]);
  const prev = new Map<string, { node: string; edgeId: string }>();
  const done = new Set<string>();

  for (;;) {
    let current: string | null = null;
    let best = Infinity;
    for (const [node, d] of dist) {
      if (!done.has(node) && d < best) {
        best = d;
        current = node;
      }
    }
    if (current === null) return null;
    if (current === toId) break;

    done.add(current);
    for (const n of graph.adjacency.get(current) ?? []) {
      if (done.has(n.to)) continue;
      const d = best + n.weight;
      if (d < (dist.get(n.to) ?? Infinity)) {
        dist.set(n.to, d);
        prev.set(n.to, { node: current, edgeId: n.edgeId });
      }
    }
  }

  const edgeIds: string[] = [];
  const coords: [number, number][] = [];
  for (let at = toId; at !== fromId; ) {
    const step = prev.get(at)!;
    const edge = graph.edges.get(step.edgeId)!;
    edgeIds.unshift(edge.id);
    // Edges are undirected, so flip the geometry when we traversed it backwards.
    const part = edge.to === at ? edge.coords : [...edge.coords].reverse();
    coords.unshift(...part);
    at = step.node;
  }

  return { edgeIds, coords, distance: dist.get(toId)! };
}
