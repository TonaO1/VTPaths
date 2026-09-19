import type { Edge, Graph, Neighbour, Node, Prefs, Report } from './types';

export function buildGraph(
  nodes: Node[],
  edges: Edge[],
  reports: Report[],
  prefs: Prefs,
): Graph {
  const reportMap = new Map<string, number>();
  for (const r of reports) {
    reportMap.set(r.edge_id, r.count);
  }

  const nodeMap = new Map<string, Node>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const edgeMap = new Map<string, Edge>();
  for (const e of edges) {
    edgeMap.set(e.id, e);
  }

  const adjacency = new Map<string, Neighbour[]>();
  for (const n of nodes) {
    adjacency.set(n.id, []);
  }

  for (const e of edges) {
    const reportCount = reportMap.get(e.id) ?? 0;

    let weight = e.length;

    if (prefs.avoidStairs && e.has_stairs) weight = Infinity;
    if (prefs.avoidSteep && e.steep) weight *= 100;
    if (reportCount === 1) weight *= 1000;
    if (reportCount >= 2) weight = Infinity;

    adjacency.get(e.from)?.push({ edgeId: e.id, to: e.to, weight });
    adjacency.get(e.to)?.push({ edgeId: e.id, to: e.from, weight });
  }

  return { nodes: nodeMap, edges: edgeMap, adjacency };
}
