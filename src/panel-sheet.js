// Shared by school facilities and the route planner. Resizing never moves the map.
function sheetLimits(height){const max=Math.max(84,height-72);return {min:84,max,snap:Math.min(48,(max-84)*.12)};}
function sheetHeight(value,limits,snap=false){const h=Math.max(limits.min,Math.min(limits.max,value));return snap&&h-limits.min<=limits.snap?limits.min:snap&&limits.max-h<=limits.snap?limits.max:h;}
let sheetController;
function initPanelSheet(){
 const panel=document.querySelector('.route-panel'),handle=$('schoolSheetHandle'),heights={};let key='facilities',drag=null,moved=false;
 const limits=()=>sheetLimits(document.documentElement.clientHeight);
 const apply=(height,snap=false)=>{const range=limits(),value=sheetHeight(height,range,snap);heights[key]=value;document.body.classList.toggle('sheet-tall',value>document.documentElement.clientHeight-220);panel.style.setProperty('--sheet-height',value+'px');document.body.style.setProperty('--sheet-height',value+'px');document.body.classList.toggle('sheet-minimized',value===range.min);handle.setAttribute('aria-expanded',String(value>range.min));handle.setAttribute('aria-label',value===range.min?'패널 펼치기':'패널 높이 조절 · 클릭하면 접기');if(value===range.min)panel.scrollTop=0;};
 sheetController={open(name){key=name;apply(heights[key]??document.documentElement.clientHeight*.5);},resize(){apply(heights[key]??document.documentElement.clientHeight*.5);}};
 handle.onclick=()=>{if(moved){moved=false;return;}const range=limits();apply(heights[key]<=range.min?document.documentElement.clientHeight*.5:range.min);};
 handle.onpointerdown=event=>{if(event.button!==0)return;drag={y:event.clientY,height:heights[key]??panel.offsetHeight,id:event.pointerId};moved=false;handle.setPointerCapture(event.pointerId);};
 handle.onpointermove=event=>{if(!drag||event.pointerId!==drag.id)return;if(Math.abs(event.clientY-drag.y)>5)moved=true;apply(drag.height+drag.y-event.clientY);};
 handle.onpointerup=event=>{if(!drag||event.pointerId!==drag.id)return;if(moved)apply(drag.height+drag.y-event.clientY,true);drag=null;};
 handle.onpointercancel=()=>{if(drag)apply(drag.height);drag=null;moved=false;};
 handle.onkeydown=event=>{const range=limits(),h=heights[key]??range.min;const value=event.key==='Home'?range.min:event.key==='End'?range.max:event.key==='ArrowUp'?h+32:event.key==='ArrowDown'?h-32:null;if(value!==null){event.preventDefault();apply(value);}};
 window.addEventListener('resize',()=>sheetController.resize());
 $('openRoute').onclick=()=>showPurpose('route');
 $('mapResearch').onclick=querySchoolArea;
}
function showRouteMap(){
 document.body.classList.remove('panel-open','school-sheet','resizable-sheet','sheet-minimized','sheet-tall');
 if(typeof leaveSchoolFacilities==='function')leaveSchoolFacilities();
 map.refresh?.();
}
