/**
 * GESTIÓN DE PROYECTOS — Backend (Google Apps Script)
 * ---------------------------------------------------
 * Datos en Google Sheets (una hoja por tabla) y archivos en Google Drive.
 * Ver README.md para la instalación paso a paso.
 */

const APP_NAME = 'Gestión de Proyectos';
const DRIVE_ROOT_NAME = 'Gestión de Proyectos - Archivos';

const SCHEMA = {
  Proyectos: ['id', 'codigo', 'nombre', 'cliente', 'responsable', 'fechaInicio', 'fechaFin',
    'presupuesto', 'moneda', 'estado', 'avance', 'descripcion', 'carpetaId', 'creado', 'actualizado'],
  Etapas: ['id', 'proyectoId', 'orden', 'nombre', 'fechaInicio', 'fechaFin', 'estado', 'avance',
    'creado', 'actualizado'],
  Actividades: ['id', 'proyectoId', 'etapaId', 'titulo', 'responsable', 'fechaLimite', 'prioridad',
    'estado', 'notas', 'completadoEn', 'creado', 'actualizado'],
  Documentos: ['id', 'proyectoId', 'tipo', 'numero', 'contraparte', 'fecha', 'monto', 'moneda',
    'estado', 'referenciaId', 'archivoUrl', 'archivoId', 'archivoNombre', 'notas', 'creado', 'actualizado'],
  Historial: ['fecha', 'usuario', 'entidad', 'entidadId', 'proyectoId', 'accion', 'detalle'],
  Config: ['clave', 'valor']
};

const DEFAULT_CONFIG = {
  empresa: 'Mi Empresa',
  moneda: 'PEN',
  etapasPlantilla: 'Planificación, Cotización, Aprobación, Ejecución, Entrega, Cierre',
  responsables: ''
};

const DATE_FIELDS = ['fechaInicio', 'fechaFin', 'fechaLimite', 'fecha'];
const NUMBER_FIELDS = ['presupuesto', 'monto', 'orden', 'avance'];

/* ======================= Web app ======================= */

function doGet() {
  setup();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(getConfigValue_('empresa') + ' · Proyectos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .addMetaTag('apple-mobile-web-app-capable', 'yes');
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Menú dentro de la hoja de cálculo. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(APP_NAME)
    .addItem('Preparar hojas', 'setup')
    .addItem('Recalcular avances', 'recalcularTodo')
    .addToUi();
}

/** Crea las hojas y encabezados que falten. Seguro de ejecutar varias veces. */
function setup() {
  const ss = ss_();
  Object.keys(SCHEMA).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SCHEMA[name];
    const current = sh.getLastColumn() > 0
      ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String)
      : [];
    // Añade columnas nuevas al final sin borrar datos existentes
    const missing = headers.filter(function (h) { return current.indexOf(h) === -1; });
    if (current.length === 0 || missing.length) {
      if (current.length === 0) {
        sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      } else {
        sh.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
      }
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#e8eefc');
    }
  });
  const cfg = getConfig_();
  Object.keys(DEFAULT_CONFIG).forEach(function (k) {
    if (!(k in cfg)) appendRow_('Config', { clave: k, valor: DEFAULT_CONFIG[k] });
  });
  return true;
}

/* ======================= API pública (cliente) ======================= */

function getData() {
  return {
    proyectos: readAll_('Proyectos'),
    etapas: readAll_('Etapas'),
    actividades: readAll_('Actividades'),
    documentos: readAll_('Documentos'),
    config: getConfig_(),
    usuario: currentUser_(),
    hojaUrl: ss_().getUrl(),
    hoy: today_()
  };
}

function saveConfig(cfg) {
  return withLock_(function () {
    Object.keys(cfg || {}).forEach(function (k) {
      if (!(k in DEFAULT_CONFIG)) return;
      const rows = readAll_('Config');
      const row = rows.filter(function (r) { return r.clave === k; })[0];
      if (row) updateWhere_('Config', 'clave', k, { clave: k, valor: String(cfg[k]) });
      else appendRow_('Config', { clave: k, valor: String(cfg[k]) });
    });
    return getData();
  });
}

