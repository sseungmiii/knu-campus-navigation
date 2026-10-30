import {NextResponse} from 'next/server';
import {readAdminSession} from '../../../../lib/admin-session';
import requestOrigin from '../../../../lib/request-origin.cjs';
export const runtime='nodejs';
const json=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){const auth=await readAdminSession();return json({configured:auth.configured,isAdmin:auth.isAdmin});}
export async function POST(request){if(!requestOrigin.sameOrigin(request))return json({error:'허용되지 않은 요청입니다.'},403);const auth=await readAdminSession();return auth.isAdmin?json({isAdmin:true}):json({error:'관리자 로그인이 필요합니다.'},401);}
