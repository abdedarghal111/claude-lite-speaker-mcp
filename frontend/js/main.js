// Renderer de la ventana de ajustes (webview), sin acceso directo a Node.
// window.native.callCommand llama directamente a class/App.js/handleCommand.
async function callCommand(name, args = {}) {
  const data = await window.native.callCommand(name, args)
  if (!data.ok) throw new Error(data.error || "Error desconocido.")
  return data.result
}

// Límites de velocidad y volumen recibidos de status (ver applyLimits()).
// null hasta que llega el primer status.
let limits = null

// Aplica los límites recibidos a los sliders; solo escribe si el valor cambió.
function applyLimits(newLimits) {
  if (!newLimits) return
  limits = newLimits
  if (els.speed.min != limits.minSpeed) els.speed.min = limits.minSpeed
  if (els.speed.max != limits.maxSpeed) els.speed.max = limits.maxSpeed
  if (els.volume.min != limits.minVolume) els.volume.min = limits.minVolume
  if (els.volume.max != limits.maxVolume) els.volume.max = limits.maxVolume
}

const els = {
  status: document.getElementById("status"),
  notification: document.getElementById("notification"),
  speed: document.getElementById("speed"),
  speedValue: document.getElementById("speedValue"),
  volume: document.getElementById("volume"),
  volumeValue: document.getElementById("volumeValue"),
  voice: document.getElementById("voice"),
  speakTestText: document.getElementById("speakTestText"),
  speakTest: document.getElementById("speakTest"),
  speakStop: document.getElementById("speakStop"),
  autostart: document.getElementById("autostart"),
  onlyDownloaded: document.getElementById("onlyDownloaded"),
  refreshCatalogBtn: document.getElementById("refreshCatalogBtn"),
  openDevtoolsBtn: document.getElementById("openDevtoolsBtn"),
  voiceFilter: document.getElementById("voiceFilter"),
  downloadsProgress: document.getElementById("downloadsProgress"),
  voiceList: document.getElementById("voiceList"),
}

// quiet:true evita mostrar en pantalla el error de un refresco periódico o de fondo.
async function refreshStatus({ quiet = false } = {}) {
  try {
    const status = await callCommand("status")
    applyLimits(status.limits)
    // Refleja si el servidor está reproduciendo audio en este momento.
    els.status.textContent = status.speaking ? "Reproduciendo…" : "Conectado."
    // "Parar" solo tiene sentido mientras el servidor está reproduciendo audio.
    els.speakStop.disabled = !status.speaking
    els.notification.checked = Boolean(status.notification)
    els.speed.value = status.speed
    els.speedValue.textContent = `${status.speed}x`
    els.volume.value = status.volume
    els.volumeValue.textContent = `${status.volume}%`
    els.volumeValue.classList.toggle("danger", status.volume > limits.dangerZoneVolume)
    els.voice.textContent = status.voice
  } catch (err) {
    if (quiet) return
    els.status.textContent = `Error: ${err.message}`
  }
}

// Panel de voces: refleja el estado del servidor (voz activa, voces
// descargadas, descargas en curso), venga la acción de este panel o de un comando externo.

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  )
}

function renderDownloadsProgress(activeDownloads) {
  els.downloadsProgress.innerHTML = activeDownloads
    .map((dl) => {
      const known = dl.percent != null
      const pct = known ? Math.max(2, Math.min(100, dl.percent)) : null
      return `
        <div class="download-item">
          <div class="download-label">
            <span class="id">${escapeHtml(dl.voiceId)}</span>
            <span class="pct">${known ? `${pct}%` : "descargando…"}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill${known ? "" : " indeterminate"}" style="${known ? `width:${pct}%` : ""}"></div>
          </div>
        </div>`
    })
    .join("")
}

// Se pinta cuando el catálogo remoto de voces no se ha descargado todavía.
function renderCatalogUnavailable() {
  els.voiceList.innerHTML = `<p class="voice-list-empty">No hay catálogo de voces descargado todavía. Usa el botón "Descargar catálogo de voces" de arriba.</p>`
}

