// TODO: probar ejecutable de mac para ver si compila bien y si todo está ok 
// https://github.com/abdedarghal111/claude-lite-speaker-mcp/issues/14
// Postbuild de macOS: monta el bundle .app con su icono, su Info.plist y su firma, y
// mete dentro el ejecutable recién generado junto al código y las dependencias, que
// van en Contents/ para que la app sea autocontenida. El bundle se monta en la carpeta
// de trabajo y de ahí sale el zip que se reparte.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { build as buildPlist } from "plist"
import { createICNS, BICUBIC } from "png2icons"
import { createPayload } from "./payload.mjs"
import { createZip, zipNameFor } from "./zip.mjs"

const BUNDLE_ID = "com.claudeliteSpeaker.trayapp"

export async function postbuildMac({ appName, executableName, appRoot, buildRoot, contents, seaBuild }) {
    // macOS espera el nombre y el icono dentro de un bundle .app.
    const buildDir = path.join(buildRoot, "mac-x64")
    const bundleDir = path.join(buildDir, `${appName}.app`)
    const contentsDir = path.join(bundleDir, "Contents")
    const macosDir = path.join(contentsDir, "MacOS")
    const resourcesDir = path.join(contentsDir, "Resources")

    fs.rmSync(buildDir, { recursive: true, force: true })

    // El código va en Contents/, que es donde lo busca exe-entry.cjs subiendo desde
    // Contents/MacOS/, que es donde tiene que estar el ejecutable.
    createPayload({ appRoot, payloadDir: contentsDir, contents, onnxBin: "darwin/x64", nativeSuffix: "darwin-x64" })
    fs.mkdirSync(macosDir, { recursive: true })
    fs.mkdirSync(resourcesDir, { recursive: true })

    const outfile = path.join(macosDir, executableName)
    fs.renameSync(seaBuild, outfile)
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

    // Inyectar el blob invalida la firma del binario de Node, y en macOS un ejecutable
    // con la firma rota no arranca, así que hay que volver a firmarlo sí o sí.
    execFileSync("codesign", ["--sign", "-", bundleDir], { stdio: "inherit" })

    const zipFile = await createZip({ sourceDir: buildDir, zipFile: zipNameFor({ appRoot, executableName, platform: "mac-x64" }) })
    return { outfile: bundleDir, zipFile }
}
