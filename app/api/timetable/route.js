import {NextResponse} from 'next/server';
import {createClient} from '../../../lib/supabase/server';
import timetable from '../../../lib/timetable.cjs';
import requestOrigin from '../../../lib/request-origin.cjs';
import classTrip from '../../../lib/class-trip.cjs';
const fields = 'id,title,term,weekday,start_minute,end_minute,place_name,latitude,longitude,starts_on,ends_on,favorite_route,room,professor,display_end_minute,location_override';
const json = (data, status = 200) => NextResponse.json(data, {status, headers: {'Cache-Control': 'private, no-store'}});
async function authorized() {
  const supabase = await createClient();
  if (!supabase) return {response: json({error: '시간표 연결을 준비 중입니다.'}, 503)};
  // Verify identity with Auth, never trust a cookie's unverified user object.
  const {data, error} = await supabase.auth.getUser();
  if (error || !data.user) return {response: json({error: '로그인이 필요합니다.'}, 401)};
  if (!data.user.email_confirmed_at) return {response: json({error: '회원가입을 완료한 후 시간표를 이용해주세요.'}, 403)};
  const allowed = await supabase.rpc('is_schedule_user');
  if (allowed.error) return {response: json({error: '시간표 DB 설정을 준비 중입니다.'}, 503)};
  if (allowed.data !== true) return {response: json({error: '시간표 이용 권한을 확인하지 못했습니다. 회원 이용 설정을 확인해주세요.'}, 403)};
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
    const limit=['POST','PATCH'].includes(method)?65536:4096;
    if (Number(request.headers.get('content-length')) > limit) return json({error: '요청이 너무 큽니다.'}, 413);
    const reader = request.body?.getReader(); if (!reader) return json({error: '요청 내용을 입력해주세요.'}, 400);
    const chunks = []; let bytes = 0;
    while (true) { const {done, value} = await reader.read(); if (done) break; bytes += value.length; if (bytes > limit) { await reader.cancel(); return json({error: '요청이 너무 큽니다.'}, 413); } chunks.push(value); }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return json({error: '요청 내용을 확인해주세요.'}, 400); }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if((method==='PATCH'&&Object.hasOwn(input||{},'classes'))||(method==='DELETE'&&Object.hasOwn(input||{},'ids'))){
    const ids=method==='PATCH'&&Array.isArray(input.classes)?input.classes.map(row=>row?.id):input.ids;
    if(!Array.isArray(ids)||!ids.length||ids.length>20||new Set(ids).size!==ids.length||!ids.every(id=>uuid.test(id||'')))return json({error:'관리할 수업을 확인해주세요.'},400);
    let rows;if(method==='PATCH')try{rows=input.classes.map(row=>({...timetable.validateClass(row),id:row.id}));}catch(error){return json({error:error.message},400);}
    const owned=await auth.supabase.from('timetable_classes').select('id,favorite_route').eq('owner_id',auth.user.id).in('id',ids);
    if(owned.error)return json({error:'수업 정보를 확인하지 못했습니다.'},503);
    if(owned.data.length!==ids.length)return json({error:'관리할 수업을 찾지 못했습니다.'},404);
    if(method==='DELETE'){const result=await auth.supabase.from('timetable_classes').delete().eq('owner_id',auth.user.id).in('id',ids).select('id');return result.error?json({error:'과목을 삭제하지 못했습니다.'},503):json({ok:true,ids:result.data.map(row=>row.id)});}
    const result=await auth.supabase.from('timetable_classes').upsert(rows.map(row=>({...row,owner_id:auth.user.id,favorite_route:owned.data.find(old=>old.id===row.id).favorite_route})),{onConflict:'id'}).select(fields);
    return result.error?json({error:'과목을 수정하지 못했습니다.'},503):json({classes:result.data});
  }
  if (method !== 'POST' && !uuid.test(input?.id || '')) return json({error: '수업을 선택해주세요.'}, 400);
  if (method === 'DELETE') {
    const result = await auth.supabase.from('timetable_classes').delete().eq('id', input.id).eq('owner_id', auth.user.id).select('id');
    if (result.error) return json({error: '수업을 삭제하지 못했습니다.'}, 503);
    return result.data.length ? json({ok: true}) : json({error: '수업을 찾지 못했습니다.'}, 404);
  }
  if(method==='PUT') {
    let favorite;try{favorite=classTrip.validateFavorite(input.favorite_route);}catch(error){return json({error:error.message},400);}
    const result=await auth.supabase.from('timetable_classes').update({favorite_route:favorite}).eq('id',input.id).eq('owner_id',auth.user.id).select(fields).maybeSingle();
    if(result.error)return json({error:'즐겨찾기를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'},503);
    return result.data?json({class:result.data}):json({error:'수업을 찾지 못했습니다.'},404);
  }
  if(method==='POST'&&Object.hasOwn(input||{},'classes')){
    let rows;try{rows=timetable.validateImport(input);}catch(error){return json({error:error.message},400);}
    const existing=await auth.supabase.from('timetable_classes').select('title,term,weekday,start_minute,starts_on,ends_on').eq('owner_id',auth.user.id);
    if(existing.error)return json({error:'중복 수업을 확인하지 못했습니다. 다시 시도해주세요.'},503);
    if(rows.some(row=>existing.data.some(old=>['title','term','weekday','start_minute','starts_on','ends_on'].every(key=>row[key]===old[key]))))return json({error:'이미 저장한 수업이 포함되어 있습니다. 중복 수업을 선택 해제해주세요.'},409);
    const result=await auth.supabase.from('timetable_classes').insert(rows.map(row=>({...row,owner_id:auth.user.id}))).select(fields);
    return result.error?json({error:'수업을 저장하지 못했습니다. 입력 내용과 장소 연결을 확인해주세요.'},503):json({classes:result.data},201);
  }
  if (method === 'POST' && Object.hasOwn(input || {}, 'meetings')) {
    let rows; try { rows = timetable.validateClassMeetings(input); } catch (error) { return json({error: error.message}, 400); }
    // One INSERT: either both meetings are stored or neither is stored; RLS applies to every row.
    const result = await auth.supabase.from('timetable_classes').insert(rows.map(row => ({...row, owner_id:auth.user.id}))).select(fields);
    if (result.error) return json({error:'수업을 저장하지 못했습니다. 입력 내용과 이용 권한을 확인해주세요.'},503);
    return json({classes:result.data},201);
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
export const PUT = request => write(request, 'PUT');
