// Arranque automático al iniciar sesión, con el mecanismo nativo de cada
// sistema operativo. Solo verificado en Windows.
import path from "node:path"
import fs from "node:fs"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

function exeName() {
    if (process.platform === "win32") {
        return "claude-lite-speaker-tray-win_x64.exe"
    }
    if (process.platform === "darwin") {
        return "claude-lite-speaker-tray-mac_x64"
    }
    return "claude-lite-speaker-tray-linux_x64"
}

// ----------------------------------------------------------------------------
// Windows: acceso directo en la carpeta de Inicio
// ----------------------------------------------------------------------------

const WINDOWS_STARTUP_LINK_NAME = "Claude Lite Speaker.lnk"
const WINDOWS_STARTUP_APPROVED_KEY =
    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder"

function windowsStartupLinkPath() {
    const appData = process.env.APPDATA
    return path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", WINDOWS_STARTUP_LINK_NAME)
}

// El Administrador de tareas puede desactivar el acceso directo sin
// borrarlo; ese estado se guarda en el registro, no en el archivo.
async function isWindowsStartupApprovedDisabled() {
    const ps =
        `$v = (Get-ItemProperty -Path '${WINDOWS_STARTUP_APPROVED_KEY}' ` +
        `-Name '${WINDOWS_STARTUP_LINK_NAME}' -ErrorAction SilentlyContinue).'${WINDOWS_STARTUP_LINK_NAME}'; ` +
        `if ($v) { Write-Output ([byte[]]$v)[0] }`
    const result = await execFileAsync("powershell", ["-NoProfile", "-Command", ps]).catch(() => null)
    if (!result) {
        return false
    }
    return parseInt(String(result.stdout || "").trim(), 10) === 3
}

async function clearWindowsStartupApproved() {
    const ps = `Remove-ItemProperty -Path '${WINDOWS_STARTUP_APPROVED_KEY}' -Name '${WINDOWS_STARTUP_LINK_NAME}' -ErrorAction SilentlyContinue`
    await execFileAsync("powershell", ["-NoProfile", "-Command", ps]).catch(() => {})
}

async function isWindowsAutostartEnabled() {
    if (!fs.existsSync(windowsStartupLinkPath())) {
        return false
    }
    return !(await isWindowsStartupApprovedDisabled())
}

// TargetPath del acceso directo ya existente, o null si no hay uno.
// CreateShortcut() sobre un .lnk existente lo abre para leerlo, sin Save().
async function windowsAutostartTarget() {
    const linkPath = windowsStartupLinkPath()
    if (!fs.existsSync(linkPath)) {
        return null
    }
    const ps = `$s = New-Object -ComObject WScript.Shell; Write-Output $s.CreateShortcut('${linkPath}').TargetPath`
    const result = await execFileAsync("powershell", ["-NoProfile", "-Command", ps]).catch(() => null)
    return result ? String(result.stdout || "").trim() : null
}

async function setWindowsAutostart(target, appRoot, enabled) {
    const linkPath = windowsStartupLinkPath()
    if (!enabled) {
        await fs.promises.rm(linkPath, { force: true }).catch(() => {})
        return true
    }
    const ps =
        `$s = New-Object -ComObject WScript.Shell; ` +
        `$sc = $s.CreateShortcut('${linkPath}'); ` +
        `$sc.TargetPath = '${target}'; ` +
        `$sc.Arguments = '--opened-from-autostart'; ` +
        `$sc.WorkingDirectory = '${appRoot}'; ` +
        `$sc.Save()`
    await execFileAsync("powershell", ["-NoProfile", "-Command", ps])
    await clearWindowsStartupApproved()
    return true
}

// ----------------------------------------------------------------------------
// macOS: LaunchAgent
// ----------------------------------------------------------------------------

function macLaunchAgentPath() {
    return path.join(process.env.HOME || "", "Library", "LaunchAgents", "com.claudeliteSpeaker.trayapp.plist")
}

async function isMacAutostartEnabled() {
    return fs.existsSync(macLaunchAgentPath())
}

