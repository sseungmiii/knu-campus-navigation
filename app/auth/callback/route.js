import {NextResponse} from 'next/server';
import {createClient} from '../../../lib/supabase/server';
export async function GET(request) {
  // Always return to this deployment's root; do not accept a user-supplied redirect.
  const code=new URL(request.url).searchParams.get('code');
  let verified=false;
  try{
    const supabase=await createClient();
    if(supabase&&code){const {error}=await supabase.auth.exchangeCodeForSession(code);verified=!error;}
  }catch{/* Codes and upstream details must not be logged or exposed. */}
  const target=new URL('/',request.url);target.searchParams.set('auth',verified?'confirmed':'error');
  const response=NextResponse.redirect(target);response.headers.set('Cache-Control','private, no-store');return response;
}
