import backend from '../../server/vercel-handler.cjs';
export const maxDuration = 20;
export default function handler(req, res) { return backend.handleApi('search', req, res); }
