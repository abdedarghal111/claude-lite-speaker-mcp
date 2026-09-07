// Simula la raíz del ejecutable
// solo deben crearse rutas a ficheros externos al código (datos, recursos, etc)
// nunca a módulos del programa porque no existirán en el momento de compilar
// y como consecuencia por eso vive en la raíz del código este archivo.
import path from "node:path"
import { fileURLToPath } from "node:url"
import { app } from "electron"

// El código sale siempre del disco; los datos, del perfil del usuario.
const CODE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

// Instalada, la app queda en una ruta de solo lectura. Desde "appData" y no "userData",
// que es esta misma carpeta, porque main.js lo reapunta al perfil de sesión.
export const DATA_DIR = path.join(app.getPath("appData"), app.getName())
export const SETTINGS_FILE = path.join(DATA_DIR, "settings.json")
export const VOICES_DIR = path.join(DATA_DIR, "voices")
export const CACHE_DIR = path.join(DATA_DIR, "cache")
export const VOICES_CATALOG_CACHE = path.join(CACHE_DIR, "voices.json")

// Perfil de sesión de la ventana (cookies, storage…), aparte del resto de datos.
export const SESSION_PROFILE_DIR = path.join(DATA_DIR, "session-profile")

// Iconos de la bandeja y de la app.
export const RESOURCES_DIR = path.join(CODE_ROOT, "res")

// HTML/CSS/JS de la ventana de ajustes.
export const FRONTEND_DIR = path.join(CODE_ROOT, "frontend")

// Puente entre la ventana y el proceso principal (ver preload.cjs).
export const PRELOAD_FILE = path.join(CODE_ROOT, "src", "preload.cjs")

// Log de errores de la app.
export const ERROR_LOG_FILE = path.join(DATA_DIR, "error.log")
