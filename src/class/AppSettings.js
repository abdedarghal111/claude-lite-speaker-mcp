// Preferencias del usuario, con valores por defecto y validación.
import fs from "node:fs"
import { SETTINGS_FILE, DATA_DIR } from "../values/paths.js"
import {
    DEFAULT_VOICE,
    DEFAULT_SPEED,
    MIN_SPEED,
    MAX_SPEED,
    DEFAULT_NOTIFICATION,
    DEFAULT_VOLUME,
    MIN_VOLUME,
    MAX_VOLUME,
} from "../values/constants.js"

export class AppSettings {
    static values

    // Crea la tabla con los valores por defecto y la sobrescribe con lo que haya persistido en disco.
    static init() {
        AppSettings.values = {
            voice: DEFAULT_VOICE,
            speed: DEFAULT_SPEED,
            notification: DEFAULT_NOTIFICATION,
            volume: DEFAULT_VOLUME,
        }

        if (fs.existsSync(SETTINGS_FILE)) {
            Object.assign(AppSettings.values, JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")))
        }

        AppSettings.#validate()
    }

    // Valida y corrige los datos para un input correcto al resto de la app
    static #validate() {
        if (typeof AppSettings.values.voice !== "string" || !AppSettings.values.voice) {
            AppSettings.values.voice = DEFAULT_VOICE
        }

        const speed = Number(AppSettings.values.speed)
        if (!Number.isFinite(speed) || speed < MIN_SPEED || speed > MAX_SPEED) {
            AppSettings.values.speed = DEFAULT_SPEED
        }

        if (typeof AppSettings.values.notification !== "boolean") {
            AppSettings.values.notification = DEFAULT_NOTIFICATION
        }

        const volume = Number(AppSettings.values.volume)
        if (!Number.isFinite(volume) || volume < MIN_VOLUME || volume > MAX_VOLUME) {
            AppSettings.values.volume = DEFAULT_VOLUME
        }
    }

    // Lee un valor concreto de la tabla.
    static read(key) {
        return AppSettings.values[key]
    }

    // Cambia un valor concreto y persiste la tabla entera.
    static update(key, value) {
        AppSettings.values[key] = value
        AppSettings.save()
    }

    // Escritura atómica (tmp + rename) para no dejar el JSON a medias.
    static save() {
        fs.mkdirSync(DATA_DIR, { recursive: true })

        const tmp = `${SETTINGS_FILE}.tmp-${process.pid}`

        fs.writeFileSync(tmp, JSON.stringify(AppSettings.values, null, 2))
        fs.renameSync(tmp, SETTINGS_FILE)
    }
}
