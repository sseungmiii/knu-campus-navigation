import 'server-only';
import environment from '../environment.cjs';
export function getSupabaseConfig() {
  if(!environment.isolatedSupabaseAllowed(process.env))return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !key.startsWith('sb_publishable_')) return null;
  try { if (new URL(url).protocol !== 'https:') return null; } catch { return null; }
  // Only this deliberately public pair may cross the server/client boundary.
  return {url, key};
}
