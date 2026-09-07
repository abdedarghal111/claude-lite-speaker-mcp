<!-- Pestaña General: ajustes de reproducción y preferencias. -->
<script>
    import Icon from "./Icon.svelte"
    import Switch from "./Switch.svelte"
    import AutostartButton from "./AutostartButton.svelte"
    import { callCommand, openDevtools, openDataFolder, testNotification, quitApp } from "../lib/native.js"
    import { notifyError } from "../lib/notifications.svelte.js"
    import { status, isDangerVolume } from "../lib/status.svelte.js"
    import { CARD } from "../lib/styles.js"

    // Copia local: el poll no debe pisar el valor a medio gesto.
    let speed = $state(1)
    let volume = $state(100)
    let dragging = $state(false)

    $effect(() => {
        if (!dragging) {
            speed = status.speed
            volume = status.volume
        }
    })

    function commitSpeed() {
        dragging = false
        callCommand("setSpeed", { speed: Number(speed) }).catch((err) => notifyError("setSpeed", err))
    }

    function commitVolume() {
        dragging = false
        // allow_overdrive: es el usuario moviendo el slider, no una llamada externa.
        callCommand("setVolume", { volume: Number(volume), allow_overdrive: true }).catch((err) =>
            notifyError("setVolume", err)
        )
    }
</script>

<section class={CARD}>
    <div class="flex flex-col gap-1.5">
        <div class="flex justify-between text-xs text-text">
            <span>Velocidad</span>
            <span class="tabular-nums text-muted">{Number(speed).toFixed(1)}x</span>
        </div>
        <!-- min/max vienen de values/constants.js por status.limits. -->
        <input
            type="range"
            class="range-red m-0 h-1 w-full"
            step="0.1"
            min={status.limits?.minSpeed ?? 0.5}
            max={status.limits?.maxSpeed ?? 2}
            bind:value={speed}
            oninput={() => (dragging = true)}
            onchange={commitSpeed} />
    </div>

    <div class="flex flex-col gap-1.5">
        <div class="flex justify-between text-xs text-text">
            <span>Volumen</span>
            <span
                class="tabular-nums"
                class:text-muted={!isDangerVolume(volume)}
                class:text-sev-warn={isDangerVolume(volume)}
                class:font-bold={isDangerVolume(volume)}>{Math.round(volume)}%</span>
        </div>
        <input
            type="range"
            class="range-red m-0 h-1 w-full"
            step="1"
            min={status.limits?.minVolume ?? 0}
            max={status.limits?.maxVolume ?? 100}
            bind:value={volume}
            oninput={() => (dragging = true)}
            onchange={commitVolume} />
    </div>

    <hr class="m-0 border-none border-t border-line" />

    <Switch
        icon="bell"
        label="Ding de aviso"
        bind:checked={status.notification}
        onchange={() =>
            callCommand("setNotification", { enabled: status.notification }).catch((err) =>
                notifyError("setNotification", err)
            )} />

    <AutostartButton />

    <hr class="m-0 border-none border-t border-line" />

    <!-- Lanza el mismo aviso que un error real: sonido y notificación del sistema. -->
    <button
        type="button"
        class="flex cursor-pointer items-center gap-1.75 border-none bg-transparent p-0 text-left text-xs font-semibold text-text hover:text-red"
        onclick={() => testNotification().catch((err) => notifyError("testNotification", err))}>
        <Icon name="bell" class="h-3.5 w-3.5 flex-none text-muted" />
        Probar el aviso de errores
    </button>

    <button
        type="button"
        class="flex cursor-pointer items-center gap-1.75 border-none bg-transparent p-0 text-left text-xs font-semibold text-text hover:text-red"
        onclick={() => openDataFolder().catch((err) => notifyError("openDataFolder", err))}>
        <Icon name="folder" class="h-3.5 w-3.5 flex-none text-muted" />
        Abrir la carpeta de datos
    </button>

    <button
        type="button"
        class="flex cursor-pointer items-center gap-1.75 border-none bg-transparent p-0 text-left text-xs font-semibold text-text hover:text-red"
        onclick={() => openDevtools().catch((err) => notifyError("openDevtools", err))}>
        <Icon name="code" class="h-3.5 w-3.5 flex-none text-muted" />
        Abrir herramientas de desarrollador
    </button>

    <hr class="m-0 border-none border-t border-line" />

    <button
        type="button"
        class="flex cursor-pointer items-center gap-1.75 border-none bg-transparent p-0 text-left text-xs font-semibold text-red hover:brightness-125"
        onclick={() => quitApp().catch((err) => notifyError("quitApp", err))}>
        <Icon name="exit" class="h-3.5 w-3.5 flex-none text-red" />
        Cerrar la aplicación por completo
    </button>
</section>
