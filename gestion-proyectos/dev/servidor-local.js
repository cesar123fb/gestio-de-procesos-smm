/**
 * Servidor de prueba local: ejecuta Code.gs con una simulación en memoria de
 * SpreadsheetApp / DriveApp / etc. y sirve la interfaz en http://localhost:8080
 *
 *   node dev/servidor-local.js [--demo]
 *
 * No se sube a Apps Script (ver .claspignore). Solo sirve para probar.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8080);
const TZ_OFFSET_MIN = -300; // America/Lima

/* ---------- Simulación de servicios de Google ---------- */
function makeSheet(name) {
  const data = [];
  const sh = {
    _data: data,
    getName: () => name,
    getLastRow: () => data.length,
    getLastColumn: () => data.reduce((m, r) => Math.max(m, r.length), 0),
    getRange: (row, col, nr = 1, nc = 1) => range(data, row, col, nr, nc),
    appendRow: (vals) => { data.push(vals.slice()); return sh; },
    deleteRow: (r) => { data.splice(r - 1, 1); },
    setFrozenRows: () => sh
  };
  return sh;
}
function range(data, row, col, nr, nc) {
  const r = {
    getValues: () => {
      const out = [];
      for (let i = 0; i < nr; i++) {
        const src = data[row - 1 + i] || [];
        const line = [];
        for (let j = 0; j < nc; j++) { const v = src[col - 1 + j]; line.push(v === undefined ? '' : v); }
        out.push(line);
      }
      return out;
    },
    setValues: (vals) => {
      for (let i = 0; i < nr; i++) {
        while (data.length < row + i) data.push([]);
        const line = data[row - 1 + i];
        for (let j = 0; j < nc; j++) line[col - 1 + j] = vals[i][j];
      }
      return r;
    },
    setFontWeight: () => r, setBackground: () => r
  };
  return r;
}
const sheets = {};
const spreadsheet = {
  getSheetByName: (n) => sheets[n] || null,
  insertSheet: (n) => (sheets[n] = makeSheet(n)),
  getSpreadsheetTimeZone: () => 'America/Lima',
  getUrl: () => 'https://docs.google.com/spreadsheets/d/DEMO'
};
const uploadsDir = path.join(__dirname, 'uploads');
const files = {};
function makeFolder(name) {
  const id = 'fld_' + crypto.randomBytes(4).toString('hex');
  const folder = {
    getId: () => id, getName: () => name,
    createFolder: (n) => { const f = makeFolder(n); return f; },
    createFile: (blob) => {
      fs.mkdirSync(uploadsDir, { recursive: true });
      const fid = 'file_' + crypto.randomBytes(4).toString('hex');
      const fname = fid + '_' + blob._name.replace(/[^\w.\- ]/g, '_');
      fs.writeFileSync(path.join(uploadsDir, fname), blob._bytes);
      files[fid] = fname;
      return { getId: () => fid, getUrl: () => '/uploads/' + encodeURIComponent(fname) };
    }
  };
  folders[id] = folder;
  return folder;
}
const folders = {};
const props = {};

function pad(n) { return String(n).padStart(2, '0'); }
const sandbox = {
  console,
  SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, openById: () => spreadsheet, getUi: () => null },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  Session: { getActiveUser: () => ({ getEmail: () => 'usuario@ejemplo.com' }) },
  DriveApp: {
    createFolder: (n) => makeFolder(n),
    getFolderById: (id) => { if (!folders[id]) throw new Error('not found'); return folders[id]; }
  },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    base64Decode: (s) => Buffer.from(s, 'base64'),
    newBlob: (bytes, mime, name) => ({ _bytes: bytes, _mime: mime, _name: name }),
    formatDate: (d, tz, fmt) => {
      const x = new Date(d.getTime() + TZ_OFFSET_MIN * 60000);
      const date = x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate());
      if (fmt === 'yyyy-MM-dd') return date;
      return date + 'T' + pad(x.getUTCHours()) + ':' + pad(x.getUTCMinutes()) + ':' + pad(x.getUTCSeconds());
    }
  },
  HtmlService: {
    createHtmlOutputFromFile: (n) => ({ getContent: () => fs.readFileSync(path.join(ROOT, n + '.html'), 'utf8') })
  }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8'), sandbox, { filename: 'Code.gs' });
sandbox.setup();
const call = (fn, ...args) => JSON.parse(JSON.stringify(vm.runInContext(fn, sandbox)(...args)));

if (process.argv.includes('--demo')) require('./datos-demo')(call, sandbox);

/* ---------- Página ---------- */
const SHIM = `<script>
window.google = { script: {
  run: (function make(ok, fail) {
    return new Proxy({}, { get: function (_, fn) {
      if (fn === 'withSuccessHandler') return function (h) { return make(h, fail); };
      if (fn === 'withFailureHandler') return function (h) { return make(ok, h); };
      return function () {
        fetch('/rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([].slice.call(arguments)) })
          .then(function (r) { return r.json(); })
          .then(function (j) { if (j.error) { fail && fail(new Error(j.error)); } else { ok && ok(j.result); } })
          .catch(function (e) { fail && fail(e); });
      };
    } });
  })(null, null),
  history: { push: function (s) { history.pushState(s, ''); },
    setChangeHandler: function (h) { window.addEventListener('popstate', function (e) { h({ state: e.state }); }); } }
} };
</script>`;
function page() {
  let html = fs.readFileSync(path.join(ROOT, 'Index.html'), 'utf8');
  html = html.replace(/<\?!=\s*include\('(\w+)'\);\s*\?>/g, (_, n) =>
    (n === 'App' ? SHIM : '') + fs.readFileSync(path.join(ROOT, n + '.html'), 'utf8'));
  return html;
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/rpc/')) {
    const fn = req.url.slice(5);
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      try {
        if (!/^[a-zA-Z]+$/.test(fn) || typeof sandbox[fn] !== 'function') throw new Error('Función desconocida: ' + fn);
        res.end(JSON.stringify({ result: call(fn, ...JSON.parse(body || '[]')) }));
      } catch (e) {
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  if (req.url.startsWith('/uploads/')) {
    const f = path.join(uploadsDir, path.basename(decodeURIComponent(req.url.slice(9))));
    if (fs.existsSync(f)) return fs.createReadStream(f).pipe(res);
    res.statusCode = 404; return res.end();
  }
  if (req.url === '/sheets.json') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(Object.fromEntries(Object.entries(sheets).map(([k, v]) => [k, v._data]))));
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(page());
}).listen(PORT, () => console.log('Servidor de prueba en http://localhost:' + PORT));
