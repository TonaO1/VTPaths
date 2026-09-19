import { describe, expect, it } from 'vitest';
import { describeRoute, feet } from './directions';

// ~111 m per 0.001 degree of latitude at this latitude, near enough for a test.
const N: [number, number] = [-80.42, 37.22];
const NORTH: [number, number] = [-80.42, 37.2218];
const EAST: [number, number] = [-80.4177, 37.2218];

describe('describeRoute', () => {
  it('returns nothing for a degenerate route', () => {
    expect(describeRoute([])).toEqual([]);
    expect(describeRoute([N])).toEqual([]);
  });

  it('describes a straight run with a compass heading', () => {
    const steps = describeRoute([N, NORTH]);
    expect(steps[0]!.instruction).toBe('Head north');
    expect(steps[0]!.metres).toBeGreaterThan(150);
    expect(steps.at(-1)!.instruction).toBe('Arrive at destination');
  });

  it('emits a turn when the bearing changes sharply', () => {
    const steps = describeRoute([N, NORTH, EAST]);
    expect(steps.map((s) => s.instruction)).toContain('Turn right');
  });

  it('ignores a shallow bend rather than calling it a turn', () => {
    const slight: [number, number] = [-80.4198, 37.2236];
    const steps = describeRoute([N, NORTH, slight]);
    expect(steps.filter((s) => s.instruction.includes('Turn'))).toHaveLength(0);
  });

  it('always ends by arriving', () => {
    expect(describeRoute([N, NORTH, EAST]).at(-1)!.instruction).toBe(
      'Arrive at destination',
    );
  });

  it('converts to feet', () => {
    expect(Math.round(feet(100))).toBe(328);
  });
});
