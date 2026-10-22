const assert=require('node:assert/strict'),{validateFavorite,departureAt,calendarLayout}=require('../lib/class-trip.cjs');
const route={start:{name:'집',coords:[35.87,128.6]},mode:'transit',routeMode:'BROAD_FIRST',duration:1800,signature:'BUS:937:123',indoorMinutes:3,safetyMinutes:5};
assert.deepEqual(validateFavorite({...route,token:'ignored'}),route);assert.equal(validateFavorite(null),null);
for(const value of [{...route,start:{name:'x',coords:[Infinity,128]}},{...route,duration:-1},{...route,indoorMinutes:999},{...route,mode:'unknown'},{...route,signature:'x'.repeat(501)}])assert.throws(()=>validateFavorite(value));
assert.equal(new Date(departureAt('2026-10-26T09:00:00+09:00',route)).toISOString(),'2026-10-25T23:22:00.000Z');
assert.equal(departureAt(null,route),null);
const rows=[{id:'a',weekday:1,start_minute:540,end_minute:615},{id:'b',weekday:1,start_minute:600,end_minute:675},{id:'c',weekday:1,start_minute:675,end_minute:750},{id:'d',weekday:2,start_minute:540,end_minute:615},{id:'weekend',weekday:6,start_minute:540,end_minute:615}];
const layout=calendarLayout(rows);assert.equal(layout.length,4);assert.equal(layout.find(row=>row.id==='a').lanes,2);assert.equal(layout.find(row=>row.id==='b').lane,1);assert.equal(layout.find(row=>row.id==='c').lanes,1);assert.equal(layout.find(row=>row.id==='d').lane,0);
console.log('PASS: favorite validation, stripped fields, KST departure math, calendar overlap lanes and weekend separation');
