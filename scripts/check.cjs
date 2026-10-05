const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
for (const name of fs.readdirSync(path.join(root, 'src')).filter(name => name.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(path.join(root, 'src', name), 'utf8'), {filename:name});
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)) {
  if (!fs.existsSync(path.join(root, match[1]))) throw new Error(`Missing asset: ${match[1]}`);
}
JSON.parse(fs.readFileSync(path.join(root, 'data/menu.sample.json'), 'utf8'));
console.log('PASS: JavaScript syntax, local asset paths and sample JSON');