function renderVoiceList(entries, { currentVoice, downloadedIds, downloadingIds, truncatedCount }) {
  if (entries.length === 0) {
    els.voiceList.innerHTML = `<p class="voice-list-empty">${
      els.onlyDownloaded.checked
        ? "No hay ninguna voz descargada todavía. Desmarca “Solo descargadas” para buscar y descargar una."
        : "Sin resultados para esa búsqueda."
    }</p>`
    return
  }

  const rows = entries
    .map((v) => {
      const isActive = v.id === currentVoice
      const isDownloading = downloadingIds.has(v.id)
      const isDownloaded = downloadedIds.has(v.id)
      const meta = [v.language_name || v.language, v.quality, v.sizeMb != null ? `${v.sizeMb} MB` : null]
        .filter(Boolean)
        .join(" · ")

      let action
      if (isActive) {
        action = `<button type="button" disabled>En uso</button>`
      } else if (isDownloading) {
        action = `<button type="button" disabled>Descargando…</button>`
      } else if (isDownloaded) {
        action = `<button type="button" data-action="use" data-voice-id="${escapeHtml(v.id)}">Usar</button>`
      } else {
        action = `<button type="button" class="secondary" data-action="download" data-voice-id="${escapeHtml(v.id)}">Descargar</button>`
      }

      return `
        <div class="voice-item${isActive ? " active" : ""}">
          <div class="voice-item-info">
            <div class="voice-item-id">${escapeHtml(v.id)}</div>
            ${meta ? `<div class="voice-item-meta">${escapeHtml(meta)}</div>` : ""}
          </div>
          ${action}
        </div>`
    })
    .join("")

  const hint =
    truncatedCount > 0
      ? `<p class="voice-list-hint">+${truncatedCount} más — afina la búsqueda para verlas.</p>`
      : ""
  els.voiceList.innerHTML = rows + hint
}

// Límite de filas del catálogo que se pintan de golpe (evita cargar el DOM con las ~175 voces).
const CATALOG_LIST_LIMIT = 60

async function refreshVoicesPanel() {
  const includeCatalog = !els.onlyDownloaded.checked

  let data
  try {
    data = await callCommand("voicesPanelData", { includeCatalog })
  } catch {
    // el poll de refreshStatus ya informa si el servidor se cayó
    return
  }

  renderDownloadsProgress(data.activeDownloads)

  if (includeCatalog && !data.catalogAvailable) {
    renderCatalogUnavailable()
    return
  }

  const downloadedIds = new Set(data.downloaded.map((v) => v.id))
  const downloadingIds = new Set(data.activeDownloads.map((d) => d.voiceId))
  const sizeById = new Map(data.downloaded.map((v) => [v.id, v.sizeMb]))

  let entries = []
  let truncatedCount = 0
  if (includeCatalog && data.catalog) {
    const q = els.voiceFilter.value.trim().toLowerCase()
    const filtered = data.catalog.filter(
      (v) =>
        !q ||
        v.id.toLowerCase().includes(q) ||
        (v.language || "").toLowerCase().includes(q) ||
        (v.language_name || "").toLowerCase().includes(q)
    )
    entries = filtered
      .slice(0, CATALOG_LIST_LIMIT)
      .map((v) => ({ ...v, sizeMb: sizeById.get(v.id) ?? null }))
    truncatedCount = filtered.length - entries.length
  } else {
    entries = data.downloaded.map((v) => ({ id: v.id, sizeMb: v.sizeMb }))
  }

  renderVoiceList(entries, { currentVoice: data.currentVoice, downloadedIds, downloadingIds, truncatedCount })
}

let voiceFilterDebounce = null

