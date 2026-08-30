#!/usr/bin/env node
// Punto de entrada de la app: arranca el servidor MCP, la bandeja del
// sistema y la ventana de ajustes, todo en el mismo proceso.
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE_FILE = fileURLToPath(import.meta.url)

process.title = "Claude Lite Speaker"

const { Logger } = await import("./class/Logger.js")
const { App } = await import("./class/App.js")
const { RESOURCES_DIR, FRONTEND_DIR } = await import("./values/paths.js")

// Registra con traza cualquier error no controlado y termina el proceso.
function fatal(err) {
  Logger.logError(err instanceof Error ? err : new Error(String(err)))
  process.exit(1)
}
process.on("unhandledRejection", fatal)
process.on("uncaughtException", fatal)

const app = App.getInstance()

// Arranca el MCP antes que la bandeja para no duplicar instancias si el puerto ya está ocupado.
await app.start()

// Raíz del binario para autoarranque: el .exe en empaquetada, "app/" en dev.
const sea = await import("node:sea").catch(() => null)
const isPackaged = Boolean(sea?.isSea?.())
const APP_ROOT = isPackaged ? path.dirname(process.execPath) : path.join(path.dirname(HERE_FILE), "..")

await app.tray.start({ resourcesDir: RESOURCES_DIR, frontendDir: FRONTEND_DIR, appRoot: APP_ROOT })

// No se abre sola si el autoarranque la lanzó en segundo plano
const launchedFromAutostart = process.argv.includes("--opened-from-autostart")
if (!launchedFromAutostart) {
  app.tray.window.open()

  // Abre las devtools solo si se pide con --open-dev-tools.
  if (process.argv.includes("--open-dev-tools")) {
    app.tray.window.openDevtools()
  }
}
