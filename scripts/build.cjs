const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
fs.mkdirSync(output, {recursive: true});
// Copy only public assets. Server environment and source are excluded.
for (const asset of ['index.html', 'src', 'data']) fs.cpSync(path.join(root, asset), path.join(output, asset), {recursive: true});
console.log('Built public assets in dist; server code and environment files excluded.');
