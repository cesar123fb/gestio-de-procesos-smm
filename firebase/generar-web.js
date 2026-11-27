/**
 * Arma la versión web con Firebase en ../docs/index.html usando la MISMA interfaz que la versión
 * Apps Script (gestion-proyectos/Styles.html + Index.html + App.html) y la capa firebase-db.js.
 *
 *   node firebase/generar-web.js                → docs/index.html (SDK de Firebase desde gstatic)
 *   node firebase/generar-web.js --sdk=/ruta/   → usa el SDK desde otra ruta (pruebas locales)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const UI = path.join(ROOT, 'gestion-proyectos');
const OUT = path.join(ROOT, 'docs');
const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=').slice(1).join('=');
const SDK = arg('sdk') || 'https://www.gstatic.com/firebasejs/10.14.1/';
const out = arg('out') || path.join(OUT, 'index.html');

const read = (f) => fs.readFileSync(f, 'utf8');
const styles = read(path.join(UI, 'Styles.html'));
const app = read(path.join(UI, 'App.html'));
const body = read(path.join(UI, 'Index.html')).split('<body>')[1].split('</body>')[0]
  .replace(/\s*<script>window\.BOOT = <\?!=\s*boot\s*\?>;<\/script>/, '')
  .replace(/\s*<\?!=\s*include\('App'\);\s*\?>/, '');
if (body.includes('<?')) throw new Error('Quedó un scriptlet de Apps Script en Index.html');
const dbLayer = read(path.join(__dirname, 'firebase-db.js'));

const sdk = ['app', 'auth', 'firestore', 'storage'].map((m) =>
  '<script src="' + SDK + 'firebase-' + m + '-compat.js"></script>').join('\n  ');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#1e3a8a">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>Gestión de Proyectos</title>
  <link rel="manifest" href="manifest.json">
  <link rel="icon" href="icono.svg" type="image/svg+xml">
  ${styles}
</head>
<body>
${body}
  ${sdk}
  <script src="firebase-config.js"></script>
  <script>
${dbLayer}
  </script>
  ${app}
</body>
</html>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);

// Archivos de apoyo (solo se crean si no existen, para no pisar tu configuración)
const dir = path.dirname(out);
const ensure = (name, content) => { const f = path.join(dir, name); if (!fs.existsSync(f)) fs.writeFileSync(f, content); };
ensure('firebase-config.js', `// Configuración web de tu proyecto de Firebase.
// La copias de: Consola de Firebase → ⚙ Configuración del proyecto → Tus apps → App web → "Configuración del SDK".
// Estos datos no son secretos: la seguridad la dan las reglas de Firestore y Storage.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAe0UIel7Q-0LJZhH4mexFA2KqXpP5xU_M",
  authDomain: "proyect-management-c27ab.firebaseapp.com",
  projectId: "proyect-management-c27ab",
  storageBucket: "proyect-management-c27ab.firebasestorage.app",
  messagingSenderId: "205245994641",
  appId: "1:205245994641:web:6526e83a61bc2771501130"
};
`);
ensure('manifest.json', JSON.stringify({
  name: 'Gestión de Proyectos', short_name: 'Proyectos', start_url: './', display: 'standalone',
  background_color: '#f4f6fb', theme_color: '#1e3a8a',
  icons: [{ src: 'icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
}, null, 2) + '\n');
ensure('icono.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#1e3a8a"/>' +
  '<path d="M150 360l70-70 40 40 100-120" fill="none" stroke="#fff" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<circle cx="360" cy="150" r="34" fill="#fbbf24"/></svg>\n');
ensure('.nojekyll', '');
console.log('Web generada en ' + out);
