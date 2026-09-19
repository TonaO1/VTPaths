import { describe, expect, it } from 'vitest';
import { largestComponent } from './components';
import type { Edge, Node } from './types';

function node(id: string): Node {
  return { id, lon: 0, lat: 0 };
}

function edge(id: string, from: string, to: string): Edge {
  return { id, from, to, length: 1, steep: false, has_stairs: false, coords: [] };
}

describe('largestComponent', () => {
  it('returns every node when the graph is one piece', () => {
    const nodes = new Map([['A', node('A')], ['B', node('B')], ['C', node('C')]]);
    const edges = new Map([['e1', edge('e1', 'A', 'B')], ['e2', edge('e2', 'B', 'C')]]);
    expect([...largestComponent(nodes, edges)].sort()).toEqual(['A', 'B', 'C']);
  });

  it('keeps the bigger island and drops the smaller', () => {
    const nodes = new Map(
      ['A', 'B', 'C', 'X', 'Y'].map((id) => [id, node(id)] as const),
    );
    const edges = new Map([
      ['e1', edge('e1', 'A', 'B')],
      ['e2', edge('e2', 'B', 'C')],
      ['e3', edge('e3', 'X', 'Y')],
    ]);
    const main = largestComponent(nodes, edges);
    expect([...main].sort()).toEqual(['A', 'B', 'C']);
    expect(main.has('X')).toBe(false);
  });

  it('handles an isolated node', () => {
    const nodes = new Map([['A', node('A')], ['B', node('B')], ['Z', node('Z')]]);
    const edges = new Map([['e1', edge('e1', 'A', 'B')]]);
    expect(largestComponent(nodes, edges).has('Z')).toBe(false);
  });

  it('handles no edges at all', () => {
    const nodes = new Map([['A', node('A')], ['B', node('B')]]);
    expect(largestComponent(nodes, new Map()).size).toBe(1);
  });

  it('handles an empty graph', () => {
    expect(largestComponent(new Map(), new Map()).size).toBe(0);
  });
});
