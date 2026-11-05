// session.js - one of these per ssh connection.
// handle all the things for dial like chat commands etc. in real time.

const {
  ENTER_ALT, LEAVE_ALT, CURSOR_HIDE, CURSOR_SHOW,
  styledLine, padParts, visibleWidth, moveCursor,
  bg, hexToRgb, CLEAR_ALL, CLEAR_LINE, // lag fix
} = require("./ansi");
const { buildInput } = require("./screen") // lag fix
const { getTheme, nextTheme, THEME_ORDER } = require("./themes");
const { DOODLES, getDoodle, doodleLabel } = require("./doodles");
const {
  tune, clamp, snap, FREQ_MIN, FREQ_MAX, MAX_AUDIBLE,
  signalStrength, isAudible, signalBar,
} = require("./radio");
const { renderFrame, BOIL_MS } = require("./screen");

// chooses where to freshdrop idk why.
function pickStartFreq(hub) {
  const live = hub.liveSessions();
  if (live.length > 0) {
    const random = live[Math.floor(Math.random() * live.length)];
    // sit within a MHz or so of a real person
    const offset = (Math.random() * 1.6 - 0.8);
    return snap(random.freq + offset);
  }
  return 104.2;
}

class Session {
  constructor(client, stream, hub, server) {
    this.client = client;
    this.stream = stream;
    this.hub = hub;
    this.server = server;

    this.id = 0;
    this.phase = "handle";
    this.handle = "";
    this.pendingHandle = "";
    this.doodleIdx = Math.floor(Math.random() * DOODLES.length);
    this.theme = getTheme("parchment");
    this.freq = 104.2;

    this.cols = 80;
    this.rows = 24;

    this.input = "";
    this.cursor = 0;

    this.dirty = false;
    this.rendering = false;
    this.closed = false;

    this.ctrlCArmed = false;

    hub.add(this);
  }

  // ---- lifecycle ------------------------------------------------------------

  start() {
    this.stream.write(ENTER_ALT);
    this.showSplash();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    const wasLive = this.phase === "chat";
    this.hub.remove(this.id);
    try {
      this.stream.write(LEAVE_ALT);
    } catch (e) { /* they're already gone, whatever */ }
    if (wasLive) {
      this.hub.announce(this.handle + " went off air", this.freq);
    }
  }

  resize(cols, rows) {
    if (cols > 0) this.cols = cols;
    if (rows > 0) this.rows = rows;
    if (this.phase === "chat") this.markDirty();
  }

  // ---- join flow ------------------------------------------------------------

  showSplash() {
    const t = this.theme;
    const w = Math.min(this.cols, 64);
    const lines = [];
    const torn = "/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/";
    lines.push(torn.slice(0, w));
    lines.push("");
    lines.push("     ~*  D I A L  *~");
    lines.push("");
    lines.push("   a small radio chat. ssh in, pick a handle,");
    lines.push("   and turn the dial until you find someone.");
    lines.push("");
    lines.push("   no rooms. no feeds. no logs that matter.");
    lines.push("   just frequencies, and whoever happens to");
    lines.push("   be sitting on yours.");
    lines.push("");
    lines.push("\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/".slice(0, w));
    lines.push("");

    let out = bg(...hexToRgb(t.bg));
    for (const line of lines) {
      out += styledLine([[line, t.ink]], t);
      out += "\r\n";
    }
    out += styledLine([[" what should i call you? ", t.accent]], t);
    if (this.pendingHandle) {
      // echo the prefilled username so it's not a ghost in the buffer
      out += styledLine([[this.pendingHandle, t.ink]], t);
    }
    out += CURSOR_SHOW;
    this.stream.write(out);
  }

  showDoodlePicker() {
    const t = this.theme;
    let out = "\r\n";
    out += styledLine([[" pick a face (1-" + DOODLES.length + "):", t.accent]], t);
    out += "\r\n\r\n";

    // two columns so it doesn't run forever vertically
    const cols = 2;
    const perRow = Math.ceil(DOODLES.length / cols);
    for (let row = 0; row < perRow; row++) {
      let line = "   ";
      for (let c = 0; c < cols; c++) {
        const i = c * perRow + row;
        if (i >= DOODLES.length) continue;
        const num = String(i + 1).padStart(2, " ");
        const face = DOODLES[i].top.padEnd(12, " ");
        line += num + ". " + face + "  ";
      }
      out += styledLine([[line, t.ink]], t);
      out += "\r\n";
    }
    out += "\r\n";
    out += styledLine([[" > ", t.accent]], t);
    out += CURSOR_SHOW;
    this.stream.write(out);
  }

  enterChat() {
    this.phase = "chat";
    this.freq = pickStartFreq(this.hub);
    this.input = "";
    this.cursor = 0;

    // greet the room , my greetingss room. ))
    this.hub.announce(this.handle + " tuned in nearby", this.freq);

    // first frame
    this.renderNow();
  }