function saveProyecto(p, crearEtapas) {
  return withLock_(function () {
    requireText_(p.nombre, 'El nombre del proyecto es obligatorio');
    const isNew = !p.id;
    const rec = pick_(p, SCHEMA.Proyectos);
    rec.estado = rec.estado || 'Planificación';
    rec.moneda = rec.moneda || getConfigValue_('moneda');
    if (isNew) {
      rec.id = newId_('P');
      rec.codigo = rec.codigo || nextCodigo_();
      rec.avance = 0;
      rec.creado = now_();
    }
    rec.actualizado = now_();
    upsert_('Proyectos', rec);
    log_('Proyecto', rec.id, rec.id, isNew ? 'Creado' : 'Editado', rec.codigo + ' · ' + rec.nombre);

    if (isNew && crearEtapas) {
      const nombres = String(getConfigValue_('etapasPlantilla') || '')
        .split(',').map(function (s) { return s.trim(); }).filter(String);
      nombres.forEach(function (n, i) {
        upsert_('Etapas', {
          id: newId_('E'), proyectoId: rec.id, orden: i + 1, nombre: n,
          estado: 'Pendiente', avance: 0, creado: now_(), actualizado: now_()
        });
      });
    }
    return getData();
  });
}

function deleteProyecto(id) {
  return withLock_(function () {
    const p = findById_('Proyectos', id);
    if (!p) throw new Error('Proyecto no encontrado');
    deleteWhere_('Actividades', 'proyectoId', id);
    deleteWhere_('Etapas', 'proyectoId', id);
    deleteWhere_('Documentos', 'proyectoId', id); // los archivos permanecen en Drive
    deleteWhere_('Proyectos', 'id', id);
    log_('Proyecto', id, id, 'Eliminado', p.codigo + ' · ' + p.nombre);
    return getData();
  });
}

function saveEtapa(e) {
  return withLock_(function () {
    requireText_(e.nombre, 'El nombre de la etapa es obligatorio');
    requireText_(e.proyectoId, 'Falta el proyecto');
    const isNew = !e.id;
    const rec = pick_(e, SCHEMA.Etapas);
    if (isNew) {
      rec.id = newId_('E');
      const hermanas = readAll_('Etapas').filter(function (x) { return x.proyectoId === e.proyectoId; });
      rec.orden = rec.orden || (hermanas.length + 1);
      rec.creado = now_();
      rec.estado = 'Pendiente';
      rec.avance = 0;
    }
    rec.actualizado = now_();
    upsert_('Etapas', rec);
    recalcular_(rec.proyectoId);
    log_('Etapa', rec.id, rec.proyectoId, isNew ? 'Creada' : 'Editada', rec.nombre);
    return getData();
  });
}

function moveEtapa(id, delta) {
  return withLock_(function () {
    const e = findById_('Etapas', id);
    if (!e) throw new Error('Etapa no encontrada');
    const list = readAll_('Etapas').filter(function (x) { return x.proyectoId === e.proyectoId; })
      .sort(function (a, b) { return a.orden - b.orden; });
    const i = list.findIndex(function (x) { return x.id === id; });
    const j = i + delta;
    if (j < 0 || j >= list.length) return getData();
    const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    list.forEach(function (x, k) { if (x.orden !== k + 1) { x.orden = k + 1; upsert_('Etapas', x); } });
    return getData();
  });
}

function deleteEtapa(id) {
  return withLock_(function () {
    const e = findById_('Etapas', id);
    if (!e) throw new Error('Etapa no encontrada');
    // Las actividades de la etapa quedan "sin etapa" en lugar de perderse
    readAll_('Actividades').filter(function (a) { return a.etapaId === id; }).forEach(function (a) {
      a.etapaId = ''; upsert_('Actividades', a);
    });
    deleteWhere_('Etapas', 'id', id);
    recalcular_(e.proyectoId);
    log_('Etapa', id, e.proyectoId, 'Eliminada', e.nombre);
    return getData();
  });
}

