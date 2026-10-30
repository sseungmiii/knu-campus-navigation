function isTestingEnvironment(env=process.env){return env.KNU_ENV==='staging'||env.VERCEL_GIT_COMMIT_REF==='staging'||Boolean(env.VERCEL_ENV&&env.VERCEL_ENV!=='production');}
function isolatedSupabaseAllowed(env=process.env){if(!isTestingEnvironment(env))return env.KNU_ENV==='production'||env.VERCEL_GIT_COMMIT_REF==='main';const ref=env.KNU_TEST_SUPABASE_PROJECT_REF;return Boolean(ref&&/^[a-z]{20}$/.test(ref)&&ref!=='mezfiokxepbwfdevvjce'&&env.SUPABASE_URL===`https://${ref}.supabase.co`);}
module.exports={isTestingEnvironment,isolatedSupabaseAllowed};
