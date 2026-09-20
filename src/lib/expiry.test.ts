import { describe, expect, it } from 'vitest';
import { activeReports, countdown, remaining, TTL_MS } from './expiry';
import type { Report, ReportType } from './types';

const NOW = Date.parse('2026-09-20T12:00:00Z');

function report(type: ReportType, minutesAgo: number): Report {
  return {
    edge_id: `E${type}`,
    type,
    count: 1,
    created_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
  };
}

describe('remaining', () => {
  it('counts down from the report type\'s ttl', () => {
    expect(remaining(report('crowded', 15), NOW)).toBe(TTL_MS.crowded - 15 * 60_000);
  });

  it('floors at zero once expired', () => {
    expect(remaining(report('crowded', 60), NOW)).toBe(0);
  });

  it('keeps a report with an unreadable timestamp rather than dropping it', () => {
    const broken: Report = { edge_id: 'E1', type: 'blocked', count: 1, created_at: '' };
    expect(remaining(broken, NOW)).toBe(TTL_MS.blocked);
  });
});

describe('activeReports', () => {
  it('drops the expired and keeps the live', () => {
    const reports = [report('crowded', 60), report('construction', 60)];
    expect(activeReports(reports, NOW).map((r) => r.type)).toEqual(['construction']);
  });

  it('expires each type on its own clock', () => {
    const threeHours = [report('crowded', 180), report('ice', 180), report('blocked', 180)];
    expect(activeReports(threeHours, NOW).map((r) => r.type)).toEqual(['ice', 'blocked']);
  });

  it('handles an empty list', () => {
    expect(activeReports([], NOW)).toEqual([]);
  });
});

describe('countdown', () => {
  it('reads in minutes, hours, then days', () => {
    expect(countdown(20 * 60_000)).toBe('20 min');
    expect(countdown(3 * 60 * 60_000)).toBe('3 h');
    expect(countdown(5 * 24 * 60 * 60_000)).toBe('5 d');
  });

  it('says so when it is over', () => {
    expect(countdown(0)).toBe('expired');
  });
});
