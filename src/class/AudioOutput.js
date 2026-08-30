// Reproducción de audio con node-web-audio-api.
import { AudioContext } from "node-web-audio-api"

export class AudioOutput {
    // El AudioContext de la app.
    static #ctx = null

    // id -> { source, gain, stoppedIntentionally }. stoppedIntentionally es
    // true si se cortó con stop()/stopAll(), false si terminó por sí sola.
    static #playbacks = new Map()

    static #getContext() {
        if (!AudioOutput.#ctx) {
            AudioOutput.#ctx = new AudioContext()
        }
        return AudioOutput.#ctx
    }

    // Reproduce un buffer PCM y no resuelve hasta que termina o se corta.
    static playPcm(id, samples, sampleRate, volume = 1) {
        return new Promise((resolve, reject) => {
            if (samples.length === 0) {
                resolve(true)
                return
            }

            const context = AudioOutput.#getContext()

            // samples: Float32Array mono (-1..1)
            const buffer = context.createBuffer(1, samples.length, sampleRate)
            buffer.copyToChannel(samples, 0)

            const source = context.createBufferSource()
            source.buffer = buffer

            // volume: multiplicador de amplitud
            const gain = context.createGain()
            gain.gain.value = volume

            source.connect(gain)
            gain.connect(context.destination)

            const playback = { source, gain, stoppedIntentionally: false }

            source.onended = () => {
                if (AudioOutput.#playbacks.get(id) === playback) {
                    AudioOutput.#playbacks.delete(id)
                }
                // true si sonó entera, false si se cortó
                resolve(!playback.stoppedIntentionally)
            }

            // id: para pararla o cambiarle el volumen luego
            try {
                AudioOutput.#playbacks.set(id, playback)
                source.start()
            } catch (err) {
                if (AudioOutput.#playbacks.get(id) === playback) {
                    AudioOutput.#playbacks.delete(id)
                }
                reject(err)
            }
        })
    }

    // Corta la reproducción de este id concreto, sin tocar las demás.
    static stop(id) {
        const playback = AudioOutput.#playbacks.get(id)
        if (!playback) {
            return { stopped: false, reason: "No hay ningún audio reproduciéndose ahora mismo con ese identificador." }
        }
        playback.stoppedIntentionally = true
        playback.source.stop()
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
                playback.source.stop()
                stoppedAny = true
            } catch {
                /* este en concreto no se pudo parar, seguimos con el resto */
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
        playback.gain.gain.value = volume
        return { changed: true }
    }

    // Cambia en marcha el volumen de todo lo que esté sonando.
    static setVolumeAll(volume) {
        if (AudioOutput.#playbacks.size === 0) {
            return { changed: false, reason: "No hay ningún audio reproduciéndose ahora mismo." }
        }
        for (const playback of AudioOutput.#playbacks.values()) {
            playback.gain.gain.value = volume
        }
        return { changed: true }
    }

    static isPlaying(id) {
        return AudioOutput.#playbacks.has(id)
    }

    // true si hay algo sonando en cualquier Chat, no solo en este.
    static isAnyPlaying() {
        return AudioOutput.#playbacks.size > 0
    }
}
