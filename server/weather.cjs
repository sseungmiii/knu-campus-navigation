const {RouteError}=require('./routing.cjs');
const ROOT='https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/';
const CAMPUS={name:'경북대 대구캠퍼스',nx:89,ny:91};
const HOUR=3600000;
function kstParts(at){const value=new Date(at+9*HOUR).toISOString();return {date:value.slice(0,10).replaceAll('-',''),hour:value.slice(11,13),minute:Number(value.slice(14,16))};}
function baseTime(kind,now=Date.now(),previous=false){
  let at;
  if(kind==='getVilageFcst'){
    const parts=kstParts(now-15*60000),hours=[2,5,8,11,14,17,20,23];
    let day=parts.date,hour=hours.filter(hour=>hour<=Number(parts.hour)).at(-1);
    if(hour===undefined){day=kstParts(now-24*HOUR).date;hour=23;}
    at=Date.parse(`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6,8)}T${String(hour).padStart(2,'0')}:00:00+09:00`)-(previous?3*HOUR:0);
  }else{
    const shift=kind==='getUltraSrtFcst'?45:15,parts=kstParts(now);
    at=now-(parts.minute<shift?HOUR:0)-(previous?HOUR:0);
  }
  const parts=kstParts(at);return {base_date:parts.date,base_time:parts.hour+(kind==='getUltraSrtFcst'?'30':'00')};
}
const number=(value,min,max)=>{if(value===undefined||value===null||String(value).trim()==='')return null;const result=Number(value);return Number.isFinite(result)&&result>=min&&result<=max?result:null;};
function iso(date,time){if(!/^\d{8}$/.test(date)||!/^\d{4}$/.test(time))return null;const at=Date.parse(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${time.slice(0,2)}:${time.slice(2)}:00+09:00`);return Number.isFinite(at)?new Date(at).toISOString():null;}
function normalizeWeather(observation,short,ultra,now=Date.now()){
  const values=Object.fromEntries(observation.map(item=>[item.category,item.obsrValue]));
  const observedAt=observation[0]&&iso(String(observation[0].baseDate),String(observation[0].baseTime).padStart(4,'0'));
  const current=observedAt&&number(values.T1H,-60,60)!==null?{at:observedAt,temperature:number(values.T1H,-60,60),humidity:number(values.REH,0,100),wind:number(values.WSD,0,100),precipitationType:number(values.PTY,0,7),rainfall:number(values.RN1,0,1000)}:null;
  const slots=new Map();
  for(const [items,near] of [[short,false],[ultra,true]])for(const item of items){
    const at=iso(String(item.fcstDate),String(item.fcstTime).padStart(4,'0'));if(!at)continue;
    const slot=slots.get(at)||{at,temperature:null,sky:null,precipitationType:null,probability:null,rainfall:null};
    const value=item.fcstValue;
    if(item.category===(near?'T1H':'TMP'))slot.temperature=number(value,-60,60);
    if(item.category==='SKY')slot.sky=number(value,1,4);
    if(item.category==='PTY')slot.precipitationType=number(value,0,7);
    if(item.category==='POP')slot.probability=number(value,0,100);
    if(item.category===(near?'RN1':'PCP'))slot.rainfall=String(value).slice(0,40);
    slots.set(at,slot);
  }
  const forecast=[...slots.values()].filter(slot=>slot.temperature!==null&&Date.parse(slot.at)>=now-HOUR).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  for(let i=0;i<forecast.length;i++){const gap=i+1<forecast.length?(Date.parse(forecast[i+1].at)-Date.parse(forecast[i].at))/HOUR: i?forecast[i-1].intervalHours:1;forecast[i].intervalHours=gap===3?3:1;}
  if(!current&&!forecast.length)throw new RouteError(502,'WEATHER_NO_DATA','기상청 날씨 자료가 아직 제공되지 않았습니다. 잠시 후 다시 확인해주세요.');
  return {location:CAMPUS,source:'기상청',updatedAt:new Date(now).toISOString(),current,forecast,stale:false,partial:!current||!short.length||!ultra.length};
}
function createWeatherService(){
  let cached=null,cachedAt=0,pending=null,retryAt=0;
  return async function weather(_query,env,request=fetch,now=Date.now()){
    if(!env.KMA_API_KEY)throw new RouteError(503,'WEATHER_NOT_CONFIGURED','날씨 연결을 준비 중입니다.');
    if(cached&&now-cachedAt<600000)return cached;
    if(now<retryAt){if(cached&&now-cachedAt<3600000)return {...cached,stale:true};throw new RouteError(502,'WEATHER_UPSTREAM','기상청 날씨 연결이 지연되고 있습니다. 1분 후 다시 확인해주세요.');}
    if(pending)return pending;
    const task=(async()=>{
      let key;try{key=decodeURIComponent(env.KMA_API_KEY.trim());}catch{throw new RouteError(503,'WEATHER_NOT_CONFIGURED','날씨 인증 설정을 확인 중입니다.');}
      async function page(kind,base,pageNo=1){
        const params=new URLSearchParams({...base,serviceKey:key,nx:String(CAMPUS.nx),ny:String(CAMPUS.ny),dataType:'JSON',numOfRows:'1000',pageNo:String(pageNo)});
        try{
          const response=await request(ROOT+kind+'?'+params,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();
          const text=await response.text();if(text.length>2000000)throw Error();const result=JSON.parse(text).response;
          if(String(result?.header?.resultCode)!=='00')throw Error();const body=result.body,items=body?.items?.item;
          return {items:Array.isArray(items)?items:items?[items]:[],total:Number(body?.totalCount)||0};
        }catch{throw new RouteError(502,'WEATHER_UPSTREAM','기상청 날씨를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.');}
      }
      async function load(kind){
        for(const previous of [false,true])try{const base=baseTime(kind,now,previous),first=await page(kind,base);if(!first.items.length)continue;if(first.total>1000){try{return [...first.items,...(await page(kind,base,2)).items];}catch{return first.items;}}return first.items;}catch{/* A previous publication may still be available. Never log credential-bearing URLs. */}
        return [];
      }
      const [observation,short,ultra]=await Promise.all(['getUltraSrtNcst','getVilageFcst','getUltraSrtFcst'].map(load));
      const fresh=normalizeWeather(observation,short,ultra,now);
      if(fresh.partial&&cached&&now-cachedAt<3600000){retryAt=now+60000;return {...cached,stale:true};}
      cached=fresh;cachedAt=now;return fresh;
    })();pending=task;
    try{return await task;}catch(error){retryAt=now+60000;if(cached&&now-cachedAt<3600000)return {...cached,stale:true};throw error;}finally{pending=null;}
  };
}
module.exports={weather:createWeatherService(),createWeatherService,baseTime,normalizeWeather};
