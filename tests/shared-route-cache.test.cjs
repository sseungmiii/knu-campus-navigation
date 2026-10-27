const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
(async()=>{
 let calls=0,fail=false,now=1000;
 const context=vm.createContext({ROUTING_API_BASE_URL:'',location:{hostname:'localhost'},window:{addEventListener(){}},document:{},AbortSignal,Date:{now:()=>now},fetch:async()=>{calls++;await Promise.resolve();return {ok:!fail,json:async()=>fail?{error:'retry'}:{duration:600}};}});
 vm.runInContext(fs.readFileSync(require.resolve('../src/app.js'),'utf8'),context);
 const request=()=>vm.runInContext("routeData('walk',{name:'a',coords:[35,128]},{name:'b',coords:[35.1,128.1]},'RECOMMEND')",context);
 const results=await Promise.all([request(),request()]);assert.equal(calls,1);assert.equal(results[0].duration,600);
 await request();assert.equal(calls,1);now+=120001;await request();assert.equal(calls,2);
 now+=120001;fail=true;await assert.rejects(request,/retry/);fail=false;await request();assert.equal(calls,4);
 await vm.runInContext("routeData('walk',{name:'different origin',coords:[35.2,128]},{name:'b',coords:[35.1,128.1]},'RECOMMEND')",context);assert.equal(calls,5);
 console.log('PASS: concurrent route reuse, tab reuse, TTL expiration, failure retry and origin-separated caching');
})().catch(error=>{console.error(error);process.exit(1);});
