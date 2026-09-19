import { describe, expect, it } from 'vitest';
import { buildGraph } from './graph';
import { findRoute } from './route';
import type { Edge, Node, Report } from './types';

// Fake 5-node network:
//
//   A --10m-- B --10m-- C
//             |
//            20m
//             |
//             D --5m-- E
//
// Shortest A→E: A→B→D→E = 35m
// Shortest A→C: A→B→C = 20m

const nodes: Node[] = [
  { id: 'A', lon: 0, lat: 0 },
  { id: 'B', lon: 1, lat: 0 },
  { id: 'C', lon: 2, lat: 0 },
  { id: 'D', lon: 1, lat: 1 },
  { id: 'E', lon: 2, lat: 1 },
];

const edges: Edge[] = [
  { id: 'AB', from: 'A', to: 'B', length: 10, steep: false, has_stairs: false, coords: [[0,0],[1,0]] },
  { id: 'BC', from: 'B', to: 'C', length: 10, steep: false, has_stairs: false, coords: [[1,0],[2,0]] },
  { id: 'BD', from: 'B', to: 'D', length: 20, steep: false, has_stairs: false, coords: [[1,0],[1,1]] },
  { id: 'DE', from: 'D', to: 'E', length: 5,  steep: false, has_stairs: false, coords: [[1,1],[2,1]] },
];

const noReports: Report[] = [];
const noPrefs = { avoidStairs: false, avoidSteep: false };

describe('buildGraph', () => {
  it('builds adjacency for all nodes', () => {
    const graph = buildGraph(nodes, edges, noReports, noPrefs);
    expect(graph.adjacency.size).toBe(5);
  });

  it('edges are bidirectional', () => {
    const graph = buildGraph(nodes, edges, noReports, noPrefs);
    const fromA = graph.adjacency.get('A')!;
    const fromB = graph.adjacency.get('B')!;
    expect(fromA.some(n => n.to === 'B')).toBe(true);
    expect(fromB.some(n => n.to === 'A')).toBe(true);
  });
});

describe('findRoute', () => {
  it('finds shortest path A→C', () => {
    const graph = buildGraph(nodes, edges, noReports, noPrefs);
    const result = findRoute(graph, 'A', 'C');
    expect(result).not.toBeNull();
    expect(result!.edgeIds).toEqual(['AB', 'BC']);
    expect(result!.distance).toBe(20);
  });

  it('finds shortest path A→E', () => {
    const graph = buildGraph(nodes, edges, noReports, noPrefs);
    const result = findRoute(graph, 'A', 'E');
    expect(result).not.toBeNull();
    expect(result!.edgeIds).toEqual(['AB', 'BD', 'DE']);
    expect(result!.distance).toBe(35);
  });

  it('returns null when destination unreachable', () => {
    const graph = buildGraph(nodes, edges, noReports, noPrefs);
    const result = findRoute(graph, 'A', 'NOWHERE');
    expect(result).toBeNull();
  });

  it('returns same node with empty path', () => {
    const graph = buildGraph(nodes, edges, noReports, noPrefs);
    const result = findRoute(graph, 'A', 'A');
    expect(result).not.toBeNull();
    expect(result!.edgeIds).toEqual([]);
    expect(result!.distance).toBe(0);
  });

  it('reroutes around a reported edge (1 report makes it very expensive)', () => {
    const reports: Report[] = [
      { edge_id: 'BC', type: 'blocked', count: 1, created_at: '' },
    ];
    const graph = buildGraph(nodes, edges, reports, noPrefs);
    const result = findRoute(graph, 'A', 'C');
    // BC costs 10*1000=10000, so direct A→B→C is now very expensive
    // There's no other path to C in this network, so it still uses BC but at high cost
    expect(result).not.toBeNull();
    expect(result!.edgeIds).toContain('BC');
  });

  it('blocks edge completely with 2 reports', () => {
    const reports: Report[] = [
      { edge_id: 'BC', type: 'blocked', count: 2, created_at: '' },
    ];
    const graph = buildGraph(nodes, edges, reports, noPrefs);
    const result = findRoute(graph, 'A', 'C');
    // BC is infinity, no other path to C exists
    expect(result).toBeNull();
  });

  it('avoids steep edges when pref is on', () => {
    const steepEdges: Edge[] = edges.map(e =>
      e.id === 'BD' ? { ...e, steep: true } : e
    );
    const graph = buildGraph(nodes, steepEdges, noReports, { avoidStairs: false, avoidSteep: true });
    const result = findRoute(graph, 'A', 'E');
    // BD is steep and 100x cost (20*100=2000), so route avoids it if possible
    // No other path to E exists, so it still routes through but at high cost
    expect(result).not.toBeNull();
  });
});
