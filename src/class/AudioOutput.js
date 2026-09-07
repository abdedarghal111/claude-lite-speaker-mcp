// Reproducción de audio con node-web-audio-api.
import { AudioContext } from "node-web-audio-api"
import { Logger } from "./Logger.js"

export class AudioOutput {
    // El AudioContext de la app.
    static #ctx = null

    // id -> { source, gain, volume, stoppedIntentionally }. source y gain son null hasta
    // que la reproducción arranca. stoppedIntentionally es true si se cortó con
    // stop()/stopAll(), false si terminó por sí sola.
    static #playbacks = new Map()

    static #getContext() {
        if (!AudioOutput.#ctx) {
            AudioOutput.#ctx = new AudioContext()
        }
        return AudioOutput.#ctx
    }

    // Reengancha el contexto al dispositivo de salida predeterminado de ahora. Pasa por
    // "none" porque repetir el mismo identificador no reabre el flujo.
    static async #followDefaultDevice(context) {
        try {
            await context.setSinkId({ type: "none" })
            await context.setSinkId("")
        } catch (cause) {
            Logger.warn("audio", "No se pudo mover el audio al dispositivo actual; suena por el anterior.", cause)
        }
    }

    // Reproduce un buffer PCM y no resuelve hasta que termina o se corta.
    static async playPcm(id, samples, sampleRate, volume = 1) {
        if (samples.length === 0) {
            return true
        }

        // Se registra antes de reenganchar el dispositivo para que un stop() de ese
        // intervalo la encuentre.
        const playback = { source: null, gain: null, volume, stoppedIntentionally: false }
        AudioOutput.#playbacks.set(id, playback)

        // Solo con un contexto ya abierto y la cola vacía: reabrir el flujo cortaría el
        // audio en curso.
        const reused = AudioOutput.#ctx !== null
        const context = AudioOutput.#getContext()
        if (reused && AudioOutput.#playbacks.size === 1) {
            await AudioOutput.#followDefaultDevice(context)
        }

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
