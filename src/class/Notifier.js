// Avisa al usuario de los errores que registra el Logger, con un sonido y una
// notificación del sistema. Solo mira el nivel: error avisa, warn no.
import path from "node:path"
import { Notification } from "electron"
import { AudioOutput } from "./AudioOutput.js"
import { Logger } from "./Logger.js"
import { ERROR_SOUND } from "../values/notification-sound.js"
import { NOTIFIER_POLL_MS, NOTIFIER_COOLDOWN_MS } from "../values/constants.js"

const TITLE = "Algo ha fallado"
const BODY = "Abre Claude Lite Speaker y mira la pestaña Avisos."

export class Notifier {
    static #lastSeq = 0
    static #lastNotifiedAt = 0
    static #timer = null
    static #iconPath = null

    // Arranca desde lo último registrado: al abrir la app no se avisa de
    // errores de sesiones anteriores.
    static start(resourcesDir) {
        Notifier.#iconPath = path.join(resourcesDir, "icons", "appIcon.png")
        Notifier.#lastSeq = Logger.lastSeq
        Notifier.#timer = setInterval(() => Notifier.#check(), NOTIFIER_POLL_MS)
        Notifier.#timer.unref()
    }

    static stop() {
        clearInterval(Notifier.#timer)
        Notifier.#timer = null
    }

    // Los errores del mismo vistazo se agrupan en un solo aviso, y la espera
    // evita llenar el centro de notificaciones si algo falla en bucle.
    static #check() {
        const errors = Logger.since(Notifier.#lastSeq).filter((entry) => entry.level === "error")
        Notifier.#lastSeq = Logger.lastSeq
        if (errors.length === 0 || Date.now() - Notifier.#lastNotifiedAt < NOTIFIER_COOLDOWN_MS) {
            return
        }
        Notifier.#lastNotifiedAt = Date.now()

        // El volumen del aviso va en el propio buffer, no en el ajuste de la voz.
        AudioOutput.playPcm(Notifier, ERROR_SOUND.samples, ERROR_SOUND.sampleRate).catch((cause) =>
            Logger.warn("notifier", "No sonó el aviso de error.", cause)
        )
        Notifier.#showToast()
    }

    // El catch es obligado: esto sale de un setInterval, así que un fallo suelto
    // acabaría en unhandledRejection y cerraría la app por no poder avisar. Se
    // registra como warn porque un error volvería a avisar y no pararía nunca.
    static async #showToast() {
        try {
            const notification = new Notification({
                title: TITLE,
                body: BODY,
                icon: Notifier.#iconPath,
            })
            // En Windows llega aquí si los toasts están desactivados en el sistema.
            notification.on("failed", (_event, error) => {
                Logger.warn("notifier", "No se pudo mostrar el aviso del sistema.", error)
            })
            notification.show()
        } catch (cause) {
            Logger.warn("notifier", "No se pudo mostrar el aviso del sistema.", cause)
        }
    }
}
