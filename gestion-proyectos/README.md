# Gestión de Proyectos (Google Sheets + Drive)

Sistema de seguimiento de proyectos que funciona en el celular y en la computadora.

- **Proyectos** con código automático (PRY-2026-001), cliente, responsable, fechas, presupuesto y estado.
- **Etapas de trabajo** (plantilla configurable: Planificación → Cotización → Aprobación → Ejecución → Entrega → Cierre) con avance automático.
- **Actividades pendientes** con responsable, fecha límite, prioridad y estado; vista de *Vencidas / Hoy / Próximos 7 días*.
- **Cotizaciones, órdenes de compra y facturas**: subes el archivo (PDF, foto desde el celular, Excel) y sigues su estado
  (p. ej. OC: Emitida → Confirmada → En proceso → Entregada → Facturada → Pagada). Puedes relacionar una OC con su cotización.
- **Panel** con indicadores, montos por moneda e **historial** de cambios por proyecto.
- **Todos los datos quedan en Google Sheets** (hojas `Proyectos`, `Etapas`, `Actividades`, `Documentos`, `Historial`, `Config`)
  y los archivos en Google Drive (carpeta «Gestión de Proyectos - Archivos», una subcarpeta por proyecto).
  Así puedes hacer tablas dinámicas, gráficos, filtros o conectar Looker Studio sobre esas hojas.

## Instalación (10 minutos, sin costo)

1. Crea una hoja nueva en <https://sheets.new> y ponle nombre, p. ej. «Gestión de Proyectos».
2. En la hoja: **Extensiones → Apps Script**.
3. En el editor de Apps Script:
   - Reemplaza el contenido de `Código.gs` por el de **`Code.gs`**.
   - Crea 3 archivos HTML con **+ → HTML**, llamados exactamente `Index`, `Styles` y `App`, y pega el contenido de
     `Index.html`, `Styles.html` y `App.html`.
   - (Opcional) En ⚙ *Configuración del proyecto*, marca «Mostrar el archivo de manifiesto» y pega `appsscript.json`
     (ahí está la zona horaria `America/Lima`; cámbiala si estás en otro país).
4. Guarda (💾). Elige la función `setup` en la barra superior y pulsa **Ejecutar**. Google pedirá permisos
   (hoja de cálculo y Drive): acepta. Se crearán las hojas automáticamente.
5. **Implementar → Nueva implementación → tipo «Aplicación web»**:
   - *Ejecutar como*: **Yo**.
   - *Quién tiene acceso*: **Solo yo** (o «Cualquier usuario con cuenta de Google» si quieres que tu equipo la use).
   - Pulsa **Implementar** y copia la URL que termina en `/exec`.
6. **En el celular**: abre esa URL en Chrome (Android) o Safari (iPhone) y elige
   **«Añadir a pantalla de inicio»**. Te queda como una app más.

> Cuando cambies el código: **Implementar → Gestionar implementaciones → editar (lápiz) → Versión: Nueva versión**.
> La URL no cambia.

## Uso con tu equipo

Si eliges «Ejecutar como: Yo», todo lo que suban otras personas se guarda en *tu* Drive y *tu* hoja,
y el historial registra el correo de quien hizo cada cambio (cuando Google lo permite).
Agrega los nombres del equipo en **Ajustes → Responsables** para que aparezcan como sugerencia.

## Prueba local (opcional, para desarrollo)

```bash
node dev/servidor-local.js --demo   # http://localhost:8080 con datos de ejemplo
```

Simula Sheets/Drive en memoria y ejecuta el mismo `Code.gs`. Los archivos subidos quedan en `dev/uploads/`.
