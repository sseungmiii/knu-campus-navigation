import handler from '../../server/vercel-handler.cjs';
export const config={maxDuration:20};
export default function endpoint(req,res){return handler.handleApi('meals',req,res);}
