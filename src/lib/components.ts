import type { Edge, Node } from './types';

/**
 * The nodes in the largest connected component.
 *
 * VT's path network is not one piece: it comes out as roughly 119 components,
 * the largest holding about 1378 of 1790 nodes. A point snapped onto one of the
 * small fragments looks routable and then never finds a route, so anything the
 * user can pick has to be restricted to the main body.
 *
 * Computed from every edge rather than from the preference-filtered adjacency,
 * so turning on "no stairs" cannot quietly shrink what you are allowed to
 * search for.
 */
export function largestComponent(
  nodes: Map<string, Node>,
  edges: Map<string, Edge>,
): Set<string> {
  const parent = new Map<string, string>();
  for (const id of nodes.keys()) parent.set(id, id);

  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // Path compression, so repeated lookups stay flat.
    let walk = x;
    while (parent.get(walk) !== root) {
      const next = parent.get(walk)!;
      parent.set(walk, root);
      walk = next;
    }
    return root;
  };

  for (const edge of edges.values()) {
    if (!parent.has(edge.from) || !parent.has(edge.to)) continue;
    parent.set(find(edge.from), find(edge.to));
  }

  const groups = new Map<string, string[]>();
  for (const id of nodes.keys()) {
    const root = find(id);
    const group = groups.get(root);
    if (group) group.push(id);
    else groups.set(root, [id]);
  }

  let best: string[] = [];
  for (const group of groups.values()) {
    if (group.length > best.length) best = group;
  }
  return new Set(best);
}
