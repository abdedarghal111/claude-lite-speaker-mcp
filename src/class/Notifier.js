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
const TEST_TITLE = "Prueba de aviso"
const TEST_BODY = "Si has oído el sonido y ves esto, los avisos funcionan."

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

    // Lanza el aviso completo a petición: sonido y notificación del sistema. No respeta
    // la espera entre avisos.
    static test() {
        Notifier.#play()
        Notifier.#showToast(TEST_TITLE, TEST_BODY)
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

        Notifier.#play()
        Notifier.#showToast(TITLE, BODY)
    }

    // El volumen del aviso va en el propio buffer, no en el ajuste de la voz.
    static #play() {
        AudioOutput.playPcm(Notifier, ERROR_SOUND.samples, ERROR_SOUND.sampleRate).catch((cause) =>
            Logger.warn("notifier", "No sonó el aviso de error.", cause)
        )
    }

    // El catch es obligado: esto sale de un setInterval, así que un fallo suelto
    // acabaría en unhandledRejection y cerraría la app por no poder avisar. Se
    // registra como warn porque un error volvería a avisar y no pararía nunca.
    static async #showToast(title, body) {
        try {
            const notification = new Notification({
                title,
                body,
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
