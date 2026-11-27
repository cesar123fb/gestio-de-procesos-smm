/** Carga datos de ejemplo (metalmecánica) usando las mismas funciones del backend. */
module.exports = function (call) {
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const last = (list) => list[list.length - 1];
  let data;

  call('saveConfig', { empresa: 'Metalmecánica Ejemplo SAC' });
  [['Carlos Rojas', 'Supervisor', '987 654 321'], ['Ana Torres', 'Ingeniería / dibujante', '976 111 222'],
    ['Luis Pérez', 'Soldador', '965 333 444'], ['Jorge Quispe', 'Soldador', '954 555 666'],
    ['Miguel Huamán', 'Armador', '943 777 888'], ['Rosa Díaz', 'Inspector de calidad', '932 999 000'],
    ['Pedro Salas', 'Almacenero', '921 123 456']].forEach((p) => { data = call('savePersona', { nombre: p[0], cargo: p[1], telefono: p[2] }); });
  const per = (n) => data.personal.find((p) => p.nombre === n).id;
  call('saveCertificacion', { personalId: per('Luis Pérez'), proceso: 'SMAW (electrodo)', norma: 'AWS D1.1', posicion: '3G', numero: 'WQ-2025-118', emision: d(-345), vencimiento: d(20) });
  call('saveCertificacion', { personalId: per('Luis Pérez'), proceso: 'GMAW (MIG/MAG)', norma: 'AWS D1.1', posicion: '2G', numero: 'WQ-2026-044', emision: d(-60), vencimiento: d(305) });
  call('saveCertificacion', { personalId: per('Jorge Quispe'), proceso: 'FCAW (alambre tubular)', norma: 'AWS D1.1', posicion: '4G', numero: 'WQ-2025-090', emision: d(-370), vencimiento: d(-5) });

  data = call('saveProyecto', { nombre: 'Estructura metálica nave industrial Lurín', cliente: 'Inversiones Andinas SAC',
    responsable: 'Carlos Rojas', fechaInicio: d(-30), fechaFin: d(25), presupuesto: 185000, moneda: 'PEN', estado: 'En curso',
    descripcion: 'Fabricación y montaje de 6 pórticos, correas y arriostres. Acero ASTM A36, soldadura según AWS D1.1.' }, true);
  const p1 = last(data.proyectos);
  const s1 = data.etapas.filter((e) => e.proyectoId === p1.id).sort((a, b) => a.orden - b.orden);
  [
    [0, 'Planos de fabricación pórticos', 'Ana Torres', d(-24), 'Completada', 'Media', 16],
    [1, 'Comprar planchas 3/8" y vigas W12', 'Carlos Rojas', d(-18), 'Completada', 'Alta', 4],
    [2, 'Corte de planchas para cartelas', 'Miguel Huamán', d(-10), 'Completada', 'Media', 12],
    [3, 'Armado pórticos 1 al 3', 'Miguel Huamán', d(-2), 'En curso', 'Alta'],
    [4, 'Soldar vigas pórtico 1', 'Luis Pérez', d(-1), 'En curso', 'Alta'],
    [4, 'Soldar vigas pórtico 2', 'Jorge Quispe', d(0), 'Pendiente', 'Alta'],
    [4, 'Soldar correas', 'Luis Pérez', d(4), 'Pendiente', 'Media'],
    [5, 'Arenado y pintura base', '', d(9), 'Pendiente', 'Media'],
    [6, 'Inspección visual y tintes penetrantes', 'Rosa Díaz', d(12), 'Pendiente', 'Media'],
    [7, 'Despacho y montaje en obra', 'Carlos Rojas', d(25), 'Pendiente', 'Media']
  ].forEach((a) => {
    data = call('saveActividad', { proyectoId: p1.id, etapaId: s1[a[0]].id, titulo: a[1], responsable: a[2],
      fechaLimite: a[3], estado: a[4], prioridad: a[5], horas: a[6] || '' });
  });
  data = call('saveDocumento', { proyectoId: p1.id, tipo: 'Cotización', numero: 'COT-0145', contraparte: 'Inversiones Andinas SAC', fecha: d(-35), monto: 182500, moneda: 'PEN', estado: 'Aprobada' });
  const cot = last(data.documentos);
  data = call('saveDocumento', { proyectoId: p1.id, tipo: 'Orden de compra', numero: 'OC-2026-311', contraparte: 'Aceros del Perú SA', fecha: d(-20), monto: 48400, moneda: 'PEN', estado: 'Entregada', referenciaId: cot.id });
  data = call('saveDocumento', { proyectoId: p1.id, tipo: 'Orden de compra', numero: 'OC-2026-318', contraparte: 'Soldaduras Lima', fecha: d(-6), monto: 6900, moneda: 'PEN', estado: 'Confirmada' });
  data = call('saveDocumento', { proyectoId: p1.id, tipo: 'Factura', numero: 'F001-889', contraparte: 'Inversiones Andinas SAC', fecha: d(-5), monto: 54750, moneda: 'PEN', estado: 'Por cobrar' });
  data = call('saveDocumento', { proyectoId: p1.id, tipo: 'Plano', numero: 'EST-01 Rev.B', contraparte: 'Ana Torres', fecha: d(-24), estado: 'Aprobado para fabricación' });

  data = call('saveProyecto', { nombre: 'Tanque de agua 20 m³ planta Arequipa', cliente: 'Minera del Sur',
    responsable: 'Ana Torres', fechaInicio: d(-8), fechaFin: d(40), presupuesto: 38000, moneda: 'USD', estado: 'Planificación' }, true);
  const p2 = last(data.proyectos);
  const s2 = data.etapas.filter((e) => e.proyectoId === p2.id).sort((a, b) => a.orden - b.orden);
  data = call('saveActividad', { proyectoId: p2.id, etapaId: s2[0].id, titulo: 'Plano de virolas y tapas', responsable: 'Ana Torres', fechaLimite: d(-3), prioridad: 'Alta' });
  data = call('saveActividad', { proyectoId: p2.id, etapaId: s2[1].id, titulo: 'Cotizar planchas 1/4" A36', responsable: 'Carlos Rojas', fechaLimite: d(1) });
  data = call('saveActividad', { proyectoId: p2.id, etapaId: s2[1].id, titulo: 'Comprar electrodos E6011 y E7018', responsable: 'Pedro Salas', fechaLimite: d(3) });
  const bloq = last(data.actividades);
  call('setEstadoActividad', bloq.id, 'Bloqueada', 'Esperando aprobación: proveedor no confirma precio');
  data = call('saveDocumento', { proyectoId: p2.id, tipo: 'Cotización', numero: 'COT-0152', contraparte: 'Minera del Sur', fecha: d(-7), monto: 37600, moneda: 'USD', estado: 'Enviada' });

  data = call('saveProyecto', { nombre: 'Barandas y escaleras sede Callao', cliente: 'Logística Pacífico', responsable: 'Carlos Rojas',
    fechaInicio: d(-90), fechaFin: d(-5), presupuesto: 15000, moneda: 'PEN', estado: 'Completado' }, false);

  // Almacén
  [['Electrodo E7018 1/8"', 'ELE-7018', 'Electrodos y alambre', 'kg', 12, 25, 'Estante A-1'],
    ['Electrodo E6011 1/8"', 'ELE-6011', 'Electrodos y alambre', 'kg', 40, 20, 'Estante A-1'],
    ['Alambre MIG ER70S-6 0.9 mm', 'ALA-70S6', 'Electrodos y alambre', 'rollo', 6, 3, 'Estante A-2'],
    ['Plancha A36 3/8" 1.2x2.4 m', 'PL-38', 'Planchas', 'plancha', 8, 4, 'Patio 1'],
    ['Viga W12x26', 'W12-26', 'Perfiles y vigas', 'barra', 14, 6, 'Patio 2'],
    ['Gas mezcla Ar/CO2 75/25', 'GAS-7525', 'Gases', 'balón', 0, 2, 'Zona de gases'],
    ['Disco de corte 7"', 'DIS-C7', 'Discos y abrasivos', 'unid', 35, 30, 'Estante B-3'],
    ['Disco de desbaste 4 1/2"', 'DIS-D45', 'Discos y abrasivos', 'unid', 60, 25, 'Estante B-3'],
    ['Pintura base epóxica', 'PIN-EPX', 'Pintura y anticorrosivo', 'galón', 10, 5, 'Almacén pintura'],
    ['Guantes de soldador', 'EPP-GUA', 'EPP (seguridad)', 'par', 9, 10, 'EPP']
  ].forEach((m) => { data = call('saveMaterial', { nombre: m[0], codigo: m[1], categoria: m[2], unidad: m[3], stock: m[4], stockMinimo: m[5], ubicacion: m[6] }); });
  const mat = (c) => data.materiales.find((m) => m.codigo === c).id;
  data = call('registrarMovimiento', { tipo: 'Salida', materialId: mat('PL-38'), cantidad: 4, proyectoId: p1.id, responsable: 'Miguel Huamán', fecha: d(-10) });
  data = call('registrarMovimiento', { tipo: 'Salida', materialId: mat('W12-26'), cantidad: 6, proyectoId: p1.id, responsable: 'Miguel Huamán', fecha: d(-4) });
  data = call('registrarMovimiento', { tipo: 'Salida', materialId: mat('ELE-7018'), cantidad: 8, proyectoId: p1.id, responsable: 'Luis Pérez', fecha: d(-1) });
  data = call('registrarMovimiento', { tipo: 'Entrada', materialId: mat('DIS-D45'), cantidad: 50, responsable: 'Pedro Salas', nota: 'Guía 001-245', fecha: d(-3) });

  // Calidad
  call('saveInspeccion', { proyectoId: p1.id, tipo: 'Dimensional', elemento: 'Cartelas pórtico 1', inspector: 'Rosa Díaz', resultado: 'Aprobado', fecha: d(-8) });
  call('saveInspeccion', { proyectoId: p1.id, tipo: 'Visual de soldadura', elemento: 'Viga V-3, junta J-12', inspector: 'Rosa Díaz', resultado: 'Rechazado', fecha: d(-1), observaciones: 'Porosidad en el cordón de raíz y socavación de 1 mm' });
  call('saveInspeccion', { proyectoId: p1.id, tipo: 'Visual de soldadura', elemento: 'Columna C-1, placa base', inspector: 'Rosa Díaz', resultado: 'Aprobado', fecha: d(-1) });

  // Máquinas
  call('saveEquipo', { nombre: 'Máquina de soldar Miller 1', codigo: 'MS-01', tipo: 'Máquina de soldar', marca: 'Miller XMT 350', estado: 'Operativo', ultimoMant: d(-100), frecuenciaDias: 90, responsable: 'Luis Pérez' });
  call('saveEquipo', { nombre: 'Máquina de soldar Lincoln 2', codigo: 'MS-02', tipo: 'Máquina de soldar', marca: 'Lincoln Invertec V350', estado: 'Operativo', ultimoMant: d(-85), frecuenciaDias: 90, responsable: 'Jorge Quispe' });
  call('saveEquipo', { nombre: 'Cortadora plasma Hypertherm', codigo: 'PL-01', tipo: 'Cortadora plasma', marca: 'Hypertherm Powermax 65', estado: 'Fuera de servicio', ultimoMant: d(-40), frecuenciaDias: 180, notas: 'Falla en antorcha, esperando repuesto' });
  call('saveEquipo', { nombre: 'Compresor 100 L', codigo: 'CP-01', tipo: 'Compresor', estado: 'Operativo', ultimoMant: d(-20), frecuenciaDias: 60 });
  call('saveEquipo', { nombre: 'Esmeril angular 7"', codigo: 'ES-03', tipo: 'Esmeril / amoladora', marca: 'DeWalt', estado: 'Operativo', ultimoMant: d(-10), frecuenciaDias: 180, responsable: 'Miguel Huamán' });
};
