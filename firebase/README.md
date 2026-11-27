# Versión Firebase (rápida) + respaldo en Google Sheets

- **La app** guarda todo en **Firebase**: los cambios se ven al instante, en todos los celulares a la vez, y sigue
  funcionando sin señal (sincroniza cuando vuelve).
- **Google Sheets** recibe una **copia automática cada hora** (una pestaña por tabla, con nombres legibles) para ver,
  filtrar, hacer tablas dinámicas o gráficos como en Excel. Los cambios se hacen en la app; la hoja es el respaldo.
- Solo entran los **correos de Google que el administrador autorice**. La primera persona que entra queda como
  administradora.

```
docs/                     ← la app web lista para publicar (GitHub Pages o Firebase Hosting)
  index.html              ← generado por firebase/generar-web.js (no editar a mano)
  firebase-config.js      ← datos de tu proyecto de Firebase
firebase/
  firebase-db.js          ← capa de datos (misma lógica que Code.gs)
  firestore.rules         ← reglas de seguridad de la base de datos
  storage.rules           ← reglas de seguridad de los archivos
  respaldo-sheets/        ← script para la hoja de Google Sheets
```

## 1. Preparar Firebase (unos 10 minutos, en la computadora)

Entra a <https://console.firebase.google.com> con tu cuenta y abre el proyecto **proyect-management-c27ab**
(el mismo de tu app anterior). Si prefieres uno nuevo, créalo y copia su configuración en `docs/firebase-config.js`.

1. **Inicio de sesión con Google**: menú *Compilación → Authentication* → *Comenzar* → pestaña *Método de acceso* →
   **Google** → *Habilitar* → elige tu correo de asistencia → *Guardar*.
2. **Base de datos**: *Compilación → Firestore Database*. Si no existe, *Crear base de datos* (ubicación
   `southamerica-east1` o la más cercana, modo producción).
   Pestaña **Reglas** → borra todo → pega el contenido de [`firestore.rules`](firestore.rules) → **Publicar**.
   > Estas reglas también mantienen funcionando tu app anterior (DesignManager Pro).
3. **Archivos** (cotizaciones, fotos, certificados): *Compilación → Storage* → *Comenzar*.
   Firebase pide pasar al plan **Blaze** (pago por uso, con tarjeta). Para un taller el uso suele quedar dentro de la
   parte gratuita; pon una **alerta de presupuesto** de 1 USD en *Uso y facturación* para estar tranquilo.
   Pestaña **Reglas** → pega [`storage.rules`](storage.rules) → **Publicar**.
   > Si no activas Storage, la app funciona igual; solo no podrá subir archivos.

## 2. Publicar la app (gratis, sin instalar nada)

Con **GitHub Pages**:

1. En GitHub, abre el repositorio → **Settings** → **Pages**.
2. *Source*: **Deploy from a branch** → *Branch*: la rama con el código (`main` una vez unida, o
   `claude/project-management-system-sfahkp`) → carpeta **`/docs`** → **Save**.
3. En 1–2 minutos aparece la dirección, por ejemplo `https://cesar123fb.github.io/gestio-de-procesos-smm/`.
4. En Firebase: *Authentication → Configuración → Dominios autorizados* → **Agregar dominio** → `cesar123fb.github.io`.

(Alternativa: Firebase Hosting con `firebase deploy --only hosting` desde la carpeta `firebase/`; la dirección sería
`https://proyect-management-c27ab.web.app`, que ya está autorizada.)

## 3. Primer uso

1. Abre la dirección y toca **Entrar con Google**. Al ser la primera persona, quedas como **administrador**.
2. **Ajustes**: nombre de la empresa y, en **Acceso**, los correos de Google de tu equipo (uno por línea).
3. **Equipo → Agregar persona** para cada trabajador. Cada uno entra con su correo y toca **«Soy yo»**.
4. En el celular: menú del navegador → **«Añadir a pantalla de inicio»**.

## 4. Respaldo en Google Sheets

Usa una hoja de cálculo de **la misma cuenta de Google que es dueña del proyecto de Firebase** (o agrega esa cuenta en
Firebase → ⚙ *Configuración del proyecto → Usuarios y permisos* con rol **Lector**).

1. Abre la hoja (sirve la que ya creamos: «Gestión de Proyectos - Taller») → **Extensiones → Apps Script**.
2. Borra el contenido de `Código.gs` y pega [`respaldo-sheets/Respaldo.gs`](respaldo-sheets/Respaldo.gs).
3. ⚙ *Configuración del proyecto* → marca **«Mostrar el archivo de manifiesto appsscript.json»** → vuelve al editor,
   abre `appsscript.json`, borra todo y pega [`respaldo-sheets/appsscript.json`](respaldo-sheets/appsscript.json). Guarda.
4. Elige la función **`respaldar`** → **▶ Ejecutar** → acepta los permisos. Aparecen las pestañas Proyectos, Tareas,
   Materiales, Movimientos, Inspecciones, etc.
5. Elige **`activarRespaldoAutomatico`** → **▶ Ejecutar**. Desde ahora se actualiza sola **cada hora**.
   También tendrás el menú **Respaldo Firebase → Actualizar ahora** dentro de la hoja.
6. En la app: **Ajustes → Enlace a la hoja de Google Sheets** → pega la dirección de la hoja. Aparecerá el botón
   «Abrir Google Sheets».

> La hoja es una copia: si editas algo en ella, se reemplaza en el siguiente respaldo. Para análisis propios, crea
> pestañas nuevas con fórmulas que lean de las pestañas del respaldo.

## Para desarrolladores

```bash
node firebase/generar-web.js                 # regenera docs/index.html tras cambiar la interfaz
cd firebase && npx firebase-tools emulators:start --only firestore,auth,storage   # pruebas locales
```
