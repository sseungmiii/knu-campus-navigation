import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {getSupabaseConfig} from './config';
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {cookies: {
    getAll() { return store.getAll(); },
    setAll(values) { for (const {name, value, options} of values) store.set(name, value, options); }
  }});
}
