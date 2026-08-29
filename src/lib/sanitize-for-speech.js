// Convierte texto con markdown en algo apto para leer en voz alta, quitando
// o sustituyendo los símbolos más habituales. Copia intencionada de
// plugin/lib/sanitize-for-speech.js: los dos paquetes ya no comparten
// node_modules.
const VOICE_LINE_RE = /^🔊\s*(.+)$/m

// Devuelve el resumen hablado si el texto trae la línea 🔊, o null si no.
export function extractAuthoredSpeech(fullText) {
    const match = String(fullText || "").match(VOICE_LINE_RE)
    return match ? match[1].trim() : null
}

export function sanitizeForSpeech(text) {
    return String(text)
        .replace(/```[\s\S]*?```/g, " (bloque de código omitido) ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/^\s*#{1,6}\s*/gm, "")
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
        .replace(/-{2,}/g, "")
        .replace(/\|/g, ", ")
        .replace(/[*_>~]/g, "")
        .replace(/\s+/g, " ")
        .trim()
}
