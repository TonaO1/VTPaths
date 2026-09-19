import type { Graph, RouteResult } from './types';

export function findRoute(
  graph: Graph,
  fromId: string,
  toId: string,
): RouteResult | null {
  if (!graph.nodes.has(fromId) || !graph.nodes.has(toId)) return null;
  if (fromId === toId) return { edgeIds: [], coords: [], distance: 0 };

  const cost = new Map<string, number>();
  const prev = new Map<string, { nodeId: string; edgeId: string }>();

  for (const id of graph.nodes.keys()) {
    cost.set(id, Infinity);
  }
  cost.set(fromId, 0);

  // Simple sorted array as priority queue — fine for campus-scale graphs
  const queue: { id: string; cost: number }[] = [{ id: fromId, cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;

    if (current.id === toId) break;
    if (current.cost > cost.get(current.id)!) continue;

    for (const neighbour of graph.adjacency.get(current.id) ?? []) {
      if (neighbour.weight === Infinity) continue;

      const next = current.cost + neighbour.weight;
      if (next < cost.get(neighbour.to)!) {
        cost.set(neighbour.to, next);
        prev.set(neighbour.to, { nodeId: current.id, edgeId: neighbour.edgeId });
        queue.push({ id: neighbour.to, cost: next });
      }
    }
  }

  if (cost.get(toId) === Infinity) return null;

  // Trace back the path
  const edgeIds: string[] = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const step = prev.get(cursor);
    if (!step) return null;
    edgeIds.unshift(step.edgeId);
    cursor = step.nodeId;
  }

  // Build coordinate array from edges in order
  const coords: [number, number][] = [];
  for (const edgeId of edgeIds) {
    const edge = graph.edges.get(edgeId)!;
    coords.push(...edge.coords);
  }

  return {
    edgeIds,
    coords,
    distance: cost.get(toId)!,
  };
}
