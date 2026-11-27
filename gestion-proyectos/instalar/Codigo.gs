/**
 * GESTIÓN DE PROYECTOS — Manufactura y soldadura — Backend (Google Apps Script)
 * ---------------------------------------------------------------------------
 * Datos en Google Sheets (una hoja por tabla) y archivos en Google Drive.
 * Ver README.md para la instalación paso a paso.
 */

const APP_NAME = 'Gestión de Proyectos';
const DRIVE_ROOT_NAME = 'Gestión de Proyectos - Archivos';

const FILE_FIELDS = ['archivoUrl', 'archivoId', 'archivoNombre'];
const STAMP = ['creado', 'actualizado'];

const SCHEMA = {
  Proyectos: ['id', 'codigo', 'nombre', 'cliente', 'responsable', 'fechaInicio', 'fechaFin',
    'presupuesto', 'moneda', 'estado', 'avance', 'descripcion', 'carpetaId'].concat(STAMP),
  Etapas: ['id', 'proyectoId', 'orden', 'nombre', 'fechaInicio', 'fechaFin', 'estado', 'avance'].concat(STAMP),
  Actividades: ['id', 'proyectoId', 'etapaId', 'titulo', 'responsable', 'fechaLimite', 'prioridad',
    'estado', 'horas', 'notas', 'completadoEn'].concat(STAMP),
  Documentos: ['id', 'proyectoId', 'tipo', 'numero', 'contraparte', 'fecha', 'monto', 'moneda',
    'estado', 'referenciaId'].concat(FILE_FIELDS, ['notas'], STAMP),
  Personal: ['id', 'nombre', 'cargo', 'telefono', 'activo', 'notas'].concat(STAMP),
  Certificaciones: ['id', 'personalId', 'proceso', 'norma', 'posicion', 'numero', 'emision', 'vencimiento']
    .concat(FILE_FIELDS, ['notas'], STAMP),
  Materiales: ['id', 'codigo', 'nombre', 'categoria', 'unidad', 'stock', 'stockMinimo', 'ubicacion', 'notas'].concat(STAMP),
  Movimientos: ['id', 'fecha', 'materialId', 'tipo', 'cantidad', 'stockResultante', 'proyectoId', 'responsable', 'nota', 'creado'],
  Inspecciones: ['id', 'proyectoId', 'fecha', 'tipo', 'elemento', 'inspector', 'resultado', 'observaciones',
    'actividadId'].concat(FILE_FIELDS, STAMP),
  Equipos: ['id', 'codigo', 'nombre', 'tipo', 'marca', 'estado', 'ultimoMant', 'proximoMant', 'frecuenciaDias',
    'responsable', 'notas'].concat(STAMP),
  Historial: ['fecha', 'usuario', 'entidad', 'entidadId', 'proyectoId', 'accion', 'detalle'],
  Config: ['clave', 'valor']
};

const DEFAULT_CONFIG = {
  empresa: 'Mi Empresa',
  moneda: 'PEN',
  etapasPlantilla: 'Ingeniería y planos, Compra de materiales, Corte, Armado, Soldadura, Acabado y pintura, Control de calidad, Despacho e instalación',
  responsables: ''
};

const DATE_FIELDS = ['fechaInicio', 'fechaFin', 'fechaLimite', 'fecha', 'emision', 'vencimiento', 'ultimoMant', 'proximoMant'];
const NUMBER_FIELDS = ['presupuesto', 'monto', 'orden', 'avance', 'horas', 'stock', 'stockMinimo', 'cantidad',
  'stockResultante', 'frecuenciaDias'];

let SS_CACHE = null;
let TZ_CACHE = null;

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
  const movs = readAll_('Movimientos');
  return {
    proyectos: readAll_('Proyectos'),
    etapas: readAll_('Etapas'),
    actividades: readAll_('Actividades'),
    documentos: readAll_('Documentos'),
    personal: readAll_('Personal'),
    certificaciones: readAll_('Certificaciones'),
    materiales: readAll_('Materiales'),
    movimientos: movs.slice(Math.max(0, movs.length - 400)),
    inspecciones: readAll_('Inspecciones'),
    equipos: readAll_('Equipos'),
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
      const exists = readAll_('Config').some(function (r) { return r.clave === k; });
      if (exists) updateWhere_('Config', 'clave', k, { clave: k, valor: String(cfg[k]) });
      else appendRow_('Config', { clave: k, valor: String(cfg[k]) });
    });
    return getData();
  });
}

