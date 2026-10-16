// Deja en external-deps/sdl3/<plataforma>-<arch>/ la librería de SDL3, solo con audio, que carga
// src/lib/sdl3.js. Se compila desde el código fuente de la release con CMake en los tres
// sistemas. Si ya está la de esta versión, no hace nada; con --force la vuelve a generar.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { SDL_VERSION, SDL_LIBRARY_FILES } from "../src/values/constants.js"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const TARGET = `${process.platform}-${process.arch}`
const OUT_DIR = path.join(ROOT, "external-deps", "sdl3", TARGET)
const WORK_DIR = path.join(ROOT, ".build", "sdl3", `${SDL_VERSION}-${TARGET}`)
const LIBRARY_FILE = SDL_LIBRARY_FILES[process.platform]
const STAMP_FILE = path.join(OUT_DIR, "VERSION")

const RELEASE_URL = `https://github.com/libsdl-org/SDL/releases/download/release-${SDL_VERSION}`

// Hash del código fuente de la release, para no compilar algo cambiado. Al subir
// SDL_VERSION hay que actualizarlo.
const SOURCE_ARCHIVE = `SDL3-${SDL_VERSION}.tar.gz`
const SOURCE_SHA256 = "9c75cf16330322c217dedd2e0609f1124f1b54b8633e763467b4684d0f4334a3"

// Todo lo que no sea audio queda fuera: la librería pesa menos y no pide X11 ni Wayland.
const CMAKE_OPTIONS = [
    "-DCMAKE_BUILD_TYPE=Release",
    "-DSDL_SHARED=ON",
    "-DSDL_STATIC=OFF",
    "-DSDL_TESTS=OFF",
    "-DSDL_INSTALL=OFF",
    "-DSDL_UNIX_CONSOLE_BUILD=ON",
    "-DSDL_VIDEO=OFF",
    "-DSDL_RENDER=OFF",
    "-DSDL_GPU=OFF",
    "-DSDL_CAMERA=OFF",
    "-DSDL_JOYSTICK=OFF",
    "-DSDL_HAPTIC=OFF",
    "-DSDL_HIDAPI=OFF",
    "-DSDL_SENSOR=OFF",
    "-DSDL_POWER=OFF",
    "-DSDL_DIALOG=OFF",
    "-DSDL_TRAY=OFF",
    // JACK pide siempre dos canales y no sabe abrir una salida mono (ver issue #27).
    "-DSDL_JACK=OFF",
    // En Windows, sin la librería de C de Visual Studio: así la DLL no pide que el equipo
    // tenga instalado su runtime (vcruntime140.dll), igual que la DLL oficial.
    ...(process.platform === "win32" ? ["-DSDL_LIBC=OFF"] : []),
]

function log(message) {
    console.log(`[build-sdl] ${message}`)
}

function run(command, args, options = {}) {
    execFileSync(command, args, { stdio: "inherit", ...options })
}

// Descarga el código fuente de la release en WORK_DIR y comprueba su hash.
async function downloadSource() {
    const file = path.join(WORK_DIR, SOURCE_ARCHIVE)
    if (!fs.existsSync(file)) {
        log(`Descargando ${SOURCE_ARCHIVE}…`)
        const response = await fetch(`${RELEASE_URL}/${SOURCE_ARCHIVE}`)
        if (!response.ok) {
            throw new Error(`No se pudo descargar ${SOURCE_ARCHIVE}: HTTP ${response.status}`)
        }
        fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()))
    }
    const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
    if (hash !== SOURCE_SHA256) {
        fs.rmSync(file)
        throw new Error(`El hash de ${SOURCE_ARCHIVE} no coincide (${hash}); se ha borrado la descarga.`)
    }
    return file
}

// Compila la librería desde el código fuente y devuelve su ruta.
async function buildFromSource() {
    try {
        execFileSync("cmake", ["--version"], { stdio: "ignore" })
    } catch {
        throw new Error("Hace falta CMake para compilar SDL3. Instálalo y vuelve a lanzar el build.")
    }
    const archive = await downloadSource()
    const sourceDir = path.join(WORK_DIR, `SDL3-${SDL_VERSION}`)
    const buildDir = path.join(WORK_DIR, "build")
    if (!fs.existsSync(sourceDir)) {
        // En Windows también vale: su tar (bsdtar, de Windows 10 en adelante) abre .tar.gz.
        // Con ruta relativa, porque el tar de GNU confunde "C:" con un servidor remoto.
        run("tar", ["-xzf", path.basename(archive)], { cwd: WORK_DIR })
    }
    log("Compilando SDL3 (solo audio)…")
    run("cmake", ["-S", sourceDir, "-B", buildDir, ...CMAKE_OPTIONS])
    run("cmake", ["--build", buildDir, "--config", "Release", "--parallel"])

    // Los generadores de Visual Studio dejan cada configuración en su propia carpeta
    // (build/Release/); Ninja y Make, en la raíz de build/.
    const built = [path.join(buildDir, "Release", LIBRARY_FILE), path.join(buildDir, LIBRARY_FILE)].find((file) =>
        fs.existsSync(file),
    )
    if (!built) {
        throw new Error(`CMake terminó, pero no aparece ${LIBRARY_FILE} en ${buildDir}.`)
    }
    return built
}

async function main() {
    if (!LIBRARY_FILE) {
        throw new Error(`Plataforma sin soporte: ${process.platform}`)
    }
    const force = process.argv.includes("--force")
    const outFile = path.join(OUT_DIR, LIBRARY_FILE)
    const installed = fs.existsSync(STAMP_FILE) ? fs.readFileSync(STAMP_FILE, "utf8").trim() : null
    if (!force && fs.existsSync(outFile) && installed === SDL_VERSION) {
        log(`SDL3 ${SDL_VERSION} ya está en ${path.relative(ROOT, OUT_DIR)}.`)
        return
    }

    fs.mkdirSync(WORK_DIR, { recursive: true })
    const built = await buildFromSource()

    fs.rmSync(OUT_DIR, { recursive: true, force: true })
    fs.mkdirSync(OUT_DIR, { recursive: true })
    // copyFileSync sigue los enlaces simbólicos: se copia la librería real con el nombre
    // con el que se carga.
    fs.copyFileSync(built, outFile)
    if (process.platform === "linux") {
        try {
            execFileSync("strip", ["--strip-unneeded", outFile])
        } catch {
            log("strip no está disponible; la librería se queda con sus símbolos.")
        }
    }
    fs.writeFileSync(STAMP_FILE, `${SDL_VERSION}\n`)
    log(`SDL3 ${SDL_VERSION} listo en ${path.relative(ROOT, outFile)}.`)
}

main().catch((err) => {
    console.error(`[build-sdl] ${err.message}`)
    process.exit(1)
})
