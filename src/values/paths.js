import path from "node:path"
import { fileURLToPath } from "node:url"

// Rutas de datos de la app
const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

export const DATA_DIR = path.join(APP_ROOT, "data")
export const SETTINGS_FILE = path.join(DATA_DIR, "settings.json")
export const VOICES_DIR = path.join(DATA_DIR, "voices")
export const CACHE_DIR = path.join(DATA_DIR, "cache")
export const VOICES_CATALOG_CACHE = path.join(CACHE_DIR, "voices.json")

// Perfil del webview de la ventana de ajustes, separado del resto de DATA_DIR.
export const WEBVIEW_PROFILE_DIR = path.join(DATA_DIR, "webview-profile")

// Iconos de la bandeja y de la app.
export const RESOURCES_DIR = path.join(APP_ROOT, "resources")

// HTML/CSS/JS de la ventana de ajustes.
export const FRONTEND_DIR = path.join(APP_ROOT, "frontend")

// Registro de errores del servidor de audio, usado por piper_status para
// diagnosticar fallos silenciosos.
export const LAST_ERROR_LOG = path.join(DATA_DIR, "last-error.log")
