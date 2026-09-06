// Registro de errores del backend (comando "debugLog").
import { callCommand } from "./native.js"
import { notifyError } from "./notifications.svelte.js"

export const log = $state({ errors: [] })

export async function refreshLog() {
    try {
        log.errors = await callCommand("debugLog")
    } catch (err) {
        notifyError("debugLog", err)
    }
}

// Filas que casan con la búsqueda, con su posición en la tabla como clave.
export function listLog(search) {
    const query = search.trim().toLowerCase()
    const rows = log.errors.map((error, index) => ({ ...error, index }))
    return query ? rows.filter((row) => row.message.toLowerCase().includes(query)) : rows
}
