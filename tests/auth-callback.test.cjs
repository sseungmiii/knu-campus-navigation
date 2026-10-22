const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../app/auth/callback/route.js'),'utf8').replace(/^import .*;$/gm,'').replace('export async function GET','async function GET');
let calls=0;
const context=vm.createContext({URL,NextResponse:{redirect(url){return {url:String(url),headers:new Map()};}},createClient:async()=>({auth:{exchangeCodeForSession:async code=>{calls++;assert.equal(code,'test-code');return {error:null};}}})});
vm.runInContext(source,context);
(async()=>{
  let response=await context.GET({url:'https://example.com/auth/callback?code=test-code&next=https://untrusted.example/'});
  assert.equal(response.url,'https://example.com/?auth=confirmed');assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(calls,1);
  response=await context.GET({url:'https://example.com/auth/callback?next=https://untrusted.example/'});assert.equal(response.url,'https://example.com/?auth=error');assert.equal(calls,1);
  context.createClient=async()=>{throw Error('secret upstream detail');};response=await context.GET({url:'https://example.com/auth/callback?code=test-code'});assert.equal(response.url,'https://example.com/?auth=error');
  console.log('PASS: auth callback code exchange, same-origin redirects, missing/failed codes and no token leakage');
})().catch(error=>{console.error(error);process.exit(1);});