// ProgramArguments[0] del LaunchAgent ya existente, o null si no hay uno.
async function macAutostartTarget() {
    const plistPath = macLaunchAgentPath()
    if (!fs.existsSync(plistPath)) {
        return null
    }
    const result = await execFileAsync("/usr/libexec/PlistBuddy", ["-c", "Print ProgramArguments:0", plistPath]).catch(
        () => null
    )
    return result ? String(result.stdout || "").trim() : null
}

async function setMacAutostart(target, enabled) {
    const plistPath = macLaunchAgentPath()
    const domain = `gui/${process.getuid?.() ?? 0}`
    if (!enabled) {
        await execFileAsync("launchctl", ["bootout", domain, plistPath]).catch(() => {})
        await fs.promises.rm(plistPath, { force: true }).catch(() => {})
        return true
    }
    const plist =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
        `<plist version="1.0"><dict>\n` +
        `<key>Label</key><string>com.claudeliteSpeaker.trayapp</string>\n` +
        `<key>ProgramArguments</key><array><string>${target}</string><string>--opened-from-autostart</string></array>\n` +
        `<key>RunAtLoad</key><true/>\n` +
        `</dict></plist>\n`
    await fs.promises.writeFile(plistPath, plist)
    await execFileAsync("launchctl", ["bootout", domain, plistPath]).catch(() => {})
    await execFileAsync("launchctl", ["bootstrap", domain, plistPath])
    return true
}

// ----------------------------------------------------------------------------
// Linux: entrada .desktop en autostart
// ----------------------------------------------------------------------------

function linuxAutostartPath() {
    return path.join(process.env.HOME || "", ".config", "autostart", "claude-lite-speaker-tray.desktop")
}

async function isLinuxAutostartEnabled() {
    return fs.existsSync(linuxAutostartPath())
}

// Valor de Exec= de la entrada .desktop ya existente, o null si no hay una.
function linuxAutostartTarget() {
    const desktopPath = linuxAutostartPath()
    if (!fs.existsSync(desktopPath)) {
        return null
    }
    const match = fs.readFileSync(desktopPath, "utf8").match(/^Exec="(.*)"$/m)
    return match ? match[1] : null
}

async function setLinuxAutostart(target, enabled) {
    const desktopPath = linuxAutostartPath()
    if (!enabled) {
        await fs.promises.rm(desktopPath, { force: true }).catch(() => {})
        return true
    }
    await fs.promises.mkdir(path.dirname(desktopPath), { recursive: true })
    const desktopEntry =
        `[Desktop Entry]\n` +
        `Type=Application\n` +
        `Name=Claude Lite Speaker\n` +
        `Exec="${target}" --opened-from-autostart\n` +
        `Terminal=false\n` +
        `X-GNOME-Autostart-enabled=true\n`
    await fs.promises.writeFile(desktopPath, desktopEntry)
    return true
}

// ----------------------------------------------------------------------------
// API pública
// ----------------------------------------------------------------------------

export async function isAutostartEnabled() {
    if (process.platform === "win32") {
        return isWindowsAutostartEnabled()
    }
    if (process.platform === "darwin") {
        return isMacAutostartEnabled()
    }
    return isLinuxAutostartEnabled()
}

async function currentAutostartTarget() {
    if (process.platform === "win32") {
        return windowsAutostartTarget()
    }
    if (process.platform === "darwin") {
        return macAutostartTarget()
    }
    return linuxAutostartTarget()
}

// Se llama en cada arranque: si el autoarranque apunta a una ruta distinta
// de la actual (app movida o reempaquetada), lo regenera.
export async function initAutostart(appRoot) {
    if (!(await isAutostartEnabled())) {
        return
    }
    const target = path.join(appRoot, exeName())
    if ((await currentAutostartTarget()) !== target) {
        await setAutostart(appRoot, true)
    }
}

// appRoot: resuelto por quien llama (ver Tray.js); apunta al binario
// compilado, no a "node src/main.js".
export async function setAutostart(appRoot, enabled) {
    const target = path.join(appRoot, exeName())
    if (process.platform === "win32") {
        return setWindowsAutostart(target, appRoot, enabled)
    }
    if (process.platform === "darwin") {
        return setMacAutostart(target, enabled)
    }
    return setLinuxAutostart(target, enabled)
}
