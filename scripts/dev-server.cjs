const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {fetchWalkingRoute, RouteError, searchPlaces} = require('../server/routing.cjs');
const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
}
const portArg = process.argv.find(value => value.startsWith('--port='));
const port = Number(portArg ? portArg.split('=')[1] : 5174);
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png'};
const requests = new Map();
function json(res, status, data) { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data)); }
http.createServer(async (req, res) => {
  const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!allowedHosts.includes(req.headers.host)) return json(res, 403, {error: '요청 주소를 확인해주세요.'});
  if (req.headers.origin && !allowedHosts.some(host => req.headers.origin === `http://${host}`)) return json(res, 403, {error: '허용되지 않은 요청입니다.'});
  let relative;
  try { relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return json(res, 400, {error: '잘못된 요청입니다.'}); }
  if (relative === '/api/route' || relative === '/api/walk' || relative === '/api/search') {
    const search = relative === '/api/search';
    if (req.method !== (search ? 'GET' : 'POST')) return json(res, 405, {error: '요청 방식을 확인해주세요.'});
    if (!search && !String(req.headers['content-type']).startsWith('application/json')) return json(res, 415, {error: 'JSON 요청이 필요합니다.'});
    const address = req.socket.remoteAddress, now = Date.now();
    const entry = requests.get(address);
    const window = entry && now - entry.start < 60000 ? entry : {start: now, count: 0}; requests.set(address, window);
    if (++window.count > 20) return json(res, 429, {error: '요청이 많습니다. 1분 후 다시 시도해주세요.'});
    try {
      if (search) return json(res, 200, await searchPlaces(new URL(req.url, 'http://localhost').searchParams.get('q'), process.env));
      let body = '', bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 4096) throw new RouteError(413, 'TOO_LARGE', '요청이 너무 큽니다.'); body += chunk; }
      let input; try { input = JSON.parse(body); } catch { throw new RouteError(400, 'INVALID_JSON', '요청 내용을 확인해주세요.'); }
      return json(res, 200, await fetchWalkingRoute(input, process.env));
    } catch (error) { return json(res, error instanceof RouteError ? error.status : 500, {error: error instanceof RouteError ? error.message : '경로 요청을 처리하지 못했습니다.', code: error.code || 'SERVER_ERROR'}); }
  }
  if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, {error: '지원하지 않는 요청입니다.'});
  // .env and server files are not public assets.
  if (relative.split('/').some(part => part.startsWith('.')) || !(relative === '/' || relative === '/index.html' || relative.startsWith('/src/') || relative.startsWith('/data/'))) { res.writeHead(403); return res.end('Forbidden'); }
  const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (error, content) => {
    if (error) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type': (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control':'no-store'});
    res.end(req.method === 'HEAD' ? undefined : content);
  });
}).listen(port, '127.0.0.1', () => console.log(`Campus navigation: http://127.0.0.1:${port}`));
