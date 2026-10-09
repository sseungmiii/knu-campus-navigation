import CampusShell from './ui/campus-shell';
import {getSupabaseConfig} from '../lib/supabase/config';
export default function Page() { return <CampusShell supabaseConfig={getSupabaseConfig()} />; }
