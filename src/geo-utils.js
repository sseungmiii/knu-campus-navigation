function metersBetween(a, b) {
  const rad = x => x * Math.PI / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)));
}
function makeRouteMetrics(points) {
  if (!Array.isArray(points) || points.length < 2 || points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180)) throw new Error('유효한 경로 좌표가 없습니다.');
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + metersBetween(points[i - 1], points[i]));
  if (cumulative.at(-1) < 1) throw new Error('출발지와 도착지가 너무 가깝습니다.');
  return {points, cumulative, total: cumulative.at(-1)};
}
function pointAtMeters(metrics, meters) {
  const distance = Math.max(0, Math.min(metrics.total, meters));
  for (let i = 1; i < metrics.points.length; i++) {
    if (metrics.cumulative[i] >= distance && metrics.cumulative[i] > metrics.cumulative[i - 1]) {
      const ratio = (distance - metrics.cumulative[i - 1]) / (metrics.cumulative[i] - metrics.cumulative[i - 1]);
      return metrics.points[i - 1].map((value, axis) => value + (metrics.points[i][axis] - value) * ratio);
    }
  }
  return metrics.points.at(-1);
}
function projectOnRoute(metrics, point, previous = 0) {
  const scale = Math.cos(point[0] * Math.PI / 180);
  let best = null;
  for (let i = 1; i < metrics.points.length; i++) {
    const a = metrics.points[i - 1], b = metrics.points[i];
    const dx = (b[1] - a[1]) * scale, dy = b[0] - a[0];
    const px = (point[1] - a[1]) * scale, py = point[0] - a[0];
    const ratio = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1)));
    const projected = [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
    const offset = metersBetween(point, projected);
    const distance = metrics.cumulative[i - 1] + (metrics.cumulative[i] - metrics.cumulative[i - 1]) * ratio;
    if (!best || offset < best.offset - 1 || (Math.abs(offset - best.offset) <= 1 && Math.abs(distance - previous) < Math.abs(best.distance - previous))) best = {point: projected, offset, distance};
  }
  return best;
}
function validLocation(position, now = Date.now()) {
  const c = position?.coords;
  return Boolean(c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude) && Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180 && Number.isFinite(c.accuracy) && c.accuracy >= 0 && c.accuracy <= 60 && Number.isFinite(position.timestamp) && now - position.timestamp < 15000 && position.timestamp <= now + 1000);
}
if (typeof module !== 'undefined') module.exports = {metersBetween, makeRouteMetrics, pointAtMeters, projectOnRoute, validLocation};
