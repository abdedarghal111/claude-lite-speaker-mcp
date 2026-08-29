// Preferencias del usuario, con valores por defecto y validación.
import fs from "node:fs"
import { SETTINGS_FILE, DATA_DIR } from "../values/paths.js"
import { DEFAULT_SPEED, DEFAULT_NOTIFICATION, DEFAULT_VOLUME } from "../values/constants.js"

export class AppSettings {
    static values

    // Crea la tabla con los valores por defecto y la sobrescribe con lo que haya persistido en disco.
    static init() {
        AppSettings.values = {
            enabled: false,
            voice: null,
            speed: DEFAULT_SPEED,
            notification: DEFAULT_NOTIFICATION,
            volume: DEFAULT_VOLUME,
        }

        if (fs.existsSync(SETTINGS_FILE)) {
            Object.assign(AppSettings.values, JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")))
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