  // ---- rendering ------------------------------------------------------------

  markDirty() {
    if (this.closed || this.phase !== "chat") return;
    this.dirty = true;
  }

  // called by the server's boil tick
  tick(boilFrame) {
    if (this.closed || this.phase !== "chat") return;
    this.boilFrame = boilFrame;
    this.renderNow();
  }

  renderNow() {
    if (this.closed || this.phase !== "chat") return;
    const frame = renderFrame(this, this.hub, this.boilFrame || 0);
    try {
      this.stream.write(frame.output);
      this.dirty = false;
    } catch (e) {
      console.error("[dial] render failed for", this.handle || this.id, e.message);
      this.close();
    }
  }

  // um its does not render whole screen okay to reduce latency and lag.
  // now , cuz before it was lagging very much
  renderInputLine() {
    if (this.closed || this.phase !== "chat") return;
    const t = this.theme;
    const input = buildInput(this,t,this.cols);

    // move to start of input row, rewrite it , clear rest od row , yeh then park the cursor
    const out =
      moveCursor(input.cursorRow, 1) +
      styledLine(padParts(input.row, this.cols), t) +
      CLEAR_LINE +
      moveCursor(input.cursorRow, input.cursorCol);
    
      try {
        this.stream.write(out);
      } catch(e){
        this.close();
      }  
    
  }  // okay now it got fancier yeh.

  // ---- input handling -------------------------------------------------------

  onData(data) {
    if (this.closed) return;
    const str = data.toString("utf8");

    if (this.phase === "handle") {
      this.handleInput(str);
    } else if (this.phase === "doodle") {
      this.doodleInput(str);
    } else if (this.phase === "chat") {
      this.chatInput(str);
    }
  }

  // --- join: handle prompt
  handleInput(str) {
    for (const ch of str) {
      const code = ch.codePointAt(0);
      if (ch === "\r" || ch === "\n") {
        const name = this.pendingHandle.trim();
        if (name.length >= 1) {
          this.handle = sanitizeHandle(name);
          this.pendingHandle = "";
          this.stream.write("\r\n");
          this.showDoodlePicker();
          this.phase = "doodle";
          return;
        }
        // empty - nudge
        this.stream.write(styledLine(
          [["   (at least one character, yeah?)", this.theme.muted]],
          this.theme
        ));
        this.stream.write("\r\n" + styledLine(
          [[" what should i call you? ", this.theme.accent]],
          this.theme
        ));
        return;
      }
      if (ch === "\x7f" || ch === "\x08") {
        if (this.pendingHandle.length > 0) {
          this.pendingHandle = this.pendingHandle.slice(0, -1);
          this.stream.write("\b \b");
        }
        continue;
      }
      if (ch === "\x03") { // ctrl+c
        this.close();
        return;
      }
      if (code < 32) continue; // skip other control chars
      if (this.pendingHandle.length < 16) {
        this.pendingHandle += ch;
        this.stream.write(ch);
      }
    }
  }

  // --- join
  doodleInput(str) {
    for (const ch of str) {
      if (ch === "\x03") {
        this.close();
        return;
      }
      const n = parseInt(ch, 10);
      if (!isNaN(n) && n >= 1 && n <= DOODLES.length && ch.length === 1) {
        this.doodleIdx = n - 1;
        this.stream.write(ch + "\r\n");
        const t = this.theme;
        let out = "\r\n";
        out += styledLine([["   ok " + this.handle + ", you're ", t.ink]], t);
        out += styledLine([[doodleLabel(this.doodleIdx), t.accent]], t);
        out += styledLine([[". welcome to the band.", t.ink]], t);
        out += "\r\n";
        out += styledLine([["   ( <- -> tunes the dial, /help lists commands )", t.muted]], t);
        out += "\r\n\r\n";
        this.stream.write(out);
        setTimeout(() => {
          if (!this.closed) this.enterChat();
        }, 600);
        this.phase = "joining";
        return;
      }
    }
  }

  // --- chat
  chatInput(str) {
    const chars = Array.from(str);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];

      
      if (ch === "\x1b") {
        // try to consume a known sequence
        const rest = chars.slice(i + 1).join("");
        const seq = readEscape(rest);
        if (seq) {
          i += seq.consumed;
          this.handleKey(seq.key);
          continue;
        }
        // unknown escape - swallow the esc and move on
        continue;
      }

