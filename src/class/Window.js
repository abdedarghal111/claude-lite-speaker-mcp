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

export class Window {
    // nativeApp: instancia de @webviewjs/webview compartida con el tray.
    // profileDir: carpeta de perfil del webview, separada de DATA_DIR.
    constructor({ nativeApp, resourcesDir, appIconBuffer, api, profileDir }) {
        this.nativeApp = nativeApp
        this.resourcesDir = resourcesDir
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
            width: 480,
            height: 720,
            minWidth: 420,
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
            const filePath = path.join(this.resourcesDir, decodeURIComponent(url.pathname))
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
        this.webview = this.win.createWebview({ url: "app://localhost/index.html", webContext: this.webContext })
        this.webview.expose("native", this.api)
    }

    // Oculta la ventana en vez de destruirla; solo "Salir" en el menú de bandeja termina el proceso.
    close() {
        this.win?.hide()
    }
}
