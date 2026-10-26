const assert=require('node:assert/strict'),{groupCourses}=require('../lib/course-groups.cjs');
const course={title:'문제해결과 알고리즘',term:'2026-2',starts_on:'2026-09-01',ends_on:'2026-12-31'};
const rows=[{...course,id:'m1',weekday:2,room:'111'},{...course,title:'문제해결과알고리즘',id:'m2',weekday:4,room:'203'},{...course,term:'2027-1',id:'m3'}];
const groups=groupCourses(rows);assert.equal(groups.length,2);assert.equal(groups[0].meetings.length,2);assert.deepEqual(groups[0].indices,[0,1]);assert.deepEqual(groups[0].meetings.map(row=>row.room),['111','203']);assert.equal(rows[0].title,course.title);
console.log('PASS: one subject groups recurring meetings, preserves distinct rooms/IDs and separates semesters');
