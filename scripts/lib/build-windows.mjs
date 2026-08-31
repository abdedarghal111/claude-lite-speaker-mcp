// Build para Windows: prepara la copia con las dependencias mínimas y la compila con
// deno, que le pone el icono y le quita la consola.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createStaging, removeStaging } from "./staging.mjs"

// Arquitecturas de Windows: target de deno y binarios nativos que se quedan dentro.
const TARGETS = {
    x64: { deno: "x86_64-pc-windows-msvc", onnxBin: "win32/x64", nativeSuffix: "win32-x64-msvc" },
    arm64: { deno: "aarch64-pc-windows-msvc", onnxBin: "win32/arm64", nativeSuffix: "win32-arm64-msvc" },
}

export const WINDOWS_ARCHS = Object.keys(TARGETS)

export function buildWindows({ executableName, appRoot, contents, entry, allowTerminal, arch }) {
    const target = TARGETS[arch]
    if (!target) {
        throw new Error(`Arquitectura "${arch}" desconocida para Windows. Opciones: ${WINDOWS_ARCHS.join(", ")}.`)
    }

    const stagingDir = createStaging({ appRoot, contents, onnxBin: target.onnxBin, nativeSuffix: target.nativeSuffix })

    const outDir = path.join(appRoot, "out", `windows-${arch}`)
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
            "--icon", path.join(appRoot, "res", "icons", "appIcon.ico"),
            // Sin esto el ejecutable abre una consola detrás de la app.
            ...(allowTerminal ? [] : ["--no-terminal"]),
            ...contents.flatMap((item) => ["--include", item]),
            entry,
        ],
        { stdio: "inherit", cwd: stagingDir }
    )

    // deno le pone la extensión .exe al compilar para Windows.
    const outfile = `${binary}.exe`
    if (!fs.existsSync(outfile)) {
        throw new Error(`No se generó ${outfile}.`)
    }

    removeStaging(appRoot)
    return outfile
}
