const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes=new Map(),drawn=[];
class Element {
  constructor(){this.children=[];this.textContent='';this.value='';this.style={};this.dataset={};this.attrs={};this.classList={add(){},remove(){},toggle(){}};}
  append(...children){this.children.push(...children);}
  appendChild(child){this.append(child);}
  replaceChildren(...children){this.children=children;}
  setAttribute(name,value){this.attrs[name]=value;}
  querySelectorAll(){return this.children;}
}
const $=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
for(const type of ['ALL','BUS','SUBWAY','BUS_AND_SUBWAY']){const button=new Element();button.dataset.transitType=type;$('transitFilters').append(button);}
const step=(type,vehicles,duration=100)=>({type,vehicles,duration,distance:100,points:[[35.88,128.61],[35.89,128.62]],stops:['승차역','하차역']});
const routes=[{providerRank:0,duration:500,transfers:1,steps:[step('BUS',['937']),step('WALKING',[]),step('SUBWAY',['2호선'])]},{providerRank:1,duration:700,transfers:0,steps:[step('BUS',['410'])]}];
let initialize;
const context=vm.createContext({$,URLSearchParams,AbortController,AbortSignal,apiBase:'',Date,
  window:{addEventListener(name,callback){if(name==='DOMContentLoaded')initialize=callback;}},document:{createElement(){return new Element();},addEventListener(){}},
  setInterval(){},clearInterval(){},routeGeneration:1,selectedRoute:null,layers:[],pacemaker:{stop(){}},
  map:{polyline(points,options){drawn.push(options);return {remove(){}};},fitPath(){}},formatDistance:meters=>`${meters}m`,message(){},updateReady(){},
  fetch:async url=>({ok:true,json:async()=>url.includes('mode=day')?{day:'WEEKDAY',serviceDate:'2026-10-20'}:{routes}})});
vm.runInContext(fs.readFileSync(require.resolve('../src/mobility-utils.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require.resolve('../src/mobility.js'),'utf8'),context);initialize();
(async()=>{
  await context.transitSearch({name:'출발'},{name:'도착'},1);
  assert.equal($('transitOptions').children.length,2);assert.equal(context.selectedRoute.providerRank,1);
  assert.equal($('transitOptions').children[0].attrs['aria-pressed'],'true');
  assert.deepEqual($('transitFilters').children[1].children.map(child=>child.textContent),['버스','1']);
  $('transitSort').value='TIME';$('transitSort').onchange();assert.equal(context.selectedRoute.providerRank,0);
  assert.ok(drawn.some(options=>options.color==='#28a647'));assert.ok(drawn.some(options=>options.dashArray==='6,6'));
  $('transitFilters').children[2].onclick();assert.equal(context.selectedRoute,null);assert.equal($('routeSummary').hidden,true);assert.equal($('refreshBus').disabled,true);
  $('transitFilters').children[1].onclick();assert.equal($('transitOptions').children.length,1);assert.equal(context.selectedRoute.providerRank,1);
  context.mobilityClear();$('transitSort').onchange();assert.equal($('transitOptions').children.length,0,'Cleared search must not reappear when a sort control changes');
  console.log('PASS: transit cards, direct default selection, sort/filter controls, map colors, empty category cleanup and stale result reset');
})().catch(error=>{console.error(error);process.exit(1);});
