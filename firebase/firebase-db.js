/**
 * GESTIÓN DE PROYECTOS — Capa de datos con Firebase (Firestore + Storage + inicio de sesión con Google)
 * ------------------------------------------------------------------------------------------------
 * Ofrece las mismas funciones que Code.gs (saveActividad, registrarMovimiento, …) para que la interfaz
 * (App.html) funcione igual. Los cambios se ven al instante (se aplican primero en el celular y Firebase
 * los sincroniza en segundo plano) y la app sigue funcionando sin señal.
 */
(function () {
  'use strict';

  const COLS = ['proyectos', 'etapas', 'actividades', 'documentos', 'personal', 'certificaciones',
    'materiales', 'movimientos', 'inspecciones', 'equipos'];

  const FILE_FIELDS = ['archivoUrl', 'archivoId', 'archivoNombre'];
  const STAMP = ['creado', 'actualizado'];
  const FIELDS = {
    proyectos: ['id', 'codigo', 'nombre', 'cliente', 'responsable', 'fechaInicio', 'fechaFin', 'presupuesto', 'moneda',
      'estado', 'avance', 'descripcion'].concat(STAMP),
    etapas: ['id', 'proyectoId', 'orden', 'nombre', 'fechaInicio', 'fechaFin', 'estado', 'avance'].concat(STAMP),
    actividades: ['id', 'proyectoId', 'etapaId', 'titulo', 'responsable', 'fechaLimite', 'prioridad', 'estado', 'horas',
      'notas', 'completadoEn'].concat(STAMP),
    documentos: ['id', 'proyectoId', 'tipo', 'numero', 'contraparte', 'fecha', 'monto', 'moneda', 'estado', 'referenciaId']
      .concat(FILE_FIELDS, ['notas'], STAMP),
    personal: ['id', 'nombre', 'cargo', 'telefono', 'activo', 'notas'].concat(STAMP),
    certificaciones: ['id', 'personalId', 'proceso', 'norma', 'posicion', 'numero', 'emision', 'vencimiento']
      .concat(FILE_FIELDS, ['notas'], STAMP),
    materiales: ['id', 'codigo', 'nombre', 'categoria', 'unidad', 'stock', 'stockMinimo', 'ubicacion', 'notas'].concat(STAMP),
    movimientos: ['id', 'fecha', 'materialId', 'tipo', 'cantidad', 'stockResultante', 'proyectoId', 'responsable', 'nota', 'creado'],
    inspecciones: ['id', 'proyectoId', 'fecha', 'tipo', 'elemento', 'inspector', 'resultado', 'observaciones', 'actividadId']
      .concat(FILE_FIELDS, STAMP),
    equipos: ['id', 'codigo', 'nombre', 'tipo', 'marca', 'estado', 'ultimoMant', 'proximoMant', 'frecuenciaDias',
      'responsable', 'notas'].concat(STAMP)
  };
  const NUMBER_FIELDS = ['presupuesto', 'monto', 'orden', 'avance', 'horas', 'stock', 'stockMinimo', 'cantidad',
    'stockResultante', 'frecuenciaDias'];

  const DEFAULT_CONFIG = {
    empresa: 'Mi Empresa',
    moneda: 'PEN',
    etapasPlantilla: 'Ingeniería y planos, Compra de materiales, Corte, Armado, Soldadura, Acabado y pintura, Control de calidad, Despacho e instalación',
    hojaUrl: ''
  };

  let db = null, auth = null, storage = null, user = null;
  let L = null;          // estado local, misma forma que getData() del servidor
  let unsub = [];
  let onData = null, onGate = null;
  const ready = {};

  /* ======================= Arranque e inicio de sesión ======================= */

  function init() {
    if (!window.firebase || !window.FIREBASE_CONFIG) throw new Error('Falta la configuración de Firebase (firebase-config.js)');
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.firestore();
    auth = firebase.auth();
    storage = firebase.storage ? firebase.storage() : null;
    if (window.FIREBASE_EMULATOR) {
      db.useEmulator('127.0.0.1', 8085);
      auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
      if (storage) storage.useEmulator('127.0.0.1', 9199);
    } else {
      // Guardado local: la app abre al instante y funciona sin señal
      db.enablePersistence({ synchronizeTabs: true }).catch(function () { /* navegador sin soporte: sigue en línea */ });
    }
  }

  function start(dataCb, gateCb) {
    onData = dataCb; onGate = gateCb;
    init();
    onGate('cargando');
    auth.getRedirectResult().catch(function (e) { onGate('login', { error: friendlyError(e) }); });
    auth.onAuthStateChanged(function (u) {
      stopListeners();
      user = u;
      if (!u) { L = null; onGate('login'); return; }
      onGate('cargando', { email: u.email });
      checkAccess().then(function (ok) {
        if (ok) listen(); else onGate('sin-acceso', { email: u.email });
      }).catch(function (e) { onGate('error', { message: friendlyError(e) }); });
    });
  }

  function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return auth.signInWithPopup(provider).catch(function (e) {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
        return auth.signInWithRedirect(provider);
      }
      if (e && e.code === 'auth/popup-closed-by-user') return null;
      onGate('login', { error: friendlyError(e) });
    });
  }

  function logout() { stopListeners(); return auth.signOut(); }

  function email() { return user && user.email ? user.email.toLowerCase() : ''; }

  /** ¿El correo está en la lista de acceso? La primera persona que entra queda como administradora. */
  function checkAccess() {
    const ref = db.collection('config').doc('acceso');
    return ref.get().then(function () { return true; }).catch(function (e) {
      if (e.code !== 'permission-denied') throw e;
      // Puede que la lista aún no exista: intentamos crearla con este correo (las reglas solo lo permiten una vez)
      return ref.set({ emails: [email()], admins: [email()], creado: now(), creadoPor: email() })
        .then(function () { return true; })
        .catch(function (e2) { if (e2.code === 'permission-denied') return false; throw e2; });
    });
  }

  function emptyData() {
    const d = { config: Object.assign({}, DEFAULT_CONFIG), accesos: [], admins: [], esAdmin: false, usuario: email(), hojaUrl: '', hoy: today() };
    COLS.forEach(function (c) { d[c] = []; });
    return d;
  }

  function listen() {
    L = emptyData();
    COLS.forEach(function (c) { ready[c] = false; });
    ready.config = false; ready.acceso = false;
    const fail = function (e) { onGate('error', { message: friendlyError(e) }); };
    COLS.forEach(function (c) {
      let q = db.collection(c);
      if (c === 'movimientos') q = q.orderBy('creado', 'desc').limit(400);
      unsub.push(q.onSnapshot({ includeMetadataChanges: false }, function (snap) {
        let list = snap.docs.map(function (d) { const o = d.data(); o.id = d.id; return o; });
        if (c === 'movimientos') list = list.reverse();
        L[c] = list; ready[c] = true; emit();
      }, fail));
    });
    unsub.push(db.collection('config').doc('general').onSnapshot(function (d) {
      if (!d.exists) {
        d.ref.set(Object.assign({}, DEFAULT_CONFIG, { creado: now() }), { merge: true }).catch(fail);
      }
      L.config = Object.assign({}, DEFAULT_CONFIG, d.exists ? d.data() : {});
      L.hojaUrl = L.config.hojaUrl || '';
      ready.config = true; emit();
    }, fail));
    unsub.push(db.collection('config').doc('acceso').onSnapshot(function (d) {
      L.accesos = d.exists ? (d.data().emails || []) : [];
      L.admins = d.exists ? (d.data().admins || []) : [];
      L.esAdmin = L.admins.indexOf(email()) >= 0;
      ready.acceso = true; emit();
    }, fail));
  }

  function stopListeners() { unsub.forEach(function (u) { try { u(); } catch (e) { /* ya cerrado */ } }); unsub = []; }

  let emitTimer = null;
  function emit() {
    if (Object.keys(ready).some(function (k) { return !ready[k]; })) return; // esperar la primera carga completa
    clearTimeout(emitTimer);
    emitTimer = setTimeout(function () { onData(data()); }, 30);
  }

  function data() {
    L.hoy = today();
    L.usuario = email();
    return L;
  }

  /* ======================= Escrituras (aplican local al instante) ======================= */

  function friendlyError(e) {
    const code = e && e.code ? e.code : '';
    if (code === 'permission-denied') return 'Tu cuenta no tiene permiso para esto. Pide al administrador que agregue tu correo en Ajustes → Acceso.';
    if (code === 'unavailable') return 'Sin conexión con Firebase. Los cambios se guardarán cuando vuelva la señal.';
    if (code === 'auth/unauthorized-domain') return 'Este dominio no está autorizado en Firebase: agrégalo en Authentication → Configuración → Dominios autorizados.';
    if (code === 'auth/operation-not-allowed') return 'Activa el inicio de sesión con Google en Firebase: Authentication → Método de acceso → Google.';
    if (code === 'storage/unauthorized') return 'No se pudo subir el archivo: revisa las reglas de Storage o tu acceso.';
    if (code && code.indexOf('storage/') === 0) return 'No se pudo subir el archivo (' + code.replace('storage/', '') + '). ¿Activaste Storage en Firebase?';
    return (e && e.message) ? e.message : String(e);
  }

  /** Agrupa escrituras: se aplican al estado local de inmediato y se envían a Firebase en lote. */
  function Tx() {
    const batches = [db.batch()];
    let n = 0;
    const cur = function () { if (n >= 450) { batches.push(db.batch()); n = 0; } n++; return batches[batches.length - 1]; };
    return {
      set: function (col, obj) {
        const clean = cleanObj(col, obj);
        upsertLocal(col, clean);
        cur().set(db.collection(col).doc(clean.id), withoutId(clean), { merge: true });
        return clean;
      },
      del: function (col, id) {
        removeLocal(col, id);
        cur().delete(db.collection(col).doc(id));
      },
      inc: function (col, id, field, delta) {
        const o = findById(col, id);
        if (o) o[field] = round3((Number(o[field]) || 0) + delta);
        const upd = {}; upd[field] = firebase.firestore.FieldValue.increment(delta); upd.actualizado = now();
        cur().update(db.collection(col).doc(id), upd);
      },
      commit: function () {
        const ps = batches.map(function (b) { return b.commit(); });
        // No se espera la respuesta del servidor: la app ya muestra el cambio. Si falla, se avisa.
        Promise.all(ps).catch(function (e) {
          if (window.onDbError) window.onDbError(friendlyError(e));
        });
        return data();
      }
    };
  }

  function withoutId(o) { const c = Object.assign({}, o); delete c.id; return c; }
  function cleanObj(col, obj) {
    const out = {};
    (FIELDS[col] || Object.keys(obj)).forEach(function (f) {
      if (obj[f] === undefined) return;
      let v = obj[f];
      if (v === null) v = '';
      if (NUMBER_FIELDS.indexOf(f) >= 0 && v !== '') v = Number(v);
      out[f] = v;
    });
    if (!FIELDS[col]) Object.keys(obj).forEach(function (k) { out[k] = obj[k]; });
    return out;
  }
  function upsertLocal(col, obj) {
    if (!L || !L[col]) return;
    const cur = findById(col, obj.id);
    if (cur) Object.assign(cur, obj); else L[col].push(Object.assign({}, obj));
  }
  function removeLocal(col, id) {
    if (!L || !L[col]) return;
    L[col] = L[col].filter(function (x) { return x.id !== id; });
  }
  function findById(col, id) {
    if (!L || !L[col]) return null;
    for (let i = 0; i < L[col].length; i++) if (L[col][i].id === id) return L[col][i];
    return null;
  }
  function copy(o) { return o ? Object.assign({}, o) : null; }
  function where(col, field, value) { return (L[col] || []).filter(function (x) { return x[field] === value; }); }

  function newId(col) { return db.collection(col).doc().id; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmt(d, withTime) {
    const s = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    return withTime ? s + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) : s;
  }
  function now() { return fmt(new Date(), true); }
  function today() { return fmt(new Date(), false); }
  function addDays(iso, n) { const p = String(iso).split('-').map(Number); return fmt(new Date(p[0], p[1] - 1, p[2] + Number(n), 12), false); }
  function round3(x) { return Math.round(x * 1000) / 1000; }
  function pick(obj, col) {
    const o = {};
    FIELDS[col].forEach(function (f) { if (obj && obj[f] !== undefined) o[f] = obj[f]; });
    return o;
  }
  function requireText(v, msg) { if (v === undefined || v === null || String(v).trim() === '') throw new Error(msg); }

  function log(t, entidad, entidadId, proyectoId, accion, detalle) {
    const id = newId('historial');
    t.set('historial', { id: id, fecha: now(), creado: now(), usuario: email(), entidad: entidad, entidadId: entidadId || '',
      proyectoId: proyectoId || '', accion: accion, detalle: detalle || '' });
  }

  function cfgValue(k) { return (L.config && L.config[k] !== undefined && L.config[k] !== '') ? L.config[k] : DEFAULT_CONFIG[k]; }

  /* ---------- Archivos (Firebase Storage) ---------- */
  function upload(folder, file) {
    if (!file || !file.data) return Promise.resolve(null);
    if (!storage) return Promise.reject(new Error('Storage no está activado en esta app.'));
    const bin = atob(file.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const safe = String(file.name || 'archivo').replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]/g, '_');
    const path = 'gestion/' + folder + '/' + Date.now() + '_' + safe;
    const ref = storage.ref(path);
    return ref.put(bytes, { contentType: file.mimeType || 'application/octet-stream' })
      .then(function () { return ref.getDownloadURL(); })
      .then(function (url) { return { archivoUrl: url, archivoId: path, archivoNombre: file.name }; })
      .catch(function (e) { throw new Error(friendlyError(e)); });
  }
  function keepFile(rec, prev) { if (prev) FILE_FIELDS.forEach(function (k) { if (prev[k] !== undefined) rec[k] = prev[k]; }); }

  /* ======================= Lógica (igual que Code.gs) ======================= */

  function recalcular(t, proyectoId) {
    const acts = where('actividades', 'proyectoId', proyectoId);
    where('etapas', 'proyectoId', proyectoId).forEach(function (e) {
      const ea = acts.filter(function (a) { return a.etapaId === e.id && a.estado !== 'Cancelada'; });
      const done = ea.filter(function (a) { return a.estado === 'Completada'; }).length;
      const avance = ea.length ? Math.round(done * 100 / ea.length) : 0;
      let estado = 'Pendiente';
      if (ea.length && done === ea.length) estado = 'Completada';
      else if (done > 0 || ea.some(function (a) { return a.estado === 'En curso'; })) estado = 'En curso';
      if (ea.some(function (a) { return a.estado === 'Bloqueada'; }) && estado !== 'Completada') estado = 'Bloqueada';
      if (e.avance !== avance || e.estado !== estado) t.set('etapas', { id: e.id, avance: avance, estado: estado, actualizado: now() });
    });
    const p = findById('proyectos', proyectoId);
    if (!p) return;
    const valid = acts.filter(function (a) { return a.estado !== 'Cancelada'; });
    const done = valid.filter(function (a) { return a.estado === 'Completada'; }).length;
    const avance = valid.length ? Math.round(done * 100 / valid.length) : 0;
    if (p.avance !== avance) {
      const upd = { id: p.id, avance: avance };
      if (p.estado === 'Planificación' && done > 0) upd.estado = 'En curso';
      t.set('proyectos', upd);
    }
  }

  function nextCodigo() {
    const prefix = 'PRY-' + today().slice(0, 4) + '-';
    let max = 0;
    L.proyectos.forEach(function (p) {
      const c = String(p.codigo || '');
      if (c.indexOf(prefix) === 0) max = Math.max(max, parseInt(c.slice(prefix.length), 10) || 0);
    });
    return prefix + ('000' + (max + 1)).slice(-3);
  }

  const API = {};

  API.getData = function () { return data(); };

  API.saveConfig = function (cfg) {
    const t = Tx();
    const upd = {};
    ['empresa', 'moneda', 'etapasPlantilla', 'hojaUrl'].forEach(function (k) { if (cfg[k] !== undefined) upd[k] = String(cfg[k]); });
    if (Object.keys(upd).length) {
      upd.actualizado = now();
      Object.assign(L.config, upd); L.hojaUrl = L.config.hojaUrl || '';
      db.collection('config').doc('general').set(upd, { merge: true }).catch(function (e) { if (window.onDbError) window.onDbError(friendlyError(e)); });
    }
    if ((cfg.accesos !== undefined || cfg.admins !== undefined) && L.esAdmin) {
      const parse = function (txt, fallback) {
        if (txt === undefined) return fallback.slice();
        let list = String(txt).split(/[\s,;]+/).map(function (x) { return x.trim().toLowerCase(); })
          .filter(function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); });
        if (list.indexOf(email()) < 0) list.unshift(email()); // nadie se puede quitar a sí mismo
        return list.filter(function (x, i) { return list.indexOf(x) === i; });
      };
      const admins = parse(cfg.admins, L.admins);
      let emails = parse(cfg.accesos, L.accesos);
      admins.forEach(function (a) { if (emails.indexOf(a) < 0) emails.push(a); }); // un admin siempre tiene acceso
      L.accesos = emails; L.admins = admins;
      db.collection('config').doc('acceso').set({ emails: emails, admins: admins, actualizado: now(), actualizadoPor: email() }, { merge: true })
        .catch(function (e) { if (window.onDbError) window.onDbError(friendlyError(e)); });
    }
    return t.commit();
  };

  /* ---------- Proyectos, etapas, actividades ---------- */

  API.saveProyecto = function (p, crearEtapas) {
    requireText(p.nombre, 'Escribe el nombre del proyecto');
    const t = Tx();
    const isNew = !p.id;
    const rec = pick(p, 'proyectos');
    rec.estado = rec.estado || 'Planificación';
    rec.moneda = rec.moneda || cfgValue('moneda');
    if (isNew) { rec.id = newId('proyectos'); rec.codigo = rec.codigo || nextCodigo(); rec.avance = 0; rec.creado = now(); }
    rec.actualizado = now();
    t.set('proyectos', rec);
    log(t, 'Proyecto', rec.id, rec.id, isNew ? 'Creado' : 'Editado', (rec.codigo || '') + ' · ' + rec.nombre);
    if (isNew && crearEtapas) {
      String(cfgValue('etapasPlantilla') || '').split(',').map(function (s) { return s.trim(); }).filter(String)
        .forEach(function (n, i) {
          t.set('etapas', { id: newId('etapas'), proyectoId: rec.id, orden: i + 1, nombre: n, estado: 'Pendiente', avance: 0, creado: now(), actualizado: now() });
        });
    }
    return t.commit();
  };

  API.deleteProyecto = function (id) {
    const p = findById('proyectos', id);
    if (!p) throw new Error('Proyecto no encontrado');
    const t = Tx();
    ['actividades', 'etapas', 'documentos', 'inspecciones'].forEach(function (c) {
      where(c, 'proyectoId', id).forEach(function (x) { t.del(c, x.id); });
    });
    t.del('proyectos', id);
    log(t, 'Proyecto', id, id, 'Eliminado', p.codigo + ' · ' + p.nombre);
    return t.commit();
  };

  API.saveEtapa = function (e) {
    requireText(e.nombre, 'Escribe el nombre de la etapa');
    requireText(e.proyectoId, 'Falta el proyecto');
    const t = Tx();
    const isNew = !e.id;
    const rec = pick(e, 'etapas');
    if (isNew) {
      rec.id = newId('etapas');
      rec.orden = rec.orden || (where('etapas', 'proyectoId', e.proyectoId).length + 1);
      rec.creado = now(); rec.estado = 'Pendiente'; rec.avance = 0;
    }
    rec.actualizado = now();
    t.set('etapas', rec);
    recalcular(t, rec.proyectoId);
    log(t, 'Etapa', rec.id, rec.proyectoId, isNew ? 'Creada' : 'Editada', rec.nombre);
    return t.commit();
  };

  API.moveEtapa = function (id, delta) {
    const e = findById('etapas', id);
    if (!e) throw new Error('Etapa no encontrada');
    const list = where('etapas', 'proyectoId', e.proyectoId).slice().sort(function (a, b) { return a.orden - b.orden; });
    const i = list.findIndex(function (x) { return x.id === id; });
    const j = i + delta;
    if (j < 0 || j >= list.length) return data();
    const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    const t = Tx();
    list.forEach(function (x, k) { if (x.orden !== k + 1) t.set('etapas', { id: x.id, orden: k + 1 }); });
    return t.commit();
  };

  API.deleteEtapa = function (id) {
    const e = findById('etapas', id);
    if (!e) throw new Error('Etapa no encontrada');
    const t = Tx();
    where('actividades', 'etapaId', id).forEach(function (a) { t.set('actividades', { id: a.id, etapaId: '' }); });
    t.del('etapas', id);
    recalcular(t, e.proyectoId);
    log(t, 'Etapa', id, e.proyectoId, 'Eliminada', e.nombre);
    return t.commit();
  };

  function saveActividadTx(t, a) {
    requireText(a.titulo, 'Escribe qué hay que hacer');
    requireText(a.proyectoId, 'Elige el proyecto');
    const isNew = !a.id;
    const prev = isNew ? null : copy(findById('actividades', a.id));
    const rec = pick(a, 'actividades');
    rec.estado = rec.estado || 'Pendiente';
    rec.prioridad = rec.prioridad || 'Media';
    if (isNew) { rec.id = newId('actividades'); rec.creado = now(); }
    if (rec.estado === 'Completada' && (!prev || prev.estado !== 'Completada')) rec.completadoEn = now();
    if (rec.estado !== 'Completada') rec.completadoEn = '';
    rec.actualizado = now();
    t.set('actividades', rec);
    recalcular(t, rec.proyectoId);
    if (prev && prev.proyectoId && prev.proyectoId !== rec.proyectoId) recalcular(t, prev.proyectoId);
    let accion = isNew ? 'Creada' : 'Editada';
    if (prev && prev.estado !== rec.estado) accion = 'Estado: ' + prev.estado + ' → ' + rec.estado;
    log(t, 'Actividad', rec.id, rec.proyectoId, accion, rec.titulo + (rec.responsable ? ' (' + rec.responsable + ')' : ''));
    return rec;
  }

  API.saveActividad = function (a) { const t = Tx(); saveActividadTx(t, a); return t.commit(); };

  API.setEstadoActividad = function (id, estado, nota) {
    const a = copy(findById('actividades', id));
    if (!a) throw new Error('Actividad no encontrada');
    a.estado = estado;
    if (nota) a.notas = (a.notas ? a.notas + '\n' : '') + today() + ': ' + nota;
    const t = Tx(); saveActividadTx(t, a); return t.commit();
  };

  API.deleteActividad = function (id) {
    const a = findById('actividades', id);
    if (!a) throw new Error('Actividad no encontrada');
    const t = Tx();
    t.del('actividades', id);
    recalcular(t, a.proyectoId);
    log(t, 'Actividad', id, a.proyectoId, 'Eliminada', a.titulo);
    return t.commit();
  };

  /* ---------- Documentos ---------- */

  API.saveDocumento = function (d, file) {
    requireText(d.tipo, 'Elige el tipo de documento');
    requireText(d.proyectoId, 'Elige el proyecto');
    return upload('proyectos/' + d.proyectoId, file).then(function (f) {
      const t = Tx();
      const isNew = !d.id;
      const prev = isNew ? null : copy(findById('documentos', d.id));
      const rec = pick(d, 'documentos');
      rec.moneda = rec.moneda || cfgValue('moneda');
      if (isNew) { rec.id = newId('documentos'); rec.creado = now(); }
      keepFile(rec, prev);
      if (f) Object.assign(rec, f);
      rec.actualizado = now();
      t.set('documentos', rec);
      let accion = isNew ? 'Registrado' : 'Editado';
      if (prev && prev.estado !== rec.estado) accion = 'Estado: ' + prev.estado + ' → ' + rec.estado;
      if (f) accion += ' (archivo adjunto)';
      log(t, 'Documento', rec.id, rec.proyectoId, accion, rec.tipo + ' ' + (rec.numero || ''));
      return t.commit();
    });
  };

  API.deleteDocumento = function (id) {
    const d = findById('documentos', id);
    if (!d) throw new Error('Documento no encontrado');
    const t = Tx();
    t.del('documentos', id);
    log(t, 'Documento', id, d.proyectoId, 'Eliminado', d.tipo + ' ' + (d.numero || '') + (d.archivoUrl ? ' (el archivo sigue guardado)' : ''));
    return t.commit();
  };

  /* ---------- Personal y certificaciones ---------- */

  API.savePersona = function (p) {
    requireText(p.nombre, 'Escribe el nombre');
    const t = Tx();
    const isNew = !p.id;
    const prev = isNew ? null : copy(findById('personal', p.id));
    const rec = pick(p, 'personal');
    rec.nombre = String(rec.nombre).trim();
    rec.activo = rec.activo || 'Sí';
    if (isNew) { rec.id = newId('personal'); rec.creado = now(); }
    rec.actualizado = now();
    t.set('personal', rec);
    if (prev && prev.nombre && prev.nombre !== rec.nombre) {
      where('actividades', 'responsable', prev.nombre).forEach(function (a) { t.set('actividades', { id: a.id, responsable: rec.nombre }); });
    }
    log(t, 'Personal', rec.id, '', isNew ? 'Registrado' : 'Editado', rec.nombre + (rec.cargo ? ' · ' + rec.cargo : ''));
    return t.commit();
  };

  API.deletePersona = function (id) {
    const p = findById('personal', id);
    if (!p) throw new Error('Persona no encontrada');
    const t = Tx();
    where('certificaciones', 'personalId', id).forEach(function (c) { t.del('certificaciones', c.id); });
    t.del('personal', id);
    log(t, 'Personal', id, '', 'Eliminado', p.nombre + ' (sus tareas conservan el nombre)');
    return t.commit();
  };

  API.saveCertificacion = function (c, file) {
    requireText(c.personalId, 'Falta la persona');
    requireText(c.proceso, 'Elige el proceso de soldadura');
    return upload('personal/' + c.personalId, file).then(function (f) {
      const t = Tx();
      const isNew = !c.id;
      const prev = isNew ? null : copy(findById('certificaciones', c.id));
      const rec = pick(c, 'certificaciones');
      if (isNew) { rec.id = newId('certificaciones'); rec.creado = now(); }
      keepFile(rec, prev);
      if (f) Object.assign(rec, f);
      rec.actualizado = now();
      t.set('certificaciones', rec);
      const persona = findById('personal', rec.personalId) || { nombre: '' };
      log(t, 'Certificación', rec.id, '', isNew ? 'Registrada' : 'Editada',
        persona.nombre + ' · ' + rec.proceso + (rec.vencimiento ? ' · vence ' + rec.vencimiento : ''));
      return t.commit();
    });
  };

  API.deleteCertificacion = function (id) {
    const c = findById('certificaciones', id);
    if (!c) throw new Error('Certificación no encontrada');
    const t = Tx();
    t.del('certificaciones', id);
    log(t, 'Certificación', id, '', 'Eliminada', c.proceso);
    return t.commit();
  };

  /* ---------- Almacén ---------- */

  API.saveMaterial = function (m) {
    requireText(m.nombre, 'Escribe el nombre del material');
    const t = Tx();
    const isNew = !m.id;
    const rec = pick(m, 'materiales');
    if (isNew) { rec.id = newId('materiales'); rec.creado = now(); rec.stock = Number(rec.stock) || 0; }
    else delete rec.stock; // el stock solo cambia con movimientos
    rec.stockMinimo = Number(rec.stockMinimo) || 0;
    rec.actualizado = now();
    t.set('materiales', rec);
    if (isNew && rec.stock) {
      t.set('movimientos', { id: newId('movimientos'), fecha: today(), materialId: rec.id, tipo: 'Ajuste', cantidad: rec.stock,
        stockResultante: rec.stock, nota: 'Stock inicial', creado: now() });
    }
    log(t, 'Material', rec.id, '', isNew ? 'Registrado' : 'Editado', rec.nombre);
    return t.commit();
  };

  API.deleteMaterial = function (id) {
    const m = findById('materiales', id);
    if (!m) throw new Error('Material no encontrado');
    const t = Tx();
    where('movimientos', 'materialId', id).forEach(function (x) { t.del('movimientos', x.id); });
    t.del('materiales', id);
    log(t, 'Material', id, '', 'Eliminado', m.nombre);
    return t.commit();
  };

  API.registrarMovimiento = function (mv) {
    const m = findById('materiales', mv.materialId);
    if (!m) throw new Error('Elige el material');
    const cant = Number(mv.cantidad);
    if (!(cant >= 0) || (mv.tipo !== 'Ajuste' && !(cant > 0))) throw new Error('Escribe una cantidad mayor a cero');
    const stock0 = Number(m.stock) || 0;
    let stock = stock0;
    if (mv.tipo === 'Entrada') stock += cant;
    else if (mv.tipo === 'Salida') {
      if (cant > stock) throw new Error('No alcanza el stock: solo quedan ' + stock + ' ' + (m.unidad || ''));
      stock -= cant;
    } else if (mv.tipo === 'Ajuste') stock = cant;
    else throw new Error('Tipo de movimiento no válido');
    stock = round3(stock);
    const t = Tx();
    // Entrada/salida suman o restan en el servidor (seguro si dos personas registran a la vez)
    if (mv.tipo === 'Ajuste') t.set('materiales', { id: m.id, stock: stock, actualizado: now() });
    else t.inc('materiales', m.id, 'stock', round3(stock - stock0));
    const rec = pick(mv, 'movimientos');
    rec.id = newId('movimientos'); rec.fecha = rec.fecha || today(); rec.cantidad = cant;
    rec.stockResultante = stock; rec.creado = now();
    t.set('movimientos', rec);
    log(t, 'Almacén', m.id, rec.proyectoId || '', mv.tipo + ' ' + cant + ' ' + (m.unidad || ''),
      m.nombre + (rec.responsable ? ' · ' + rec.responsable : '') + ' (stock: ' + stock + ')');
    return t.commit();
  };

  /* ---------- Calidad ---------- */

  API.saveInspeccion = function (i, file) {
    requireText(i.proyectoId, 'Elige el proyecto');
    requireText(i.tipo, 'Elige el tipo de inspección');
    requireText(i.resultado, 'Elige el resultado');
    return upload('proyectos/' + i.proyectoId, file).then(function (f) {
      const t = Tx();
      const isNew = !i.id;
      const prev = isNew ? null : copy(findById('inspecciones', i.id));
      const rec = pick(i, 'inspecciones');
      rec.fecha = rec.fecha || today();
      if (isNew) { rec.id = newId('inspecciones'); rec.creado = now(); }
      keepFile(rec, prev);
      if (f) Object.assign(rec, f);
      if (prev && !rec.actividadId) rec.actividadId = prev.actividadId || '';
      if ((rec.resultado === 'Rechazado' || rec.resultado === 'Observado') && !rec.actividadId) {
        const etapas = where('etapas', 'proyectoId', rec.proyectoId);
        const etapa = etapas.filter(function (e) { return /soldadura/i.test(e.nombre); })[0] ||
          etapas.filter(function (e) { return /calidad/i.test(e.nombre); })[0] || null;
        const act = saveActividadTx(t, {
          proyectoId: rec.proyectoId, etapaId: etapa ? etapa.id : '',
          titulo: (rec.resultado === 'Rechazado' ? 'Reparar: ' : 'Levantar observación: ') + rec.tipo + (rec.elemento ? ' — ' + rec.elemento : ''),
          prioridad: rec.resultado === 'Rechazado' ? 'Alta' : 'Media',
          fechaLimite: addDays(today(), rec.resultado === 'Rechazado' ? 2 : 5),
          notas: rec.observaciones || '', estado: 'Pendiente'
        });
        rec.actividadId = act.id;
      }
      rec.actualizado = now();
      t.set('inspecciones', rec);
      let accion = isNew ? 'Registrada: ' + rec.resultado : 'Editada';
      if (prev && prev.resultado !== rec.resultado) accion = 'Resultado: ' + prev.resultado + ' → ' + rec.resultado;
      log(t, 'Inspección', rec.id, rec.proyectoId, accion, rec.tipo + (rec.elemento ? ' · ' + rec.elemento : ''));
      return t.commit();
    });
  };

  API.deleteInspeccion = function (id) {
    const x = findById('inspecciones', id);
    if (!x) throw new Error('Inspección no encontrada');
    const t = Tx();
    t.del('inspecciones', id);
    log(t, 'Inspección', id, x.proyectoId, 'Eliminada', x.tipo);
    return t.commit();
  };

  /* ---------- Máquinas ---------- */

  API.saveEquipo = function (e) {
    requireText(e.nombre, 'Escribe el nombre de la máquina');
    const t = Tx();
    const isNew = !e.id;
    const rec = pick(e, 'equipos');
    rec.estado = rec.estado || 'Operativo';
    rec.frecuenciaDias = Number(rec.frecuenciaDias) || '';
    if (!rec.proximoMant && rec.ultimoMant && rec.frecuenciaDias) rec.proximoMant = addDays(rec.ultimoMant, rec.frecuenciaDias);
    if (isNew) { rec.id = newId('equipos'); rec.creado = now(); }
    rec.actualizado = now();
    t.set('equipos', rec);
    log(t, 'Máquina', rec.id, '', isNew ? 'Registrada' : 'Editada', rec.nombre + ' · ' + rec.estado);
    return t.commit();
  };

  API.registrarMantenimiento = function (id, fecha, nota) {
    const e = copy(findById('equipos', id));
    if (!e) throw new Error('Máquina no encontrada');
    e.ultimoMant = fecha || today();
    e.proximoMant = e.frecuenciaDias ? addDays(e.ultimoMant, e.frecuenciaDias) : '';
    e.estado = 'Operativo';
    if (nota) e.notas = (e.notas ? e.notas + '\n' : '') + e.ultimoMant + ': ' + nota;
    e.actualizado = now();
    const t = Tx();
    t.set('equipos', e);
    log(t, 'Máquina', id, '', 'Mantenimiento realizado', e.nombre + (nota ? ' · ' + nota : ''));
    return t.commit();
  };

  API.deleteEquipo = function (id) {
    const e = findById('equipos', id);
    if (!e) throw new Error('Máquina no encontrada');
    const t = Tx();
    t.del('equipos', id);
    log(t, 'Máquina', id, '', 'Eliminada', e.nombre);
    return t.commit();
  };

  /* ---------- Historial ---------- */

  API.getHistorial = function (proyectoId) {
    return db.collection('historial').where('proyectoId', '==', proyectoId).limit(500).get().then(function (snap) {
      return snap.docs.map(function (d) { return d.data(); })
        .sort(function (a, b) { return a.fecha > b.fecha ? -1 : 1; }).slice(0, 200);
    });
  };

  /** Llamada desde la interfaz: api('saveActividad', …) → Promise con los datos actualizados. */
  function call(fn, args) {
    return new Promise(function (resolve, reject) {
      if (!API[fn]) return reject(new Error('Función desconocida: ' + fn));
      try { Promise.resolve(API[fn].apply(null, args)).then(resolve, reject); } catch (e) { reject(e); }
    });
  }

  window.DB = { start: start, login: login, logout: logout, call: call, email: email };
})();
