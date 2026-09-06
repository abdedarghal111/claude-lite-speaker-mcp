import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import tailwindcss from "@tailwindcss/vite"

const HERE = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    root: HERE,
    // La ventana carga por app://, no por http: los assets van en relativo.
    base: "./",
    plugins: [tailwindcss(), svelte()],
    build: {
        // La salida es la carpeta que empaqueta el build (ver class/Window.js).
        outDir: path.join(HERE, "..", "frontend"),
        emptyOutDir: true,
    },
})
