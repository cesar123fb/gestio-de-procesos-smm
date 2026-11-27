# Gestión de Proyectos — Manufactura y soldadura (Google Sheets + Drive)

Sistema de gestión para talleres de metalmecánica, estructuras y soldadura. Funciona en el celular y en la computadora,
con botones grandes y palabras simples para personal con poca experiencia en sistemas.

**Para el día a día del taller**
- **Equipo:** cada persona con sus tareas *atrasadas*, *para hoy* y *de esta semana*, en colores. Así se ve de inmediato
  quién tiene urgencias. Cada trabajador toca su nombre → **«Soy yo»** y ve sus tareas primero al abrir el programa.
- **Botones simples en cada tarea:** **Empezar**, **Terminé** y **Problema** (falta material, máquina malograda,
  faltan planos…). El problema aparece como alerta para el supervisor.
- **Botón +** para registrar rápido: tarea, salida o entrada de material, inspección, documento o proyecto.
- **Alertas en Inicio:** tareas atrasadas o con problema, soldaduras rechazadas sin reparar, material agotado o con
  stock bajo, certificaciones de soldador por vencer y mantenimientos atrasados.

**Gestión**
- **Proyectos / órdenes de trabajo** con etapas de fabricación (Ingeniería y planos → Compra de materiales → Corte →
  Armado → Soldadura → Acabado y pintura → Control de calidad → Despacho e instalación), avance automático y horas hombre.
- **Cotizaciones, órdenes de compra, facturas y planos**: subes el archivo (PDF, foto, Excel) y sigues su estado.
- **Almacén:** materiales (planchas, perfiles, electrodos, gases, discos, EPP…) con stock mínimo, entradas, salidas por
  proyecto y conteo físico. No permite sacar más de lo que hay.
- **Calidad:** inspecciones (visual, dimensional, tintes penetrantes, ultrasonido…) con foto. Si sale **Rechazado** u
  **Observado**, se crea sola la tarea de reparación.
- **Personal y certificaciones de soldador** (proceso SMAW/GMAW/FCAW/GTAW, norma AWS D1.1 / ASME IX, posición,
  vencimiento) con aviso 30 días antes.
- **Máquinas:** soldadoras, plasma, esmeriles, compresores… con estado y mantenimiento programado.
- **Historial** de cambios por proyecto y sección de **Ayuda** dentro del programa.

Todos los datos quedan en Google Sheets (hojas `Proyectos`, `Etapas`, `Actividades`, `Documentos`, `Personal`,
`Certificaciones`, `Materiales`, `Movimientos`, `Inspecciones`, `Equipos`, `Historial`, `Config`) y los archivos en
Google Drive (carpeta «Gestión de Proyectos - Archivos»), listos para tablas dinámicas o Looker Studio.

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
Registra a tu personal en **Equipo → Agregar persona**; luego cada uno toca su nombre y **«Soy yo»** en su celular.

## Prueba local (opcional, para desarrollo)

```bash
node dev/servidor-local.js --demo   # http://localhost:8080 con datos de ejemplo
```

Simula Sheets/Drive en memoria y ejecuta el mismo `Code.gs`. Los archivos subidos quedan en `dev/uploads/`.

`node dev/generar-vista-previa.js vista.html` crea una página independiente con datos de ejemplo (demo sin Google).

> Si ya tenías instalada una versión anterior: pega el código nuevo, ejecuta `setup` una vez (agrega las hojas y columnas
> nuevas sin borrar datos) y publica una **nueva versión** de la implementación.
