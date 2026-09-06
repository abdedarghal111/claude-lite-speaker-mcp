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
  statusDot: document.getElementById("statusDot"),
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
  openDevtoolsBtn: document.getElementById("openDevtoolsBtn"),
  tabGeneral: document.getElementById("tabGeneral"),
  tabVoces: document.getElementById("tabVoces"),
  tabAvisos: document.getElementById("tabAvisos"),
  tabBadge: document.getElementById("tabBadge"),
  voiceTop: document.getElementById("voiceTop"),
  panelGeneral: document.getElementById("panelGeneral"),
  panelVoces: document.getElementById("panelVoces"),
  panelAvisos: document.getElementById("panelAvisos"),
  panelLogs: document.getElementById("panelLogs"),
  segDownloaded: document.getElementById("segDownloaded"),
  segCatalog: document.getElementById("segCatalog"),
  refreshCatalogBtn: document.getElementById("refreshCatalogBtn"),
  voiceFilter: document.getElementById("voiceFilter"),
  downloadsProgress: document.getElementById("downloadsProgress"),
  voiceList: document.getElementById("voiceList"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  notifChips: document.getElementById("notifChips"),
  notifScroll: document.getElementById("notifScroll"),
  openLogsFromAvisos: document.getElementById("openLogsFromAvisos"),
  toastDock: document.getElementById("toastDock"),
  logSearch: document.getElementById("logSearch"),
  logCount: document.getElementById("logCount"),
  logTable: document.getElementById("logTable"),
}

// ============ Bandeja de avisos: toast + histórico + panel de logs ============
// Sustituye a los "Error: ..." que antes se escribían encima de #status: cada
// error (y algún éxito relevante) pasa por notify()/notifyError(), que a la
// vez lanza el toast, lo apunta en la pestaña "Avisos" y lo deja en el panel
// de logs con su stack para poder depurar de verdad.

const LEVELS = { error: "Error", warn: "Aviso", info: "Info", ok: "Éxito" }

const ICONS = {
  error: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
  warn: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
}

