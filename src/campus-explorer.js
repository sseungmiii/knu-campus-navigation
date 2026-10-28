// Meal pins share the building destinations used by mealLocationQuery.
// Coordinates verified against Kakao place search on 2026-10-20.
const campusDining = [
  {id:'meal-info',name:'정보센터식당',building:'경북대학교 종합정보센터',coords:[35.8922990401853,128.613270366919]},
  {id:'meal-welfare',name:'복지관 식당 · 카페테리아 첨성',building:'경북대학교 복지관',coords:[35.88902007473884,128.61452386276625]},
  {id:'meal-gp',name:'GP감꽃식당',building:'경북대학교 글로벌플라자',coords:[35.8918682645968,128.611259363988]},
  {id:'meal-engineering',name:'공학관 학생·교직원식당',building:'경북대학교 공대12호관',coords:[35.8884795795739,128.609945976963]}
].map(p=>({...p,category:'meal',address:'대구 북구 대학로 80'}));
let campusFacilities=[...campusDining],campusPins=[],campusFilter='all',campusSearchGeneration=0,campusSelectedPin=null;
const campusCategoryNames={meal:'학식당',FD6:'식당',CE7:'카페',CS2:'편의점'},campusIcons={meal:'♧',FD6:'♧',CE7:'☕',CS2:'▣'};
let facilityScope='inside',facilityCategory='all',outsideFacilities=[],facilityLoadGeneration=0,schoolTab=null,facilityNote='';
function leaveSchoolFacilities(){if(!schoolTab)return;schoolTab=null;document.body.classList.remove('outside-facilities');facilityLoadGeneration++;campusPins.splice(0).forEach(p=>p.remove());}
function renderSchoolFacilities(){
  const rows=(facilityScope==='inside'?campusFacilities:outsideFacilities).filter(row=>facilityCategory==='all'||row.category===facilityCategory),box=$('schoolFacilityResults');box.replaceChildren();
  document.querySelectorAll('[data-school-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.schoolCategory===facilityCategory)));
  for(const row of rows){const button=textNode('button','','school-facility-row');button.type='button';button.append(textNode('strong',row.name),textNode('small',(campusCategoryNames[row.category]||'시설')+' · '+row.address));button.onclick=()=>{document.body.classList.remove('panel-open');openCampusPlace(row);};box.append(button);}
  renderCampusPins(rows);
  $('schoolFacilityStatus').textContent=rows.length?`${rows.length}곳 · 카카오 장소 정보 기준`:'표시할 시설이 없습니다. 다른 종류나 지도 영역을 선택해보세요.';
  $('schoolFacilityStatus').textContent+=facilityNote;
}
async function querySchoolArea(){
 const generation=++facilityLoadGeneration,scope=facilityScope;
 if(scope==='inside'){await loadCampusFacilities();return;}
 outsideFacilities=[];facilityNote='';renderSchoolFacilities();$('schoolFacilityStatus').textContent='현재 보이는 지도 영역에서 시설 조회 중…';
 if(!map.schoolSurroundings||!map.visibleBounds){$('schoolFacilityStatus').textContent='카카오지도 연결 후 주변 시설을 조회할 수 있습니다.';return;}
 const bounds=map.visibleBounds(),results=await Promise.allSettled(['FD6','CE7','CS2'].map(category=>map.schoolSurroundings(category,bounds)));
 if(generation!==facilityLoadGeneration||schoolTab!=='outside')return;
 outsideFacilities=[...new Map(results.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(row=>[row.id,row])).values()];
 facilityNote=results.some(r=>r.status==='rejected')?' · 일부 조회 실패: '+results.find(r=>r.status==='rejected').reason.message:' · 카카오 제공 결과 일부입니다. 더 확대해서 검색할 수 있습니다.';
 renderSchoolFacilities();
}
async function showShellTab(tab){
 $('campusPlaceCard').hidden=true;$('campusSearchResults').hidden=true;campusSelectedPin?.remove();
 if(!['inside','outside'].includes(tab)){schoolTab=null;document.body.classList.remove('outside-facilities');facilityLoadGeneration++;campusPins.splice(0).forEach(p=>p.remove());document.body.classList.remove('school-sheet','sheet-collapsed','resizable-sheet','sheet-minimized');if(tab==='map'){document.body.classList.remove('panel-open');map.refresh?.();}else if(tab==='route-nearby')showPurpose('nearby');return;}
 document.body.classList.toggle('outside-facilities',tab==='outside');
 const entering=schoolTab!==tab;schoolTab=tab;facilityScope=tab;
 if(entering){facilityCategory='all';facilityNote='';document.body.classList.remove('sheet-collapsed');$('schoolSheetHandle').setAttribute('aria-expanded','true');$('schoolSheetHandle').setAttribute('aria-label','학교 패널 접기');facilityLoadGeneration++;if(typeof facilityLayers!=='undefined')facilityLayers.splice(0).forEach(p=>p.remove());}
 $('schoolFacilityTitle').textContent=tab==='inside'?'학교 내부 시설':'학교 주변 시설';
 $('schoolFacilityDescription').textContent=tab==='inside'?'교내 주소로 확인된 시설입니다. 범주를 선택하면 목록과 핀이 함께 바뀝니다.':'패널 위 실제 보이는 지도 영역에서 검색합니다. 지도를 옮긴 뒤 재검색하세요.';
 $('refreshSchoolFacilities').hidden=tab==='outside';$('refreshSchoolFacilities').textContent='교내 시설 다시 조회';
 showPurpose('facilities');renderSchoolFacilities();
 if(entering){map.schoolHome?.(tab);if(tab==='outside')await querySchoolArea();}
}
function initSchoolSheet(){initPanelSheet();$('schoolReturn').onclick=()=>map.schoolHome?.(facilityScope);}
function campusDestination(place,kind='end') {
  showPurpose('route');selectPlace(kind,{...place,name:place.building||place.name});
  $('campusPlaceCard').hidden=true;map.panTo(place.coords);
}
function campusMealPlace(name) {return campusDining.find(p=>p.building===mealLocationQuery(name));}
function openCampusPlace(place) {
  const box=$('campusPlaceCard');box.replaceChildren();box.hidden=false;map.panTo(place.coords);
  campusSelectedPin?.remove();const selected=textNode('div',place.name,'selected-campus-pin');campusSelectedPin=map.marker(place.coords,selected);
  const close=textNode('button','×','place-close');close.type='button';close.setAttribute('aria-label','장소 정보 닫기');close.onclick=()=>{box.hidden=true;campusSelectedPin?.remove();};
  box.append(close,textNode('span',campusCategoryNames[place.category]||'캠퍼스 장소','place-category'),textNode('h2',place.name),textNode('p',place.building||place.address||'경북대학교 대구캠퍼스'));
  const actions=textNode('div','','place-actions');
  for(const [kind,label] of [['start','출발'],['end','도착 · 길찾기']]){const button=textNode('button',label,kind==='end'?'primary':'secondary');button.type='button';button.onclick=()=>campusDestination(place,kind);actions.append(button);}
  if(place.category==='meal'){const button=textNode('button','오늘 식단 보기','secondary');button.onclick=()=>{showPurpose('meals');$('loadMeals').click();box.hidden=true;};actions.append(button);}
  box.append(actions);
}
function renderCampusPins(rows) {
  campusPins.splice(0).forEach(p=>p.remove());
  for(const place of rows||campusFacilities.filter(p=>campusFilter==='all'||p.category===campusFilter)){
    const button=textNode('button','','campus-pin pin-'+place.category);button.type='button';button.setAttribute('aria-label',`${place.name} · ${campusCategoryNames[place.category]}`);
    button.append(textNode('span',campusIcons[place.category],'pin-icon'),textNode('span',place.name,'pin-name'));
    button.onclick=event=>{event.stopPropagation();openCampusPlace(place);};
    campusPins.push(map.marker(place.coords,button));
  }
}
async function loadCampusFacilities() {
  if(!map.campusPlaces){$('campusPlacesStatus').textContent='학식당 위치 표시 · 카카오 연결 후 카페·편의점을 조회할 수 있습니다.';return;}
  const results=await Promise.allSettled(['FD6','CE7','CS2'].map(category=>map.campusPlaces(category)));
  campusFacilities=[...campusDining,...results.flatMap(r=>r.status==='fulfilled'?r.value:[])];if(!schoolTab)renderCampusPins();
  if(schoolTab==='inside')renderSchoolFacilities();
  $('campusPlacesStatus').replaceChildren(textNode('span',`학식당 ${campusDining.length}곳 · 카페 ${campusFacilities.filter(p=>p.category==='CE7').length}곳 · 편의점 ${campusFacilities.filter(p=>p.category==='CS2').length}곳`));
  if(results.some(r=>r.status==='rejected')){const retry=textNode('button','일부 시설 조회 실패 · 다시 시도');retry.onclick=loadCampusFacilities;$('campusPlacesStatus').append(retry);}
}
function initCampusExplorer() {
  if(new URLSearchParams(location.search).get('shell')==='1')document.body.classList.add('shell-embedded');
  document.querySelectorAll('[data-school-category]').forEach(button=>button.onclick=()=>{facilityCategory=button.dataset.schoolCategory;renderSchoolFacilities();});
  initSchoolSheet();$('refreshSchoolFacilities').onclick=querySchoolArea;
  map.onMove?.(()=>{if(schoolTab==='outside')$('refreshSchoolFacilities').textContent='이 지도에서 재검색';});
  const home=()=>map.campusHome ? map.campusHome() : map.fitPath([[35.885,128.607],[35.893,128.617]]);
  $('campusHome').onclick=()=>{document.body.classList.remove('panel-open');$('campusPlaceCard').hidden=true;campusSelectedPin?.remove();home();};
  $('closePanel').onclick=()=>document.body.classList.remove('panel-open');
  document.querySelectorAll('[data-open-purpose]').forEach(button=>button.onclick=()=>{showPurpose(button.dataset.openPurpose);$('campusPlaceCard').hidden=true;if(button.dataset.openPurpose==='meals'&&!$('mealsResults').children.length)$('loadMeals').click();});
  document.querySelectorAll('[data-campus-filter]').forEach(button=>button.onclick=()=>{document.body.classList.remove('panel-open');campusSelectedPin?.remove();campusFilter=button.dataset.campusFilter;document.querySelectorAll('[data-campus-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('campusPlaceCard').hidden=true;renderCampusPins();});
  $('campusSearch').oninput=()=>{campusSearchGeneration++;$('campusSearchResults').hidden=true;};
  $('campusSearchForm').onsubmit=async event=>{
    event.preventDefault();const query=$('campusSearch').value.trim();if(!query)return;
    const generation=++campusSearchGeneration,box=$('campusSearchResults');box.hidden=false;box.textContent='장소 검색 중…';
    try{const response=await fetch(`${apiBase}/api/search?q=${encodeURIComponent(query)}`,{signal:AbortSignal.timeout(15000)});const data=await response.json();if(generation!==campusSearchGeneration)return;if(!response.ok)throw new Error(data.error);
      box.replaceChildren();const close=textNode('button','검색 결과 닫기','secondary');close.onclick=()=>{box.hidden=true;campusSelectedPin?.remove();};box.append(close);
      if(!data.places.length)box.append(textNode('p','검색 결과가 없습니다.'));
      for(const place of data.places){const button=textNode('button','','place-option');button.append(textNode('strong',place.name),textNode('span',place.address));button.onclick=()=>{box.hidden=true;openCampusPlace(place);};box.append(button);}
    }catch(error){if(generation===campusSearchGeneration)box.textContent=error.message||'장소를 조회하지 못했습니다.';}
  };
  home();renderCampusPins();loadCampusFacilities();
}
