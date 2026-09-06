// TODO: probar ejecutable de linux para ver si compila bien y si todo está ok
// https://github.com/abdedarghal111/claude-lite-speaker-mcp/issues/13
// Postbuild de Linux: deja el código y las dependencias en la carpeta de trabajo, mueve
// ahí el ejecutable recién generado, pone a su lado el icono y el .desktop -que Linux
// no incrusta- y comprime el conjunto en el zip que se reparte.
import fs from "node:fs"
import path from "node:path"
import { createPayload } from "./payload.mjs"
import { createZip, zipNameFor } from "./zip.mjs"

export async function postbuildLinux({ appName, executableName, appRoot, buildRoot, contents, seaBuild }) {
    const buildDir = path.join(buildRoot, "linux-x64")
    // Los binarios nativos que se quedan dentro son los de este sistema.
    createPayload({ appRoot, payloadDir: buildDir, contents, onnxBin: "linux/x64", nativeSuffix: "linux-x64-gnu" })

    const outfile = path.join(buildDir, executableName)
    fs.renameSync(seaBuild, outfile)
    fs.chmodSync(outfile, 0o755)

    // Linux no incrusta el icono en el ejecutable.
    const iconOut = path.join(buildDir, "appIcon.png")
    fs.copyFileSync(path.join(appRoot, "res", "icons", "appIcon.png"), iconOut)

    // Las rutas del .desktop son absolutas: solo valen mientras el fichero siga junto al binario.
    const toPosix = (route) => route.split(path.sep).join("/")
    const desktopEntry =
        `[Desktop Entry]\n` +
        `Type=Application\n` +
        `Name=${appName}\n` +
        `Exec=${toPosix(outfile)}\n` +
        `Icon=${toPosix(iconOut)}\n` +
        `Terminal=false\n`
    fs.writeFileSync(path.join(buildDir, `${executableName}.desktop`), desktopEntry)

    const zipFile = await createZip({ sourceDir: buildDir, zipFile: zipNameFor({ appRoot, executableName, platform: "linux-x64" }) })
    return { outfile, zipFile }
}
