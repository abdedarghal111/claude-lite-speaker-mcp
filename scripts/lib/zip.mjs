// Empaqueta la carpeta de trabajo en un zip para poder repartirla de una pieza.
import fs from "node:fs"
import path from "node:path"
import { ZipArchive } from "archiver"

// Suma de lo que ocupa el árbol, para saber de antemano contra cuánto se compara el
// progreso: archiver solo va contando lo que lleva leído, y sin este total no habría
// porcentaje que enseñar hasta el final.
function totalBytes(dir) {
    let total = 0
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        total += entry.isDirectory() ? totalBytes(full) : fs.statSync(full).size
    }
    return total
}

const asMiB = (bytes) => (bytes / 1024 / 1024).toFixed(1)

// Comprime el contenido de sourceDir -no la carpeta en sí- y devuelve la ruta del zip,
// contando por consola lo que lleva comprimido.
export function createZip({ sourceDir, zipFile }) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipFile)

        // Nivel 9: es lo más que aprieta el deflate, que es lo único que entiende
        // cualquier descompresor sin instalar nada.
        const archive = new ZipArchive({ zlib: { level: 9 } })

        const expected = totalBytes(sourceDir)
        // En una terminal el progreso se reescribe sobre la misma línea; si la salida
        // va a un fichero o a un log de CI eso dejaría un churro ilegible, así que ahí
        // se anuncia de diez en diez puntos y ya.
        const isTty = process.stdout.isTTY
        let lastStep = -1

        archive.on("progress", ({ fs: { processedBytes } }) => {
            const percent = expected > 0 ? Math.min(100, Math.round((processedBytes / expected) * 100)) : 100
            const line = `[zip] ${String(percent).padStart(3)}%  ${asMiB(processedBytes)}/${asMiB(expected)} MiB`
            if (isTty) {
                process.stdout.write(`\r${line}`)
                return
            }
            const step = Math.floor(percent / 10)
            if (step > lastStep) {
                lastStep = step
                console.log(line)
            }
        })

        output.on("close", () => {
            if (isTty) {
                process.stdout.write("\r")
            }
            console.log(`[zip] ${path.basename(zipFile)}: ${asMiB(fs.statSync(zipFile).size)} MiB comprimidos`)
            resolve(zipFile)
        })
        archive.on("warning", reject)
        archive.on("error", reject)

        archive.pipe(output)
        archive.directory(sourceDir, false)
        archive.finalize()
    })
}

// Nombre del zip, con la versión de la app y el sistema al que pertenece. Va a out,
// que es donde queda lo que se reparte.
export function zipNameFor({ appRoot, executableName, platform }) {
    const version = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8")).version
    return path.join(appRoot, "out", `${executableName}-${version}-${platform}.zip`)
}
