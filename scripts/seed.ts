// Puts the demo into a known state between judges.
//   npm run seed            clear every report
//   npm run seed E123 E456  clear, then report those edges once each
//
// Reads .env.local through Node's --env-file, so there is no dotenv dependency.

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing from .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);
const edges = process.argv.slice(2);

const { error: clearError } = await supabase
  .from('reports')
  .delete()
  .neq('edge_id', '');
if (clearError) throw new Error(`clear failed: ${clearError.message}`);
console.log('cleared all reports');

for (const edge of edges) {
  const { error } = await supabase.rpc('confirm_report', {
    p_edge: edge,
    p_type: 'blocked',
  });
  if (error) throw new Error(`seed ${edge} failed: ${error.message}`);
  console.log(`reported ${edge}`);
}

const { count } = await supabase
  .from('reports')
  .select('*', { count: 'exact', head: true });
console.log(`${count ?? 0} report(s) in the table`);
