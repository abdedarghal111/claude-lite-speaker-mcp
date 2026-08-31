// TODO: probar ejecutable de linux para ver si compila bien y si todo está ok
// https://github.com/abdedarghal111/claude-lite-speaker-mcp/issues/13
// Build para Linux: prepara la copia con las dependencias mínimas, la compila con
// deno y deja al lado el icono y el .desktop, que Linux no incrusta.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createStaging, removeStaging } from "./staging.mjs"

// Arquitecturas de Linux: target de deno y binarios nativos que se quedan dentro.
const TARGETS = {
    x64: { deno: "x86_64-unknown-linux-gnu", onnxBin: "linux/x64", nativeSuffix: "linux-x64-gnu" },
    arm64: { deno: "aarch64-unknown-linux-gnu", onnxBin: "linux/arm64", nativeSuffix: "linux-arm64-gnu" },
}

export const LINUX_ARCHS = Object.keys(TARGETS)

export function buildLinux({ appName, executableName, appRoot, contents, entry, arch }) {
    const target = TARGETS[arch]
    if (!target) {
        throw new Error(`Arquitectura "${arch}" desconocida para Linux. Opciones: ${LINUX_ARCHS.join(", ")}.`)
    }

    const stagingDir = createStaging({ appRoot, contents, onnxBin: target.onnxBin, nativeSuffix: target.nativeSuffix })

    const outDir = path.join(appRoot, "out", `linux-${arch}`)
    fs.mkdirSync(outDir, { recursive: true })
    const binary = path.join(outDir, executableName)

    // El instalador de deno no modifica el PATH de la sesión en curso.
    const denoLocal = path.join(os.homedir(), ".deno", "bin", process.platform === "win32" ? "deno.exe" : "deno")
    const deno = fs.existsSync(denoLocal) ? denoLocal : "deno"

    // Compila el ejecutable.
    execFileSync(
        deno,
        [
            "compile",
            "--target", target.deno,
            "--output", binary,
            // La app no tiene consola donde pedir permisos en ejecución.
            "--allow-all",
            // Es JavaScript y no trae @types/node.
            "--no-check",
            // Usa el node_modules de la copia, sin reinstalar.
            "--node-modules-dir=manual",
            ...contents.flatMap((item) => ["--include", item]),
            entry,
        ],
        { stdio: "inherit", cwd: stagingDir }
    )

    if (!fs.existsSync(binary)) {
        throw new Error(`No se generó ${binary}.`)
    }
    fs.chmodSync(binary, 0o755)

    // Linux no incrusta el icono en el ejecutable.
    const iconOut = path.join(outDir, "appIcon.png")
    fs.copyFileSync(path.join(appRoot, "res", "icons", "appIcon.png"), iconOut)

    // Las rutas del .desktop son absolutas: solo valen mientras el fichero siga junto al binario.
    const toPosix = (route) => route.split(path.sep).join("/")
    const desktopEntry =
        `[Desktop Entry]\n` +
        `Type=Application\n` +
        `Name=${appName}\n` +
        `Exec=${toPosix(binary)}\n` +
        `Icon=${toPosix(iconOut)}\n` +
        `Terminal=false\n`
    fs.writeFileSync(path.join(outDir, `${executableName}.desktop`), desktopEntry)

    removeStaging(appRoot)
    return binary
}
