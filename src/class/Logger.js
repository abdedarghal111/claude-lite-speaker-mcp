// Errores de la app: una tabla en memoria para el panel de Avisos y una copia en
// disco para depurar a mano.
import fs from "node:fs"
import { DATA_DIR, ERROR_LOG_FILE } from "../paths.js"

// El proceso vive mucho tiempo en segundo plano, así que la tabla no crece sin fin.
const MAX_ERRORS_IN_MEMORY = 200

export class Logger {
    static #errors = []

    // Último error ya formateado, para cmdStatus().
    static get lastError() {
        const last = Logger.#errors.at(-1)
        return last ? last.text : ""
    }

    // Tabla entera, más reciente primero.
    static get errors() {
        return [...Logger.#errors].reverse()
    }

    static logError(err) {
        const time = new Date()
        const text = `[${time.toISOString()}] ${err?.stack || err}`
        const message = err?.message || String(err)
        Logger.#errors.push({ time, message, text })
        if (Logger.#errors.length > MAX_ERRORS_IN_MEMORY) {
            Logger.#errors.shift()
        }

        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true })
        }

        fs.appendFileSync(ERROR_LOG_FILE, text + "\n")
    }
}
