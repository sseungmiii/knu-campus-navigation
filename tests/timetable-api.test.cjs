const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const timetable=require('../lib/timetable.cjs'),requestOrigin=require('../lib/request-origin.cjs');
const source=fs.readFileSync(require.resolve('../app/api/timetable/route.js'),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
const owner='30000000-0000-4000-8000-000000000001';let calls=[],updates=[],filters=[],fail=false;
const supabase={auth:{getUser:async()=>({data:{user:{id:owner,email_confirmed_at:'2026-01-01'}}})},rpc:async()=>({data:true}),from:()=>({
  insert(rows){calls.push(rows);return {select:async()=>fail?{error:{message:'upstream detail'}}:{data:rows.map((row,i)=>({...row,id:String(i)}))}};},
  update(row){updates.push(row);const query={eq(key,value){filters.push([key,value]);return query;},select(){return {maybeSingle:async()=>({data:{id:owner,...row}})};}};return query;}
})};
const context=vm.createContext({Buffer,NextResponse:{json:(data,options)=>({data,...options})},createClient:async()=>supabase,timetable,requestOrigin,classTrip:require('../lib/class-trip.cjs')});vm.runInContext(source,context);
const common={title:'알고리즘',term:'2026-2',place_name:'IT1호관',latitude:35.889,longitude:128.61,starts_on:'2026-09-01',ends_on:'2026-12-31',owner_id:'forged'};
const meetings=[{weekday:1,start_minute:540,end_minute:615},{weekday:3,start_minute:630,end_minute:705}];
const request=payload=>new Request('https://example.com/api/timetable',{method:'POST',headers:{host:'example.com',origin:'https://example.com','content-type':'application/json'},body:JSON.stringify(payload)});
(async()=>{
  let response=await context.write(request({...common,meetings}),'POST');assert.equal(response.status,201);assert.equal(response.data.classes.length,2);assert.equal(calls.length,1);assert.equal(calls[0].length,2);assert.ok(calls[0].every(row=>row.owner_id===owner));assert.equal(response.headers['Cache-Control'],'private, no-store');
  response=await context.write(request({...common,meetings:[meetings[0],{...meetings[1],end_minute:600}]}),'POST');assert.equal(response.status,400);assert.equal(calls.length,1,'Invalid second meeting must prevent any database write');
  fail=true;response=await context.write(request({...common,meetings}),'POST');assert.equal(response.status,503);assert.equal(response.data.classes,undefined);assert.doesNotMatch(JSON.stringify(response.data),/upstream/);
  const favorite={start:{name:'출발지',coords:[35.88,128.61]},mode:'walk',routeMode:'SHORTEST',duration:900,signature:'',indoorMinutes:3,safetyMinutes:5};
  response=await context.write(request({id:owner,favorite_route:favorite,owner_id:'forged'}),'PUT');assert.equal(response.status,200);assert.equal(updates.length,1);assert.deepEqual(filters,[['id',owner],['owner_id',owner]]);assert.equal(updates[0].owner_id,undefined);
  response=await context.write(request({id:owner,favorite_route:{...favorite,duration:-1}}),'PUT');assert.equal(response.status,400);assert.equal(updates.length,1);
  console.log('PASS: timetable batch uses one owner-scoped insert, validates all meetings before writing and handles failures');
})().catch(error=>{console.error(error);process.exit(1);});
