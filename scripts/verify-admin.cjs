// Black-box checks against a built Next server. All credentials are disposable and stay in memory.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{randomBytes}=require('node:crypto'),path=require('node:path'),admin=require('../lib/admin-auth.cjs');
(async()=>{
  const root=path.resolve(process.argv[2]||process.cwd()),port=Number(process.env.ADMIN_TEST_PORT||5191),base='http://127.0.0.1:'+port,password=randomBytes(24).toString('hex'),username='fixture_admin';
  const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,KNU_ENV:'staging',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',KNU_ADMIN_USERNAME:username,KNU_ADMIN_PASSWORD_HASH:await admin.hashPassword(password),KNU_ADMIN_SESSION_SECRET:randomBytes(32).toString('hex')},stdio:'ignore'});
  const request=(url,options={})=>fetch(base+url,{...options,redirect:'manual'}),post=(url,body,cookie,origin=base)=>request(url,{method:'POST',headers:{Origin:origin,Host:'127.0.0.1:'+port,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  try{
    let ready=false;for(let i=0;i<60;i++){try{const r=await request('/api/admin/session');if(r.status===200){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}assert.equal(ready,true,'Fixture server must start');
    const anon=await request('/campus-lab');assert.equal(anon.status,307);assert.match(anon.headers.get('location'),/\/admin\/login$/);
    assert.equal((await post('/api/admin/session',{})).status,401);assert.equal((await post('/api/admin/login',{username,password},null,'https://attacker.invalid')).status,403);assert.equal((await post('/api/admin/login',{username,password:'wrong'})).status,401);
    const login=await post('/api/admin/login',{username,password});assert.equal(login.status,200);const header=login.headers.get('set-cookie');assert.match(header,/HttpOnly/i);assert.match(header,/Secure/i);assert.match(header,/SameSite=Lax/i);const cookie=header.split(';')[0];
    assert.equal((await request('/campus-lab',{headers:{Cookie:cookie}})).status,200);assert.equal((await post('/api/admin/session',{},cookie)).status,200);assert.equal((await post('/api/admin/session',{},'__Host-knupass_admin=forged')).status,401);
    assert.equal((await post('/api/admin/logout',{},cookie)).status,200);assert.equal((await post('/api/admin/session',{})).status,401);assert.equal((await request('/')).status,200);
    console.log('PASS: real Next server denies anonymous/forged/CSRF requests, admits valid admin, protects workbench, logs out and preserves public map');
  }finally{child.kill();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
