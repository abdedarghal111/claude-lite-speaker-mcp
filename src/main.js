#!/usr/bin/env node
// Punto de entrada de la app: arranca el servidor MCP, la bandeja del
// sistema y la ventana de ajustes, todo en el mismo proceso.
process.title = "Claude Lite Speaker"

const { app: electronApp, protocol } = await import("electron")
const { Logger } = await import("./class/Logger.js")

// Registra con traza cualquier error no controlado y termina el proceso.
function fatal(err) {
  Logger.error("app:fatal", `Error no controlado; la aplicación se cierra: ${err?.message ?? err}`, err)
  process.exit(1)
}
process.on("unhandledRejection", fatal)
process.on("uncaughtException", fatal)

// El esquema "app://" sirve el frontend (ver class/Window.js) y necesita los privilegios
// de un origen normal. Solo se puede declarar antes de que la app esté lista.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

// Después de los manejadores, para que un import fallido quede registrado.
const { App } = await import("./class/App.js")
const { Notifier } = await import("./class/Notifier.js")
const { RESOURCES_DIR, FRONTEND_DIR, APP_ROOT, SESSION_PROFILE_DIR } = await import("./paths.js")

// Perfil de sesión de la ventana, aparte del resto de datos (ver class/Window.js).
electronApp.setPath("userData", SESSION_PROFILE_DIR)

// La app vive en la bandeja: sin ventanas abiertas no se sale.
electronApp.on("window-all-closed", () => {})

// En .then() y no con await: en ESM, un top-level await impide que llegue "ready".
electronApp.whenReady().then(async () => {
  const app = App.getInstance()

  // Arranca el MCP antes que la bandeja para no duplicar instancias si el puerto ya está ocupado.
  await app.start()

  // El autoarranque necesita APP_ROOT para apuntar al binario.
  await app.tray.start({ resourcesDir: RESOURCES_DIR, frontendDir: FRONTEND_DIR, appRoot: APP_ROOT })

  // A partir de aquí los errores registrados avisan al usuario.
  Notifier.start(RESOURCES_DIR)

  // No se abre sola si el autoarranque la lanzó en segundo plano
  const launchedFromAutostart = process.argv.includes("--opened-from-autostart")
  if (!launchedFromAutostart) {
    app.tray.window.open()

    // Abre las devtools solo si se pide con --open-dev-tools.
    if (process.argv.includes("--open-dev-tools")) {
      app.tray.window.openDevtools()
    }
  }
}, fatal)
