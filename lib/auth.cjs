function validateSignup({email,password,confirmation}) {
  const address=String(email||'').trim();
  if(address.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))throw new Error('올바른 이메일 주소를 입력해주세요.');
  if(typeof password!=='string'||password.length<8||new TextEncoder().encode(password).length>72)throw new Error('비밀번호는 8자 이상, 72바이트 이내로 입력해주세요.');
  if(password!==confirmation)throw new Error('비밀번호 확인이 일치하지 않습니다.');
  return {email:address,password};
}
function authErrorMessage(error) {
  if(['over_email_send_rate_limit','over_request_rate_limit'].includes(error?.code)||error?.status===429)return '요청이 많습니다. 잠시 후 다시 시도해주세요.';
  if(['signup_disabled','email_provider_disabled','email_address_not_authorized'].includes(error?.code))return '현재 회원가입 또는 인증 메일 발송 설정을 준비 중입니다. 잠시 후 다시 시도해주세요.';
  if(error?.code==='weak_password')return '더 안전한 비밀번호를 사용해주세요. 최소 8자 이상으로 입력해주세요.';
  if(error?.code==='email_not_confirmed')return '이메일의 인증 링크를 누른 후 다시 로그인해주세요.';
  return '처리하지 못했습니다. 입력 내용을 확인해주세요. 이미 가입했다면 로그인해주세요.';
}
module.exports={validateSignup,authErrorMessage};
