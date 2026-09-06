// null: la app arranca sin voz hasta que haya una descargada en disco.
export const DEFAULT_VOICE = null

// Velocidad como multiplicador (1.0 = normal, 2.0 = el doble de rápido).
export const DEFAULT_SPEED = 1.0
export const MIN_SPEED = 0.5
export const MAX_SPEED = 3.0

export const DEFAULT_NOTIFICATION = true

// Volumen en porcentaje. 100 = volumen original de la síntesis, no el máximo.
export const MIN_VOLUME = 0
export const DEFAULT_VOLUME = 100

// Por encima de este valor se amplifica pudiendo distorsionar.
export const DANGER_ZONE_VOLUME = 100

export const MAX_VOLUME = 300

// Rango en decibelios al que se mapea el 0%-300% de volumen.
export const VOLUME_FLOOR_DB = -40
export const VOLUME_CEIL_DB = 18

// Margen antes de dar paso al siguiente audio de la cola.
export const PLAYBACK_DRAIN_MS = 1000 * 0.5 // 0.5 segundos

// Debe coincidir con la URL declarada en plugin/.claude-plugin/plugin.json.
export const AUDIO_SERVER_HTTP_PORT = 51703

export const MODEL_IDLE_UNLOAD_MS = 15 * 60 * 1000 // 15 minutos

// Cada cuánto mira el avisador si hay errores nuevos en el registro.
export const NOTIFIER_POLL_MS = 1000

// Espera mínima entre dos avisos, para no llenar el centro de notificaciones.
export const NOTIFIER_COOLDOWN_MS = 10 * 1000
