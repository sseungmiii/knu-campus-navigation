'use client';
import {useEffect, useMemo, useRef, useState} from 'react';
import {createClient} from '../../lib/supabase/client';
import timetable from '../../lib/timetable.cjs';
import auth from '../../lib/auth.cjs';
import classEditor from '../../lib/class-editor.cjs';
import classTrip from '../../lib/class-trip.cjs';
import WeekCalendar from './week-calendar';
import CampusWeather,{ClassWeather} from './campus-weather';
import TimetableImport from './timetable-import';
import courseGroups from '../../lib/course-groups.cjs';
import CourseManager from './course-manager';
import ClassJourney from './class-journey';
const days = ['월', '화', '수', '목', '금', '토', '일'];
const time = minute => `${String(Math.floor(minute / 60)).padStart(2,'0')}:${String(minute % 60).padStart(2,'0')}`;
const minutes = value => Number(value.split(':')[0]) * 60 + Number(value.split(':')[1]);
function emptyForm() {
  const {date} = timetable.koreaClock(); const year = date.slice(0,4), second = Number(date.slice(5,7)) >= 7;
  return {title: '',room:'',professor:'',term: `${year}년 ${second ? 2 : 1}학기`, weekday: timetable.koreaClock().weekday, start: '09:00', end: '10:15', starts_on: `${year}-${second ? '08-01' : '03-01'}`, ends_on: `${year}-${second ? '12-31' : '06-30'}`};
}
function TimePicker({label,value,onChange}) {
  const [hour,minute]=value.split(':');
  return <div className="time-picker" role="group" aria-label={label}><span>{label}</span><div className="time-parts">
    <select aria-label={`${label} 시`} value={hour} onChange={event=>onChange(`${event.target.value}:${minute}`)}>{classEditor.HOURS.map(item=><option key={item} value={item}>{item}시</option>)}</select>
    <select aria-label={`${label} 분`} value={minute} onChange={event=>onChange(`${hour}:${event.target.value}`)}>{classEditor.MINUTES.map(item=><option key={item} value={item}>{item}분</option>)}</select>
  </div></div>;
}
export default function CampusShell({supabaseConfig}) {
  const supabase = useMemo(() => supabaseConfig ? createClient(supabaseConfig) : null, [supabaseConfig]);
  const frame = useRef(null), dialog = useRef(null), editorSection=useRef(null), searchGeneration = useRef(0), userRef = useRef(null);
  const [open, setOpen] = useState(false), [ready, setReady] = useState(false), [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase)), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const [classes, setClasses] = useState([]), [allowed, setAllowed] = useState(false), [now, setNow] = useState(null);
  const [weekday, setWeekday] = useState(1), [form, setForm] = useState(emptyForm), [editing, setEditing] = useState(null);
  const [placeQuery, setPlaceQuery] = useState(''), [place, setPlace] = useState(null), [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false), [deleteId, setDeleteId] = useState(null), [refreshIndex, setRefreshIndex] = useState(0);
  const [authMode,setAuthMode]=useState('login');
  const [second,setSecond]=useState(null);
  const [weather,setWeather]=useState(null);
  const [mapPanelOpen,setMapPanelOpen]=useState(false);
  const [importOpen,setImportOpen]=useState(false);
  const [shellTab,setShellTab]=useState('map');
  const [manageAll,setManageAll]=useState(true);
  const selectShellTab=tab=>{setShellTab(tab);setOpen(tab==='schedule');if(tab!=='schedule')frame.current?.contentWindow?.postMessage({type:'knu:shell-tab',tab},location.origin);};
  const [calendarTerm,setCalendarTerm]=useState(''),[trip,setTrip]=useState(null);
  const tripRef=useRef(null);tripRef.current=trip;
  const terms=[...new Set(classes.map(row=>row.term))];
  const visibleTerm=calendarTerm&&terms.includes(calendarTerm)?calendarTerm:classes.find(row=>now&&row.starts_on<=timetable.koreaClock(now).date&&row.ends_on>=timetable.koreaClock(now).date)?.term||terms[0]||'';
  userRef.current = user;
  const next = now ? timetable.upcomingClass(classes, now) : null;
  useEffect(() => {
    setNow(new Date()); setWeekday(timetable.koreaClock().weekday);
    const params=new URLSearchParams(location.search),result=params.get('auth');
    if(result){setOpen(true);setStatus(result==='confirmed'?'이메일 인증을 완료했습니다. 시간표를 이용하려면 로그인해주세요.':'인증 링크가 만료되었거나 확인하지 못했습니다. 가입한 브라우저에서 링크를 열거나 인증 메일을 다시 받아주세요.');params.delete('auth');history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);}
    const timer = setInterval(() => setNow(new Date()), 30000);
    const receive = event => {
      if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;
      if(event.data?.type==='knu:shell-map'){setShellTab('map');setOpen(false);return;}
      if(event.data?.type==='knu:map-ready'){setReady(true);return;}
      if(event.data?.type==='knu:map-panel'&&typeof event.data.open==='boolean'){setMapPanelOpen(event.data.open);return;}
      const active=tripRef.current;if(!active||event.data?.classId!==active.row.id)return;
      if(event.data.type==='knu:class-origin-clear')setTrip(previous=>previous&&({...previous,origin:null,route:null,estimate:false}));
      if(event.data.type==='knu:class-origin'){
        const start=event.data.start,end=event.data.end;
        if(!Array.isArray(start?.coords)||start.coords.length!==2||!start.coords.every(Number.isFinite)||Math.abs(start.coords[0])>90||Math.abs(start.coords[1])>180||typeof start.name!=='string'||!['walk','transit'].includes(event.data.mode)||!Array.isArray(end)||end.length!==2||!end.every(Number.isFinite)||Math.abs(end[0]-active.row.latitude)>.0001||Math.abs(end[1]-active.row.longitude)>.0001)return;
        setTrip(previous=>previous&&({...previous,route:previous.origin&&previous.origin.coords.join(',')!==start.coords.join(',')?null:previous.route,origin:{name:start.name.slice(0,150),coords:start.coords,mode:event.data.mode}}));
      }
      if(event.data.type==='knu:route-pending')setTrip(previous=>previous&&({...previous,route:previous.estimate?previous.route:null,loading:true}));
      if(event.data.type==='knu:trip-status'&&typeof event.data.status==='string')setTrip(previous=>previous&&({...previous,status:event.data.status.slice(0,500),loading:!event.data.error&&previous.loading}));
      if(event.data.type==='knu:class-route'){
        const end=event.data.end;
        if(!Array.isArray(end)||end.length!==2||!end.every(Number.isFinite)||Math.abs(end[0]-active.row.latitude)>.0001||Math.abs(end[1]-active.row.longitude)>.0001)return;
        try{const route=classTrip.validateFavorite(event.data.route);if(route)setTrip(previous=>previous&&({...previous,route:{...route,incomplete:event.data.incomplete===true},loading:false,estimate:false,status:'경로를 조회했습니다. 이동 안내는 지도에서 확인하세요.'}));}catch{/* Ignore invalid map messages. */}
      }
    };
    window.addEventListener('message', receive);
    return () => {clearInterval(timer); window.removeEventListener('message', receive);};
  }, []);
  useEffect(() => {
    if (open) dialog.current.show(); else if (dialog.current.open) dialog.current.close();
  }, [open]);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getUser().then(({data}) => { if (alive) {setUser(data.user || null); setAuthLoading(false);} }).catch(()=>{if(alive){setAuthLoading(false);setStatus('로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');}});
    const {data: listener} = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) {
        if (session?.user?.id !== userRef.current?.id) {setClasses([]); setAllowed(false);}
        setUser(session?.user || null); setAuthLoading(false);
      }
    });
    return () => {alive = false; listener.subscription.unsubscribe();};
  }, [supabase]);
  useEffect(() => {
    setClasses([]); setAllowed(false); setTrip(null);setImportOpen(false); setEditing(null); setForm(emptyForm()); setSecond(null); setPlace(null); setPlaceQuery(''); setResults([]); setDeleteId(null); setSearching(false); searchGeneration.current++;
    if (!user) return;
    const controller = new AbortController();
    setStatus('시간표를 불러오는 중…');
    fetch('/api/timetable', {cache: 'no-store', signal: controller.signal}).then(async response => {
      const data = await response.json(); if (controller.signal.aborted) return;
      if (!response.ok) {setStatus(data.error || '시간표를 불러오지 못했습니다.'); return;}
      setAllowed(true); setClasses(data.classes); setStatus('');
    }).catch(() => {if (!controller.signal.aborted) setStatus('시간표 서버에 연결하지 못했습니다.');});
    return () => controller.abort();
  }, [user?.id, refreshIndex]);
  async function login(event) {
    event.preventDefault(); if (!supabase || busy) return;
    const data = new FormData(event.currentTarget); setBusy(true); setStatus('로그인 중…');
    try {
      const {error} = await supabase.auth.signInWithPassword({email: auth.loginEmail(data.get('identifier')), password: String(data.get('password'))});
      if (error) setStatus('로그인하지 못했습니다. 아이디와 비밀번호를 확인해주세요.');
      else setStatus('시간표 접근 권한을 확인 중…');
    } catch {setStatus('로그인 서버에 연결하지 못했습니다.');} finally {setBusy(false);}
  }
  async function signup(event) {
    event.preventDefault();if(!supabase||busy)return;
    const formElement=event.currentTarget,values=new FormData(formElement);let credentials;
    try{credentials=auth.validateSignup({identifier:values.get('identifier'),password:values.get('password'),confirmation:values.get('confirmation')});}catch(error){setStatus(error.message);return;}
    setBusy(true);setStatus('가입 요청 중…');
    try{
      const {data,error}=await supabase.auth.signUp(credentials);
      if(error){setStatus(auth.authErrorMessage(error));return;}
      formElement.reset();
      if(data.session){setStatus('가입되었습니다. 시간표 이용 권한을 확인합니다.');}
      else{setAuthMode('login');setStatus('가입되었습니다. 아이디와 비밀번호로 로그인해주세요.');}
    }catch{setStatus('회원가입 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');}finally{setBusy(false);}
  }
  async function logout() {
    setBusy(true); const {error} = await supabase.auth.signOut({scope:'local'});
    if (error) setStatus('로그아웃하지 못했습니다. 다시 시도해주세요.');
    else {setUser(null); setClasses([]); setAllowed(false); setStatus('');}
    setBusy(false);
  }
  function edit(row) {
    searchGeneration.current++; setResults([]); setSearching(false); setDeleteId(null);
    setEditing(row?.id || null); setSecond(null); setForm(row ? {...row, start: classEditor.snapTime(row.start_minute), end: classEditor.snapTime(row.end_minute)} : emptyForm());
    setPlace(row ? {name: row.place_name, coords: [row.latitude,row.longitude]} : null); setPlaceQuery(row?.place_name || '');if(row)editorSection.current?.scrollIntoView({block:'start',behavior:'smooth'});
  }
  async function searchPlace() {
    const generation = ++searchGeneration.current;
    if (!placeQuery.trim()) {setStatus('강의 장소 검색어를 입력해주세요.'); return;}
    setSearching(true); setResults([]);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(placeQuery.trim())}`, {signal: AbortSignal.timeout(15000)});
      const data = await response.json(); if (generation !== searchGeneration.current) return;
      if (!response.ok) {setStatus(data.error || '검색하지 못했습니다.'); return;}
      setResults(data.places); setStatus(data.places.length ? '검색 결과에서 강의 장소를 선택해주세요.' : '장소를 찾지 못했습니다.');
    } catch {if (generation === searchGeneration.current) setStatus('장소 검색에 연결하지 못했습니다.');}
    finally {if (generation === searchGeneration.current) setSearching(false);}
  }
  async function mutate(method, input) {
    const currentUser = user?.id; setBusy(true); setStatus('저장 중…');
    try {
      const response = await fetch('/api/timetable', {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input)});
      const data = await response.json(); if (userRef.current?.id !== currentUser) return;
      if (!response.ok) {setStatus(data.error || '변경하지 못했습니다.');if(method==='PUT')setTrip(previous=>previous&&({...previous,status:data.error||'즐겨찾기를 저장하지 못했습니다.'}));return;}
      const saved=data.classes || (data.class ? [data.class] : []);
      setClasses(previous => method === 'DELETE' ? previous.filter(row => !(input.ids||[input.id]).includes(row.id)) : [...previous.filter(row => !saved.some(item=>item.id===row.id)), ...saved]);
      if(method==='DELETE')setTrip(previous=>previous&&(input.ids||[input.id]).includes(previous.row.id)?null:previous);
      if(method==='PATCH')setTrip(previous=>previous&&saved.some(row=>row.id===previous.row.id)?null:previous);
      if(method==='PUT'){setStatus('즐겨찾기를 변경했습니다.');setTrip(previous=>previous&&({...previous,row:saved[0],status:input.favorite_route?'즐겨찾기에 저장했습니다. 다음에는 수업을 누르면 이 출발지와 이동 수단을 사용합니다.':'즐겨찾기 경로를 해제했습니다.'}));return;}
      if(saved.length){setWeekday(saved[0].weekday);setCalendarTerm(saved[0].term);}
      edit(null); setStatus(method === 'DELETE' ? '수업을 삭제했습니다.' : `${saved.length>2?saved.length+'개 수업을':saved.length===2?'주 2회 수업을':'수업을'} 저장했습니다.`);dialog.current?.scrollTo({top:0});return data;
    } catch {if (userRef.current?.id === currentUser) {setStatus('시간표 서버에 연결하지 못했습니다.');if(method==='PUT')setTrip(previous=>previous&&({...previous,status:'즐겨찾기를 저장하지 못했습니다. 연결을 확인한 뒤 다시 시도해주세요.'}));}}
    finally {setBusy(false);}
  }
  function save(event) {
    event.preventDefault(); if (!place) {setStatus('강의 장소를 검색 결과에서 선택해주세요.');dialog.current?.scrollTo({top:0}); return;}
    try {
      const input = timetable.validateClass({...form, weekday: Number(form.weekday), start_minute: minutes(form.start), end_minute: minutes(form.end),display_end_minute:Math.min(1439,minutes(form.end)+15),place_name: place.name, latitude: place.coords[0], longitude: place.coords[1]});
      if(editing) mutate('PATCH',{...input,id:editing});
      else {
        const meetings=[{weekday:input.weekday,start_minute:input.start_minute,end_minute:input.end_minute,display_end_minute:input.display_end_minute},...(second?[{weekday:Number(second.weekday),start_minute:minutes(second.start),end_minute:minutes(second.end),display_end_minute:Math.min(1439,minutes(second.end)+15)}]:[])];
        const payload={...input,meetings};timetable.validateClassMeetings(payload);mutate('POST',payload);
      }
    } catch (error) {setStatus(error.message);dialog.current?.scrollTo({top:0});}
  }
  function navigate(row) {
    if (!ready) return;
    const classStart=timetable.nextOccurrence(row);
    if(!classStart){setStatus('학기 기간이 지난 수업입니다. 학기 날짜를 수정해주세요.');return;}
    let favorite=null;try{if(row.favorite_route)favorite=classTrip.validateFavorite(row.favorite_route);}catch{/* Old or invalid preference: request a fresh route. */}
    const active={row,classStart,route:favorite,estimate:Boolean(favorite),loading:true,status:favorite?'저장된 출발지에서 즐겨찾기 경로를 다시 조회합니다.':'현재 위치를 확인해 출발 시각을 계산합니다. 위치 사용이 어려우면 지도에서 출발지를 검색해주세요.'};setTrip(active);tripRef.current=active;
    frame.current.contentWindow.postMessage({type:'knu:destination',classId:row.id,place:{name:row.place_name,coords:[row.latitude,row.longitude]},course:row.title,classStart,favorite,useCurrentLocation:!favorite},location.origin);
    setOpen(false);setShellTab('map');
  }
  const change = key => event => setForm(previous => ({...previous, [key]: event.target.value}));
  const changeTime = (key,value,extra=false) => {
    const update=previous=>({...previous,[key]:value,...(key==='start'?{end:classEditor.defaultEnd(value)}:{})});
    if(extra)setSecond(update);else setForm(update);
  };
  return <main className="campus-shell">
    <header className="account-bar">
      <div className="next-class"><strong>{next ? `다음 수업 · ${next.title}` : '수업까지, 한 걸음 여유롭게.'}</strong><span>{next ? `${time(next.start_minute)} · ${next.place_name}${next.room?' '+next.room+'호':''}` : '사진으로 시간표를 가져오고, 내 수업까지 바로 출발하세요.'}</span></div>
      {next && <button disabled={!ready} onClick={() => navigate(next)}>수업으로 길찾기</button>}
      <button className="accent" onClick={() => selectShellTab('schedule')}>{user ? '내 시간표' : '로그인 · 회원가입'}</button>
    </header>
    {!open&&shellTab==='map'&&trip&&<section className="map-class-summary" aria-label="수업 이동 핵심 정보"><button type="button" onClick={()=>selectShellTab('schedule')}><strong>{trip.row.title}</strong><span>{trip.route?new Date(classTrip.departureAt(trip.classStart,trip.route)).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false})+'까지 출발 · '+Math.ceil(trip.route.duration/60)+'분 이동':time(trip.row.start_minute)+' 수업 · 출발지를 선택해주세요'}</span></button><button type="button" aria-label="수업 안내 접기" onClick={()=>setTrip(null)}>×</button></section>}
    <iframe ref={frame} className="campus-map" src="/map/index.html?shell=1" style={{visibility:open?'hidden':'visible'}} aria-hidden={open} inert={open} title="카카오 캠퍼스 도보 길찾기" onLoad={() => {setReady(false); frame.current?.contentWindow?.postMessage({type:'knu:ping'}, location.origin);}} />
    <CampusWeather onData={setWeather} hidden={open||mapPanelOpen||Boolean(trip)}/>
    <dialog ref={dialog} className="timetable-dialog schedule-page" onCancel={() => selectShellTab('map')} onClose={() => {setOpen(false);setShellTab(previous=>previous==='schedule'?'map':previous);}}>
      <header className="dialog-heading"><div><h1>내 시간표</h1><p>저장한 강의 장소로 도보 길찾기를 시작하세요.</p></div><button aria-label="시간표 닫기" onClick={() => selectShellTab('map')}>지도로</button></header>
    {trip&&<section className="class-trip" aria-label="선택한 수업 이동 안내"><div className="trip-content"><span className="eyebrow">MAKE IT BEFORE CLASS</span><strong>{trip.row.title}{trip.row.room?' · '+trip.row.room+'호':''} · {new Date(trip.classStart).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false})}</strong>
      <ClassJourney key={trip.row.id+':'+(trip.origin?.coords.join(',')||'pending')} row={trip.row} origin={trip.origin} route={trip.route} classStart={trip.classStart} onMode={mode=>{setOpen(false);setShellTab('map');frame.current?.contentWindow?.postMessage({type:'knu:class-mode',classId:trip.row.id,mode},location.origin);}}/>
      {trip.route&&<p className="trip-deadline">{new Date(classTrip.departureAt(trip.classStart,trip.route)).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false})}까지 출발 <small>{trip.estimate?'저장된 예상 시간 · ':''}{Math.ceil(trip.route.duration/60)}분 이동 + 내부 {trip.route.indoorMinutes}분 + 여유 {trip.route.safetyMinutes}분</small></p>}
      <p role="status">{trip.status}</p><ClassWeather data={weather} departure={trip.route?classTrip.departureAt(trip.classStart,trip.route):Date.parse(trip.classStart)} classStart={trip.classStart}/>{trip.route&&<small>{trip.route.start.name} → {trip.row.place_name} · 예상 시각이며 교통 상황에 따라 달라집니다. 즐겨찾기는 출발지도 함께 저장합니다.</small>}</div><div className="trip-actions">
      <button disabled={busy||(!trip.route&&!trip.row.favorite_route)} onClick={()=>mutate('PUT',{id:trip.row.id,favorite_route:trip.row.favorite_route?null:trip.route})}>{trip.row.favorite_route?'★ 즐겨찾기 해제':'☆ 이 경로 즐겨찾기'}</button><button aria-label="수업 이동 안내 닫기" onClick={()=>setTrip(null)}>닫기</button>
    </div></section>}
      <p role="status" className="schedule-status">{status}</p>
      {!supabase ? <p>시간표 서버 연결을 준비 중입니다. 지도 길찾기는 이용할 수 있습니다.</p> : authLoading ? <p>로그인 확인 중…</p> : !user ? <>
        <div className="auth-tabs" role="group" aria-label="계정 이용"><button type="button" disabled={busy} aria-pressed={authMode==='login'} onClick={()=>{setAuthMode('login');setStatus('');}}>로그인</button><button type="button" disabled={busy} aria-pressed={authMode==='signup'} onClick={()=>{setAuthMode('signup');setStatus('');}}>회원가입</button></div>
        <p className="muted">{authMode==='signup'?'아이디와 비밀번호로 가입하면 바로 나만의 시간표를 관리할 수 있습니다.':'로그인하면 저장한 수업과 장소를 불러옵니다.'}</p>
        <form key={authMode} onSubmit={authMode==='signup'?signup:login} className="schedule-form"><fieldset disabled={busy}><label>{authMode==='signup'?'아이디':'아이디 또는 기존 이메일'}<input name="identifier" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={authMode==='signup'?24:254} required /></label><label>비밀번호<input name="password" type="password" autoComplete={authMode==='signup'?'new-password':'current-password'} minLength={authMode==='signup'?8:undefined} aria-describedby={authMode==='signup'?'signup-password-help':undefined} required /></label>{authMode==='signup'&&<><p id="signup-password-help" className="auth-help">아이디: 영문·숫자·_·- 3~24자 · 비밀번호: 8자 이상</p><label>비밀번호 확인<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label></>}<button className="accent" disabled={busy}>{busy?'처리 중…':authMode==='signup'?'회원가입':'로그인'}</button></fieldset></form>
      </> : <>
        <div className="account-row"><span>{auth.displayIdentifier(user.email)}</span><button disabled={busy} onClick={logout}>로그아웃</button></div>
        {!allowed && <button disabled={busy} onClick={() => setRefreshIndex(value => value + 1)}>접근 권한 다시 확인</button>}
        {allowed && <>
          <div className="calendar-title"><div><span className="eyebrow">YOUR WEEK, IN COLOR</span><h2>이번 주, 내 캠퍼스 리듬</h2></div><div className="calendar-entry-actions"><button className="photo-import-button" type="button" onClick={()=>{setImportOpen(value=>!value);dialog.current?.scrollTo({top:0});}}>✧ 사진으로 가져오기</button><button type="button" onClick={()=>{setImportOpen(false);edit(null);editorSection.current?.scrollIntoView({block:'start'});}}>+ 수업 추가</button></div></div>
          {importOpen&&<TimetableImport defaults={emptyForm()} existing={classes} onCancel={()=>setImportOpen(false)} onSave={async payload=>{const result=await mutate('POST',payload);if(result?.classes){setImportOpen(false);return true;}return false;}}/>}
          {terms.length>1&&<label className="calendar-term">시간표 학기<select value={visibleTerm} onChange={event=>setCalendarTerm(event.target.value)}>{terms.map(term=><option key={term}>{term}</option>)}</select></label>}
          <WeekCalendar classes={classes.filter(row=>row.term===visibleTerm)} disabled={!ready||busy} selectedId={trip?.row.id} onSelect={row=>{setWeekday(row.weekday);navigate(row);}} onDay={setWeekday}/>
          <nav className="day-tabs" aria-label="시간표 요일"><button aria-pressed={manageAll} onClick={()=>setManageAll(true)}>전체</button>{days.map((day,index) => <button key={day} aria-pressed={!manageAll&&weekday === index + 1} onClick={() => {setManageAll(false);setWeekday(index + 1);}}>{day}</button>)}</nav>
          <section aria-label={`${days[weekday - 1]}요일 수업`} className="class-list">
            {courseGroups.groupCourses(classes.filter(row=>row.term===visibleTerm)).filter(group=>manageAll||group.meetings.some(row=>row.weekday===weekday)).map(group=><CourseManager key={group.key} group={group} busy={busy} ready={ready} onNavigate={navigate} onEdit={edit} onMutate={mutate}/>)}
            {!classes.some(row => (manageAll||row.weekday===weekday)&&row.term===visibleTerm) && <p className="muted">등록된 수업이 없습니다. 아래에서 추가해주세요.</p>}
          </section>
          <section ref={editorSection} className="class-editor"><h2>{editing ? '수업 수정' : '수업 등록'}</h2>
            <form className="schedule-form" onSubmit={save}>
              <fieldset disabled={busy}>
                <label>수업명<input value={form.title} onChange={change('title')} maxLength={100} required /></label>
                <label>학기<input value={form.term} onChange={change('term')} maxLength={60} required /></label>
                <section className="meeting-editor" aria-label="1회차 수업"><h3>{second?'1회차':'수업 시간'}</h3>
                  <label>요일<select value={form.weekday} onChange={change('weekday')}>{days.map((day,index) => <option key={day} value={index+1}>{day}요일</option>)}</select></label>
                  <div className="form-pair"><TimePicker label="시작 시각" value={form.start} onChange={value=>changeTime('start',value)} /><TimePicker label="종료 시각" value={form.end} onChange={value=>changeTime('end',value)} /></div>
                </section>
                {!editing && <button type="button" aria-pressed={Boolean(second)} onClick={()=>setSecond(previous=>previous?null:classEditor.secondMeeting(form))}>{second?'− 2회차 빼기':'+ 주 2회 수업 추가'}</button>}
                {second && <section className="meeting-editor" aria-label="2회차 수업"><h3>2회차</h3>
                  <label>2회차 요일<select value={second.weekday} onChange={event=>setSecond(previous=>({...previous,weekday:Number(event.target.value)}))}>{days.map((day,index)=><option key={day} value={index+1}>{day}요일</option>)}</select></label>
                  <div className="form-pair"><TimePicker label="2회차 시작 시각" value={second.start} onChange={value=>changeTime('start',value,true)} /><TimePicker label="2회차 종료 시각" value={second.end} onChange={value=>changeTime('end',value,true)} /></div>
                </section>}
                <p className="auth-help">시작 시각을 바꾸면 종료 시각은 1시간 15분 뒤로 설정되며, 직접 변경할 수 있습니다.{minutes(form.start)>1360||(second&&minutes(second.start)>1360)?' 자정을 넘는 경우 종료 시각을 같은 날 23:55로 설정합니다.':''}{second?' 두 회차는 저장 후 각 요일에서 수정할 수 있습니다.':''}</p>
                <div className="form-pair"><label>학기 시작일<input type="date" value={form.starts_on} onChange={change('starts_on')} required /></label><label>학기 종료일<input type="date" value={form.ends_on} onChange={change('ends_on')} required /></label></div>
                <label>강의 장소</label><div className="place-search"><input aria-label="강의 장소 검색" value={placeQuery} maxLength={100} placeholder="예: 경북대학교 IT1호관" onChange={event => {searchGeneration.current++; setSearching(false); setPlaceQuery(event.target.value); setPlace(null); setResults([]);}} onKeyDown={event => {if(event.key === 'Enter') {event.preventDefault(); searchPlace();}}} /><button type="button" disabled={searching} onClick={searchPlace}>{searching ? '검색 중…' : '검색'}</button></div>
                {results.length > 0 && <ul className="place-results">{results.map((result,index) => <li key={result.id || index}><button type="button" onClick={() => {searchGeneration.current++; setPlace(result); setPlaceQuery(result.name); setResults([]); setStatus('강의 장소를 선택했습니다.');}}>{result.name}<small>{result.address}</small></button></li>)}</ul>}
                {place && <p className="selected-place">✓ {place.name}</p>}
                <div className="form-pair"><label>강의실<input value={form.room||''} maxLength={80} placeholder="예: 317 / B101" onChange={change('room')}/></label><label>교수명(선택)<input value={form.professor||''} maxLength={80} onChange={change('professor')}/></label></div><p className="auth-help">입력한 종료는 실제 수업 종료입니다. 캘린더 블록은 15분 뒤까지 채워 표시합니다.</p>
                <button className="accent" type="submit">{editing ? '수정 저장' : '수업 저장'}</button>{editing && <button type="button" onClick={() => edit(null)}>수정 취소</button>}
              </fieldset>
            </form>
          </section>
        </>}
      </>}
    </dialog>
    <nav className="app-bottom-nav" aria-label="주요 메뉴">{[['map','⌘','지도'],['schedule','▦','시간표'],['inside','♧','학교 내부'],['outside','☕','학교 주변'],['route-nearby','⌖','경로 주변']].map(([tab,icon,label])=><button type="button" key={tab} disabled={tab!=='schedule'&&tab!=='map'&&!ready} aria-current={(open?'schedule':shellTab)===tab?'page':undefined} onClick={()=>selectShellTab(tab)}><span aria-hidden="true">{icon}</span>{label}</button>)}</nav>
  </main>;
}
