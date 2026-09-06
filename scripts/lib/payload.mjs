// Lo que acompaña al ejecutable en la carpeta de trabajo: el código, los recursos y
// las dependencias. El SEA de Node solo lleva dentro el script de arranque, así que
// todo esto -y en especial los binarios nativos, que se cargan con dlopen desde el
// disco- tiene que quedar junto al ejecutable para que la app arranque.
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

// Deja el directorio listo para recibir el ejecutable al lado.
export function createPayload({ appRoot, payloadDir, contents, onnxBin, nativeSuffix }) {
    const modulesDir = path.join(payloadDir, "node_modules")

    fs.rmSync(payloadDir, { recursive: true, force: true })
    fs.mkdirSync(payloadDir, { recursive: true })

    // El código y los recursos, con el package.json -que marca el proyecto como ESM,
    // y sin él no se cargaría ni main.js- y el lock, para instalar las mismas versiones.
    for (const entry of [...contents, "package.json", "pnpm-lock.yaml"]) {
        fs.cpSync(path.join(appRoot, entry), path.join(payloadDir, entry), { recursive: true })
    }

    // El node_modules del proyecto son enlaces al store de pnpm, así que aquí se
    // instala uno plano, solo de producción y sin postinstall.
    execSync("pnpm install --prod --ignore-workspace --node-linker=hoisted --ignore-scripts", {
        stdio: "inherit",
        cwd: payloadDir,
    })

    // Fuera los binarios de las demás plataformas.
    pruneForeignBinaries(modulesDir, onnxBin, nativeSuffix)

    // El lock y los apuntes de pnpm solo hacían falta para el install de arriba:
    // en la carpeta que se reparte no los lee nadie.
    for (const leftover of [
        path.join(payloadDir, "pnpm-lock.yaml"),
        path.join(modulesDir, ".modules.yaml"),
        path.join(modulesDir, ".package-map.json"),
        path.join(modulesDir, ".pnpm-workspace-state-v1.json"),
    ]) {
        fs.rmSync(leftover, { recursive: true, force: true })
    }

    // Sin los binarios de este target el ejecutable se genera igual, pero no arranca.
    const missing = [
        path.join(modulesDir, "@webviewjs", `webview-${nativeSuffix}`),
        path.join(modulesDir, "onnxruntime-node", "bin", "napi-v6", ...onnxBin.split("/")),
    ].filter((entry) => !fs.existsSync(entry))
    if (missing.length > 0) {
        throw new Error(`Faltan binarios nativos del target:\n  ${missing.join("\n  ")}`)
    }
}
