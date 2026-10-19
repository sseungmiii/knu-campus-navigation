const Holidays=require('date-holidays');
const {metroServiceDate}=require('../src/mobility-utils.js');
const holidays=new Holidays('KR');
// Newly designated holidays not yet included in date-holidays 3.37.0.
// Sources: MPM 2026-04-06 Labor Day notice; NEC ninth local-election calendar.
holidays.setHoliday('05-01 since 2026',{name:'노동절',type:'public'});
holidays.setHoliday('substitutes 05-01 if Saturday,Sunday then next Monday since 2026',{name:'노동절 (대체공휴일)',type:'public',substitute:true});
holidays.setHoliday('2026-06-03',{name:'전국동시지방선거',type:'public'});
const years=new Map();
function metroCalendar(at=Date.now()) {
  const serviceDate=metroServiceDate(at),year=Number(serviceDate.slice(0,4));
  if(!years.has(year)){
    if(years.size>=5)years.clear();
    years.set(year,holidays.getHolidays(year).filter(holiday=>holiday.type==='public').map(holiday=>{
      // Upstream's Seollal span starts on New Year's Day; Korea includes the eve.
      if(holiday.rule==='korean 01-0-01 P3D')return {...holiday,start:new Date(holiday.start.getTime()-86400000),end:new Date(holiday.end.getTime()-86400000)};
      return holiday;
    }));
  }
  // Compare instants so multi-day lunar holidays cover every day in their span.
  const noon=Date.parse(`${serviceDate}T12:00:00+09:00`);
  const holiday=years.get(year).find(item=>noon>=item.start.getTime()&&noon<item.end.getTime());
  const weekday=new Date(noon).getUTCDay();
  return {serviceDate,day:holiday||weekday===0?'HOLIDAY':weekday===6?'SAT':'WEEKDAY',holidayName:holiday?.name||null};
}
module.exports={metroCalendar};
