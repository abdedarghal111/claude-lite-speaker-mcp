// Icono y menú de la bandeja del sistema; abre bajo demanda la ventana de ajustes (ver class/Window.js).
import fs from "node:fs"
import path from "node:path"
import { Window } from "./Window.js"
import { AudioOutput } from "./AudioOutput.js"
import { isAutostartEnabled, setAutostart, initAutostart } from "../lib/autostart.js"
import { WEBVIEW_PROFILE_DIR } from "../paths.js"

export class Tray {
    constructor(app) {
        this.app = app
        this.window = null
        this.nativeApp = null
        this.anchorWindow = null
        this.trayHandle = null
        this.iconBuffers = null
        this.currentIconKey = null
        this.speakingFrame = 0
    }

    // resourcesDir: carpeta con los PNG de bandeja. frontendDir: HTML/CSS/JS de la ventana.
    // appRoot: raíz del binario, la necesita Window para exponer setAutostart.
    async start({ resourcesDir, frontendDir, appRoot }) {
        // Corrige el destino del autoarranque si la app se movió o se reempaquetó.
        await initAutostart(appRoot)

        const ICONS = {
            idle: path.join(resourcesDir, "icons", "trayIcon.png"),
            speaking: [1, 2, 3].map((n) => path.join(resourcesDir, "icons", `trayIconSpeaking${n}.png`)),
        }
        this.iconBuffers = {
            idle: fs.readFileSync(ICONS.idle),
            speaking: ICONS.speaking.map((p) => fs.readFileSync(p)),
        }

        const { Application } = await import("@webviewjs/webview")
        this.nativeApp = new Application()
        await this.nativeApp.whenReady()

        // Ventana ancla invisible: evita que el runtime cierre el tray al quedarse sin ventanas visibles.
        this.anchorWindow = this.nativeApp.createBrowserWindow({ visible: false })

        this.trayHandle = this.createTrayHandle()

        // La ventana de ajustes vive en esta misma Application (ver class/Window.js).
        const appIconBuffer = fs.readFileSync(path.join(resourcesDir, "icons", "appIcon.png"))
        this.window = new Window({
            app: this.app,
            nativeApp: this.nativeApp,
            resourcesDir,
            frontendDir,
            appIconBuffer,
            profileDir: WEBVIEW_PROFILE_DIR,
            api: {
                isAutostartEnabled,
                setAutostart: (enabled) => setAutostart(appRoot, enabled),
                openDevtools: () => this.window.openDevtools(),
            },
        })

        this.nativeApp.on("custom-menu-click", ({ customMenuEvent }) => {
            if (customMenuEvent.id === "show") {
                this.window.open()
            } else if (customMenuEvent.id === "quit") {
                this.quit()
            }
        })

        // Anima el icono con un poll propio, independiente del que hace el renderer para su panel.
        setInterval(() => this.updateIcon(), 250)

        this.nativeApp.run()
    }

    // Resetea currentIconKey para que el próximo setIcon() no se salte por creer que ya está puesto.
    createTrayHandle() {
        this.currentIconKey = null
        const handle = this.nativeApp.createTrayIcon({
            icon: { data: this.iconBuffers.idle },
            tooltip: "Claude Lite Speaker",
            menu: {
                items: [
                    { id: "show", label: "Abrir ajustes" },
                    { role: "separator" },
                    { id: "quit", label: "Salir" },
                ],
            },
        })
        // Clic simple alterna mostrar/ocultar; solo emite el evento en Windows/macOS.
        handle.on("click", () => {
            if (this.window.isOpen()) {
                this.window.close()
            } else {
                this.window.open()
            }
        })
        return handle
    }

    setIcon(key) {
        // "speaking" incluye el frame: cada tick pinta uno distinto aunque la clave no cambie.
        const frameKey = key === "speaking" ? `speaking:${this.speakingFrame}` : key
        if (frameKey === this.currentIconKey) {
            // Evita llamadas redundantes a setIcon.
            return
        }
        this.currentIconKey = frameKey
        const data = key === "speaking" ? this.iconBuffers.speaking[this.speakingFrame] : this.iconBuffers[key]
        this.trayHandle?.setIcon(data)
    }

    updateIcon() {
        if (AudioOutput.isAnyPlaying()) {
            this.speakingFrame = (this.speakingFrame + 1) % this.iconBuffers.speaking.length
            this.setIcon("speaking")
        } else {
            this.setIcon("idle")
        }
    }

    // "Salir" cierra la ventana de ajustes, detiene el servidor HTTP y termina el proceso.
    quit() {
        this.window.close()
        this.app.mcp.stop()
        // app.exit() detiene el bucle de eventos nativo y oculta/dispone el tray; no llama a process.exit().
        try {
            this.nativeApp.exit()
        } catch {
            // TODO: handlear el error con la issue https://github.com/abdedarghal111/claude-lite-speaker-mcp/issues/11
            // process.exit(0) de abajo es la red de seguridad real.
        }
        process.exit(0)
    }
}
