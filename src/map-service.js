function visibleMapRect(){
 const container=document.getElementById('map'),bounds=container.getBoundingClientRect();
 let top=0,left=0,right=bounds.width,bottom=bounds.height;
 for(const selector of ['.campus-topbar','.campus-shortcuts','.route-panel']){
  const el=document.querySelector(selector);if(!el||!el.getClientRects().length||(typeof getComputedStyle==='function'&&getComputedStyle(el).visibility==='hidden'))continue;const rect=el.getBoundingClientRect();
  if(selector!=='.route-panel'){top=Math.max(top,rect.bottom-bounds.top+10);continue;}
  if(rect.width>bounds.width*.7)bottom=Math.min(bottom,rect.top-bounds.top-8);else left=Math.max(left,rect.right-bounds.left+8);
 }
 return {top:Math.max(0,top),left:Math.max(0,left),right:Math.min(bounds.width,right),bottom:Math.max(top+40,Math.min(bounds.height,bottom)),width:bounds.width,height:bounds.height};
}
async function createCampusMap() {
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('지도 연결 시간 초과')), 12000);
      const script = document.createElement('script');
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_JAVASCRIPT_KEY)}&autoload=false&libraries=services`;
      script.onerror = () => { clearTimeout(timer); reject(new Error('카카오지도 인증 또는 네트워크 오류')); };
      script.onload = () => {
        if (!window.kakao?.maps?.load) { clearTimeout(timer); reject(new Error('카카오지도 SDK 오류')); return; }
        kakao.maps.load(() => { clearTimeout(timer); resolve(); });
      };
      document.head.appendChild(script);
    });
    return createKakaoMap();
  } catch (error) {
    document.getElementById('mapProviderStatus').textContent = '기본 지도 표시 · 카카오 연결 실패: 키·도메인·카카오맵 사용 설정을 확인해주세요.';
    return createLeafletMap();
  }
}

function createKakaoMap() {
  const coord = point => new kakao.maps.LatLng(...point);
  const native = new kakao.maps.Map(document.getElementById('map'), {center: coord([35.8868, 128.6118]), level: 3});
  native.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
  document.getElementById('mapProviderStatus').textContent = '카카오지도 연결됨';
  let fittedPath = null;
  function fit(points) {
    const bounds = new kakao.maps.LatLngBounds();
    points.forEach(point => bounds.extend(coord(point)));
    native.setBounds(bounds, 55, 45, 65, 45);
  }
  new ResizeObserver(() => {
    const center = native.getCenter();
    native.relayout();
    if (fittedPath) fit(fittedPath);
    else native.setCenter(center);
  }).observe(document.getElementById('map'));
  function layer(object) {
    object.setMap(native);
    return {addTo: () => object.setMap(native), remove: () => object.setMap(null), setLatLng: point => object.setPosition(coord(point))};
  }
  const view = {
    provider: 'kakao',
    project:point=>{const p=native.getProjection().containerPointFromCoords(coord(point));return {x:p.x,y:p.y};},
    refresh:()=>{const center=native.getCenter();native.relayout();if(fittedPath)fit(fittedPath);else native.setCenter(center);},
    schoolHome:scope=>{fittedPath=null;const r=visibleMapRect();native.setLevel(scope==='outside'?5:4);native.setCenter(coord([35.889,128.6125]));const projection=native.getProjection();native.setCenter(projection.coordsFromContainerPoint(new kakao.maps.Point(r.width-(r.left+r.right)/2,r.height-(r.top+r.bottom)/2)));},
    visibleBounds:()=>{const r=visibleMapRect(),projection=native.getProjection(),sw=projection.coordsFromContainerPoint(new kakao.maps.Point(r.left,r.bottom)),ne=projection.coordsFromContainerPoint(new kakao.maps.Point(r.right,r.top));return {south:sw.getLat(),west:sw.getLng(),north:ne.getLat(),east:ne.getLng()};},
    onMove:handler=>kakao.maps.event.addListener(native,'idle',handler),
    campusHome: () => {fittedPath=null;native.setLevel(4);native.setCenter(coord([35.889,128.612]));},
    panTo: point => native.panTo(coord(point)),
    setType: sky => native.setMapTypeId(sky ? kakao.maps.MapTypeId.HYBRID : kakao.maps.MapTypeId.ROADMAP),
    removeLayer: object => object.remove(),
    polygon: (points, options) => layer(new kakao.maps.Polygon({path: points.map(coord), strokeColor: options.color, strokeWeight: options.weight, strokeStyle: 'dash', fillColor: options.fillColor, fillOpacity: options.fillOpacity})),
    polyline: (points, options) => layer(new kakao.maps.Polyline({path: points.map(coord), strokeColor: options.color, strokeWeight: options.weight, strokeOpacity: options.opacity, strokeStyle: options.dashArray ? 'dash' : 'solid'})),
    marker: (point, html) => layer(new kakao.maps.CustomOverlay({position: coord(point), content: html, xAnchor: 0, yAnchor: 0, zIndex: html?.classList?.contains('selected-campus-pin') ? 20 : html?.classList?.contains('pin-meal') ? 8 : 5})),
    fitPath: points => {
      fittedPath = points;
      fit(points);
    },
    campusPlaces: category => Promise.all(['128.603,35.883,128.612,35.889','128.612,35.883,128.621,35.889','128.603,35.889,128.612,35.895','128.612,35.889,128.621,35.895'].map(rect => new Promise((resolve, reject) => {
      const service = new kakao.maps.services.Places(), results = [];
      const callback = (items, status, pagination) => {
        if (status === kakao.maps.services.Status.ZERO_RESULT) return resolve([]);
        if (status !== kakao.maps.services.Status.OK) return reject(new Error('교내 시설을 불러오지 못했습니다. 다시 시도해주세요.'));
        results.push(...items.filter(p => /대학로 80(?:\s|$)|산격동 1370(?:-1)?(?:\s|$)/.test(p.road_address_name+' '+p.address_name)).map(p => ({id:p.id,name:p.place_name,coords:[Number(p.y),Number(p.x)],address:p.road_address_name||p.address_name,category})));
        if (pagination.hasNextPage) pagination.nextPage(); else resolve(results);
      };
      service.categorySearch(category, callback, {rect,size:15});
    }))).then(groups=>[...new Map(groups.flat().map(p=>[p.id,p])).values()]),
    schoolSurroundings:(category,area)=>new Promise((resolve,reject)=>{
      if(!area||![area.south,area.west,area.north,area.east].every(Number.isFinite)||area.north<=area.south||area.east<=area.west)return reject(Error('지도를 조금 확대한 뒤 다시 검색해주세요.'));
      if(area.north-area.south>.15||area.east-area.west>.2)return reject(Error('검색 영역이 너무 넓습니다. 지도를 확대해주세요.'));
      const results=[],service=new kakao.maps.services.Places(),timer=setTimeout(()=>reject(Error('시설 조회 시간이 초과됐습니다.')),15000);
      service.categorySearch(category,(items,status,pagination)=>{
        if(status===kakao.maps.services.Status.ZERO_RESULT){clearTimeout(timer);return resolve([]);}
        if(status!==kakao.maps.services.Status.OK){clearTimeout(timer);return reject(Error('학교 주변 시설을 불러오지 못했습니다.'));}
        results.push(...items.filter(p=>!/대학로 80(?:\s|$)|산격동 1370(?:-1)?(?:\s|$)/.test(p.road_address_name+' '+p.address_name)).map(p=>({id:p.id,name:p.place_name,coords:[Number(p.y),Number(p.x)],address:p.road_address_name||p.address_name,category})).filter(p=>p.coords[0]>=area.south&&p.coords[0]<=area.north&&p.coords[1]>=area.west&&p.coords[1]<=area.east));
        if(pagination.hasNextPage)pagination.nextPage();else{clearTimeout(timer);resolve([...new Map(results.map(p=>[p.id,p])).values()]);}
      },{rect:[area.west,area.south,area.east,area.north].join(','),size:15});
    }),
    search: keyword => new Promise((resolve, reject) => {
      new kakao.maps.services.Places().keywordSearch(keyword, (places, status) => {
        if (status === kakao.maps.services.Status.ZERO_RESULT) return resolve([]);
        if (status !== kakao.maps.services.Status.OK) return reject(new Error('장소 검색에 실패했습니다. 다시 시도해주세요.'));
        resolve(places.map(place => ({name: place.place_name, coords: [Number(place.y), Number(place.x)], address: place.road_address_name || place.address_name})));
      }, {location: native.getCenter(), sort: kakao.maps.services.SortBy.DISTANCE, size: 8});
    })
  };
  return view;
}

function createLeafletMap() {
  const native = L.map('map', {center: [35.8868, 128.6118], zoom: 17, zoomControl: false});
  L.control.zoom({position: 'topright'}).addTo(native);
  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '© OpenStreetMap'}).addTo(native);
  const skyTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 19, attribution: 'Tiles © Esri'});
  const wrap = object => ({addTo: () => object.addTo(native), remove: () => object.remove(), setLatLng: point => object.setLatLng(point)});
  let fittedPath = null;
  new ResizeObserver(() => {
    native.invalidateSize();
    if (fittedPath) native.fitBounds(fittedPath, {padding: [45, 55]});
  }).observe(document.getElementById('map'));
  return {
    provider: 'leaflet', refresh:()=>native.invalidateSize(), schoolHome:scope=>{fittedPath=null;const r=visibleMapRect();native.fitBounds(scope==='outside'?[[35.882,128.603],[35.896,128.622]]:[[35.8847,128.607],[35.8933,128.618]],{paddingTopLeft:[r.left+15,r.top+15],paddingBottomRight:[r.width-r.right+15,r.height-r.bottom+15]});}, panTo: point => native.panTo(point),
    setType: sky => { native.removeLayer(sky ? tiles : skyTiles); (sky ? skyTiles : tiles).addTo(native); },
    removeLayer: object => object.remove(),
    polygon: (points, options) => wrap(L.polygon(points, options).addTo(native)),
    polyline: (points, options) => wrap(L.polyline(points, options).addTo(native)),
    marker: (point, html) => wrap(L.marker(point, {icon: L.divIcon({html, className: 'campus-marker', iconSize: [0, 0]})}).addTo(native)),
    fitPath: points => { fittedPath = points; native.fitBounds(points, {padding: [45, 55]}); },
    project:point=>{const p=native.latLngToContainerPoint(point);return {x:p.x,y:p.y};},
    onMove:handler=>native.on('moveend zoomend',handler),
    search: () => Promise.reject(new Error('카카오 연결을 확인한 뒤 장소 검색을 이용해주세요.'))
  };
}
