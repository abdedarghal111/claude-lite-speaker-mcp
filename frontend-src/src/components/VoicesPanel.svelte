<!-- Pestaña Voces: descargas en curso, voces descargadas y catálogo. -->
<script>
    import Icon from "./Icon.svelte"
    import {
        voices,
        listVoices,
        isDownloaded,
        isBusy,
        runVoiceAction,
        refreshCatalog,
        refreshVoices,
    } from "../lib/voices.svelte.js"
    import { BTN_PRIMARY, BTN_SECONDARY } from "../lib/styles.js"

    const SEGMENTS = [
        { onlyDownloaded: true, label: "Descargadas" },
        { onlyDownloaded: false, label: "Catálogo" },
    ]

    const VOICE_BTN = "flex-none px-2.75 py-1.5 text-[11px]"

    let search = $state("")
    let debounced = $state("")

    // El buscador se aplica con retardo para no repintar en cada tecla.
    $effect(() => {
        const value = search
        const timer = setTimeout(() => (debounced = value), 200)
        return () => clearTimeout(timer)
    })

    // Cada segmento pide datos distintos al backend.
    $effect(() => {
        voices.onlyDownloaded
        refreshVoices()
    })

    const view = $derived(listVoices(debounced))

    // Sin catálogo y sin voces en disco no hay nada que hacer salvo descargarlo.
    const needsCatalog = $derived(
        !voices.data.catalogAvailable && !voices.refreshingCatalog && voices.data.downloaded.length === 0
    )

    function metaOf(voice) {
        return [voice.language_name || voice.language, voice.quality, voice.sizeMb != null ? `${voice.sizeMb} MB` : null]
            .filter(Boolean)
            .join(" · ")
    }
</script>

