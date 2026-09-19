import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Null when the env vars are missing, so routing still works offline and the
// alert panel can show an offline state instead of the app crashing on boot.
export const supabase = url && key ? createClient(url, key) : null;

if (!supabase) {
  console.error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing. Live sync is off.',
  );
}
