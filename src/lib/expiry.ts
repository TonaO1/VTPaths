import type { Report, ReportType } from './types';

/**
 * How long a report stays on the map, by kind. A barrier is not a permanent
 * fact: ice melts, a crowd disperses when the class ends, construction does
 * not. Without this a report lives until somebody presses Reset, which is
 * fine for a demo and wrong for a campus.
 *
 * These are deliberately short enough to be honest and long enough to survive
 * a judging session. Shorten `crowded` if you want expiry visible on stage.
 */
export const TTL_MS: Record<ReportType, number> = {
  crowded: 45 * 60_000,
  ice: 6 * 60 * 60_000,
  blocked: 12 * 60 * 60_000,
  elevator_out: 24 * 60 * 60_000,
  construction: 7 * 24 * 60 * 60_000,
};

/** Milliseconds until this report stops counting; 0 once it has expired. */
export function remaining(report: Report, now: number): number {
  const born = Date.parse(report.created_at);
  // An unparseable timestamp should not silently delete a live barrier.
  if (Number.isNaN(born)) return TTL_MS[report.type] ?? 0;
  return Math.max(0, born + (TTL_MS[report.type] ?? 0) - now);
}

/** Only the reports still in force, newest first. */
export function activeReports(reports: Report[], now: number): Report[] {
  return reports.filter((r) => remaining(r, now) > 0);
}

/** "45 min" / "6 h" / "expired", for the alert list. */
export function countdown(ms: number): string {
  if (ms <= 0) return 'expired';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} d`;
}
