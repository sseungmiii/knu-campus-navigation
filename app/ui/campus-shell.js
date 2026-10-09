'use client';
import {useEffect, useMemo, useRef, useState} from 'react';
import {createClient} from '../../lib/supabase/client';
import timetable from '../../lib/timetable.cjs';
const days = ['월', '화', '수', '목', '금', '토', '일'];
const time = minute => `${String(Math.floor(minute / 60)).padStart(2,'0')}:${String(minute % 60).padStart(2,'0')}`;
const minutes = value => Number(value.split(':')[0]) * 60 + Number(value.split(':')[1]);
function emptyForm() {
  const {date} = timetable.koreaClock(); const year = date.slice(0,4), second = Number(date.slice(5,7)) >= 7;
  return {title: '', term: `${year}년 ${second ? 2 : 1}학기`, weekday: timetable.koreaClock().weekday, start: '09:00', end: '10:15', starts_on: `${year}-${second ? '08-01' : '03-01'}`, ends_on: `${year}-${second ? '12-31' : '06-30'}`};
}
export default function CampusShell({supabaseConfig}) {
  const supabase = useMemo(() => supabaseConfig ? createClient(supabaseConfig) : null, [supabaseConfig]);
  const frame = useRef(null), dialog = useRef(null), searchGeneration = useRef(0), userRef = useRef(null);
  const [open, setOpen] = useState(false), [ready, setReady] = useState(false), [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase)), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const [classes, setClasses] = useState([]), [allowed, setAllowed] = useState(false), [now, setNow] = useState(null);
  const [weekday, setWeekday] = useState(1), [form, setForm] = useState(emptyForm), [editing, setEditing] = useState(null);
  const [placeQuery, setPlaceQuery] = useState(''), [place, setPlace] = useState(null), [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false), [deleteId, setDeleteId] = useState(null), [refreshIndex, setRefreshIndex] = useState(0);
  userRef.current = user;
  const next = now ? timetable.upcomingClass(classes, now) : null;
  useEffect(() => {
    setNow(new Date()); setWeekday(timetable.koreaClock().weekday);
    const timer = setInterval(() => setNow(new Date()), 30000);
    const receive = event => { if (event.origin === location.origin && event.source === frame.current?.contentWindow && event.data?.type === 'knu:map-ready') setReady(true); };
    window.addEventListener('message', receive);
    return () => {clearInterval(timer); window.removeEventListener('message', receive);};
  }, []);
  useEffect(() => {
    if (open) dialog.current.showModal(); else if (dialog.current.open) dialog.current.close();
  }, [open]);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getUser().then(({data}) => { if (alive) {setUser(data.user || null); setAuthLoading(false);} });
    const {data: listener} = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) {
        if (session?.user?.id !== userRef.current?.id) {setClasses([]); setAllowed(false);}
        setUser(session?.user || null); setAuthLoading(false);
      }
    });
    return () => {alive = false; listener.subscription.unsubscribe();};
  }, [supabase]);
  useEffect(() => {
    setClasses([]); setAllowed(false); setEditing(null); setForm(emptyForm()); setPlace(null); setPlaceQuery(''); setResults([]); setDeleteId(null); setSearching(false); searchGeneration.current++;
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
      const {error} = await supabase.auth.signInWithPassword({email: String(data.get('email')).trim(), password: String(data.get('password'))});
      if (error) setStatus('로그인하지 못했습니다. 이메일과 비밀번호를 확인해주세요.');
      else setStatus('시간표 접근 권한을 확인 중…');
    } catch {setStatus('로그인 서버에 연결하지 못했습니다.');} finally {setBusy(false);}
  }
  async function logout() {
    setBusy(true); const {error} = await supabase.auth.signOut({scope:'local'});
    if (error) setStatus('로그아웃하지 못했습니다. 다시 시도해주세요.');
    else {setUser(null); setClasses([]); setAllowed(false); setStatus('');}
    setBusy(false);
  }
  function edit(row) {
    searchGeneration.current++; setResults([]); setSearching(false); setDeleteId(null);
    setEditing(row?.id || null); setForm(row ? {...row, start: time(row.start_minute), end: time(row.end_minute)} : emptyForm());
    setPlace(row ? {name: row.place_name, coords: [row.latitude,row.longitude]} : null); setPlaceQuery(row?.place_name || '');
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
      if (!response.ok) {setStatus(data.error || '변경하지 못했습니다.'); return;}
      setClasses(previous => method === 'DELETE' ? previous.filter(row => row.id !== input.id) : [...previous.filter(row => row.id !== data.class.id), data.class]);
      edit(null); setStatus(method === 'DELETE' ? '수업을 삭제했습니다.' : '수업을 저장했습니다.');
    } catch {if (userRef.current?.id === currentUser) setStatus('시간표 서버에 연결하지 못했습니다.');}
    finally {setBusy(false);}
  }
  function save(event) {
    event.preventDefault(); if (!place) {setStatus('강의 장소를 검색 결과에서 선택해주세요.'); return;}
    try {
      const input = timetable.validateClass({...form, weekday: Number(form.weekday), start_minute: minutes(form.start), end_minute: minutes(form.end), place_name: place.name, latitude: place.coords[0], longitude: place.coords[1]});
      mutate(editing ? 'PATCH' : 'POST', {...input, ...(editing ? {id: editing} : {})});
    } catch (error) {setStatus(error.message);}
  }
  function navigate(row) {
    if (!ready) return;
    frame.current.contentWindow.postMessage({type:'knu:destination', place: {name: row.place_name, coords: [row.latitude,row.longitude]}, course: row.title}, location.origin);
    setOpen(false);
  }
  const change = key => event => setForm(previous => ({...previous, [key]: event.target.value}));
  return <main className="campus-shell">
    <header className="account-bar">
      <div className="next-class"><strong>{next ? `다음 수업 · ${next.title}` : '내 시간표로 길찾기'}</strong><span>{next ? `${time(next.start_minute)} · ${next.place_name}` : '수업을 등록하면 오늘의 이동을 바로 준비할 수 있어요.'}</span></div>
      {next && <button disabled={!ready} onClick={() => navigate(next)}>수업으로 길찾기</button>}
      <button className="accent" onClick={() => setOpen(true)}>{user ? '내 시간표' : '로그인 · 시간표'}</button>
    </header>
    <iframe ref={frame} className="campus-map" src="/map/index.html" title="카카오 캠퍼스 도보 길찾기" onLoad={() => {setReady(false); frame.current?.contentWindow?.postMessage({type:'knu:ping'}, location.origin);}} />
    <dialog ref={dialog} className="timetable-dialog" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <header className="dialog-heading"><div><h1>내 시간표</h1><p>저장한 강의 장소로 도보 길찾기를 시작하세요.</p></div><button aria-label="시간표 닫기" onClick={() => setOpen(false)}>닫기</button></header>
      {!supabase ? <p>시간표 서버 연결을 준비 중입니다. 지도 길찾기는 이용할 수 있습니다.</p> : authLoading ? <p>로그인 확인 중…</p> : !user ? <>
        <p className="muted">허용된 두 계정만 시간표를 이용할 수 있습니다. 회원가입은 제공하지 않습니다.</p>
        <form onSubmit={login} className="schedule-form"><label>이메일<input name="email" type="email" autoComplete="username" required /></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label><button className="accent" disabled={busy}>로그인</button></form>
      </> : <>
        <div className="account-row"><span>{user.email}</span><button disabled={busy} onClick={logout}>로그아웃</button></div>
        {!allowed && <button disabled={busy} onClick={() => setRefreshIndex(value => value + 1)}>접근 권한 다시 확인</button>}
        {allowed && <>
          <nav className="day-tabs" aria-label="시간표 요일">{days.map((day,index) => <button key={day} aria-pressed={weekday === index + 1} onClick={() => setWeekday(index + 1)}>{day}</button>)}</nav>
          <section aria-label={`${days[weekday - 1]}요일 수업`} className="class-list">
            {classes.filter(row => row.weekday === weekday).sort((a,b) => a.start_minute - b.start_minute).map(row => <article key={row.id} className="class-card">
              <h2>{row.title}</h2><p>{time(row.start_minute)}–{time(row.end_minute)} · {row.place_name}</p><small>{row.term} · {row.starts_on}–{row.ends_on}</small>
              <div className="class-actions"><button disabled={!ready || busy} onClick={() => navigate(row)}>이 수업으로 길찾기</button><button disabled={busy} onClick={() => edit(row)}>수정</button>{deleteId === row.id ? <><button disabled={busy} onClick={() => mutate('DELETE', {id: row.id})}>삭제 확인</button><button onClick={() => setDeleteId(null)}>취소</button></> : <button disabled={busy} onClick={() => setDeleteId(row.id)}>삭제</button>}</div>
            </article>)}
            {!classes.some(row => row.weekday === weekday) && <p className="muted">등록된 수업이 없습니다. 아래에서 추가해주세요.</p>}
          </section>
          <section className="class-editor"><h2>{editing ? '수업 수정' : '수업 등록'}</h2>
            <form className="schedule-form" onSubmit={save}>
              <fieldset disabled={busy}>
                <label>수업명<input value={form.title} onChange={change('title')} maxLength={100} required /></label>
                <div className="form-pair"><label>학기<input value={form.term} onChange={change('term')} maxLength={60} required /></label><label>요일<select value={form.weekday} onChange={change('weekday')}>{days.map((day,index) => <option key={day} value={index+1}>{day}요일</option>)}</select></label></div>
                <div className="form-pair"><label>시작 시각<input type="time" value={form.start} onChange={change('start')} required /></label><label>종료 시각<input type="time" value={form.end} onChange={change('end')} required /></label></div>
                <div className="form-pair"><label>학기 시작일<input type="date" value={form.starts_on} onChange={change('starts_on')} required /></label><label>학기 종료일<input type="date" value={form.ends_on} onChange={change('ends_on')} required /></label></div>
                <label>강의 장소</label><div className="place-search"><input aria-label="강의 장소 검색" value={placeQuery} maxLength={100} placeholder="예: 경북대학교 IT1호관" onChange={event => {searchGeneration.current++; setSearching(false); setPlaceQuery(event.target.value); setPlace(null); setResults([]);}} onKeyDown={event => {if(event.key === 'Enter') {event.preventDefault(); searchPlace();}}} /><button type="button" disabled={searching} onClick={searchPlace}>{searching ? '검색 중…' : '검색'}</button></div>
                {results.length > 0 && <ul className="place-results">{results.map((result,index) => <li key={result.id || index}><button type="button" onClick={() => {searchGeneration.current++; setPlace(result); setPlaceQuery(result.name); setResults([]); setStatus('강의 장소를 선택했습니다.');}}>{result.name}<small>{result.address}</small></button></li>)}</ul>}
                {place && <p className="selected-place">✓ {place.name}</p>}
                <button className="accent" type="submit">{editing ? '수정 저장' : '수업 저장'}</button>{editing && <button type="button" onClick={() => edit(null)}>수정 취소</button>}
              </fieldset>
            </form>
          </section>
        </>}
      </>}
      <p role="status" className="schedule-status">{status}</p>
    </dialog>
  </main>;
}
