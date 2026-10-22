const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const nodes=new Map(),timers=[];
class Element {
  constructor(){this.children=[];this.textContent='';this.value='';this.hidden=false;this.classList={add(){},remove(){}};}
  set id(value){nodes.set(value,this);}
  append(...children){this.children.push(...children);}
  appendChild(child){this.append(child);}
  replaceChildren(...children){this.children=children;}
  requestSubmit(){this.submitted=(this.submitted||0)+1;}
  querySelectorAll(){return [];}
}
const $=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
const text=node=>[node.textContent,...node.children.map(text)].join(' ');
let initialize,now=Date.parse('2026-10-20T09:00:00+09:00'),resolveFetch;
class Clock extends Date {static now(){return now;}}
const data={station:'반월당',line:'2',availableLines:['1','2'],day:'WEEKDAY',serviceDate:'2026-10-20',updatedAt:new Date(now).toISOString(),directions:[
  {direction:'DOWN',heading:'영남대',times:['09:00:02','09:05'],trains:[{time:'09:00:02',destination:null},{time:'09:05',destination:'영남대'}]},
  {direction:'UP',heading:'문양',times:['09:01'],trains:[{time:'09:01',destination:'문양'}]}
]};
const context=vm.createContext({$,Date:Clock,URLSearchParams,AbortController,AbortSignal,apiBase:'',
  window:{addEventListener(name,callback){if(name==='DOMContentLoaded')initialize=callback;}},
  document:{createElement(){return new Element();},addEventListener(){}},
  setInterval(callback,delay){timers.push({callback,delay});return timers.length;},clearInterval(){},
  formatDistance:meters=>`${meters} m`,getPosition:async()=>({coords:{latitude:35.89,longitude:128.61}}),
  showPurpose(){},search(){},
  fetch:async url=>({ok:true,json:async()=>url.includes('mode=day')?{serviceDate:'2026-10-20',day:'WEEKDAY'}:data})});
vm.runInContext(fs.readFileSync(require.resolve('../src/mobility-utils.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require.resolve('../src/mobility.js'),'utf8'),context);
initialize();
$('metroStation').value='반월당';$('metroLine').value='auto';
(async()=>{
  await context.searchMetro({preventDefault(){}});
  assert.equal($('metroLineChoice').hidden,false);
  assert.deepEqual($('metroLine').children.map(option=>option.value),['1','2']);
  assert.match(text($('metroCountdown')),/영남대 방면/);assert.match(text($('metroCountdown')),/문양 방면/);
  assert.doesNotMatch(text($('metroCountdown')),/상행|하행|정규 운행/);
  assert.match($('metroToday').textContent,/평일.*자동 적용/);
  const tick=timers.find(timer=>timer.delay===1000).callback;
  assert.match(text($('metroCountdown')),/0분 02초/);
  now+=1000;tick();assert.match(text($('metroCountdown')),/0분 01초/);
  now+=2000;tick();assert.doesNotMatch(text($('metroCountdown')),/09:00:02/);
  assert.match(text($('metroCountdown')),/4분 57초/);
  context.fetch=async()=>({ok:true,json:async()=>({...data,availableLines:undefined})});
  await context.searchMetro({preventDefault(){}});
  assert.deepEqual($('metroLine').children.map(option=>option.value),['1','2'],'Switching lines retains transfer choices without searching other lines again');
  // A reply for the previous station must not repopulate results after editing.
  context.fetch=()=>new Promise(resolve=>{resolveFetch=resolve;});
  const pending=context.searchMetro({preventDefault(){}});
  $('metroStation').oninput();
  resolveFetch({ok:true,json:async()=>data});await pending;
  assert.equal($('metroResults').children.length,0);
  assert.equal($('metroLine').children[0].value,'auto');
  assert.equal($('metroSearch').disabled,false);
  context.fetch=async(url,options)=>{assert.equal(JSON.parse(options.body).category,'SW8');return {ok:true,json:async()=>({places:[{name:'경대병원역 대구2호선',offset:800}]})};};
  await context.findMetroNearby();
  assert.match(text($('metroNearbyResults')),/경대병원역/);
  $('metroNearbyResults').children[0].onclick();
  assert.equal($('metroStation').value,'경대병원역');assert.equal($('metroLine').value,'2');assert.equal($('metroForm').submitted,1);
  context.getPosition=async()=>{throw new Error('위치 권한이 거부되었습니다.');};
  await context.findMetroNearby();assert.match($('metroNearbyStatus').textContent,/위치 권한이 거부/);assert.equal($('findMetroNearby').disabled,false);
  context.fetch=async()=>({ok:true,json:async()=>({date:'2026-10-20',status:'success',restaurants:[{name:'GP감꽃식당',meals:[]}]})});
  await $('loadMeals').onclick();
  $('mealsResults').children[0].children.at(-1).children.find(child=>child.type==='button').onclick();
  assert.equal($('endQuery').value,'경북대학교 글로벌플라자');
  console.log('PASS: both destination headings, seconds tick, service-day display, nearby station selection/denial, meal building handoff and stale search invalidation');
})().catch(error=>{console.error(error);process.exit(1);});
