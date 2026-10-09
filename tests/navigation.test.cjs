const assert = require('node:assert/strict');
const {routeDistance, findCampusRoute, kakaoDirectionsUrl} = require('../src/navigation-utils.js');
const nodes = {a: [35, 128], b: [35, 128.001], c: [35, 128.002], d: [36, 128]};
const edges = [
  {from: 'a', to: 'b', points: [nodes.a, nodes.b], indoor: true},
  {from: 'b', to: 'c', points: [nodes.b, nodes.c]},
  {from: 'a', to: 'c', points: [nodes.a, [35.001, 128.001], nodes.c]}
];
assert.deepEqual(findCampusRoute(nodes, edges, 'a', 'c').ids, ['a', 'b', 'c']);
assert.deepEqual(findCampusRoute(nodes, edges, 'c', 'a').ids, ['c', 'b', 'a']);
assert.deepEqual(findCampusRoute(nodes, edges, 'a', 'c', true).ids, ['a', 'c']);
assert.equal(findCampusRoute(nodes, edges, 'a', 'd'), null);
assert.equal(findCampusRoute(nodes, edges, 'a', 'unknown'), null);
assert.deepEqual(findCampusRoute(nodes, edges, 'a', 'a').points, [nodes.a]);
assert.equal(routeDistance([nodes.a, nodes.a]), 0);
assert.ok(Math.abs(routeDistance([[0, 0], [0, 1]]) - 111195) < 1);
const url = kakaoDirectionsUrl({name: '출발 / ? #', coords: nodes.a}, {name: '도착', coords: nodes.c}, 'walk');
assert.ok(url.startsWith('https://map.kakao.com/link/by/walk/'));
assert.ok(url.includes(encodeURIComponent('출발 / ? #')));
assert.throws(() => kakaoDirectionsUrl({}, {}, 'bad'), /Unsupported/);
console.log('PASS: shortest route, reverse route, indoor exclusion, unreachable endpoints, distances and Kakao links');
