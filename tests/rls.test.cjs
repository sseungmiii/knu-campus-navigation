const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {PGlite} = require('@electric-sql/pglite');
(async()=>{
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
      grant usage on schema public to anon, authenticated;`);
    await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202610100001_private_timetables.sql'),'utf8'));
    const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002',c='10000000-0000-4000-8000-000000000003';
    await db.query('insert into auth.users values ($1),($2),($3)',[a,b,c]);
    const login = async id => { await db.exec('reset role; set role authenticated;'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); };
    const insert = async owner => db.query(`insert into public.timetable_classes(owner_id,title,term,weekday,start_minute,end_minute,place_name,latitude,longitude,starts_on,ends_on) values ($1,'테스트 수업','2026-2',1,540,600,'IT1호관',35.889,128.61,'2026-09-01','2026-12-31') returning id`,[owner]);
    await login(a); assert.equal((await db.query('select public.is_schedule_user() as allowed')).rows[0].allowed,false);
    await assert.rejects(()=>insert(a)); // Empty allowlist denies even a valid login.
    await db.exec('reset role;'); await db.query('insert into private.schedule_users values (1,$1),(2,$2)',[a,b]);
    await assert.rejects(()=>db.query('insert into private.schedule_users values (3,$1)',[c]));
    await login(a); const idA=(await insert(a)).rows[0].id;
    await assert.rejects(()=>insert(b));
    await assert.rejects(()=>db.query('update public.timetable_classes set owner_id=$1 where id=$2',[b,idA]));
    await assert.rejects(()=>db.query('insert into private.schedule_users values (1,$1)',[c]));
    await login(b); const idB=(await insert(b)).rows[0].id;
    assert.deepEqual((await db.query('select id from public.timetable_classes')).rows.map(x=>x.id),[idB]);
    assert.equal((await db.query("update public.timetable_classes set title='forged' where id=$1 returning id",[idA])).rows.length,0);
    assert.equal((await db.query('delete from public.timetable_classes where id=$1 returning id',[idA])).rows.length,0);
    await login(a); assert.deepEqual((await db.query('select id from public.timetable_classes')).rows.map(x=>x.id),[idA]);
    assert.equal((await db.query("update public.timetable_classes set title='my class' where id=$1 returning title",[idA])).rows[0].title,'my class');
    await login(c); assert.equal((await db.query('select * from public.timetable_classes')).rows.length,0); await assert.rejects(()=>insert(c));
    await db.exec('reset role; set role anon;'); await assert.rejects(()=>db.query('select * from public.timetable_classes')); await assert.rejects(()=>db.query('select public.is_schedule_user()'));
    await db.exec('reset role;'); await db.query('delete from private.schedule_users where user_id=$1',[a]);
    await login(a); assert.equal((await db.query('select * from public.timetable_classes')).rows.length,0); await assert.rejects(()=>insert(a));
    await login(b); assert.equal((await db.query('delete from public.timetable_classes where id=$1 returning id',[idB])).rows.length,1);
    console.log('PASS: real PostgreSQL RLS, deny-by-default, two-user cap, owner isolation, forged ownership, denied third/anonymous users and immediate revocation');
  } finally {await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