function iconSvg(level) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[level]}</svg>`
}

const TOAST_DURATION = 4500
const MAX_TOASTS = 3

let notifEvents = []
let notifUnread = 0
let notifSeq = 0
let notifFilter = "all"
let activeToastCount = 0
// Evita avisar de "sin conexión" en cada tick del poll: solo al cambiar de estado.
let serverConnected = true

function fmtTime(d) {
  return d.toLocaleTimeString("es-ES", { hour12: false })
}

function relTime(d) {
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 60) {
    return "hace un instante"
  }
  if (s < 3600) {
    return `hace ${Math.floor(s / 60)} min`
  }
  return `hace ${Math.floor(s / 3600)} h`
}

function isToday(d) {
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

// level: "error" | "warn" | "info" | "ok". detail es opcional (p. ej. err.stack).
function notify(level, message, source, detail) {
  const ev = { id: ++notifSeq, level, time: new Date(), message, source, detail }
  notifEvents.unshift(ev)
  notifUnread++
  bumpBadge()
  renderNotifList()
  spawnToast(level, message, source)
}

function notifyError(source, err) {
  notify("error", (err && err.message) || "Error desconocido.", source, err && err.stack)
}

function bumpBadge() {
  els.tabBadge.textContent = notifUnread
  els.tabBadge.dataset.count = String(notifUnread)
  els.tabBadge.classList.remove("bump")
  // Fuerza el reflow para poder relanzar la animación aunque ya estuviera aplicada.
  void els.tabBadge.offsetWidth
  els.tabBadge.classList.add("bump")
}

function markNotificationsRead() {
  notifUnread = 0
  bumpBadge()
}

function renderNotifList() {
  let list = notifEvents
  if (notifFilter !== "all") {
    list = list.filter((e) => e.level === notifFilter)
  }
  const today = list.filter((e) => isToday(e.time))
  const older = list.filter((e) => !isToday(e.time))

  const row = (ev) => `
    <div class="notif-item ${ev.level}" data-id="${ev.id}">
      <div class="notif-item-inner">
        <span class="notif-icon">${iconSvg(ev.level)}</span>
        <div class="notif-body">
          <div class="notif-msg">${escapeHtml(ev.message)}</div>
          <div class="notif-meta">${escapeHtml(ev.source)} · ${relTime(ev.time)}</div>
        </div>
        <button type="button" class="notif-x" data-dismiss="${ev.id}">✕</button>
      </div>
    </div>`

  let html = ""
  if (today.length) {
    html += `<div class="notif-group">Hoy</div>` + today.map(row).join("")
  }
  if (older.length) {
    html += `<div class="notif-group">Ayer</div>` + older.map(row).join("")
  }
  // Sin animación de entrada: se pintan directamente. La lista vivía en un
  // panel que puede estar oculto (display:none) cuando llega el aviso, y
  // medir alturas ahí siempre daba 0 (ver el bug que esto reemplaza).
  els.notifScroll.innerHTML = html || `<p class="notif-empty">No hay avisos.</p>`

  els.notifScroll.querySelectorAll("[data-dismiss]").forEach((btn) => {
    btn.addEventListener("click", () => removeNotifEvent(Number(btn.dataset.dismiss)))
  })
}

function removeNotifEvent(id) {
  notifEvents = notifEvents.filter((e) => e.id !== id)
  renderNotifList()
}

function wireAvisosPanel() {
  els.notifChips.innerHTML = ["all", "error", "warn", "info", "ok"]
    .map((k) => `<button type="button" class="notif-chip${k === "all" ? " active" : ""}" data-k="${k}">${k === "all" ? "Todos" : LEVELS[k]}</button>`)
    .join("")

  els.notifChips.addEventListener("click", (evt) => {
    const btn = evt.target.closest(".notif-chip")
    if (!btn) {
      return
    }
    notifFilter = btn.dataset.k
    ;[...els.notifChips.children].forEach((c) => c.classList.toggle("active", c === btn))
    renderNotifList()
  })

  els.clearAllBtn.addEventListener("click", () => {
    notifEvents = []
    renderNotifList()
  })

  els.openLogsFromAvisos.addEventListener("click", () => selectTab("logs"))
}

// ---- Toasts: nacen abajo con forma de tarjeta (como en Avisos), con
// márgenes laterales y barra de tiempo pausable ----

function spawnToast(level, message, source) {
  if (activeToastCount >= MAX_TOASTS) {
    const oldest = els.toastDock.firstElementChild
    if (oldest) {
      collapseToast(oldest)
    }
  }

  const wrap = document.createElement("div")
  wrap.className = `toast-item ${level}`
  wrap.innerHTML = `
    <div class="toast-inner">
      <span class="toast-icon">${iconSvg(level)}</span>
      <div class="toast-body">
        <div class="toast-msg">${escapeHtml(message)}</div>
        <div class="toast-meta">${escapeHtml(source)} · ahora</div>
      </div>
      <button type="button" class="toast-close">✕</button>
      <div class="toast-bar"></div>
    </div>`
  els.toastDock.appendChild(wrap)
  activeToastCount++

  const inner = wrap.querySelector(".toast-inner")
  const bar = wrap.querySelector(".toast-bar")
  const closeBtn = wrap.querySelector(".toast-close")

  requestAnimationFrame(() => {
    wrap.style.maxHeight = `${wrap.scrollHeight}px`
    wrap.classList.add("show")
  })

  let remaining = TOAST_DURATION
  let last = performance.now()
  let paused = false
  let raf = requestAnimationFrame(tick)

  function tick(now) {
    if (!paused) {
      remaining -= now - last
      bar.style.width = `${Math.max(0, (remaining / TOAST_DURATION) * 100)}%`
      if (remaining <= 0) {
        collapseToast(wrap)
        return
      }
    }
    last = now
    raf = requestAnimationFrame(tick)
  }

  inner.addEventListener("mouseenter", () => {
    paused = true
  })
  inner.addEventListener("mouseleave", () => {
    paused = false
    last = performance.now()
  })
  closeBtn.addEventListener("click", () => {
    cancelAnimationFrame(raf)
    collapseToast(wrap)
  })
}

function collapseToast(wrap) {
  if (!wrap || wrap.dataset.collapsing) {
    return
  }
  wrap.dataset.collapsing = "1"
  wrap.classList.remove("show")
  wrap.style.maxHeight = "0px"
  activeToastCount = Math.max(0, activeToastCount - 1)
  setTimeout(() => wrap.remove(), 300)
}

// ---- Pestaña Registro de errores: tabla de Logger (backend) en memoria,
// filtrable por texto, con detalle (stack) por evento ----

const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`
const COPY_DONE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4 10-10"/></svg>`

