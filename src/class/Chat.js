// Clase Chat: gestiona la cola de reproducción de audio hablado de un
// cliente, sintetizando y reproduciendo el texto encolado en orden.
import { AudioEngine } from "./AudioEngine.js"
import { AudioOutput } from "./AudioOutput.js"
import { START_SOUND, END_SOUND } from "../values/notification-sound.js"
import { Logger } from "./Logger.js"
import { sanitizeForSpeech } from "../lib/sanitize-for-speech.js"
import { PLAYBACK_DRAIN_MS } from "../values/constants.js"
import { AppSettings } from "./AppSettings.js"

// Duerme ms milisegundos.
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export class Chat {
    // Contador de tickets compartido entre todos los Chat: identificador
    // único en todo el proceso.
    static #ticketCounter = 0

    // Cola propia de este Chat. #currentJob es el job en curso (null si la
    // cola está parada). #streakOpen agrupa la racha de habla para el ding
    // de aviso (ver #runJob/#closeStreakIfDrained).
    #jobs = []
    #currentJob = null
    #streakOpen = false
    #streakWantsNotification = false

    // Crea el job de cola, arranca la síntesis de inmediato y devuelve el
    // ticket asignado. Los errores de síntesis se atrapan aquí para no
    // dejar una promesa rechazada sin escuchar.
    #enqueue({ text, voice, speed, notification, volume }) {
        const job = {
            ticket: ++Chat.#ticketCounter,
            cancelled: false,
            notification: Boolean(notification),
            // volume es un porcentaje (0-300); se convierte a gain justo antes de reproducir.
            volume: AudioEngine.clampVolume(volume, true),
        }
        // synthesisJob trae el progreso; synthPromise es el resultado final para #runJob.
        job.synthesisJob = AudioEngine.synthesize(text, voice, AudioEngine.clampSpeed(speed))
        job.synthPromise = job.synthesisJob.promise.catch((err) => {
            job.synthError = err
            return null
        })

        this.#jobs.push(job)
        this.#pump()
        return job.ticket
    }

    // Arranca el siguiente job de la cola si no hay ninguno en curso.
    #pump() {
        if (this.#currentJob || this.#jobs.length === 0) {
            return
        }
        const job = this.#jobs.shift()
        this.#currentJob = job
        this.#runJob(job)
            .catch((err) => Logger.error("chat:queue", "La cola de reproducción se rompió; el audio pendiente se descarta.", err))
            .finally(() => {
                this.#currentJob = null
                this.#pump()
            })
    }

    // Cierra la racha de habla cuando la cola se vacía, reproduciendo el ding final si
    // procede. Un fallo al reproducirlo se registra, pero no corta nada: el texto ya se leyó.
    #closeStreakIfDrained(job, allowEndNotification) {
        if (!this.#streakOpen || this.#jobs.length > 0) {
            return
        }
        this.#streakOpen = false
        if (!allowEndNotification || !this.#streakWantsNotification) {
            return
        }
        try {
            const { samples, sampleRate } = END_SOUND
            AudioOutput.playPcm(this, samples, sampleRate, AudioEngine.volumePercentToGain(job.volume)).catch(
                (cause) => Logger.warn("chat:ding", "No sonó el ding de fin de lectura.", cause)
            )
        } catch (cause) {
            Logger.warn("chat:ding", "No sonó el ding de fin de lectura.", cause)
        }
    }

    // Ejecuta un job: ding inicial, síntesis, reproducción y ding final según corresponda.
    async #runJob(job) {
        if (job.cancelled) {
            return this.#closeStreakIfDrained(job, true)
        }

        let cutOff = false
        const isOpening = !this.#streakOpen
        if (isOpening) {
            this.#streakOpen = true
            this.#streakWantsNotification = Boolean(job.notification)
        }

        if (isOpening && this.#streakWantsNotification) {
            try {
                const { samples, sampleRate } = START_SOUND
                const notificationOk = await AudioOutput.playPcm(this, samples, sampleRate, AudioEngine.volumePercentToGain(job.volume))
                if (!notificationOk) {
                    cutOff = true
                }
            } catch (cause) {
                // Se sigue igualmente con la voz: el ding no es lo que se pidió leer.
                Logger.warn("chat:ding", "No sonó el ding de inicio de lectura.", cause)
            }
        }

        if (job.cancelled) {
            return this.#closeStreakIfDrained(job, !cutOff)
        }

        if (job.synthError) {
            Logger.error("chat:synth", "No se pudo sintetizar el texto; ese fragmento no se leerá.", job.synthError)
            return this.#closeStreakIfDrained(job, !cutOff)
        }
        const audio = cutOff ? null : await job.synthPromise
        if (!audio || cutOff || job.cancelled) {
            return this.#closeStreakIfDrained(job, !cutOff)
        }

        const ok = await AudioOutput.playPcm(this, audio.samples, audio.sampleRate, AudioEngine.volumePercentToGain(job.volume))
        if (!ok) {
            cutOff = true
        }

        this.#closeStreakIfDrained(job, !cutOff)

        // Margen de gracia antes de dar paso al siguiente audio de esta cola.
        if (!cutOff) {
            await sleep(PLAYBACK_DRAIN_MS)
        }
    }

    // Sintetiza y encola el texto con la voz, velocidad, volumen y
    // notificación configurados en la app.
    speak(rawText) {
        const trimmed = String(rawText || "").trim()
        if (!trimmed) {
            throw new Error("El texto no puede estar vacío.")
        }
        const text = sanitizeForSpeech(trimmed)
        const voice = AppSettings.read("voice")
        if (!voice) {
            throw new Error("No hay ninguna voz instalada. Descarga una desde el panel de voces.")
        }
        const speed = AppSettings.read("speed")
        const notification = AppSettings.read("notification")
        const volume = AppSettings.read("volume")

        this.#enqueue({ text, voice, speed, notification, volume })
        return { voice, speed, notification, volume }
    }

    // Corta el audio en reproducción en cualquier Chat, no solo en este.
    stop() {
        return AudioOutput.stopAll()
    }
}
