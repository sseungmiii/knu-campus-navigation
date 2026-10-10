import handler from '../../server/vercel-handler.cjs';
export const config={api:{bodyParser:{sizeLimit:'4kb'}},maxDuration:60};
export default function endpoint(req,res){return handler.handleApi('transit',req,res);}
