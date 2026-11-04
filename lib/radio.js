// radio.js -- the freq dial and the signal thingy..


const FREQ_MIN = 88.0;
const FREQ_MAX = 108.0;
const FREQ_STEP = 0.1;


// past this many MHz away , you don't hear them at all

const MAX_AUDIBLE = 3.0;

// snap to the nearest tenth so floating point doesn't get weird

function snap(freq){
    const n = Math.round(freq * 10) / 10;
    return Math.min(FREQ_MAX, Math.max(FREQ_MIN, n));
}

function tune(freq, dir){
    return snap(freq + dir * FREQ_STEP);

}

function clamp(freq){
    return snap(freq);
}

function signalStrength(delta) {
  if (delta <= 0.001) return 0;
  const s = delta / MAX_AUDIBLE;
  return Math.min(1, Math.max(0, s));
}


function isAudible(delta){
    return delta <= MAX_AUDIBLE + 0.001;
}

// a tiny prng so the same mesage at the same signal strength
// always grables the same way.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VOWELS = "aeiouAEIOU";
const CONSONANTS = "bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ";
const NOISE = "~#$%^&*<>?/\\|+=";


// jumbles the messages , as the strength climbs, vowels turn to
// dashes first (hello -> h-llo), then constonants and so on.

function distort(text, strength, msgId) {
  if (strength <= 0.02) return text;
  if (strength >= 0.97) {
    // basically gone - just a burst of static
    const rng = mulberry32(msgId * 9973 + 7);
    let s = "";
    for (let i = 0; i < Math.min(12, 4 + Math.floor(rng() * 8)); i++) {
      s += NOISE[Math.floor(rng() * NOISE.length)];
    }
    return s;
  }

  const rng = mulberry32(msgId * 1000 + Math.round(strength * 40));
  const chars = Array.from(text);
  const out = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === " " || ch === "\t") {
      out.push(ch);
      continue;
    }
    const r = rng();

    // edge characters are more likely to be noise (static at the rim)
    const edgeBoost = (i < 2 || i > chars.length - 3) ? 0.15 : 0;

    if (r < strength * 0.25 + edgeBoost) {
      // pure noise char
      out.push(NOISE[Math.floor(rng() * NOISE.length)]);
    } else if (r < strength * 0.5 + edgeBoost) {
      // dropped - consonants go first, vowels become dashes
      if (CONSONANTS.includes(ch)) {
        if (r < strength * 0.2) {
          // actually gone
          continue;
        }
        out.push("-");
      } else if (VOWELS.includes(ch)) {
        out.push("-");
      } else {
        out.push(NOISE[Math.floor(rng() * NOISE.length)]);
      }
    } else {
      out.push(ch);
    }
  }

  return out.join("");
}


// wrap text 

function wrapText(text, width) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur.length === 0) {
      cur = w;
    } else if (cur.length + 1 + w.length <= width) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
    // absurdly long single word - hard split
    while (Array.from(cur).length > width) {
      lines.push(Array.from(cur).slice(0, width).join(""));
      cur = Array.from(cur).slice(width).join("");
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

// cross-hatch signal meter: lit cells are @, empty are .
// feels like a pencil shading bar instead of a unicode progress block.
function signalBar(strength, width) {
  width = width || 10;
  const lit = Math.max(0, Math.min(width, Math.round((1 - strength) * width)));
  return "@".repeat(lit) + ".".repeat(width - lit);
}


module.exports = {
  FREQ_MIN, FREQ_MAX, FREQ_STEP, MAX_AUDIBLE,
  snap, tune, clamp, signalStrength, isAudible,
  distort, wrapText, signalBar, mulberry32,
};