/* ---------- Proyectos, etapas, actividades ---------- */

function saveProyecto(p, crearEtapas) {
  return withLock_(function () {
    requireText_(p.nombre, 'Escribe el nombre del proyecto');
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
    log_('Proyecto', rec.id, rec.id, isNew ? 'Creado' : 'Editado', (rec.codigo || '') + ' · ' + rec.nombre);

    if (isNew && crearEtapas) {
      String(getConfigValue_('etapasPlantilla') || '')
        .split(',').map(function (s) { return s.trim(); }).filter(String)
        .forEach(function (n, i) {
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
    ['Actividades', 'Etapas', 'Documentos', 'Inspecciones'].forEach(function (s) { deleteWhere_(s, 'proyectoId', id); });
    deleteWhere_('Proyectos', 'id', id);
    log_('Proyecto', id, id, 'Eliminado', p.codigo + ' · ' + p.nombre);
    return getData();
  });
}

function saveEtapa(e) {
  return withLock_(function () {
    requireText_(e.nombre, 'Escribe el nombre de la etapa');
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
    saveActividad_(a);
    return getData();
  });
}

function saveActividad_(a) {
  requireText_(a.titulo, 'Escribe qué hay que hacer');
  requireText_(a.proyectoId, 'Elige el proyecto');
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
  log_('Actividad', rec.id, rec.proyectoId, accion, rec.titulo + (rec.responsable ? ' (' + rec.responsable + ')' : ''));
  return rec;
}

/** Cambio rápido de estado; nota opcional se agrega a las notas (p. ej. "tengo un problema"). */
function setEstadoActividad(id, estado, nota) {
  return withLock_(function () {
    const a = findById_('Actividades', id);
    if (!a) throw new Error('Actividad no encontrada');
    a.estado = estado;
    if (nota) a.notas = (a.notas ? a.notas + '\n' : '') + today_() + ': ' + nota;
    saveActividad_(a);
    return getData();
  });
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

/* ---------- Cotizaciones / OC / facturas ---------- */

/** file (opcional): { name, mimeType, data } con data en base64. */
function saveDocumento(d, file) {
  return withLock_(function () {
    requireText_(d.tipo, 'Elige el tipo de documento');
    requireText_(d.proyectoId, 'Elige el proyecto');
    const isNew = !d.id;
    const prev = isNew ? null : findById_('Documentos', d.id);
    const rec = pick_(d, SCHEMA.Documentos);
    rec.moneda = rec.moneda || getConfigValue_('moneda');
    if (isNew) { rec.id = newId_('D'); rec.creado = now_(); }
    keepFile_(rec, prev);
    if (file && file.data) attachFile_(rec, file, projectFolderById_(rec.proyectoId), rec.tipo + ' ' + (rec.numero || ''));
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

/* ---------- Personal y certificaciones ---------- */

function savePersona(p) {
  return withLock_(function () {
    requireText_(p.nombre, 'Escribe el nombre');
    const isNew = !p.id;
    const prev = isNew ? null : findById_('Personal', p.id);
    const rec = pick_(p, SCHEMA.Personal);
    rec.nombre = String(rec.nombre).trim();
    rec.activo = rec.activo || 'Sí';
    if (isNew) { rec.id = newId_('U'); rec.creado = now_(); }
    rec.actualizado = now_();
    upsert_('Personal', rec);
    // Si cambió el nombre, actualizar sus tareas para no perder la asignación
    if (prev && prev.nombre && prev.nombre !== rec.nombre) {
      readAll_('Actividades').filter(function (a) { return a.responsable === prev.nombre; }).forEach(function (a) {
        a.responsable = rec.nombre; upsert_('Actividades', a);
      });
    }
    log_('Personal', rec.id, '', isNew ? 'Registrado' : 'Editado', rec.nombre + (rec.cargo ? ' · ' + rec.cargo : ''));
    return getData();
  });
}

function deletePersona(id) {
  return withLock_(function () {
    const p = findById_('Personal', id);
    if (!p) throw new Error('Persona no encontrada');
    deleteWhere_('Certificaciones', 'personalId', id);
    deleteWhere_('Personal', 'id', id);
    log_('Personal', id, '', 'Eliminado', p.nombre + ' (sus tareas conservan el nombre)');
    return getData();
  });
}

function saveCertificacion(c, file) {
  return withLock_(function () {
    requireText_(c.personalId, 'Falta la persona');
    requireText_(c.proceso, 'Elige el proceso de soldadura');
    const isNew = !c.id;
    const prev = isNew ? null : findById_('Certificaciones', c.id);
    const rec = pick_(c, SCHEMA.Certificaciones);
    if (isNew) { rec.id = newId_('C'); rec.creado = now_(); }
    keepFile_(rec, prev);
    const persona = findById_('Personal', rec.personalId) || { nombre: '' };
    if (file && file.data) attachFile_(rec, file, subFolder_('Personal'), 'Certificado ' + persona.nombre + ' ' + rec.proceso);
    rec.actualizado = now_();
    upsert_('Certificaciones', rec);
    log_('Certificación', rec.id, '', isNew ? 'Registrada' : 'Editada',
      persona.nombre + ' · ' + rec.proceso + (rec.vencimiento ? ' · vence ' + rec.vencimiento : ''));
    return getData();
  });
}

function deleteCertificacion(id) {
  return withLock_(function () {
    const c = findById_('Certificaciones', id);
    if (!c) throw new Error('Certificación no encontrada');
    deleteWhere_('Certificaciones', 'id', id);
    log_('Certificación', id, '', 'Eliminada', c.proceso);
    return getData();
  });
}

/* ---------- Almacén ---------- */

function saveMaterial(m) {
  return withLock_(function () {
    requireText_(m.nombre, 'Escribe el nombre del material');
    const isNew = !m.id;
    const prev = isNew ? null : findById_('Materiales', m.id);
    const rec = pick_(m, SCHEMA.Materiales);
    if (isNew) {
      rec.id = newId_('M');
      rec.creado = now_();
      rec.stock = Number(rec.stock) || 0;
    } else {
      rec.stock = prev.stock; // el stock solo cambia con movimientos
    }
    rec.stockMinimo = Number(rec.stockMinimo) || 0;
    rec.actualizado = now_();
    upsert_('Materiales', rec);
    if (isNew && rec.stock) {
      appendRow_('Movimientos', { id: newId_('V'), fecha: today_(), materialId: rec.id, tipo: 'Ajuste',
        cantidad: rec.stock, stockResultante: rec.stock, nota: 'Stock inicial', creado: now_() });
    }
    log_('Material', rec.id, '', isNew ? 'Registrado' : 'Editado', rec.nombre);
    return getData();
  });
}

function deleteMaterial(id) {
  return withLock_(function () {
    const m = findById_('Materiales', id);
    if (!m) throw new Error('Material no encontrado');
    deleteWhere_('Movimientos', 'materialId', id);
    deleteWhere_('Materiales', 'id', id);
    log_('Material', id, '', 'Eliminado', m.nombre);
    return getData();
  });
}

/** tipo: Entrada (suma), Salida (resta), Ajuste (conteo físico: fija el stock). */
function registrarMovimiento(mv) {
  return withLock_(function () {
    const m = findById_('Materiales', mv.materialId);
    if (!m) throw new Error('Elige el material');
    const cant = Number(mv.cantidad);
    if (!(cant >= 0) || (mv.tipo !== 'Ajuste' && !(cant > 0))) throw new Error('Escribe una cantidad mayor a cero');
    let stock = Number(m.stock) || 0;
    if (mv.tipo === 'Entrada') stock += cant;
    else if (mv.tipo === 'Salida') {
      if (cant > stock) throw new Error('No alcanza el stock: solo quedan ' + stock + ' ' + (m.unidad || ''));
      stock -= cant;
    } else if (mv.tipo === 'Ajuste') stock = cant;
    else throw new Error('Tipo de movimiento no válido');
    stock = Math.round(stock * 1000) / 1000;
    m.stock = stock; m.actualizado = now_();
    upsert_('Materiales', m);
    const rec = pick_(mv, SCHEMA.Movimientos);
    rec.id = newId_('V'); rec.fecha = rec.fecha || today_(); rec.cantidad = cant;
    rec.stockResultante = stock; rec.creado = now_();
    appendRow_('Movimientos', rec);
    log_('Almacén', m.id, rec.proyectoId || '', mv.tipo + ' ' + cant + ' ' + (m.unidad || ''),
      m.nombre + (rec.responsable ? ' · ' + rec.responsable : '') + ' (stock: ' + stock + ')');
    return getData();
  });
}

/* ---------- Calidad ---------- */

/** Si la inspección sale Rechazada u Observada, se crea automáticamente una tarea de corrección. */
function saveInspeccion(i, file) {
  return withLock_(function () {
    requireText_(i.proyectoId, 'Elige el proyecto');
    requireText_(i.tipo, 'Elige el tipo de inspección');
    requireText_(i.resultado, 'Elige el resultado');
    const isNew = !i.id;
    const prev = isNew ? null : findById_('Inspecciones', i.id);
    const rec = pick_(i, SCHEMA.Inspecciones);
    rec.fecha = rec.fecha || today_();
    if (isNew) { rec.id = newId_('I'); rec.creado = now_(); }
    keepFile_(rec, prev);
    if (prev && !rec.actividadId) rec.actividadId = prev.actividadId;
    if (file && file.data) attachFile_(rec, file, projectFolderById_(rec.proyectoId), 'Inspección ' + rec.tipo + ' ' + (rec.elemento || ''));

    if ((rec.resultado === 'Rechazado' || rec.resultado === 'Observado') && !rec.actividadId) {
      const etapas = readAll_('Etapas').filter(function (e) { return e.proyectoId === rec.proyectoId; });
      const etapa = etapas.filter(function (e) { return /soldadura/i.test(e.nombre); })[0] ||
        etapas.filter(function (e) { return /calidad/i.test(e.nombre); })[0] || null;
      const act = saveActividad_({
        proyectoId: rec.proyectoId, etapaId: etapa ? etapa.id : '',
        titulo: (rec.resultado === 'Rechazado' ? 'Reparar: ' : 'Levantar observación: ') + rec.tipo +
          (rec.elemento ? ' — ' + rec.elemento : ''),
        prioridad: rec.resultado === 'Rechazado' ? 'Alta' : 'Media',
        fechaLimite: addDays_(today_(), rec.resultado === 'Rechazado' ? 2 : 5),
        notas: rec.observaciones || '', estado: 'Pendiente'
      });
      rec.actividadId = act.id;
    }
    rec.actualizado = now_();
    upsert_('Inspecciones', rec);
    let accion = isNew ? 'Registrada: ' + rec.resultado : 'Editada';
    if (prev && prev.resultado !== rec.resultado) accion = 'Resultado: ' + prev.resultado + ' → ' + rec.resultado;
    log_('Inspección', rec.id, rec.proyectoId, accion, rec.tipo + (rec.elemento ? ' · ' + rec.elemento : ''));
    return getData();
  });
}

function deleteInspeccion(id) {
  return withLock_(function () {
    const x = findById_('Inspecciones', id);
    if (!x) throw new Error('Inspección no encontrada');
    deleteWhere_('Inspecciones', 'id', id);
    log_('Inspección', id, x.proyectoId, 'Eliminada', x.tipo);
    return getData();
  });
}

/* ---------- Máquinas y mantenimiento ---------- */

function saveEquipo(e) {
  return withLock_(function () {
    requireText_(e.nombre, 'Escribe el nombre de la máquina');
    const isNew = !e.id;
    const rec = pick_(e, SCHEMA.Equipos);
    rec.estado = rec.estado || 'Operativo';
    rec.frecuenciaDias = Number(rec.frecuenciaDias) || '';
    if (!rec.proximoMant && rec.ultimoMant && rec.frecuenciaDias) rec.proximoMant = addDays_(rec.ultimoMant, rec.frecuenciaDias);
    if (isNew) { rec.id = newId_('Q'); rec.creado = now_(); }
    rec.actualizado = now_();
    upsert_('Equipos', rec);
    log_('Máquina', rec.id, '', isNew ? 'Registrada' : 'Editada', rec.nombre + ' · ' + rec.estado);
    return getData();
  });
}

function registrarMantenimiento(id, fecha, nota) {
  return withLock_(function () {
    const e = findById_('Equipos', id);
    if (!e) throw new Error('Máquina no encontrada');
    e.ultimoMant = fecha || today_();
    e.proximoMant = e.frecuenciaDias ? addDays_(e.ultimoMant, e.frecuenciaDias) : '';
    e.estado = 'Operativo';
    if (nota) e.notas = (e.notas ? e.notas + '\n' : '') + e.ultimoMant + ': ' + nota;
    e.actualizado = now_();
    upsert_('Equipos', e);
    log_('Máquina', id, '', 'Mantenimiento realizado', e.nombre + (nota ? ' · ' + nota : ''));
    return getData();
  });
}

function deleteEquipo(id) {
  return withLock_(function () {
    const e = findById_('Equipos', id);
    if (!e) throw new Error('Máquina no encontrada');
    deleteWhere_('Equipos', 'id', id);
    log_('Máquina', id, '', 'Eliminada', e.nombre);
    return getData();
  });
}

/* ---------- Historial ---------- */

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
  const prefix = 'PRY-' + today_().slice(0, 4) + '-';
  let max = 0;
  readAll_('Proyectos').forEach(function (p) {
    const c = String(p.codigo || '');
    if (c.indexOf(prefix) === 0) max = Math.max(max, parseInt(c.slice(prefix.length), 10) || 0);
  });
  return prefix + ('000' + (max + 1)).slice(-3);
}

/* ---------- Archivos en Drive ---------- */

function rootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const rootId = props.getProperty('DRIVE_ROOT_ID');
  if (rootId) { try { return DriveApp.getFolderById(rootId); } catch (err) { /* se recrea */ } }
  const root = DriveApp.createFolder(DRIVE_ROOT_NAME);
  props.setProperty('DRIVE_ROOT_ID', root.getId());
  return root;
}

function subFolder_(name) {
  const props = PropertiesService.getScriptProperties();
  const key = 'FOLDER_' + name;
  const id = props.getProperty(key);
  if (id) { try { return DriveApp.getFolderById(id); } catch (err) { /* se recrea */ } }
  const f = rootFolder_().createFolder(name);
  props.setProperty(key, f.getId());
  return f;
}

function projectFolderById_(proyectoId) {
  const p = findById_('Proyectos', proyectoId);
  if (!p) throw new Error('Proyecto no encontrado');
  if (p.carpetaId) {
    try { return DriveApp.getFolderById(p.carpetaId); } catch (err) { /* se recrea abajo */ }
  }
  const folder = rootFolder_().createFolder((p.codigo + ' ' + p.nombre).trim());
  p.carpetaId = folder.getId();
  upsert_('Proyectos', p);
  return folder;
}

function attachFile_(rec, file, folder, prefix) {
  const name = (prefix + ' - ' + file.name).replace(/\s+/g, ' ').trim();
  const blob = Utilities.newBlob(Utilities.base64Decode(file.data), file.mimeType || 'application/octet-stream', name);
  const f = folder.createFile(blob);
  rec.archivoId = f.getId();
  rec.archivoUrl = f.getUrl();
  rec.archivoNombre = file.name;
}

function keepFile_(rec, prev) {
  if (!prev) return;
  FILE_FIELDS.forEach(function (k) { rec[k] = prev[k]; });
}

/* ======================= Acceso a la hoja ======================= */

function ss_() {
  if (SS_CACHE) return SS_CACHE;
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  SS_CACHE = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return SS_CACHE;
}

function tz_() {
  if (!TZ_CACHE) TZ_CACHE = ss_().getSpreadsheetTimeZone();
  return TZ_CACHE;
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
    .map(function (row) { return rowToObj_(name, headers, row); });
}

function rowToObj_(name, headers, row) {
  const o = {};
  headers.forEach(function (h, i) { o[h] = normalize_(name, h, row[i]); });
  return o;
}

function normalize_(sheetName, field, v) {
  if (v instanceof Date) {
    const dateOnly = DATE_FIELDS.indexOf(field) >= 0 && sheetName !== 'Historial';
    return Utilities.formatDate(v, tz_(), dateOnly ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ss");
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
  const col = headers_(sh).indexOf(field) + 1;
  const vals = sh.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(value)) return i + 2;
  return -1;
}

function upsert_(name, obj) {
  const sh = sheet_(name);
  const headers = headers_(sh);
  const r = rowIndexWhere_(sh, 'id', obj.id);
  if (r > 0) {
    const current = rowToObj_(name, headers, sh.getRange(r, 1, 1, headers.length).getValues()[0]);
    sh.getRange(r, 1, 1, headers.length).setValues([toRow_(headers, Object.assign(current, obj))]);
  } else {
    sh.appendRow(toRow_(headers, obj));
  }
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
  return Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd'T'HH:mm:ss");
}

function today_() {
  return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
}

function addDays_(iso, n) {
  const p = String(iso).split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2] + Number(n), 12);
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
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
