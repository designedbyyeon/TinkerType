/**
 * The artwork's own colours — the paper a poster is printed on and the ink on it.
 *
 * The companion to `tokens.css`: that file holds the colours of the *screen*,
 * this one holds the colours of the *work*. Both tools output onto the same
 * paper, so the value lives here rather than in either of them.
 *
 * Literals rather than `var(--…)`, and deliberately so: these are document
 * values that get serialised into the exported SVG, where a CSS variable would
 * resolve to nothing the moment the file is opened outside this app.
 *
 * CANVAS_INK is NOT --ink, and that is intended. The screen's ink is warm
 * (#14140f) because it sits under warm paper all day; the artwork's ink is
 * neutral because it is going to print. Do not "unify" them.
 */
export const CANVAS_GROUND = '#f4f3f0'
export const CANVAS_INK = '#101010'
