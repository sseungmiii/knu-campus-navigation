import {redirect} from 'next/navigation';
import {readAdminSession} from '../../../lib/admin-session';
import AdminLogin from '../../ui/admin-login';
export const metadata={title:'크누패스 · 관리자 로그인',robots:{index:false,follow:false}};
export default async function Page(){const auth=await readAdminSession();if(auth.isAdmin)redirect('/campus-lab');return <AdminLogin configured={auth.configured}/>;}
