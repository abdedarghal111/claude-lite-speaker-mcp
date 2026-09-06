<!-- Ventana de ajustes: cabecera, pestañas y pila de avisos. -->
<script>
    import Header from "./components/Header.svelte"
    import TabBar from "./components/TabBar.svelte"
    import NoVoiceAlert from "./components/NoVoiceAlert.svelte"
    import VoiceTop from "./components/VoiceTop.svelte"
    import GeneralPanel from "./components/GeneralPanel.svelte"
    import VoicesPanel from "./components/VoicesPanel.svelte"
    import NoticesPanel from "./components/NoticesPanel.svelte"
    import LogsPanel from "./components/LogsPanel.svelte"
    import ToastDock from "./components/ToastDock.svelte"
    import { markRead } from "./lib/notifications.svelte.js"
    import { refreshStatus } from "./lib/status.svelte.js"
    import { refreshVoices } from "./lib/voices.svelte.js"
    import { refreshLog } from "./lib/log.svelte.js"

    // "logs" no tiene botón en la barra: solo se llega desde Avisos.
    let tab = $state("general")

    function selectTab(next) {
        tab = next
        if (next === "avisos") {
            markRead()
        }
        if (next === "logs") {
            refreshLog()
        }
    }

    $effect(() => {
        refreshStatus()
        const timer = setInterval(() => {
            refreshStatus({ quiet: true })
            refreshVoices()
            if (tab === "logs") {
                refreshLog()
            }
        }, 1000)
        return () => clearInterval(timer)
    })
</script>

<div class="flex h-screen flex-col">
    <div class="h-1.25 flex-none bg-red"></div>

    <Header />
    <TabBar active={tab} onselect={selectTab} />
    <NoVoiceAlert onopenvoices={() => selectTab("voces")} />

    <div class="scroll-hidden flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-5">
        {#if tab === "general" || tab === "voces"}
            <VoiceTop />
        {/if}

        <!-- Ocultos en vez de desmontados: conservan búsqueda, segmento y filas abiertas. -->
        <div class:hidden={tab !== "general"}><GeneralPanel /></div>
        <div class:hidden={tab !== "voces"}><VoicesPanel /></div>
        <div class:hidden={tab !== "avisos"}><NoticesPanel onopenlogs={() => selectTab("logs")} /></div>
        <div class:hidden={tab !== "logs"}><LogsPanel /></div>
    </div>
</div>

<ToastDock />
