function validateClass(input) {
  if (!input || typeof input !== 'object') throw new Error('수업 내용을 입력해주세요.');
  const text = (key, max) => typeof input[key] === 'string' && input[key].trim().length > 0 && input[key].trim().length <= max;
  if (!text('title', 100) || !text('term', 60) || !text('place_name', 150)) throw new Error('수업명, 학기, 강의 장소를 확인해주세요.');
  if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 7) throw new Error('요일을 선택해주세요.');
  if (!Number.isInteger(input.start_minute) || !Number.isInteger(input.end_minute) || input.start_minute < 0 || input.end_minute > 1439 || input.start_minute >= input.end_minute) throw new Error('수업 종료 시각은 시작 시각보다 늦어야 합니다.');
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || Math.abs(input.latitude) > 90 || Math.abs(input.longitude) > 180) throw new Error('장소를 검색 결과에서 선택해주세요.');
  const date = key => /^\d{4}-\d{2}-\d{2}$/.test(input[key] || '') && !Number.isNaN(Date.parse(input[key])) && new Date(input[key]).toISOString().slice(0, 10) === input[key];
  if (!date('starts_on') || !date('ends_on') || input.starts_on > input.ends_on) throw new Error('학기 시작일과 종료일을 확인해주세요.');
  return Object.fromEntries(['title','term','weekday','start_minute','end_minute','place_name','latitude','longitude','starts_on','ends_on'].map(key => [key, typeof input[key] === 'string' ? input[key].trim() : input[key]]));
}
function koreaClock(now = new Date()) {
  const shifted = new Date(now.getTime() + 9 * 3600000);
  return {date: shifted.toISOString().slice(0, 10), weekday: shifted.getUTCDay() || 7, minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes()};
}
function todayClasses(classes, now = new Date()) {
  const clock = koreaClock(now);
  return classes.filter(row => row.weekday === clock.weekday && row.starts_on <= clock.date && row.ends_on >= clock.date).sort((a,b) => a.start_minute - b.start_minute || a.title.localeCompare(b.title));
}
function upcomingClass(classes, now = new Date()) { const {minute} = koreaClock(now); return todayClasses(classes, now).find(row => row.end_minute > minute) || null; }
function nextOccurrence(row,now=new Date()) {
  const clock=koreaClock(now), today=Date.parse(`${clock.date}T00:00:00+09:00`), semester=Date.parse(`${row.starts_on}T00:00:00+09:00`);
  const anchor=new Date(Math.max(today,semester)), weekday=koreaClock(anchor).weekday;
  let start=anchor.getTime()+((row.weekday-weekday+7)%7)*86400000+row.start_minute*60000;
  if(start+((row.end_minute-row.start_minute)*60000)<=now.getTime())start+=7*86400000;
  return koreaClock(new Date(start)).date<=row.ends_on?new Date(start).toISOString():null;
}
module.exports = {validateClass, koreaClock, todayClasses, upcomingClass, nextOccurrence};
