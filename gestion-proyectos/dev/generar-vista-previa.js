/**
 * Genera una página HTML independiente con el programa funcionando en el navegador
 * (Code.gs + interfaz + datos de ejemplo, sin Google). Sirve como vista previa / demo.
 *
 *   node dev/generar-vista-previa.js salida.html
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const out = process.argv[2] || path.join(__dirname, 'vista-previa.html');

const code = read('Code.gs');
let styles = read('Styles.html');
const app = read('App.html');
let body = read('Index.html').split('<body>')[1].split('</body>')[0]
  .replace(/\s*<\?!=\s*include\('App'\);\s*\?>/, '')
  .replace(/<script>window\.BOOT = <\?!=\s*boot\s*\?>;<\/script>/, '');

// Modo oscuro según el visor y márgenes laterales seguros
const darkMatch = styles.match(/@media \(prefers-color-scheme: dark\) \{\n\s*:root \{([\s\S]*?)\}\n\s*\}/);
styles = styles.replace(darkMatch[0], '@media (prefers-color-scheme: dark) {\n    :root:not([data-theme="light"]) { color-scheme: dark;' +
  darkMatch[1] + '}\n  }\n  :root[data-theme="dark"] { color-scheme: dark;' + darkMatch[1] + '}');
styles = styles.replace('</style>', `
  .demo-note { font-size: 13px; color: var(--muted); background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 10px; padding: 8px 12px; margin-top: 14px; }
  @media (max-width: 820px) { .topbar { top: env(safe-area-inset-top, 0px); } }
</style>`);
body = body.replace('<main>', '<main><div class="demo-note">Vista previa con datos de ejemplo de una metalmecánica. ' +
  'Puedes probar todo (crear, terminar tareas, subir fotos); nada se guarda al recargar.</div>');

const fnNames = [...code.matchAll(/^function ([a-zA-Z_]+)\(/gm)].map((m) => m[1]);
const demo = fs.readFileSync(path.join(__dirname, 'datos-demo.js'), 'utf8');

const mock = `<script>
(function(){
function range(data,row,col,nr,nc){const r={getValues:function(){const o=[];for(let i=0;i<nr;i++){const s=data[row-1+i]||[];const l=[];for(let j=0;j<nc;j++){const v=s[col-1+j];l.push(v===undefined?'':v);}o.push(l);}return o;},
setValues:function(v){for(let i=0;i<nr;i++){while(data.length<row+i)data.push([]);const l=data[row-1+i];for(let j=0;j<nc;j++)l[col-1+j]=v[i][j];}return r;},setFontWeight:function(){return r;},setBackground:function(){return r;}};return r;}
function makeSheet(){const d=[];const sh={getLastRow:function(){return d.length;},getLastColumn:function(){return d.reduce(function(m,r){return Math.max(m,r.length);},0);},
getRange:function(a,b,c,e){return range(d,a,b,c||1,e||1);},getDataRange:function(){return range(d,1,1,Math.max(1,d.length),Math.max(1,sh.getLastColumn()));},appendRow:function(v){d.push(v.slice());return sh;},deleteRow:function(r){d.splice(r-1,1);},setFrozenRows:function(){return sh;}};return sh;}
const sheets={};const ss={getSheetByName:function(n){return sheets[n]||null;},insertSheet:function(n){return(sheets[n]=makeSheet());},getSpreadsheetTimeZone:function(){return 'local';},getUrl:function(){return '';}};
const folders={},props={};let n=0;
function folder(){const id='f'+(++n);const f={getId:function(){return id;},createFolder:function(){return folder();},createFile:function(b){const url=URL.createObjectURL(new Blob([b.bytes],{type:b.mime}));const fid='file'+(++n);return{getId:function(){return fid;},getUrl:function(){return url;}};}};folders[id]=f;return f;}
function pad(x){return String(x).padStart(2,'0');}
window.SpreadsheetApp={getActiveSpreadsheet:function(){return ss;},openById:function(){return ss;}};
window.PropertiesService={getScriptProperties:function(){return{getProperty:function(k){return props[k]||null;},setProperty:function(k,v){props[k]=v;}};}};
window.LockService={getScriptLock:function(){return{waitLock:function(){},releaseLock:function(){}};}};
window.Session={getActiveUser:function(){return{getEmail:function(){return 'demo@ejemplo.com';}};}};
window.DriveApp={createFolder:function(){return folder();},getFolderById:function(id){if(!folders[id])throw new Error('x');return folders[id];}};
window.Utilities={getUuid:function(){return (crypto.randomUUID?crypto.randomUUID():(Math.random().toString(16).slice(2)+'00000000'));},
base64Decode:function(s){const b=atob(s);const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;},
newBlob:function(bytes,mime,name){return{bytes:bytes,mime:mime,name:name};},
formatDate:function(d,tz,fmt){const s=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());return fmt==='yyyy-MM-dd'?s:s+'T'+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());}};
})();
const GAS=(function(){
${code}
setup();
return {${fnNames.map((f) => f + ':' + f).join(',')}};
})();
(function(){
const module={};
${demo}
module.exports(function(fn){GAS.resetCache_();return JSON.parse(JSON.stringify(GAS[fn].apply(null,[].slice.call(arguments,1))));});
})();
window.confirm=function(){return true;};
window.google={script:{run:(function make(ok,fail){return new Proxy({},{get:function(_,fn){
if(fn==='withSuccessHandler')return function(h){return make(h,fail);};if(fn==='withFailureHandler')return function(h){return make(ok,h);};
return function(){const args=[].slice.call(arguments);setTimeout(function(){try{GAS.resetCache_();const r=JSON.parse(JSON.stringify(GAS[fn].apply(null,args)));ok&&ok(r);}catch(e){fail&&fail(e);}},120);};}});})(null,null),
history:{push:function(){},setChangeHandler:function(){}}}};
</script>`;

const head = '<title>Gestión de Proyectos</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n';
fs.writeFileSync(out, head + styles + '\n' + body + '\n' + mock + '\n' + app);
console.log('Vista previa generada en ' + out);
