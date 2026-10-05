let map = null;
let campusPolygon = null;
let tileLayer = null;

function initMap() {
  map = L.map('map', {
    center: [35.8868, 128.6118],
    zoom: 17,
    zoomControl: false
  });

  L.control.zoom({ position: 'topright' }).addTo(map);

  // OpenStreetMap 타일레이어
  tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // 경북대 공식 경계선
  campusPolygon = L.polygon(CAMPUS_BOUNDARY, {
    color: '#C8102E',
    weight: 2.5,
    dashArray: '5, 5',
    fillColor: '#C8102E',
    fillOpacity: 0.08
  }).addTo(map);

  // 외곽 우회로 (점선)
  L.polyline(DETOUR_PATH, {
    color: '#64748b',
    weight: 4,
    dashArray: '8, 8',
    opacity: 0.7
  }).addTo(map);

  // 이동 경로 글로우 라인
  L.polyline(SHORTCUT_PATH, {
    color: '#ff8599',
    weight: 10,
    opacity: 0.5
  }).addTo(map);

  // 이동 경로 메인 라인
  L.polyline(SHORTCUT_PATH, {
    color: '#C8102E',
    weight: 5,
    opacity: 0.95
  }).addTo(map);

  // 커스텀 노드 오버레이
  function addCustomNode(lat, lng, emoji, label, badge, bgClass) {
    const icon = L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div class="cursor-pointer group flex flex-col items-center -translate-x-1/2 -translate-y-full">
          <div class="flex items-center space-x-1 bg-white/95 px-2 py-0.5 rounded-full shadow-md border border-gray-200 text-[10px] font-bold text-gray-800 whitespace-nowrap mb-1">
            <span>${label}</span>
            <span class="px-1 py-0.2 rounded bg-red-100 text-knu-red font-mono">${badge}</span>
          </div>
          <div class="w-8 h-8 rounded-2xl ${bgClass} text-white flex items-center justify-center text-sm shadow-lg ring-2 ring-white transform group-hover:scale-110 transition">
            ${emoji}
          </div>
        </div>
      `,
      iconSize: [0, 0]
    });
    L.marker([lat, lng], { icon: icon }).addTo(map);
  }

  addCustomNode(NODES.MAIN_GATE_BUS_STOP[0], NODES.MAIN_GATE_BUS_STOP[1], '🚏', '정문 건너 버스정류장', '출발', 'bg-blue-600');
  addCustomNode(NODES.IT1_1F[0], NODES.IT1_1F[1], '🚪', 'IT 1호관 1층 정문', '1F', 'bg-knu-red');
  addCustomNode(NODES.BRIDGE_3F[0], NODES.BRIDGE_3F[1], '🌉', '3층 연결 구름다리', '3F', 'bg-indigo-600');
  addCustomNode(NODES.CONV_2F[0], NODES.CONV_2F[1], '🎯', '융복합관 2층', '2F', 'bg-emerald-600');

  initPoiMarkers();
  initPacemakerMarker();
}

function initPoiMarkers() {
  POI_LIST.forEach(poi => {
    const icon = L.divIcon({
      className: 'poi-div-icon',
      html: `
        <div class="cursor-pointer flex flex-col items-center group -translate-x-1/2 -translate-y-1/2" onclick="openPoiModal('${poi.id}')">
          <div class="w-7 h-7 rounded-full bg-white shadow-md border-2 border-amber-500 flex items-center justify-center text-xs transform group-hover:scale-110 transition">
            ${poi.icon}
          </div>
          <div class="bg-amber-600 text-white text-[8px] font-bold px-1 rounded-full mt-0.5 shadow-sm whitespace-nowrap">
            ${poi.category}
          </div>
        </div>
      `,
      iconSize: [0, 0]
    });
    L.marker(poi.coords, { icon: icon }).addTo(map);
  });
}

function openPoiModal(poiId) {
  const poi = POI_LIST.find(p => p.id === poiId);
  if (!poi) return;

  document.getElementById('poiIcon').textContent = poi.icon;
  document.getElementById('poiTitle').textContent = poi.name;
  document.getElementById('poiSubtitle').textContent = `동선 인접 POI • ${poi.category}`;
  
  document.getElementById('poiContent').innerHTML = `
    <div class="bg-amber-50/80 p-3 rounded-xl border border-amber-200">
      <div class="text-[11px] font-bold text-amber-800 mb-1">
        <i class="fa-solid fa-bell mr-1"></i>${poi.id === 'cafeteria' ? '오늘의 대표 학식 메뉴' : '인기 추천 메뉴'}
      </div>
      <div class="text-sm font-black text-gray-900">${poi.menuToday}</div>
      <div class="flex items-center justify-between mt-2 pt-2 border-t border-amber-200/60 text-xs">
        <span class="font-bold text-knu-red">${poi.price}</span>
        <span class="text-emerald-700 font-bold">${poi.congestion}</span>
      </div>
    </div>
    <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-xs text-gray-600">
      <div><strong>운영시간:</strong> ${poi.hours}</div>
      <div class="mt-1">${poi.desc}</div>
    </div>
  `;
  document.getElementById('poiModal').classList.remove('hidden');
}

document.getElementById('closePoiModal').onclick = () => document.getElementById('poiModal').classList.add('hidden');
document.getElementById('poiConfirmBtn').onclick = () => document.getElementById('poiModal').classList.add('hidden');

const CAMPUS_SHORTCUT_MINUTES = 7;

function calculateDeadline() {
  const classTimeStr = document.getElementById('classTimeSelect').value;
  const originSelect = document.getElementById('originSelect');
  const transitMinutes = parseInt(originSelect.value, 10);

  const [cHour, cMin] = classTimeStr.split(':').map(Number);
  const totalClassMin = cHour * 60 + cMin;

  const totalTravelTime = transitMinutes + CAMPUS_SHORTCUT_MINUTES;
  const departureTotalMin = totalClassMin - totalTravelTime;

  const depHour = Math.floor(departureTotalMin / 60);
  const depMin = departureTotalMin % 60;
  const formattedDepTime = `${String(depHour).padStart(2, '0')}:${String(depMin).padStart(2, '0')}`;

  document.getElementById('deadlineTimeText').textContent = `${formattedDepTime} 출발 필수!`;
  document.getElementById('transitChip').textContent = `대중교통 ${transitMinutes}분 (정문건너 하차)`;
  document.getElementById('totalDurationChip').textContent = `총 ${totalTravelTime}분 소요`;

  const card = document.getElementById('deadlineCard');
  card.classList.add('ring-4', 'ring-yellow-300', 'scale-[1.02]');
  setTimeout(() => {
    card.classList.remove('ring-4', 'ring-yellow-300', 'scale-[1.02]');
  }, 500);
}

document.getElementById('calcBtn').onclick = calculateDeadline;
document.getElementById('classTimeSelect').onchange = calculateDeadline;
document.getElementById('originSelect').onchange = calculateDeadline;

let ghostMarker = null;

function initPacemakerMarker() {
  const icon = L.divIcon({
    className: 'pacemaker-icon',
    html: `
      <div class="relative -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10">
        <div class="pulse-ring"></div>
        <div class="relative w-8 h-8 rounded-full bg-gradient-to-tr from-knu-red to-orange-500 text-white shadow-glow flex items-center justify-center font-bold text-sm ring-2 ring-white">
          🏃
        </div>
        <div class="absolute -bottom-4 bg-gray-900 text-yellow-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow whitespace-nowrap">
          페이스메이커
        </div>
      </div>
    `,
    iconSize: [0, 0]
  });

  ghostMarker = L.marker(SHORTCUT_PATH[0], { icon: icon }).addTo(map);
}


let paceProgress = 0;
let isPacePlaying = false;
let paceSpeed = 1.0;
let lastAnimTime = null;
let animFrameId = null;
const CYCLE_DURATION_SEC = 22;

const pacePlayBtn = document.getElementById('pacePlayBtn');
const pacePlayIcon = document.getElementById('pacePlayIcon');
const paceScrubber = document.getElementById('paceScrubber');
const paceStatusText = document.getElementById('paceStatusText');
const paceResetBtn = document.getElementById('paceResetBtn');
const paceSpeedBtn = document.getElementById('paceSpeedBtn');

function updatePacemaker() {
  const pos = getInterpolatedPoint(SHORTCUT_PATH, paceProgress);
  if (ghostMarker) {
    ghostMarker.setLatLng(pos);
  }
  paceScrubber.value = (paceProgress * 100).toFixed(1);

  const remainM = Math.round(420 * (1 - paceProgress));
  const remainSec = Math.round(420 * (1 - paceProgress));
  const rMin = Math.floor(remainSec / 60);
  const rSec = remainSec % 60;

  if (paceProgress >= 1.0) {
    paceStatusText.textContent = `🎯 융복합관 도착 완료!`;
    stopPacemaker();
  } else if (isPacePlaying) {
    paceStatusText.textContent = `${(4.8 * paceSpeed).toFixed(1)} km/h • 남은거리 ${remainM}m (${rMin}분 ${rSec}초)`;
  } else {
    paceStatusText.textContent = `권장 4.8 km/h • 대기중 (${Math.round(paceProgress * 100)}%)`;
  }

  syncStepWithProgress(paceProgress);
}

function paceLoop(timestamp) {
  if (!lastAnimTime) lastAnimTime = timestamp;
  const dt = (timestamp - lastAnimTime) / 1000;
  lastAnimTime = timestamp;

  if (isPacePlaying) {
    paceProgress += (dt / CYCLE_DURATION_SEC) * paceSpeed;
    if (paceProgress >= 1.0) {
      paceProgress = 1.0;
      updatePacemaker();
      return;
    }
    updatePacemaker();
    animFrameId = requestAnimationFrame(paceLoop);
  }
}

function startPacemaker() {
  if (paceProgress >= 1.0) paceProgress = 0;
  isPacePlaying = true;
  lastAnimTime = null;
  pacePlayIcon.className = 'fa-solid fa-pause text-xs';
  animFrameId = requestAnimationFrame(paceLoop);
}

function stopPacemaker() {
  isPacePlaying = false;
  pacePlayIcon.className = 'fa-solid fa-play text-xs ml-0.5';
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

pacePlayBtn.onclick = () => {
  if (isPacePlaying) {
    stopPacemaker();
    updatePacemaker();
  } else {
    startPacemaker();
  }
};

paceResetBtn.onclick = () => {
  stopPacemaker();
  paceProgress = 0;
  updatePacemaker();
  if (map) {
    map.panTo(NODES.MAIN_GATE_BUS_STOP);
  }
};

paceScrubber.oninput = (e) => {
  stopPacemaker();
  paceProgress = parseFloat(e.target.value) / 100;
  updatePacemaker();
};

const speeds = [1.0, 1.5, 2.5];
let sIdx = 0;
paceSpeedBtn.onclick = () => {
  sIdx = (sIdx + 1) % speeds.length;
  paceSpeed = speeds[sIdx];
  paceSpeedBtn.textContent = `${paceSpeed.toFixed(1)}x`;
  updatePacemaker();
};

let currentStep = 1;
const stepCards = [
  document.getElementById('stepCard1'),
  document.getElementById('stepCard2'),
  document.getElementById('stepCard3')
];
const stepDots = document.getElementById('stepDots').children;
const stepCounterBadge = document.getElementById('stepCounterBadge');
const prevStepBtn = document.getElementById('prevStepBtn');
const nextStepBtn = document.getElementById('nextStepBtn');

function showStep(stepNum, panCamera = true) {
  currentStep = stepNum;
  stepCards.forEach((c, idx) => {
    if (idx + 1 === stepNum) {
      c.classList.remove('hidden');
      stepDots[idx].className = 'w-5 h-2.5 rounded-full bg-knu-red transition-all';
    } else {
      c.classList.add('hidden');
      stepDots[idx].className = 'w-2.5 h-2.5 rounded-full bg-gray-200 transition-all';
    }
  });

  stepCounterBadge.textContent = `Step ${stepNum}/3`;
  prevStepBtn.disabled = stepNum === 1;
  nextStepBtn.disabled = stepNum === 3;

  if (panCamera && map) {
    if (stepNum === 1) map.panTo(NODES.MAIN_GATE_BUS_STOP);
    else if (stepNum === 2) map.panTo(NODES.IT1_1F);
    else if (stepNum === 3) map.panTo(NODES.BRIDGE_3F);
  }
}

function syncStepWithProgress(progress) {
  if (progress < 0.45) {
    if (currentStep !== 1) showStep(1, false);
  } else if (progress < 0.75) {
    if (currentStep !== 2) showStep(2, false);
  } else {
    if (currentStep !== 3) showStep(3, false);
  }
}

prevStepBtn.onclick = () => {
  if (currentStep > 1) {
    showStep(currentStep - 1, true);
    paceProgress = (currentStep - 1) * 0.45;
    updatePacemaker();
  }
};

nextStepBtn.onclick = () => {
  if (currentStep < 3) {
    showStep(currentStep + 1, true);
    paceProgress = currentStep * 0.5;
    updatePacemaker();
  }
};

const mapTypeRoad = document.getElementById('mapTypeRoad');
const mapTypeSky = document.getElementById('mapTypeSky');

mapTypeRoad.onclick = () => {
  if (tileLayer) {
    tileLayer.setUrl('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    mapTypeRoad.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-knu-red text-white shadow-md shadow-knu-red/30 flex items-center space-x-1';
    mapTypeSky.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-gray-600 hover:text-gray-900 flex items-center space-x-1';
  }
};

mapTypeSky.onclick = () => {
  if (tileLayer) {
    tileLayer.setUrl('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
    mapTypeSky.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-knu-red text-white shadow-md shadow-knu-red/30 flex items-center space-x-1';
    mapTypeRoad.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-gray-600 hover:text-gray-900 flex items-center space-x-1';
  }
};

document.getElementById('toggleBoundary').onchange = (e) => {
  if (campusPolygon) {
    if (e.target.checked) campusPolygon.addTo(map);
    else map.removeLayer(campusPolygon);
  }
};

window.onload = () => {
  calculateDeadline();
  initMap();
  updatePacemaker();
};
