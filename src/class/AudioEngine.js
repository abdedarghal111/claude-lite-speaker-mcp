// Motor de síntesis de voz: convierte texto en muestras de audio PCM,
// reimplementando el pipeline de Piper en JS puro. El texto se convierte
// primero en fonemas IPA mediante espeak-ng (WASM); esos fonemas se
// traducen a ids según el phoneme_id_map del .onnx.json de la voz; y esos
// ids se sintetizan en audio con el modelo VITS de la voz, ejecutado con
// onnxruntime-node.
// CREDITS: https://github.com/rhasspy/piper
import * as ort from "onnxruntime-node"
import fs from "node:fs"
import { EventEmitter } from "node:events"
import espeakInit from "@echogarden/espeak-ng-emscripten"
import { VoicesManager } from "./VoicesManager.js"
import {
    DEFAULT_SPEED,
    MIN_SPEED,
    MAX_SPEED,
    DEFAULT_VOLUME,
    MIN_VOLUME,
    MAX_VOLUME,
    DANGER_ZONE_VOLUME,
    VOLUME_FLOOR_DB,
    VOLUME_CEIL_DB,
    MODEL_IDLE_UNLOAD_MS,
} from "../values/constants.js"

const BOS = "^"
const EOS = "$"
const PAD = "_"

// Duración del silencio insertado entre cláusulas al concatenar el audio.
const CLAUSE_SILENCE_MS = 200

// Representa una síntesis en curso: emite "progress" ({ stage, percent })
// según avanza, y expone `promise` con el resultado final.
export class SynthesisJob extends EventEmitter {
    // Promesa que se resuelve con { samples, sampleRate }.
    promise = null
}

export class AudioEngine {
    // Instancia compartida del motor de fonemización.
    static #espeakWorkerPromise = null

