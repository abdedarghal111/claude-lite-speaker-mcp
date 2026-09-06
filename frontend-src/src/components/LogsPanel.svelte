<!-- Pestaña Registro de errores: los que ha registrado el backend. -->
<script>
    import Icon from "./Icon.svelte"
    import { fmtTime } from "../lib/format.js"
    import { log, listLog } from "../lib/log.svelte.js"
    import { LEVEL_STYLES } from "../lib/notifications.svelte.js"
    import { CARD } from "../lib/styles.js"

    let search = $state("")
    let expanded = $state(new Set())
    let copied = $state(null)

    const rows = $derived(listLog(search))

    function toggle(index) {
        const next = new Set(expanded)
        if (next.has(index)) {
            next.delete(index)
        } else {
            next.add(index)
        }
        expanded = next
    }

    function copy(row) {
        if (!navigator.clipboard?.writeText) {
            return
        }
        navigator.clipboard.writeText(`[${fmtTime(new Date(row.time))}] ${row.message}`).then(() => {
            copied = row.index
            setTimeout(() => (copied = null), 1200)
        })
    }
</script>

<section class={CARD}>
    <div class="flex items-center justify-between">
        <h2 class="m-0 text-[13px] font-[650] text-text">Registro de errores</h2>
        <span class="text-[11px] font-medium text-muted">{rows.length} de {log.errors.length} errores</span>
    </div>

    <div class="flex flex-wrap gap-2">
        <input
            type="text"
            class="min-w-30 flex-1 rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-[11.5px] text-text"
            placeholder="Buscar por mensaje…"
            bind:value={search} />
    </div>

    <div>
        {#if rows.length === 0}
            <div class="px-2.5 py-7.5 text-center text-xs text-muted">No hay errores registrados.</div>
        {:else}
            {#each rows as row (row.index)}
                <div
                    class="cursor-pointer border-b border-line p-2 last:border-b-0 hover:bg-[#fffdf8]"
                    onclick={() => toggle(row.index)}
                    role="presentation">
                    <div class="flex items-center gap-2 text-[11px]">
                        <span class="w-15 flex-none tabular-nums text-muted">{fmtTime(new Date(row.time))}</span>
                        <span
                            class="inline-flex flex-none items-center rounded-full px-1.75 py-0.5 text-[10px] font-bold tracking-[0.03em] uppercase {LEVEL_STYLES
                                .error.chip}">Error</span>
                        <span class="min-w-0 flex-1 truncate">{row.message}</span>
                        <button
                            type="button"
                            class="flex h-5.5 w-5.5 flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted hover:bg-bg hover:text-text"
                            title={copied === row.index ? "¡Copiado!" : "Copiar mensaje"}
                            onclick={(event) => {
                                event.stopPropagation()
                                copy(row)
                            }}>
                            <Icon name={copied === row.index ? "check" : "copy"} class="h-3.25 w-3.25" />
                        </button>
                    </div>
                    {#if expanded.has(row.index)}
                        <div
                            class="mt-2 mr-1 mb-0.5 ml-17 rounded-lg bg-bg px-2.5 py-2 text-[10.5px] break-words whitespace-pre-wrap text-muted">
                            {row.text}
                        </div>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>
</section>
