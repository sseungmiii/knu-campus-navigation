function getInterpolatedPoint(coords, progress) {
  if (!coords.length) throw new Error('Route must have at least one point');
  if (progress <= 0) return coords[0];
  if (progress >= 1) return coords[coords.length - 1];

  let totalDist = 0;
  const segDists = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const d = Math.hypot(coords[i+1][0] - coords[i][0], coords[i+1][1] - coords[i][1]);
    segDists.push(d);
    totalDist += d;
  }

  if (totalDist === 0) return coords[0];
  let targetDist = progress * totalDist;
  let accum = 0;

  for (let i = 0; i < segDists.length; i++) {
    if (segDists[i] > 0 && accum + segDists[i] >= targetDist) {
      const segProgress = (targetDist - accum) / segDists[i];
      const lat = coords[i][0] + (coords[i+1][0] - coords[i][0]) * segProgress;
      const lng = coords[i][1] + (coords[i+1][1] - coords[i][1]) * segProgress;
      return [lat, lng];
    }
    accum += segDists[i];
  }
  return coords[coords.length - 1];
}


if (typeof module !== "undefined") module.exports = { getInterpolatedPoint };
