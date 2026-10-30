import {redirect} from 'next/navigation';
import {readAdminSession} from '../../lib/admin-session';
import catalog from '../../data/campus-registry.json';
import FacilityWorkbench from '../ui/facility-workbench';
export const metadata={robots:{index:false,follow:false}};
export default async function CampusLab(){const auth=await readAdminSession();if(!auth.isAdmin)redirect('/admin/login');return <FacilityWorkbench buildings={catalog.buildings}/>;}