      this.handleKey(ch);
    }
  }

  handleKey(key) {
    // --- global-ish keys
    if (key === "\x03") { // ctrl+c
      if (this.ctrlCArmed) {
        this.sayGoodbye();
        this.close();
      } else {
        this.ctrlCArmed = true;
        this.showHint("( ctrl+c again to go off air )");
        setTimeout(() => { this.ctrlCArmed = false; }, 2000);
      }
      return;
    }
    if (key === "\x04") { // ctrl+d - quit if input empty
      if (this.input.length === 0) {
        this.sayGoodbye();
        this.close();
      }
      return;
    }
    if (key === "\x0c") { // ctrl+l - redraw
      this.renderNow();
      return;
    }

    // --- the dial
    if (key === "left") {
      this.retune(-1);
      return;
    }
    if (key === "right") {
      this.retune(1);
      return;
    }

    // --- editing
    if (key === "\r" || key === "\n") {
      this.sendMessage();
      return;
    }
    if (key === "\x7f" || key === "\x08") { // backspace
      if (this.cursor > 0) {
        const before = this.input.slice(0, this.cursor - 1);
        const after = this.input.slice(this.cursor);
        this.input = before + after;
        this.cursor--;
        this.renderInputLine();
      }
      return;
    }
    if (key === "\x1b[3~") { // delete
      if (this.cursor < this.input.length) {
        const before = this.input.slice(0, this.cursor);
        const after = this.input.slice(this.cursor + 1);
        this.input = before + after;
        this.renderInputLine();
      }
      return;
    }
    if (key === "\x01") { // ctrl+a - home
      this.cursor = 0;
      this.renderInputLine();
      return;
    }
    if (key === "\x05") { // ctrl-e - end
      this.cursor = this.input.length;
      this.renderInputLine();
      return;
    }
    if (key === "home" || key === "\x1b[H" || key === "\x1b[1~") {
      this.cursor = 0;
      this.renderInputLine();
      return;
    }
    if (key === "end" || key === "\x1b[F" || key === "\x1b[4~") {
      this.cursor = this.input.length;
      this.renderInputLine();
      return;
    }

    // --- printable
    const code = key.codePointAt(0);
    if (code >= 32 && code !== 127) {
      if (this.input.length < 240) {
        const before = this.input.slice(0, this.cursor);
        const after = this.input.slice(this.cursor);
        this.input = before + key + after;
        this.cursor += Array.from(key).length;
        this.renderInputLine();
      }
      return;
    }
  }

  retune(dir) {
    const old = this.freq;
    const next = clamp(tune(this.freq, dir));
    if (next === old) return;
    this.freq = next;
    this.ctrlCArmed = false;
    this.markDirty();
    this.renderNow();
  }

  sendMessage() {
    const text = this.input.trim();
    this.input = "";
    this.cursor = 0;
    if (text.length === 0) {
      this.renderNow();
      return;
    }

    // commands
    if (text.startsWith("/")) {
      this.runCommand(text);
      return;
    }

    this.hub.broadcast(this, text);
    this.renderNow();
  }

  sayGoodbye() {
    try {
      this.hub.announce(this.handle + " went off air", this.freq);
    } catch (e) { /* fine */ }
  }

  showHint(text) {
    
    // for now just ignore does not have time 
  }

  // ---- commands -------------------------------------------------------------

  runCommand(text) {
    const parts = text.slice(1).split(/\s+/);
    const cmd = (parts[0] || "").toLowerCase();
    const arg = parts.slice(1).join(" ");

    switch (cmd) {
      case "help":
      case "h":
      case "?":
        this.cmdHelp();
        break;
      case "theme":
        this.cmdTheme(arg);
        break;
      case "doodle":
        this.cmdDoodle(arg);
        break;
      case "name":
        this.cmdName(arg);
        break;
      case "who":
        this.cmdWho();
        break;
      case "freq":
      case "tune":
        this.cmdFreq(arg);
        break;
      case "stats":
        this.cmdStats();
        break;
      case "quit":
      case "exit":
      case "q":
        this.sayGoodbye();
        this.close();
        break;
      default:
        this.systemSay("unknown command: /" + cmd + "  (try /help)");
        break;
    }
    this.renderNow();
  }

  systemSay(text) {
    this.hub.announce(text, this.freq);
  }

  cmdHelp() {
    const t = this.theme;
    const lines = [
      "",
      "  . - ~ . _ . ~ - . _ . - . - . _ . ~ - . _ . - .",
      " (  D I A L  -  commands                        )",
      "  ` - . _ ~ . - - . _ . - ~ ' - . _ ~ . - - . _ '",
      "",
      "   <- ->        turn the dial. find people.",
      "   /freq 98.5   jump to a frequency",
      "   /who         who's on air near you",
      "   /theme x     parchment | pad | chalk | blueprint",
      "   /doodle n    change your little face (1-" + DOODLES.length + ")",
      "   /name x      change what people call you",
      "   /stats       how many of us are out there",
      "   /quit        go off air",
      "",
      "   messages degrade with distance. exact same",
      "   frequency = crisp and green. drift a little",
      "   and consonants start dropping out.",
      "",
    ];
    for (const line of lines) {
      this.hub.announce(line, this.freq);
    }
  }

  cmdTheme(arg) {
    const name = (arg || "").toLowerCase().trim();
    if (!name) {
      this.systemSay("themes: " + THEME_ORDER.join(", ") + "  (you're on " + this.theme.name + ")");
      return;
    }
    const found = THEME_ORDER.find((n) => n.startsWith(name));
    if (!found) {
      this.systemSay("no theme called '" + name + "'. try: " + THEME_ORDER.join(", "));
      return;
    }
    this.theme = getTheme(found);
    this.systemSay("switched to " + found + " paper.");
  }

  cmdDoodle(arg) {
    const n = parseInt(arg, 10);
    if (isNaN(n) || n < 1 || n > DOODLES.length) {
      this.systemSay("pick 1-" + DOODLES.length + ".  /doodle 3 for example.");
      return;
    }
    this.doodleIdx = n - 1;
    this.systemSay("new face: " + doodleLabel(this.doodleIdx));
  }

  cmdName(arg) {
    const name = (arg || "").trim();
    if (name.length < 1) {
      this.systemSay("give me something. /name sam");
      return;
    }
    const old = this.handle;
    this.handle = sanitizeHandle(name);
    this.systemSay(old + " is now " + this.handle);
  }

  cmdWho() {
    const live = this.hub.liveSessions();
    if (live.length === 0) {
      this.systemSay("just you on the radio right now.");
      return;
    }
    this.systemSay("--- " + live.length + " on air ---");
    // sort by distance from us
    const sorted = live.slice().sort((a, b) => {
      return Math.abs(a.freq - this.freq) - Math.abs(b.freq - this.freq);
    });
    for (const s of sorted) {
      const delta = Math.abs(s.freq - this.freq);
      const bar = signalBar(signalStrength(delta), 8);
      const me = s.id === this.id ? " (you)" : "";
      if (s.id === this.id) continue; // don't list yourself, that's sad
      const heard = isAudible(delta) ? bar : "........";
      const line = "   " + s.handle.padEnd(12, " ") +
        s.freq.toFixed(1).padStart(5, " ") + " MHz   " + heard +
        (isAudible(delta) ? "" : "  (too far)");
      this.systemSay(line);
    }
  }

  cmdFreq(arg) {
    const n = parseFloat(arg);
    if (isNaN(n)) {
      this.systemSay("jump where? /freq 101.3");
      return;
    }
    const next = clamp(n);
    this.freq = next;
    this.markDirty();
    this.renderNow();
  }

  cmdStats() {
    const live = this.hub.liveSessions();
    const near = this.hub.nearby(this.freq, MAX_AUDIBLE).length;
    this.systemSay(live.length + " on air worldwide, " + near + " near " + this.freq.toFixed(1) + " MHz");
  }
}

