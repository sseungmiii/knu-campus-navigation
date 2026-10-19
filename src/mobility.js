let mobilityController=null, facilityController=null, facilityGeneration=0;
const facilityLayers=[];
let transitSession=null,transitType='ALL';
const kstTime=at=>new Date(at).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'});
function mobilityClear() {
  transitSession=null;
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
function transitDuration(seconds){const minutes=Math.ceil(seconds/60);return minutes>=60?`${Math.floor(minutes/60)}시간 ${minutes%60}분`:`${minutes}분`;}
function transitCard(route,fastest) {
  const metrics=transitMetrics(route),button=textNode('button','','transit-route-card');button.type='button';button.setAttribute('aria-pressed','false');
  const badges=textNode('span','','transit-badges');
  if(metrics.transfers===0)badges.append(textNode('span','환승 없음','transit-badge'));
  if(route.duration===fastest)badges.append(textNode('span','가장 빠름','transit-badge'));
  if(badges.children.length)button.append(badges);
  button.append(textNode('strong',transitDuration(route.duration),'transit-total'));
  const walk=metrics.walkingDistance===null?'도보 거리 확인 불가':`도보 ${formatDistance(metrics.walkingDistance)}`;
  button.append(textNode('span',`환승 ${metrics.transfers}회 · ${walk} · ${route.connectionsComplete===false?'확인된 ':''}도보 ${transitDuration(metrics.walkingSeconds)}${Number.isFinite(route.fare)?' · '+route.fare.toLocaleString('ko-KR')+'원':''}`,'transit-card-meta'));
  const bar=textNode('span','','transit-timeline');bar.setAttribute('aria-label','구간별 소요시간');
  for(const step of route.steps){
    if(step.duration<=0)continue;
    const style=transitStepStyle(step),segment=textNode('span',`${Math.ceil(step.duration/60)}분`,'transit-segment');
    segment.style.flexGrow=String(step.duration);segment.style.backgroundColor=style.color;segment.style.color=style.textColor;segment.title=`${style.label} ${transitDuration(step.duration)}`;segment.setAttribute('aria-label',segment.title);bar.append(segment);
  }
  button.append(bar);
  const details=textNode('span','','transit-card-steps');
  for(const step of route.steps){
    const style=transitStepStyle(step),row=textNode('span','','transit-card-step'),chip=textNode('span',style.label,'transit-chip');chip.style.backgroundColor=style.color;chip.style.color=style.textColor;row.append(chip);
    const ride=step.type!=='WALKING';
    const names=ride?(step.vehicles?.join(' / ')||style.label):transitDuration(step.duration);
    const stops=ride&&step.stops?.length?`${step.stops[0]} → ${step.stops.at(-1)}`:step.text||'';
    const description=textNode('span','','transit-step-description');description.append(textNode('strong',names),textNode('span',stops));row.append(description);details.append(row);
  }
  button.append(details);
  if(route.connectionsComplete===false)button.append(textNode('span','일부 도보 연결 미확인 · 실제 이동시간이 더 길 수 있습니다.','transit-card-note'));
  return button;
}
function renderTransitOptions() {
  if(!transitSession)return;
  const {routes,start,end}=transitSession;
  const candidates=transitCandidates(routes,transitType,$('transitSort').value);
  for(const button of $('transitFilters').querySelectorAll('button')){
    const type=button.dataset.transitType,count=type==='ALL'?routes.length:routes.filter(route=>transitMetrics(route).type===type).length;
    button.textContent=`${{ALL:'전체',BUS:'버스',SUBWAY:'지하철',BUS_AND_SUBWAY:'버스+지하철'}[type]} ${count}`;
    button.setAttribute('aria-pressed',String(type===transitType));
  }
  $('transitCount').textContent=`${candidates.length}개 경로`;$('transitOptions').replaceChildren();
  if(!candidates.length){
    $('transitOptions').append(textNode('p','이 이동 수단의 경로가 없습니다. 다른 종류를 선택해주세요.','message'));
    layers.splice(0).forEach(layer=>layer.remove());facilityLayers.splice(0).forEach(layer=>layer.remove());facilityController?.abort();facilityGeneration++;
    selectedRoute=null;$('routeSummary').hidden=true;$('mapEmptyHint').hidden=false;$('busArrivals').replaceChildren();$('refreshBus').disabled=true;$('busStatus').textContent='경로를 선택하면 버스 정보를 확인할 수 있습니다.';
    $('nearbyResults').replaceChildren();updateDeadline();return;
  }
  const fastest=Math.min(...candidates.map(route=>route.duration));
  for(const [index,route] of candidates.entries()){
    const button=transitCard(route,fastest);button.onclick=()=>selectTransit(route,start,end,index);$('transitOptions').append(button);
  }
  selectTransit(candidates[0],start,end,0);
}
async function transitSearch(start,end,generation) {
  mobilityController=new AbortController();const controller=mobilityController;
  $('findRoute').disabled=true; $('findRoute').textContent='경로 찾는 중…'; message('버스·지하철 경로를 찾고 있습니다.');
  try{
    const response=await fetch(`${apiBase}/api/transit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start,end}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])});
    const data=await response.json();if(generation!==routeGeneration)return;if(!response.ok)throw new Error(data.error);
    $('transitPanel').hidden=false;
    transitSession={routes:data.routes,start,end};transitType='ALL';$('transitSort').value='TRANSFERS';renderTransitOptions();
    message('최소환승순으로 경로를 표시했습니다. 종류와 정렬을 바꿔 비교할 수 있습니다. 운행·대기 시간은 예상값입니다.');
  }catch(error){if(generation===routeGeneration)message(error.name==='AbortError'?'경로 조회가 취소되거나 시간이 초과됐습니다.':error.message||'대중교통 경로를 조회하지 못했습니다.',true);}
  finally{if(generation===routeGeneration){$('findRoute').textContent='경로 찾기';updateReady();}}
}
function selectTransit(route,start,end,index) {
  pacemaker.stop(); layers.splice(0).forEach(layer=>layer.remove());facilityLayers.splice(0).forEach(layer=>layer.remove()); facilityController?.abort(); facilityGeneration++;
  $('nearbyResults').replaceChildren();$('busArrivals').replaceChildren();$('pacePanel').hidden=true;
  const points=route.steps.flatMap(s=>s.points); selectedRoute={...route,start,end,points};
  for(const step of route.steps)layers.push(map.polyline(step.points,{color:transitStepStyle(step).mapColor,weight:6,opacity:.95,dashArray:step.type==='WALKING'?'6,6':null}));
  map.fitPath(points);$('mapEmptyHint').hidden=true;$('routeSummary').hidden=false;
  $('routeSource').textContent='카카오 대중교통 예상';$('routeNames').textContent=`${start.name} → ${end.name}`;
  $('routeMinutes').textContent=`${Math.ceil(route.duration/60)}분`;$('routeDistance').textContent=formatDistance(route.distance);$('routeArrival').textContent=kstTime(Date.now()+route.duration*1000);
  $('routeCoverage').hidden=false;$('routeCoverage').textContent=`버스는 노선 종류별 색, 지하철은 호선별 색, 도보는 회색 점선입니다. ${route.durationNote||'운행·대기 시간은 예상값입니다.'}${route.connectionsComplete===false?' 도보 연결 일부를 확인하지 못했습니다.':''}`;
  $('routeInstructions').replaceChildren();route.steps.forEach(step=>{const item=textNode('li',`${step.text||transitStepStyle(step).label} · ${Math.ceil(step.duration/60)}분`);item.style.borderLeft=`4px solid ${transitStepStyle(step).mapColor}`;$('routeInstructions').appendChild(item);});
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
let metroSchedule=null,metroController=null,metroGeneration=0,metroNearbyGeneration=0;
const metroDays={WEEKDAY:'평일',SAT:'토요일',HOLIDAY:'일요일·공휴일'};
function resetMetroStation() {
  clearMetroResults();const option=textNode('option','역 이름으로 자동 선택');option.value='auto';
  $('metroLine').replaceChildren(option);$('metroLine').value='auto';$('metroLineChoice').hidden=true;
}
async function findMetroNearby() {
  const generation=++metroNearbyGeneration;
  $('findMetroNearby').disabled=true;$('metroNearbyStatus').textContent='현재 위치에서 가까운 역을 찾는 중…';$('metroNearbyResults').replaceChildren();
  try{
    const position=await getPosition();if(generation!==metroNearbyGeneration)return;
    const response=await fetch(`${apiBase}/api/nearby`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:'SW8',points:[[position.coords.latitude,position.coords.longitude]]}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();if(generation!==metroNearbyGeneration)return;if(!response.ok)throw new Error(data.error);
    $('metroNearbyStatus').textContent=data.places.length?'가까운 역을 누르면 양방향 열차를 조회합니다. 거리는 직선 기준입니다.':'5km 이내 대구 1~3호선 역을 찾지 못했습니다. 역 이름을 직접 입력해주세요.';
    for(const place of data.places){
      const station=place.name.replace(/\s+.*$/,'').replace(/\([^)]*\)/g,'');
      const button=textNode('button','','place-option');button.type='button';
      button.append(textNode('strong',place.name),textNode('span',formatDistance(place.offset)));
      button.onclick=()=>{
        resetMetroStation();$('metroStation').value=station;
        const line=place.name.match(/대구([123])호선/);
        if(line){const option=textNode('option',`${line[1]}호선`);option.value=line[1];$('metroLine').append(option);$('metroLine').value=line[1];}
        $('metroForm').requestSubmit();
      };$('metroNearbyResults').append(button);
    }
  }catch(error){if(generation===metroNearbyGeneration)$('metroNearbyStatus').textContent=error.name==='TimeoutError'?'주변 역 응답이 늦습니다. 다시 시도해주세요.':error.message||'주변 역을 찾지 못했습니다.';}
  finally{if(generation===metroNearbyGeneration)$('findMetroNearby').disabled=false;}
}
function showMetroDay(data) {
  $('metroToday').textContent=`${data.serviceDate} · ${metroDays[data.day]}${data.holidayName?' · '+data.holidayName:''}${$('metroDay').value==='auto'?' 자동 적용':' 직접 선택'}`;
}
async function loadMetroDay() {
  try{const response=await fetch(`${apiBase}/api/metro?mode=day`,{signal:AbortSignal.timeout(10000)});if(response.ok&&$('metroDay').value==='auto'&&!metroSchedule)showMetroDay(await response.json());}catch{/* The timetable response also carries the service-day selection. */}
}
function clearMetroResults() {
  metroGeneration++;metroController?.abort();metroSchedule=null;
  $('metroResults').replaceChildren();$('metroStatus').textContent='';$('metroSearch').disabled=false;
}
function renderMetroCountdown() {
  if(!metroSchedule)return;
  const {data,serviceDate}=metroSchedule,now=Date.now(),box=$('metroCountdown');
  if(!box)return;
  box.replaceChildren();
  if(metroServiceDate(now)!==serviceDate){box.append(textNode('p','운행일이 바뀌었습니다. 운행일을 확인하고 다시 조회해주세요.'));return;}
  for(const schedule of data.directions||[data]){
    const panel=textNode('section','','metro-direction');panel.append(textNode('h3',`${schedule.heading||metroDirectionName(data.line,schedule.direction)} 방면`));
    const upcoming=upcomingTrains(schedule.trains||schedule.times.map(time=>({time})),now,serviceDate);
    if(schedule.unavailable)panel.append(textNode('p','이 방면의 시간표를 불러오지 못했습니다. 다시 조회해주세요.'));
    else if(!upcoming.length)panel.append(textNode('p',schedule.trains?.length?'오늘 남은 열차가 없습니다.':'이 역에서 출발하는 열차가 없습니다.'));
    for(const [index,train] of upcoming.entries()){
      const row=textNode('div','',index===0?'train-row train-first':'train-row'),info=textNode('div','','train-info');
      info.append(textNode('strong',`${Math.floor(train.remainingSeconds/60)}분 ${String(train.remainingSeconds%60).padStart(2,'0')}초`),textNode('span',`${train.time} 출발 · ${train.destination||schedule.heading||metroDirectionName(data.line,schedule.direction)}행`));row.append(info);panel.append(row);
    }
    box.append(panel);
  }
  box.append(textNode('p','시간표 기준으로 매초 갱신됩니다. 실제 열차 도착과 다를 수 있습니다.','subtext'));
}
async function searchMetro(event) {
  event.preventDefault();clearMetroResults();const generation=metroGeneration,serviceDate=metroServiceDate();
  metroController=new AbortController();
  $('metroStatus').textContent='역과 공식 시간표 조회 중…';$('metroStatus').classList.remove('error');$('metroSearch').disabled=true;
  try {
    const query=new URLSearchParams({station:$('metroStation').value.trim(),line:$('metroLine').value,direction:'BOTH',day:$('metroDay').value});
    const response=await fetch(`${apiBase}/api/metro?${query}`,{signal:AbortSignal.any([metroController.signal,AbortSignal.timeout(15000)])});
    const data=await response.json();if(generation!==metroGeneration)return;if(!response.ok)throw new Error(data.error);
    if(data.availableLines){
      const select=$('metroLine');select.replaceChildren();
      for(const line of data.availableLines){const option=textNode('option',`${line}호선`);option.value=line;select.append(option);}
      if(data.lineLookupIncomplete){const retry=textNode('option','호선 다시 자동 확인');retry.value='auto';select.append(retry);}
      select.value=data.line;$('metroLineChoice').hidden=data.availableLines.length<2&&!data.lineLookupIncomplete;
    }
    showMetroDay({...data,serviceDate:data.serviceDate||serviceDate});
    $('metroStatus').textContent=`${data.station.replace(/역$/,'')}역 · ${data.line}호선 · ${metroDays[data.day]} · ${kstTime(data.updatedAt)} 조회`;
    if(data.lineLookupIncomplete)$('metroStatus').textContent+=' · 일부 호선 조회 실패: 호선을 다시 자동 확인할 수 있습니다.';
    const box=textNode('div','','metro-next');box.id='metroCountdown';$('metroResults').append(box);
    metroSchedule={data,serviceDate:data.serviceDate||serviceDate};renderMetroCountdown();
    for(const schedule of data.directions||[data]){
      const details=document.createElement('details');details.className='all-trains';details.append(textNode('summary',`${schedule.heading||metroDirectionName(data.line,schedule.direction)} 방면 전체 시간표 · ${schedule.times.length}회`));
      const grid=textNode('div','','train-grid');for(const train of schedule.trains||schedule.times.map(time=>({time}))){grid.append(textNode('span',train.time+(train.destination?' '+train.destination+'행':'')));}details.append(grid);$('metroResults').append(details);
    }
  } catch(error) {if(generation!==metroGeneration)return;$('metroStatus').classList.add('error');$('metroStatus').textContent=error.name==='TimeoutError'?'시간표 응답이 늦어지고 있습니다. 다시 조회해주세요.':error.message||'시간표를 조회하지 못했습니다.';}
  finally {if(generation===metroGeneration)$('metroSearch').disabled=false;}
}
window.addEventListener('DOMContentLoaded',()=>{
  $('transitSort').onchange=renderTransitOptions;
  for(const button of $('transitFilters').querySelectorAll('button'))button.onclick=()=>{transitType=button.dataset.transitType;renderTransitOptions();};
  $('loadMeals').onclick=async()=>{
    $('loadMeals').disabled=true;$('mealsStatus').textContent='오늘 메뉴 조회 중…';$('mealsResults').replaceChildren();
    try{const response=await fetch(`${apiBase}/api/meals`,{signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw new Error(data.error);
      $('mealsStatus').textContent=`${data.date} 메뉴 · 갱신 ${data.updatedAt||'확인 불가'}${data.status!=='success'?' · 최근 크롤링 실패: 아래 정보의 날짜를 확인하세요.':''}`;
      for(const restaurant of data.restaurants){const card=textNode('div','','facility-card');card.append(textNode('strong',restaurant.name));
        if(!restaurant.meals.length)card.appendChild(textNode('p','식단정보가 없습니다.'));
        for(const meal of restaurant.meals)card.appendChild(textNode('p',`${meal.type}${meal.time?' · '+meal.time:''}: ${meal.items.join(', ')}`));
        const locationQuery=mealLocationQuery(restaurant.name);card.append(textNode('p',locationQuery,'meal-building'));
        const button=textNode('button','식당 위치 검색','secondary');button.type='button';button.onclick=()=>{showPurpose('route',true);$('endQuery').value=locationQuery;search('end');};card.appendChild(button);$('mealsResults').appendChild(card);
      }
    }catch(error){$('mealsStatus').textContent=error.message||'학식 정보를 불러오지 못했습니다.';}finally{$('loadMeals').disabled=false;}
  };
  $('transportMode').onchange=()=>{clearRoute();$('findRoute').textContent='경로 찾기';$('routeMode').disabled=$('transportMode').value==='transit';$('walkOptions').hidden=$('transportMode').value==='transit';message('새 이동 수단으로 경로를 검색하세요.');};
  ['classStart','safetyMinutes','indoorMinutes'].forEach(id=>$(id).onchange=updateDeadline);
  $('refreshBus').onclick=refreshBus;$('searchNearby').onclick=searchNearby;$('metroForm').onsubmit=searchMetro;
  $('metroStation').oninput=resetMetroStation;
  ['metroLine','metroDay'].forEach(id=>$(id).onchange=()=>{if($('metroStation').value.trim())$('metroForm').requestSubmit();else if($('metroDay').value==='auto')loadMetroDay();});
  $('findMetroNearby').onclick=findMetroNearby;$('metroDay').value='auto';loadMetroDay();
  const timer=setInterval(updateDeadline,30000),metroTimer=setInterval(renderMetroCountdown,1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderMetroCountdown();});
  window.addEventListener('pagehide',event=>{if(event.persisted)return;clearInterval(timer);clearInterval(metroTimer);metroController?.abort();mobilityController?.abort();facilityController?.abort();});
});
