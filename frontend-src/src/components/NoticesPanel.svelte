<!-- Pestaña Avisos: histórico de las notificaciones de la interfaz. -->
<script>
    import Icon from "./Icon.svelte"
    import { isToday, relTime } from "../lib/format.js"
    import { LEVELS, LEVEL_STYLES, notifications, dismissEvent, clearEvents } from "../lib/notifications.svelte.js"
    import { CARD } from "../lib/styles.js"

    let { onopenlogs } = $props()

    const CHIPS = ["all", "error", "warn", "info", "ok"]

    let filter = $state("all")

    const list = $derived(
        filter === "all" ? notifications.events : notifications.events.filter((e) => e.level === filter)
    )
    const today = $derived(list.filter((e) => isToday(e.time)))
    const older = $derived(list.filter((e) => !isToday(e.time)))
</script>

{#snippet group(title, events)}
    <div class="mx-0.5 mt-2.5 mb-1.5 flex-none text-[10px] font-bold tracking-wider text-muted uppercase first:mt-0.5">
        {title}
    </div>
    {#each events as ev (ev.id)}
        <div
            class="mb-1.75 flex flex-none items-start gap-2.5 rounded-[9px] border border-line border-l-[3px] bg-card px-2.5 py-2.5 {LEVEL_STYLES[
                ev.level
            ].border}">
            <span
                class="flex h-4.75 w-4.75 flex-none items-center justify-center rounded-full text-white {LEVEL_STYLES[
                    ev.level
                ].bg}">
                <Icon name={ev.level} class="h-2.75 w-2.75" stroke={2} />
            </span>
            <div class="min-w-0 flex-1">
                <div class="text-[11.5px] leading-[1.4] text-text">{ev.message}</div>
                <div class="mt-0.5 text-[10px] text-muted">{ev.source} · {relTime(ev.time)}</div>
            </div>
            <button
                type="button"
                class="flex-none cursor-pointer border-none bg-transparent px-0.75 py-0.5 text-[13px] leading-none text-muted hover:text-sev-error"
                onclick={() => dismissEvent(ev.id)}>✕</button>
        </div>
    {/each}
{/snippet}

<section class={CARD}>
    <div class="flex items-center justify-between">
        <h2 class="m-0 text-[13px] font-[650] text-text">Avisos</h2>
        <button
            type="button"
            class="cursor-pointer border-none bg-transparent text-[10.5px] font-bold text-muted hover:text-red"
            onclick={clearEvents}>Vaciar todo</button>
    </div>

    <div class="flex flex-none gap-1.25 overflow-x-auto pb-px">
        {#each CHIPS as key (key)}
            <button
                type="button"
                class="flex-none cursor-pointer rounded-full border px-2.75 py-1.25 text-[10.5px] font-[650]"
                class:border-line={filter !== key}
                class:bg-panel={filter !== key}
                class:text-muted={filter !== key}
                class:border-text={filter === key}
                class:bg-text={filter === key}
                class:text-panel={filter === key}
                onclick={() => (filter = key)}>
                {key === "all" ? "Todos" : LEVELS[key]}
            </button>
        {/each}
    </div>

    <div class="scroll-hidden flex max-h-64.5 flex-col overflow-y-auto">
        {#if list.length === 0}
            <p class="px-2.5 py-6.5 text-center text-[11.5px] text-muted">No hay avisos.</p>
        {:else}
            {#if today.length > 0}
                {@render group("Hoy", today)}
            {/if}
            {#if older.length > 0}
                {@render group("Anteriores", older)}
            {/if}
        {/if}
    </div>

    <div class="flex-none pt-0.5">
        <button
            type="button"
            class="flex cursor-pointer items-center gap-1.75 border-none bg-transparent p-0 text-left text-xs font-semibold text-text hover:text-red"
            onclick={onopenlogs}>
            <Icon name="code" class="h-3.5 w-3.5 flex-none text-muted" />
            Ver registro de errores
        </button>
    </div>
</section>
