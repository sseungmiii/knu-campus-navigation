const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public', 'map');
fs.mkdirSync(output, {recursive: true});
for (const asset of ['index.html', 'src', 'data']) fs.cpSync(path.join(root, asset), path.join(output, asset), {recursive: true});
const entry = path.join(output, 'index.html');
fs.writeFileSync(entry, fs.readFileSync(entry, 'utf8').replace('시간표 연동은 다음 단계에서 제공됩니다.', '내 시간표에서 강의 장소를 선택해 길찾기를 시작하세요.'));
console.log('Prepared existing Kakao map assets; no environment or server files copied.');
