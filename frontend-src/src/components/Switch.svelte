<!-- Interruptor de las preferencias. -->
<script>
    import Icon from "./Icon.svelte"

    let { checked = $bindable(false), label, icon, onchange } = $props()
</script>

<label class="flex items-center justify-between gap-2.5">
    <span class="flex items-center gap-2 text-[12.5px] font-semibold text-text">
        <Icon name={icon} class="h-3.75 w-3.75 flex-none text-muted" />
        {label}
    </span>
    <!-- El input va primero: peer-checked solo alcanza a hermanos posteriores. -->
    <span class="relative h-5.25 w-9 flex-none">
        <input
            type="checkbox"
            class="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
            bind:checked
            {onchange} />
        <span class="absolute inset-0 rounded-full bg-line transition-colors peer-checked:bg-red"></span>
        <span
            class="pointer-events-none absolute top-0.5 left-0.5 h-4.25 w-4.25 rounded-full bg-white shadow-[0_1px_2px_rgba(61,51,44,0.3)] transition-transform peer-checked:translate-x-3.75"
        ></span>
    </span>
</label>
