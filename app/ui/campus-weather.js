'use client';
import {useEffect,useState} from 'react';
import weatherUi from '../../lib/weather-ui.cjs';
const clock=value=>new Date(value).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false});
export default function CampusWeather({onData,hidden=false}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState(false),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let alive=true,controller=null;
    async function load(){
      controller?.abort();controller=new AbortController();const active=controller;setBusy(true);
      try{const response=await fetch('/api/weather',{cache:'no-store',signal:AbortSignal.any([active.signal,AbortSignal.timeout(28000)])});const result=await response.json().catch(()=>{throw Error('날씨 응답이 지연되고 있습니다. 잠시 후 다시 확인해주세요.');});if(!alive||active.signal.aborted||active!==controller)return;if(!response.ok)throw Error(result.error||'날씨를 불러오지 못했습니다.');setData(result);onData(result);setError('');}
      catch(reason){if(alive&&!active.signal.aborted&&active===controller){setError(reason.message==='Failed to fetch'?'날씨 연결이 잠시 지연되고 있습니다.':reason.name==='TimeoutError'?'날씨 조회가 지연되고 있습니다.':reason.message||'날씨를 불러오지 못했습니다.');onData({error:true});}}
      finally{if(alive&&active===controller)setBusy(false);}
    }
    load();const timer=setInterval(load,600000);return()=>{alive=false;controller?.abort();clearInterval(timer);};
  },[onData,refresh]);
  const current=data?.current,hours=data?.forecast?.filter(slot=>Date.parse(slot.at)+(slot.intervalHours||1)*3600000>Date.now()).slice(0,6)||[];
  const old=Boolean(error||data?.stale||(current&&Date.now()-Date.parse(current.at)>5400000));
  return <aside className="campus-weather" aria-label="경북대 날씨" hidden={hidden}><button className="weather-toggle" type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}><span className="weather-location">경북대 날씨{old?' · 자료 지연':''}</span><span className="weather-current"><span aria-hidden="true">{weatherUi.weatherIcon(current)}</span><strong>{current?`${current.temperature}°`:'—'}</strong><span>{current?weatherUi.precipitationName(current.precipitationType):busy?'불러오는 중':'관측 정보 없음'}</span></span><small>{current?`${clock(current.at)} 관측 · 습도 ${current.humidity??'—'}%`:'기상청 관측·예보'} <span aria-hidden="true">{expanded?'▴':'▾'}</span></small></button>
    {error&&<p role="status" className="weather-error">{error}</p>}
    {expanded&&<div className="weather-detail"><div className="weather-detail-heading"><strong>시간대별 예보</strong><button type="button" disabled={busy} onClick={()=>setRefresh(value=>value+1)} aria-label="날씨 새로고침">{busy?'조회 중':'새로고침'}</button></div>{hours.length?<ol className="weather-hours">{hours.map(slot=><li key={slot.at}><time dateTime={slot.at}>{clock(slot.at)}</time><span aria-hidden="true">{weatherUi.weatherIcon(slot)}</span><span>{slot.temperature}℃</span><small>{weatherUi.forecastName(slot)}</small><small>{slot.probability===null?'확률 미제공':`강수 ${slot.probability}%`}</small></li>)}</ol>:<p>예보 자료를 확인하지 못했습니다.</p>}
      {current&&<p>바람 {current.wind??'—'}m/s · 1시간 강수량 {current.rainfall??'—'}mm</p>}
      <p>{data?.stale?'최근 자료 표시 · 갱신 지연':data?.partial?'일부 자료 미제공 · 확인된 자료 표시':'10분마다 갱신'}{data?.updatedAt?` · ${clock(data.updatedAt)} 조회`:''}</p><a href="https://www.weather.go.kr/w/index.do" target="_blank" rel="noreferrer">기상청 날씨누리 ↗</a>
    </div>}
  </aside>;
}
export function ClassWeather({data,departure,classStart}){
  if(data?.error)return <p className="class-weather">날씨를 조회하지 못했습니다. 출발 전에 기상청 예보를 확인해주세요.</p>;
  const result=weatherUi.tripForecast(data,departure,classStart);if(!result)return <p className="class-weather">출발 시간대 날씨를 확인하고 있습니다.</p>;
  if(result.message)return <p className="class-weather">{result.message}</p>;
  return <p className={`class-weather${result.rain||result.probability>=40?' rainy':''}`}><strong>{departure===Date.parse(classStart)?'수업 시간대':'출발 시간대'} 날씨</strong> · {result.temperature}{result.probability!==null?` · 강수확률 최대 ${result.probability}%`:''}<br/>{result.advice}{result.coarse?' (3시간 단위 예보 포함)':''}{result.partial?' 강수확률 일부 미제공.':''}</p>;
}
