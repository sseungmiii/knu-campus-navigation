'use client';
import {useEffect,useState} from 'react';
import classTrip from '../../lib/class-trip.cjs';
const clock=at=>new Date(at).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false});
export default function ClassJourney({row,origin,route,classStart,onMode}){
  const [options,setOptions]=useState(()=>route?{[route.mode]:route}:{}),[errors,setErrors]=useState({}),[loading,setLoading]=useState('');
  useEffect(()=>{if(route)setOptions(previous=>({...previous,[route.mode]:route}));},[route]);
  const originKey=origin?origin.coords.join(','):'';
  useEffect(()=>{
    if(!origin)return;const controller=new AbortController(),mode=origin.mode==='transit'?'walk':'transit';setLoading(mode);setErrors({});
    fetch('/api/'+(mode==='walk'?'walk':'transit'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:{name:origin.name,coords:origin.coords},end:{name:row.place_name,coords:[row.latitude,row.longitude]},routeMode:'BROAD_FIRST'}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])}).then(async response=>{
      const data=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw Error(data.error||'이동 시간을 확인하지 못했습니다.');
      const best=mode==='walk'?data:[...(data.routes||[])].sort((a,b)=>(a.transfers??a.steps.filter(step=>step.type!=='WALKING').length-1)-(b.transfers??b.steps.filter(step=>step.type!=='WALKING').length-1)||a.duration-b.duration)[0];
      if(!best||!Number.isFinite(best.duration))throw Error('이동 시간을 확인하지 못했습니다.');
      setOptions(previous=>({...previous,[mode]:{duration:best.duration,mode,description:mode==='walk'?'캠퍼스까지 도보 이동':best.steps.filter(step=>step.type!=='WALKING').map(step=>(step.vehicles||[]).slice(0,2).join('/')).filter(Boolean).join(' → '),incomplete:best.connectionsComplete===false}}));
    }).catch(error=>{if(!controller.signal.aborted)setErrors(previous=>({...previous,[mode]:error.name==='TimeoutError'?'조회가 지연됩니다. 다시 선택해 확인하세요.':error.message}));}).finally(()=>{if(!controller.signal.aborted)setLoading('');});
    return()=>controller.abort();
  },[originKey,row.id]);
  const indoor=route?.indoorMinutes??3,safety=route?.safetyMinutes??5;
  return <section className="journey-compare" aria-label="수업 도착 기준 이동 방법 비교"><div className="journey-goal"><span className="live-dot" aria-hidden="true"/><strong>{clock(Date.parse(classStart)-safety*60000)}까지 강의실 도착</strong><small>수업 {safety}분 전 · 건물 내부 {indoor}분 포함</small></div><div className="journey-options">{[['walk','↗','도보'],['transit','▣','버스·지하철']].map(([mode,icon,label])=>{
    const option=options[mode],deadline=option&&classTrip.departureAt(classStart,{...option,indoorMinutes:indoor,safetyMinutes:safety}),late=deadline&&Date.now()>deadline;
    return <button type="button" key={mode} className={`journey-option${loading===mode&&!option?' skeleton':''}`} disabled={!origin||(!option&&!errors[mode])} aria-pressed={route?.mode===mode} onClick={()=>onMode(mode)}><span className="journey-mode">{icon} {label}</span>{option?<><strong>{clock(deadline)} <small>{late?'출발 마감 지남':'출발'}</small></strong><span>{Math.ceil(option.duration/60)}분 이동</span>{option.description&&<small>{option.description}</small>}{option.incomplete&&<small>일부 도보 연결 미확인</small>}</>:<span>{!origin?'출발 위치 확인 중':errors[mode]||'예상 시간을 비교하고 있어요'}</span>}</button>;
  })}</div><p>운행·대기 시간은 예상값입니다. 이동 방법을 누르면 지도에서 해당 경로를 안내합니다.</p></section>;
}
