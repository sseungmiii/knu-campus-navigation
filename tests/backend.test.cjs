const assert = require('node:assert/strict');
const {normalizeWalkingRoute, fetchWalkingRoute} = require('../server/routing.cjs');
const sample = {status: 'OK', route: {properties: {totalDistance: 200, totalTime: 180}, legs: [{steps: [
  {properties: {distance: 90, guidance: '직진'}, path: {points: [[128, 35], [128.001, 35]]}},
  {properties: {distance: 110, guidance: '좌회전'}, path: {points: [[128.001, 35], [128.001, 35.001]]}}
]}]}};
const result = normalizeWalkingRoute(sample);
assert.deepEqual(result.points, [[35, 128], [35, 128.001], [35.001, 128.001]]);
assert.equal(result.instructions.length, 2);
assert.throws(() => normalizeWalkingRoute({status: 'SAME_POINT'}), /같습니다/);
assert.throws(() => normalizeWalkingRoute({status: 'OK', route: {legs: []}}), /좌표/);
const disconnected = structuredClone(sample); disconnected.route.legs[0].steps[1].path.points[0] = [129, 35];
assert.throws(() => normalizeWalkingRoute(disconnected), /이어지지/);
(async () => {
  const input = {start: {coords: [35, 128]}, end: {coords: [35.001, 128.001]}, routeMode: 'SHORTEST'};
  await assert.rejects(fetchWalkingRoute(input, {}), /준비/);
  await assert.rejects(fetchWalkingRoute({...input, routeMode: 'fake'}, {}), /지원하지/);
  await assert.rejects(fetchWalkingRoute({start: {coords: ['35', 128]}, end: input.end}, {}), /선택/);
  const route = await fetchWalkingRoute(input, {KAKAO_REST_API_KEY: 'server-only-test'}, async (url, options) => {
    const query = new URL(url).searchParams;
    assert.equal(query.get('start_x'), '128'); assert.equal(query.get('end_y'), '35.001'); assert.equal(query.get('output_coord'), 'WGS84');
    assert.equal(options.headers.Authorization, 'KakaoAK server-only-test');
    return {ok: true, json: async () => sample};
  });
  assert.equal(route.provider, 'kakao'); assert.equal(route.endOffset, 0); assert.ok(route.geometryDistance > 190);
  await assert.rejects(fetchWalkingRoute(input, {KAKAO_REST_API_KEY: 'secret'}, async () => ({ok: false, status: 401})), error => !error.message.includes('secret') && error.status === 502);
  console.log('PASS: Kakao XY→lat/lng normalization, segment continuity, REST parameters, errors and secret-safe responses');
})().catch(error => { console.error(error); process.exitCode = 1; });
