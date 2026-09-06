// Formatos de fecha de la interfaz.

export function fmtTime(d) {
    return d.toLocaleTimeString("es-ES", { hour12: false })
}

export function relTime(d) {
    const s = Math.round((Date.now() - d.getTime()) / 1000)
    if (s < 60) {
        return "hace un instante"
    }
    if (s < 3600) {
        return `hace ${Math.floor(s / 60)} min`
    }
    return `hace ${Math.floor(s / 3600)} h`
}

export function isToday(d) {
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}
