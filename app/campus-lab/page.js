import {notFound} from 'next/navigation';
import environment from '../../lib/environment.cjs';
import catalog from '../../data/campus-registry.json';
import FacilityWorkbench from '../ui/facility-workbench';
export default function CampusLab(){if(!environment.isTestingEnvironment())notFound();return <FacilityWorkbench buildings={catalog.buildings}/>;}
