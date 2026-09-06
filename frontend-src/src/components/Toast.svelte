<!-- Aviso emergente, con barra de tiempo que se pausa al pasar el ratón. -->
<script>
    import { fly } from "svelte/transition"
    import Icon from "./Icon.svelte"
    import { LEVEL_STYLES } from "../lib/notifications.svelte.js"

    const DURATION = 4500

    let { event, ondismiss } = $props()

    let width = $state(100)
    let paused = $state(false)

    $effect(() => {
        let remaining = DURATION
        let last = performance.now()
        let raf = requestAnimationFrame(tick)

        function tick(now) {
            if (!paused) {
                remaining -= now - last
                width = Math.max(0, (remaining / DURATION) * 100)
                if (remaining <= 0) {
                    ondismiss(event.id)
                    return
                }
            }
            last = now
            raf = requestAnimationFrame(tick)
        }

        return () => cancelAnimationFrame(raf)
    })
</script>

<div
    class="pointer-events-auto relative flex w-full max-w-110 items-start gap-2.5 overflow-hidden rounded-[9px] border border-line border-l-[3px] bg-card py-2.5 pr-8.5 pl-2.5 shadow-[0_4px_14px_rgba(61,51,44,0.14)] {LEVEL_STYLES[
        event.level
    ].border}"
    transition:fly={{ y: 14, duration: 280 }}
    onmouseenter={() => (paused = true)}
    onmouseleave={() => (paused = false)}
    role="status">
    <span
        class="mt-px flex h-4.75 w-4.75 flex-none items-center justify-center rounded-full text-white {LEVEL_STYLES[
            event.level
        ].bg}">
        <Icon name={event.level} class="h-2.75 w-2.75" stroke={2} />
    </span>
    <div class="min-w-0 flex-1">
        <div class="text-[12.5px] leading-[1.4] font-[650] text-text">{event.message}</div>
        <div class="mt-0.5 text-[10.5px] text-muted">{event.source} · ahora</div>
    </div>
    <button
        type="button"
        class="absolute top-2.5 right-2.5 cursor-pointer border-none bg-transparent p-0.75 text-[15px] leading-none text-muted hover:text-text"
        onclick={() => ondismiss(event.id)}>✕</button>
    <div class="absolute bottom-0 left-0 h-0.75 {LEVEL_STYLES[event.level].bg}" style="width:{width}%"></div>
</div>
