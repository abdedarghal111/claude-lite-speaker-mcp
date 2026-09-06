// Gestión de voces de Piper: catálogo remoto (Hugging Face) y los ficheros
// de voz ya descargados en disco.
//
// El catálogo nunca se descarga por su cuenta: solo se actualiza cuando el
// usuario pulsa el botón correspondiente en la ventana de ajustes.
import fs from "node:fs"
import path from "node:path"
import { pipeline } from "node:stream/promises"
import { Readable } from "node:stream"
import { CACHE_DIR, VOICES_CATALOG_CACHE, VOICES_DIR } from "../paths.js"

const VOICES_JSON_URL = "https://huggingface.co/rhasspy/piper-voices/raw/main/voices.json"
const HF_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/"
// Solo para no repetir la descarga si se pulsa el botón varias veces seguidas.
// 5 minutos.
const CACHE_TTL_MS = 5 * 60 * 1000

// Aborta la descarga si no llega ningún byte nuevo durante este tiempo.
const STALL_TIMEOUT_MS = 20_000

export class VoicesManager {
    // Descargas en curso por voiceId: { receivedBytes, totalBytes }.
    static #activeDownloads = new Map()

    // Promesas de ensureVoiceFiles en curso por voiceId, para no descargar
    // la misma voz dos veces si se pide a la vez.
    static #inFlightDownloads = new Map()

    // true si ya hay un catálogo descargado en disco.
    static hasCatalog() {
        return fs.existsSync(VOICES_CATALOG_CACHE)
    }

