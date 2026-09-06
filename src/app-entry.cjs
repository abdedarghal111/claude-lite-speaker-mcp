// Puente entre exe-entry.cjs y main.js: al ser un módulo del disco, su import() sí
// carga ficheros.
const path = require("node:path")
const { pathToFileURL } = require("node:url")

const mainPath = path.join(__dirname, "main.js")
import(pathToFileURL(mainPath).href).catch((err) => {
    console.error(err)
    process.exit(1)
})
