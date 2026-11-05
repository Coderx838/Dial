// bubble.js -- wobbly borders and speech bubbles(yay i loved them)


const TOP_FRAMES = [
  ".~ - . _ . ~ - . _ . - . _ ",
  "- . ~ - . _ . ~ - . _ . - _",
  "_ - . ~ - . _ . ~ - . _ . -",
];

const BOT_FRAMES = [
  "` - . _ ~ . - - . _ . - ~ '",
  " - ` . _ ~ . - - . _ . - ~ '",
  ". _ ` - . _ ~ . - - . _ . - ",
];

// a full width wobbly line for frame chrome
function wobbleLine(width, frame, which){
    const frames = which === "bot" ? BOT_FRAMES : TOP_FRAMES;
    const pat = frames[frame % frames.length];
    let s = "";
    while (s.length < width) s += pat;
    return s.slice(0, width);
}

// the speech bubble around a message. top wobble, content lines with
// parens on the side and all directions , yeh they are good

function bubble(text, width, frame, inkColor, theme) {
  const inner = width;
  const rows = [];

  // top
  const top = wobbleLine(inner + 4, frame, "top");
  rows.push(["  " + top, inkColor]);

  // content
  const lines = wrapLocal(text, inner - 1); // for leading space
  for (const line of lines) {
    const padded = line.padEnd(inner, " ");
    rows.push([" (" + padded + ")", inkColor]);
  }

  // bottom
  const bot = wobbleLine(inner + 4, frame, "bot");
  rows.push(["  " + bot, inkColor]);

  return rows;
}

// small local wrap so buuble.js doesn;t depend on radio.js yeh

function wrapLocal(text, width) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur.length === 0) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
    while (Array.from(cur).length > width) {
      lines.push(Array.from(cur).slice(0, width).join(""));
      cur = Array.from(cur).slice(width).join("");
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}


// the little "\" tail pointing from bubble down to the speakers'doodle

function speechTail(indent, color) {
  return [" ".repeat(indent) + "\\", color];
}


// torn paper edge for top/bottom of the whole screen
function tornEdge(width, frame) {
  const pat = "/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/";
  let s = "";
  while (s.length < width) s += pat;
  // rotate a little by frame so the tear wiggles too
  const off = frame % 3;
  s = s.slice(off) + s.slice(0, off);
  return s.slice(0, width);
}

// a dotted separator line (the ". . . ." under the chat area)
function dotLine(width, color) {
  let s = "";
  while (s.length < width) s += ". ";
  return s.slice(0, width);
}

module.exports = {
  TOP_FRAMES, BOT_FRAMES,
  wobbleLine, bubble, speechTail, tornEdge, dotLine,
};


  
