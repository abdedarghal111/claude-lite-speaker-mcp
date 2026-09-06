// Bandeja de avisos: histórico de la pestaña Avisos y toasts en pantalla.

export const LEVELS = { error: "Error", warn: "Aviso", info: "Info", ok: "Éxito" }

// Clases enteras: Tailwind las busca como texto literal, no las compone al vuelo.
export const LEVEL_STYLES = {
    error: { border: "border-l-sev-error", bg: "bg-sev-error", chip: "bg-sev-error/13 text-sev-error" },
    warn: { border: "border-l-sev-warn", bg: "bg-sev-warn", chip: "bg-sev-warn/14 text-sev-warn" },
    info: { border: "border-l-sev-info", bg: "bg-sev-info", chip: "bg-sev-info/14 text-sev-info" },
    ok: { border: "border-l-sev-ok", bg: "bg-sev-ok", chip: "bg-sev-ok/14 text-sev-ok" },
}

const MAX_TOASTS = 3

let seq = 0

export const notifications = $state({ events: [], toasts: [], unread: 0 })

// level: "error" | "warn" | "info" | "ok". detail es opcional (p. ej. err.stack).
export function notify(level, message, source, detail) {
    const event = { id: ++seq, level, time: new Date(), message, source, detail }
    notifications.events.unshift(event)
    notifications.unread++
    if (notifications.toasts.length >= MAX_TOASTS) {
        notifications.toasts.shift()
    }
    notifications.toasts.push(event)
}

export function notifyError(source, err) {
    notify("error", (err && err.message) || "Error desconocido.", source, err && err.stack)
}

export function dismissEvent(id) {
    notifications.events = notifications.events.filter((e) => e.id !== id)
}

export function clearEvents() {
    notifications.events = []
}

export function dismissToast(id) {
    notifications.toasts = notifications.toasts.filter((t) => t.id !== id)
}

export function markRead() {
    notifications.unread = 0
}
