import CampusShell from './ui/campus-shell';
import {getSupabaseConfig} from '../lib/supabase/config';
import environment from '../lib/environment.cjs';
export default function Page() { return <><div className="test-environment-bar" hidden={!environment.isTestingEnvironment()}><strong>크누패스 테스트</strong><span>운영 데이터와 분리 · 내부 동선은 검증 후 공개</span><a href="/admin/login">관리자</a></div><CampusShell testing={environment.isTestingEnvironment()} supabaseConfig={getSupabaseConfig()} /></>; }
