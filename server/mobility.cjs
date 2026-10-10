const {XMLParser} = require('fast-xml-parser');
const {RouteError, validPoint, fetchWalkingRoute} = require('./routing.cjs');
const {metersBetween, makeRouteMetrics, projectOnRoute} = require('../src/geo-utils.js');
const stopData = require('../data/daegu-bus-stops.json');
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const cache = new Map();
async function read(url, options = {}, request = fetch) {
  try {
    const response = await request(url, {...options, signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error();
    const raw = await response.text();
    if (raw.length > 4000000 || /sabSignature|sabFingerPrint/i.test(raw)) throw new Error();
    return raw.trim().startsWith('{') || raw.trim().startsWith('[') ? JSON.parse(raw) : new XMLParser({parseTagValue:false}).parse(raw);
  } catch { throw new RouteError(502, 'UPSTREAM_UNAVAILABLE', '교통 정보 제공기관에 연결하지 못했습니다. 잠시 후 다시 조회해주세요.'); }
}
function matchStop(name, point) {
  const normalize = s => String(s).replace(/\s/g,'');
  const candidates = stopData.stops.filter(stop => normalize(stop.name) === normalize(name) && validPoint(stop.coords)).map(stop => ({...stop, offset: metersBetween(point,stop.coords)})).sort((a,b)=>a.offset-b.offset);
  // Never guess an opposite-side stop from name alone.
  return candidates[0]?.offset <= 100 && (!candidates[1] || candidates[1].offset-candidates[0].offset > 15) ? candidates[0] : null;
}
function normalizeTransit(data) {
  if (data.status !== 'OK' || !Array.isArray(data.routes)) throw new RouteError(422,'NO_ROUTE','대중교통 경로를 찾지 못했습니다.');
  const routes = data.routes.map(route => {
    const steps = list(route.steps).map(step => {
      const p=step.properties || {}, points=list(step.path?.points).map(xy=>[xy[1],xy[0]]);
      if (!['BUS','SUBWAY','WALKING'].includes(p.type) || points.length < 2 || !points.every(validPoint) || !Number.isFinite(p.time) || p.time < 0) throw new RouteError(502,'INVALID_ROUTE','대중교통 경로 데이터가 올바르지 않습니다.');
      return {type:p.type, text:String(p.guidance || ''), duration:p.time, distance:p.distance, points, stops:list(p.stops).map(s=>String(s.name)), vehicles:list(p.vehicles).map(v=>String(v.name)), boardingStop:p.type === 'BUS' ? matchStop(p.stops?.[0]?.name,points[0]) : null};
    });
    const duration=route.properties?.totalTime;
    if(!steps.length || !Number.isFinite(duration) || duration<=0) throw new RouteError(502,'INVALID_ROUTE','경로 소요 시간이 없습니다.');
    return {mode:'transit',duration,distance:route.properties.totalDistance,transfers:route.properties.transfers,fare:route.properties.fare?.value,steps};
  }).sort((a,b)=>a.duration-b.duration).slice(0,5);
  return {routes,source:'카카오 대중교통 예상',updatedAt:new Date().toISOString()};
}
async function transit(input,env,request=fetch) {
  if(!validPoint(input?.start?.coords)||!validPoint(input?.end?.coords)) throw new RouteError(400,'INVALID_INPUT','출발지와 도착지를 선택해주세요.');
  if(!env.KAKAO_REST_API_KEY) throw new RouteError(503,'NOT_CONFIGURED','대중교통 연결을 준비 중입니다.');
  const query=new URLSearchParams({start_x:input.start.coords[1],start_y:input.start.coords[0],end_x:input.end.coords[1],end_y:input.end.coords[0]});
  const result=normalizeTransit(await read(`https://dapi.kakao.com/v2/routing/publictraffic?${query}`,{headers:{Authorization:`KakaoAK ${env.KAKAO_REST_API_KEY}`}},request));
  const walks=new Map();
  const connection=(start,end)=>{
    const key=JSON.stringify([start.coords,end.coords]);
    if(!walks.has(key))walks.set(key,fetchWalkingRoute({start,end},env,request).then(walk=>({type:'WALKING',text:`도보 · ${start.name} → ${end.name}`,duration:walk.duration,distance:walk.distance,points:walk.points,startOffset:walk.startOffset,endOffset:walk.endOffset,stops:[],vehicles:[]})));
    return walks.get(key);
  };
  await Promise.all(result.routes.map(async route=>{
    const first=route.steps[0],last=route.steps.at(-1),from=first.points[0],to=last.points.at(-1);
    route.connectionsComplete=true;
    try{
      if(first.type!=='WALKING'&&metersBetween(input.start.coords,from)>5)route.steps.unshift(await connection(input.start,{name:first.stops[0]||'승차 지점',coords:from}));
      if(last.type!=='WALKING'&&metersBetween(to,input.end.coords)>5)route.steps.push(await connection({name:last.stops.at(-1)||'하차 지점',coords:to},input.end));
      const connected=[];
      for(const step of route.steps){
        const previous=connected.at(-1);
        if(previous&&metersBetween(previous.points.at(-1),step.points[0])>10)connected.push(await connection({name:previous.stops.at(-1)||'이전 구간 끝',coords:previous.points.at(-1)},{name:step.stops[0]||'다음 승차 지점',coords:step.points[0]}));
        connected.push(step);
      }
      route.steps=connected;
      route.connectionsComplete=route.steps.every(s=>s.type!=='WALKING'||((s.startOffset||0)<=30&&(s.endOffset||0)<=30));
      const sum=route.steps.reduce((n,s)=>n+s.duration,0);
      route.duration=Math.max(route.duration,sum);route.distance=route.steps.reduce((n,s)=>n+(s.distance||0),0);
      route.durationNote='카카오 전체 예상 시간과 확인된 개별 이동 시간 중 큰 값을 사용합니다. 환승 대기는 실제 운행에 따라 달라집니다.';
    }catch{route.connectionsComplete=false;route.durationNote='승하차 지점까지 도보 연결을 확인하지 못했습니다. 표시 시간에 누락 구간이 있을 수 있습니다.';}
  }));
  result.routes.sort((a,b)=>a.duration-b.duration);return result;
}
async function bus(query,env,request=fetch) {
  const stop=stopData.stops.find(s=>s.id===query.get('stop')); if(!stop) throw new RouteError(400,'INVALID_INPUT','정류장을 확인해주세요.');
  if(!env.DAEGU_BUS_API_KEY) throw new RouteError(503,'NOT_CONFIGURED','실시간 버스 연결을 준비 중입니다.');
  const key=stop.id, previous=cache.get(key); if(previous && Date.now()-previous.time<20000) return previous.data;
  let serviceKey; try{serviceKey=decodeURIComponent(env.DAEGU_BUS_API_KEY.trim());}catch{throw new RouteError(503,'NOT_CONFIGURED','버스 인증 설정을 확인해야 합니다.');}
  const params=new URLSearchParams({serviceKey,bsId:stop.id});
  const raw=await read(`https://apis.data.go.kr/6270000/dbmsapi02/getRealtime02?${params}`,{},request), data=raw.response || raw;
  if(String(data.header?.resultCode)!=='0000') throw new RouteError(502,'BUS_ERROR','버스 제공기관의 인증 또는 서비스 상태를 확인해야 합니다.');
  const arrivals=list(data.body?.items?.item || data.body?.items).flatMap(item=>list(item.arrList?.item || item.arrList).map(a=>({route:String(a.routeNo||item.routeNo),seconds:Number(a.arrTime),state:String(a.arrState||''),remainingStops:Number(a.bsGap),lowFloor:a.busTCd2==='D'}))).filter(a=>Number.isFinite(a.seconds)&&a.seconds>=0).sort((a,b)=>a.seconds-b.seconds);
  const result={stop,arrivals,updatedAt:new Date().toISOString(),source:'대구광역시 실시간 버스',stopDataDate:stopData.updatedAt};
  if(cache.size>1000) cache.clear(); cache.set(key,{time:Date.now(),data:result}); return result;
}
async function nearby(input,env,request=fetch) {
  if(!Array.isArray(input?.points)||input.points.length<1||input.points.length>40||!input.points.every(validPoint)||!['FD6','CE7','CS2'].includes(input.category)) throw new RouteError(400,'INVALID_INPUT','시설 검색 조건을 확인해주세요.');
  if(!env.KAKAO_REST_API_KEY) throw new RouteError(503,'NOT_CONFIGURED','시설 검색 연결을 준비 중입니다.');
  const points=input.points, metrics=points.length>1 ? makeRouteMetrics(points) : null;
  const centers=[points[0],points[Math.floor(points.length/2)],points.at(-1)].filter((p,i,a)=>a.findIndex(q=>q[0]===p[0]&&q[1]===p[1])===i);
  const responses=await Promise.all(centers.map(async p=>read(`https://dapi.kakao.com/v2/local/search/category.json?${new URLSearchParams({category_group_code:input.category,x:p[1],y:p[0],radius:700,sort:'distance',size:15})}`,{headers:{Authorization:`KakaoAK ${env.KAKAO_REST_API_KEY}`}},request)));
  const unique=new Map();
  for(const data of responses) for(const p of list(data.documents)) {
    const coords=[Number(p.y),Number(p.x)]; if(!validPoint(coords))continue;
    const offset=metrics?projectOnRoute(metrics,coords).offset:metersBetween(coords,points[0]);
    if(offset>350)continue;
    unique.set(p.id,{id:p.id,name:p.place_name,coords,address:p.road_address_name||p.address_name,phone:p.phone,url:/^https?:\/\/place\.map\.kakao\.com\//.test(p.place_url||'')?p.place_url:null,offset:Math.round(offset),estimatedExtraMinutes:Math.ceil(offset*2/80)});
  }
  return {places:[...unique.values()].sort((a,b)=>a.offset-b.offset).slice(0,15),source:'카카오 장소 검색',note:'경로 주변 일부 지점을 검색합니다. 추가 시간은 직선거리 기준 왕복 도보 추정이며 영업 여부는 확인이 필요합니다.'};
}
function findSchedules(value,result=[]) {
  if(Array.isArray(value))value.forEach(v=>findSchedules(v,result));
  else if(value&&typeof value==='object'){if(typeof value.SCHEDULE==='string')result.push(value);else Object.values(value).forEach(v=>findSchedules(v,result));} return result;
}
async function metro(query,env,request=fetch) {
  const station=query.get('station'), line=query.get('line'), direction=query.get('direction'), day=query.get('day');
  if(!station||station.length>30||!/^[가-힣a-zA-Z0-9 ]+$/.test(station)||!['1','2','3'].includes(line)||!['UP','DOWN'].includes(direction)||!['WEEKDAY','SAT','HOLIDAY'].includes(day))throw new RouteError(400,'INVALID_INPUT','역·호선·방향·운행일을 선택해주세요.');
  const params=new URLSearchParams({STT_NM:station.replace(/역$/,''),LINE_NO:line,SCHEDULE_METH:direction,SCHEDULE_TYPE:day});
  const raw=await read(`https://www.dtro.or.kr/open_content_new/ko/OpenApi/stationTime.php?${params}`,{},request);
  const rows=findSchedules(raw); if(!rows.length)throw new RouteError(502,'METRO_UNAVAILABLE','공식 지하철 시간표를 읽지 못했습니다. 현재 경로는 카카오 예상 시간으로 표시됩니다.');
  return {station,line,direction,day,times:[...new Set(rows.flatMap(row=>row.SCHEDULE.match(/\b(?:[01]?\d|2[0-4]):[0-5]\d\b/g)||[]))],source:'대구교통공사 운행 시간표 · 실시간 아님',updatedAt:new Date().toISOString()};
}
module.exports={transit,bus,nearby,metro,normalizeTransit,matchStop,findSchedules};
