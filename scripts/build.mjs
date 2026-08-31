#!/usr/bin/env node
// Script de build, construye el ejecutable de la aplicación para la plataforma actual 
// o para todas las plataformas si se le indica.
//
// Uso: node scripts/build.mjs                    (el sistema y arquitectura de esta máquina)
//      node scripts/build.mjs --build-all        (todos los sistemas y arquitecturas)
//      node scripts/build.mjs --clean-up         (borra la carpeta out y no compila nada)
//      node scripts/build.mjs --allow-terminal   (deja la consola, para ver los errores)
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { LINUX_ARCHS, buildLinux } from "./lib/build-linux.mjs"
import { MAC_ARCHS, buildMac } from "./lib/build-mac.mjs"
import { WINDOWS_ARCHS, buildWindows } from "./lib/build-windows.mjs"

const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

// Datos generales
const COMMON = {
    appName: "Claude Lite Speaker",
    executableName: "claude-lite-speaker",
    appRoot: APP_ROOT,
    contents: ["src", "res", "frontend"],
    entry: "src/main.js",
    allowTerminal: process.argv.includes("--allow-terminal"),
}

// Borra todo lo generado por builds anteriores y termina.
if (process.argv.includes("--clean-up")) {
    const outRoot = path.join(APP_ROOT, "out")
    fs.rmSync(outRoot, { recursive: true, force: true })
    console.log(`[build] borrado: ${outRoot}`)
    process.exit(0)
}

const outfiles = []
if (process.argv.includes("--build-all")) {

    for (const arch of WINDOWS_ARCHS) {
        outfiles.push(buildWindows({ ...COMMON, arch }))
    }
    for (const arch of MAC_ARCHS) {
        outfiles.push(buildMac({ ...COMMON, arch }))
    }
    for (const arch of LINUX_ARCHS) {
        outfiles.push(buildLinux({ ...COMMON, arch }))
    }

} else {

    // El sistema y la arquitectura de la máquina que lanza el build.
    const build = { win32: buildWindows, darwin: buildMac }[process.platform] ?? buildLinux
    const arch = process.arch === "arm64" ? "arm64" : "x64"
    outfiles.push(build({ ...COMMON, arch }))
    
}

console.log(`[build] listo:\n  ${outfiles.join("\n  ")}`)
