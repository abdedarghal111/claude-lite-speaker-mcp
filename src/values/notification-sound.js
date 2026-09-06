// Sonidos de aviso que marcan el inicio y el fin de la síntesis de voz.
// Se generan como ondas seno en vez de usar un archivo de audio, sin
// dependencias externas.
const SAMPLE_RATE = 22050

// Genera una nota pura con fade in/out para evitar clics de audio. La
// amplitud por defecto es baja porque un tono sostenido se percibe más
// fuerte que la voz al mismo volumen.
function tone(freq, durationMs, amplitude = 0.08) {
    const totalSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000)
    const fadeSamples = Math.min(300, Math.floor(totalSamples * 0.15))
    const samples = new Float32Array(totalSamples)

    for (let i = 0; i < totalSamples; i++) {
        const envelope = Math.min(1, i / fadeSamples, (totalSamples - i) / fadeSamples)
        samples[i] = Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE) * amplitude * envelope
    }

    return samples
}

// Concatena varios buffers de audio en uno solo.
function concat(...arrays) {
    const merged = new Float32Array(arrays.reduce((total, array) => total + array.length, 0))
    let offset = 0
    for (const array of arrays) {
        merged.set(array, offset)
        offset += array.length
    }
    return merged
}

// Silencio breve entre las dos notas de cada aviso.
const SILENCE_GAP = new Float32Array(Math.floor(SAMPLE_RATE * 0.02))

// Notas ascendentes: B5 -> E6.
export const START_SOUND = { samples: concat(tone(988, 90), SILENCE_GAP, tone(1319, 130)), sampleRate: SAMPLE_RATE }

// Notas descendentes: E6 -> B5.
export const END_SOUND = { samples: concat(tone(1319, 90), SILENCE_GAP, tone(988, 130)), sampleRate: SAMPLE_RATE }

// Notas graves descendentes, más fuertes de lo normal: A4 -> Eb4.
export const ERROR_SOUND = { samples: concat(tone(440, 110, 0.24), SILENCE_GAP, tone(311, 200, 0.24)), sampleRate: SAMPLE_RATE }
