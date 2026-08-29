// Registro de errores: guarda el último en memoria y lo añade a un log en disco.
import fs from "node:fs"
import { DATA_DIR, LAST_ERROR_LOG } from "../values/paths.js"

export class Logger {
    static #lastError = ""

    static get lastError() {
        return Logger.#lastError
    }

    static logError(err) {
        const message = `[${new Date().toISOString()}] ${err?.stack || err}`
        Logger.#lastError = message

        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true })
        }

        fs.appendFileSync(LAST_ERROR_LOG, message + "\n")
    }
}