// Tabla de errores de Logger tal como la devolvió el backend la última vez
// (ver refreshDebugLog): no es el histórico de avisos de interfaz (eso es
// notifEvents, para la pestaña Avisos), son errores reales del proceso.
let debugErrors = []

// Trae la tabla en memoria de Logger (cmdDebugLog en App.js) y repinta.
async function refreshDebugLog() {
  try {
    debugErrors = await callCommand("debugLog")
  } catch (err) {
    notifyError("debugLog", err)
  }
  renderLogPanel()
}

function renderLogPanel() {
  const q = els.logSearch.value.trim().toLowerCase()
  const list = q ? debugErrors.filter((e) => e.message.toLowerCase().includes(q)) : debugErrors

  els.logCount.textContent = `${list.length} de ${debugErrors.length} errores`

  els.logTable.innerHTML =
    list
      .map(
        (ev) => `
    <div class="log-row">
      <div class="log-row-main">
        <span class="time">${fmtTime(new Date(ev.time))}</span>
        <span class="sev-chip error">Error</span>
        <span class="msg">${escapeHtml(ev.message)}</span>
        <button type="button" class="log-row-copy" title="Copiar mensaje">${COPY_ICON}</button>
      </div>
      <div class="log-detail">${escapeHtml(ev.text)}</div>
    </div>`
      )
      .join("") || `<div class="log-empty">No hay errores registrados.</div>`

  // El orden de las filas pintadas es el mismo que el de "list": cada fila
  // se empareja con su evento por posición, sin necesitar un id del backend.
  els.logTable.querySelectorAll(".log-row").forEach((row, i) => {
    const ev = list[i]
    row.addEventListener("click", (evt) => {
      if (!evt.target.closest("button")) {
        row.classList.toggle("expanded")
      }
    })
    row.querySelector(".log-row-copy").addEventListener("click", (evt) => {
      evt.stopPropagation()
      const btn = evt.currentTarget
      const text = `[${fmtTime(new Date(ev.time))}] ${ev.message}`
      const flash = (icon, title) => {
        btn.innerHTML = icon
        btn.title = title
        setTimeout(() => {
          btn.innerHTML = COPY_ICON
          btn.title = "Copiar mensaje"
        }, 1200)
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => flash(COPY_DONE_ICON, "¡Copiado!"))
          .catch(() => flash(COPY_ICON, "No se pudo copiar"))
      } else {
        flash(COPY_ICON, "No se pudo copiar")
      }
    })
  })
}

function wireLogPanel() {
  els.logSearch.addEventListener("input", renderLogPanel)
}

// quiet:true evita mostrar en pantalla el error de un refresco periódico o de fondo.
async function refreshStatus({ quiet = false } = {}) {
  try {
    const status = await callCommand("status")
    applyLimits(status.limits)
    // Refleja si el servidor está reproduciendo audio en este momento.
    els.statusDot.classList.toggle("playing", status.speaking)
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
    if (!serverConnected) {
      serverConnected = true
      notify("ok", "Conexión con el servidor recuperada.", "status")
    }
  } catch (err) {
    if (serverConnected) {
      serverConnected = false
      notifyError("status", err)
    }
    if (quiet) return
    els.statusDot.classList.remove("playing")
    els.status.textContent = "Sin conexión con el servidor."
  }
}

