const normalize=value=>String(value||'').replace(/\s/g,'').toLowerCase();
function groupCourses(rows){const groups=new Map();rows.forEach((row,index)=>{const key=row._group||[normalize(row.title)||`unread:${index}`,row.term||'',row.starts_on||'',row.ends_on||''].join('|');if(!groups.has(key))groups.set(key,{key,title:row.title,meetings:[],indices:[]});groups.get(key).meetings.push(row);groups.get(key).indices.push(index);});return [...groups.values()];}
const locationKeys=['place_name','latitude','longitude','room','building','place','candidates'];
function locationSignature(row){return JSON.stringify([row.place?.coords||[row.latitude,row.longitude],row.building||row.place_name||'',row.room||'']);}
function withOverrides(rows){const first=rows.find(row=>row.location_override===false)||rows[0];return rows.map(row=>({...row,location_override:row.location_override??(locationSignature(row)!==locationSignature(first))}));}
function updateMeeting(rows,index,patch){
  const prepared=withOverrides(rows),source=prepared[index];
  if(patch.location_override===false){const shared=prepared.find((row,i)=>i!==index&&!row.location_override);if(shared)patch={...Object.fromEntries(locationKeys.filter(key=>key in shared).map(key=>[key,shared[key]])),...patch};}
  return prepared.map((row,i)=>{
    if(i===index)return {...row,...patch};
    const next={...row};
    for(const [key,value] of Object.entries(patch)){
      if(['title','professor','term','starts_on','ends_on'].includes(key))next[key]=value;
      if(locationKeys.includes(key)&&!source.location_override&&!row.location_override)next[key]=value;
    }
    return next;
  });
}
module.exports={groupCourses,withOverrides,updateMeeting};
