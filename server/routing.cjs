class RouteError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const {metersBetween, makeRouteMetrics} = require('../src/geo-utils.js');
const STATUS_MESSAGES = {SAME_POINT: '출발지와 도착지가 같습니다.', START_LINK_NOT_FOUND: '출발지 주변의 보행로를 찾지 못했습니다. 가까운 출입구를 선택해주세요.', END_LINK_NOT_FOUND: '도착지 주변의 보행로를 찾지 못했습니다. 가까운 출입구를 선택해주세요.', TOO_FAR_AWAY: '도보 경로를 찾기에는 두 장소가 너무 멉니다.', TOO_MANY_SEARCH_LINK: '경로 탐색 범위를 초과했습니다.', ROUTE_RESULT_NOT_FOUND: '이 두 지점 사이의 도보 경로를 찾지 못했습니다.'};
function validPoint(point) { return Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180; }
function normalizeWalkingRoute(data) {
  if (data.status !== 'OK') throw new RouteError(422, data.status || 'NO_ROUTE', STATUS_MESSAGES[data.status] || '도보 경로를 찾지 못했습니다.');
  const points = [], instructions = [];
  if (!Array.isArray(data.route?.legs)) throw new RouteError(502, 'INVALID_ROUTE', '경로 데이터가 올바르지 않습니다.');
  for (const leg of data.route.legs) {
    if (!Array.isArray(leg.steps)) throw new RouteError(502, 'INVALID_ROUTE', '경로 구간 데이터가 올바르지 않습니다.');
    for (const step of leg.steps) {
      const startIndex = Math.max(0, points.length - 1);
      const coordinates = step.path?.points || [];
      if ((step.properties?.distance || 0) > 0 && coordinates.length < 2) throw new RouteError(502, 'INCOMPLETE_ROUTE', '경로 일부의 좌표가 없습니다. 다른 장소로 다시 검색해주세요.');
      if (points.length && coordinates.length && validPoint([coordinates[0][1], coordinates[0][0]]) && metersBetween(points.at(-1), [coordinates[0][1], coordinates[0][0]]) > 10) throw new RouteError(502, 'DISCONNECTED_ROUTE', '경로 구간이 이어지지 않습니다. 다른 장소로 다시 검색해주세요.');
      for (const xy of coordinates) {
        if (!Array.isArray(xy) || xy.length !== 2 || !validPoint([xy[1], xy[0]])) throw new RouteError(502, 'INVALID_ROUTE', '경로 좌표가 올바르지 않습니다.');
        const point = [xy[1], xy[0]];
        if (!points.length || points.at(-1).some((x, i) => x !== point[i])) points.push(point);
      }
      if (step.properties?.guidance) instructions.push({text: String(step.properties.guidance), distance: Number(step.properties.distance) || 0, startIndex});
    }
  }
  const distance = data.route.properties?.totalDistance, duration = data.route.properties?.totalTime;
  if (points.length < 2 || !Number.isFinite(distance) || distance <= 0 || !Number.isFinite(duration) || duration <= 0) throw new RouteError(502, 'INVALID_ROUTE', '경로의 거리·시간 또는 좌표가 없습니다.');
  return {provider: 'kakao', mode: 'walk', points, distance, duration, instructions};
}
async function fetchWalkingRoute(input, env, request = fetch) {
  if (!input || !validPoint(input.start?.coords) || !validPoint(input.end?.coords)) throw new RouteError(400, 'INVALID_INPUT', '출발지와 도착지를 검색 결과에서 선택해주세요.');
  const routeMode = input.routeMode || 'BROAD_FIRST';
  if (!['BROAD_FIRST', 'SHORTEST', 'ACCESSIBLE'].includes(routeMode)) throw new RouteError(400, 'INVALID_INPUT', '지원하지 않는 경로 조건입니다.');
  if (input.start.coords.every((n, i) => n === input.end.coords[i])) throw new RouteError(422, 'SAME_POINT', STATUS_MESSAGES.SAME_POINT);
  if (!env.KAKAO_REST_API_KEY) throw new RouteError(503, 'NOT_CONFIGURED', '현재 길찾기 연결을 준비 중입니다. 잠시 후 다시 시도해주세요.');
  const query = new URLSearchParams({start_x: input.start.coords[1], start_y: input.start.coords[0], end_x: input.end.coords[1], end_y: input.end.coords[0], input_coord: 'WGS84', output_coord: 'WGS84', route_mode: routeMode, s_name: String(input.start.name || '출발').slice(0, 80), e_name: String(input.end.name || '도착').slice(0, 80)});
  let response;
  try { response = await request(`https://dapi.kakao.com/v2/routing/walk?${query}`, {headers: {Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}`}, signal: AbortSignal.timeout(12000)}); }
  catch { throw new RouteError(502, 'UPSTREAM_UNAVAILABLE', '길찾기 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.'); }
  if (!response.ok) {
    if (response.status === 429) throw new RouteError(429, 'QUOTA', '길찾기 요청이 많습니다. 잠시 후 다시 시도해주세요.');
    throw new RouteError(502, 'UPSTREAM_ERROR', response.status === 401 || response.status === 403 ? '길찾기 서비스 인증을 확인해야 합니다.' : '길찾기 서비스에서 응답을 받지 못했습니다.');
  }
  let data; try { data = await response.json(); } catch { throw new RouteError(502, 'INVALID_ROUTE', '길찾기 응답을 읽지 못했습니다.'); }
  const route = normalizeWalkingRoute(data);
  route.geometryDistance = makeRouteMetrics(route.points).total;
  route.startOffset = metersBetween(input.start.coords, route.points[0]);
  route.endOffset = metersBetween(input.end.coords, route.points.at(-1));
  route.geometryWarning = Math.abs(route.geometryDistance - route.distance) / route.distance > .15;
  return route;
}
async function searchPlaces(keyword, env, request = fetch) {
  if (typeof keyword !== 'string' || !keyword.trim() || keyword.length > 100) throw new RouteError(400, 'INVALID_INPUT', '검색어를 입력해주세요.');
  if (!env.KAKAO_REST_API_KEY) throw new RouteError(503, 'NOT_CONFIGURED', '장소 검색 연결을 준비 중입니다.');
  const query = new URLSearchParams({query: keyword.trim(), x: '128.6125', y: '35.89', sort: 'accuracy', size: '10'});
  let response;
  try { response = await request(`https://dapi.kakao.com/v2/local/search/keyword.json?${query}`, {headers: {Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}`}, signal: AbortSignal.timeout(10000)}); }
  catch { throw new RouteError(502, 'UPSTREAM_UNAVAILABLE', '장소 검색에 연결하지 못했습니다.'); }
  if (!response.ok) throw new RouteError(502, 'UPSTREAM_ERROR', '장소 검색에 실패했습니다. 잠시 후 다시 시도해주세요.');
  const data = await response.json();
  return {places: (data.documents || []).map(place => ({id: place.id, name: place.place_name, coords: [Number(place.y), Number(place.x)], address: place.road_address_name || place.address_name})).filter(place => validPoint(place.coords))};
}
module.exports = {RouteError, validPoint, normalizeWalkingRoute, fetchWalkingRoute, searchPlaces};
