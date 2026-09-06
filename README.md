# Claude Lite Speaker

<p align="center">
    <img src="./.github/images/idle.png" alt="App icon" width="200">
</p>

<p align="center">
    <a href="#qué-es-esto">Qué es esto</a> ·
    <a href="#funcionalidades">Funcionalidades</a> ·
    <a href="#desarrollo">Desarrollo</a> ·
    <a href="#menciones-honorables">Menciones honorables</a> ·
    <a href="#licencia">Licencia</a>
</p>

## Qué es esto

Un servidor MCP que corre en segundo plano y le da voz a Claude Code, o al modelo que prefieras: le pasas el texto y lo escuchas. Los modelos de voz que usa son de [Piper TTS](https://github.com/rhasspy/piper), en el que está inspirado este servidor, y por eso hablan rápido y con muy poco gasto de CPU, sin GPU de por medio.

Vive en la bandeja del sistema, así que de un vistazo sabes si está encendido, y al pulsar su icono se abre la ventana de ajustes para dejar a tu gusto la voz, el volumen, la velocidad y el resto. Puede arrancarse solo al iniciar sesión, y entonces ya no tienes que acordarte de él.

Todo ocurre en tu máquina: la síntesis es local, no hay llamadas a APIs externas ni nada que salga de tu equipo. Lo único que se descarga es la voz que elijas, una vez, y a partir de ahí funciona sin conexión.

Para que Claude Code lo use hace falta, además de tener esto corriendo, el plugin que vive en [claude-lite-speaker-plugin](https://github.com/abdedarghal111/claude-lite-speaker-plugin).

Usándolo se nota una ventaja que no se esperaba: como el agente tiene que resumir lo que hace para decirlo en voz alta, el trato con él se vuelve mucho más claro y fluido. Escuchas el resumen mientras miras los datos en pantalla, en vez de leer todo el rato. Y todo eso sin contar que te va comunicando cada cambio que hace.

⚠️ **Solo probado en Windows.** El código es multiplataforma y el build de macOS y Linux está escrito, pero sin verificar.

## Funcionalidades

- **Texto en voz alta:** lee lo que le manda el modelo, y encola lo que llegue mientras habla.
- **Configurable:** voz, velocidad, volumen y ding se cambian desde la ventana, nunca desde la IA.
- **Varias voces:** catálogo de Piper en varios idiomas, para descargar la que quieras.
- **Autoarranque:** se abre solo al iniciar sesión.
- **Bandeja de estado:** el icono se anima mientras suena algo.
- **Panel de avisos:** los errores de la app, a mano.

## Desarrollo

Hace falta [Node](https://nodejs.org) 26 o superior y [pnpm](https://pnpm.io).

```bash
pnpm install    # una vez
pnpm dev        # arranca la app con las devtools abiertas
pnpm build      # genera el ejecutable de este sistema
pnpm clean      # borra .build, la carpeta de trabajo del build
```

`pnpm build` construye la app en `.build/` y deja el zip en `out/`, para el sistema desde el que se lanza y siempre en x64 (amd64).

Aquí no hay nada que configurar: al activar el [plugin](https://github.com/abdedarghal111/claude-lite-speaker-plugin), Claude Code ya conoce el puerto y se conecta él solo a `http://127.0.0.1:51703/mcp`, avisando de si lo ha conseguido. Si la app no está abierta, reintenta por su cuenta hasta que la abras, sin reiniciar la sesión.

### Cómo está montado

| Pieza | Dónde | Qué hace |
|---|---|---|
| Bandeja y ventana | `src/class/Tray.js`, `src/class/Window.js` | Icono, menú y la ventana de ajustes, que usa el webview nativo del sistema |
| Servidor MCP | `src/class/MCP.js` | Express en un puerto fijo, con `/mcp` y los comandos que consume la ventana |
| Síntesis | `src/class/AudioEngine.js` | El pipeline de Piper reescrito en JS: espeak-ng (WASM) saca los fonemas, el modelo VITS de la voz los convierte en audio con onnxruntime |
| Reproducción | `src/class/AudioOutput.js`, `src/class/Chat.js` | Cola por cliente y salida con node-web-audio-api |
| Voces | `src/class/VoicesManager.js` | Catálogo remoto y ficheros de voz en disco |
| Interfaz | `frontend/` | HTML, CSS y JS planos, sin framework |

Lo que sale del build es el propio binario de Node con un script de arranque inyectado dentro (el SEA nativo, `node --build-sea`), y a su lado, en la misma carpeta, el código fuente y las dependencias que va a ejecutar. Por eso hay dos entradas: `src/exe-entry.cjs` viaja dentro del binario y `src/app-entry.cjs` es ya un fichero normal del disco, que es quien puede cargar `main.js`.

Con eso hecho, el postbuild de cada sistema (`scripts/lib/`) maquilla ese binario para que parezca lo que es: le pone el nombre y el icono de la app, le quita la consola en Windows, lo mete en un bundle `.app` firmado en macOS o le añade el `.desktop` en Linux. Y al final empaqueta la carpeta entera en el zip.

**Solo probado en Windows.** El build de macOS y el de Linux están escritos pero sin verificar.

Los datos (ajustes, voces descargadas, caché y log) van en `data/`, junto al ejecutable, así que la app es portable y se desinstala borrando su carpeta.

## Menciones honorables

- [Piper](https://github.com/rhasspy/piper) — el motor de síntesis, y [sus voces](https://huggingface.co/rhasspy/piper-voices) en Hugging Face.
- [espeak-ng](https://github.com/espeak-ng/espeak-ng) — la fonemización, aquí en su versión WASM.
- [onnxruntime](https://onnxruntime.ai/) — ejecuta el modelo de voz.
- [Model Context Protocol](https://modelcontextprotocol.io/) — el protocolo por el que Claude Code habla con la app.

## Licencia

Este código es [MIT](./LICENSE). Las dependencias tienen la suya: espeak-ng es GPL-3.0, así que el paquete que genera el build la arrastra.
