function departurePlan(startAt,duration,buffer,indoor,now=Date.now()) {
  const start=Date.parse(startAt), total=Number(duration)+Number(buffer)*60+Number(indoor)*60;
  if(!Number.isFinite(start)||!Number.isFinite(total)||total<0||Number(buffer)<0||Number(buffer)>60||Number(indoor)<0||Number(indoor)>30)return null;
  const deadline=start-total*1000;
  return {deadline,remainingMinutes:Math.floor((deadline-now)/60000),arrival:now+total*1000};
}
function nextTrain(times,at=Date.now()) {
  return upcomingTrains(times.map(time=>({time})),at).map(train=>train.time);
}
// Early-morning trains belong to the previous service day (24:xx or 00:xx).
function metroServiceDate(at=Date.now()) {
  return new Date(at+9*3600000-3*3600000).toISOString().slice(0,10);
}
function metroDirectionName(line,direction) {
  return ({'1':{UP:'설화명곡',DOWN:'하양'},'2':{UP:'문양',DOWN:'영남대'},'3':{UP:'칠곡경대병원',DOWN:'용지'}}[line]||{})[direction]||'종착역';
}
function mealLocationQuery(name) {
  const normalized=String(name).replace(/\s|\([^)]*\)/g,'').toLowerCase();
  if(normalized==='정보센터식당')return '경북대학교 종합정보센터';
  if(['복지관교직원식당','카페테리아첨성'].includes(normalized))return '경북대학교 복지관';
  if(normalized==='gp감꽃식당')return '경북대학교 글로벌플라자';
  if(['공학관교직원식당','공학관학생식당'].includes(normalized))return '경북대학교 공대12호관';
  return `경북대학교 ${String(name).replace(/\(.*\)/,'').trim()}`;
}
function upcomingTrains(trains,at=Date.now(),serviceDate=metroServiceDate(at)) {
  const midnight=Date.parse(`${serviceDate}T00:00:00+09:00`);
  return trains.flatMap(train=>{
    const match=/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(train.time);
    if(!match||Number(match[1])>26)return [];
    const hour=Number(match[1]),seconds=(hour<3?hour+24:hour)*3600+Number(match[2])*60+Number(match[3]||0);
    const departureAt=midnight+seconds*1000;
    return departureAt>=at?[{...train,departureAt,remainingSeconds:Math.ceil((departureAt-at)/1000)}]:[];
  }).sort((a,b)=>a.departureAt-b.departureAt).slice(0,3);
}
function busDeparture(arrivals,vehicles,steps,busIndex,fetchedAt,now=Date.now()) {
  const fetched=Date.parse(fetchedAt);if(!Number.isFinite(fetched)||now-fetched>60000)return null;
  const approach=steps.slice(0,busIndex).reduce((n,s)=>n+s.duration,0),after=steps.slice(busIndex).reduce((n,s)=>n+s.duration,0);
  const bus=arrivals.filter(a=>vehicles.includes(a.route)&&Number.isFinite(a.seconds)&&fetched+a.seconds*1000>=now+(approach+60)*1000).sort((a,b)=>a.seconds-b.seconds)[0];
  return bus?{route:bus.route,deadline:fetched+(bus.seconds-approach-60)*1000,arrival:fetched+(bus.seconds+after)*1000}:null;
}
if(typeof module!=='undefined')module.exports={departurePlan,nextTrain,upcomingTrains,metroServiceDate,metroDirectionName,mealLocationQuery,busDeparture};
