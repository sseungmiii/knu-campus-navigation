import {NextResponse} from 'next/server';
import {createClient} from '../../../lib/supabase/server';
import timetable from '../../../lib/timetable.cjs';
import requestOrigin from '../../../lib/request-origin.cjs';
const fields = 'id,title,term,weekday,start_minute,end_minute,place_name,latitude,longitude,starts_on,ends_on';
const json = (data, status = 200) => NextResponse.json(data, {status, headers: {'Cache-Control': 'private, no-store'}});
async function authorized() {
  const supabase = await createClient();
  if (!supabase) return {response: json({error: '시간표 연결을 준비 중입니다.'}, 503)};
  // Verify identity with Auth, never trust a cookie's unverified user object.
  const {data, error} = await supabase.auth.getUser();
  if (error || !data.user) return {response: json({error: '로그인이 필요합니다.'}, 401)};
  const allowed = await supabase.rpc('is_schedule_user');
  if (allowed.error) return {response: json({error: '시간표 DB 설정을 준비 중입니다.'}, 503)};
  if (allowed.data !== true) return {response: json({error: '이 계정은 시간표 이용 권한이 없습니다.'}, 403)};
  return {supabase, user: data.user};
}
export async function GET() {
  const auth = await authorized(); if (auth.response) return auth.response;
  const {data, error} = await auth.supabase.from('timetable_classes').select(fields).eq('owner_id', auth.user.id).order('weekday').order('start_minute');
  return error ? json({error: '시간표를 불러오지 못했습니다.'}, 503) : json({classes: data});
}
async function write(request, method) {
  if (!requestOrigin.sameOrigin(request)) return json({error: '허용되지 않은 요청입니다.'}, 403);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return json({error: 'JSON 요청이 필요합니다.'}, 415);
  const auth = await authorized(); if (auth.response) return auth.response;
  let input;
  try {
    if (Number(request.headers.get('content-length')) > 4096) return json({error: '요청이 너무 큽니다.'}, 413);
    const reader = request.body?.getReader(); if (!reader) return json({error: '요청 내용을 입력해주세요.'}, 400);
    const chunks = []; let bytes = 0;
    while (true) { const {done, value} = await reader.read(); if (done) break; bytes += value.length; if (bytes > 4096) { await reader.cancel(); return json({error: '요청이 너무 큽니다.'}, 413); } chunks.push(value); }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return json({error: '요청 내용을 확인해주세요.'}, 400); }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (method !== 'POST' && !uuid.test(input?.id || '')) return json({error: '수업을 선택해주세요.'}, 400);
  if (method === 'DELETE') {
    const result = await auth.supabase.from('timetable_classes').delete().eq('id', input.id).eq('owner_id', auth.user.id).select('id');
    if (result.error) return json({error: '수업을 삭제하지 못했습니다.'}, 503);
    return result.data.length ? json({ok: true}) : json({error: '수업을 찾지 못했습니다.'}, 404);
  }
  let row; try { row = timetable.validateClass(input); } catch (error) { return json({error: error.message}, 400); }
  const query = method === 'POST' ? auth.supabase.from('timetable_classes').insert({...row, owner_id: auth.user.id}) : auth.supabase.from('timetable_classes').update(row).eq('id', input.id).eq('owner_id', auth.user.id);
  const result = await query.select(fields).maybeSingle();
  if (result.error) return json({error: '수업을 저장하지 못했습니다. 입력 내용과 이용 권한을 확인해주세요.'}, 503);
  return result.data ? json({class: result.data}, method === 'POST' ? 201 : 200) : json({error: '수업을 찾지 못했습니다.'}, 404);
}
export const POST = request => write(request, 'POST');
export const PATCH = request => write(request, 'PATCH');
export const DELETE = request => write(request, 'DELETE');
