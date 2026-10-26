const normalize=value=>String(value||'').replace(/\s/g,'').toLowerCase();
function groupCourses(rows){const groups=new Map();rows.forEach((row,index)=>{const key=row._group||[normalize(row.title)||`unread:${index}`,row.term||'',row.starts_on||'',row.ends_on||''].join('|');if(!groups.has(key))groups.set(key,{key,title:row.title,meetings:[],indices:[]});groups.get(key).meetings.push(row);groups.get(key).indices.push(index);});return [...groups.values()];}
module.exports={groupCourses};
