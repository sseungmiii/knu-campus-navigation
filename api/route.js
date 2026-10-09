const {handleApi} = require('../server/vercel-handler.cjs');
module.exports = (req, res) => handleApi('route', req, res);
