const {XMLParser, XMLValidator} = require('fast-xml-parser');
const {RouteError} = require('./routing.cjs');
const {metroCalendar}=require('./metro-calendar.cjs');
const {metroDirectionName}=require('../src/mobility-utils.js');
const ENDPOINT = 'https://www.dtro.or.kr/open_content_new/ko/OpenApi/stationTime.php';
const cache = new Map();
function findSchedules(value, result = []) {
  if (Array.isArray(value)) value.forEach(v => findSchedules(v, result));
  else if (value && typeof value === 'object') {
    if (typeof value.SCHEDULE === 'string') result.push(value);
    else Object.values(value).forEach(v => findSchedules(v, result));
  }
  return result;
}
function normalizeMetro(raw, {station, line, direction, day}) {
  if (!raw.trim()) throw new RouteError(404, 'NO_TIMETABLE', '해당 역의 시간표가 없습니다. 역 이름과 호선을 확인해주세요.');
  if (!raw.trim().startsWith('<?xml') || XMLValidator.validate(raw) !== true) throw new RouteError(502, 'METRO_UNAVAILABLE', '공식 시간표 응답을 읽지 못했습니다. 잠시 후 다시 조회해주세요.');
  const rows = findSchedules(new XMLParser({parseTagValue: false}).parse(raw)).filter(row =>
    row.STT_NM?.trim().replace(/역$/, '') === station.replace(/역$/, '') && String(row.LINE_NO) === line &&
    row.SCHEDULE_METH === (direction === 'UP' ? '상행' : '하행'));
  const trains = rows.flatMap(row => row.SCHEDULE.split(',').flatMap(value => {
    const match = value.trim().match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?(?:\s*\(([^)]{1,40})\))?$/);
    if (!match || Number(match[1]) > 26) return [];
    return [{time: `${match[1].padStart(2, '0')}:${match[2]}${match[3] && match[3] !== '00' ? ':'+match[3] : ''}`, destination: match[4] || null}];
  })).sort((a, b) => a.time.localeCompare(b.time));
  if (!trains.length) throw new RouteError(404, 'NO_TIMETABLE', '선택한 역·호선·방향의 시간표가 없습니다. 역 이름과 운행 방향을 확인해주세요.');
  return {station, line, direction, day, trains, times: [...new Set(trains.map(t => t.time))], source: '대구교통공사 운행 시간표 · 실시간 아님', updatedAt: new Date().toISOString()};
}
async function metro(query, env, request = fetch) {
  const calendar=metroCalendar();
  if(query.get('mode')==='day')return calendar;
  const shortName = query.get('station')?.trim().replace(/역$/, '');
  // These railway interchange names include 역 in the provider's actual station name.
  const station = ['동대구', '대구'].includes(shortName) ? `${shortName}역` : shortName;
  const line = query.get('line') || 'auto', direction = query.get('direction') || 'BOTH', day = !query.get('day')||query.get('day')==='auto'?calendar.day:query.get('day');
  if (!station || station.length > 30 || !/^[가-힣a-zA-Z0-9 ]+$/.test(station) || !['auto','1','2','3'].includes(line) || !['UP','DOWN','BOTH'].includes(direction) || !['WEEKDAY','SAT','HOLIDAY'].includes(day)) throw new RouteError(400, 'INVALID_INPUT', '역·호선·방향·운행일을 선택해주세요.');
  if(direction==='BOTH'){
    const lines=line==='auto'?['1','2','3']:[line];
    const results=await Promise.all(lines.map(async candidate=>{
      const directions=await Promise.all(['DOWN','UP'].map(async heading=>{
        const lookup=new URLSearchParams({station,line:candidate,direction:heading,day});
        try{return {...await metro(lookup,env,request),heading:metroDirectionName(candidate,heading)};}
        catch(error){return {line:candidate,direction:heading,heading:metroDirectionName(candidate,heading),times:[],trains:[],unavailable:error.code!=='NO_TIMETABLE'};}
      }));
      return {line:candidate,directions};
    }));
    const found=results.filter(result=>result.directions.some(item=>item.trains.length));
    const incomplete=results.some(result=>result.directions.some(item=>item.unavailable));
    const selected=line==='auto'?found[0]:found.find(item=>item.line===line);
    if(!selected)throw new RouteError(incomplete?502:404,incomplete?'UPSTREAM_UNAVAILABLE':'NO_TIMETABLE',incomplete?'지하철 시간표 서버에 연결하지 못했습니다. 잠시 후 다시 조회해주세요.':'역 이름에 해당하는 시간표가 없습니다. 정확한 역 이름과 호선을 확인해주세요.');
    return {station,line:selected.line,...calendar,day,directions:selected.directions,...(line==='auto'?{availableLines:found.map(item=>item.line)}:{}),lineLookupIncomplete:incomplete,updatedAt:new Date().toISOString()};
  }
  if (line === 'auto') {
    const results = await Promise.allSettled(['1','2','3'].map(candidate => {
      const lookup = new URLSearchParams(query); lookup.set('line', candidate);
      return metro(lookup, env, request);
    }));
    const schedules = results.filter(result => result.status === 'fulfilled').map(result => result.value);
    const failure = results.find(result => result.status === 'rejected' && result.reason.code !== 'NO_TIMETABLE');
    if (!schedules.length) {
      if (failure) throw failure.reason;
      throw new RouteError(404, 'NO_TIMETABLE', '역 이름에 해당하는 시간표가 없습니다. 정확한 역 이름과 운행 방향을 확인해주세요.');
    }
    return {...schedules[0], availableLines: schedules.map(schedule => schedule.line), lineLookupIncomplete: Boolean(failure)};
  }
  const params = new URLSearchParams({STT_NM: station, LINE_NO: line, SCHEDULE_METH: direction, SCHEDULE_TYPE: day});
  const key = params.toString(), previous = cache.get(key);
  if (request === fetch && previous && Date.now() - previous.at < 300000) return previous.data;
  const signal = AbortSignal.timeout(12000), url = `${ENDPOINT}?${params}`;
  async function read(headers = {}) {
    const response = await request(url, {headers: {Connection: 'close', ...headers}, signal, redirect: 'error'});
    if (!response.ok) throw new Error('upstream');
    const raw = await response.text();
    if (raw.length > 200000) throw new Error('oversized');
    return raw;
  }
  let raw;
  try {
    raw = await read();
    // The public endpoint asks clients to resend its confirmation cookie.
    // Read only the bounded token; never execute upstream JavaScript or follow arbitrary URLs.
    const token = raw.match(/document\.cookie\s*=\s*['"]sabSignature=([a-fA-F0-9]{32})['"]/);
    if (token && /sabFingerPrint/.test(raw)) raw = await read({Cookie: `sabSignature=${token[1]}; sabFingerPrint=1280,720,www.dtro.or.kr`});
  } catch { throw new RouteError(502, 'UPSTREAM_UNAVAILABLE', '지하철 시간표 서버에 연결하지 못했습니다. 잠시 후 다시 조회해주세요.'); }
  const data = normalizeMetro(raw, {station, line, direction, day});
  if (request === fetch) { if (cache.size >= 500) cache.clear(); cache.set(key, {at: Date.now(), data}); }
  return data;
}
module.exports = {metro, findSchedules, normalizeMetro};
