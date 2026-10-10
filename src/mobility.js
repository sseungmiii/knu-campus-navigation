let mobilityController=null, facilityController=null, facilityGeneration=0;
const facilityLayers=[];
const kstTime=at=>new Date(at).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'});
function mobilityClear() {
  mobilityController?.abort(); facilityController?.abort(); facilityGeneration++;
  facilityLayers.splice(0).forEach(layer=>layer.remove());
  $('transitPanel').hidden=true; $('transitOptions').replaceChildren(); $('busArrivals').replaceChildren(); $('nearbyResults').replaceChildren();
  $('nearbyMessage').textContent='경로를 찾은 뒤 시설을 검색하세요.'; $('deadlineStatus').textContent='수업 시각과 경로를 선택하면 출발 마감 시각을 계산합니다.';
}
function updateDeadline() {
  const plan=selectedRoute&&departurePlan($('classStart').value ? `${$('classStart').value}:00+09:00` : '',selectedRoute.duration,$('safetyMinutes').value,$('indoorMinutes').value);
  if(!plan){$('deadlineStatus').textContent='수업 시각과 경로를 선택하면 출발 마감 시각을 계산합니다.';return;}
  $('deadlineStatus').textContent=`${kstTime(plan.deadline)}까지 출발 · ${plan.remainingMinutes>=0?`약 ${plan.remainingMinutes}분 남음`:`출발 마감 ${-plan.remainingMinutes}분 경과`} · 건물 내부 ${$('indoorMinutes').value}분 + 여유 ${$('safetyMinutes').value}분 포함. 예상 시간으로, 도착을 보장하지 않습니다.`;
  $('deadlineStatus').classList.toggle('error',plan.remainingMinutes<0);
  if(selectedRoute.connectionsComplete===false)$('deadlineStatus').textContent+=' 도보 연결이 불완전하여 출발 마감 계산에 누락 구간이 있을 수 있습니다.';
  if(selectedRoute.liveBus){
    const live=selectedRoute.liveBus,step=selectedRoute.steps.find(s=>s.type==='BUS'),index=selectedRoute.steps.indexOf(step);
    const bus=busDeparture(live.arrivals,step.vehicles,selectedRoute.steps,index,live.updatedAt);
    if(Date.now()-Date.parse(live.updatedAt)>60000){$('deadlineStatus').textContent+=' 버스 정보가 1분 이상 지났습니다. 새로고침해주세요.';return;}
    if(bus){const arrival=bus.arrival+(Number($('indoorMinutes').value)+Number($('safetyMinutes').value))*60000,late=arrival>Date.parse(`${$('classStart').value}:00+09:00`);
      $('deadlineStatus').textContent+=` 실시간 ${bus.route}번 탑승 목표: ${kstTime(bus.deadline)}까지 출발 · 강의실 도착 예상 ${kstTime(arrival)}${late?' (수업 시작을 넘길 수 있음)':''}. 첫 버스 대기는 실시간, 이후 이동·환승은 예상값.`;
    }else $('deadlineStatus').textContent+=' 현재 출발해 탈 수 있는 해당 노선의 버스 도착 정보가 없습니다.';
  }
}
function textNode(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
async function transitSearch(start,end,generation) {
  mobilityController=new AbortController();const controller=mobilityController;
  $('findRoute').disabled=true; $('findRoute').textContent='경로 찾는 중…'; message('버스·지하철 경로를 찾고 있습니다.');
  try{
    const response=await fetch(`${apiBase}/api/transit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start,end}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])});
    const data=await response.json();if(generation!==routeGeneration)return;if(!response.ok)throw new Error(data.error);
    $('transitPanel').hidden=false;
    for(const [index,route] of data.routes.entries()){
      const button=textNode('button',`${index+1}. 약 ${Math.ceil(route.duration/60)}분 · 환승 ${route.transfers}회 · ${route.steps.filter(s=>s.type!=='WALKING').map(s=>s.vehicles.join('/')).join(' → ')}`,'place-option');button.type='button';
      button.onclick=()=>selectTransit(route,start,end,index);$('transitOptions').appendChild(button);
    }
    selectTransit(data.routes[0],start,end,0); message('대중교통 경로를 표시했습니다. 버스 도착 정보는 별도로 조회하세요.');
  }catch(error){if(generation===routeGeneration)message(error.name==='AbortError'?'경로 조회가 취소되거나 시간이 초과됐습니다.':error.message||'대중교통 경로를 조회하지 못했습니다.',true);}
  finally{if(generation===routeGeneration){$('findRoute').textContent='경로 찾기';updateReady();}}
}
function selectTransit(route,start,end,index) {
  pacemaker.stop(); layers.splice(0).forEach(layer=>layer.remove());facilityLayers.splice(0).forEach(layer=>layer.remove()); facilityController?.abort(); facilityGeneration++;
  $('nearbyResults').replaceChildren();$('busArrivals').replaceChildren();$('pacePanel').hidden=true;
  const points=route.steps.flatMap(s=>s.points); selectedRoute={...route,start,end,points};
  for(const step of route.steps)layers.push(map.polyline(step.points,{color:{BUS:'#1976d2',SUBWAY:'#7b3fc6',WALKING:'#737f8d'}[step.type],weight:6,opacity:.95,dashArray:step.type==='WALKING'?'6,6':null}));
  map.fitPath(points);$('mapEmptyHint').hidden=true;$('routeSummary').hidden=false;
  $('routeSource').textContent='카카오 대중교통 예상';$('routeNames').textContent=`${start.name} → ${end.name}`;
  $('routeMinutes').textContent=`${Math.ceil(route.duration/60)}분`;$('routeDistance').textContent=formatDistance(route.distance);$('routeArrival').textContent=kstTime(Date.now()+route.duration*1000);
  $('routeCoverage').hidden=false;$('routeCoverage').textContent=`파랑: 버스 · 보라: 지하철 · 회색: 도보. ${route.durationNote||'운행·대기 시간은 예상값입니다.'}${route.connectionsComplete===false?' 도보 연결 일부를 확인하지 못했습니다.':''}`;
  $('routeInstructions').replaceChildren();route.steps.forEach(step=>$('routeInstructions').appendChild(textNode('li',`${step.text||({BUS:'버스',SUBWAY:'지하철',WALKING:'도보'}[step.type])} · ${Math.ceil(step.duration/60)}분`)));
  [...$('transitOptions').children].forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  const firstBus=route.steps.find(s=>s.type==='BUS');
  $('refreshBus').disabled=!firstBus?.boardingStop;
  $('busStatus').textContent=firstBus ? firstBus.boardingStop ? `${firstBus.boardingStop.name} · ${firstBus.vehicles.join('/')} 실시간 도착 조회 가능`:'승차 정류장을 정확히 연결하지 못해 실시간 조회를 제공하지 않습니다.' : '이 경로에는 버스 구간이 없습니다.';
  updateDeadline();
}
async function refreshBus() {
  const route=selectedRoute,step=route?.steps?.find(s=>s.type==='BUS');if(!step?.boardingStop)return;
  $('refreshBus').disabled=true;$('busStatus').textContent='실시간 도착 정보 조회 중…';$('busArrivals').replaceChildren();
  try{
    const response=await fetch(`${apiBase}/api/bus?stop=${encodeURIComponent(step.boardingStop.id)}`,{signal:AbortSignal.timeout(15000)});const data=await response.json();if(route!==selectedRoute)return;if(!response.ok)throw new Error(data.error);
    const arrivals=data.arrivals.filter(a=>step.vehicles.includes(a.route));
    route.liveBus={arrivals,updatedAt:data.updatedAt};updateDeadline();
    $('busStatus').textContent=`${data.stop.name} · ${kstTime(data.updatedAt)} 조회 · ${arrivals.length?'대구 실시간 정보':'도착 정보 없음(운행 종료 또는 제공 중단 가능)'}`;
    const beforeBus=route.steps.slice(0,route.steps.indexOf(step)).reduce((n,s)=>n+s.duration,0),elapsed=(Date.now()-Date.parse(data.updatedAt))/1000;
    for(const arrival of arrivals){const seconds=Math.max(0,arrival.seconds-elapsed),remaining=seconds-beforeBus-60;
      $('busArrivals').appendChild(textNode('p',`${arrival.route}번 · 약 ${Math.ceil(seconds/60)}분 후 · ${arrival.remainingStops}정류장 전${arrival.lowFloor?' · 저상':''} · ${remaining>=0?`이 버스 탑승 목표 출발: ${kstTime(Date.now()+remaining*1000)} (정류장까지 이동 + 1분 여유)`:'현재 출발하면 이 버스 탑승은 어려울 수 있습니다.'}`));}
  }catch(error){if(route===selectedRoute)$('busStatus').textContent=error.message||'버스 정보를 조회하지 못했습니다.';}
  finally{if(route===selectedRoute)$('refreshBus').disabled=false;}
}
async function searchNearby() {
  if(!selectedRoute){$('nearbyMessage').textContent='먼저 경로를 찾아주세요.';return;}
  facilityController?.abort();facilityController=new AbortController();const controller=facilityController,generation=++facilityGeneration;
  facilityLayers.splice(0).forEach(layer=>layer.remove());$('nearbyResults').replaceChildren();$('nearbyMessage').textContent='경로 주변 시설을 찾는 중…';
  // Only pedestrian segments are relevant for a stop along a transit journey.
  const paths=selectedRoute.mode==='transit'?selectedRoute.steps.filter(s=>s.type==='WALKING').map(s=>s.points):[selectedRoute.points];
  if(!paths.length){$('nearbyMessage').textContent='이 경로에 제공된 도보 구간이 없습니다.';return;}
  try{
    const category=$('facilityCategory').value;
    const responses=await Promise.all(paths.slice(0,3).map(async path=>{const points=path.filter((_,i)=>i===0||i===path.length-1||i%Math.ceil(path.length/35)===0);const response=await fetch(`${apiBase}/api/nearby`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points,category}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(18000)])});const data=await response.json();if(!response.ok)throw new Error(data.error);return data;}));
    if(generation!==facilityGeneration)return;const results=[...new Map(responses.flatMap(d=>d.places).map(p=>[p.id,p])).values()].sort((a,b)=>a.offset-b.offset).slice(0,15);
    $('nearbyMessage').textContent=results.length?responses[0].note:'검색 범위에서 시설을 찾지 못했습니다.';
    results.forEach((place,i)=>{
      const card=textNode('div','','facility-card');card.append(textNode('strong',`${i+1}. ${place.name}`),textNode('p',`${place.address} · 경로에서 직선 약 ${place.offset}m · 왕복 추가 약 ${place.estimatedExtraMinutes}분`));
      const button=textNode('button','지도에서 보기','secondary');button.type='button';button.onclick=()=>map.panTo(place.coords);card.appendChild(button);
      if(place.url){const link=textNode('a','상세 정보');link.href=place.url;link.target='_blank';link.rel='noopener noreferrer';card.appendChild(link);}
      $('nearbyResults').appendChild(card);facilityLayers.push(map.marker(place.coords,`<div class="facility-marker">${i+1}</div>`));
    });
  }catch(error){if(generation===facilityGeneration)$('nearbyMessage').textContent=error.message||'시설을 조회하지 못했습니다.';}
}
async function searchMetro(event) {
  event.preventDefault();$('metroStatus').textContent='공식 시간표 조회 중…';$('metroSearch').disabled=true;
  try{const query=new URLSearchParams({station:$('metroStation').value.trim(),line:$('metroLine').value,direction:$('metroDirection').value,day:$('metroDay').value});const response=await fetch(`${apiBase}/api/metro?${query}`,{signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw new Error(data.error);const trains=nextTrain(data.times);$('metroStatus').textContent=`${data.station} · ${data.source} · 다음 열차: ${trains.length?trains.join(', '):'오늘 남은 열차 없음'} (선택한 운행일 기준, 공휴일은 직접 선택)`;}catch(error){$('metroStatus').textContent=error.message||'시간표를 조회하지 못했습니다.';}finally{$('metroSearch').disabled=false;}
}
window.addEventListener('DOMContentLoaded',()=>{
  $('loadMeals').onclick=async()=>{
    $('loadMeals').disabled=true;$('mealsStatus').textContent='오늘 메뉴 조회 중…';$('mealsResults').replaceChildren();
    try{const response=await fetch(`${apiBase}/api/meals`,{signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw new Error(data.error);
      $('mealsStatus').textContent=`${data.date} 메뉴 · 갱신 ${data.updatedAt||'확인 불가'}${data.status!=='success'?' · 최근 크롤링 실패: 아래 정보의 날짜를 확인하세요.':''}`;
      for(const restaurant of data.restaurants){const card=textNode('div','','facility-card');card.append(textNode('strong',restaurant.name));
        if(!restaurant.meals.length)card.appendChild(textNode('p','식단정보가 없습니다.'));
        for(const meal of restaurant.meals)card.appendChild(textNode('p',`${meal.type}${meal.time?' · '+meal.time:''}: ${meal.items.join(', ')}`));
        const button=textNode('button','식당 위치 검색','secondary');button.type='button';button.onclick=()=>{$('endQuery').value=`경북대학교 ${restaurant.name.replace(/\(.*\)/,'')}`;search('end');};card.appendChild(button);$('mealsResults').appendChild(card);
      }
    }catch(error){$('mealsStatus').textContent=error.message||'학식 정보를 불러오지 못했습니다.';}finally{$('loadMeals').disabled=false;}
  };
  $('transportMode').onchange=()=>{clearRoute();$('findRoute').textContent='경로 찾기';$('routeMode').disabled=$('transportMode').value==='transit';message('새 이동 수단으로 경로를 검색하세요.');};
  ['classStart','safetyMinutes','indoorMinutes'].forEach(id=>$(id).onchange=updateDeadline);
  $('refreshBus').onclick=refreshBus;$('searchNearby').onclick=searchNearby;$('metroForm').onsubmit=searchMetro;
  const weekday=new Date(Date.now()+9*3600000).getUTCDay();$('metroDay').value=weekday===0?'HOLIDAY':weekday===6?'SAT':'WEEKDAY';
  const timer=setInterval(updateDeadline,30000);window.addEventListener('pagehide',()=>{clearInterval(timer);mobilityController?.abort();facilityController?.abort();});
});
