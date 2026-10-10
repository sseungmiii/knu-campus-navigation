import backend from '../../server/vercel-handler.cjs';
export const config = {api: {bodyParser: {sizeLimit: '4kb'}}, maxDuration: 20};
export default function handler(req, res) { return backend.handleApi('route', req, res); }
