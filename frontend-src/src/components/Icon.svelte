<!-- Iconos SVG de la interfaz. -->
<script>
    let { name, class: klass = "w-4 h-4", stroke = 1.75 } = $props()

    const PATHS = {
        general: '<path d="M3 12h2l2-7 3 14 3-10 2 5h6"/>',
        voces:
            '<rect x="3" y="4" width="4" height="4" rx="1"/><rect x="3" y="10" width="4" height="4" rx="1"/><rect x="3" y="16" width="4" height="4" rx="1"/><path d="M10 6h11M10 12h11M10 18h11"/>',
        bell: '<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M9.5 18a2.5 2.5 0 0 0 5 0"/>',
        power: '<path d="M12 2v8"/><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>',
        code: '<path d="m8 9-3 3 3 3M13 8l-2 8"/>',
        folder: '<path d="M3 7a2 2 0 0 1 2-2h3.2l2 2.5H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
        refresh:
            '<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M8 16H3v5"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-3.6-3.6"/>',
        copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
        check: '<path d="m5 13 4 4 10-10"/>',
        error: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
        warn: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/>',
        ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    }
</script>

<svg
    class={klass}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={stroke}
    stroke-linecap="round"
    stroke-linejoin="round">{@html PATHS[name]}</svg>
