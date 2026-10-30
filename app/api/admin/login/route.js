import {NextResponse} from 'next/server';
import {getIronSession} from 'iron-session';
import {cookies} from 'next/headers';
import admin from '../../../../lib/admin-auth.cjs';
import requestOrigin from '../../../../lib/request-origin.cjs';
export const runtime='nodejs';
const allowed=admin.createLimiter();
const json=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request){
  if(!requestOrigin.sameOrigin(request))return json({error:'허용되지 않은 요청입니다.'},403);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return json({error:'JSON 요청이 필요합니다.'},415);
  const settings=admin.config();if(!settings)return json({error:'관리자 계정 설정을 먼저 완료해주세요.'},503);
  const key=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'local';
  if(!allowed(key))return json({error:'로그인 시도가 많습니다. 15분 뒤 다시 시도해주세요.'},429);
  let input;try{
    if(Number(request.headers.get('content-length'))>4096)return json({error:'요청이 너무 큽니다.'},413);
    const reader=request.body?.getReader();if(!reader)return json({error:'로그인 정보를 입력해주세요.'},400);
    const chunks=[];let bytes=0;
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4096){await reader.cancel();return json({error:'요청이 너무 큽니다.'},413);}chunks.push(value);}
    input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }catch{return json({error:'로그인 정보를 확인해주세요.'},400);}
  try{
    if(!await admin.verifyCredentials(input,settings))return json({error:'관리자 아이디 또는 비밀번호를 확인해주세요.'},401);
    const session=await getIronSession(await cookies(),admin.sessionOptions(settings));Object.assign(session,admin.issueSession(settings));await session.save();return json({ok:true});
  }catch{return json({error:'로그인하지 못했습니다. 다시 시도해주세요.'},503);}
}