    // Lee el catálogo cacheado en disco, sin tocar la red. null si no hay
    // catálogo todavía (ver hasCatalog).
    static #readCachedCatalog() {
        if (!VoicesManager.hasCatalog()) {
            return null
        }
        return JSON.parse(fs.readFileSync(VOICES_CATALOG_CACHE, "utf8"))
    }

    // Descarga el catálogo remoto. Si el caché tiene menos de CACHE_TTL_MS,
    // lo devuelve tal cual salvo forceRefresh.
    static async refreshCatalog({ forceRefresh = false } = {}) {
        fs.mkdirSync(CACHE_DIR, { recursive: true })

        const cacheExists = fs.existsSync(VOICES_CATALOG_CACHE)
        const cacheFresh =
            !forceRefresh && cacheExists && Date.now() - fs.statSync(VOICES_CATALOG_CACHE).mtimeMs < CACHE_TTL_MS
        if (cacheFresh) {
            return JSON.parse(fs.readFileSync(VOICES_CATALOG_CACHE, "utf8"))
        }

        try {
            const res = await fetch(VOICES_JSON_URL)
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`)
            }
            const json = await res.json()
            fs.writeFileSync(VOICES_CATALOG_CACHE, JSON.stringify(json))
            return json
        } catch (err) {
            // TODO: handlear el error con la issue https://github.com/abdedarghal111/claude-lite-speaker-mcp/issues/11
            if (cacheExists) {
                // Sin red: usa el caché aunque esté vencido.
                return JSON.parse(fs.readFileSync(VOICES_CATALOG_CACHE, "utf8"))
            }
            throw new Error(`No se pudo descargar el catálogo de voces de Piper: ${err.message}`)
        }
    }

    // Busca voiceId en el catálogo. null si no hay catálogo; lanza si el
    // catálogo existe pero la voz no está en él.
    static async getVoiceEntry(voiceId) {
        const catalog = VoicesManager.#readCachedCatalog()
        if (!catalog) {
            return null
        }
        const entry = catalog[voiceId]
        if (!entry) {
            // TODO: handlear el error con la issue https://github.com/abdedarghal111/claude-lite-speaker-mcp/issues/11
            throw new Error(`Voz desconocida: "${voiceId}". Elige una voz válida desde la ventana de ajustes.`)
        }
        return entry
    }

    // Catálogo completo, sin filtrar; [] si no hay catálogo.
    static async listAllVoices() {
        const catalog = VoicesManager.#readCachedCatalog()
        if (!catalog) {
            return []
        }
        return Object.values(catalog)
            .map((v) => ({
                id: v.key,
                language: v.language?.code,
                language_name: v.language?.name_english,
                quality: v.quality,
                // El tamaño de la voz es el del modelo: el resto de ficheros no llega al megabyte.
                sizeMb: VoicesManager.#modelSizeMb(v.files),
            }))
            .sort((a, b) => a.id.localeCompare(b.id))
    }

    // Megabytes del .onnx que anuncia el catálogo; null si la entrada no lo trae.
    static #modelSizeMb(files) {
        const model = Object.entries(files ?? {}).find(([name]) => name.endsWith(".onnx"))
        if (!model?.[1]?.size_bytes) {
            return null
        }
        return Math.round((model[1].size_bytes / (1024 * 1024)) * 10) / 10
    }

    // Rutas de los dos ficheros de una voz (modelo y configuración).
    static #voicePaths(voiceId) {
        return {
            onnxPath: path.join(VOICES_DIR, `${voiceId}.onnx`),
            jsonPath: path.join(VOICES_DIR, `${voiceId}.onnx.json`),
        }
    }

    static voiceFilesReady(voiceId) {
        if (!voiceId) {
            return false
        }
        const { onnxPath, jsonPath } = VoicesManager.#voicePaths(voiceId)
        return fs.existsSync(onnxPath) && fs.existsSync(jsonPath)
    }

    // Voces con los ficheros ya en disco, sin mirar el catálogo remoto.
    static listDownloadedVoices() {
        if (!fs.existsSync(VOICES_DIR)) {
            return []
        }
        const ids = fs
            .readdirSync(VOICES_DIR)
            .filter((f) => f.endsWith(".onnx"))
            .map((f) => f.slice(0, -".onnx".length))
            .filter((id) => VoicesManager.voiceFilesReady(id))
            .sort((a, b) => a.localeCompare(b))

        return ids.map((id) => {
            const { onnxPath } = VoicesManager.#voicePaths(id)
            const sizeMb = Math.round((fs.statSync(onnxPath).size / (1024 * 1024)) * 10) / 10
            return { id, sizeMb }
        })
    }

    static getActiveDownloads() {
        return [...VoicesManager.#activeDownloads.entries()].map(([voiceId, p]) => ({
            voiceId,
            receivedBytes: p.receivedBytes,
            totalBytes: p.totalBytes,
            percent: p.totalBytes ? Math.round((p.receivedBytes / p.totalBytes) * 100) : null,
        }))
    }

    // Descarga la voz si hace falta, deduplicando llamadas concurrentes.
    static async ensureVoiceFiles(voiceId) {
        const existing = VoicesManager.#inFlightDownloads.get(voiceId)
        if (existing) {
            return existing
        }

        const promise = VoicesManager.#downloadVoiceFiles(voiceId).finally(() => {
            VoicesManager.#inFlightDownloads.delete(voiceId)
        })
        VoicesManager.#inFlightDownloads.set(voiceId, promise)
        return promise
    }

    // Valida voiceId contra el catálogo y descarga sus ficheros. Devuelve el id normalizado.
    static async download(voiceId) {
        const id = String(voiceId || "").trim()

        if (!id) {
            throw new Error("Falta voice_id.")
        }

        if (!VoicesManager.hasCatalog()) {
            throw new Error('No hay catálogo de voces descargado todavía. Pulsa "Descargar catálogo de voces" en la ventana de ajustes.')
        }
        
        await VoicesManager.getVoiceEntry(id)
        await VoicesManager.ensureVoiceFiles(id)
        return id
    }

    static async #downloadVoiceFiles(voiceId) {
        const entry = await VoicesManager.getVoiceEntry(voiceId)
        if (!entry) {
            throw new Error('No hay catálogo de voces descargado. Descárgalo primero desde la ventana de ajustes.')
        }
        fs.mkdirSync(VOICES_DIR, { recursive: true })
        const { onnxPath, jsonPath } = VoicesManager.#voicePaths(voiceId)

        const relOnnx = Object.keys(entry.files).find((f) => f.endsWith(".onnx"))
        const relJson = Object.keys(entry.files).find((f) => f.endsWith(".onnx.json"))
        if (!relOnnx || !relJson) {
            // TODO: handlear el error con la issue https://github.com/abdedarghal111/claude-lite-speaker-mcp/issues/11
            throw new Error(`El catálogo no tiene archivos .onnx/.onnx.json para "${voiceId}".`)
        }

        const alreadyReady = fs.existsSync(onnxPath) && fs.existsSync(jsonPath)
        if (!alreadyReady) {
            VoicesManager.#activeDownloads.set(voiceId, { receivedBytes: 0, totalBytes: null })
        }
        try {
            if (!fs.existsSync(onnxPath)) {
                await VoicesManager.#downloadFile(HF_BASE + relOnnx, onnxPath, {
                    onProgress: (receivedBytes, totalBytes) =>
                        VoicesManager.#activeDownloads.set(voiceId, { receivedBytes, totalBytes }),
                })
            }
            if (!fs.existsSync(jsonPath)) {
                await VoicesManager.#downloadFile(HF_BASE + relJson, jsonPath)
            }
        } finally {
            VoicesManager.#activeDownloads.delete(voiceId)
        }

        return { onnxPath, jsonPath }
    }

    // Descarga un archivo a destPath. onProgress(receivedBytes, totalBytes)
    // opcional, para la barra de progreso del panel de voces.
    static async #downloadFile(url, destPath, { onProgress } = {}) {
        const controller = new AbortController()
        let res
        try {
            res = await fetch(url, { redirect: "follow", signal: controller.signal })
        } catch (err) {
            throw new Error(`Descarga falló al conectar con ${url}: ${err.message}`)
        }
        if (!res.ok) {
            throw new Error(`Descarga falló (${res.status} ${res.statusText}) desde ${url}`)
        }
        if (!res.body) {
            throw new Error(`Descarga sin cuerpo de respuesta desde ${url}`)
        }

        const totalBytes = Number(res.headers.get("content-length")) || null
        let receivedBytes = 0

        const tmp = `${destPath}.part-${process.pid}`
        let stallTimer
        const resetStallTimer = () => {
            clearTimeout(stallTimer)
            stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS)
        }

        // Streaming a disco para no bufferizar los 60-70 MB del modelo en memoria.
        const nodeStream = Readable.fromWeb(res.body)
        nodeStream.on("data", (chunk) => {
            resetStallTimer()
            receivedBytes += chunk.length
            onProgress?.(receivedBytes, totalBytes)
        })
        resetStallTimer()

        try {
            await pipeline(nodeStream, fs.createWriteStream(tmp))
        } catch (err) {
            fs.rmSync(tmp, { force: true })
            if (controller.signal.aborted) {
                throw new Error(
                    `Descarga interrumpida (sin datos durante ${STALL_TIMEOUT_MS / 1000}s) desde ${url}. ` +
                        "Puede ser una red lenta o inestable; vuelve a intentarlo."
                )
            }
            throw new Error(`Descarga falló desde ${url}: ${err.message}`)
        } finally {
            clearTimeout(stallTimer)
        }

        fs.renameSync(tmp, destPath)
    }

    // Datos para el panel de voces de la ventana de ajustes.
    static async panelData(currentVoice, includeCatalog) {
        const result = {
            currentVoice,
            catalogAvailable: VoicesManager.hasCatalog(),
            downloaded: VoicesManager.listDownloadedVoices(),
            activeDownloads: VoicesManager.getActiveDownloads(),
        }
        if (includeCatalog) {
            result.catalog = await VoicesManager.listAllVoices()
        }
        return result
    }
}
