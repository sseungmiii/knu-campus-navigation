const {RouteError, fetchWalkingRoute, searchPlaces} = require('./routing.cjs');
const origins = new Set(['https://knu-campus-navigation.vercel.app', 'https://sseungmiii.github.io']);
const requests = new Map();
function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
async function handleApi(kind, req, res, env = process.env, services = {fetchWalkingRoute, searchPlaces}) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  const localOrigin = env.VERCEL !== '1' && ['127.0.0.1:5174', 'localhost:5174'].includes(req.headers.host) && origin === `http://${req.headers.host}`;
  if (origin && !origins.has(origin) && !localOrigin) return json(res, 403, {error: '허용되지 않은 요청입니다.'});
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const search = kind === 'search';
  if (req.method !== (search ? 'GET' : 'POST')) {
    res.setHeader('Allow', search ? 'GET, OPTIONS' : 'POST, OPTIONS');
    return json(res, 405, {error: '요청 방식을 확인해주세요.'});
  }
  if (!search && !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, {error: 'JSON 요청이 필요합니다.'});
  // Best-effort per-instance throttling; distributed limits belong in the hosting firewall.
  const now = Date.now(), address = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  for (const [ip, value] of requests) if (now - value.start >= 60000) requests.delete(ip);
  if (!requests.has(address) && requests.size >= 10000) return json(res, 429, {error: '요청이 많습니다. 잠시 후 다시 시도해주세요.'});
  const entry = requests.get(address) || {start: now, count: 0}; requests.set(address, entry);
  if (++entry.count > 20) return json(res, 429, {error: '요청이 많습니다. 1분 후 다시 시도해주세요.'});
  try {
    if (search) {
      const keyword = new URL(req.url, 'https://localhost').searchParams.get('q');
      return json(res, 200, await services.searchPlaces(keyword, env));
    }
    if (Number(req.headers['content-length']) > 4096) throw new RouteError(413, 'TOO_LARGE', '요청이 너무 큽니다.');
    let input = req.body;
    if (input === undefined) {
      let raw = '', bytes = 0;
      for await (const chunk of req) { bytes += Buffer.byteLength(chunk); if (bytes > 4096) throw new RouteError(413, 'TOO_LARGE', '요청이 너무 큽니다.'); raw += chunk; }
      input = raw;
    }
    if (Buffer.byteLength(typeof input === 'string' ? input : JSON.stringify(input)) > 4096) throw new RouteError(413, 'TOO_LARGE', '요청이 너무 큽니다.');
    if (typeof input === 'string') {
      try { input = JSON.parse(input); } catch { throw new RouteError(400, 'INVALID_JSON', '요청 내용을 확인해주세요.'); }
    }
    return json(res, 200, await services.fetchWalkingRoute(input, env));
  } catch (error) {
    return json(res, error instanceof RouteError ? error.status : 500, {error: error instanceof RouteError ? error.message : '요청을 처리하지 못했습니다.', code: error instanceof RouteError ? error.code : 'SERVER_ERROR'});
  }
}
module.exports = {handleApi};
