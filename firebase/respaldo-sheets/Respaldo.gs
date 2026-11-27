/**
 * RESPALDO DE FIREBASE EN GOOGLE SHEETS
 * -------------------------------------
 * Copia los datos de la app (Firestore) a esta hoja de cálculo: una pestaña por tabla.
 * Es solo para ver, filtrar y hacer reportes: los cambios se hacen en la app.
 *
 * Instalación: ver README («Respaldo en Google Sheets»). En resumen:
 *   1. En la hoja: Extensiones → Apps Script → pega este archivo y el manifiesto appsscript.json.
 *   2. Ejecuta «respaldar» una vez (acepta permisos).
 *   3. Ejecuta «activarRespaldoAutomatico» para que se actualice sola cada hora.
 */

const FIREBASE_PROJECT_ID = 'proyect-management-c27ab';

const TABLAS = [
  ['proyectos', 'Proyectos', ['id', 'codigo', 'nombre', 'cliente', 'responsable', 'fechaInicio', 'fechaFin', 'presupuesto', 'moneda', 'estado', 'avance', 'descripcion', 'creado', 'actualizado']],
  ['etapas', 'Etapas', ['id', 'proyectoId', 'orden', 'nombre', 'fechaInicio', 'fechaFin', 'estado', 'avance', 'creado', 'actualizado']],
  ['actividades', 'Tareas', ['id', 'proyectoId', 'etapaId', 'titulo', 'responsable', 'fechaLimite', 'prioridad', 'estado', 'horas', 'notas', 'completadoEn', 'creado', 'actualizado']],
  ['documentos', 'Documentos', ['id', 'proyectoId', 'tipo', 'numero', 'contraparte', 'fecha', 'monto', 'moneda', 'estado', 'referenciaId', 'archivoUrl', 'archivoNombre', 'notas', 'creado', 'actualizado']],
  ['personal', 'Personal', ['id', 'nombre', 'cargo', 'telefono', 'activo', 'notas', 'creado', 'actualizado']],
  ['certificaciones', 'Certificaciones', ['id', 'personalId', 'proceso', 'norma', 'posicion', 'numero', 'emision', 'vencimiento', 'archivoUrl', 'notas', 'creado', 'actualizado']],
  ['materiales', 'Materiales', ['id', 'codigo', 'nombre', 'categoria', 'unidad', 'stock', 'stockMinimo', 'ubicacion', 'notas', 'creado', 'actualizado']],
  ['movimientos', 'Movimientos', ['id', 'fecha', 'materialId', 'tipo', 'cantidad', 'stockResultante', 'proyectoId', 'responsable', 'nota', 'creado']],
  ['inspecciones', 'Inspecciones', ['id', 'proyectoId', 'fecha', 'tipo', 'elemento', 'inspector', 'resultado', 'observaciones', 'actividadId', 'archivoUrl', 'creado', 'actualizado']],
  ['equipos', 'Máquinas', ['id', 'codigo', 'nombre', 'tipo', 'marca', 'estado', 'ultimoMant', 'proximoMant', 'frecuenciaDias', 'responsable', 'notas', 'creado', 'actualizado']],
  ['historial', 'Historial', ['fecha', 'usuario', 'entidad', 'entidadId', 'proyectoId', 'accion', 'detalle', 'creado']]
];
// Columnas extra con nombres legibles en lugar de solo IDs: [columna, campo con el ID, tabla, campo a mostrar]
const NOMBRES = {
  etapas: [['proyecto', 'proyectoId', 'proyectos', 'nombre']],
  actividades: [['proyecto', 'proyectoId', 'proyectos', 'nombre'], ['etapa', 'etapaId', 'etapas', 'nombre']],
  documentos: [['proyecto', 'proyectoId', 'proyectos', 'nombre']],
  certificaciones: [['persona', 'personalId', 'personal', 'nombre']],
  movimientos: [['material', 'materialId', 'materiales', 'nombre'], ['proyecto', 'proyectoId', 'proyectos', 'nombre']],
  inspecciones: [['proyecto', 'proyectoId', 'proyectos', 'nombre']],
  historial: [['proyecto', 'proyectoId', 'proyectos', 'nombre']]
};
// Estas tablas solo crecen: se copian solo las filas nuevas (ahorra lecturas de Firebase)
const INCREMENTALES = ['movimientos', 'historial'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Respaldo Firebase')
    .addItem('Actualizar ahora', 'respaldar')
    .addItem('Actualizar automáticamente cada hora', 'activarRespaldoAutomatico')
    .addItem('Detener actualización automática', 'desactivarRespaldoAutomatico')
    .addItem('Copiar todo de nuevo (desde cero)', 'respaldoCompleto')
    .addToUi();
}

