// TODO: probar ejecutable de mac para ver si compila bien y si todo está ok 
// https://github.com/abdedarghal111/claude-lite-speaker-mcp/issues/14
// Build para macOS: prepara la copia con las dependencias mínimas, la compila con
// deno y la mete en un bundle .app con su icono, su Info.plist y su firma.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { build as buildPlist } from "plist"
import { createICNS, BICUBIC } from "png2icons"
import { createStaging, removeStaging } from "./staging.mjs"

const BUNDLE_ID = "com.claudeliteSpeaker.trayapp"

// Arquitecturas de macOS: target de deno y binarios nativos que se quedan dentro.
const TARGETS = {
    x64: { deno: "x86_64-apple-darwin", onnxBin: "darwin/x64", nativeSuffix: "darwin-x64" },
    arm64: { deno: "aarch64-apple-darwin", onnxBin: "darwin/arm64", nativeSuffix: "darwin-arm64" },
}

export const MAC_ARCHS = Object.keys(TARGETS)

export function buildMac({ appName, executableName, appRoot, contents, entry, arch }) {
    const target = TARGETS[arch]
    if (!target) {
        throw new Error(`Arquitectura "${arch}" desconocida para macOS. Opciones: ${MAC_ARCHS.join(", ")}.`)
    }

    const stagingDir = createStaging({ appRoot, contents, onnxBin: target.onnxBin, nativeSuffix: target.nativeSuffix })

    const outDir = path.join(appRoot, "out", `mac-${arch}`)
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

    // macOS espera el nombre y el icono dentro de un bundle .app.
    const bundleDir = path.join(outDir, `${appName}.app`)
    const contentsDir = path.join(bundleDir, "Contents")
    const macosDir = path.join(contentsDir, "MacOS")
    const resourcesDir = path.join(contentsDir, "Resources")

    fs.rmSync(bundleDir, { recursive: true, force: true })
    fs.mkdirSync(macosDir, { recursive: true })
    fs.mkdirSync(resourcesDir, { recursive: true })

    // El ejecutable va dentro del bundle.
    const outfile = path.join(macosDir, executableName)
    fs.renameSync(binary, outfile)
    fs.chmodSync(outfile, 0o755)

    // El icono del bundle es un .icns, generado desde el png.
    const iconPng = path.join(appRoot, "res", "icons", "appIcon.png")
    fs.writeFileSync(path.join(resourcesDir, "appIcon.icns"), createICNS(fs.readFileSync(iconPng), BICUBIC, 0))

    // El Info.plist es lo que le da nombre, versión e icono a la app.
    const version = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8")).version
    fs.writeFileSync(
        path.join(contentsDir, "Info.plist"),
        buildPlist({
            CFBundleName: appName,
            CFBundleDisplayName: appName,
            CFBundleIdentifier: BUNDLE_ID,
            CFBundleVersion: version,
            CFBundleShortVersionString: version,
            CFBundleExecutable: executableName,
            CFBundleIconFile: "appIcon.icns",
            CFBundlePackageType: "APPL",
            NSHighResolutionCapable: true,
        })
    )

    // Sin firma Gatekeeper puede negarse a abrir la app, y codesign solo existe en macOS.
    if (process.platform === "darwin") {
        execFileSync("codesign", ["--sign", "-", bundleDir], { stdio: "inherit" })
    } else {
        console.log(`[build] aviso: sin firmar, hay que pasarle codesign en un Mac antes de distribuirla.`)
    }

    removeStaging(appRoot)
    return bundleDir
}
