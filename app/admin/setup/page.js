import {readAdminSession} from '../../../lib/admin-session';
import AdminSetup from '../../ui/admin-setup';
export const metadata={title:'크누패스 · 관리자 계정 설정',robots:{index:false,follow:false}};
export default async function Page(){const auth=await readAdminSession();return <AdminSetup canGenerate={!auth.configured||auth.isAdmin}/>;}
