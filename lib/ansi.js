// ansi.js - tiny helpers for 24-bit color and screen control

// we paint all things yay!

const ESC = "\x1b[";

const fg = (r, g, b) => `${ESC}38;2;${r};${g};${b}m`;
const bg = (r, g, b) => `${ESC}48;2;${r};${g};${b}m`;
const RESET = `${ESC}0m`;

const CURSOR_HOME = `${ESC}H`;
const CURSOR_HIDE = `${ESC}?25l`;
const CURSOR_SHOW = `${ESC}?25h`;
const CLEAR_ALL = `${ESC}2J${ESC}H`;
const CLEAR_DOWN = `${ESC}J`;
const ENTER_ALT = `${ESC}?1049h`;
const LEAVE_ALT = `${ESC}?1049l`;

// "#rrggbb" -> [r,g,b]
function hexToRgb(h) {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

// parts: [[text, fgHexOrNull], ...] -> one full-width themed line.
// bg persists across fg switches so the paper never flickers through.
function styledLine(parts, theme) {
  let s = bg(...hexToRgb(theme.bg));
  for (const [text, color] of parts) {
    if (color) s += fg(...hexToRgb(color));
    s += text;
  }
  return s + RESET;
}

// pad a line (array of parts) out to width so the paper covers the row
function padParts(parts, width) {
  let used = 0;
  for (const [text] of parts) used += visibleWidth(text);
  if (used < width) parts.push([" ".repeat(width - used), null]);
  return parts;
}

// visible chars, ignoring anything we slipped in that's zero-width
function visibleWidth(str) {
  // strip ANSI sequences for measuring
  return str.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").length;
}

// position cursor at 1-based row/col
function moveCursor(row, col) {
  return `${ESC}${row};${col}H`;
}

module.exports = {
  ESC, fg, bg, RESET,
  CURSOR_HOME, CURSOR_HIDE, CURSOR_SHOW,
  CLEAR_ALL, CLEAR_DOWN, ENTER_ALT, LEAVE_ALT,
  hexToRgb, styledLine, padParts, visibleWidth, moveCursor,
};
