(function(root){
  const hex=bytes=>Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
  async function makeSettings(username,password,confirmation,cryptoApi=globalThis.crypto){
    username=String(username||'').trim().toLowerCase();
    if(!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(username))throw Error('아이디는 영문·숫자로 시작하는 3~40자이며 _, -를 사용할 수 있습니다.');
    if(typeof password!=='string'||password.length<12||new TextEncoder().encode(password).length>256)throw Error('비밀번호는 12자 이상, 256바이트 이내로 입력해주세요.');
    if(password!==confirmation)throw Error('비밀번호 확인이 일치하지 않습니다.');
    const salt=cryptoApi.getRandomValues(new Uint8Array(16)),key=await cryptoApi.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const derived=await cryptoApi.subtle.deriveBits({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},key,256);
    const hash='pbkdf2-sha256:600000:'+hex(salt)+':'+hex(new Uint8Array(derived));
    const file=()=>`KNU_ADMIN_USERNAME=${username}\nKNU_ADMIN_PASSWORD_HASH=${hash}\nKNU_ADMIN_SESSION_SECRET=${hex(cryptoApi.getRandomValues(new Uint8Array(32)))}\n`;
    return {staging:file(),production:file()};
  }
  if(typeof module!=='undefined')module.exports={makeSettings};else root.AdminSetup={makeSettings};
})(typeof window!=='undefined'?window:this);
