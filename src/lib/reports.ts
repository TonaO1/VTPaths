import { supabase } from './supabase';
import type { Report, ReportType } from './types';

export async function fetchReports(): Promise<Report[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('reports').select('*');
  if (error) {
    console.error('fetchReports', error);
    return [];
  }
  return data as Report[];
}

/**
 * Refetches the whole table on any change. It has a handful of rows, and
 * patching local state from the realtime payload is where the 3 AM bugs live.
 * Returns an unsubscribe function.
 */
export function subscribeReports(cb: (reports: Report[]) => void): () => void {
  void fetchReports().then(cb);
  const client = supabase;
  if (!client) return () => {};

  const channel = client
    .channel('reports')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reports' },
      () => void fetchReports().then(cb),
    )
    .subscribe();

  return () => void client.removeChannel(channel);
}

/**
 * First tap inserts, second increments. Same call either way, so there is no
 * client-side read-modify-write race.
 */
export async function submitReport(
  edgeId: string,
  type: ReportType,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('confirm_report', {
    p_edge: edgeId,
    p_type: type,
  });
  if (error) console.error('submitReport', error);
}

export const confirmReport = submitReport;

/** Demo-critical: the map fills with dead edges by the fourth judge. */
export async function clearAllReports(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('reports').delete().neq('edge_id', '');
  if (error) console.error('clearAllReports', error);
}
