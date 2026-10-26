// Pixel analysis is shared by browser OCR and the real-image regression check.
function groups(points,gap=4){const out=[];for(const point of points){if(out.length&&point-out.at(-1).at(-1)<gap)out.at(-1).push(point);else out.push([point]);}return out.map(list=>Math.round(list.reduce((sum,n)=>sum+n,0)/list.length));}
function detectTimetable({data,width:w,height:h}){
  const neutral=(x,y)=>{const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];return Math.min(r,g,b)>=28&&Math.max(r,g,b)<=225&&Math.max(r,g,b)-Math.min(r,g,b)<13;};
  const xs=[],ys=[];
  for(let x=0;x<w;x++){let count=0;for(let y=Math.floor(h*.18);y<h*.96;y+=2)if(neutral(x,y))count++;if(count>h*.085)xs.push(x);}
  for(let y=0;y<h*.98;y++){let count=0;for(let x=0;x<w;x+=2)if(neutral(x,y))count++;if(count>w*.09)ys.push(y);}
  const xLines=groups(xs),yLines=groups(ys),gaps=xLines.slice(1).map((x,i)=>x-xLines[i]).filter(gap=>gap>w*.07&&gap<w*.4).sort((a,b)=>a-b);
  if(gaps.length<2)throw Error('시간표 격자를 찾지 못했습니다. 요일과 시간 눈금이 보이도록 캡처해주세요.');
  const columnWidth=gaps[Math.floor(gaps.length/2)],boundaries=xLines.filter((x,i)=>i===0||x-xLines[i-1]>columnWidth*.5);
  if(w-boundaries.at(-1)>columnWidth*.8)boundaries.push(w-1);
  const gapCounts=new Map();for(let i=1;i<yLines.length;i++){const gap=yLines[i]-yLines[i-1];if(gap<h*.035||gap>h*.2)continue;const key=Math.round(gap/5)*5;gapCounts.set(key,(gapCounts.get(key)||0)+1);}
  const nominal=[...gapCounts].sort((a,b)=>b[1]-a[1])[0]?.[0];if(!nominal)throw Error('시간 눈금을 확인하지 못했습니다.');
  let best=[];for(const start of yLines){const sequence=yLines.filter(y=>y>=start&&Math.abs((y-start)/nominal-Math.round((y-start)/nominal))<.09);if(sequence.length>best.length)best=sequence;}
  if(best.length<4)throw Error('시간 눈금이 부족합니다. 시간표 전체를 캡처해주세요.');
  const top=best[0],bottom=best.at(-1),hourHeight=(bottom-top)/Math.round((bottom-top)/nominal);
  const columns=[];for(let i=1;i<boundaries.length;i++){const left=boundaries[i-1],right=boundaries[i];if(right-left>columnWidth*.7&&right-left<columnWidth*1.3)columns.push({left,right});}
  if(columns.length<2||columns.length>7)throw Error('요일 칸을 확인하지 못했습니다.');
  const bgCounts=new Map();for(const col of columns)for(let y=top+5;y<bottom;y+=12)for(let x=col.left+10;x<col.right-10;x+=12){const i=(y*w+x)*4,key=[data[i],data[i+1],data[i+2]].map(v=>Math.floor(v/16)*16).join(',');bgCounts.set(key,(bgCounts.get(key)||0)+1);}
  const background=[...bgCounts].sort((a,b)=>b[1]-a[1])[0][0].split(',').map(Number),dark=background.reduce((a,b)=>a+b,0)<384;
  const distance=(a,b)=>Math.sqrt(a.reduce((sum,n,i)=>sum+(n-b[i])**2,0)),blocks=[];
  for(const [column,col] of columns.entries()){
    const rows=[];for(let y=top+2;y<bottom;y++){
      const colors=new Map();let samples=0;
      for(let x=col.left+9;x<col.right-9;x+=4){samples++;const i=(y*w+x)*4,rgb=[data[i],data[i+1],data[i+2]],brightness=rgb.reduce((a,b)=>a+b,0)/3;if((dark&&(brightness<65||brightness>233))||(!dark&&(brightness<45||brightness>248))||distance(rgb,background)<45)continue;const key=rgb.map(v=>Math.floor(v/16)*16).join(',');colors.set(key,(colors.get(key)||0)+1);}
      const color=[...colors].sort((a,b)=>b[1]-a[1])[0];rows.push(color&&color[1]>samples*.18?{y,color:color[0].split(',').map(Number)}:null);
    }
    let run=null;const finish=()=>{if(run&&run.last-run.top>hourHeight*.25)blocks.push({column,left:col.left+3,top:run.top,width:col.right-col.left-6,height:run.last-run.top+1,color:run.color});run=null;};
    for(let i=0;i<rows.length;i++){
      const row=rows[i];if(!row){if(run&&top+i-run.last>14)finish();continue;}
      if(run&&distance(run.color,row.color)>35&&rows.slice(i,i+5).filter(next=>next&&distance(next.color,row.color)<25).length>=3)finish();
      if(!run)run={top:row.y,last:row.y,color:row.color};else run.last=row.y;
    }finish();
  }
  return {width:w,height:h,columns,top,bottom,hourHeight,headerTop:yLines.filter(y=>y<top).at(-1)??Math.max(0,top-hourHeight*.5),blocks:blocks.sort((a,b)=>a.column-b.column||a.top-b.top),cropped:w-boundaries.at(-1)>columnWidth*.1};
}
function parseCourseText(text){
  const lines=String(text).split(/\r?\n/).map(line=>line.replace(/[|¦]/g,' ').trim()).filter(Boolean);
  const locationIndex=lines.findIndex(line=>/산격|캠퍼스|대학\s*\d|호관|복지관|공학관|융복합/.test(line));
  const contentEnd=locationIndex<0?lines.length:locationIndex;
  let professorIndex=-1;for(let i=1;i<contentEnd;i++)if(/^[가-힣]{2,4}$/.test(lines[i].replace(/\s/g,'')))professorIndex=i;
  const title=lines.slice(0,professorIndex>=0?professorIndex:contentEnd).join('').replace(/[^가-힣A-Za-z0-9\s]/g,'').replace(/\s+/g,' ').slice(0,100);
  const location=locationIndex>=0?lines.slice(locationIndex).join(' '):'';
  const compact=location.replace(/\s/g,''),match=compact.match(/(?:[-–]|관\)?)([ABab]?\d{3,4}(?:-\d{1,2})?)$/)||compact.match(/([ABab]?\d{3,4}(?:-\d{1,2})?)$/);
  const room=match?match[1].toUpperCase():'';
  let building='';
  if(/IT대학1호관|대학1호관|공대10호관/.test(compact))building='경북대학교 IT대학1호관';
  else if(/IT대학5호관|대학5호관|IT융복합관|융복합관/.test(compact))building='경북대학교 IT대학5호관';
  else if(/복지관|[=뽁]지관/.test(compact))building='경북대학교 복지관';
  else if(/공대12호관/.test(compact))building='경북대학교 공대12호관';
  else if(/IT|[|]ㅠ/.test(compact))building='경북대학교 IT대학';
  else if(location)building='경북대학교 '+location.replace(/산격동?\s*캠퍼스\s*/g,'').replace(/[-–]\s*[ABab]?\d{3,4}(?:-\d{1,2})?\s*$/,'').trim();
  return {title,professor:professorIndex>=0?lines[professorIndex].replace(/\s/g,''):'',room,building,rawText:text};
}
function blockMeeting(block,grid,startHour=9,early=15){const start=Math.round((startHour*60+(block.top-grid.top)/grid.hourHeight*60)/15)*15,displayEnd=Math.round((startHour*60+(block.top+block.height-grid.top)/grid.hourHeight*60)/15)*15;return {weekday:block.column+1,start_minute:start,display_end_minute:Math.min(1439,displayEnd),end_minute:Math.min(1439,displayEnd)-early};}
function lastTextLine(block,{data,width}){const rows=[];for(let y=block.top+5;y<block.top+block.height-4;y++){let count=0;for(let x=block.left+5;x<block.left+block.width-5;x++){const at=(y*width+x)*4;if(Math.min(data[at],data[at+1],data[at+2])>215)count++;}if(count>=3)rows.push(y);}const lines=[];for(const y of rows){if(lines.length&&y-lines.at(-1).at(-1)<=5)lines.at(-1).push(y);else lines.push([y]);}const line=lines.filter(line=>line.length>=5).at(-1);if(!line)return null;return {left:block.left+4,top:Math.max(block.top,line[0]-5),width:block.width-8,height:Math.min(block.top+block.height,line.at(-1)+6)-Math.max(block.top,line[0]-5)};}
module.exports={detectTimetable,parseCourseText,blockMeeting,lastTextLine};
