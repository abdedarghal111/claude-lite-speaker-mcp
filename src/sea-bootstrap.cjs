// Punto de entrada real cuando la app corre empaquetada (Node SEA, ver
// scripts/build-app-exe.mjs). Node SEA solo admite un script CommonJS como
// "main" del blob, por lo que este bootstrap es CJS y hace un import()
// dinámico de main.js, que se resuelve contra el fichero real en disco.
const path = require("node:path")
const { pathToFileURL } = require("node:url")

const mainPath = path.join(path.dirname(process.execPath), "src", "main.js")
import(pathToFileURL(mainPath).href).catch((err) => {
  console.error(err)
  process.exit(1)
})