/** Copia los datos de Firebase a la hoja. */
function respaldar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const inicio = new Date();
  const resumen = [];
  const mapas = {}; // id → campos, de las tablas ya leídas (para mostrar nombres)
  TABLAS.forEach(function (t) {
    const col = t[0], nombre = t[1];
    const extra = NOMBRES[col] || [];
    const campos = extra.map(function (e) { return e[0]; }).concat(t[2]);
    const fila = function (d) {
      const f = d.fields || {};
      return extra.map(function (e) {
        const ref = mapas[e[2]] && mapas[e[2]][valor_(f[e[1]])];
        return ref ? valor_(ref[e[3]]) : '';
      }).concat(fila_(d, t[2]));
    };
    let sh = ss.getSheetByName(nombre);
    if (!sh) sh = ss.insertSheet(nombre);
    const cabecera = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].join('|') : '';
    const incremental = INCREMENTALES.indexOf(col) >= 0;
    let marca = incremental ? (props.getProperty('ULTIMO_' + col) || '') : '';
    if (cabecera !== campos.join('|')) { marca = ''; } // hoja nueva o modificada: copiar completa

    if (incremental && marca) {
      // Se pide desde la misma marca (>=) y se descartan los ya copiados con esa marca: así no se pierde
      // nada creado en el mismo segundo que el último respaldo
      const vistos = JSON.parse(props.getProperty('IDS_' + col) || '[]');
      const nuevos = consultarDesde_(col, marca).filter(function (d) { return vistos.indexOf(idDe_(d)) < 0; });
      if (nuevos.length) {
        const filas = nuevos.map(fila);
        sh.getRange(sh.getLastRow() + 1, 1, filas.length, campos.length).setValues(filas);
        guardarMarca_(props, col, nuevos, marca, vistos);
      }
      resumen.push([nombre, '+' + nuevos.length + ' nuevas', sh.getLastRow() - 1]);
      return;
    }

    const docs = incremental ? consultarDesde_(col, '') : listarTodo_(col);
    if (!incremental) { mapas[col] = {}; docs.forEach(function (d) { mapas[col][d.name.split('/').pop()] = d.fields || {}; }); }
    const filas = [campos].concat(docs.map(fila));
    sh.clearContents();
    sh.getRange(1, 1, filas.length, campos.length).setValues(filas);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, campos.length).setFontWeight('bold').setBackground('#e8eefc');
    if (incremental && docs.length) guardarMarca_(props, col, docs, '', []);
    resumen.push([nombre, docs.length + ' filas', docs.length]);
  });

  let info = ss.getSheetByName('Respaldo');
  if (!info) info = ss.insertSheet('Respaldo', 0);
  info.clearContents();
  const filasInfo = [['Último respaldo', Utilities.formatDate(inicio, ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm'), ''],
    ['Duración', Math.round((new Date() - inicio) / 1000) + ' s', ''], ['', '', ''], ['Hoja', 'Cambio', 'Total filas']].concat(resumen)
    .concat([['', '', ''], ['Estas hojas son una copia de la app. Los cambios hechos aquí se reemplazan en el próximo respaldo.', '', '']]);
  info.getRange(1, 1, filasInfo.length, 3).setValues(filasInfo);
  info.getRange(1, 1, 2, 1).setFontWeight('bold');
  info.getRange(4, 1, 1, 3).setFontWeight('bold').setBackground('#e8eefc');
}

/** Borra las marcas y vuelve a copiar todo. */
function respaldoCompleto() {
  const props = PropertiesService.getScriptProperties();
  INCREMENTALES.forEach(function (c) { props.deleteProperty('ULTIMO_' + c); props.deleteProperty('IDS_' + c); });
  respaldar();
}

function activarRespaldoAutomatico() {
  desactivarRespaldoAutomatico();
  ScriptApp.newTrigger('respaldar').timeBased().everyHours(1).create();
  respaldar();
  try { SpreadsheetApp.getUi().alert('Listo: la hoja se actualizará sola cada hora.'); } catch (e) { /* ejecutado sin hoja abierta */ }
}

function desactivarRespaldoAutomatico() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'respaldar') ScriptApp.deleteTrigger(t);
  });
}

