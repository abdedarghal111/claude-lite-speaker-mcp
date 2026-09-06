// Postbuild de Windows: deja el código y las dependencias en la carpeta de trabajo,
// mueve ahí el ejecutable recién generado, le pone el icono de la app, le quita la
// consola y comprime el conjunto en el zip que se reparte.
import fs from "node:fs"
import path from "node:path"
import { rcedit } from "rcedit"
import { createPayload } from "./payload.mjs"
import { createZip, zipNameFor } from "./zip.mjs"

// Windows decide si un programa abre consola por un campo de su cabecera PE, y el
// binario de Node viene marcado como programa de consola: al abrirlo con doble clic
// salta primero una ventana negra que se queda ahí toda la sesión. Esto la cambia a
// GUI, que es lo que declaran las aplicaciones de ventana. No se puede hacer desde el
// código: cuando este corre, la consola ya está en pantalla.
function hideConsoleWindow(exePath) {
    const exe = fs.readFileSync(exePath)

    // La cabecera PE no está en un sitio fijo: su posición la da el campo del final de
    // la cabecera DOS, y a partir de ahí el offset de los dos campos que interesan sí
    // es siempre el mismo, tanto en PE32 como en PE32+.
    const peOffset = exe.readUInt32LE(0x3c)
    // La firma son los bytes "PE" seguidos de dos ceros, que leídos de golpe dan este número.
    const PE_SIGNATURE = 0x00004550
    if (exe.readUInt32LE(peOffset) !== PE_SIGNATURE) {
        throw new Error("El ejecutable no tiene cabecera PE: no se puede quitar la consola.")
    }
    const subsystemOffset = peOffset + 24 + 68

    // 3 es consola y 2 es ventana. Si ya viniera en otra cosa, mejor parar que escribir
    // a ciegas sobre una cabecera que no es la que se espera.
    const CONSOLE = 3
    const GUI = 2
    const current = exe.readUInt16LE(subsystemOffset)
    if (current !== CONSOLE && current !== GUI) {
        throw new Error(`Subsistema PE inesperado (${current}): se esperaba consola o ventana.`)
    }

    exe.writeUInt16LE(GUI, subsystemOffset)
    fs.writeFileSync(exePath, exe)
}

export async function postbuildWindows({ executableName, appRoot, buildRoot, contents, seaBuild }) {
    const buildDir = path.join(buildRoot, "windows-x64")
    // Los binarios nativos que se quedan dentro son los de este sistema.
    createPayload({ appRoot, payloadDir: buildDir, contents, onnxBin: "win32/x64", nativeSuffix: "win32-x64-msvc" })

    // En Windows el ejecutable no arranca con un doble clic si no se llama .exe.
    const outfile = path.join(buildDir, `${executableName}.exe`)
    fs.renameSync(seaBuild, outfile)

    // El binario de partida es el node.exe de esta máquina, con su icono y sus datos;
    // rcedit los reemplaza por los de la app. Esto invalida la firma de Node, que ya
    // no vale para nada una vez inyectado el blob.
    const version = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8")).version
    await rcedit(outfile, {
        "icon": path.join(appRoot, "res", "icons", "appIcon.ico"),
        "file-version": version,
        "product-version": version,
        "version-string": {
            FileDescription: "Claude Lite Speaker",
            ProductName: "Claude Lite Speaker",
            OriginalFilename: path.basename(outfile),
        },
    })

    // Después de rcedit, que reescribe el binario entero y devolvería la consola.
    hideConsoleWindow(outfile)

    const zipFile = await createZip({ sourceDir: buildDir, zipFile: zipNameFor({ appRoot, executableName, platform: "windows-x64" }) })
    return { outfile, zipFile }
}
