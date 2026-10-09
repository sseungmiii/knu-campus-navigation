function sameOrigin(request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    // Next's internal URL can use localhost even when the browser uses 127.0.0.1.
    // Host preserves the requested public authority; do not trust forwarded-host.
    return source.origin === origin && source.host === host && source.protocol === target.protocol;
  } catch { return false; }
}
module.exports = {sameOrigin};
