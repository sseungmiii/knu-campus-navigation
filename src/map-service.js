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
  function layer(object) {
    object.setMap(native);
    return {addTo: () => object.setMap(native), remove: () => object.setMap(null), setLatLng: point => object.setPosition(coord(point))};
  }
  const view = {
    provider: 'kakao',
    panTo: point => native.panTo(coord(point)),
    setType: sky => native.setMapTypeId(sky ? kakao.maps.MapTypeId.HYBRID : kakao.maps.MapTypeId.ROADMAP),
    removeLayer: object => object.remove(),
    polygon: (points, options) => layer(new kakao.maps.Polygon({path: points.map(coord), strokeColor: options.color, strokeWeight: options.weight, strokeStyle: 'dash', fillColor: options.fillColor, fillOpacity: options.fillOpacity})),
    polyline: (points, options) => layer(new kakao.maps.Polyline({path: points.map(coord), strokeColor: options.color, strokeWeight: options.weight, strokeOpacity: options.opacity, strokeStyle: options.dashArray ? 'dash' : 'solid'})),
    marker: (point, html) => layer(new kakao.maps.CustomOverlay({position: coord(point), content: html, xAnchor: 0, yAnchor: 0, zIndex: 5})),
    fitPath: points => {
      const bounds = new kakao.maps.LatLngBounds();
      points.forEach(point => bounds.extend(coord(point)));
      native.setBounds(bounds, 70, 70, 260, 70);
    },
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
  return {
    provider: 'leaflet', panTo: point => native.panTo(point),
    setType: sky => { native.removeLayer(sky ? tiles : skyTiles); (sky ? skyTiles : tiles).addTo(native); },
    removeLayer: object => object.remove(),
    polygon: (points, options) => wrap(L.polygon(points, options).addTo(native)),
    polyline: (points, options) => wrap(L.polyline(points, options).addTo(native)),
    marker: (point, html) => wrap(L.marker(point, {icon: L.divIcon({html, className: 'campus-marker', iconSize: [0, 0]})}).addTo(native)),
    fitPath: points => native.fitBounds(points, {paddingTopLeft: [70, 70], paddingBottomRight: [70, 260]}),
    search: () => Promise.reject(new Error('카카오 연결을 확인한 뒤 장소 검색을 이용해주세요.'))
  };
}
