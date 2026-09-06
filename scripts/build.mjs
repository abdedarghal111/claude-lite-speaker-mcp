#!/usr/bin/env node
// Script de build, construye el ejecutable de la aplicación para el sistema de la
// máquina que lo lanza, siempre en x64. No hay compilación cruzada: el ejecutable lo
// genera Node con "--build-sea" a partir de sea-config.json, y sale del binario del
// propio Node que ejecuta este script.
//
// Lo que se genera de paso -el ejecutable pelado y la carpeta que luego se comprime-
// se queda en .build, y en out solo acaba el zip, que es lo único que se reparte.
//
// Uso: node scripts/build.mjs                    (el sistema de esta máquina)
//      node scripts/build.mjs --clean            (borra la carpeta .build y no compila nada)
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { postbuildLinux } from "./lib/postbuild-linux.mjs"
import { postbuildMac } from "./lib/postbuild-mac.mjs"
import { postbuildWindows } from "./lib/postbuild-windows.mjs"

const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
// La carpeta de trabajo del build: se puede borrar entera sin perder nada.
const BUILD_ROOT = path.join(APP_ROOT, ".build")

// Datos generales
const COMMON = {
    appName: "Claude Lite Speaker",
    executableName: "claude-lite-speaker",
    appRoot: APP_ROOT,
    buildRoot: BUILD_ROOT,
    contents: ["src", "res", "frontend"],
}

// Tira la carpeta de trabajo y termina. Los zips de out no se tocan: son el resultado
// del build, no restos suyos.
if (process.argv.includes("--clean")) {
    fs.rmSync(BUILD_ROOT, { recursive: true, force: true })
    console.log(`[build] borrado: ${BUILD_ROOT}`)
    process.exit(0)
}

// El ejecutable sale del Node que corre aquí, así que su arquitectura es la de esta
// máquina; en una que no sea x64 no coincidiría con los binarios nativos que se copian.
if (process.arch !== "x64") {
    throw new Error(`Solo se compila para x64, y esta máquina es ${process.arch}.`)
}

// Todas las opciones del ejecutable están en sea-config.json, incluida la ruta donde
// lo deja, que las rutas de dentro son relativas a la raíz de la app.
const seaConfig = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "sea-config.json"), "utf8"))
const seaBuild = path.join(APP_ROOT, seaConfig.output)
// useCodeCache rompería el arranque: el script inyectado llega a main.js con un
// import(), y la caché de código de V8 no admite importaciones dinámicas.
if (seaConfig.useCodeCache) {
    throw new Error("useCodeCache tiene que ser false en sea-config.json: el arranque usa import().")
}

// Ni el build del SEA ni el zip del final crean su carpeta de destino, así que las dos
// tienen que existir de antemano.
fs.mkdirSync(path.dirname(seaBuild), { recursive: true })
fs.mkdirSync(path.join(APP_ROOT, "out"), { recursive: true })

// La carpeta "frontend" que se empaqueta es generada: la fuente está en
// "frontend-src" (Svelte + Tailwind) y no viaja dentro del ejecutable.
console.log("[build] compilando el frontend…")
execFileSync("pnpm", ["run", "build:frontend"], { stdio: "inherit", cwd: APP_ROOT, shell: process.platform === "win32" })

execFileSync(process.execPath, ["--build-sea=sea-config.json"], { stdio: "inherit", cwd: APP_ROOT })

// El ejecutable recién salido no es más que Node con el arranque dentro: no tiene al
// lado ni el código ni las dependencias, ni icono, ni el envoltorio que pida el
// sistema. De eso se encarga el postbuild, que además lo mueve a su carpeta final.
const postbuild = { win32: postbuildWindows, darwin: postbuildMac }[process.platform] ?? postbuildLinux
const { outfile, zipFile } = await postbuild({ ...COMMON, seaBuild })

console.log(`[build] listo:\n  ${outfile}\n  ${zipFile}`)
