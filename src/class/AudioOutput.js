// Reproducción de audio con SDL3 (ver lib/sdl3.js). Cada reproducción es un stream propio
// sobre la salida predeterminada, y de los dispositivos se encarga SDL: elige el
// predeterminado, convierte al formato que tenga (también a uno mono, como unos cascos
// Bluetooth en manos libres), mezcla lo que suene a la vez y mueve los streams si la
// predeterminada cambia o desaparece.
import { Logger } from "./Logger.js"
import { Sdl3 } from "../lib/sdl3.js"
import { AUDIO_POLL_MS, AUDIO_STALL_MS } from "../values/constants.js"

export class AudioOutput {
    // true una vez iniciado el audio de SDL.
    static #ready = false

    // id -> { id, stream, volume, resolve, reject, pending, movedAt }, la última
    // reproducción de ese id. pending y movedAt: lo que quedaba por sonar y cuándo bajó por
    // última vez, para ver si se ha atascado.
    static #playbacks = new Map()

    // Todas las reproducciones que siguen sonando, también las que otra del mismo id ha
    // reemplazado en #playbacks.
    static #active = new Set()

    // Temporizador que mira qué reproducciones han terminado; solo corre si hay alguna.
    static #timer = null

    // Reproduce un buffer PCM y no resuelve hasta que termina o se corta.
    static async playPcm(id, samples, sampleRate, volume = 1) {
        if (samples.length === 0) {
            return true
        }

        let stream = null
        try {
            if (!AudioOutput.#ready) {
                Sdl3.init()
                AudioOutput.#ready = true
            }
            // Antes de abrir, para que el stream vaya a la predeterminada de ahora y no a
            // una que ya no existe.
            Sdl3.pumpEvents()
            // samples: Float32Array mono (-1..1). volume: multiplicador de amplitud.
            stream = Sdl3.openPlaybackStream(sampleRate)
            Sdl3.setGain(stream, volume)
            Sdl3.put(stream, samples)
            Sdl3.resume(stream)
        } catch (cause) {
            if (stream) {
                Sdl3.destroy(stream)
            }
            throw new Error(
                `No se pudo reproducir el audio de ${samples.length} muestras a ${sampleRate} Hz: ${cause.message} (${Sdl3.describeOutput()})`,
                { cause },
            )
        }

        return new Promise((resolve, reject) => {
            const playback = { id, stream, volume, resolve, reject, pending: Infinity, movedAt: Date.now() }
            AudioOutput.#playbacks.set(id, playback)
            AudioOutput.#active.add(playback)
            if (!AudioOutput.#timer) {
                AudioOutput.#timer = setInterval(AudioOutput.#poll, AUDIO_POLL_MS)
            }
        })
    }

    // Termina las reproducciones que el dispositivo ya ha recogido enteras.
    static #poll() {
        // También mientras suena: si la salida desaparece a mitad, SDL mueve lo que suena
        // a la nueva predeterminada en cuanto se le deja.
        Sdl3.pumpEvents()
        for (const playback of AudioOutput.#active) {
            let pending
            try {
                pending = Sdl3.pending(playback.stream)
            } catch (cause) {
                AudioOutput.#finish(playback)
                playback.reject(
                    new Error(`No se pudo seguir la reproducción: ${cause.message} (${Sdl3.describeOutput()})`, { cause }),
                )
                continue
            }
            if (pending === 0) {
                AudioOutput.#finish(playback)
                // true: sonó entera.
                playback.resolve(true)
            } else if (pending < playback.pending) {
                playback.pending = pending
                playback.movedAt = Date.now()
            } else if (Date.now() - playback.movedAt >= AUDIO_STALL_MS) {
                // La salida ha dejado de recoger audio sin que SDL dé error (un driver
                // colgado, o PipeWire que deja de pedir datos al volver de suspender). Sin
                // esto, la promesa no terminaría y la cola se quedaría muda para siempre.
                AudioOutput.#finish(playback)
                playback.reject(
                    new Error(
                        `El audio dejó de avanzar durante ${AUDIO_STALL_MS / 1000} s con ${pending} bytes por sonar y se ha cortado (${Sdl3.describeOutput()})`,
                    ),
                )
            }
        }
    }

    // Libera el stream y la saca de las listas, sin resolver su promesa.
    static #finish(playback) {
        AudioOutput.#active.delete(playback)
        // Solo si sigue siendo la misma: puede haberla reemplazado otra con el mismo id.
        if (AudioOutput.#playbacks.get(playback.id) === playback) {
            AudioOutput.#playbacks.delete(playback.id)
        }
        Sdl3.destroy(playback.stream)
        if (AudioOutput.#active.size === 0) {
            clearInterval(AudioOutput.#timer)
            AudioOutput.#timer = null
        }
    }

    // Corta la reproducción de este id concreto, sin tocar las demás.
    static stop(id) {
        const playback = AudioOutput.#playbacks.get(id)
        if (!playback) {
            return { stopped: false, reason: "No hay ningún audio reproduciéndose ahora mismo con ese identificador." }
        }
        AudioOutput.#finish(playback)
        // false: se cortó antes de terminar.
        playback.resolve(false)
        return { stopped: true }
    }

    // "Parar" global: corta todo lo que esté sonando, sea de la sesión que sea.
    static stopAll() {
        if (AudioOutput.#active.size === 0) {
            return { stopped: false, reason: "No hay ningún audio reproduciéndose ahora mismo." }
        }
        for (const playback of AudioOutput.#active) {
            AudioOutput.#finish(playback)
            playback.resolve(false)
        }
        return { stopped: true }
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
        if (AudioOutput.#active.size === 0) {
            return { changed: false, reason: "No hay ningún audio reproduciéndose ahora mismo." }
        }
        for (const playback of AudioOutput.#active) {
            AudioOutput.#applyVolume(playback, volume)
        }
        return { changed: true }
    }

    // Un fallo se registra sin cortar el audio: sigue sonando con el volumen anterior.
    static #applyVolume(playback, volume) {
        playback.volume = volume
        try {
            Sdl3.setGain(playback.stream, volume)
        } catch (cause) {
            Logger.warn("audio", `No se pudo cambiar el volumen del audio en curso: ${cause.message} (${Sdl3.describeOutput()})`, cause)
        }
    }

    static isPlaying(id) {
        return AudioOutput.#playbacks.has(id)
    }

    // true si hay algo sonando en cualquier Chat, no solo en este.
    static isAnyPlaying() {
        return AudioOutput.#active.size > 0
    }

    // Corta lo que suene y cierra el audio de SDL. Solo al salir de la app.
    static close() {
        AudioOutput.stopAll()
        if (AudioOutput.#ready) {
            Sdl3.quit()
            AudioOutput.#ready = false
        }
    }
}
