const {RouteError}=require('./routing.cjs');
let cached=null;
function normalizeMeals(data,now=new Date()) {
  const date=new Date(now.getTime()+9*3600000).toISOString().slice(0,10),year=date.slice(0,4),month=Number(date.slice(5,7)),day=Number(date.slice(8,10));
  const dayKey=(data.days||[]).find(value=>{const m=String(value).match(/\((\d{1,2})\/(\d{1,2})\)/);return m&&Number(m[1])===month&&Number(m[2])===day;});
  const currentYear=String(data.updated_at||'').startsWith(year);
  const restaurants=(data.shops||[]).slice(0,20).map(name=>{
    const meals=dayKey&&currentYear?Object.entries(data.data?.[name]?.[dayKey]||{}).map(([type,value])=>({type,time:String(value.time||''),items:Array.isArray(value.items)?value.items.map(String).slice(0,30):[]})).filter(m=>m.items.length):[];
    return {name,meals};
  }).sort((a,b)=>Number(Boolean(b.meals.length))-Number(Boolean(a.meals.length)));
  return {date,updatedAt:data.updated_at,status:data.crawl_status,restaurants,source:'경북대학교 학식 크롤러'};
}
async function meals(_query,_env,request=fetch) {
  if(cached&&Date.now()-cached.at<300000)return normalizeMeals(cached.data);
  try{const response=await request('https://raw.githubusercontent.com/sseungmiii/knu_meal_test/main/menu.json',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();const data=await response.json();if(!Array.isArray(data.shops)||!Array.isArray(data.days))throw new Error();cached={data,at:Date.now()};return normalizeMeals(data);}catch{throw new RouteError(502,'MEAL_UNAVAILABLE','학식 정보를 불러오지 못했습니다. 잠시 후 다시 조회해주세요.');}
}
module.exports={meals,normalizeMeals};
