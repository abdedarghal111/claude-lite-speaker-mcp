// Enlace mínimo a la API de audio de SDL3 con koffi: solo lo que usa class/AudioOutput.js.
// La librería se carga la primera vez que hace falta, así que si no está, falla el audio
// y no el arranque de la app.
import koffi from "koffi"
import { SDL_LIBRARY_FILE } from "../paths.js"

const SDL_INIT_AUDIO = 0x10
const SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK = 0xffffffff
// Float de 32 bits en little endian, que es como vienen las muestras en x64 y arm64.
const SDL_AUDIO_F32LE = 0x8120

// Se declara una sola vez: koffi no deja repetir un nombre de tipo, y load() puede
// reintentarse si la primera carga falló.
koffi.struct("SDL_AudioSpec", { format: "int", channels: "int", freq: "int" })

let api = null

function load() {
    if (api) {
        return api
    }
    let lib
    try {
        lib = koffi.load(SDL_LIBRARY_FILE)
    } catch (cause) {
        throw new Error(`No se pudo cargar SDL3 desde ${SDL_LIBRARY_FILE}: ${cause.message}`, { cause })
    }
    api = {
        Init: lib.func("bool SDL_Init(uint32_t flags)"),
        QuitSubSystem: lib.func("void SDL_QuitSubSystem(uint32_t flags)"),
        GetError: lib.func("const char *SDL_GetError()"),
        PumpEvents: lib.func("void SDL_PumpEvents()"),
        OpenAudioDeviceStream: lib.func("void *SDL_OpenAudioDeviceStream(uint32_t devid, const SDL_AudioSpec *spec, void *callback, void *userdata)"),
        ResumeAudioStreamDevice: lib.func("bool SDL_ResumeAudioStreamDevice(void *stream)"),
        PutAudioStreamData: lib.func("bool SDL_PutAudioStreamData(void *stream, const void *buf, int len)"),
        FlushAudioStream: lib.func("bool SDL_FlushAudioStream(void *stream)"),
        GetAudioStreamQueued: lib.func("int SDL_GetAudioStreamQueued(void *stream)"),
        GetAudioStreamAvailable: lib.func("int SDL_GetAudioStreamAvailable(void *stream)"),
        SetAudioStreamGain: lib.func("bool SDL_SetAudioStreamGain(void *stream, float gain)"),
        DestroyAudioStream: lib.func("void SDL_DestroyAudioStream(void *stream)"),
    }
    return api
}

// Las funciones de SDL devuelven false al fallar y dejan el motivo en SDL_GetError().
function check(ok, what) {
    if (!ok) {
        throw new Error(`${what}: ${api.GetError() || "sin mensaje"}`)
    }
}

export const Sdl3 = {
    init() {
        check(load().Init(SDL_INIT_AUDIO), "SDL_Init")
    },

    quit() {
        api?.QuitSubSystem(SDL_INIT_AUDIO)
    },

    // Deja que SDL termine lo que tiene pendiente sobre los dispositivos. Cuando uno
    // desaparece (unos cascos que se apagan o cambian de perfil), SDL no lo gestiona en
    // el momento: lo deja en cola hasta que el hilo principal llama a esta función, y
    // hasta entonces lo que suena por ahí se queda parado.
    pumpEvents() {
        api.PumpEvents()
    },

    // Stream de muestras mono en float sobre la salida predeterminada de ahora. SDL elige
    // el dispositivo, lo abre con sus propios canales y frecuencia, convierte nuestras
    // muestras a ese formato y, si la predeterminada cambia, mueve el stream a la nueva.
    // Se abre en pausa: suena al llamar a resume().
    openPlaybackStream(sampleRate) {
        const stream = load().OpenAudioDeviceStream(
            SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK,
            { format: SDL_AUDIO_F32LE, channels: 1, freq: sampleRate },
            null,
            null,
        )
        check(stream, "SDL_OpenAudioDeviceStream")
        return stream
    },

    // samples: Float32Array mono (-1..1). Se copia, así que se puede soltar después.
    put(stream, samples) {
        check(api.PutAudioStreamData(stream, samples, samples.byteLength), "SDL_PutAudioStreamData")
        // Sin más datos detrás, el final se convierte ya en vez de esperar a que llegue más.
        check(api.FlushAudioStream(stream), "SDL_FlushAudioStream")
    },

    resume(stream) {
        check(api.ResumeAudioStreamDevice(stream), "SDL_ResumeAudioStreamDevice")
    },

    // Bytes que el dispositivo aún no ha recogido del stream. 0 = ya no queda nada por sonar.
    pending(stream) {
        const queued = api.GetAudioStreamQueued(stream)
        const available = api.GetAudioStreamAvailable(stream)
        check(queued >= 0 && available >= 0, "SDL_GetAudioStreamQueued")
        return queued + available
    },

    // gain: multiplicador de amplitud, 1 = sin cambios. Se aplica al momento.
    setGain(stream, gain) {
        check(api.SetAudioStreamGain(stream, gain), "SDL_SetAudioStreamGain")
    },

    // Corta lo que quede por sonar y libera el stream.
    destroy(stream) {
        api.DestroyAudioStream(stream)
    },
}
