let map, pacemaker;
const places = {start: null, end: null};
let selectedRoute = null, routeController = null, routeGeneration = 0, positionGeneration = 0;
const layers = [];
const searchGenerations = {start: 0, end: 0};
const $ = id => document.getElementById(id);
const apiBase = ROUTING_API_BASE_URL.replace(/\/$/, '');
const localBackend = ['127.0.0.1', 'localhost'].includes(location.hostname);
const hasBackend = Boolean(apiBase) || localBackend || location.hostname === 'knu-campus-navigation.vercel.app';
function message(text, error = false) { $('routeMessage').textContent = text; $('routeMessage').classList.toggle('error', error); }
function formatDistance(meters) { return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`; }
function updateReady() { $('findRoute').disabled = !map || !places.start || !places.end; }
function clearRoute() {
  routeGeneration++; routeController?.abort(); routeController = null;
  pacemaker?.stop(); selectedRoute = null; layers.splice(0).forEach(layer => layer.remove());
  $('routeSummary').hidden = $('pacePanel').hidden = true; $('mapEmptyHint').hidden = false;
  $('paceProgress').value = 0; $('paceRemaining').textContent = $('paceTime').textContent = '—';
  $('findRoute').textContent = '도보 경로 찾기'; updateReady();
}
function selectPlace(kind, place) {
  if (kind === 'start') positionGeneration++;
  clearRoute(); places[kind] = place; $(`${kind}Query`).value = place.name;
  $(`${kind}Results`).replaceChildren(); searchGenerations[kind]++;
  message(places.start && places.end ? '장소가 선택되었습니다. 도보 경로를 찾아보세요.' : '다른 장소도 검색 결과에서 선택해주세요.');
  updateReady();
}
async function search(kind) {
  const query = $(`${kind}Query`).value.trim(), container = $(`${kind}Results`);
  const generation = ++searchGenerations[kind]; container.replaceChildren();
  if (!query) { message('검색할 장소를 입력해주세요.', true); return; }
  container.textContent = '검색 중…';
  try {
    let results;
    if (hasBackend) {
      const response = await fetch(`${apiBase}/api/search?q=${encodeURIComponent(query)}`, {signal: AbortSignal.timeout(15000)});
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '검색에 실패했습니다.'); results = data.places;
    } else results = await map.search(query);
    if (generation !== searchGenerations[kind]) return;
    container.replaceChildren();
    if (!results.length) { container.textContent = '검색 결과가 없습니다. 다른 장소명을 입력해주세요.'; return; }
    for (const place of results) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'place-option';
      const name = document.createElement('strong'); name.textContent = place.name;
      const address = document.createElement('span'); address.textContent = place.address;
      button.append(name, address); button.onclick = () => selectPlace(kind, place); container.appendChild(button);
    }
  } catch (error) {
    if (generation !== searchGenerations[kind]) return;
    container.replaceChildren(); container.textContent = '장소 검색에 실패했습니다. 다시 시도해주세요.';
  }
}
async function findRoute(event) {
  event.preventDefault();
  if (!places.start || !places.end) { message('출발지와 도착지를 검색 결과에서 선택해주세요.', true); return; }
  clearRoute();
  if (!hasBackend) { message('현재 길찾기 연결을 준비 중입니다. 잠시 후 다시 시도해주세요.', true); return; }
  const start = {...places.start}, end = {...places.end};
  if (metersBetween(start.coords, end.coords) < 5) { message('출발지와 도착지가 너무 가깝습니다.', true); return; }
  const generation = routeGeneration; routeController = new AbortController();
  const timeout = setTimeout(() => routeController?.abort(), 18000);
  $('findRoute').disabled = true; $('findRoute').textContent = '경로 찾는 중…'; message('카카오 도보 경로를 찾고 있습니다.');
  try {
    const response = await fetch(`${apiBase}/api/route`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({start, end, routeMode: $('routeMode').value}), signal: routeController.signal});
    const route = await response.json();
    if (generation !== routeGeneration) return;
    if (!response.ok) throw new Error(route.error || '경로를 찾지 못했습니다.');
    const metrics = makeRouteMetrics(route.points);
    // Reject disconnected provider segments instead of drawing invented connectors.
    for (let i = 1; i < route.points.length; i++) if (metersBetween(route.points[i - 1], route.points[i]) > 2000) throw new Error('경로 좌표가 이어지지 않습니다. 다른 장소로 다시 검색해주세요.');
    selectedRoute = {...route, start, end, metrics};
    layers.push(map.polyline(route.points, {color: '#ffffff', weight: 10, opacity: .9}), map.polyline(route.points, {color: '#c8102e', weight: 6, opacity: .95}));
    layers.push(map.marker(route.points[0], '<div class="nav-marker origin">출<span>보행 시작</span></div>'), map.marker(route.points.at(-1), '<div class="nav-marker destination">도<span>보행 안내 끝</span></div>'));
    map.fitPath(route.points); $('mapEmptyHint').hidden = true;
    $('routeNames').textContent = `${start.name} → ${end.name}`;
    const coverageNotes = [];
    if (route.startOffset > 30) coverageNotes.push(`검색한 출발 좌표와 보행 경로 시작점은 약 ${Math.round(route.startOffset)}m 떨어져 있습니다.`);
    if (route.endOffset > 30) coverageNotes.push(`제공된 보행 경로 끝에서 검색한 장소 좌표까지는 직선거리 약 ${Math.round(route.endOffset)}m입니다. 건물 출입구를 확인해주세요.`);
    if (route.geometryWarning) coverageNotes.push('API 예상 거리와 제공 좌표 길이에 차이가 있습니다. 페이스메이커는 제공된 경로선까지만 안내합니다.');
    $('routeCoverage').textContent = coverageNotes.join(' '); $('routeCoverage').hidden = !coverageNotes.length;
    $('routeMinutes').textContent = `${Math.ceil(route.duration / 60)}분`;
    $('routeDistance').textContent = formatDistance(route.distance);
    $('routeArrival').textContent = new Date(Date.now() + route.duration * 1000).toLocaleTimeString('ko-KR', {timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false});
    $('routeInstructions').replaceChildren();
    for (const step of route.instructions) { const li = document.createElement('li'); li.textContent = `${step.text}${step.distance ? ` · ${formatDistance(step.distance)}` : ''}`; $('routeInstructions').appendChild(li); }
    $('routeSummary').hidden = $('pacePanel').hidden = false;
    pacemaker.setRoute(selectedRoute); $('paceRemaining').textContent = formatDistance(metrics.total); updatePaceTime(metrics.total);
    message('경로를 지도에 표시했습니다. 아래에서 미리보기 또는 도보 안내를 시작하세요.');
  } catch (error) {
    if (generation !== routeGeneration) return;
    message(error.name === 'AbortError' ? '경로 요청 시간이 초과됐습니다. 다시 시도해주세요.' : error.message || '경로를 찾지 못했습니다.', true);
  } finally {
    clearTimeout(timeout);
    if (generation === routeGeneration) { routeController = null; $('findRoute').textContent = '도보 경로 찾기'; updateReady(); }
  }
}
function updatePaceTime(remaining) {
  $('paceTime').textContent = Number.isFinite(remaining) ? `약 ${Math.ceil(remaining / (Number($('walkSpeed').value) / 3.6) / 60)}분` : '—';
}
function updatePace(state) {
  if (state.message) $('paceStatus').textContent = state.message;
  if (state.mode) {
    $('paceMode').textContent = {idle: '대기', waiting: '위치 확인', live: 'GPS 안내', preview: '미리보기 · 12배속', 'preview-complete': '미리보기 완료', arrived: '도착'}[state.mode] || '대기';
    $('stopWalking').disabled = ['idle', 'arrived'].includes(state.mode);
    $('startWalking').disabled = ['waiting', 'live'].includes(state.mode);
  }
  if ('remaining' in state) { $('paceRemaining').textContent = Number.isFinite(state.remaining) ? formatDistance(state.remaining) : '위치 확인 중'; updatePaceTime(state.remaining); }
  if (Number.isFinite(state.progress)) $('paceProgress').value = state.progress;
}
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('현재 위치를 지원하지 않는 기기입니다.'));
    navigator.geolocation.getCurrentPosition(position => {
      if (!validLocation(position)) return reject(new Error('현재 위치의 정확도가 낮습니다. 잠시 후 다시 시도해주세요.'));
      resolve(position);
    }, error => reject(new Error(error.code === 1 ? '위치 권한이 거부되었습니다. 장소 검색으로 출발지를 선택할 수 있습니다.' : '현재 위치를 받지 못했습니다. 다시 시도해주세요.')), {enableHighAccuracy: true, timeout: 15000, maximumAge: 0});
  });
}
async function init() {
  for (const kind of ['start', 'end']) {
    $(`${kind}Search`).onclick = () => search(kind);
    $(`${kind}Query`).onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); search(kind); } };
    $(`${kind}Query`).oninput = () => { if (kind === 'start') positionGeneration++; places[kind] = null; searchGenerations[kind]++; $(`${kind}Results`).replaceChildren(); clearRoute(); message('장소를 검색하고 결과에서 선택해주세요.'); };
  }
  $('routeForm').onsubmit = findRoute;
  $('routeMode').onchange = () => { clearRoute(); message('새 경로 조건으로 다시 검색해주세요.'); };
  $('swapPlaces').onclick = () => { positionGeneration++; [places.start, places.end] = [places.end, places.start]; [$('startQuery').value, $('endQuery').value] = [$('endQuery').value, $('startQuery').value]; for (const kind of ['start', 'end']) { searchGenerations[kind]++; $(`${kind}Results`).replaceChildren(); } clearRoute(); message('출발지와 도착지를 바꿨습니다.'); };
  $('useLocation').onclick = async () => {
    const generation = ++positionGeneration; $('useLocation').disabled = true; message('현재 위치 확인 중…');
    try { const position = await getPosition(); if (generation !== positionGeneration) return; selectPlace('start', {name: '현재 위치', coords: [position.coords.latitude, position.coords.longitude]}); }
    catch (error) { message(error.message, true); } finally { $('useLocation').disabled = false; }
  };
  $('fitRoute').onclick = () => selectedRoute && map.fitPath(selectedRoute.points);
  $('previewRoute').onclick = () => pacemaker.preview();
  $('startWalking').onclick = () => pacemaker.startLive();
  $('stopWalking').onclick = () => { pacemaker.stop(); if (selectedRoute) { $('paceProgress').value = 0; $('paceRemaining').textContent = formatDistance(selectedRoute.metrics.total); updatePaceTime(selectedRoute.metrics.total); } };
  $('walkSpeed').onchange = () => { pacemaker.setSpeed(Number($('walkSpeed').value)); if (selectedRoute && pacemaker.mode === 'idle') updatePaceTime(selectedRoute.metrics.total); };
  for (const [id, sky] of [['mapTypeRoad', false], ['mapTypeSky', true]]) $(id).onclick = () => {
    if (!map) return;
    map.setType(sky); $('mapTypeRoad').classList.toggle('active', !sky); $('mapTypeSky').classList.toggle('active', sky); $('mapTypeRoad').setAttribute('aria-pressed', String(!sky)); $('mapTypeSky').setAttribute('aria-pressed', String(sky));
  };
  map = await createCampusMap(); pacemaker = new RoutePacemaker(map, updatePace);
  window.addEventListener('pagehide', () => pacemaker.stop());
  updateReady();
  window.parent.postMessage({type: 'knu:map-ready'}, location.origin);
}
window.addEventListener('message', event => {
  if (event.source !== window.parent || event.origin !== location.origin) return;
  if (event.data?.type === 'knu:ping') {if (map && pacemaker) window.parent.postMessage({type:'knu:map-ready'}, location.origin); return;}
  if (event.data?.type !== 'knu:destination' || !map || !pacemaker) return;
  const place = event.data.place;
  if (typeof place?.name !== 'string' || !place.name.trim() || place.name.length > 150 || !Array.isArray(place.coords) || place.coords.length !== 2 || !place.coords.every(Number.isFinite) || Math.abs(place.coords[0]) > 90 || Math.abs(place.coords[1]) > 180) return;
  selectPlace('end', {name: place.name, coords: place.coords});
  if (places.start) findRoute({preventDefault() {}});
  else message(`${place.name}을 도착지로 선택했습니다. 출발지 또는 현재 위치를 선택해주세요.`);
});
window.addEventListener('DOMContentLoaded', () => init().catch(() => message('지도를 불러오지 못했습니다. 새로고침해주세요.', true)));
