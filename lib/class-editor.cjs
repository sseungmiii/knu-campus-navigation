const MINUTES = Array.from({length:12},(_,i)=>String(i*5).padStart(2,'0'));
const HOURS = Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
const toMinutes = value => Number(value.split(':')[0])*60+Number(value.split(':')[1]);
const toTime = value => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
function defaultEnd(start) { return toTime(Math.min(toMinutes(start)+75,1435)); }
function snapTime(minute) { return toTime(Math.min(Math.round(minute/5)*5,1435)); }
function secondMeeting(first) { const day=Number(first.weekday);return {weekday:day<=3?day+2:day<=5?day-2:day-5,start:first.start,end:first.end}; }
module.exports={MINUTES,HOURS,toMinutes,defaultEnd,snapTime,secondMeeting};
