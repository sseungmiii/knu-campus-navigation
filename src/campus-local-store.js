(function(root){
  const registry=typeof module!=='undefined'?require('./campus-registry.js'):root.CampusRegistry;
  const KEY='knupass:campus-facilities:v2',LIMIT=300;
  function text(value,max,label){if(value==null)return '';if(typeof value!=='string'||value.length>max)throw Error(label+'을 확인해주세요.');return value.trim();}
  function validate(input){
    const row=registry.validateDraft(input);
    if(!row.id||!/^[a-zA-Z0-9-]{1,100}$/.test(row.id)||(!row.id.startsWith('local-')&&!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.id)))throw Error('시설 식별자를 확인해주세요.');
    return {...row,building:text(input.building,100,'건물명'),hours:text(input.hours,200,'운영시간'),positionConfirmed:Boolean(row.coords&&input.positionConfirmed===true),source:'manual-local',routeReady:false};
  }
  function parse(raw){
    if(!raw)return {version:2,facilities:[],form:null};
    let data;try{data=JSON.parse(raw);}catch{throw Error('저장 파일을 읽지 못했습니다. JSON 파일을 확인해주세요.');}
    if(![1,2].includes(data?.version)||!Array.isArray(data.facilities)||data.facilities.length>LIMIT)throw Error('지원하는 시설 파일이 아닙니다.');
    const facilities=data.facilities.map(validate);
    if(new Set(facilities.map(row=>row.id)).size!==facilities.length)throw Error('중복 시설 식별자가 있습니다.');
    return {version:2,facilities,form:data.form&&typeof data.form==='object'?data.form:null};
  }
  function read(storage){return parse(storage.getItem(KEY));}
  function write(storage,facilities,form=null){const data=parse(JSON.stringify({version:2,facilities}));storage.setItem(KEY,JSON.stringify({...data,form}));return data.facilities;}
  function located(rows){return rows.filter(row=>registry.validPoint(row.coords)&&row.positionConfirmed).map(row=>({...row,address:[row.building,row.floor,row.room,'이 기기에 저장한 위치 · 실내 경로 미지원'].filter(Boolean).join(' · ')}));}
  function search(rows,query){const key=registry.norm(query);if(!key)return [];return located(rows).filter(row=>registry.norm([row.name,row.building,row.floor,row.room].join(' ')).includes(key)).slice(0,30);}
  function merge(existing,incoming){const map=new Map(existing.map(row=>[row.id,validate(row)]));for(const row of incoming){const item=validate(row);map.set(item.id,item);}if(map.size>LIMIT)throw Error('기기당 최대 300개까지 저장할 수 있습니다.');return [...map.values()];}
  const api={KEY,LIMIT,validate,parse,read,write,located,search,merge};
  if(typeof module!=='undefined')module.exports=api;else root.CampusLocal=api;
})(typeof window!=='undefined'?window:this);