<section class="flex flex-col gap-2.5">
    <div class="flex items-center justify-between">
        <h2 class="m-0 text-[13px] font-[650] text-text">Voces</h2>
        <button
            type="button"
            class="flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-[9px] border transition disabled:cursor-default disabled:opacity-55"
            class:border-line={!needsCatalog}
            class:bg-panel={!needsCatalog}
            class:text-muted={!needsCatalog}
            class:hover:border-line-hi={!needsCatalog}
            class:hover:bg-white={!needsCatalog}
            class:hover:text-text={!needsCatalog}
            class:border-red={needsCatalog}
            class:bg-red={needsCatalog}
            class:text-onred={needsCatalog}
            class:animate-pulse={needsCatalog}
            title="Descargar catálogo de voces"
            disabled={voices.refreshingCatalog}
            onclick={refreshCatalog}>
            <Icon name="refresh" class="h-3.75 w-3.75 {voices.refreshingCatalog ? 'animate-spin' : ''}" />
        </button>
    </div>

    {#if voices.data.activeDownloads.length > 0}
        <div class="-mb-0.5 flex flex-col gap-1.5">
            {#each voices.data.activeDownloads as download (download.voiceId)}
                {@const known = download.percent != null}
                {@const pct = known ? Math.max(2, Math.min(100, download.percent)) : 0}
                <div class="rounded-lg border border-line bg-panel px-2.5 py-2">
                    <div class="mb-1.25 flex justify-between gap-2 text-[11px] text-text">
                        <span class="truncate">{download.voiceId}</span>
                        <span class="flex-none text-muted">{known ? `${pct}%` : "descargando…"}</span>
                    </div>
                    <div class="h-1.25 overflow-hidden rounded-[3px] bg-line">
                        {#if known}
                            <div
                                class="h-full rounded-[3px] bg-red transition-[width] duration-200"
                                style="width:{pct}%"
                            ></div>
                        {:else}
                            <!-- Sin Content-Length no hay porcentaje: barra que se pasea. -->
                            <div
                                class="h-full w-[30%] animate-[indeterminate-sweep_1.1s_ease-in-out_infinite] rounded-[3px] bg-red"
                            ></div>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    <div class="flex flex-none gap-0.75 rounded-[9px] border border-line bg-bg p-0.75">
        {#each SEGMENTS as segment (segment.label)}
            <button
                type="button"
                class="flex-1 cursor-pointer rounded-[7px] border-none py-1.75 text-[11.5px] font-[650] transition"
                class:bg-panel={voices.onlyDownloaded === segment.onlyDownloaded}
                class:text-text={voices.onlyDownloaded === segment.onlyDownloaded}
                class:shadow-[0_1px_3px_rgba(61,51,44,0.12)]={voices.onlyDownloaded === segment.onlyDownloaded}
                class:bg-transparent={voices.onlyDownloaded !== segment.onlyDownloaded}
                class:text-muted={voices.onlyDownloaded !== segment.onlyDownloaded}
                onclick={() => (voices.onlyDownloaded = segment.onlyDownloaded)}>
                {segment.label}
            </button>
        {/each}
    </div>

    <div class="relative flex flex-none items-center">
        <Icon name="search" class="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted" />
        <input
            type="text"
            class="w-full rounded-lg border border-line bg-white py-2 pr-2.5 pl-[30px] text-xs text-text focus:outline-2 focus:-outline-offset-1 focus:outline-red"
            placeholder="Buscar por id o idioma (es, en_US, davefx...)"
            bind:value={search} />
    </div>

    <div class="scroll-hidden max-h-64.5 overflow-y-auto">
        {#if !voices.onlyDownloaded && !voices.data.catalogAvailable}
            <div class="flex flex-col items-start gap-2 px-0.5 py-1">
                <p class="m-0 text-[11.5px] text-muted">
                    No hay catálogo de voces descargado todavía. Descárgalo para ver las voces disponibles.
                </p>
                <button
                    type="button"
                    class="{BTN_PRIMARY} flex-none px-3 py-2 text-[11.5px]"
                    class:animate-pulse={needsCatalog}
                    disabled={voices.refreshingCatalog}
                    onclick={refreshCatalog}>
                    {voices.refreshingCatalog ? "Descargando catálogo…" : "Descargar catálogo"}
                </button>
            </div>
        {:else if view.entries.length === 0}
            <p class="mx-0.5 my-1 text-[11.5px] text-muted">
                {voices.onlyDownloaded
                    ? "No hay ninguna voz descargada todavía. Pasa a “Catálogo” para buscar y descargar una."
                    : "Sin resultados para esa búsqueda."}
            </p>
        {:else}
            <div class="flex flex-col gap-1.5 pr-0.5">
                {#each view.entries as voice (voice.id)}
                    {@const isActive = voice.id === voices.data.currentVoice}
                    {@const meta = metaOf(voice)}
                    <div
                        class="flex items-center gap-2 rounded-[9px] border bg-white px-2.75 py-2.25"
                        class:border-line={!isActive}
                        class:border-red={isActive}
                        class:shadow-[0_0_0_1px_var(--color-red)_inset]={isActive}>
                        <div class="min-w-0 flex-1">
                            <div class="truncate text-xs font-semibold text-text">{voice.id}</div>
                            {#if meta}
                                <div class="text-[10.5px] text-muted capitalize">{meta}</div>
                            {/if}
                        </div>
                        {#if isActive}
                            <button type="button" class="{BTN_PRIMARY} {VOICE_BTN}" disabled>En uso</button>
                        {:else if isBusy(voice.id)}
                            <button type="button" class="{BTN_PRIMARY} {VOICE_BTN}" disabled>Descargando…</button>
                        {:else if isDownloaded(voice.id)}
                            <button
                                type="button"
                                class="{BTN_PRIMARY} {VOICE_BTN}"
                                class:animate-pulse={!voices.data.currentVoice}
                                onclick={() => runVoiceAction("use", voice.id)}>Usar</button>
                        {:else}
                            <button
                                type="button"
                                class="{BTN_SECONDARY} {VOICE_BTN}"
                                onclick={() => runVoiceAction("download", voice.id)}>Descargar</button>
                        {/if}
                    </div>
                {/each}
                {#if view.truncated > 0}
                    <p class="mx-0.5 my-1 text-[11.5px] text-muted">
                        +{view.truncated} más — afina la búsqueda para verlas.
                    </p>
                {/if}
            </div>
        {/if}
    </div>
</section>
