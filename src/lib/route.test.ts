import { describe, expect, it } from 'vitest';
import { buildGraph, REPORT_PENALTY, weight, type CampusGeoJSON } from './graph';
import { findRoute } from './route';
import type { Edge, Prefs, Report } from './types';

// Hand-written, deliberately not campus.geojson.
//
//   A --- direct (100 m, stairs) --- B
//   A -- ac (60) -- C -- cb (60) -- B
//   D --- de (10) --- E             (a separate island)
const fixture: CampusGeoJSON = {
  type: 'FeatureCollection',
  features: [
    ...['A', 'B', 'C', 'D', 'E'].map((id, i) => ({
      geometry: { type: 'Point' as const, coordinates: [i, 0] as [number, number] },
      properties: { id },
    })),
    {
      geometry: { type: 'LineString' as const, coordinates: [[0, 0], [1, 0]] as [number, number][] },
      properties: { id: 'direct', from: 'A', to: 'B', length: 100, steep: false, has_stairs: true },
    },
    {
      geometry: { type: 'LineString' as const, coordinates: [[0, 0], [2, 0]] as [number, number][] },
      properties: { id: 'ac', from: 'A', to: 'C', length: 60, steep: false, has_stairs: false },
    },
    {
      geometry: { type: 'LineString' as const, coordinates: [[2, 0], [1, 0]] as [number, number][] },
      properties: { id: 'cb', from: 'C', to: 'B', length: 60, steep: true, has_stairs: false },
    },
    {
      geometry: { type: 'LineString' as const, coordinates: [[3, 0], [4, 0]] as [number, number][] },
      properties: { id: 'de', from: 'D', to: 'E', length: 10, steep: false, has_stairs: false },
    },
  ],
};

const base: Prefs = {
  avoidStairs: false,
  avoidSteep: false,
  strict: false,
  avoidCrowds: false,
};
const allowAll: Prefs = base;
const noStairs: Prefs = { ...base, avoidStairs: true };

function route(prefs: Prefs, reports: Report[] = [], from = 'A', to = 'B') {
  return findRoute(buildGraph(fixture, reports, prefs), from, to);
}

function report(edge_id: string, count: number): Report {
  return { edge_id, type: 'blocked', count, created_at: '' };
}

function crowded(edge_id: string): Report {
  return { edge_id, type: 'crowded', count: 1, created_at: '' };
}

const edge: Edge = {
  id: 'e',
  from: 'A',
  to: 'B',
  length: 100,
  steep: false,
  has_stairs: false,
  coords: [],
};

describe('weight', () => {
  it('penalises a single report but does not close it', () => {
    expect(weight(edge, base, [report('e', 1)])).toBe(100 + REPORT_PENALTY);
  });

  it('strict closes on the first report', () => {
    expect(weight(edge, { ...base, strict: true }, [report('e', 1)])).toBe(
      Infinity,
    );
  });

  it('avoidCrowds closes a crowded edge', () => {
    expect(weight(edge, { ...base, avoidCrowds: true }, [crowded('e')])).toBe(
      Infinity,
    );
  });

  it('avoidCrowds leaves other report types penalised, not closed', () => {
    expect(
      weight(edge, { ...base, avoidCrowds: true }, [report('e', 1)]),
    ).toBe(100 + REPORT_PENALTY);
  });

  it('a crowded edge is only penalised while avoidCrowds is off', () => {
    expect(weight(edge, base, [crowded('e')])).toBe(100 + REPORT_PENALTY);
  });

  it('an unreported edge costs its length', () => {
    expect(weight(edge, base, [])).toBe(100);
  });
});

describe('findRoute', () => {
  it('takes the shortest path', () => {
    expect(route(allowAll)).toMatchObject({ edgeIds: ['direct'], distance: 100 });
  });

  it('avoidStairs forces the longer path', () => {
    expect(route(noStairs)).toMatchObject({ edgeIds: ['ac', 'cb'], distance: 120 });
  });

  it('avoidSteep rules out the steep leg', () => {
    const prefs: Prefs = { ...base, avoidStairs: true, avoidSteep: true };
    expect(route(prefs)).toBeNull();
  });

  it('avoids a reported edge', () => {
    expect(route(allowAll, [report('direct', 1)])).toMatchObject({
      edgeIds: ['ac', 'cb'],
    });
  });

  it('two reports make an edge impassable', () => {
    const graph = buildGraph(fixture, [report('direct', 2)], allowAll);
    expect(graph.adjacency.get('A')?.some((n) => n.edgeId === 'direct')).toBe(false);
  });

  it('still uses a reported edge when the detour is worse', () => {
    expect(route(allowAll, [report('ac', 1), report('direct', 1)])).toMatchObject({
      edgeIds: ['direct'],
    });
  });

  it('strict mode can close the only remaining path', () => {
    // Stairs rule out `direct`, so A-C-B is the only way through.
    const onCb = [report('cb', 1)];
    expect(route(noStairs, onCb)).toMatchObject({ edgeIds: ['ac', 'cb'] });
    expect(route({ ...noStairs, strict: true }, onCb)).toBeNull();
  });

  it('returns null when no path exists', () => {
    expect(route(allowAll, [], 'A', 'E')).toBeNull();
  });

  it('returns null for an unknown node', () => {
    expect(route(allowAll, [], 'A', 'ZZ')).toBeNull();
  });

  it('orients geometry along the direction of travel', () => {
    // cb is stored C->B; walking A->C->B must not emit it reversed.
    expect(route(noStairs)?.coords).toEqual([[0, 0], [2, 0], [2, 0], [1, 0]]);
  });
});
