class RoutePacemaker {
  constructor(view, update) {
    this.view = view; this.update = update; this.watchId = null; this.frame = null; this.route = null; this.speed = 4.8 / 3.6; this.mode = 'idle';
  }
  setRoute(route) { this.stop(); this.route = route; this.metrics = makeRouteMetrics(route.points); this.userDistance = 0; }
  marker(point, kind) { return this.view.marker(point, `<div class="nav-marker ${kind}">${kind === 'ghost' ? '🏃' : '●'}<span>${kind === 'ghost' ? '목표 페이스' : '내 위치'}</span></div>`); }
  setSpeed(kmh) {
    if (this.mode === 'live' || this.mode === 'preview') {
      this.base = this.targetDistance(); this.started = performance.now();
    }
    this.speed = kmh / 3.6;
  }
  targetDistance() { return Math.min(this.metrics.total, this.base + (performance.now() - this.started) / 1000 * this.speed * (this.mode === 'preview' ? 12 : 1)); }
  preview() {
    if (!this.route) return;
    this.stop(); this.mode = 'preview'; this.base = 0; this.started = performance.now();
    this.ghost = this.marker(this.metrics.points[0], 'ghost');
    this.tick();
  }
  startLive() {
    if (!this.route || this.route.sample || this.route.mode !== 'walk') { this.update({message: '실제 도보 경로를 먼저 검색해주세요.'}); return; }
    if (!navigator.geolocation || !window.isSecureContext) { this.update({message: '위치 안내는 HTTPS와 위치 기능이 지원되는 기기에서 이용해주세요.'}); return; }
    this.stop(); this.mode = 'waiting'; this.userDistance = 0;
    const session = this.session;
    this.update({mode: 'waiting', message: '현재 위치 확인 중… 위치 정보는 저장하지 않습니다.'});
    this.watchId = navigator.geolocation.watchPosition(position => {
      if (session !== this.session || !['waiting', 'live'].includes(this.mode)) return;
      if (!validLocation(position)) { this.update({mode: this.mode, message: '위치 정확도가 낮거나 오래된 신호입니다. 정확한 위치를 기다립니다.'}); return; }
      const coords = [position.coords.latitude, position.coords.longitude];
      this.lastFix = position.timestamp;
      const projection = projectOnRoute(this.metrics, coords, this.userDistance);
      if (this.user) this.user.setLatLng(coords); else this.user = this.marker(coords, 'user');
      this.offRoute = projection.offset > Math.max(40, position.coords.accuracy);
      if (this.offRoute) { this.update({mode: this.mode, message: '경로에서 벗어났습니다. 현재 위치를 출발지로 다시 검색해주세요.'}); return; }
      this.userDistance = projection.distance;
      if (this.mode === 'waiting') {
        this.mode = 'live'; this.base = projection.distance; this.started = performance.now();
        this.ghost = this.marker(projection.point, 'ghost'); this.tick();
      }
      if (this.metrics.total - projection.distance < 25 && metersBetween(coords, this.metrics.points.at(-1)) < 25) {
        const finalMessage = this.route.endOffset > 30 ? `제공된 보행 경로 끝에 도착했습니다. 검색한 장소 좌표까지 직선거리 약 ${Math.round(this.route.endOffset)}m입니다. 실제 출입구를 확인해주세요.` : '목적지 인근 보행로에 도착했습니다. 위치 안내를 종료했습니다.';
        this.stop(); this.update({mode: 'arrived', remaining: 0, progress: 100, message: finalMessage});
      }
    }, error => {
      if (session !== this.session) return;
      this.stop(); this.update({mode: 'idle', message: error.code === 1 ? '위치 권한이 거부되었습니다. 권한을 허용한 뒤 다시 시작해주세요.' : '현재 위치를 받지 못했습니다. 잠시 후 다시 시도해주세요.'});
    }, {enableHighAccuracy: true, maximumAge: 0, timeout: 15000});
  }
  tick(session = this.session) {
    if (session !== this.session || !['live', 'preview'].includes(this.mode)) return;
    const target = this.targetDistance(); this.ghost.setLatLng(pointAtMeters(this.metrics, target));
    if (!this.lastDraw || performance.now() - this.lastDraw > 400) {
      this.lastDraw = performance.now();
      const preview = this.mode === 'preview';
      const fresh = this.lastFix && Date.now() - this.lastFix < 15000;
      const progress = preview ? target : this.userDistance;
      const remaining = Math.max(0, this.metrics.total - progress);
      const gap = target - this.userDistance;
      const message = preview ? '경로 미리보기 · 12배속 (실제 위치 안내 아님)' : !fresh ? 'GPS 신호가 오래됐습니다. 위치 갱신을 기다립니다.' : this.offRoute ? '경로 이탈 · 현재 위치로 다시 검색해주세요.' : `${Math.abs(Math.round(gap))}m ${gap > 5 ? '목표보다 뒤에 있어요' : gap < -5 ? '목표보다 앞서 있어요' : '목표 페이스에 맞춰 걷고 있어요'}`;
      this.update({mode: this.mode, message, remaining: (fresh && !this.offRoute) || preview ? remaining : null, progress: Math.min(100, progress / this.metrics.total * 100), gap: fresh && !this.offRoute ? gap : null});
    }
    if (this.mode === 'preview' && target >= this.metrics.total) {
      this.mode = 'preview-complete'; this.update({mode: this.mode, remaining: 0, progress: 100, message: '경로 미리보기 완료. 실제 안내는 도보 안내 시작을 눌러주세요.'}); return;
    }
    this.frame = requestAnimationFrame(() => this.tick(session));
  }
  stop() {
    this.session = (this.session || 0) + 1;
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.watchId = this.frame = null;
    this.ghost?.remove(); this.user?.remove(); this.ghost = this.user = null;
    this.mode = 'idle'; this.lastFix = null; this.lastDraw = null; this.offRoute = false;
    this.update({mode: 'idle', message: '도보 안내를 시작하면 목표 페이스와 내 위치를 비교합니다.'});
  }
}
