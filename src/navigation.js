const CAMPUS_NODE_NAMES = {MAIN_GATE_BUS_STOP: '정문 건너 버스정류장', MAIN_GATE: '경북대 정문', IT1_1F: 'IT 1호관 1층 정문', BRIDGE_3F: '3층 연결 구름다리', CONV_2F: 'IT융복합관 2층'};
const CAMPUS_EDGES = [
  {from: 'MAIN_GATE_BUS_STOP', to: 'MAIN_GATE', points: SHORTCUT_PATH.slice(0, 3)},
  {from: 'MAIN_GATE', to: 'IT1_1F', points: SHORTCUT_PATH.slice(2, 7)},
  {from: 'IT1_1F', to: 'BRIDGE_3F', points: SHORTCUT_PATH.slice(6, 9), indoor: true},
  {from: 'BRIDGE_3F', to: 'CONV_2F', points: SHORTCUT_PATH.slice(8), indoor: true},
  {from: 'MAIN_GATE_BUS_STOP', to: 'CONV_2F', points: DETOUR_PATH}
];
let navigationLine = null;
const navigationPlaces = new Map(Object.entries(NODES).map(([id, coords]) => [id, {id, name: CAMPUS_NODE_NAMES[id], coords}]));

function initNavigation() {
  document.getElementById('openNavigation').disabled = false;
  const dialog = document.getElementById('navigationDialog');
  const startSelect = document.getElementById('routeStart');
  const endSelect = document.getElementById('routeEnd');
  for (const place of navigationPlaces.values()) {
    for (const select of [startSelect, endSelect]) {
      const option = document.createElement('option'); option.value = place.id; option.textContent = place.name; select.appendChild(option);
    }
  }
  startSelect.value = 'MAIN_GATE_BUS_STOP'; endSelect.value = 'CONV_2F';
  document.getElementById('openNavigation').onclick = () => dialog.showModal();
  document.getElementById('closeNavigation').onclick = () => dialog.close();
  const refreshLinks = () => {
    const start = navigationPlaces.get(startSelect.value), end = navigationPlaces.get(endSelect.value);
    for (const mode of ['walk', 'traffic']) document.getElementById(`kakao-${mode}`).href = kakaoDirectionsUrl(start, end, mode);
    if (navigationLine) { navigationLine.remove(); navigationLine = null; }
    document.getElementById('selectedRouteStatus').hidden = true;
    document.getElementById('routeResult').textContent = '출발·도착지를 선택하고 캠퍼스 경로를 확인하세요.';
  };
  startSelect.onchange = endSelect.onchange = document.getElementById('routeMode').onchange = refreshLinks;
  document.getElementById('findRoute').onclick = () => {
    const start = startSelect.value, end = endSelect.value;
    const result = document.getElementById('routeResult');
    const route = findCampusRoute(NODES, CAMPUS_EDGES, start, end, document.getElementById('routeMode').value === 'outside');
    if (navigationLine) { navigationLine.remove(); navigationLine = null; }
    if (!route) { result.textContent = '선택한 장소 또는 조건에는 등록된 캠퍼스 경로가 없습니다. 아래 카카오맵 길찾기를 이용해주세요.'; return; }
    if (start === end) { result.textContent = '출발지와 도착지가 같습니다.'; return; }
    navigationLine = map.polyline(route.points, {color: '#2563eb', weight: 7, opacity: 0.95});
    map.fitPath(route.points);
    result.textContent = `시연 경로 · 약 ${Math.round(route.distance)}m · 거리 기준 도보 약 ${Math.ceil(route.distance / 80)}분 (층간 이동·대기시간 제외)\n${route.ids.map(id => CAMPUS_NODE_NAMES[id]).join(' → ')}`;
    document.getElementById('selectedRouteStatus').textContent = `${CAMPUS_NODE_NAMES[start]} → ${CAMPUS_NODE_NAMES[end]} · 파란색 시연 경로`;
    document.getElementById('selectedRouteStatus').hidden = false;
  };
  let searchGeneration = 0;
  document.getElementById('placeSearchForm').onsubmit = async event => {
    event.preventDefault();
    const query = document.getElementById('placeQuery').value.trim();
    const results = document.getElementById('placeResults'); results.replaceChildren();
    if (!query) { results.textContent = '검색할 장소를 입력해주세요.'; return; }
    const generation = ++searchGeneration; results.textContent = '장소 검색 중…';
    try {
      const places = await map.search(query);
      if (generation !== searchGeneration) return;
      results.replaceChildren();
      if (!places.length) { results.textContent = '검색 결과가 없습니다.'; return; }
      places.forEach((place, index) => {
        const row = document.createElement('div'); row.className = 'place-result';
        const label = document.createElement('span'); label.textContent = `${place.name} · ${place.address}`; row.appendChild(label);
        for (const [select, title] of [[startSelect, '출발'], [endSelect, '도착']]) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = title;
          button.onclick = () => {
            const id = `search-${generation}-${index}`; navigationPlaces.set(id, {...place, id});
            if (![...select.options].some(option => option.value === id)) {
              const option = document.createElement('option'); option.value = id; option.textContent = place.name; select.appendChild(option);
            }
            select.value = id; map.panTo(place.coords); refreshLinks();
          };
          row.appendChild(button);
        }
        results.appendChild(row);
      });
    } catch (error) { if (generation === searchGeneration) results.textContent = error.message; }
  };
  refreshLinks();
}
