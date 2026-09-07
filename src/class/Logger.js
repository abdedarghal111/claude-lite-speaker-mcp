// Registro de la app: una tabla en memoria para la ventana de ajustes y un
// fichero con la traza completa para depurar a mano.
import fs from "node:fs"
import { DATA_DIR, ERROR_LOG_FILE } from "../paths.js"

export class Logger {
    static #entries = []
    static #seq = 0

    // error: se le avisa al usuario (ver class/Notifier.js). warn e info: solo registro.
    static error(source, message, cause) {
        return Logger.#add("error", source, message, cause)
    }

    static warn(source, message, cause) {
        return Logger.#add("warn", source, message, cause)
    }

    static info(source, message, cause) {
        return Logger.#add("info", source, message, cause)
    }

    // source: "modulo:accion". message: la frase que lee el usuario, con los
    // datos del fallo dentro. cause: la excepción tal cual llega al catch.
    static #add(level, source, message, cause) {
        const time = new Date()
        const entry = {
            seq: ++Logger.#seq,
            time,
            level,
            source,
            message,
            text: `[${time.toISOString()}] ${level.toUpperCase()} ${source} — ${message}`,
        }

        Logger.#entries.push(entry)

        // La traza va solo al fichero. Si no hay excepción, apunta a la línea
        // que llamó al Logger.
        const origin = new Error(message)
        // level es el mismo nombre que el método público: así la traza empieza en
        // quien lo llamó, no dentro del Logger.
        Error.captureStackTrace(origin, Logger[level])
        Logger.#write(`${entry.text}\n${cause?.stack || origin.stack}\n\n`)

        return entry
    }

    static #write(text) {
        fs.mkdirSync(DATA_DIR, { recursive: true })
        const stats = fs.statSync(ERROR_LOG_FILE, { throwIfNoEntry: false })
        if (stats && !stats.isFile()) {
            throw new Error(`El registro no puede escribir en el fichero ${ERROR_LOG_FILE}: no es un fichero.`)
        }
        fs.appendFileSync(ERROR_LOG_FILE, text)
    }

    // Más reciente primero, para la ventana de ajustes.
    static get entries() {
        return [...Logger.#entries].reverse()
    }

    static get lastError() {
        return Logger.#entries.findLast((entry) => entry.level === "error")?.text ?? ""
    }

    // Lo registrado después de fromSeq, en orden de llegada.
    static since(fromSeq) {
        return Logger.#entries.filter((entry) => entry.seq > fromSeq)
    }

    static get lastSeq() {
        return Logger.#seq
    }
}
