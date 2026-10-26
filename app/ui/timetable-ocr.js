import imageTools from '../../lib/timetable-image.cjs';
const check=signal=>{if(signal?.aborted)throw new DOMException('취소되었습니다.','AbortError');};
function crop(source,rect,room=false){
  const canvas=document.createElement('canvas'),scale=room?3:2;
  canvas.width=Math.max(1,Math.round(rect.width*scale));canvas.height=Math.max(1,Math.round(rect.height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,rect.left,rect.top,rect.width,rect.height,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);let low=255,high=0;const light=[];
  for(let i=0;i<pixels.data.length;i+=4){const value=255-Math.round(pixels.data[i]*.299+pixels.data[i+1]*.587+pixels.data[i+2]*.114);light.push(value);low=Math.min(low,value);high=Math.max(high,value);}
  for(let i=0,j=0;i<pixels.data.length;i+=4,j++){const value=high-low>30?Math.round((light[j]-low)*255/(high-low)):light[j];pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;}
  ctx.putImageData(pixels,0,0);return canvas;
}
export async function recognizeTimetable(file,{signal,onProgress=()=>{},onWorker=()=>{}}={}){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12*1024*1024)throw Error('PNG·JPG·WebP 이미지(12MB 이하)를 선택해주세요.');
  check(signal);onProgress({progress:3,label:'시간표의 요일과 블록을 찾고 있어요'});
  const bitmap=await createImageBitmap(file),source=document.createElement('canvas');
  const scale=Math.min(1,1800/bitmap.width,3200/bitmap.height,Math.sqrt(5000000/(bitmap.width*bitmap.height)));
  source.width=Math.round(bitmap.width*scale);source.height=Math.round(bitmap.height*scale);const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,source.width,source.height);bitmap.close();
  const pixels=ctx.getImageData(0,0,source.width,source.height),grid=imageTools.detectTimetable(pixels);
  if(!grid.blocks.length||grid.blocks.length>60)throw Error('인식할 수업 블록을 찾지 못했습니다. 시간표 전체가 선명하게 보이는 이미지를 선택해주세요.');
  const {createWorker}=await import('tesseract.js');check(signal);
  onProgress({progress:8,label:'한국어 인식을 준비하고 있어요'});
  const worker=await createWorker(['kor','eng'],1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr',langPath:'/ocr',workerBlobURL:false,gzip:true});onWorker(worker);
  try{
    check(signal);await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
    const hourCrop=crop(source,{left:0,top:grid.top+2,width:Math.max(20,grid.columns[0].left-3),height:Math.min(70,grid.hourHeight*.4)});
    const hourResult=await worker.recognize(hourCrop),hour=Number(hourResult.data.text.match(/\b(?:[6-9]|1[012])\b/)?.[0])||9;
    const weekdays=[];await worker.setParameters({tessedit_pageseg_mode:'7'});
    for(const [index,col] of grid.columns.entries()){check(signal);const header=await worker.recognize(crop(source,{left:col.left+6,top:grid.headerTop+4,width:col.right-col.left-12,height:Math.max(12,grid.top-grid.headerTop-8)}));const name=header.data.text.match(/[월화수목금토일]/)?.[0];weekdays.push(name?'월화수목금토일'.indexOf(name)+1:index+1);}
    await worker.setParameters({tessedit_pageseg_mode:'6'});const rows=[];
    for(const [index,block] of grid.blocks.entries()){
      check(signal);onProgress({progress:20+Math.round(index/grid.blocks.length*50),label:`수업 ${index+1}/${grid.blocks.length} · 과목과 강의실을 읽고 있어요`});
      const result=await worker.recognize(crop(source,{left:block.left+4,top:block.top+2,width:block.width-8,height:block.height-4}));
      const parsed=imageTools.parseCourseText(result.data.text),vertical=result.data.text.trim().split(/\r?\n/).at(-1)?.replace(/\s/g,'');
      if(!parsed.room&&/^[|Il1]{3}$/.test(vertical))parsed.room='111';
      rows.push({...parsed,...imageTools.blockMeeting(block,grid,hour),weekday:weekdays[block.column],block,confidence:result.data.confidence,selected:true,place:null,candidates:[],review:result.data.confidence<85});
    }
    await worker.reinitialize('eng',1);await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789ABab-'});
    for(const [index,row] of rows.entries()){
      check(signal);onProgress({progress:72+Math.round(index/rows.length*18),label:'호실 숫자를 한 번 더 확인하고 있어요'});
      const block=row.block,box=imageTools.lastTextLine(block,pixels)||{left:block.left+4,top:Math.round(block.top+block.height*.68),width:block.width-8,height:Math.floor(block.height*.30)},result=await worker.recognize(crop(source,box,true));
      const basement=result.data.text.match(/-([AB]\d{3}(?:-\d{1,2})?)/i),last=result.data.text.trim().split(/\r?\n/).at(-1)?.replace(/\s/g,'');
      if(basement)row.room=basement[1].toUpperCase();else if(!row.room&&/^[AB]?\d{3}(?:-\d{1,2})?$/i.test(last||''))row.room=last.toUpperCase();
    }
    for(const row of rows){const peer=rows.find(other=>other!==row&&other.title.startsWith(row.title)&&other.title.length>row.title.length&&other.title.length-row.title.length<=2&&other.professor===row.professor);if(peer)row.title=peer.title;const same=rows.find(other=>other!==row&&other.title===row.title&&other.room);if(!row.room&&same)row.room=same.room;}
    onProgress({progress:92,label:'지도에서 강의 건물을 연결하고 있어요'});
    return {rows,grid,startHour:hour,warnings:[...(grid.cropped?['잘린 오른쪽 요일은 인식에서 제외했습니다.']:[]),'가려진 수업은 등록하지 않습니다. 요일·시간·손글씨 호실을 확인해주세요.']};
  }finally{await worker.terminate().catch(()=>{});onWorker(null);source.width=source.height=1;}
}