function saveActividad(a) {
  return withLock_(function () {
    requireText_(a.titulo, 'La descripción de la actividad es obligatoria');
    requireText_(a.proyectoId, 'Falta el proyecto');
    const isNew = !a.id;
    const prev = isNew ? null : findById_('Actividades', a.id);
    const rec = pick_(a, SCHEMA.Actividades);
    rec.estado = rec.estado || 'Pendiente';
    rec.prioridad = rec.prioridad || 'Media';
    if (isNew) { rec.id = newId_('A'); rec.creado = now_(); }
    if (rec.estado === 'Completada' && (!prev || prev.estado !== 'Completada')) rec.completadoEn = now_();
    if (rec.estado !== 'Completada') rec.completadoEn = '';
    rec.actualizado = now_();
    upsert_('Actividades', rec);
    recalcular_(rec.proyectoId);
    let accion = isNew ? 'Creada' : 'Editada';
    if (prev && prev.estado !== rec.estado) accion = 'Estado: ' + prev.estado + ' → ' + rec.estado;
    log_('Actividad', rec.id, rec.proyectoId, accion, rec.titulo);
    return getData();
  });
}

function setEstadoActividad(id, estado) {
  const a = findById_('Actividades', id);
  if (!a) throw new Error('Actividad no encontrada');
  a.estado = estado;
  return saveActividad(a);
}

function deleteActividad(id) {
  return withLock_(function () {
    const a = findById_('Actividades', id);
    if (!a) throw new Error('Actividad no encontrada');
    deleteWhere_('Actividades', 'id', id);
    recalcular_(a.proyectoId);
    log_('Actividad', id, a.proyectoId, 'Eliminada', a.titulo);
    return getData();
  });
}

/**
 * Guarda una cotización / orden de compra / factura / otro documento.
 * file (opcional): { name, mimeType, data } con data en base64.
 */
function saveDocumento(d, file) {
  return withLock_(function () {
    requireText_(d.tipo, 'El tipo de documento es obligatorio');
    requireText_(d.proyectoId, 'Falta el proyecto');
    const isNew = !d.id;
    const prev = isNew ? null : findById_('Documentos', d.id);
    const rec = pick_(d, SCHEMA.Documentos);
    rec.moneda = rec.moneda || getConfigValue_('moneda');
    if (isNew) { rec.id = newId_('D'); rec.creado = now_(); }
    if (prev) {
      // conservar archivo si no se sube uno nuevo
      rec.archivoUrl = prev.archivoUrl; rec.archivoId = prev.archivoId; rec.archivoNombre = prev.archivoNombre;
    }
    if (file && file.data) {
      const proyecto = findById_('Proyectos', rec.proyectoId);
      if (!proyecto) throw new Error('Proyecto no encontrado');
      const folder = projectFolder_(proyecto);
      const blob = Utilities.newBlob(Utilities.base64Decode(file.data), file.mimeType || 'application/octet-stream',
        (rec.tipo + ' ' + (rec.numero || '') + ' - ' + file.name).replace(/\s+/g, ' ').trim());
      const f = folder.createFile(blob);
      rec.archivoId = f.getId();
      rec.archivoUrl = f.getUrl();
      rec.archivoNombre = file.name;
    }
    rec.actualizado = now_();
    upsert_('Documentos', rec);
    let accion = isNew ? 'Registrado' : 'Editado';
    if (prev && prev.estado !== rec.estado) accion = 'Estado: ' + prev.estado + ' → ' + rec.estado;
    if (file && file.data) accion += ' (archivo adjunto)';
    log_('Documento', rec.id, rec.proyectoId, accion, rec.tipo + ' ' + (rec.numero || ''));
    return getData();
  });
}

