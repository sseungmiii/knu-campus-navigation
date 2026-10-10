function departurePlan(startAt,duration,buffer,indoor,now=Date.now()) {
  const start=Date.parse(startAt), total=Number(duration)+Number(buffer)*60+Number(indoor)*60;
  if(!Number.isFinite(start)||!Number.isFinite(total)||total<0||Number(buffer)<0||Number(buffer)>60||Number(indoor)<0||Number(indoor)>30)return null;
  const deadline=start-total*1000;
  return {deadline,remainingMinutes:Math.floor((deadline-now)/60000),arrival:now+total*1000};
}
function nextTrain(times,at=Date.now()) {
  const date=new Date(at+9*3600000),minute=date.getUTCHours()*60+date.getUTCMinutes();
  return times.map(t=>({time:t,minute:Number(t.split(':')[0])*60+Number(t.split(':')[1])})).filter(t=>t.minute>=minute).sort((a,b)=>a.minute-b.minute).slice(0,3).map(t=>t.time);
}
function busDeparture(arrivals,vehicles,steps,busIndex,fetchedAt,now=Date.now()) {
  const fetched=Date.parse(fetchedAt);if(!Number.isFinite(fetched)||now-fetched>60000)return null;
  const approach=steps.slice(0,busIndex).reduce((n,s)=>n+s.duration,0),after=steps.slice(busIndex).reduce((n,s)=>n+s.duration,0);
  const bus=arrivals.filter(a=>vehicles.includes(a.route)&&Number.isFinite(a.seconds)&&fetched+a.seconds*1000>=now+(approach+60)*1000).sort((a,b)=>a.seconds-b.seconds)[0];
  return bus?{route:bus.route,deadline:fetched+(bus.seconds-approach-60)*1000,arrival:fetched+(bus.seconds+after)*1000}:null;
}
if(typeof module!=='undefined')module.exports={departurePlan,nextTrain,busDeparture};