// ---- helpers -----------------------------------------------------------------

function sanitizeHandle(raw) {
  // strip anything weird, keep it short and readable
  let s = Array.from(raw).filter((ch) => {
    const c = ch.codePointAt(0);
    return (c >= 32 && c < 127) || (c >= 160); // printable ascii or non-ascii text
  }).join("");
  s = s.trim().slice(0, 16);
  if (s.length === 0) s = "anon";
  return s;
}

// pull an escape sequence out of the remaining chars.
// returns { key, consumed } or null.
function readEscape(rest) {
  // arrow keys: [A up, [B down, [C right, [D left
  if (rest.length >= 1 && rest[0] === "[") {
    const c = rest[1];
    if (c === "A") return { key: "up", consumed: 2 };
    if (c === "B") return { key: "down", consumed: 2 };
    if (c === "C") return { key: "right", consumed: 2 };
    if (c === "D") return { key: "left", consumed: 2 };
    if (c === "H") return { key: "home", consumed: 2 };
    if (c === "F") return { key: "end", consumed: 2 };
    // longer sequences like [3~ or [1;5C
    if (c >= "0" && c <= "9") {
      let j = 1;
      while (j < rest.length && /[0-9;]/.test(rest[j])) j++;
      const final = rest[j];
      const raw = "[" + rest.slice(1, j + 1);
      if (final === "~") {
        const num = rest.slice(1, j);
        if (num === "1" || num === "7") return { key: "home", consumed: j + 1 };
        if (num === "4" || num === "8") return { key: "end", consumed: j + 1 };
        if (num === "3") return { key: "\x1b[3~", consumed: j + 1 }; // delete
      }
      // unknown CSI - swallow it whole so it doesn't become garbage text
      return { key: "ignored", consumed: j + 1 };
    }
  }
  // alt-something or unknown - swallow just the esc
  return null;
}

module.exports = { Session };