function deleteDocumento(id) {
  return withLock_(function () {
    const d = findById_('Documentos', id);
    if (!d) throw new Error('Documento no encontrado');
    deleteWhere_('Documentos', 'id', id);
    log_('Documento', id, d.proyectoId, 'Eliminado', d.tipo + ' ' + (d.numero || '') +
      (d.archivoUrl ? ' (el archivo sigue en Drive)' : ''));
    return getData();
  });
}

function getHistorial(proyectoId) {
  return readAll_('Historial')
    .filter(function (h) { return !proyectoId || h.proyectoId === proyectoId; })
    .reverse()
    .slice(0, 200);
}

/** Recalcula avances de todos los proyectos (menú de la hoja). */
function recalcularTodo() {
  readAll_('Proyectos').forEach(function (p) { recalcular_(p.id); });
}

/* ======================= Lógica ======================= */

function recalcular_(proyectoId) {
  const acts = readAll_('Actividades').filter(function (a) { return a.proyectoId === proyectoId; });
  const etapas = readAll_('Etapas').filter(function (e) { return e.proyectoId === proyectoId; });
  etapas.forEach(function (e) {
    const ea = acts.filter(function (a) { return a.etapaId === e.id && a.estado !== 'Cancelada'; });
    const done = ea.filter(function (a) { return a.estado === 'Completada'; }).length;
    const avance = ea.length ? Math.round(done * 100 / ea.length) : 0;
    let estado = 'Pendiente';
    if (ea.length && done === ea.length) estado = 'Completada';
    else if (done > 0 || ea.some(function (a) { return a.estado === 'En curso'; })) estado = 'En curso';
    if (ea.some(function (a) { return a.estado === 'Bloqueada'; }) && estado !== 'Completada') estado = 'Bloqueada';
    if (e.avance !== avance || e.estado !== estado) {
      e.avance = avance; e.estado = estado; e.actualizado = now_();
      upsert_('Etapas', e);
    }
  });
  const p = findById_('Proyectos', proyectoId);
  if (!p) return;
  const valid = acts.filter(function (a) { return a.estado !== 'Cancelada'; });
  const done = valid.filter(function (a) { return a.estado === 'Completada'; }).length;
  const avance = valid.length ? Math.round(done * 100 / valid.length) : 0;
  if (p.avance !== avance) {
    p.avance = avance;
    if (p.estado === 'Planificación' && done > 0) p.estado = 'En curso';
    upsert_('Proyectos', p);
  }
}

function nextCodigo_() {
  const year = today_().slice(0, 4);
  const prefix = 'PRY-' + year + '-';
  let max = 0;
  readAll_('Proyectos').forEach(function (p) {
    const c = String(p.codigo || '');
    if (c.indexOf(prefix) === 0) max = Math.max(max, parseInt(c.slice(prefix.length), 10) || 0);
  });
  return prefix + ('000' + (max + 1)).slice(-3);
}

function projectFolder_(p) {
  if (p.carpetaId) {
    try { return DriveApp.getFolderById(p.carpetaId); } catch (err) { /* se recrea abajo */ }
  }
  const props = PropertiesService.getScriptProperties();
  let root = null;
  const rootId = props.getProperty('DRIVE_ROOT_ID');
  if (rootId) { try { root = DriveApp.getFolderById(rootId); } catch (err) { root = null; } }
  if (!root) {
    root = DriveApp.createFolder(DRIVE_ROOT_NAME);
    props.setProperty('DRIVE_ROOT_ID', root.getId());
  }
  const folder = root.createFolder((p.codigo + ' ' + p.nombre).trim());
  p.carpetaId = folder.getId();
  upsert_('Proyectos', p);
  return folder;
}

