const catalog=require('../data/campus-registry.json'),registry=require('../src/campus-registry.js');
function localSearch(query){return registry.search(catalog,query);}
module.exports={localSearch,catalog};
