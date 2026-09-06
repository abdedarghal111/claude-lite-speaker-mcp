// Ventana de ajustes de configuración
import path from "node:path"
import { readFile } from "node:fs/promises"

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
    // nativeApp: instancia de @webviewjs/webview compartida con el tray.
    // resourcesDir/frontendDir: únicas carpetas servidas por el protocolo app://
    // (ver open()); nada fuera de ellas es accesible desde la ventana.
    // profileDir: carpeta de perfil del webview, separada de DATA_DIR.
    // api: funciones propias de la ventana (autoarranque, devtools); los
    // comandos de negocio llegan por this.app.frontendApi (ver App.js).
    constructor({ app, nativeApp, resourcesDir, frontendDir, appIconBuffer, api, profileDir }) {
        this.app = app
        this.nativeApp = nativeApp
        this.resourcesDir = resourcesDir
        this.frontendDir = frontendDir
        this.appIconBuffer = appIconBuffer
        this.api = api
        this.profileDir = profileDir
        this.win = null
        // Referencias fuertes a webContext/webview: evitan que el GC las recolecte y disponga la ventana.
        this.webContext = null
        this.webview = null
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

        this.win = this.nativeApp.createBrowserWindow({
            title: "Claude Lite Speaker",
            width: 540,
            height: 720,
            minWidth: 460,
            minHeight: 540,
            windowsTaskbarIcon: { data: this.appIconBuffer },
        })
        // Fuerza el icono de la ventana en la barra de título y en Alt+Tab.
        this.win.setWindowIcon(this.appIconBuffer)

        // Oculta la ventana en vez de destruirla al cerrarse.
        this.win.on("close", () => {
            this.win.hide()
        })

        this.win.registerProtocol("app", async (request) => {
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

        this.webContext = this.nativeApp.createWebContext({ dataDirectory: this.profileDir })
        this.webview = this.win.createWebview({
            url: "app://localhost/index.html",
            webContext: this.webContext,
            enableDevtools: true,
        })
        this.webview.expose("native", {
            // Único punto de entrada a los comandos de negocio (ver App.js).
            callCommand: (name, args) => this.app.handleCommand(name, args),
            ...this.api,
        })
    }

    // Oculta la ventana en vez de destruirla; solo "Salir" en el menú de bandeja termina el proceso.
    close() {
        this.win?.hide()
    }

    openDevtools() {
        this.webview?.openDevtools()
        return true
    }
}
