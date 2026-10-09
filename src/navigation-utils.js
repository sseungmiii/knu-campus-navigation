function routeDistance(points) {
  let distance = 0;
  const radians = value => value * Math.PI / 180;
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const dLat = radians(b[0] - a[0]);
    const dLng = radians(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(dLng / 2) ** 2;
    distance += 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  }
  return distance;
}

function findCampusRoute(nodes, edges, start, end, outsideOnly = false) {
  if (!nodes[start] || !nodes[end]) return null;
  const costs = {[start]: 0};
  const previous = {};
  const remaining = new Set(Object.keys(nodes));
  while (remaining.size) {
    const current = [...remaining].reduce((a, b) => (costs[a] ?? Infinity) <= (costs[b] ?? Infinity) ? a : b);
    if (!Number.isFinite(costs[current])) break;
    if (current === end) {
      const segments = [];
      const ids = [end];
      let cursor = end;
      while (cursor !== start) {
        const step = previous[cursor];
        segments.unshift(step.points);
        cursor = step.from;
        ids.unshift(cursor);
      }
      const points = segments.length ? segments.flatMap((path, index) => index ? path.slice(1) : path) : [nodes[start]];
      return {distance: costs[end], points, ids};
    }
    remaining.delete(current);
    for (const edge of edges) {
      if (outsideOnly && edge.indoor) continue;
      const next = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (!next || !remaining.has(next)) continue;
      const points = edge.from === current ? edge.points : [...edge.points].reverse();
      const cost = costs[current] + routeDistance(points);
      if (cost < (costs[next] ?? Infinity)) { costs[next] = cost; previous[next] = {from: current, points}; }
    }
  }
  return null;
}

function kakaoDirectionsUrl(start, end, mode) {
  if (!['walk', 'traffic'].includes(mode)) throw new Error('Unsupported travel mode');
  const endpoint = place => `${encodeURIComponent(place.name)},${place.coords.join(',')}`;
  return `https://map.kakao.com/link/by/${mode}/${endpoint(start)}/${endpoint(end)}`;
}

if (typeof module !== 'undefined') module.exports = {routeDistance, findCampusRoute, kakaoDirectionsUrl};
