<!-- Pila de avisos emergentes. -->
<script>
    import Toast from "./Toast.svelte"
    import { notifications, dismissToast } from "../lib/notifications.svelte.js"
</script>

<div
    class="pointer-events-none fixed right-0 bottom-0 left-0 z-40 flex flex-col items-center gap-2.5 px-3.5 pb-3">
    {#each notifications.toasts as toast (toast.id)}
        <Toast event={toast} ondismiss={dismissToast} />
    {/each}
</div>
