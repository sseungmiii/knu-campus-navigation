const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public', 'map');
fs.mkdirSync(output, {recursive: true});
for (const asset of ['index.html', 'src', 'data']) fs.cpSync(path.join(root, asset), path.join(output, asset), {recursive: true});
const entry = path.join(output, 'index.html');
fs.writeFileSync(entry, fs.readFileSync(entry, 'utf8').replace('시간표 연동은 다음 단계에서 제공됩니다.', '내 시간표에서 강의 장소를 선택해 길찾기를 시작하세요.'));
console.log('Prepared existing Kakao map assets; no environment or server files copied.');
const ocr=path.join(root,'public','ocr');fs.mkdirSync(ocr,{recursive:true});
fs.copyFileSync(require.resolve('tesseract.js/dist/worker.min.js'),path.join(ocr,'worker.min.js'));
for(const file of fs.readdirSync(path.join(root,'node_modules','tesseract.js-core')).filter(name=>/^tesseract-core.*\.wasm(?:\.js)?$/.test(name)))fs.copyFileSync(path.join(root,'node_modules','tesseract.js-core',file),path.join(ocr,file));
for(const language of ['kor','eng'])fs.copyFileSync(path.join(root,'node_modules','@tesseract.js-data',language,'4.0.0_best_int',`${language}.traineddata.gz`),path.join(ocr,`${language}.traineddata.gz`));
for(const [folder,label] of [['tesseract.js','tesseract-js'],['tesseract.js-core','tesseract-core'],['@tesseract.js-data/kor','kor'],['@tesseract.js-data/eng','eng']]){
  const directory=path.join(root,'node_modules',folder);
  for(const file of fs.readdirSync(directory).filter(name=>/^(license|copying|notice)/i.test(name)))if(fs.statSync(path.join(directory,file)).isFile())fs.copyFileSync(path.join(directory,file),path.join(ocr,`${label}-${file}`));
}
console.log('Prepared local Korean/English OCR workers and language assets.');
