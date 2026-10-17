const assert = require('node:assert/strict');
const {metro, normalizeMetro} = require('../server/metro.cjs');
const input = {station:'동대구', line:'1', direction:'UP', day:'WEEKDAY'};
const xml = '<?xml version="1.0"?><rss><apiDataList><apiData><LINE_NO>1</LINE_NO><STT_NM>동대구</STT_NM><SCHEDULE_METH>상행</SCHEDULE_METH><SCHEDULE>9:15:00(안심), 5:30:00, 24:05:00, garbage</SCHEDULE></apiData></apiDataList></rss>';
const normalized = normalizeMetro(xml, input);
assert.deepEqual(normalized.times, ['05:30','09:15','24:05']);
assert.equal(normalized.trains[1].destination,'안심');
assert.throws(() => normalizeMetro(xml,{...input,line:'2'}), error => error.code==='NO_TIMETABLE');
assert.throws(() => normalizeMetro('<html>error</html>',input), error => error.status===502);
(async () => {
  const calls=[];
  const token='0123456789ABCDEF0123456789ABCDEF';
  const result=await metro(new URLSearchParams({...input,station:'동대구역'}),{},async (url,options)=>{
    calls.push({url,options});
    return {ok:true,text:async()=>calls.length===1?`<script>document.cookie = 'sabSignature=${token}'; document.cookie='sabFingerPrint=...';window.location.reload();</script>`:xml};
  });
  assert.equal(calls.length,2);
  assert.equal(calls[0].url,calls[1].url);
  assert.equal(calls[0].options.signal,calls[1].options.signal);
  assert.ok(calls[1].options.headers.Cookie.includes(token));
  assert.equal(new URL(calls[0].url).searchParams.get('STT_NM'),'동대구역');
  assert.equal(result.trains.length,3);
  let count=0;
  await assert.rejects(()=>metro(new URLSearchParams(input),{},async()=>{count++;return {ok:true,text:async()=>`<script>document.cookie='sabSignature=${token}';sabFingerPrint</script>`};}),error=>error.status===502);
  assert.equal(count,2,'Only one confirmation retry is allowed');
  await assert.rejects(()=>metro(new URLSearchParams({...input,station:'<bad>'}),{},()=>{throw Error('must not fetch');}),error=>error.status===400);
  console.log('PASS: metro confirmation retry, strict XML and station/direction matching, terminal names, input validation');
})().catch(error=>{console.error(error);process.exit(1);});
