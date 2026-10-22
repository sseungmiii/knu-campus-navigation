const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {mealMenuItem,selectedRestaurantMeals}=require('../src/mobility-utils.js');
assert.deepEqual(mealMenuItem('돈가스 ￦ 6,000'),{name:'돈가스',price:6000});
assert.deepEqual(mealMenuItem('비빔밥 ₩5,500'),{name:'비빔밥',price:5500});
assert.deepEqual(mealMenuItem('천원의 아침밥 1,000원'),{name:'천원의 아침밥',price:1000});
assert.deepEqual(mealMenuItem('메뉴 미제공'),{name:'메뉴 미제공',price:null});
assert.deepEqual(mealMenuItem('닭갈비 흰밥 된장국 김치 ￦ 6,000'),{name:'닭갈비 흰밥 된장국 김치',price:6000});
const nodes=new Map();
class Element {
  constructor(){this.children=[];this.textContent='';this.dataset={};this.style={};this.attrs={};this.value='';this.classList={add(){},remove(){}};}
  append(...children){this.children.push(...children);}
  appendChild(child){this.append(child);}
  replaceChildren(...children){this.children=children;}
  setAttribute(name,value){this.attrs[name]=value;}
  querySelectorAll(){return this.children;}
}
const $=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
for(const type of ['ALL','조식','중식','석식']){const button=new Element();button.dataset.mealType=type;$('mealFilters').append(button);}
let initialize,now=Date.parse('2026-10-23T10:00:00+09:00'),calls=0,resolveFetch;
class Clock extends Date{static now(){return now;}}
const data={date:'2026-10-23',updatedAt:'2026-10-23 08:00:00',status:'success',restaurants:[
  {name:'정보센터식당',meals:[{type:'석식',time:'17:00~19:00',items:['비빔밥 6,000원']},{type:'중식',time:'11:00~13:30',items:['돈가스 ￦ 5,000','가격없는 메뉴']}]},
  {name:'카페테리아 첨성',meals:[{type:'조식',time:'09:00~11:00',items:['아침밥 ₩1,000']}]}]};
assert.deepEqual(selectedRestaurantMeals(data.restaurants[0]).map(meal=>meal.type),['중식','석식']);
const context=vm.createContext({$,Date:Clock,URLSearchParams,AbortController,AbortSignal,apiBase:'',
  window:{addEventListener(name,callback){if(name==='DOMContentLoaded')initialize=callback;}},
  document:{createElement(){return new Element();},addEventListener(){}},setInterval(){},clearInterval(){},showPurpose(){},search(){},
  fetch:async url=>{if(!url.includes('mode=day'))calls++;return {ok:true,json:async()=>url.includes('mode=day')?{day:'WEEKDAY',serviceDate:'2026-10-23'}:data};}});
vm.runInContext(fs.readFileSync(require.resolve('../src/mobility-utils.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require.resolve('../src/mobility.js'),'utf8'),context);initialize();
const text=node=>[node.textContent,...node.children.map(text)].join(' ');
(async()=>{
  await context.loadTodayMeals();assert.equal(calls,1);
  assert.match(text($('mealsResults')),/5,000원/);assert.doesNotMatch(text($('mealsResults')),/￦/);
  assert.match(text($('mealsResults')),/운영 11:00~13:30/);assert.match(text($('mealsResults')),/가격 미제공/);
  await context.loadTodayMeals();assert.equal(calls,1,'Reopening the tab uses today’s cached results');
  $('mealFilters').children[1].onclick();
  assert.equal($('mealFilters').children[1].attrs['aria-pressed'],'true');
  assert.equal($('mealsResults').children[0].children[0].children[0].textContent,'카페테리아 첨성','Breakfast restaurants move above restaurants without breakfast');
  assert.match(text($('mealsResults')),/1,000원/);assert.doesNotMatch(text($('mealsResults')),/돈가스/);
  assert.match(text($('mealsResults')),/휴무 여부는 식당에 확인/);assert.match($('mealsCount').textContent,/조식.*1곳/);
  context.fetch=()=>new Promise(resolve=>{resolveFetch=resolve;});
  const refresh=context.loadTodayMeals(true),duplicate=context.loadTodayMeals(true);assert.equal(refresh,duplicate);
  resolveFetch({ok:false,json:async()=>({error:'연결 실패'})});await refresh;assert.equal($('loadMeals').disabled,false);assert.match($('mealsStatus').textContent,/연결 실패/);assert.match(text($('mealsResults')),/1,000원/);
  now=Date.parse('2026-10-24T00:01:00+09:00');
  context.fetch=async()=>({ok:true,json:async()=>data});await context.loadTodayMeals();assert.equal($('mealsResults').children.length,0,'Yesterday’s food must not appear as today’s menu');assert.match($('mealsStatus').textContent,/날짜가 바뀌었습니다/);
  console.log('PASS: meal price separation, meal type filters, hours, no-data distinction, request deduplication, retry and KST date rollover');
})().catch(error=>{console.error(error);process.exit(1);});
