const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={console,setTimeout,clearTimeout,window:{addEventListener(){}},document:{getElementById:()=>({})},ResizeObserver:class{observe(){}},kakao:{maps:{
  LatLng:class{},Map:class{addControl(){}},ZoomControl:class{},ControlPosition:{RIGHT:1},
  services:{Status:{OK:'OK',ZERO_RESULT:'ZERO'},Places:class{categorySearch(category,callback){
    callback([
      {id:'inside',place_name:'교내 카페',x:'128.612',y:'35.889',road_address_name:'대구 북구 대학로 80',address_name:''},
      {id:'outside',place_name:'교외 카페',x:'128.615',y:'35.885',road_address_name:'대구 북구 대학로 800',address_name:''},
      {id:'parcel',place_name:'교내 편의점',x:'128.611',y:'35.892',road_address_name:'',address_name:'대구 북구 산격동 1370-1'}
    ],'OK',{hasNextPage:false});
  }}}
}}};
vm.createContext(context);vm.runInContext(fs.readFileSync('src/map-service.js','utf8'),context);
(async()=>{
  const places=await vm.runInContext("createKakaoMap().campusPlaces('CE7')",context);
  assert.deepEqual(Array.from(places,p=>p.id),['inside','parcel'],'exclude similar street numbers and deduplicate overlapping search tiles');
  const outside=await vm.runInContext("createKakaoMap().schoolSurroundings('CE7',{south:35.88,north:35.90,west:128.60,east:128.62})",context);assert.deepEqual(Array.from(outside,p=>p.id),['outside'],'surroundings exclude verified campus addresses');
  vm.runInContext(fs.readFileSync('src/mobility-utils.js','utf8'),context);
  vm.runInContext(fs.readFileSync('src/campus-explorer.js','utf8'),context);
  for(const name of ['정보센터식당','복지관 교직원식당','카페테리아 첨성','GP감꽃식당','공학관교직원식당(외부업체)','공학관학생식당(외부업체)']){
    context.restaurant=name;
    assert.equal(vm.runInContext('campusMealPlace(restaurant).building === mealLocationQuery(restaurant)',context),true);
  }
  console.log('PASS: campus-only addresses, tile deduplication and all six meal destinations share verified pins');
})().catch(error=>{console.error(error);process.exitCode=1;});
