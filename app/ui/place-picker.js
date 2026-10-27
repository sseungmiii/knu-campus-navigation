'use client';
import {useEffect,useRef,useState} from 'react';
export default function PlacePicker({value,onChange,label='강의 건물',disabled=false}){
  const [query,setQuery]=useState(value?.name||''),[results,setResults]=useState([]),[status,setStatus]=useState('');const generation=useRef(0);
  useEffect(()=>{if(value?.name)setQuery(value.name);},[value?.name]);
  useEffect(()=>()=>{generation.current++;},[]);
  async function search(){const id=++generation.current;if(!query.trim())return;setStatus('검색 중…');setResults([]);try{const response=await fetch('/api/search?q='+encodeURIComponent(query.trim()),{signal:AbortSignal.timeout(15000)}),data=await response.json();if(id!==generation.current)return;if(!response.ok)throw Error(data.error);setResults(data.places);setStatus(data.places.length?'검색 결과에서 선택해주세요.':'검색 결과가 없습니다.');}catch(error){if(id===generation.current)setStatus(error.message||'검색하지 못했습니다.');}}
  return <div className="shared-place-picker"><label>{label}<div className="place-search"><input disabled={disabled} value={query} maxLength={100} onChange={event=>{generation.current++;setQuery(event.target.value);setResults([]);onChange(null);}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();search();}}}/><button type="button" disabled={disabled} onClick={search}>검색</button></div></label><small role="status">{status}</small>{results.map(place=><button className="place-option" type="button" key={place.id} onClick={()=>{generation.current++;onChange(place);setQuery(place.name);setResults([]);setStatus('선택됨');}}>{place.name}<small>{place.address}</small></button>)}</div>;
}
