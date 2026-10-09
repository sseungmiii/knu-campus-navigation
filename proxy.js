import {createServerClient} from '@supabase/ssr';
import {NextResponse} from 'next/server';
import {getSupabaseConfig} from './lib/supabase/config';
export async function proxy(request) {
  let response = NextResponse.next({request});
  const config = getSupabaseConfig();
  if (config) {
    const supabase = createServerClient(config.url, config.key, {cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(values) {
        for (const {name, value} of values) request.cookies.set(name, value);
        response = NextResponse.next({request});
        for (const {name, value, options} of values) response.cookies.set(name, value, options);
      }
    }});
    await supabase.auth.getClaims();
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {matcher: ['/', '/api/timetable']};
