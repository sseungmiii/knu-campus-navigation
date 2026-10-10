/** @type {import('next').NextConfig} */
const config = {reactStrictMode: true, async rewrites() {
  return [{source: '/api/route', destination: '/api/walk'}];
}};
export default config;
