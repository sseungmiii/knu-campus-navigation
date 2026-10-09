const assert = require('node:assert/strict');
const {handleApi} = require('../server/vercel-handler.cjs');
const {RouteError} = require('../server/routing.cjs');
function response() { return {headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; }}; }
const env = {KAKAO_REST_API_KEY: 'server-only-test-secret'};
let calls = 0;
const services = {
  async searchPlaces(q, received) { calls++; assert.equal(q, '경북대학교'); assert.equal(received, env); return {places: []}; },
  async fetchWalkingRoute(input, received) { calls++; assert.deepEqual(input, {start: 1}); assert.equal(received, env); return {provider: 'kakao'}; }
};
async function run(method, url, headers = {}, body, options = {}) {
  const res = response();
  await handleApi(url.startsWith('/api/search') ? 'search' : 'route', {method, url, headers, body}, res, env, options.services || services);
  return res;
}
(async () => {
  let res = await run('OPTIONS', '/api/route', {origin: 'https://sseungmiii.github.io'});
  assert.equal(res.statusCode, 204); assert.equal(calls, 0); assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://sseungmiii.github.io');
  res = await run('POST', '/api/route', {origin: 'https://untrusted.example', 'content-type': 'application/json'}, {start: 1});
  assert.equal(res.statusCode, 403); assert.equal(calls, 0); assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
  res = await run('POST', '/api/route', {origin: 'https://knu-campus-navigation.vercel.app', 'content-type': 'application/json'}, {start: 1});
  assert.equal(res.statusCode, 200); assert.equal(res.headers['Cache-Control'], 'no-store'); assert.ok(!res.body.includes(env.KAKAO_REST_API_KEY));
  res = await run('POST', '/api/route', {origin: 'http://127.0.0.1:5174', host: '127.0.0.1:5174', 'content-type': 'application/json'}, {start: 1}); assert.equal(res.statusCode, 200);
  res = await run('POST', '/api/route', {origin: 'http://127.0.0.1:5174', host: 'knu-campus-navigation.vercel.app', 'content-type': 'application/json'}, {start: 1}); assert.equal(res.statusCode, 403);
  res = await run('POST', '/api/route', {'content-type': 'application/json'}, '{bad'); assert.equal(res.statusCode, 400);
  res = await run('POST', '/api/route', {'content-type': 'application/json'}, {oversized: 'x'.repeat(5000)}); assert.equal(res.statusCode, 413);
  res = await run('GET', '/api/route'); assert.equal(res.statusCode, 405);
  res = await run('POST', '/api/route', {}, {}); assert.equal(res.statusCode, 415);
  res = await run('GET', '/api/search?q=' + encodeURIComponent('경북대학교')); assert.equal(res.statusCode, 200);
  res = await run('POST', '/api/route', {'content-type': 'application/json'}, {}, {services: {fetchWalkingRoute: async () => {throw new Error(env.KAKAO_REST_API_KEY);}}});
  assert.equal(res.statusCode, 500); assert.ok(!res.body.includes(env.KAKAO_REST_API_KEY));
  res = await run('POST', '/api/route', {'content-type': 'application/json'}, {}, {services: {fetchWalkingRoute: async () => {throw new RouteError(503, 'NOT_CONFIGURED', '연결 준비 중');}}});
  assert.equal(res.statusCode, 503);
  for (let i = 0; i < 21; i++) res = await run('GET', '/api/search?q=' + encodeURIComponent('경북대학교'), {'x-forwarded-for': '198.51.100.7'});
  assert.equal(res.statusCode, 429);
  console.log('PASS: Vercel handlers, CORS, body limits, server-only environment, safe errors and throttling');
})().catch(error => {console.error(error); process.exitCode = 1;});
