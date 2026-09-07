// Icono y menú de la bandeja del sistema; abre bajo demanda la ventana de ajustes (ver class/Window.js).
import path from "node:path"
import { app as electronApp, Tray as ElectronTray, Menu, nativeImage } from "electron"
import { Window } from "./Window.js"
import { AudioOutput } from "./AudioOutput.js"
import { isAutostartEnabled, setAutostart, initAutostart } from "../lib/autostart.js"

export class Tray {
    constructor(app) {
        this.app = app
        this.window = null
        this.trayHandle = null
        this.iconImages = null
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
        this.iconImages = {
            idle: nativeImage.createFromPath(ICONS.idle),
            speaking: ICONS.speaking.map((p) => nativeImage.createFromPath(p)),
        }

        this.trayHandle = this.createTrayHandle()

        // La ventana de ajustes vive en el mismo proceso (ver class/Window.js).
        const appIconPath = path.join(resourcesDir, "icons", "appIcon.png")
        this.window = new Window({
            app: this.app,
            resourcesDir,
            frontendDir,
            appIconPath,
            api: {
                isAutostartEnabled,
                setAutostart: (enabled) => setAutostart(appRoot, enabled),
                openDevtools: () => this.window.openDevtools(),
            },
        })

        // Anima el icono con un poll propio, independiente del que hace el renderer para su panel.
        setInterval(() => this.updateIcon(), 250)
    }

    // Resetea currentIconKey para que el próximo setIcon() no se salte por creer que ya está puesto.
    createTrayHandle() {
        this.currentIconKey = null
        const handle = new ElectronTray(this.iconImages.idle)
        handle.setToolTip("Claude Lite Speaker")
        handle.setContextMenu(
            Menu.buildFromTemplate([
                { label: "Abrir ajustes", click: () => this.window.open() },
                { type: "separator" },
                { label: "Salir", click: () => this.quit() },
            ])
        )
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
            // Evita llamadas redundantes a setImage.
            return
        }
        this.currentIconKey = frameKey
        const image = key === "speaking" ? this.iconImages.speaking[this.speakingFrame] : this.iconImages[key]
        this.trayHandle?.setImage(image)
    }

    updateIcon() {
        if (AudioOutput.isAnyPlaying()) {
            this.speakingFrame = (this.speakingFrame + 1) % this.iconImages.speaking.length
            this.setIcon("speaking")
        } else {
            this.setIcon("idle")
        }
    }

    // "Salir" cierra la ventana de ajustes, detiene el servidor HTTP y termina el proceso.
    quit() {
        this.window.close()
        this.app.mcp.stop()
        electronApp.quit()
    }
}
