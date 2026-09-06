// Estado del servidor de audio, tal como lo devuelve el comando "status".
import { callCommand } from "./native.js"
import { notify, notifyError } from "./notifications.svelte.js"

export const status = $state({
    // null hasta el primer status: la cabecera pinta "Conectando…".
    connected: null,
    speaking: false,
    voice: "—",
    speed: 1,
    volume: 100,
    notification: false,
    limits: null,
})

let wasConnected = true

// quiet: no toca la pantalla si falla, para los refrescos periódicos.
export async function refreshStatus({ quiet = false } = {}) {
    try {
        const next = await callCommand("status")
        status.limits = next.limits
        status.speaking = next.speaking
        status.voice = next.voice
        status.speed = next.speed
        status.volume = next.volume
        status.notification = Boolean(next.notification)
        status.connected = true
        if (!wasConnected) {
            wasConnected = true
            notify("ok", "Conexión con el servidor recuperada.", "status")
        }
    } catch (err) {
        // Solo se avisa al cambiar de estado, no en cada tick del poll.
        if (wasConnected) {
            wasConnected = false
            notifyError("status", err)
        }
        if (quiet) {
            return
        }
        status.connected = false
        status.speaking = false
    }
}

// Volumen por encima del original.
export function isDangerVolume(volume) {
    return Boolean(status.limits) && Number(volume) > status.limits.dangerZoneVolume
}
