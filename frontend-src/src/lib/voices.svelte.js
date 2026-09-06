// Catálogo de voces: estado del panel y comandos que lo mueven.
import { callCommand } from "./native.js"
import { notify, notifyError } from "./notifications.svelte.js"
import { refreshStatus } from "./status.svelte.js"

// Tope de filas pintadas: el catálogo trae unas 175 voces.
const LIST_LIMIT = 60

export const voices = $state({
    // true: solo las descargadas. false: el catálogo completo.
    onlyDownloaded: true,
    refreshingCatalog: false,
    // Voces con una acción en vuelo, para desactivar su botón mientras tanto.
    busy: new Set(),
    data: {
        downloaded: [],
        activeDownloads: [],
        catalog: null,
        catalogAvailable: true,
        currentVoice: null,
    },
})

export async function refreshVoices() {
    try {
        voices.data = await callCommand("voicesPanelData", { includeCatalog: !voices.onlyDownloaded })
    } catch {
        // El poll de status ya avisa si el servidor se ha caído.
    }
}

function matches(voice, query) {
    return (
        !query ||
        voice.id.toLowerCase().includes(query) ||
        (voice.language || "").toLowerCase().includes(query) ||
        (voice.language_name || "").toLowerCase().includes(query)
    )
}

// Filas a pintar para una búsqueda, y cuántas se han quedado fuera del tope.
export function listVoices(search) {
    const query = search.trim().toLowerCase()
    const { downloaded, catalog } = voices.data

    if (!voices.onlyDownloaded && catalog) {
        const localSize = new Map(downloaded.map((v) => [v.id, v.sizeMb]))
        const filtered = catalog.filter((v) => matches(v, query))
        const entries = filtered
            .slice(0, LIST_LIMIT)
            // El tamaño en disco manda sobre el que anuncia el catálogo.
            .map((v) => ({ ...v, sizeMb: localSize.get(v.id) ?? v.sizeMb }))
        return { entries, truncated: filtered.length - entries.length }
    }

    // El buscador es el mismo campo en las dos vistas.
    return { entries: downloaded.filter((v) => matches(v, query)), truncated: 0 }
}

export function isDownloaded(voiceId) {
    return voices.data.downloaded.some((v) => v.id === voiceId)
}

export function isBusy(voiceId) {
    return voices.busy.has(voiceId) || voices.data.activeDownloads.some((d) => d.voiceId === voiceId)
}

// action: "use" | "download".
export function runVoiceAction(action, voiceId) {
    const command = action === "use" ? "setVoice" : "downloadVoice"
    voices.busy = new Set(voices.busy).add(voiceId)
    callCommand(command, { voice_id: voiceId })
        .then(() => notify("ok", action === "use" ? `Voz activada: ${voiceId}` : `Voz descargada: ${voiceId}`, command))
        .catch((err) => notifyError(command, err))
        .finally(() => {
            const next = new Set(voices.busy)
            next.delete(voiceId)
            voices.busy = next
            refreshVoices()
            // Refresca "Voz actual" al instante, sin esperar al poll.
            refreshStatus({ quiet: true })
        })
}

// Única descarga del catálogo remoto: la app nunca lo pide sola.
export function refreshCatalog() {
    voices.refreshingCatalog = true
    callCommand("refreshVoiceCatalog")
        .then(() => notify("ok", "Catálogo de voces actualizado.", "refreshVoiceCatalog"))
        .catch((err) => notifyError("refreshVoiceCatalog", err))
        .finally(() => {
            voices.refreshingCatalog = false
            refreshVoices()
        })
}
