/**
 * Is the keystroke going into a text field?
 *
 * Every tool needs this the moment it takes a window-level shortcut, because a
 * text field owns its own Cmd+Z and stealing it while someone is typing the
 * artwork's words is maddening. Both tools wrote their own version; the second
 * one left out `isContentEditable`, which is exactly the kind of quiet
 * divergence one function prevents.
 */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}
