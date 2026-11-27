/** Carga datos de ejemplo usando las mismas funciones del backend. */
module.exports = function (call) {
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const last = (list) => list[list.length - 1];

  let data = call('saveProyecto', { nombre: 'Remodelación oficinas Miraflores', cliente: 'Inversiones Andinas SAC',
    responsable: 'Carlos Rojas', fechaInicio: d(-30), fechaFin: d(25), presupuesto: 85000, moneda: 'PEN', estado: 'En curso',
    descripcion: 'Remodelación integral del piso 4: tabiquería, eléctricas, mobiliario.' }, true);
  const p1 = last(data.proyectos);
  const st1 = data.etapas.filter((e) => e.proyectoId === p1.id).sort((a, b) => a.orden - b.orden);
  const acts = [
    [0, 'Levantamiento de medidas', 'Carlos Rojas', d(-25), 'Completada'],
    [0, 'Planos de distribución', 'Ana Torres', d(-20), 'Completada'],
    [1, 'Cotizar tabiquería drywall', 'Ana Torres', d(-15), 'Completada'],
    [1, 'Cotizar mobiliario', 'Ana Torres', d(-3), 'En curso', 'Alta'],
    [2, 'Aprobación del cliente', 'Carlos Rojas', d(2), 'Pendiente', 'Alta'],
    [3, 'Instalación eléctrica', 'Luis Pérez', d(10), 'Pendiente'],
    [3, 'Pintura y acabados', 'Luis Pérez', d(18), 'Pendiente'],
    [4, 'Entrega y acta de conformidad', 'Carlos Rojas', d(25), 'Pendiente']
  ];
  acts.forEach((a) => {
    data = call('saveActividad', { proyectoId: p1.id, etapaId: st1[a[0]].id, titulo: a[1], responsable: a[2],
      fechaLimite: a[3], estado: a[4], prioridad: a[5] || 'Media' });
  });
  data = call('saveDocumento', { proyectoId: p1.id, tipo: 'Cotización', numero: 'COT-0145', contraparte: 'Inversiones Andinas SAC',
    fecha: d(-14), monto: 82500, moneda: 'PEN', estado: 'Aprobada' });
  const cot = last(data.documentos);
  data = call('saveDocumento', { proyectoId: p1.id, tipo: 'Orden de compra', numero: 'OC-2026-311', contraparte: 'Drywall Perú EIRL',
    fecha: d(-8), monto: 18400, moneda: 'PEN', estado: 'Confirmada', referenciaId: cot.id });
  data = call('saveDocumento', { proyectoId: p1.id, tipo: 'Cotización', numero: 'COT-0151', contraparte: 'Muebles Lima',
    fecha: d(-2), monto: 23900, moneda: 'PEN', estado: 'En revisión' });
  data = call('saveDocumento', { proyectoId: p1.id, tipo: 'Factura', numero: 'F001-889', contraparte: 'Inversiones Andinas SAC',
    fecha: d(-5), monto: 24750, moneda: 'PEN', estado: 'Por cobrar' });

  data = call('saveProyecto', { nombre: 'Suministro de equipos planta Arequipa', cliente: 'Minera del Sur',
    responsable: 'Ana Torres', fechaInicio: d(-10), fechaFin: d(45), presupuesto: 120000, moneda: 'USD', estado: 'Planificación' }, true);
  const p2 = last(data.proyectos);
  const st2 = data.etapas.filter((e) => e.proyectoId === p2.id).sort((a, b) => a.orden - b.orden);
  data = call('saveActividad', { proyectoId: p2.id, etapaId: st2[0].id, titulo: 'Reunión de alcance con cliente', responsable: 'Ana Torres', fechaLimite: d(-1), prioridad: 'Alta' });
  data = call('saveActividad', { proyectoId: p2.id, etapaId: st2[1].id, titulo: 'Solicitar cotizaciones a 3 proveedores', responsable: 'Luis Pérez', fechaLimite: d(0) });
  data = call('saveActividad', { proyectoId: p2.id, etapaId: st2[1].id, titulo: 'Comparativo de proveedores', responsable: 'Luis Pérez', fechaLimite: d(5) });
  data = call('saveDocumento', { proyectoId: p2.id, tipo: 'Cotización', numero: 'Q-7781', contraparte: 'Atlas Equipos',
    fecha: d(-1), monto: 98000, moneda: 'USD', estado: 'Enviada' });

  data = call('saveProyecto', { nombre: 'Mantenimiento anual sede Callao', cliente: 'Logística Pacífico', responsable: 'Luis Pérez',
    fechaInicio: d(-90), fechaFin: d(-5), presupuesto: 15000, moneda: 'PEN', estado: 'Completado' }, false);
  call('saveConfig', { responsables: 'Carlos Rojas, Ana Torres, Luis Pérez', empresa: 'Constructora Ejemplo' });
};
