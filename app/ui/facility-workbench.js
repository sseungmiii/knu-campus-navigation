'use client';
import {useEffect,useRef,useState} from 'react';
import registry from '../../src/campus-registry.js';
import local from '../../src/campus-local-store.js';
const blank={name:'',category:'vending',buildingId:'knu-it1',floor:'',room:'',hours:'',notes:'',coords:null,positionConfirmed:false};
export default function FacilityWorkbench({buildings}){
  const [form,setForm]=useState(blank),[rows,setRows]=useState([]),[message,setMessage]=useState(''),[loaded,setLoaded]=useState(false),[editing,setEditing]=useState(null),[storageError,setStorageError]=useState(''),[busy,setBusy]=useState(false);
  const mapFrame=useRef(null),fileInput=useRef(null);
  const knownBuildings=[...buildings,...rows.filter(row=>row.category==='building'&&row.coords&&row.positionConfirmed)];
  async function assertAdmin(signal){const response=await fetch('/api/admin/session',{method:'POST',cache:'no-store',signal});if(!response.ok){setLoaded(false);setStorageError('관리자 로그인이 만료되었습니다. 다시 로그인해주세요.');throw Error('관리자 로그인이 필요합니다.');}}
  async function logout(){setLoaded(false);try{const response=await fetch('/api/admin/logout',{method:'POST'});if(!response.ok)throw Error();location.assign('/admin/login');}catch{setMessage('로그아웃하지 못했습니다. 다시 시도해주세요.');}}
  useEffect(()=>{
    try{const saved=local.read(localStorage);setRows(saved.facilities);if(saved.form){const f=saved.form;setForm({...blank,...Object.fromEntries(Object.keys(blank).filter(key=>typeof blank[key]==='string'&&typeof f[key]==='string').map(key=>[key,f[key].slice(0,key==='notes'?1000:200)])),coords:registry.validPoint(f.coords)?f.coords:null,positionConfirmed:f.positionConfirmed===true&&registry.validPoint(f.coords)});}if(saved.form?.editingId&&saved.facilities.some(row=>row.id===saved.form.editingId))setEditing(saved.form.editingId);setLoaded(true);}catch{setStorageError('기기 저장 내용을 읽지 못했습니다. 브라우저 저장 공간을 확인해주세요.');}
    const receive=event=>{if(event.origin!==location.origin||event.source!==mapFrame.current?.contentWindow||event.data?.type!=='knu:facility-picked'||!registry.validPoint(event.data.coords))return;setForm(previous=>({...previous,coords:event.data.coords,positionConfirmed:false}));setMessage('지도 위치를 선택했습니다. 실제 시설 위치인지 확인해주세요.');};
    const sync=event=>{if(event.key!==local.KEY)return;try{setRows(local.read(localStorage).facilities);}catch{setStorageError('다른 창에서 변경한 내용을 읽지 못했습니다.');}};
    window.addEventListener('message',receive);window.addEventListener('storage',sync);return()=>{window.removeEventListener('message',receive);window.removeEventListener('storage',sync);};
  },[]);
  useEffect(()=>{if(!loaded)return;const controller=new AbortController(),timer=setTimeout(async()=>{try{await assertAdmin(controller.signal);if(controller.signal.aborted)return;local.write(localStorage,local.read(localStorage).facilities,{...form,editingId:editing});setStorageError('');}catch(error){if(error.name!=='AbortError')setStorageError('관리자 로그인 또는 기기 저장 공간을 확인해주세요.');}},500);return()=>{clearTimeout(timer);controller.abort();};},[form,loaded,editing]);
  const change=key=>event=>setForm(previous=>({...previous,[key]:event.target.value}));
  async function save(event){event.preventDefault();setBusy(true);try{
    await assertAdmin();
    if(!loaded)throw Error('기기 저장 공간을 먼저 확인해주세요.');
    if(!form.coords||!form.positionConfirmed)throw Error('지도에서 위치를 찍고 위치 확인에 체크해주세요.');
    const building=knownBuildings.find(item=>item.id===form.buildingId);if(!building&&form.buildingId!=='campus-common')throw Error('건물을 선택해주세요.');
    const row=local.validate({...form,id:editing||'local-'+crypto.randomUUID(),building:building?.name||'경북대학교 교내 공용 공간'});
    const updated=local.merge(local.read(localStorage).facilities,[row]);local.write(localStorage,updated,blank);setRows(updated);setForm(blank);setEditing(null);setMessage('이 기기에 저장했습니다. 지도 검색과 분류별 핀에서 확인할 수 있습니다.');
  }catch(error){setMessage(error.message);}finally{setBusy(false);}}
  function edit(row){setEditing(row.id);setForm({...blank,...row});setMessage('시설 정보를 수정한 뒤 저장해주세요.');window.scrollTo({top:0,behavior:'smooth'});}
  async function remove(row){setBusy(true);try{await assertAdmin();const updated=local.read(localStorage).facilities.filter(item=>item.id!==row.id);local.write(localStorage,updated,editing===row.id?blank:form);setRows(updated);if(editing===row.id){setEditing(null);setForm(blank);}setMessage('이 기기에서 시설을 삭제했습니다.');}catch(error){setMessage(error.message||'삭제 내용을 저장하지 못했습니다.');}finally{setBusy(false);}}
  async function download(){try{await assertAdmin();const blob=new Blob([JSON.stringify({version:2,status:'draft',exportedAt:new Date().toISOString(),facilities:rows},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='knupass-campus-facilities.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('시설 파일을 내보냈습니다. 다른 기기에서는 파일 불러오기로 이어서 편집할 수 있습니다.');}catch(error){setMessage(error.message);}}
  async function importFile(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);try{await assertAdmin();if(file.size>1024*1024)throw Error('1MB 이하 시설 JSON 파일을 선택해주세요.');const incoming=local.parse(await file.text());if(incoming.facilities.some(row=>row.buildingId!=='campus-common'&&!knownBuildings.concat(incoming.facilities.filter(item=>item.category==='building')).some(building=>building.id===row.buildingId)))throw Error('등록되지 않은 건물이 포함돼 있습니다.');const updated=local.merge(local.read(localStorage).facilities,incoming.facilities);local.write(localStorage,updated,form);setRows(updated);setMessage('시설 파일을 불러와 이 기기에 저장했습니다. 같은 식별자의 시설은 파일 내용으로 갱신됩니다.');}catch(error){setMessage(error.message||'시설 파일을 불러오지 못했습니다.');}finally{setBusy(false);}}
  return <main className="facility-workbench">
    <div className="admin-workbench-header"><a href="/">← 지도로</a><button onClick={logout}>관리자 로그아웃</button></div><span className="eyebrow">CAMPUS ADMIN</span><h1>시설 등록 작업실</h1>
    <p>지도에서 시설 위치를 찍고 이름·종류·건물을 입력하세요. 저장한 시설은 이 브라우저에서 검색하고 길찾기에 사용할 수 있습니다. 다른 사용자에게는 공개되지 않으며, 브라우저 데이터를 지우면 사라지므로 파일로도 보관해주세요.</p>
    <aside><strong>건물 내부 지도는 아직 지원하지 않는 기능입니다.</strong><br/>현재 길찾기는 직접 지정한 지도 좌표까지 안내합니다. 층·호실은 설명으로 표시하며 강의실 문까지 실내 경로를 계산하지 않습니다.</aside>
    <p role="status" className={storageError?'facility-storage-error':''}>{storageError||(!loaded?'기기 저장 내용을 불러오는 중…':'입력한 내용과 저장 시설은 이 기기에 자동 보관됩니다.')}</p>
    <form className="schedule-form" onSubmit={save}><fieldset disabled={!loaded||busy}>
      <label>시설명<input required maxLength={100} value={form.name} onChange={change('name')} placeholder="예: IT1호관 3층 정수기"/></label>
      <div className="form-pair"><label>종류<select value={form.category} onChange={change('category')}>{Object.entries(registry.categories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>건물<select value={form.buildingId} onChange={change('buildingId')}><option value="campus-common">교내 공용 공간</option>{knownBuildings.map(building=><option key={building.id} value={building.id}>{building.name}</option>)}</select></label></div>
      <div className="form-pair"><label>층<input maxLength={80} placeholder="확인한 경우에만 입력" value={form.floor} onChange={change('floor')}/></label><label>호실·상세 위치<input maxLength={80} value={form.room} onChange={change('room')}/></label></div>
      <label>운영시간<input maxLength={200} value={form.hours} onChange={change('hours')} placeholder="미입력 시 운영시간 미확인"/></label><label>이용 조건·위치 설명<textarea maxLength={1000} value={form.notes} onChange={change('notes')}/></label>
      <h2>지도에 위치 찍기</h2><p>지도를 확대해서 실제 시설 위치를 누르세요. 실내 시설은 건물 위치를 찍고 층·호실을 적어주세요.</p>
      <iframe ref={mapFrame} className="facility-location-map" title="시설 위치 선택 지도" src="/map/index.html?shell=1&facilityPicker=1"/>
      <p>{form.coords?'선택 위치: '+form.coords[0].toFixed(6)+', '+form.coords[1].toFixed(6):'아직 위치를 선택하지 않았습니다.'}</p>
      <label className="facility-position-confirm"><input type="checkbox" checked={form.positionConfirmed} disabled={!form.coords} onChange={event=>setForm(previous=>({...previous,positionConfirmed:event.target.checked}))}/>시설 위치를 직접 확인했습니다</label>
      <button className="accent" type="submit">{editing?'시설 수정 저장':'시설 저장 · 지도에 표시'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setForm(blank);}}>수정 취소</button>}
    </fieldset></form><p role="status">{message}</p>
    {!loaded&&<a href="/admin/login">관리자 다시 로그인</a>}<section><h2>이 기기에 저장한 시설 {rows.length}개</h2><div className="facility-file-actions"><button disabled={!rows.length||!loaded||busy} onClick={download}>시설 파일 내보내기</button><button disabled={!loaded||busy} onClick={()=>fileInput.current?.click()}>시설 파일 불러오기</button><input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={importFile}/></div>
      {rows.map(row=><article className="class-card" key={row.id}><h3>{row.name}</h3><p>{registry.categories[row.category]} · {row.building} · {row.floor||'층 미입력'} · {row.room||'상세 위치 미입력'}</p><p>{row.coords&&row.positionConfirmed?'지도 표시 가능':'지도 위치 확인 필요'} · {row.hours||'운영시간 미확인'}</p><button disabled={!loaded||busy} onClick={()=>edit(row)}>수정</button><button disabled={!loaded||busy} onClick={()=>remove(row)}>삭제</button></article>)}
    </section>
  </main>;
}
