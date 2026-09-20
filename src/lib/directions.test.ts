import { describe, expect, it } from 'vitest';
import { describeRoute, feet, minutes, usDistance } from './directions';

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

  it('estimates minutes at a conservative pace', () => {
    expect(minutes(336)).toBe(5);
    expect(minutes(1320)).toBe(20);
  });

  it('never estimates less than a minute', () => {
    expect(minutes(0)).toBe(1);
    expect(minutes(12)).toBe(1);
  });

  it('reads campus distances in feet, with a separator', () => {
    expect(usDistance(874)).toEqual({ value: '2,867', unit: 'ft' });
    expect(usDistance(100)).toEqual({ value: '328', unit: 'ft' });
  });

  it('switches to miles past a mile', () => {
    expect(usDistance(3000)).toEqual({ value: '1.9', unit: 'mi' });
  });

  it('converts to feet', () => {
    expect(Math.round(feet(100))).toBe(328);
  });
});
