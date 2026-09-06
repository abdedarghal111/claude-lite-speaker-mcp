<!-- Barra de pestañas, con el contador de avisos sin leer. -->
<script>
    import Icon from "./Icon.svelte"
    import { notifications } from "../lib/notifications.svelte.js"

    let { active, onselect } = $props()

    const TABS = [
        { key: "general", label: "General", icon: "general" },
        { key: "voces", label: "Voces", icon: "voces" },
        { key: "avisos", label: "Avisos", icon: "bell" },
    ]

    // Relanza la animación del contador cada vez que sube.
    let bump = $state(0)
    $effect(() => {
        if (notifications.unread > 0) {
            bump = notifications.unread
        }
    })
</script>

<div class="mx-5 mb-3.5 flex flex-none gap-1 rounded-[11px] border border-line bg-panel p-1">
    {#each TABS as tab (tab.key)}
        <button
            type="button"
            class="relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none py-2.25 text-[12.5px] font-[650] transition-colors"
            class:bg-red={active === tab.key}
            class:text-onred={active === tab.key}
            class:bg-transparent={active !== tab.key}
            class:text-muted={active !== tab.key}
            onclick={() => onselect(tab.key)}>
            <Icon name={tab.icon} class="h-3.75 w-3.75" />
            {tab.label}
            {#if tab.key === "avisos" && notifications.unread > 0}
                {#key bump}
                    <span
                        class="absolute -top-1.25 right-2 flex h-3.75 min-w-3.75 items-center justify-center rounded-lg px-1 text-[9.5px] font-extrabold animate-[badge-bump_0.3s_ease]"
                        class:bg-red={active !== "avisos"}
                        class:text-onred={active !== "avisos"}
                        class:shadow-[0_0_0_2px_var(--color-panel)]={active !== "avisos"}
                        class:bg-onred={active === "avisos"}
                        class:text-red={active === "avisos"}
                        class:shadow-[0_0_0_2px_var(--color-red)]={active === "avisos"}>
                        {notifications.unread}
                    </span>
                {/key}
            {/if}
        </button>
    {/each}
</div>