// Pestañas: "General" (reproducción + preferencias), "Voces" (catálogo),
// "Avisos" (bandeja de notificaciones) y "Registros" (histórico completo,
// antes un modal aparte). selectTab() vive a este nivel (no solo dentro de
// wireTabs) porque el botón "Ver panel de registros completo" de Avisos
// también necesita cambiar de pestaña. "logs" no tiene botón propio en la
// barra superior: solo se llega desde "Ver panel de registros completo" en
// Avisos, pero al entrar se comporta igual que un tab más (deselecciona los
// de arriba y ocupa la pantalla).
const tabPanels = { general: "panelGeneral", voces: "panelVoces", avisos: "panelAvisos", logs: "panelLogs" }
const tabButtons = { general: "tabGeneral", voces: "tabVoces", avisos: "tabAvisos" }

function selectTab(tab) {
  for (const key of Object.keys(tabPanels)) {
    els[tabPanels[key]].hidden = key !== tab
  }
  for (const key of Object.keys(tabButtons)) {
    els[tabButtons[key]].classList.toggle("active", key === tab)
  }
  // "Voz actual" + "Probar voz" son comunes a General y Voces, pero no
  // pintan nada en Avisos ni en Registros.
  els.voiceTop.hidden = tab === "avisos" || tab === "logs"
  if (tab === "avisos") {
    markNotificationsRead()
  }
  if (tab === "logs") {
    refreshDebugLog()
  }
}

function wireTabs() {
  els.tabGeneral.addEventListener("click", () => selectTab("general"))
  els.tabVoces.addEventListener("click", () => selectTab("voces"))
  els.tabAvisos.addEventListener("click", () => selectTab("avisos"))
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
  els.voiceList.innerHTML = `<p class="voice-list-empty">No hay catálogo de voces descargado todavía. Usa el botón de arriba para descargarlo.</p>`
}

// "Descargadas" (segDownloaded) | "Catálogo" (segCatalog): reemplaza al antiguo
// checkbox "Solo descargadas". Se guarda aquí, no en el DOM, porque ahora son
// dos botones de un segmentado en vez de un único input.
let onlyDownloaded = true

