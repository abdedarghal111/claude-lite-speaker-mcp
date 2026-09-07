// Ventana de ajustes de configuración
import path from "node:path"
import { readFile } from "node:fs/promises"
import { app as electronApp, BrowserWindow, session } from "electron"
import { PRELOAD_FILE } from "../paths.js"

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml",
}

// Resuelve pathname dentro de baseDir; null si el resultado se escapa de
// baseDir (p. ej. con "..").
function resolveStaticFile(baseDir, pathname) {
    const filePath = path.join(baseDir, pathname)
    const relative = path.relative(baseDir, filePath)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return null
    }
    return filePath
}

export class Window {
    // resourcesDir/frontendDir: lo único que sirve el protocolo app:// (ver open()).
    // api: funciones propias de la ventana; los comandos de negocio van aparte,
    // por this.app.handleCommand (ver App.js).
    constructor({ app, resourcesDir, frontendDir, appIconPath, api }) {
        this.app = app
        this.resourcesDir = resourcesDir
        this.frontendDir = frontendDir
        this.appIconPath = appIconPath
        this.api = api
        this.win = null
        this.session = null

        // Al salir hay que dejar que la ventana se cierre: si "close" siguiera
        // cancelando, cancelaría el cierre de app.quit() y la app no terminaría.
        this.quitting = false
        electronApp.once("before-quit", () => {
            this.quitting = true
        })
    }

    isOpen() {
        return Boolean(this.win) && this.win.isVisible()
    }

    // Crea la ventana una sola vez, las llamadas posteriores solo la muestran de nuevo.
    open() {
        if (this.win) {
            this.win.show()
            // Pasa la ventana al frente, no solo la muestra.
            this.win.focus()
            return
        }

        // Sesión de la ventana, con su propio perfil en disco (cookies, storage…).
        this.session = session.fromPartition("persist:settings-window", { cache: true })

        this.win = new BrowserWindow({
            title: "Claude Lite Speaker",
            width: 540,
            height: 720,
            minWidth: 460,
            minHeight: 540,
            icon: this.appIconPath,
            webPreferences: {
                session: this.session,
                preload: PRELOAD_FILE,
                contextIsolation: true,
                sandbox: true,
            },
        })

        // Oculta la ventana en vez de destruirla al cerrarse, salvo si es la salida.
        this.win.on("close", (event) => {
            if (this.quitting) {
                return
            }
            event.preventDefault()
            this.win.hide()
        })

        // Las devtools se acoplan dentro y tapan el panel de ajustes: se ensancha.
        this.win.webContents.on("devtools-opened", () => {
            const [width, height] = this.win.getSize()
            this.win.setSize(width + 400, height)
        })

        this.session.protocol.handle("app", async (request) => {
            const url = new URL(request.url)
            const pathname = decodeURIComponent(url.pathname)
            // /icons/* viene de resourcesDir (bandeja); el resto, de frontendDir.
            const baseDir = pathname.startsWith("/icons/") ? this.resourcesDir : this.frontendDir
            const filePath = resolveStaticFile(baseDir, pathname)
            if (!filePath) {
                return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } })
            }
            try {
                return new Response(await readFile(filePath), {
                    headers: { "Content-Type": MIME[path.extname(filePath)] ?? "application/octet-stream" },
                })
            } catch {
                return new Response(`Not found: ${url.pathname}`, {
                    status: 404,
                    headers: { "Content-Type": "text/plain; charset=utf-8" },
                })
            }
        })

        // Comandos de negocio y funciones de la ventana, expuestos vía preload.cjs.
        this.win.webContents.ipc.handle("native:callCommand", (_event, name, args) => this.app.handleCommand(name, args))
        for (const [name, fn] of Object.entries(this.api)) {
            this.win.webContents.ipc.handle(`native:${name}`, (_event, ...args) => fn(...args))
        }

        this.win.loadURL("app://localhost/index.html")
    }

    // Oculta la ventana en vez de destruirla: el proceso solo termina con "Salir",
    // en el menú de la bandeja o en los ajustes.
    close() {
        this.win?.hide()
    }

    openDevtools() {
        this.win?.webContents.openDevTools()
        return true
    }
}
