// Puente entre la ventana y el proceso principal: expone window.native con el API que
// consume frontend-src/src/lib/native.js. Con contextIsolation y sandbox activos, aquí
// solo se reenvían llamadas por ipcRenderer.
const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("native", {
    callCommand: (name, args) => ipcRenderer.invoke("native:callCommand", name, args),
    isAutostartEnabled: () => ipcRenderer.invoke("native:isAutostartEnabled"),
    setAutostart: (enabled) => ipcRenderer.invoke("native:setAutostart", enabled),
    openDevtools: () => ipcRenderer.invoke("native:openDevtools"),
    openDataFolder: () => ipcRenderer.invoke("native:openDataFolder"),
})