function renderVoiceList(entries, { currentVoice, downloadedIds, downloadingIds, truncatedCount }) {
  if (entries.length === 0) {
    els.voiceList.innerHTML = `<p class="voice-list-empty">${
      onlyDownloaded
        ? "No hay ninguna voz descargada todavía. Pasa a “Catálogo” para buscar y descargar una."
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
        action = `<button type="button" class="btn-primary" disabled>En uso</button>`
      } else if (isDownloading) {
        action = `<button type="button" class="btn-primary" disabled>Descargando…</button>`
      } else if (isDownloaded) {
        action = `<button type="button" class="btn-primary" data-action="use" data-voice-id="${escapeHtml(v.id)}">Usar</button>`
      } else {
        action = `<button type="button" class="btn-secondary" data-action="download" data-voice-id="${escapeHtml(v.id)}">Descargar</button>`
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

function matchesQuery(v, q) {
  return (
    !q ||
    v.id.toLowerCase().includes(q) ||
    (v.language || "").toLowerCase().includes(q) ||
    (v.language_name || "").toLowerCase().includes(q)
  )
}

async function refreshVoicesPanel() {
  const includeCatalog = !onlyDownloaded

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
  const q = els.voiceFilter.value.trim().toLowerCase()

  let entries = []
  let truncatedCount = 0
  if (includeCatalog && data.catalog) {
    const filtered = data.catalog.filter((v) => matchesQuery(v, q))
    entries = filtered
      .slice(0, CATALOG_LIST_LIMIT)
      .map((v) => ({ ...v, sizeMb: sizeById.get(v.id) ?? null }))
    truncatedCount = filtered.length - entries.length
  } else {
    // El buscador es el mismo campo en las dos vistas: también filtra "Descargadas".
    entries = data.downloaded.filter((v) => matchesQuery(v, q)).map((v) => ({ id: v.id, sizeMb: v.sizeMb }))
  }

  renderVoiceList(entries, { currentVoice: data.currentVoice, downloadedIds, downloadingIds, truncatedCount })
}

let voiceFilterDebounce = null

function wireVoicesPanel() {
  function selectSegment(seg) {
    onlyDownloaded = seg === "downloaded"
    els.segDownloaded.classList.toggle("active", onlyDownloaded)
    els.segCatalog.classList.toggle("active", !onlyDownloaded)
    refreshVoicesPanel()
  }

  els.segDownloaded.addEventListener("click", () => selectSegment("downloaded"))
  els.segCatalog.addEventListener("click", () => selectSegment("catalog"))

  els.voiceFilter.addEventListener("input", () => {
    clearTimeout(voiceFilterDebounce)
    voiceFilterDebounce = setTimeout(refreshVoicesPanel, 200)
  })

  // La app nunca toca la red para el catálogo sola: este botón es el único disparador.
  els.refreshCatalogBtn.addEventListener("click", () => {
    els.refreshCatalogBtn.disabled = true
    els.refreshCatalogBtn.classList.add("spinning")
    callCommand("refreshVoiceCatalog")
      .then(() => notify("ok", "Catálogo de voces actualizado.", "refreshVoiceCatalog"))
      .catch((err) => notifyError("refreshVoiceCatalog", err))
      .finally(() => {
        els.refreshCatalogBtn.disabled = false
        els.refreshCatalogBtn.classList.remove("spinning")
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
      .then(() =>
        notify(
          "ok",
          action === "use" ? `Voz activada: ${voiceId}` : `Voz descargada: ${voiceId}`,
          action === "use" ? "setVoice" : "downloadVoice"
        )
      )
      .catch((err) => notifyError(action === "use" ? "setVoice" : "downloadVoice", err))
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
    window.native.openDevtools().catch((err) => notifyError("openDevtools", err))
  )

  els.notification.addEventListener("change", () =>
    callCommand("setNotification", { enabled: els.notification.checked }).catch((err) => notifyError("setNotification", err))
  )

  els.speed.addEventListener("input", () => {
    els.speedValue.textContent = `${els.speed.value}x`
  })
  els.speed.addEventListener("change", () =>
    callCommand("setSpeed", { speed: Number(els.speed.value) }).catch((err) => notifyError("setSpeed", err))
  )

  els.volume.addEventListener("input", () => {
    els.volumeValue.textContent = `${els.volume.value}%`
    // limits es null hasta el primer status; sin límites no se marca "danger".
    if (limits) els.volumeValue.classList.toggle("danger", Number(els.volume.value) > limits.dangerZoneVolume)
  })
  els.volume.addEventListener("change", () =>
    // allow_overdrive:true porque es el usuario moviendo el slider, no una llamada externa.
    callCommand("setVolume", { volume: Number(els.volume.value), allow_overdrive: true }).catch((err) => notifyError("setVolume", err))
  )

  // Texto usado si el campo de prueba está vacío (speak rechaza texto vacío).
  const DEFAULT_SPEAK_TEXT = "Hola, así sueno ahora mismo."

  function runSpeakTest() {
    const text = els.speakTestText.value.trim() || DEFAULT_SPEAK_TEXT
    // speak es fire-and-forget: se refresca el estado fuera de turno
    // para no esperar al siguiente tick del poll.
    callCommand("speak", { text })
      .then(() => refreshStatus({ quiet: true }))
      .catch((err) => notifyError("speak", err))
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
      .catch((err) => notifyError("stop", err))
  })

  els.autostart.addEventListener("change", () =>
    window.native.setAutostart(els.autostart.checked).catch((err) => notifyError("setAutostart", err))
  )
}

document.addEventListener("DOMContentLoaded", async () => {
  wireControls()
  wireTabs()
  wireVoicesPanel()
  wireAvisosPanel()
  wireLogPanel()
  renderNotifList()
  await initAutostartRow()
  await refreshStatus()
  await refreshVoicesPanel()
  // Refresca el estado y el panel de voces cada segundo (el catálogo es JSON local, no red).
  // El registro de errores solo se refresca si esa pestaña está abierta.
  setInterval(() => {
    refreshStatus({ quiet: true })
    refreshVoicesPanel()
    if (!els.panelLogs.hidden) {
      refreshDebugLog()
    }
  }, 1000)
})
