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
function transitMetrics(route) {
  const rides=route.steps.filter(step=>step.type!=='WALKING'),walking=route.steps.filter(step=>step.type==='WALKING');
  const hasBus=rides.some(step=>step.type==='BUS'),hasSubway=rides.some(step=>step.type==='SUBWAY');
  return {type:hasBus&&hasSubway?'BUS_AND_SUBWAY':hasBus?'BUS':hasSubway?'SUBWAY':'WALKING',
    transfers:Number.isInteger(route.transfers)&&route.transfers>=0?route.transfers:Math.max(0,rides.length-1),
    walkingSeconds:walking.reduce((sum,step)=>sum+step.duration,0),
    walkingDistance:route.connectionsComplete!==false&&walking.every(step=>Number.isFinite(step.distance)&&step.distance>=0)?walking.reduce((sum,step)=>sum+step.distance,0):null};
}
function transitCandidates(routes,type='ALL',sort='TRANSFERS') {
  const value=route=>{
    const metrics=transitMetrics(route),rank=Number.isInteger(route.providerRank)?route.providerRank:routes.indexOf(route);
    const walk=metrics.walkingDistance===null?Infinity:metrics.walkingDistance;
    return sort==='RECOMMENDED'?[rank]:sort==='TIME'?[route.duration,metrics.transfers,walk,rank]:sort==='WALK'?[walk,metrics.walkingSeconds,metrics.transfers,route.duration,rank]:[metrics.transfers,route.duration,walk,rank];
  };
  return routes.filter(route=>type==='ALL'||transitMetrics(route).type===type).slice().sort((a,b)=>{
    const left=value(a),right=value(b);for(let index=0;index<left.length;index++)if(left[index]!==right[index])return left[index]<right[index]?-1:1;return 0;
  });
}
function transitStepStyle(step) {
  if(step.type==='WALKING')return {color:'#eceff3',mapColor:'#929aa6',textColor:'#526075',label:'도보'};
  if(step.type==='SUBWAY'){
    const line=(step.vehicles||[]).join('/').match(/([123])호선/);
    const color=({'1':'#d93f40','2':'#28a647','3':'#ad7f00'})[line?.[1]]||'#7b3fc6';
    return {color,mapColor:color,textColor:'#fff',label:line?`${line[1]}호선`:'지하철'};
  }
  const type=step.vehicleDetails?.[0]?.type;
  const color=({간선:'#304b8e',지선:'#27845a',급행:'#d9434b',순환:'#198787'})[type]||'#304b8e';
  return {color,mapColor:color,textColor:'#fff',label:'버스'};
}
if(typeof module!=='undefined')module.exports={departurePlan,nextTrain,upcomingTrains,metroServiceDate,metroDirectionName,mealLocationQuery,busDeparture,transitMetrics,transitCandidates,transitStepStyle};
