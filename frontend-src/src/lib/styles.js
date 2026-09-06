// Clases repetidas en varios componentes. Se escriben enteras: Tailwind las
// busca como texto literal.

const BTN_BASE =
    "flex-1 cursor-pointer rounded-[10px] border-none px-3.5 py-2.5 text-[13px] font-[650] transition-[background,transform] duration-150 active:scale-[0.97] disabled:cursor-default disabled:opacity-55 disabled:active:scale-100"

export const BTN_PRIMARY = `${BTN_BASE} bg-red text-onred hover:bg-red-hi`
export const BTN_SECONDARY = `${BTN_BASE} bg-line text-text hover:bg-line-hi`

export const INPUT =
    "w-full rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-text focus:outline-2 focus:outline-red focus:-outline-offset-1"

export const CARD =
    "flex flex-none flex-col gap-3 rounded-xl border border-line bg-panel px-3.75 py-3.5 shadow-[0_2px_8px_rgba(61,51,44,0.06)]"
