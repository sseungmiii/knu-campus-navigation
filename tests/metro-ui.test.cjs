const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const nodes=new Map(),timers=[];
class Element {
  constructor(){this.children=[];this.textContent='';this.value='';this.hidden=false;this.classList={add(){},remove(){}};}
  set id(value){nodes.set(value,this);}
  append(...children){this.children.push(...children);}
  appendChild(child){this.append(child);}
  replaceChildren(...children){this.children=children;}
}
const $=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
const text=node=>[node.textContent,...node.children.map(text)].join(' ');
let initialize,now=Date.parse('2026-10-20T09:00:00+09:00'),resolveFetch;
class Clock extends Date {static now(){return now;}}
const data={station:'반월당',line:'1',availableLines:['1','2'],day:'WEEKDAY',direction:'UP',updatedAt:new Date(now).toISOString(),times:['09:00:02','09:05'],trains:[{time:'09:00:02',destination:'안심'},{time:'09:05',destination:'안심'}]};
const context=vm.createContext({$,Date:Clock,URLSearchParams,AbortController,AbortSignal,apiBase:'',
  window:{addEventListener(name,callback){if(name==='DOMContentLoaded')initialize=callback;}},
  document:{createElement(){return new Element();},addEventListener(){}},
  setInterval(callback,delay){timers.push({callback,delay});return timers.length;},clearInterval(){},
  fetch:async()=>({ok:true,json:async()=>data})});
vm.runInContext(fs.readFileSync(require.resolve('../src/mobility-utils.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require.resolve('../src/mobility.js'),'utf8'),context);
initialize();
$('metroStation').value='반월당';$('metroLine').value='auto';$('metroDirection').value='UP';
(async()=>{
  await context.searchMetro({preventDefault(){}});
  assert.equal($('metroLineChoice').hidden,false);
  assert.deepEqual($('metroLine').children.map(option=>option.value),['1','2']);
  const tick=timers.find(timer=>timer.delay===1000).callback;
  assert.match(text($('metroCountdown')),/0분 02초/);
  now+=1000;tick();assert.match(text($('metroCountdown')),/0분 01초/);
  now+=2000;tick();assert.doesNotMatch(text($('metroCountdown')),/09:00:02/);
  assert.match(text($('metroCountdown')),/4분 57초/);
  // A reply for the previous station must not repopulate results after editing.
  context.fetch=()=>new Promise(resolve=>{resolveFetch=resolve;});
  const pending=context.searchMetro({preventDefault(){}});
  $('metroStation').oninput();
  resolveFetch({ok:true,json:async()=>data});await pending;
  assert.equal($('metroResults').children.length,0);
  assert.equal($('metroLine').children[0].value,'auto');
  assert.equal($('metroSearch').disabled,false);
  console.log('PASS: metro seconds tick, departed train replacement, transfer choices and stale search invalidation');
})().catch(error=>{console.error(error);process.exit(1);});
