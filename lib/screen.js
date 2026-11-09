// screen.js -- composes the full reminal frame



// okay everything in the theme paper



const {
    styledLine, padParts, visibleWidth, moveCursor,
    CURSOR_HIDE, CURSOR_SHOW, bg, hexToRgb,
} = require("./ansi");

const {
    wobbleLine, bubble, speechTail, tornEdge, dotLine,

} = require("./bubble");

const{
    signalStrength, isAudible, distort, wrapText, signalBar, MAX_AUDIBLE,
} = require("./radio");

const { getDoodle } = require("./doodles")

const BOIL_MS = 320;

// date render for evry message , today as plain time , 
// yesterday as "Yday" and anything older in date format "MM-DD"

function dateLabel(time, date){
  if (!date) return time;
  const today = new Date();
  const todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  if (date === todayStr) return time;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.getFullYear() + "-" + String(yesterday.getMonth() + 1).padStart(2, "0") + "-" + String(yesterday.getDate()).padStart(2, "0");
  if (date === yesterdayStr) return "Yday " + time;
  return date.slice(5) + " " + time;
}



// build one full frame for a session

function renderFrame(session, hub, boilFrame){
    const theme = session.theme;
    const cols = session.cols;
    const rows = session.rows;
    const parts = []; // array of the parts-arrays
    let inputParts = null;


    parts.push([[tornEdge(cols,boilFrame), theme.muted]]);
    
    parts.push(headerRow(session, theme, cols, boilFrame));

    parts.push([[wobbleLine(cols, boilFrame, "top"), theme.ink]]);


    if (session.showingHelp && session.helpLines && session.helpLines.length){
      const helpStart = 3;
      const helpHeight = Math.max(1, rows - helpStart - 2);
      let hi = 0;
      for (let i = 0; i < helpHeight; i++){
        let line = session.helpLines[hi] || "";
        hi++;
        line = line + " ".repeat(Math.max(0, cols - visibleWidth(line)));
        parts.push([[line, theme.ink]]);
      }

      //bottom wobbly border
      parts.push([[wobbleLine(cols, boilFrame + 1, "bot"), theme.ink]]);
      // status lines
      parts.push(statusRow(session, hub, theme, cols));
    } else {
      // chat area : rows 3 ,, rows-5

      const chatTop = 3;
      const footerRows = 4; // dots , input , wobbly bot, status
      const chatHeight = Math.max(1,rows - chatTop - footerRows);

      const chatLines = buildChat(session, hub, cols, theme, boilFrame);
      // take the last chatHeight lines so new message push old ones up
      let slice = chatLines.slice(-chatHeight);
      // pad at top if we don't have enough yet
      const pad = chatHeight - slice.length;
      for (let i = 0; i < pad; i++){
          parts.push(marginRow("", cols, theme));

      }
      for (const line of slice){
          parts.push(line);
      }

      // -- seperator dots --- 

      parts.push(marginRow(dotLine(Math.max(0, cols - 6), boilFrame), cols, theme, theme.muted));

      //---  input line ----
      inputParts = buildInput(session, theme, cols);
      parts.push(inputParts.row);

      // ---- wobble border under input ---\

      parts.push([[wobbleLine(cols, boilFrame + 1, "bot"), theme.ink]]);

      // --- status line ---

      parts.push(statusRow(session, hub, theme, cols));
    }  

    // pad or trim to exactly `rows`
    while (parts.length < rows){
        parts.push(marginRow("", cols, theme));
    
    }
    if (parts.length > rows){
        parts.length = rows;
    }


    // compose the actual output string
    const paper = bg(...hexToRgb(theme.bg));
    let out = CURSOR_HIDE + paper;
    for (let i = 0; i < parts.length; i++){
        if (i > 0) out += "\r\n";
        out += styledLine(padParts(parts[i], cols), theme);
    }

    //park the cursor on the input line where the user is typing
    if(session.showingHelp){
      out += moveCursor(rows, 1);
    }else {
      out += moveCursor(inputParts.cursorRow, inputParts.cursorCol);
    }  
    out += CURSOR_SHOW;

    return {
      output : out,
      cursorRow :  session.showingHelp ? rows: inputParts.cursorRow,
      cursorCol : session.showingHelp ? 1 : inputParts.cursorCol,
    };
}    


// -- header: title on the left, tuned-to + signal on the right

function headerRow(session, theme, cols, frame) {
  const title = " ~* [ D I A L ] *~ ";
  const freq = session.freq.toFixed(1);
  const strength = 0; // your own signal is always perfect, you're the transmitter
  const bar = signalBar(0, 8);
  const right = `( tuned to ${freq} MHz )  ${bar} `;
  const gap = cols - visibleWidth(title) - visibleWidth(right);
  const mid = " ".repeat(Math.max(1, gap));
  return [
    [title, theme.accent],
    [mid, null],
    [right, theme.ink],
  ];
}

// --- a chat row: left margin pipe + content
function marginRow(text, cols, theme, color) {
  const marginChar = "|";
  const margin = marginChar + " ";
  return [
    [margin, theme.margin],
    [text, color || theme.ink],
  ];
}


// -- build all audible mesage block for the chat area


