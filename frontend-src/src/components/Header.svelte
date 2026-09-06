<!-- Cabecera: icono, nombre y estado del servidor de audio. -->
<script>
    import { status } from "../lib/status.svelte.js"

    const text = $derived(
        status.connected === null
            ? "Conectando con el servidor de audio…"
            : !status.connected
              ? "Sin conexión con el servidor."
              : status.speaking
                ? "Reproduciendo…"
                : "Conectado."
    )
</script>

<div class="flex flex-none items-center gap-3 px-5 pt-4.5 pb-3.5">
    <!-- El icono lo sirve res/ por app://, no el build. -->
    <img
        class="h-10 w-10 flex-none rounded-[11px] bg-panel object-cover shadow-[0_2px_6px_rgba(61,51,44,0.12)]"
        src="/icons/appIcon.png"
        alt="" />
    <div class="min-w-0 flex-1">
        <h1 class="m-0 mb-0.75 text-base font-[650] text-text">Claude Lite Speaker</h1>
        <div class="flex items-center gap-1.5">
            <span
                class="h-1.75 w-1.75 flex-none rounded-full transition-shadow"
                class:bg-muted={!status.speaking}
                class:bg-red={status.speaking}
                class:shadow-[0_0_0_3px_rgba(185,97,79,0.18)]={status.speaking}
            ></span>
            <span class="text-[11px] text-muted">{text}</span>
        </div>
    </div>
</div>
