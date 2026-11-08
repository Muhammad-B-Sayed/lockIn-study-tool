/** True when a global shortcut should not fire for this key event. */
export function ignoreShortcut(e: KeyboardEvent, opts: { allowOnButtons?: boolean } = {}) {
  if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return true
  const t = e.target as HTMLElement | null
  if (!t?.closest) return false
  if (t.closest('input, textarea, select, [contenteditable="true"], dialog')) return true
  if (!opts.allowOnButtons && t.closest('button, a, [role="radio"], [role="option"], summary')) return true
  return false
}
