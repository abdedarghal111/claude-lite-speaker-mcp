// Simula la raíz del ejecutable
// solo deben crearse rutas a ficheros externos al código (datos, recursos, etc)
// nunca a módulos del programa porque no existirán en el momento de compilar
// y como consecuencia por eso vive en la raíz del código este archivo.
import path from "node:path"
import { isSea } from "node:sea"
import { fileURLToPath } from "node:url"

// El código sale siempre del disco; los datos van junto al ejecutable.
const CODE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
export const APP_ROOT = isSea() ? path.dirname(process.execPath) : CODE_ROOT

export const DATA_DIR = path.join(APP_ROOT, "data")
export const SETTINGS_FILE = path.join(DATA_DIR, "settings.json")
export const VOICES_DIR = path.join(DATA_DIR, "voices")
export const CACHE_DIR = path.join(DATA_DIR, "cache")
export const VOICES_CATALOG_CACHE = path.join(CACHE_DIR, "voices.json")

// Perfil del webview, aparte del resto de datos.
export const WEBVIEW_PROFILE_DIR = path.join(DATA_DIR, "webview-profile")

// Iconos de la bandeja y de la app.
export const RESOURCES_DIR = path.join(CODE_ROOT, "res")

// HTML/CSS/JS de la ventana de ajustes.
export const FRONTEND_DIR = path.join(CODE_ROOT, "frontend")

// Log de errores de la app.
export const ERROR_LOG_FILE = path.join(DATA_DIR, "error.log")
