import handler from '../../server/vercel-handler.cjs';
export const config={api:{bodyParser:{sizeLimit:'4kb'}},maxDuration:20};
export default function endpoint(req,res){return handler.handleApi('nearby',req,res);}
