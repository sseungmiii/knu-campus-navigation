import classTrip from '../../lib/class-trip.cjs';
const format=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
export default function WeekCalendar({classes,onSelect,onDay,disabled,selectedId}) {
  const rows=classTrip.calendarLayout(classes),start=rows.length?Math.min(...rows.map(row=>Math.floor(row.start_minute/60)*60)):9*60,end=Math.max(18*60,...rows.map(row=>Math.ceil((row.display_end_minute??row.end_minute)/60)*60));
  const scale=1.1,height=(end-start)*scale,subjects=[...new Set(classes.map(row=>row.title))].sort();
  return <section className="week-calendar" aria-label="월요일부터 금요일 주간 시간표"><p className="calendar-hint">수업을 누르면 이동 경로와 출발 시각을 확인합니다.</p><div className="calendar-scroll"><div className="calendar-grid">
    <div className="calendar-corner">시간</div>{['월','화','수','목','금'].map((day,index)=><button className="calendar-heading" type="button" key={day} onClick={()=>onDay(index+1)}>{day}</button>)}
    <div className="calendar-hours" style={{height}}>{Array.from({length:(end-start)/60},(_,index)=><span key={index} style={{top:index*60*scale}}>{String(start/60+index).padStart(2,'0')}</span>)}</div>
    {[1,2,3,4,5].map(day=><div key={day} className="calendar-day" style={{height,backgroundSize:`100% ${60*scale}px`}}>{rows.filter(row=>row.weekday===day).map(row=>{
      const hue=subjects.indexOf(row.title)*137.508%360;
      return <button key={row.id} type="button" disabled={disabled} className="calendar-class" aria-label={`${['월','화','수','목','금'][day-1]}요일 ${row.title} ${format(row.start_minute)}부터 실제 ${format(row.end_minute)} 종료 ${row.place_name} ${row.room||''}`} title={`실제 ${format(row.start_minute)}–${format(row.end_minute)} · ${row.place_name} ${row.room||''}`} aria-pressed={selectedId===row.id} onClick={()=>onSelect(row)} style={{top:(row.start_minute-start)*scale,height:Math.max(22,((row.display_end_minute??row.end_minute)-row.start_minute)*scale-2),left:`calc(${row.lane*100/row.lanes}% + 2px)`,width:`calc(${100/row.lanes}% - 4px)`,backgroundColor:`hsl(${hue} 42% 82%)`,borderColor:`hsl(${hue} 45% 43%)`,animationDelay:`${(day-1)*45}ms`}}><strong>{row.title}</strong>{row.professor&&<small>{row.professor}</small>}<small>{row.place_name.replace(/^경북대학교\s*/,'')}</small>{row.room&&<b className="calendar-room">{row.room}</b>}<span className="calendar-real-time">{format(row.start_minute)}–{format(row.end_minute)}</span>{row.favorite_route&&<span className="calendar-star" aria-label="즐겨찾기 경로 있음">★</span>}</button>;
    })}</div>)}
  </div></div>{!rows.length&&<p className="muted">등록한 월~금 수업이 여기에 표시됩니다.</p>}</section>;
}
