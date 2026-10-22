const ID_DOMAIN='accounts.knupass.invalid';
function loginEmail(identifier) {
  const value=String(identifier||'').trim().toLowerCase();
  if(value.includes('@'))return value; // Keep existing email accounts usable.
  if(!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(value))throw new Error('아이디는 영문·숫자로 시작하는 3~24자이며 영문, 숫자, 밑줄, 하이픈을 사용할 수 있습니다.');
  return `${value}@${ID_DOMAIN}`;
}
function displayIdentifier(email) {
  return String(email||'').endsWith(`@${ID_DOMAIN}`)?email.slice(0,-ID_DOMAIN.length-1):email;
}
function validateSignup({identifier,password,confirmation}) {
  if(String(identifier||'').includes('@'))throw new Error('이메일 대신 사용할 아이디를 입력해주세요.');
  const email=loginEmail(identifier);
  if(typeof password!=='string'||password.length<8||new TextEncoder().encode(password).length>72)throw new Error('비밀번호는 8자 이상, 72바이트 이내로 입력해주세요.');
  if(password!==confirmation)throw new Error('비밀번호 확인이 일치하지 않습니다.');
  return {email,password};
}
function authErrorMessage(error) {
  if(['over_email_send_rate_limit','over_request_rate_limit'].includes(error?.code)||error?.status===429)return '요청이 많습니다. 잠시 후 다시 시도해주세요.';
  if(error?.code==='user_already_exists')return '이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.';
  if(['signup_disabled','email_provider_disabled','email_address_not_authorized','email_not_confirmed'].includes(error?.code))return '회원가입 설정을 확인 중입니다. 잠시 후 다시 시도해주세요.';
  if(error?.code==='weak_password')return '더 안전한 비밀번호를 사용해주세요. 최소 8자 이상으로 입력해주세요.';
  return '처리하지 못했습니다. 아이디와 비밀번호를 확인해주세요. 이미 가입했다면 로그인해주세요.';
}
module.exports={loginEmail,displayIdentifier,validateSignup,authErrorMessage};
