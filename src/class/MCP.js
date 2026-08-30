// Clase MCP: servidor HTTP con el endpoint /mcp, para que Claude Code
// consuma la tool speak como cliente remoto.
import { z } from "zod"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js"
import { Logger } from "./Logger.js"
import { AppSettings } from "./AppSettings.js"
import { VoicesManager } from "./VoicesManager.js"
import { AUDIO_SERVER_HTTP_PORT } from "../values/constants.js"

export class MCP {
    constructor(app) {
        this.app = app
        this.httpServer = null
    }

    // Arranca el servidor HTTP en AUDIO_SERVER_HTTP_PORT.
    start() {
        const expressApp = createMcpExpressApp()
        expressApp.post("/mcp", (req, res) => this.#handleMcpRequest(req, res))
        // Cualquier otra ruta: 404 en JSON, consistente con el resto de respuestas.
        expressApp.use((req, res) => res.status(404).json({ ok: false, error: "not found" }))

        return new Promise((resolve) => {
            this.httpServer = expressApp.listen(AUDIO_SERVER_HTTP_PORT, "127.0.0.1", resolve)
            this.httpServer.on("error", (err) => {
                if (err.code === "EADDRINUSE") {
                    // Puerto ya en uso: probablemente otra instancia viva, este proceso sale.
                    Logger.logError(`puerto ${AUDIO_SERVER_HTTP_PORT} ya en uso (¿otra instancia viva?), saliendo.`)
                    return process.exit(0)
                }
                Logger.logError(err)
            })
        })
    }

    // Detiene el servidor HTTP.
    stop() {
        this.httpServer?.close()
    }

    // Modo stateless: cada petición crea su propio McpServer y transporte, cerrados al terminar.
    #buildServer() {
        const server = new McpServer({ name: "claude-lite-speaker", version: "1.0.0" })

        server.registerTool(
            "speak",
            {
                description:
                    "Convierte el texto dado en voz y lo reproduce" +
                    " usando la voz, velocidad, volumen y ding " +
                    "configurados actualmente en la app de bandeja del escritorio — no se pueden ajustar " +
                    "desde aquí, esa configuración solo se cambia desde esa app. Si ya hay algo sonando, este " +
                    "audio se encola detrás y suena en su turno. El modelo que convierte el texto en voz es " +
                    "ligero, así que para que se entienda bien usa palabras sencillas y frecuentes, frases " +
                    "cortas, el mismo idioma en el que se está hablando, y sin símbolos raros que no se " +
                    "pronuncien con naturalidad. Úsala cuando el usuario pida explícitamente que se lea algo " +
                    "en voz alta ahora mismo.",
                inputSchema: {
                    text: z.string().describe("Texto a sintetizar y reproducir."),
                },
            },
            async ({ text }) => {
                try {
                    return { content: [{ type: "text", text: this.speak(text) }] }
                } catch (err) {
                    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true }
                }
            }
        )

        return server
    }

    // Sintetiza y reproduce el texto en segundo plano; devuelve un mensaje
    // descriptivo del resultado.
    speak(text) {
        const voice = AppSettings.read("voice")
        if (!VoicesManager.voiceFilesReady(voice)) {
            return `La voz "${voice}" no está descargada. Descárgala desde el panel de voces de la ventana de ajustes.`
        }
        const { speed, notification, volume } = this.app.chat.speak(text)
        return (
            `Reproduciendo con la voz "${voice}" a velocidad ${speed}x y volumen ${volume}%${notification ? " (con ding previo)" : ""} ` +
            "en segundo plano (no bloquea la conversación). Si tras un rato no se oye nada, consulta piper_status " +
            "para ver si hubo algún error."
        )
    }

    // Atiende una petición al endpoint /mcp con un McpServer y transporte efímeros.
    async #handleMcpRequest(req, res) {
        const server = this.#buildServer()
        try {
            const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
            await server.connect(transport)
            await transport.handleRequest(req, res, req.body)
            res.on("close", () => {
                transport.close()
                server.close()
            })
        } catch (err) {
            if (!res.headersSent) {
                res.writeHead(500, { "Content-Type": "application/json" })
                res.end(
                    JSON.stringify({
                        jsonrpc: "2.0",
                        error: { code: -32603, message: err?.message || "Internal server error" },
                        id: null,
                    })
                )
            }
        }
    }
}
