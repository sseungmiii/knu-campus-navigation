const fs = require('node:fs');
const env = {...process.env};
for (const file of ['.env.local','.env']) if(fs.existsSync(file)) for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
  const match=line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if(match && env[match[1]] === undefined) env[match[1]]=match[2].trim();
}
(async()=>{
  if(!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
  const settings=await fetch(`${env.SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(15000)});
  console.log('Supabase Auth connection HTTP',settings.status);
  if(!settings.ok) throw new Error('Supabase connection failed.');
  const jwks=await fetch(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,{signal:AbortSignal.timeout(15000)});
  console.log('Supabase JWKS connection HTTP',jwks.status);
  const table=await fetch(`${env.SUPABASE_URL}/rest/v1/timetable_classes?select=id&limit=1`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(15000)});
  const result=await table.json();
  if(table.status===404 && result.code==='PGRST205') console.log('Timetable migration not applied yet; execute the SQL migration in Supabase.');
  else if(table.status===401 || table.status===403) console.log('Anonymous timetable access denied.');
  else throw new Error('Unexpected anonymous table response; inspect database setup before enabling users.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
