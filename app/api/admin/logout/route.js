import {NextResponse} from 'next/server';
import {readAdminSession} from '../../../../lib/admin-session';
import requestOrigin from '../../../../lib/request-origin.cjs';
export const runtime='nodejs';
export async function POST(request){if(!requestOrigin.sameOrigin(request))return NextResponse.json({error:'허용되지 않은 요청입니다.'},{status:403});const auth=await readAdminSession();auth.session?.destroy();return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});}
