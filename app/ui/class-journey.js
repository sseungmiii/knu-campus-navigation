'use client';
import classTrip from '../../lib/class-trip.cjs';
const clock=at=>new Date(at).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false});
export default function ClassJourney({origin,route,classStart,onMode,options={},loading,status}){
 const indoor=route?.indoorMinutes??3,safety=route?.safetyMinutes??5;
 return <section className="journey-compare" aria-label="수업 도착 기준 이동 방법 비교"><div className="journey-goal"><strong>{clock(Date.parse(classStart)-safety*60000)}까지 강의실 도착</strong><small>여유 {safety}분 · 건물 내부 {indoor}분</small></div><div className="journey-options">{[['walk','도보'],['transit','버스·지하철']].map(([mode,label])=>{const option=route?.mode===mode?route:options[mode],deadline=option&&classTrip.departureAt(classStart,{...option,indoorMinutes:indoor,safetyMinutes:safety});return <button key={mode} type="button" className="journey-option" disabled={!origin} aria-pressed={route?.mode===mode} onClick={()=>onMode(mode)}><span>{label}</span>{option?<><strong>{clock(deadline)} 출발</strong><span>{Math.ceil(option.duration/60)}분 이동</span>{option.incomplete&&<small>일부 도보 연결 미확인</small>}</>:<span>{!origin?'출발지를 선택해주세요':loading?'경로 확인 중…':'선택해서 경로 조회'}</span>}</button>;})}</div><p role="status">{status||'지도와 같은 경로 결과를 사용합니다. 운행·대기 시간은 예상값입니다.'}</p></section>;
}
