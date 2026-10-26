const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(fs.readFileSync(require.resolve('../supabase/migrations/202610100001_private_timetables.sql'),'utf8'));
    const ids=Array.from({length:5},(_,index)=>`20000000-0000-4000-8000-00000000000${index+1}`);
    for(const [index,id] of ids.entries())await db.query('insert into auth.users values ($1,$2,$3,$4)',[id,`student${index}@example.com`,index===3?null:'2026-01-01T00:00:00Z',index===4?'2099-01-01T00:00:00Z':null]);
    const login=async id=>{await db.exec('reset role; set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
    const insert=owner=>db.query(`insert into public.timetable_classes(owner_id,title,term,weekday,start_minute,end_minute,place_name,latitude,longitude,starts_on,ends_on) values ($1,'수업','2026-2',1,540,600,'강의동',35.889,128.61,'2026-09-01','2026-12-31') returning id`,[owner]);
    await db.query('insert into private.schedule_users values (1,$1)',[ids[0]]);await login(ids[0]);const original=(await insert(ids[0])).rows[0].id;
    await db.exec('reset role;');await db.exec(fs.readFileSync(require.resolve('../supabase/migrations/202610230001_verified_schedule_members.sql'),'utf8'));
    await db.exec(fs.readFileSync(require.resolve('../supabase/migrations/20261022155625_class_route_favorites.sql'),'utf8'));
    await db.exec(fs.readFileSync(require.resolve('../supabase/migrations/20261026155418_timetable_import_details.sql'),'utf8'));
    for(const id of ids.slice(0,3)){await login(id);assert.equal((await db.query('select public.is_schedule_user() as allowed')).rows[0].allowed,true);await insert(id);await assert.rejects(()=>insert(ids[3]));}
    await login(ids[0]);assert.equal((await db.query('select id from public.timetable_classes where id=$1',[original])).rows.length,1,'Existing classes survive the eligibility migration');
    assert.equal((await db.query('select room from public.timetable_classes where id=$1',[original])).rows[0].room,'');
    await db.query("update public.timetable_classes set room='317',professor='검증',display_end_minute=end_minute+15 where id=$1",[original]);
    await assert.rejects(()=>db.query('update public.timetable_classes set display_end_minute=end_minute-1 where id=$1',[original]));
    await login(ids[2]);assert.equal((await db.query('select id from public.timetable_classes where id=$1',[original])).rows.length,0);
    assert.equal((await db.query(`update public.timetable_classes set favorite_route='{}' where id=$1 returning id`,[original])).rows.length,0,'Favorite updates cannot access another owner');
    await db.query(`update public.timetable_classes set favorite_route='{"mode":"walk"}'`);
    assert.equal((await db.query(`select favorite_route->>'mode' as mode from public.timetable_classes`)).rows[0].mode,'walk');
    await assert.rejects(()=>db.query(`update public.timetable_classes set favorite_route='[]'`));
    await assert.rejects(()=>db.query(`update public.timetable_classes set favorite_route=jsonb_build_object('oversize',repeat('x',5000))`));
    assert.equal((await db.query('delete from public.timetable_classes where id=$1 returning id',[original])).rows.length,0);
    assert.equal((await db.query("update public.timetable_classes set title='forged' where id=$1 returning id",[original])).rows.length,0);
    await assert.rejects(()=>db.query('update public.timetable_classes set owner_id=$1',[ids[0]]));
    const beforeBatch=(await db.query('select count(*)::int as count from public.timetable_classes')).rows[0].count;
    await assert.rejects(()=>db.query(`insert into public.timetable_classes(owner_id,title,term,weekday,start_minute,end_minute,place_name,latitude,longitude,starts_on,ends_on) values
      ($1,'batch','2026-2',1,540,615,'강의동',35.889,128.61,'2026-09-01','2026-12-31'),
      ($2,'batch','2026-2',3,630,705,'강의동',35.889,128.61,'2026-09-01','2026-12-31')`,[ids[2],ids[0]]));
    assert.equal((await db.query('select count(*)::int as count from public.timetable_classes')).rows[0].count,beforeBatch,'A rejected second meeting rolls back the entire batch');
    for(const id of ids.slice(3)){await login(id);assert.equal((await db.query('select public.is_schedule_user() as allowed')).rows[0].allowed,false);await assert.rejects(()=>insert(id));}
    await db.exec('reset role;');await db.query('update auth.users set email_confirmed_at=null where id=$1',[ids[0]]);await login(ids[0]);assert.equal((await db.query('select * from public.timetable_classes')).rows.length,0,'Confirmation revocation immediately removes access');
    await db.exec('reset role; set role anon;');await assert.rejects(()=>db.query('select * from public.timetable_classes'));await assert.rejects(()=>db.query('select public.is_schedule_user()'));
    console.log('PASS: verified members beyond two accounts, existing data retained, owner isolation, forged ownership and unconfirmed/banned/anonymous denial');
  }finally{await db.close();}
})().catch(error=>{console.error(error);process.exit(1);});
