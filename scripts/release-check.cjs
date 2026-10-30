// Read-only deployment smoke checks. Never promotes or merges a deployment.
const assert=require('node:assert/strict');
(async()=>{
  const base=process.argv[2]||'https://knu-campus-navigation-test.vercel.app';
  if(!['https://knu-campus-navigation-test.vercel.app','https://knu-campus-navigation.vercel.app'].includes(base))throw Error('확인할 크누패스 고정 주소를 지정해주세요.');
  async function request(path,options={}){return fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(45000),...options});}
  const publicPage=await request('/');assert.equal(publicPage.status,200,'Public map unavailable');
  const gate=await request('/campus-lab');assert.equal(gate.status,307,'Anonymous workbench must redirect');assert.match(gate.headers.get('location')||'',/\/admin\/login$/);
  const auth=await (await request('/api/admin/session')).json();assert.equal(auth.isAdmin,false,'Anonymous request cannot be admin');
  const denied=await request('/api/admin/session',{method:'POST',headers:{Origin:base}});assert.equal(denied.status,401,'Anonymous mutation authorization must fail');
  for(const path of ['/api/search?q=IT1','/api/bus?stop=7021022400','/api/weather'])assert.equal((await request(path)).status,200,path+' unavailable');
  const route=await request('/api/walk',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({start:{name:'IT1',coords:[35.8874939272576,128.612752066575]},end:{name:'복지관',coords:[35.88902007473884,128.61452386276625]}})});assert.equal(route.status,200,'Walking API unavailable');
  console.log('PASS: public map, anonymous admin denial, search, live bus, weather and walking smoke checks');
  if(!auth.configured){console.error('PENDING: 관리자 설정 3개 등록·재배포 및 실제 관리자 로그인 확인이 필요합니다.');process.exitCode=2;return;}
  console.log('READY FOR MANUAL REVIEW: 관리자 로그인을 확인한 뒤 main PR을 검토하세요. 이 검사는 배포하지 않습니다.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
