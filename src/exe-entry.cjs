// Arranque del ejecutable empaquetado: va dentro del binario y, como ahí el import()
// solo alcanza a los built-in, carga app-entry.cjs del disco y le pasa el relevo.
const fs = require("node:fs")
const path = require("node:path")
const { createRequire } = require("node:module")

// En macOS el binario va en Contents/MacOS/, un nivel por debajo del código.
const exeDir = path.dirname(process.execPath)
const codeDir = process.platform === "darwin" ? path.dirname(exeDir) : exeDir
const entryPath = path.join(codeDir, "src", "app-entry.cjs")

if (!fs.existsSync(entryPath)) {
    throw new Error(`No se encuentra ${entryPath}: el ejecutable tiene que ir acompañado de la carpeta que genera el build.`)
}

createRequire(entryPath)(entryPath)