function buildChat(session, hub, cols, theme, frame) {
  const out = [];
  const msgs = hub.audibleHistory(session.freq);
  const bubbleWidth = Math.max(18, Math.min(44, cols - 18));
  const avatarIndent = Math.max(14, Math.min(30, Math.floor(cols * 0.36)));

  if (msgs.length === 0) {
    const empty = [
      "",
      "",
      "  . - ~ . _ . ~ - . _ . - .",
      " (  the air is quiet here.  )",
      "  ` - . _ ~ . - - . _ . - '",
      "",
      "   turn the dial <- -> and see who you find.",
    ];
    for (const line of empty) {
      out.push(marginRow(line, cols, theme, theme.muted));
    }
    return out;
  }

  const recent = msgs.slice(-25);

  for (const msg of recent) {
    const delta = Math.abs(session.freq - msg.freq);
    const strength = msg.system ? 0 : signalStrength(delta);

    if (msg.system) {
      out.push(marginRow("", cols, theme));
      out.push(marginRow("  ~ " + msg.text + " ~", cols, theme, theme.muted));
      out.push(marginRow("", cols, theme));
      continue;
    }

    // pick colors based on signal quality
    let handleCol, textCol, bubbleCol;
    if (strength <= 0.02) {
      handleCol = theme.clear;
      textCol = theme.clear;
      bubbleCol = theme.clear;
    } else if (strength > 0.65) {
      handleCol = theme.muted;
      textCol = theme.muted;
      bubbleCol = theme.muted;
    } else {
      handleCol = theme.ink;
      textCol = theme.ink;
      bubbleCol = theme.ink;
    }

    // timestamp + handle
    const distortedHandle = distort(msg.handle, strength * 0.6, msg.id);
    const datePart = dateLabel(msg.time, msg.date); // date 
    const label = "  " + datePart + "  <" + distortedHandle + ">";
    out.push(marginRow(label, cols, theme, handleCol));

    // speech bubble
    const distortedText = distort(msg.text, strength, msg.id);
    const bubbleRows = bubble(distortedText, bubbleWidth, frame, bubbleCol, theme);
    for (const r of bubbleRows) {
      // build a margin row whose content is the bubble line
      // r is already [text, color] - we need "| " + text
      out.push([
        ["| ", theme.margin],
        [r[0], r[1]],
      ]);
    }

    // tail + doodle (skip for very short terminals)
    if (session.rows >= 18) {
      const doodle = getDoodle(msg.doodleIdx);
      const tail = " ".repeat(avatarIndent) + "\\";
      out.push([
        ["| ", theme.margin],
        [tail, theme.accent],
      ]);
      const dTop = " ".repeat(avatarIndent) + doodle.top;
      const dBot = " ".repeat(avatarIndent) + doodle.bot;
      out.push([
        ["| ", theme.margin],
        [dTop, theme.accent],
      ]);
      out.push([
        ["| ", theme.margin],
        [dBot, theme.accent],
      ]);
      const itemChar = msg.item;
      if (itemChar){
        const dItem = " ".repeat(avatarIndent) + itemChar;
        out.push([
          ["| ", theme.margin],
          [dItem, theme.accent],
        ]);
      }
    }
    // spacer between messages
    out.push(marginRow("", cols, theme));
  }

  
  return out;
}


// -- input line

function buildInput(session , theme, cols){
    const prompt  = "[pencil]: ";
    const maxInput = Math.max(8, cols - visibleWidth(prompt) - 6);
    let shown = session.input || "";
    let cursorOffset = session.cursor; // indes into input string

    // horizontal scroll if input is longer thatn the fild
    let start = 0;
    if (shown.length > maxInput){
        if (cursorOffset > maxInput - 2) start = cursorOffset - maxInput + 2;
        if (start > shown.length - maxInput) start = Math.max(0, shown.length - maxInput);

    }

    const visible = shown.slice(start, start + maxInput);
    const field = visible.padEnd(maxInput, "_");
    const pencil = " ✎";
    
    // cursor col on screen(1-based)

    const cursorCol = 2 + visibleWidth(prompt) + (cursorOffset - start) + 1;
    const cursorRow = session.rows - 2; // lag fixing .

    let fieldParts;
    if (shown.length === 0){
        fieldParts = [
            [prompt, theme.accent],
            ["Type a message...", theme.muted],
            [" ".repeat(Math.max(0, maxInput -16)), null],
            [pencil, theme.accent],
        ];

    } else {
        fieldParts =[
            [prompt, theme.accent],
            [field, theme.ink],
            [pencil, theme.accent],
        ];
    }

    const row = [
        ["| ", theme.margin],
        ...fieldParts,
    ];

    return { row, cursorRow, cursorCol};
}

// --- status line at the very bottom
function statusRow(session, hub, theme, cols) {
  const nearby = hub.nearby(session.freq, MAX_AUDIBLE);
  const names = nearby
    .filter((s) => s.id !== session.id)
    .map((s) => s.handle)
    .slice(0, 4);
  let left;
  if (names.length === 0) {
    left = "  no one nearby. keep turning.";
  } else if (names.length === 1) {
    left = "  on air near you: " + names[0];
  } else {
    left = "  on air near you: " + names.join(", ");
  }
  const right = " <- -> tune  /help  ";
  const gap = cols - visibleWidth(left) - visibleWidth(right);
  const mid = " ".repeat(Math.max(1, gap));
  return [
    [left, theme.muted],
    [mid, null],
    [right, theme.muted],
  ];
}


module.exports = {renderFrame, BOIL_MS , buildInput };