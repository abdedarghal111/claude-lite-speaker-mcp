<!-- Voz actual y prueba de voz. -->
<script>
    import { callCommand } from "../lib/native.js"
    import { notifyError } from "../lib/notifications.svelte.js"
    import { status, refreshStatus } from "../lib/status.svelte.js"
    import { BTN_PRIMARY, BTN_SECONDARY, INPUT, CARD } from "../lib/styles.js"

    // speak rechaza el texto vacío.
    const DEFAULT_TEXT = "Hola, así sueno ahora mismo."

    let text = $state(DEFAULT_TEXT)

    // Sin voz activa la síntesis falla: no se deja probar.
    const hasVoice = $derived(Boolean(status.voice))

    function runSpeakTest() {
        // speak no espera al audio: refresca el estado sin esperar al poll.
        callCommand("speak", { text: text.trim() || DEFAULT_TEXT })
            .then(() => refreshStatus({ quiet: true }))
            .catch((err) => notifyError("speak", err))
    }

    function stop() {
        callCommand("stop")
            .then(() => refreshStatus({ quiet: true }))
            .catch((err) => notifyError("stop", err))
    }
</script>

<section class={CARD}>
    <div class="flex items-center justify-between border-b border-line pb-2.5">
        <span class="text-[11.5px] text-muted">Voz actual</span>
        {#if hasVoice}
            <span class="text-[13px] font-[650] text-text">{status.voice}</span>
        {:else}
            <span class="text-[13px] font-[650] text-sev-warn">Ninguna</span>
        {/if}
    </div>
    <div class="flex flex-col gap-2 pt-0.5">
        <input
            type="text"
            class={INPUT}
            bind:value={text}
            disabled={!hasVoice}
            placeholder={hasVoice ? "Escribe algo para escucharlo..." : "Descarga una voz para poder probarla"}
            onkeydown={(e) => e.key === "Enter" && runSpeakTest()} />
        <div class="flex gap-2">
            <button type="button" class={BTN_PRIMARY} disabled={!hasVoice} onclick={runSpeakTest}>Probar voz</button>
            <button type="button" class={BTN_SECONDARY} disabled={!status.speaking} onclick={stop}>Parar</button>
        </div>
    </div>
</section>
