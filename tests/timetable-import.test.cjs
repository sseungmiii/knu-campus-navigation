const assert=require('node:assert/strict'),{validateClass,validateImport}=require('../lib/timetable.cjs'),image=require('../lib/timetable-image.cjs');
const row={title:'기계학습입문',term:'2026-2',weekday:3,start_minute:540,end_minute:615,display_end_minute:630,professor:'교수',room:'317',place_name:'경북대학교 IT대학1호관',latitude:35.8886,longitude:128.61,starts_on:'2026-08-01',ends_on:'2026-12-31'};
assert.equal(validateClass(row).end_minute,615);assert.equal(validateClass(row).display_end_minute,630);assert.equal(validateClass(row).room,'317');
assert.equal(validateImport({confirmed:true,classes:[row,{...row,weekday:1}]}).length,2);
for(const input of [{confirmed:false,classes:[row]},{confirmed:true,classes:[]},{confirmed:true,classes:[row,row]},{confirmed:true,classes:[{...row,display_end_minute:600}]},{confirmed:true,classes:[{...row,latitude:NaN}]},{confirmed:true,classes:Array(61).fill(row)}])assert.throws(()=>validateImport(input));
const parsed=image.parseCourseText('기계학습입문\n조대웅\n산격동 캠퍼스 IT\n대학1호관(공대1\n0호관)-317');assert.equal(parsed.title,'기계학습입문');assert.equal(parsed.room,'317');assert.equal(parsed.building,'경북대학교 IT대학1호관');
const grid={top:100,hourHeight:100};assert.deepEqual(image.blockMeeting({column:2,top:100,height:150},grid,9,15),{weekday:3,start_minute:540,end_minute:615,display_end_minute:630});assert.equal(image.blockMeeting({column:0,top:100,height:150},grid,9,0).end_minute,630);
// Synthetic dark-grid fixture: no user screenshot is committed or uploaded.
const width=460,height=800,pixels=new Uint8ClampedArray(width*height*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=pixels[i+1]=pixels[i+2]=16;pixels[i+3]=255;}
function rect(left,top,w,h,color){for(let y=top;y<top+h;y++)for(let x=left;x<left+w;x++){const at=(y*width+x)*4;pixels[at]=color[0];pixels[at+1]=color[1];pixels[at+2]=color[2];}}
for(const x of [30,130,230,330,430])rect(x,150,2,602,[50,50,50]);for(const y of [150,200,300,400,500,600,700,750])rect(0,y,460,2,[50,50,50]);rect(33,202,95,148,[110,155,172]);rect(233,402,95,148,[180,157,150]);
const detected=image.detectTimetable({data:pixels,width,height});assert.equal(detected.columns.length,4);assert.equal(detected.blocks.length,2);assert.equal(image.blockMeeting(detected.blocks[0],detected,9).end_minute,615);
console.log('PASS: confirmed atomic import validation, independent display/actual ending, building aliases and generic pixel-grid segmentation');