/* ======================= Acceso a la hoja ======================= */

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) { setup(); return ss_().getSheetByName(name); }
  return sh;
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function readAll_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const headers = headers_(sh);
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  return values
    .filter(function (row) { return row.some(function (c) { return c !== '' && c !== null; }); })
    .map(function (row) {
      const o = {};
      headers.forEach(function (h, i) { o[h] = normalize_(h, row[i]); });
      return o;
    });
}

function normalize_(field, v) {
  if (v instanceof Date) {
    const tz = ss_().getSpreadsheetTimeZone();
    return DATE_FIELDS.indexOf(field) >= 0
      ? Utilities.formatDate(v, tz, 'yyyy-MM-dd')
      : Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm:ss");
  }
  if (NUMBER_FIELDS.indexOf(field) >= 0) return v === '' || v === null ? '' : Number(v);
  return v === null || v === undefined ? '' : (typeof v === 'number' ? v : String(v));
}

function toRow_(headers, obj) {
  return headers.map(function (h) {
    const v = obj[h];
    if (v === undefined || v === null) return '';
    if (NUMBER_FIELDS.indexOf(h) >= 0 && v !== '') return Number(v);
    return v;
  });
}

function rowIndexWhere_(sh, field, value) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const headers = headers_(sh);
  const col = headers.indexOf(field) + 1;
  const vals = sh.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(value)) return i + 2;
  return -1;
}

function upsert_(name, obj) {
  const sh = sheet_(name);
  const headers = headers_(sh);
  const r = rowIndexWhere_(sh, 'id', obj.id);
  if (r > 0) {
    const current = readRow_(sh, headers, r);
    const merged = Object.assign(current, obj);
    sh.getRange(r, 1, 1, headers.length).setValues([toRow_(headers, merged)]);
  } else {
    sh.appendRow(toRow_(headers, obj));
  }
}

function readRow_(sh, headers, r) {
  const row = sh.getRange(r, 1, 1, headers.length).getValues()[0];
  const o = {};
  headers.forEach(function (h, i) { o[h] = normalize_(h, row[i]); });
  return o;
}

function appendRow_(name, obj) {
  const sh = sheet_(name);
  sh.appendRow(toRow_(headers_(sh), obj));
}

function updateWhere_(name, field, value, obj) {
  const sh = sheet_(name);
  const headers = headers_(sh);
  const r = rowIndexWhere_(sh, field, value);
  if (r > 0) sh.getRange(r, 1, 1, headers.length).setValues([toRow_(headers, obj)]);
}

function deleteWhere_(name, field, value) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return;
  const col = headers_(sh).indexOf(field) + 1;
  const vals = sh.getRange(2, col, last - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === String(value)) sh.deleteRow(i + 2);
  }
}

function findById_(name, id) {
  return readAll_(name).filter(function (r) { return r.id === id; })[0] || null;
}

function getConfig_() {
  const cfg = {};
  readAll_('Config').forEach(function (r) { if (r.clave) cfg[r.clave] = r.valor; });
  return cfg;
}

function getConfigValue_(k) {
  const cfg = getConfig_();
  return k in cfg ? cfg[k] : DEFAULT_CONFIG[k];
}

/* ======================= Utilidades ======================= */

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function pick_(obj, fields) {
  const o = {};
  fields.forEach(function (f) { if (obj && obj[f] !== undefined) o[f] = obj[f]; });
  return o;
}

function requireText_(v, msg) {
  if (v === undefined || v === null || String(v).trim() === '') throw new Error(msg);
}

function newId_(prefix) {
  return prefix + '-' + Utilities.getUuid().slice(0, 8);
}

function now_() {
  return Utilities.formatDate(new Date(), ss_().getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function today_() {
  return Utilities.formatDate(new Date(), ss_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

function currentUser_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (err) { return ''; }
}

function log_(entidad, entidadId, proyectoId, accion, detalle) {
  appendRow_('Historial', {
    fecha: now_(), usuario: currentUser_(), entidad: entidad, entidadId: entidadId,
    proyectoId: proyectoId, accion: accion, detalle: detalle
  });
}
