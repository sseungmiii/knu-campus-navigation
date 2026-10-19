const assert=require('node:assert/strict');
const {transitCandidates,transitMetrics,transitStepStyle}=require('../src/mobility-utils.js');
const {normalizeTransit}=require('../server/mobility.cjs');
const step=(type,duration,distance,vehicles=[])=>({type,duration,distance,vehicles,points:[[35.88,128.61],[35.89,128.62]],stops:['승차','하차']});
const routes=[
  {providerRank:0,duration:600,transfers:1,steps:[step('BUS',200,1000,['937']),step('WALKING',100,80),step('SUBWAY',200,1000,['2호선'])]},
  {providerRank:1,duration:900,transfers:0,steps:[step('WALKING',200,150),step('BUS',500,1500,['410'])]},
  {providerRank:2,duration:1200,transfers:0,steps:[step('WALKING',20,10),step('SUBWAY',1000,2000,['1호선'])]},
  {providerRank:3,duration:300,transfers:1,connectionsComplete:false,steps:[step('BUS',100,500),step('SUBWAY',100,1000)]}
];
const ranks=result=>result.map(route=>route.providerRank);
assert.deepEqual(ranks(transitCandidates(routes)),[1,2,3,0],'Default selects no-transfer routes before faster transfer routes');
assert.deepEqual(ranks(transitCandidates(routes,'ALL','TIME')),[3,0,1,2]);
assert.deepEqual(ranks(transitCandidates(routes,'ALL','WALK')),[2,0,1,3],'Unknown walking connections must not sort as zero walking');
assert.deepEqual(ranks(transitCandidates([...routes].reverse(),'ALL','RECOMMENDED')),[0,1,2,3]);
assert.deepEqual(ranks(transitCandidates(routes,'BUS')),[1]);
assert.deepEqual(ranks(transitCandidates(routes,'SUBWAY')),[2]);
assert.deepEqual(ranks(transitCandidates(routes,'BUS_AND_SUBWAY')),[3,0]);
assert.equal(transitMetrics(routes[1]).walkingDistance,150);
assert.equal(transitMetrics({...routes[0],transfers:undefined}).transfers,1);
assert.notEqual(transitStepStyle(step('SUBWAY',60,1,['1호선'])).color,transitStepStyle(step('SUBWAY',60,1,['2호선'])).color);
assert.notEqual(transitStepStyle(step('BUS',60,1)).color,transitStepStyle(step('WALKING',60,1)).color);
const source={status:'OK',routes:Array.from({length:8},(_,index)=>({properties:{totalTime:1000-index*100,transfers:index===7?0:1,totalDistance:1000},steps:[{properties:{type:'BUS',time:100,distance:1000,vehicles:[{name:'937',type:'간선'}]},path:{points:[[128.61,35.88],[128.62,35.89]]}}]}))};
const normalized=normalizeTransit(source);
assert.equal(normalized.routes.length,8,'Do not discard later routes before user sorting/filtering');
assert.deepEqual(normalized.routes.map(route=>route.providerRank),[0,1,2,3,4,5,6,7]);
assert.equal(transitCandidates(normalized.routes)[0].providerRank,7,'Previously truncated direct route is selectable first');
assert.equal(normalized.routes[0].steps[0].vehicleDetails[0].type,'간선');
const repeated=structuredClone(source);repeated.routes[0].steps[0].properties.vehicles.push({name:'937',type:'간선'});
assert.deepEqual(normalizeTransit(repeated).routes[0].steps[0].vehicles,['937']);
assert.throws(()=>normalizeTransit({status:'OK',routes:[]}),error=>error.code==='NO_ROUTE');
console.log('PASS: all transit candidates retained, direct route priority, provider order, mode filters, four sorts, unknown walking and per-mode/line colors');
