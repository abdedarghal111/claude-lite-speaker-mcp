// Clase App: singleton raíz de la aplicación. Inicializa los ajustes y las
// piezas principales (Chat, Tray, MCP), valida, aplica la configuración
// y resuelve los comandos de comunicación con el frontend
import { AudioEngine } from "./AudioEngine.js"
import { AudioOutput } from "./AudioOutput.js"
import { Logger } from "./Logger.js"
import { DEFAULT_VOICE, MIN_SPEED, MAX_SPEED, MIN_VOLUME, DANGER_ZONE_VOLUME, MAX_VOLUME } from "../values/constants.js"
import { AppSettings } from "./AppSettings.js"
import { VoicesManager } from "./VoicesManager.js"
import { Chat } from "./Chat.js"
import { Tray } from "./Tray.js"
import { MCP } from "./MCP.js"

export class App {
    static instance

    constructor() {
        AppSettings.init()
        this.chat = new Chat()
        this.tray = new Tray(this)
        this.mcp = new MCP(this)
    }

    static getInstance() {
        if (!App.instance) {
            App.instance = new App()
        }
        return App.instance
    }

    // Mapa nombre de comando -> nombre del método cmd* que lo resuelve.
    static FRONTEND_COMMANDS = {
        piper_speak: "cmdSpeak",
        piper_stop: "cmdStop",
        piper_set_voice: "cmdSetVoice",
        piper_download_voice: "cmdDownloadVoice",
        piper_voices_panel_data: "cmdVoicesPanelData",
        refreshVoiceCatalog: "cmdRefreshVoiceCatalog",
        piper_set_speed: "cmdSetSpeed",
        piper_set_notification: "cmdSetNotification",
        piper_set_volume: "cmdSetVolume",
        piper_status: "cmdStatus",
    }

    // Resuelve un comando pedido por la ventana de ajustes.
    async handleCommand(name, args = {}) {
        const methodName = App.FRONTEND_COMMANDS[name]
        if (!methodName) {
            throw new Error(`Comando desconocido: ${name}`)
        }
        return this[methodName](args)
    }

    // Reproduce el texto dado en voz alta.
    cmdSpeak(args) {
        return { ok: true, result: this.mcp.speak(args.text) }
    }

    // Detiene la reproducción en curso.
    cmdStop() {
        const res = this.chat.stop()
        return { ok: true, result: res.stopped ? "Reproducción detenida." : `No había nada que detener (${res.reason}).` }
    }

    // Cambia la voz activa.
    async cmdSetVoice(args) {
        await this.setVoice(args.voice_id)
        return { ok: true }
    }

    // Descarga una voz sin activarla.
    async cmdDownloadVoice(args) {
        await VoicesManager.download(args.voice_id)
        return { ok: true }
    }

    // Datos del panel de voces de la ventana de ajustes.
    async cmdVoicesPanelData(args) {
        return { ok: true, result: await this.voicesPanelData(args.includeCatalog) }
    }

    // Refresca el catálogo de voces descargables.
    async cmdRefreshVoiceCatalog() {
        await VoicesManager.refreshCatalog({ forceRefresh: true })
        return { ok: true }
    }

    // Cambia la velocidad de reproducción.
    cmdSetSpeed(args) {
        this.setSpeed(args.speed)
        return { ok: true }
    }

    // Activa o desactiva el ding previo a hablar.
    cmdSetNotification(args) {
        if (args.enabled === undefined) {
            throw new Error("Falta enabled.")
        }
        AppSettings.update("notification", Boolean(args.enabled))
        return { ok: true }
    }

    // Cambia el volumen de reproducción.
    cmdSetVolume(args) {
        this.setVolume(args.volume, args.allow_overdrive)
        return { ok: true }
    }

    // Estado actual de la app para la ventana de ajustes.
    cmdStatus() {
        const lastError = Logger.lastError
        const snapshot = {
            ...AppSettings.values,
            voice: AppSettings.read("voice") || DEFAULT_VOICE,
            speaking: AudioOutput.isAnyPlaying(),
            // Límites usados por la ventana de ajustes para los sliders.
            limits: {
                minSpeed: MIN_SPEED,
                maxSpeed: MAX_SPEED,
                minVolume: MIN_VOLUME,
                maxVolume: MAX_VOLUME,
                dangerZoneVolume: DANGER_ZONE_VOLUME,
            },
            ...(lastError ? { last_error: lastError } : {}),
        }
        return { ok: true, result: JSON.stringify(snapshot, null, 2) }
    }

    // Valida y activa una voz (coordina VoicesManager y AppSettings).
    async setVoice(voiceId) {
        const id = await VoicesManager.download(voiceId)
        AppSettings.update("voice", id)
    }

    setSpeed(requestedSpeed) {
        if (requestedSpeed === undefined) {
            throw new Error("Falta speed.")
        }
        const requested = Number(requestedSpeed)
        if (!Number.isFinite(requested) || requested <= 0) {
            throw new Error(`speed debe ser un número positivo (recibido: ${requestedSpeed}).`)
        }
        AppSettings.update("speed", AudioEngine.clampSpeed(requested))
    }

    setVolume(requestedVolume, allowOverdriveValue) {
        if (requestedVolume === undefined) {
            throw new Error("Falta volume.")
        }
        const requested = Number(requestedVolume)
        if (!Number.isFinite(requested) || requested < 0) {
            throw new Error(`volume debe ser un número >= 0 (recibido: ${requestedVolume}).`)
        }
        const allowOverdrive = Boolean(allowOverdriveValue)
        if (requested > DANGER_ZONE_VOLUME && !allowOverdrive) {
            throw new Error(
                `volume ${requested} supera el volumen original (${DANGER_ZONE_VOLUME}%) y lo amplificaría ` +
                    "por encima de él, pudiendo distorsionarlo. Pasa allow_overdrive: true solo si el " +
                    "usuario lo ha pedido explícitamente."
            )
        }
        const volume = AudioEngine.clampVolume(requested, allowOverdrive)
        AppSettings.update("volume", volume)
        // Aplica también al audio que esté sonando ahora mismo.
        AudioOutput.setVolumeAll(AudioEngine.volumePercentToGain(volume))
    }

    // Datos para el panel de voces de la ventana de ajustes: voz activa,
    // voces descargadas, descargas en curso y, si se pide, el catálogo completo.
    async voicesPanelData(includeCatalog) {
        const currentVoice = AppSettings.read("voice") || DEFAULT_VOICE
        return JSON.stringify(await VoicesManager.panelData(currentVoice, includeCatalog))
    }
}
