import { describe, expect, it } from 'vitest';
import { nearestEdge } from './nearest';
import type { Edge } from './types';

function edge(id: string, coords: [number, number][]): Edge {
  return { id, from: 'A', to: 'B', length: 100, steep: false, has_stairs: false, coords };
}

// Roughly 89 m per 0.001 degree of longitude here, 111 m per 0.001 of latitude.
const horizontal = edge('H', [
  [-80.42, 37.22],
  [-80.418, 37.22],
]);
const far = edge('F', [
  [-80.42, 37.23],
  [-80.418, 37.23],
]);

describe('nearestEdge', () => {
  it('finds the edge under the click', () => {
    expect(nearestEdge([-80.419, 37.22], [horizontal, far])?.id).toBe('H');
  });

  it('picks the closer of two edges', () => {
    expect(nearestEdge([-80.419, 37.2201], [horizontal, far])?.id).toBe('H');
    expect(nearestEdge([-80.419, 37.2299], [horizontal, far])?.id).toBe('F');
  });

  it('returns null when nothing is close enough', () => {
    expect(nearestEdge([-80.419, 37.225], [horizontal, far])).toBeNull();
  });

  it('matches near an endpoint, not just the middle', () => {
    expect(nearestEdge([-80.4200, 37.22], [horizontal])?.id).toBe('H');
  });

  it('does not match past the end of a segment', () => {
    // 0.001 deg of longitude beyond the endpoint is about 89 m away.
    expect(nearestEdge([-80.421, 37.22], [horizontal])).toBeNull();
  });

  it('honours the radius', () => {
    const justOff: [number, number] = [-80.419, 37.2202];
    expect(nearestEdge(justOff, [horizontal], 30)?.id).toBe('H');
    expect(nearestEdge(justOff, [horizontal], 5)).toBeNull();
  });

  it('returns null for an empty graph', () => {
    expect(nearestEdge([-80.419, 37.22], [])).toBeNull();
  });
});
