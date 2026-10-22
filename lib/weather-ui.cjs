const precipitationName=value=>({0:'강수 없음',1:'비',2:'비/눈',3:'눈',4:'소나기',5:'빗방울',6:'빗방울/눈날림',7:'눈날림'}[value]||'강수 정보 없음');
const forecastName=slot=>slot.precipitationType>0?precipitationName(slot.precipitationType):({1:'맑음',2:'맑음',3:'구름많음',4:'흐림'}[slot.sky]||'하늘 정보 없음');
const weatherIcon=slot=>[2,3,6,7].includes(slot?.precipitationType)?'🌨️':slot?.precipitationType>0?'☔':slot?.sky===1?'☀️':slot?.sky>=3?'☁️':'🌡️';
function tripForecast(data,departure,classStart,now=Date.now()){
  const from=departure,to=Date.parse(classStart);
  if(!data||!Number.isFinite(from)||!Number.isFinite(to))return null;
  const stale=Boolean(data.stale)||now-Date.parse(data.updatedAt)>1800000;
  if(stale)return {message:'날씨 자료가 오래되었습니다. 새로고침 후 출발 시간대 예보를 확인해주세요.',stale:true};
  const end=Math.max(from+60000,to),slots=(data.forecast||[]).filter(slot=>{const start=Date.parse(slot.at),until=start+(slot.intervalHours||1)*3600000;return start<end&&until>from;});
  if(!slots.length||Date.parse(slots[0].at)>from||Date.parse(slots.at(-1).at)+(slots.at(-1).intervalHours||1)*3600000<end)return {message:'이 수업 시간대의 예보는 아직 없습니다. 수업이 가까워지면 다시 확인해주세요.',unavailable:true};
  let covered=from;for(const slot of slots){const at=Date.parse(slot.at);if(at>covered)return {message:'출발 시간대 예보가 일부 비어 있습니다. 기상청 예보를 다시 확인해주세요.',unavailable:true};covered=Math.max(covered,at+(slot.intervalHours||1)*3600000);}
  const probabilities=slots.map(slot=>slot.probability).filter(Number.isFinite),probability=probabilities.length?Math.max(...probabilities):null;
  const rain=slots.some(slot=>slot.precipitationType>0),snow=slots.some(slot=>[2,3,6,7].includes(slot.precipitationType)),temperatures=slots.map(slot=>slot.temperature).filter(Number.isFinite);
  const unknown=slots.some(slot=>slot.precipitationType===null&&slot.probability===null);
  return {rain,snow,probability,temperature:temperatures.length?`${Math.min(...temperatures)}${Math.min(...temperatures)!==Math.max(...temperatures)?'~'+Math.max(...temperatures):''}℃`:null,advice:snow?'눈·진눈깨비 예보 · 미끄러운 길을 주의하세요.':rain||probability>=40?'비 가능성 · 우산을 챙기세요.':unknown?'일부 시간의 강수 정보를 확인하지 못했습니다.':'현재 예보상 비 가능성이 낮습니다.',coarse:slots.some(slot=>slot.intervalHours>1),partial:probabilities.length<slots.length};
}
module.exports={precipitationName,forecastName,weatherIcon,tripForecast};
