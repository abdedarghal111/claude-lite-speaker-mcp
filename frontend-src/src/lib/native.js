// Único puente con el backend: window.native lo expone class/Window.js.
export async function callCommand(name, args = {}) {
    const data = await window.native.callCommand(name, args)
    if (!data.ok) {
        throw new Error(data.error || "Error desconocido.")
    }
    return data.result
}

export function isAutostartEnabled() {
    return window.native.isAutostartEnabled()
}

export function setAutostart(enabled) {
    return window.native.setAutostart(enabled)
}

export function openDevtools() {
    return window.native.openDevtools()
}