/* ======================= Lectura de Firestore (API REST) ======================= */

function base_() {
  const custom = PropertiesService.getScriptProperties().getProperty('FIRESTORE_BASE'); // solo para pruebas
  return (custom || 'https://firestore.googleapis.com/v1') + '/projects/' + FIREBASE_PROJECT_ID + '/databases/(default)/documents';
}

function pedir_(url, payload) {
  const opts = { method: payload ? 'post' : 'get', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  if (payload) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(payload); }
  const r = UrlFetchApp.fetch(url, opts);
  const code = r.getResponseCode();
  const body = r.getContentText();
  if (code === 403 || code === 401) {
    throw new Error('Firebase no dio permiso (' + code + '). Usa la misma cuenta de Google que es dueña del proyecto de Firebase, ' +
      'o agrega esta cuenta en Firebase → Configuración del proyecto → Usuarios y permisos (rol Lector). Detalle: ' + body.slice(0, 300));
  }
  if (code >= 300) throw new Error('Error de Firebase ' + code + ': ' + body.slice(0, 300));
  return JSON.parse(body || '{}');
}

function listarTodo_(col) {
  const out = [];
  let token = '';
  do {
    const res = pedir_(base_() + '/' + col + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
    (res.documents || []).forEach(function (d) { out.push(d); });
    token = res.nextPageToken || '';
  } while (token);
  return out;
}

/** Documentos con «creado» mayor que la marca, en orden. */
function consultarDesde_(col, marca) {
  const out = [];
  let desde = marca;
  for (;;) {
    const q = { from: [{ collectionId: col }], orderBy: [{ field: { fieldPath: 'creado' }, direction: 'ASCENDING' }], limit: 2000 };
    if (desde) q.where = { fieldFilter: { field: { fieldPath: 'creado' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: desde } } };
    const res = pedir_(base_() + ':runQuery', { structuredQuery: q });
    const docs = (Array.isArray(res) ? res : []).filter(function (x) { return x.document; }).map(function (x) { return x.document; });
    docs.forEach(function (d) { out.push(d); });
    if (docs.length < 2000) break;
    const ultimo = valor_(docs[docs.length - 1].fields.creado);
    if (ultimo === desde) break; // más de 2000 en el mismo segundo: imposible en la práctica
    desde = ultimo;
  }
  // quitar repetidos (las páginas se solapan en la marca)
  const ids = {};
  return out.filter(function (d) { const id = idDe_(d); if (ids[id]) return false; ids[id] = true; return true; });
}

function idDe_(doc) { return doc.name.split('/').pop(); }

/** Guarda la marca (último «creado») y los IDs que tienen exactamente esa marca. */
function guardarMarca_(props, col, docs, marcaAnterior, vistosAnteriores) {
  const marca = valor_(docs[docs.length - 1].fields.creado);
  let ids = docs.filter(function (d) { return valor_(d.fields.creado) === marca; }).map(idDe_);
  if (marca === marcaAnterior) ids = ids.concat(vistosAnteriores);
  props.setProperty('ULTIMO_' + col, marca);
  props.setProperty('IDS_' + col, JSON.stringify(ids.slice(-500)));
}

function fila_(doc, campos) {
  const f = doc.fields || {};
  return campos.map(function (c) { return c === 'id' ? idDe_(doc) : valor_(f[c]); });
}

function valor_(v) {
  if (!v) return '';
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue ? 'Sí' : 'No';
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return '';
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor_).join(', ');
  if ('mapValue' in v) return JSON.stringify(v.mapValue.fields || {});
  return '';
}
