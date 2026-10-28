const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const handlers={},elements={},classes=new Set();
const element=()=>({style:{setProperty(k,v){this[k]=v;}},setAttribute(k,v){this[k]=v;},setPointerCapture(){},offsetHeight:300,scrollTop:42});
const panel=element(),body={style:element().style,classList:{toggle(k,v){v?classes.add(k):classes.delete(k);},remove(...ks){ks.forEach(k=>classes.delete(k));}}};
const ctx=vm.createContext({document:{documentElement:{clientHeight:700},body,querySelector:()=>panel},window:{addEventListener:(k,fn)=>handlers[k]=fn},$:id=>elements[id]??=(element()),querySchoolArea(){throw Error('Resize must not search');},showPurpose(){},map:{refresh(){}},leaveSchoolFacilities(){}});
vm.runInContext(fs.readFileSync(require.resolve('../src/panel-sheet.js'),'utf8'),ctx);
vm.runInContext("initPanelSheet();sheetController.open('facilities')",ctx);
const handle=elements.schoolSheetHandle;
function drag(from,to){handle.onpointerdown({button:0,clientY:from,pointerId:1});handle.onpointermove({clientY:to,pointerId:1});handle.onpointerup({clientY:to,pointerId:1});handle.onclick();}
drag(400,320);assert.equal(panel.style['--sheet-height'],'430px');
drag(400,220);assert.equal(panel.style['--sheet-height'],'628px');
drag(100,620);assert.equal(panel.style['--sheet-height'],'84px');
handle.onkeydown({key:'End',preventDefault(){}});assert.equal(panel.style['--sheet-height'],'628px');
vm.runInContext("sheetController.open('route')",ctx);assert.equal(panel.style['--sheet-height'],'350px');
drag(400,350);assert.equal(panel.style['--sheet-height'],'400px');
vm.runInContext("sheetController.open('facilities')",ctx);assert.equal(panel.style['--sheet-height'],'628px');
ctx.document.documentElement.clientHeight=500;handlers.resize();assert.equal(panel.style['--sheet-height'],'428px');
handle.onpointerdown({button:0,clientY:100,pointerId:1});handle.onpointermove({clientY:300,pointerId:1});handle.onpointercancel();assert.equal(panel.style['--sheet-height'],'428px');
console.log('PASS: arbitrary sheet height, endpoint snapping, independent route height, keyboard, resize and cancellation without map/search changes');
