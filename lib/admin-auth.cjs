const {pbkdf2,randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {promisify}=require('node:util');
const derive=promisify(pbkdf2),ITERATIONS=600000,TTL=8*60*60;
const validUsername=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{2,39}$/.test(value);
const normalizeUsername=value=>typeof value==='string'?value.trim().toLowerCase():'';
const same=(a,b)=>timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest());
function audience(env=process.env){return env.KNU_ENV==='staging'||env.VERCEL_GIT_COMMIT_REF==='staging'||(env.VERCEL_ENV&&env.VERCEL_ENV!=='production')?'staging':env.KNU_ENV==='production'||env.VERCEL_ENV==='production'||env.VERCEL_GIT_COMMIT_REF==='main'?'production':'local';}
function config(env=process.env){
  const username=normalizeUsername(env.KNU_ADMIN_USERNAME),hash=env.KNU_ADMIN_PASSWORD_HASH,secret=env.KNU_ADMIN_SESSION_SECRET;
  if(!validUsername(username)||typeof hash!=='string'||!/^pbkdf2-sha256:600000:[a-f0-9]{32}:[a-f0-9]{64}$/.test(hash)||typeof secret!=='string'||secret.length<32)return null;
  return {username,hash,secret,audience:audience(env),version:createHash('sha256').update(username+':'+hash+':'+audience(env)).digest('hex')};
}
async function hashPassword(password,salt=randomBytes(16)){
  if(typeof password!=='string'||password.length<12||Buffer.byteLength(password)>256)throw Error('관리자 비밀번호는 12자 이상, 256바이트 이내로 입력해주세요.');
  const key=await derive(password,salt,ITERATIONS,32,'sha256');return `pbkdf2-sha256:${ITERATIONS}:${salt.toString('hex')}:${key.toString('hex')}`;
}
async function verifyCredentials(input,settings){
  if(!settings||typeof input?.password!=='string'||Buffer.byteLength(input.password)>256||typeof input.username!=='string'||input.username.length>100)return false;
  const [,iterations,salt,expected]=settings.hash.split(':');
  const actual=await derive(input.password,Buffer.from(salt,'hex'),Number(iterations),32,'sha256');
  return timingSafeEqual(actual,Buffer.from(expected,'hex'))&&same(normalizeUsername(input.username),settings.username);
}
function issueSession(settings,now=Date.now()){return {role:'admin',username:settings.username,version:settings.version,audience:settings.audience,issuedAt:now,expiresAt:now+TTL*1000};}
function validSession(data,settings,now=Date.now()){return Boolean(settings&&data?.role==='admin'&&same(data.username,settings.username)&&same(data.version,settings.version)&&data.audience===settings.audience&&Number.isSafeInteger(data.issuedAt)&&Number.isSafeInteger(data.expiresAt)&&data.issuedAt<=now+30000&&data.expiresAt>now&&data.expiresAt-data.issuedAt===TTL*1000);}
function sessionOptions(settings,env=process.env){const secure=env.NODE_ENV!=='development';return {password:settings.secret,cookieName:secure?'__Host-knupass_admin':'knupass_admin',ttl:TTL,cookieOptions:{httpOnly:true,secure,sameSite:'lax',path:'/',maxAge:TTL-60}};}
function createLimiter(){const entries=new Map();return function allowed(key,now=Date.now()){
  for(const [id,row]of entries)if(row.until<=now)entries.delete(id);
  const id=createHash('sha256').update(String(key)).digest('hex'),old=entries.get(id);
  if(old&&old.count>=6)return false;
  if(!old&&entries.size>=500)return false;
  entries.set(id,{count:(old?.count||0)+1,until:old?.until||now+15*60000});return true;
};}
module.exports={TTL,ITERATIONS,validUsername,normalizeUsername,audience,config,hashPassword,verifyCredentials,issueSession,validSession,sessionOptions,createLimiter};
