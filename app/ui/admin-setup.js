'use client';
import {useState} from 'react';
import setup from '../../src/admin-setup.js';
export default function AdminSetup({canGenerate}){
  const [busy,setBusy]=useState(false),[files,setFiles]=useState(null),[message,setMessage]=useState('');
  async function generate(event){event.preventDefault();const form=event.currentTarget,data=new FormData(form);setBusy(true);setFiles(null);setMessage('설정 파일을 만드는 중…');try{setFiles(await setup.makeSettings(data.get('username'),data.get('password'),data.get('confirmation')));form.elements.password.value='';form.elements.confirmation.value='';setMessage('설정 파일을 만들었습니다. 테스트·본 사이트에 각각 다른 파일을 등록해주세요.');}catch(error){setMessage(error.message);}finally{setBusy(false);}}
  function download(kind){const url=URL.createObjectURL(new Blob([files[kind]],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download='.env.admin.'+kind+'.local';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <main className="facility-workbench"><a href="/admin/login">← 관리자 로그인</a><span className="eyebrow">ADMIN SETUP</span><h1>관리자 계정 설정</h1><p>전용 아이디·비밀번호로 시설을 관리합니다. 아래에서 파일을 만든 뒤 Vercel에 등록하고 재배포하면 관리자 로그인이 활성화됩니다.</p>
    <ol><li>아이디와 12자 이상의 비밀번호를 정합니다.</li><li>테스트용·본 사이트용 설정 파일을 각각 내려받습니다.</li><li>Vercel 프로젝트의 Environment Variables에 파일 안의 세 항목을 Secret으로 등록합니다. 고정 사이트 주소에는 Production 환경을 선택합니다.</li><li>각 프로젝트를 재배포한 뒤 관리자 로그인에서 설정한 아이디·비밀번호를 입력합니다.</li></ol>
    <aside>설정 파일에는 비밀번호 검증값과 로그인 보호 키가 들어 있습니다. 공개 저장소에 올리거나 다른 사람에게 공유하지 마세요. 비밀번호는 이 화면에서 계산하며 원문을 서버로 보내거나 파일에 넣지 않습니다.</aside>
    {canGenerate?<form className="schedule-form" onSubmit={generate}><fieldset disabled={busy}><label>관리자 아이디<input name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={40} placeholder="예: knupass_admin"/></label><label>새 비밀번호<input name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password"/></label><label>새 비밀번호 확인<input name="confirmation" type="password" required minLength={12} maxLength={256} autoComplete="new-password"/></label><button className="accent">{busy?'설정 파일 만드는 중…':'설정 파일 만들기'}</button></fieldset></form>:<p>이미 설정된 계정의 변경은 관리자 로그인 후 이 화면에서 진행해주세요.</p>}
    <p role="status">{message}</p>{files&&<div className="facility-file-actions"><button onClick={()=>download('staging')}>테스트용 설정 파일 받기</button><button onClick={()=>download('production')}>본 사이트용 설정 파일 받기</button></div>}
    <p>등록할 항목: <code>KNU_ADMIN_USERNAME</code>, <code>KNU_ADMIN_PASSWORD_HASH</code>, <code>KNU_ADMIN_SESSION_SECRET</code></p><p>테스트용과 본 사이트용 로그인 보호 키는 서로 다르게 생성됩니다. 비밀번호를 바꾸면 기존 관리자 로그인도 만료됩니다.</p>
  </main>;
}
