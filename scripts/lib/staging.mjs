// Copia del proyecto desde la que se compila, con las dependencias mínimas.
// deno compile empaqueta el node_modules que encuentra, y el del proyecto trae las
// dependencias de desarrollo y los binarios de las seis plataformas.
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

// Borra los binarios nativos que no son de este target.
function pruneForeignBinaries(dir, onnxBin, nativeSuffix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        const posix = full.split(path.sep).join("/")

        // onnxruntime-node reparte sus binarios en bin/napi-v6/<sistema>/<arch>.
        const onnx = posix.match(/\/bin\/napi-v6\/([^/]+\/[^/]+)$/)
        if (onnx) {
            if (onnx[1] !== onnxBin) {
                fs.rmSync(full, { recursive: true, force: true })
            }
            continue
        }

        // El resto de paquetes nombran la plataforma en el propio .node.
        const isForeign =
            entry.name.endsWith(".node") &&
            ["darwin", "linux", "win32"].some((token) => entry.name.includes(token)) &&
            !entry.name.includes(nativeSuffix)
        if (isForeign) {
            fs.rmSync(full, { force: true })
            continue
        }

        if (entry.isDirectory()) {
            pruneForeignBinaries(full, onnxBin, nativeSuffix)
        }
    }
}

// Monta la copia y devuelve su ruta, que es desde donde hay que compilar.
export function createStaging({ appRoot, contents, onnxBin, nativeSuffix }) {
    const stagingDir = path.join(appRoot, "out", "staging")
    const modulesDir = path.join(stagingDir, "node_modules")

    fs.rmSync(stagingDir, { recursive: true, force: true })
    fs.mkdirSync(stagingDir, { recursive: true })

    // Copia lo que va dentro del ejecutable, con el lock para instalar las mismas versiones.
    for (const entry of [...contents, "package.json", "pnpm-lock.yaml"]) {
        fs.cpSync(path.join(appRoot, entry), path.join(stagingDir, entry), { recursive: true })
    }

    // El node_modules del proyecto son enlaces al store de pnpm, así que aquí se
    // instala uno plano, solo de producción y sin postinstall.
    execSync("pnpm install --prod --ignore-workspace --node-linker=hoisted --ignore-scripts", {
        stdio: "inherit",
        cwd: stagingDir,
    })

    // Fuera los binarios de las demás plataformas.
    pruneForeignBinaries(modulesDir, onnxBin, nativeSuffix)

    // Sin los binarios de este target el ejecutable se genera igual, pero no arranca.
    const missing = [
        path.join(modulesDir, "@webviewjs", `webview-${nativeSuffix}`),
        path.join(modulesDir, "onnxruntime-node", "bin", "napi-v6", ...onnxBin.split("/")),
    ].filter((entry) => !fs.existsSync(entry))
    if (missing.length > 0) {
        throw new Error(`Faltan binarios nativos del target:\n  ${missing.join("\n  ")}`)
    }

    return stagingDir
}

// Borra la copia una vez compilado el ejecutable.
export function removeStaging(appRoot) {
    fs.rmSync(path.join(appRoot, "out", "staging"), { recursive: true, force: true })
}
