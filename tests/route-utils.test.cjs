const assert = require('node:assert/strict');
const { getInterpolatedPoint } = require('../src/route-utils.js');
assert.deepEqual(getInterpolatedPoint([[0,0], [0,4], [3,4]], 0), [0,0]);
assert.deepEqual(getInterpolatedPoint([[0,0], [0,4], [3,4]], 1), [3,4]);
assert.deepEqual(getInterpolatedPoint([[0,0], [0,4], [3,4]], 0.5), [0,3.5]);
assert.deepEqual(getInterpolatedPoint([[1,1], [1,1]], 0.5), [1,1]);
assert.deepEqual(getInterpolatedPoint([[0,0], [0,0], [0,4]], 0.5), [0,2]);
assert.throws(() => getInterpolatedPoint([], 0.5), /at least one point/);
console.log('PASS: route endpoints, distance-based interpolation and repeated coordinates');
