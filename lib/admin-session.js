import 'server-only';
import {getIronSession} from 'iron-session';
import {cookies} from 'next/headers';
import admin from './admin-auth.cjs';
export async function readAdminSession(){
  const store=await cookies();
  const settings=admin.config();if(!settings)return {configured:false,isAdmin:false,session:null};
  try{const session=await getIronSession(store,admin.sessionOptions(settings));return {configured:true,isAdmin:admin.validSession(session,settings),session,settings};}
  catch{return {configured:true,isAdmin:false,session:null};}
}
