<!-- Autoarranque: muestra el estado leído del sistema, avisa mientras lo cambia y se
     resalta cuando está apagado. -->
<script>
    import Icon from "./Icon.svelte"
    import { isAutostartEnabled, setAutostart } from "../lib/native.js"
    import { notifyError } from "../lib/notifications.svelte.js"

    // null mientras no se sabe: el estado inicial también se lee del sistema.
    let enabled = $state(null)
    let working = $state(true)

    // No se resalta mientras trabaja: ya lo indica el propio botón.
    const highlight = $derived(!working && enabled === false)

    $effect(() => {
        refresh()
    })

    async function refresh() {
        try {
            enabled = await isAutostartEnabled()
        } catch (err) {
            notifyError("isAutostartEnabled", err)
            enabled = false
        } finally {
            working = false
        }
    }

    async function toggle() {
        working = true
        try {
            await setAutostart(!enabled)
        } catch (err) {
            notifyError("setAutostart", err)
        }
        await refresh()
    }
</script>

<div class="flex items-center justify-between gap-2.5">
    <span class="flex items-center gap-2 text-[12.5px] font-semibold text-text">
        <Icon name="power" class="h-3.75 w-3.75 flex-none text-muted" />
        Autoarranque
    </span>
    <button
        type="button"
        class="flex flex-none cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-[650] transition disabled:cursor-default disabled:opacity-55"
        class:border-line={!highlight}
        class:bg-panel={!highlight}
        class:text-text={!highlight}
        class:hover:bg-white={!highlight}
        class:border-red={highlight}
        class:bg-red={highlight}
        class:text-onred={highlight}
        class:animate-pulse={highlight}
        disabled={working}
        onclick={toggle}>
        {#if working}
            <Icon name="refresh" class="h-3.25 w-3.25 animate-spin" />
            Un momento…
        {:else if enabled}
            <Icon name="check" class="h-3.25 w-3.25" />
            Activado
        {:else}
            <Icon name="power" class="h-3.25 w-3.25" />
            Activar
        {/if}
    </button>
</div>