function wireVoicesPanel() {
  els.onlyDownloaded.addEventListener("change", () => {
    els.voiceFilter.hidden = els.onlyDownloaded.checked
    refreshVoicesPanel()
  })

  els.voiceFilter.addEventListener("input", () => {
    clearTimeout(voiceFilterDebounce)
    voiceFilterDebounce = setTimeout(refreshVoicesPanel, 200)
  })

  // La app nunca toca la red para el catálogo sola: este botón es el único disparador.
  els.refreshCatalogBtn.addEventListener("click", () => {
    els.refreshCatalogBtn.disabled = true
    els.refreshCatalogBtn.textContent = "Descargando…"
    callCommand("refreshVoiceCatalog")
      .catch((err) => {
        els.status.textContent = `Error: ${err.message}`
      })
      .finally(() => {
        els.refreshCatalogBtn.disabled = false
        els.refreshCatalogBtn.textContent = "Descargar catálogo de voces"
        refreshVoicesPanel()
      })
  })

  // Delegación de eventos: la lista se repinta entera en cada refresco, así
  // que un listener fijo por botón no serviría.
  els.voiceList.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-action]")
    if (!btn || btn.disabled) {
      return
    }
    // "use" | "download"
    const action = btn.dataset.action
    const voiceId = btn.dataset.voiceId
    btn.disabled = true
    btn.textContent = action === "use" ? "Activando…" : "Descargando…"

    callCommand(action === "use" ? "setVoice" : "downloadVoice", { voice_id: voiceId })
      .catch((err) => {
        els.status.textContent = `Error: ${err.message}`
      })
      .finally(() => {
        refreshVoicesPanel()
        // Refresca "Voz actual" al instante, sin esperar al siguiente tick del poll.
        refreshStatus({ quiet: true })
      })
  })
}

// Refleja en la casilla el estado de autoarranque expuesto por el host vía window.native.
async function initAutostartRow() {
  els.autostart.checked = await window.native.isAutostartEnabled()
}

function wireControls() {
  els.openDevtoolsBtn.addEventListener("click", () =>
    window.native.openDevtools().catch((err) => (els.status.textContent = `Error: ${err.message}`))
  )

  els.notification.addEventListener("change", () =>
    callCommand("setNotification", { enabled: els.notification.checked }).catch(
      (err) => (els.status.textContent = `Error: ${err.message}`)
    )
  )

  els.speed.addEventListener("input", () => {
    els.speedValue.textContent = `${els.speed.value}x`
  })
  els.speed.addEventListener("change", () =>
    callCommand("setSpeed", { speed: Number(els.speed.value) }).catch(
      (err) => (els.status.textContent = `Error: ${err.message}`)
    )
  )

  els.volume.addEventListener("input", () => {
    els.volumeValue.textContent = `${els.volume.value}%`
    // limits es null hasta el primer status; sin límites no se marca "danger".
    if (limits) els.volumeValue.classList.toggle("danger", Number(els.volume.value) > limits.dangerZoneVolume)
  })
  els.volume.addEventListener("change", () =>
    // allow_overdrive:true porque es el usuario moviendo el slider, no una llamada externa.
    callCommand("setVolume", { volume: Number(els.volume.value), allow_overdrive: true }).catch(
      (err) => (els.status.textContent = `Error: ${err.message}`)
    )
  )

  // Texto usado si el campo de prueba está vacío (speak rechaza texto vacío).
  const DEFAULT_SPEAK_TEXT = "Hola, así sueno ahora mismo."

  function runSpeakTest() {
    const text = els.speakTestText.value.trim() || DEFAULT_SPEAK_TEXT
    // speak es fire-and-forget: se refresca el estado fuera de turno
    // para no esperar al siguiente tick del poll.
    callCommand("speak", { text })
      .then(() => refreshStatus({ quiet: true }))
      .catch((err) => (els.status.textContent = `Error: ${err.message}`))
  }

  els.speakTest.addEventListener("click", runSpeakTest)
  // Enter en el campo de texto lanza la prueba sin usar el ratón.
  els.speakTestText.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") runSpeakTest()
  })

  els.speakStop.addEventListener("click", () => {
    // Refresca el estado sin esperar al tick de 1s, para que se note el corte.
    callCommand("stop")
      .then(() => refreshStatus({ quiet: true }))
      .catch((err) => (els.status.textContent = `Error: ${err.message}`))
  })

  els.autostart.addEventListener("change", () =>
    window.native.setAutostart(els.autostart.checked).catch((err) => (els.status.textContent = `Error: ${err.message}`))
  )
}

document.addEventListener("DOMContentLoaded", async () => {
  wireControls()
  wireVoicesPanel()
  await initAutostartRow()
  await refreshStatus()
  await refreshVoicesPanel()
  // Refresca el estado y el panel de voces cada segundo (el catálogo es JSON local, no red).
  setInterval(() => {
    refreshStatus({ quiet: true })
    refreshVoicesPanel()
  }, 1000)
})
