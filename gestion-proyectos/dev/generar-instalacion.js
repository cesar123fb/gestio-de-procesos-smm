/** Junta Index + Styles + App en un solo Index.html y copia Code.gs → instalar/ (2 archivos para pegar). */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const index = read('Index.html').replace(/<\?!=\s*include\('(\w+)'\);\s*\?>/g, (_, n) => read(n + '.html'));
if (/include\(/.test(index)) throw new Error('Quedó un include sin resolver');
fs.mkdirSync(path.join(ROOT, 'instalar'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'instalar', 'Index.html'), index);
fs.writeFileSync(path.join(ROOT, 'instalar', 'Codigo.gs'), read('Code.gs'));
console.log('instalar/Codigo.gs e instalar/Index.html actualizados');
