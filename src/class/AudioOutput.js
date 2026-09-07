// Reproducción de audio con node-web-audio-api.
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { AudioContext } from "node-web-audio-api"
import { Logger } from "./Logger.js"
import { AUDIO_DEVICE_REFRESH_MS, AUDIO_DEVICE_QUERY_MS } from "../values/constants.js"

const execFileAsync = promisify(execFile)

export class AudioOutput {
    // El AudioContext de la app.
    static #ctx = null

    // Salida predeterminada que había al abrir el contexto, o null si no se pudo saber.
    static #openedFor = null

    // Cuándo terminó lo último que sonó, para saber cuánto lleva callada la salida.
    static #idleSince = 0

    // id -> { source, gain, volume, stoppedIntentionally }. source y gain son null hasta
    // que la reproducción arranca. stoppedIntentionally es true si se cortó con
    // stop()/stopAll(), false si terminó por sí sola.
    static #playbacks = new Map()

    // openedFor: nombre de la salida predeterminada al abrirla, para comparar más tarde.
    static #getContext(openedFor) {
        if (!AudioOutput.#ctx) {
            AudioOutput.#ctx = new AudioContext()
            AudioOutput.#openedFor = openedFor
        }
        return AudioOutput.#ctx
    }

    // Nombre de la salida predeterminada del sistema, o null si no hay a quién preguntar.
    // Solo vale para compararlo consigo mismo: la librería de audio no entiende el nombre.
    static async #defaultOutput() {
        if (process.platform !== "linux") {
            return null
        }
        try {
            const { stdout } = await execFileAsync("pactl", ["get-default-sink"], {
                timeout: AUDIO_DEVICE_QUERY_MS,
            })
            return stdout.trim() || null
        } catch {
            return null
        }
    }

    // Cierra la salida abierta, para que la siguiente se abra sobre la predeterminada de
    // ahora. Solo se llama con la cola vacía: cerrarla cortaría el audio en curso.
    static async #dropContext() {
        const context = AudioOutput.#ctx
        if (!context) {
            return
        }
        AudioOutput.#ctx = null
        AudioOutput.#openedFor = null
        try {
            await context.close()
        } catch (cause) {
            Logger.warn("audio", "No se pudo cerrar la salida de audio anterior.", cause)
        }
    }

    // true si la salida abierta ya no es la predeterminada. Sin nombre que comparar, se
    // decide por el silencio acumulado.
    static #shouldReopen(current, idleFor) {
        if (!AudioOutput.#ctx) {
            return false
        }
        if (current === null || AudioOutput.#openedFor === null) {
            return idleFor >= AUDIO_DEVICE_REFRESH_MS
        }
        return current !== AudioOutput.#openedFor
    }

    // Reproduce un buffer PCM y no resuelve hasta que termina o se corta.
    static async playPcm(id, samples, sampleRate, volume = 1) {
        if (samples.length === 0) {
            return true
        }

        // Se registra antes de abrir la salida para que un stop() de ese intervalo la encuentre.
        const idleFor = Date.now() - AudioOutput.#idleSince
        const playback = { source: null, gain: null, volume, stoppedIntentionally: false }
        AudioOutput.#playbacks.set(id, playback)

        // Solo con la cola vacía, que es cuando se puede cerrar la salida sin cortar nada.
        let current = AudioOutput.#openedFor
        if (AudioOutput.#playbacks.size === 1) {
            current = await AudioOutput.#defaultOutput()
            if (AudioOutput.#shouldReopen(current, idleFor)) {
                await AudioOutput.#dropContext()
            }
        }
        const context = AudioOutput.#getContext(current)

        if (playback.stoppedIntentionally) {
            AudioOutput.#forget(id, playback)
            return false
        }

        return new Promise((resolve, reject) => {
            // samples: Float32Array mono (-1..1)
            const buffer = context.createBuffer(1, samples.length, sampleRate)
            buffer.copyToChannel(samples, 0)

            const source = context.createBufferSource()
            source.buffer = buffer

            // volume: multiplicador de amplitud
            const gain = context.createGain()
            gain.gain.value = playback.volume

            source.connect(gain)
            gain.connect(context.destination)

            playback.source = source
            playback.gain = gain

            source.onended = () => {
                AudioOutput.#forget(id, playback)
                // true si sonó entera, false si se cortó
                resolve(!playback.stoppedIntentionally)
            }

            try {
                source.start()
            } catch (err) {
                AudioOutput.#forget(id, playback)
                reject(err)
            }
        })
    }

    // Solo si sigue siendo la misma: puede haberla reemplazado otra con el mismo id.
    static #forget(id, playback) {
        if (AudioOutput.#playbacks.get(id) === playback) {
            AudioOutput.#playbacks.delete(id)
        }
        if (AudioOutput.#playbacks.size === 0) {
            AudioOutput.#idleSince = Date.now()
        }
    }

    // Corta la reproducción de este id concreto, sin tocar las demás.
    static stop(id) {
        const playback = AudioOutput.#playbacks.get(id)
        if (!playback) {
            return { stopped: false, reason: "No hay ningún audio reproduciéndose ahora mismo con ese identificador." }
        }
        // Sin source, la marca basta: playPcm la descarta antes de arrancar.
        playback.stoppedIntentionally = true
        playback.source?.stop()
        return { stopped: true }
    }

    // "Parar" global: corta todo lo que esté sonando, sea de la sesión que sea.
    static stopAll() {
        if (AudioOutput.#playbacks.size === 0) {
            return { stopped: false, reason: "No hay ningún audio reproduciéndose ahora mismo." }
        }
        let stoppedAny = false
        for (const playback of AudioOutput.#playbacks.values()) {
            playback.stoppedIntentionally = true
            try {
                playback.source?.stop()
                stoppedAny = true
            } catch (cause) {
                // Se sigue con el resto: parar unas no depende de parar las otras.
                Logger.warn("audio", "No se pudo parar una de las reproducciones en curso.", cause)
            }
        }
        return stoppedAny ? { stopped: true } : { stopped: false, reason: "No se pudo parar ningún audio en curso." }
    }

    // Cambia en marcha el volumen de esta reproducción concreta, sin cortarla.
    static setVolume(id, volume) {
        const playback = AudioOutput.#playbacks.get(id)
        if (!playback) {
            return { changed: false, reason: "No hay ningún audio reproduciéndose ahora mismo con ese identificador." }
        }
        AudioOutput.#applyVolume(playback, volume)
        return { changed: true }
    }

    // Cambia en marcha el volumen de todo lo que esté sonando.
    static setVolumeAll(volume) {
        if (AudioOutput.#playbacks.size === 0) {
            return { changed: false, reason: "No hay ningún audio reproduciéndose ahora mismo." }
        }
        for (const playback of AudioOutput.#playbacks.values()) {
            AudioOutput.#applyVolume(playback, volume)
        }
        return { changed: true }
    }

    // Guarda el volumen y lo aplica al nodo si ya existe.
    static #applyVolume(playback, volume) {
        playback.volume = volume
        if (playback.gain) {
            playback.gain.gain.value = volume
        }
    }

    static isPlaying(id) {
        return AudioOutput.#playbacks.has(id)
    }

    // true si hay algo sonando en cualquier Chat, no solo en este.
    static isAnyPlaying() {
        return AudioOutput.#playbacks.size > 0
    }
}
