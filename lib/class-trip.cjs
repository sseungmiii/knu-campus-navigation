function validateFavorite(value) {
  if(value===null)return null;
  const start=value?.start;
  if(!start||typeof start.name!=='string'||!start.name.trim()||start.name.length>150||!Array.isArray(start.coords)||start.coords.length!==2||!start.coords.every(Number.isFinite)||Math.abs(start.coords[0])>90||Math.abs(start.coords[1])>180)throw new Error('즐겨찾기 출발지를 확인해주세요.');
  if(!['walk','transit'].includes(value.mode)||!['BROAD_FIRST','SHORTEST','ACCESSIBLE'].includes(value.routeMode))throw new Error('이동 수단을 확인해주세요.');
  if(!Number.isFinite(value.duration)||value.duration<=0||value.duration>172800)throw new Error('경로를 먼저 조회해주세요.');
  if(typeof value.signature!=='string'||value.signature.length>500)throw new Error('경로 정보를 확인해주세요.');
  const bounded=(number,max)=>Number.isInteger(number)&&number>=0&&number<=max;
  if(!bounded(value.indoorMinutes,30)||!bounded(value.safetyMinutes,60))throw new Error('이동 여유 시간을 확인해주세요.');
  return {start:{name:start.name.trim(),coords:[...start.coords]},mode:value.mode,routeMode:value.routeMode,duration:value.duration,signature:value.signature,indoorMinutes:value.indoorMinutes,safetyMinutes:value.safetyMinutes};
}
function departureAt(classStart,route) {
  const at=Date.parse(classStart);if(!Number.isFinite(at)||!route)return null;
  return at-route.duration*1000-(route.indoorMinutes+route.safetyMinutes)*60000;
}
function calendarLayout(rows) {
  const result=[];
  for(let day=1;day<=5;day++){
    let cluster=[],ends=[],clusterEnd=-1;
    const flush=()=>{for(const item of cluster)result.push({...item,lanes:ends.length});cluster=[];ends=[];};
    for(const row of rows.filter(row=>row.weekday===day).sort((a,b)=>a.start_minute-b.start_minute||a.end_minute-b.end_minute)){
      if(row.start_minute>=clusterEnd){flush();clusterEnd=-1;}
      let lane=ends.findIndex(end=>end<=row.start_minute);if(lane<0)lane=ends.length;
      const displayEnd=row.display_end_minute??row.end_minute;ends[lane]=displayEnd;cluster.push({...row,lane});clusterEnd=Math.max(clusterEnd,displayEnd);
    }flush();
  }return result;
}
module.exports={validateFavorite,departureAt,calendarLayout};
