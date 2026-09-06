<!-- Aviso permanente mientras no haya ninguna voz activa: sin voz la app no habla. -->
<script>
    import Icon from "./Icon.svelte"
    import { status } from "../lib/status.svelte.js"
    import { voices } from "../lib/voices.svelte.js"

    let { onopenvoices } = $props()

    // Con voces ya descargadas solo falta elegir una; si no, hay que bajarla.
    const hasDownloaded = $derived(voices.data.downloaded.length > 0)
</script>

{#if status.connected && !status.voice}
    <div
        class="mx-5 mb-3.5 flex flex-none items-center gap-2.5 rounded-[11px] border border-sev-warn/45 bg-sev-warn/10 px-3 py-2.5">
        <Icon name="bell" class="h-4 w-4 flex-none text-sev-warn" />
        <p class="m-0 flex-1 text-[11.5px] leading-snug text-text">
            {hasDownloaded
                ? "No hay ninguna voz activa. Elige una en “Voces” para que la app pueda hablar."
                : "No hay ninguna voz instalada. Descarga una en “Voces” para que la app pueda hablar."}
        </p>
        <button
            type="button"
            class="flex-none cursor-pointer rounded-lg border-none bg-sev-warn px-2.5 py-1.5 text-[11px] font-[650] text-onred transition hover:brightness-110"
            onclick={onopenvoices}>
            Ir a Voces
        </button>
    </div>
{/if}
