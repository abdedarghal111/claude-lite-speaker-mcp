import path from "node:path";
import { fileURLToPath } from "node:url";

// Rutas de datos de la app
const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const DATA_DIR = path.join(APP_ROOT, "data");
export const STATE_FILE = path.join(DATA_DIR, "state.json");
export const VOICES_DIR = path.join(DATA_DIR, "voices");
export const CACHE_DIR = path.join(DATA_DIR, "cache");
export const VOICES_CATALOG_CACHE = path.join(CACHE_DIR, "voices.json");

// Registro de errores del servidor de audio, usado por piper_status para
// diagnosticar fallos silenciosos.
export const LAST_ERROR_LOG = path.join(DATA_DIR, "last-error.log");