    // Crea el motor de fonemización la primera vez, y lo reutiliza después.
    static async #getEspeakWorker() {
        if (!AudioEngine.#espeakWorkerPromise) {
            AudioEngine.#espeakWorkerPromise = espeakInit().then((m) => new m.eSpeakNGWorker())
        }
        return AudioEngine.#espeakWorkerPromise
    }

    // Divide el texto en cláusulas y las convierte a fonemas IPA.
    static async #phonemizeClauses(text, espeakVoice) {
        const worker = await AudioEngine.#getEspeakWorker()
        worker.set_voice(espeakVoice)
        const { ipa, code } = worker.synthesize_ipa(text)
        if (code !== 0) {
            throw new Error(`espeak-ng no pudo fonemizar el texto (código ${code}).`)
        }
        return ipa
            .split("\n")
            // Quita el separador visual entre fonemas.
            .map((clause) => clause.replaceAll("_", "").trim())
            .filter(Boolean)
    }

    // Modelo de voz cargado en memoria (uno solo a la vez).
    static #cached = null

    // Reinicia el plazo tras el que se libera el modelo por inactividad.
    static #scheduleIdleUnload(entry) {
        clearTimeout(entry.idleTimer)
        entry.idleTimer = setTimeout(() => AudioEngine.#unloadIfCurrent(entry.voiceId), MODEL_IDLE_UNLOAD_MS)
        // No mantiene el proceso vivo por sí solo.
        entry.idleTimer.unref?.()
    }

    // Libera el modelo cargado, si sigue siendo el actual.
    static #unloadIfCurrent(voiceId) {
        if (!AudioEngine.#cached || AudioEngine.#cached.voiceId !== voiceId) {
            return
        }
        const toRelease = AudioEngine.#cached
        AudioEngine.#cached = null
        // Ignora un fallo al liberar la sesión.
        toRelease.session.release().catch(() => {})
    }

    // Carga el modelo de la voz, liberando antes el que hubiera cargado.
    static async #loadVoice(voiceId, onnxPath, jsonPath) {
        if (AudioEngine.#cached && AudioEngine.#cached.voiceId === voiceId) {
            // Reinicia el plazo de inactividad.
            AudioEngine.#scheduleIdleUnload(AudioEngine.#cached)
            return AudioEngine.#cached
        }

        // Libera la voz anterior.
        if (AudioEngine.#cached) {
            AudioEngine.#unloadIfCurrent(AudioEngine.#cached.voiceId)
        }

        const config = JSON.parse(fs.readFileSync(jsonPath, "utf8"))
        const session = await ort.InferenceSession.create(onnxPath)
        AudioEngine.#cached = { voiceId, session, config, idleTimer: null }
        AudioEngine.#scheduleIdleUnload(AudioEngine.#cached)
        return AudioEngine.#cached
    }

    // Convierte una lista de fonemas en los ids que espera el modelo.
    static #phonemesToIds(phonemes, idMap) {
        const ids = [...idMap[BOS]]
        for (const p of phonemes) {
            if (!idMap[p]) {
                // Símbolo sin id en esta voz: se omite.
                continue
            }
            ids.push(...idMap[p], ...idMap[PAD])
        }
        ids.push(...idMap[EOS])
        return ids
    }

    // Sintetiza el audio de una cláusula ya fonemizada.
    static async #synthesizeClause(session, phonemeStr, idMap, lengthScale, config) {
        // Divide por code point.
        const ids = AudioEngine.#phonemesToIds([...phonemeStr], idMap)
        if (ids.length <= 2) {
            // Cláusula vacía.
            return new Float32Array(0)
        }

        const feeds = {
            input: new ort.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
            input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
            scales: new ort.Tensor(
                "float32",
                Float32Array.from([config.inference.noise_scale, lengthScale, config.inference.noise_w]),
                [3]
            ),
        }

        // Añade el id de hablante si el modelo lo requiere.
        if (session.inputNames.includes("sid")) {
            feeds.sid = new ort.Tensor("int64", BigInt64Array.from([0n]), [1])
        }

        const results = await session.run(feeds)
        return results[session.outputNames[0]].data
    }

    // Ajusta la velocidad al rango permitido.
    static clampSpeed(speed) {
        const n = Number(speed)
        if (!Number.isFinite(n) || n <= 0) {
            return DEFAULT_SPEED
        }
        return Math.min(MAX_SPEED, Math.max(MIN_SPEED, n))
    }

    static #speedToLengthScale(speed) {
        return (1 / AudioEngine.clampSpeed(speed)).toFixed(3)
    }

    // Ajusta el volumen al rango permitido, según si se permite amplificar.
    static clampVolume(volume, allowOverdrive = false) {
        const n = Number(volume)
        if (!Number.isFinite(n)) {
            return DEFAULT_VOLUME
        }
        const max = allowOverdrive ? MAX_VOLUME : DANGER_ZONE_VOLUME
        return Math.min(max, Math.max(MIN_VOLUME, n))
    }

    // Convierte un porcentaje de volumen (0-300) en el multiplicador de
    // amplitud equivalente:
    //   - 0%-100%: de VOLUME_FLOOR_DB a 0dB.
    //   - 100%-300%: de 0dB a VOLUME_CEIL_DB.
    //   - 0% exacto: silencio total.
    static volumePercentToGain(percent) {
        const n = Number(percent)
        const p = Number.isFinite(n) ? Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, n)) : DEFAULT_VOLUME
        if (p <= 0) {
            return 0
        }
        const db = p <= 100 ? VOLUME_FLOOR_DB * (1 - p / 100) : ((p - 100) / (MAX_VOLUME - 100)) * VOLUME_CEIL_DB
        return Math.pow(10, db / 20)
    }

    // Arranca una síntesis y devuelve el job de seguimiento.
    static synthesize(text, voiceId, speed) {
        const job = new SynthesisJob()
        job.promise = AudioEngine.#run(job, text, voiceId, speed)
        return job
    }

    // Ejecuta el pipeline completo de síntesis.
    static async #run(job, text, voiceId, speed) {
        // Cede el turno antes de seguir.
        await Promise.resolve()

        const lengthScale = AudioEngine.#speedToLengthScale(speed)

        job.emit("progress", { stage: "loading_model", percent: 0 })
        const { onnxPath, jsonPath } = await VoicesManager.ensureVoiceFiles(voiceId)
        const { session, config } = await AudioEngine.#loadVoice(voiceId, onnxPath, jsonPath)

        job.emit("progress", { stage: "phonemizing", percent: 0 })
        const clauses = await AudioEngine.#phonemizeClauses(text, config.espeak.voice)

        const idMap = config.phoneme_id_map
        const sampleRate = config.audio.sample_rate
        const silence = new Float32Array(Math.round((sampleRate * CLAUSE_SILENCE_MS * Number(lengthScale)) / 1000))

        const chunks = []
        let total = 0
        for (let i = 0; i < clauses.length; i++) {
            if (i > 0) {
                // Inserta un silencio entre cláusulas.
                chunks.push(silence)
                total += silence.length
            }
            const chunk = await AudioEngine.#synthesizeClause(session, clauses[i], idMap, lengthScale, config)
            chunks.push(chunk)
            total += chunk.length
            // Informa del progreso tras cada cláusula.
            job.emit("progress", { stage: "synthesizing", percent: Math.round(((i + 1) / clauses.length) * 100) })
        }

        const merged = new Float32Array(total)
        let offset = 0
        for (const chunk of chunks) {
            merged.set(chunk, offset)
            offset += chunk.length
        }
        if (merged.length === 0) {
            throw new Error("La síntesis no produjo ninguna muestra de audio.")
        }

        job.emit("progress", { stage: "done", percent: 100 })
        return { samples: merged, sampleRate }
    }
}
