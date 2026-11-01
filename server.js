// dial - a little radio chat you ssh into.
// um yeh cant think of more comment


const { Server } = require("ssh2");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { Hub } = require("./lib/hub");
const { Session } = require("./lib/session");

const PORT = parseInt(process.env.PORT || process.env.DIAL_PORT || "2222", 10);
const HOST = process.env.DIAL_HOST || "0.0.0.0";

// ---- host key ----------------------------------------------------------------
// generate once, reuse forever. ssh clients complain if it changes
// every boot ("REMOTE HOST IDENTIFICATION HAS CHANGED") and that
// freaks ppls out.

const KEY_PATH = path.join(__dirname, "host_key");

function loadHostKey() {
  try {
    return fs.readFileSync(KEY_PATH);
  } catch (e) {
    // first run - make one. RSA because ssh2 eats it without complaint,
    // even when the optional native crypto binding isn't around.
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const pem = privateKey.export({ type: "pkcs1", format: "pem" });
    fs.writeFileSync(KEY_PATH, pem, { mode: 0o600 });
    console.log("[dial] generated a fresh host key at " + KEY_PATH);
    return Buffer.from(pem);
  }
}

// ---- the hub -----------------------------------------------------------------

const hub = new Hub();

// ---- ssh server ----------------------------------------------------------

const server = new Server(
  {
    hostKeys: [loadHostKey()],
    // banner shows up in some clients before auth. keep it short & odd.
    banner: "\r\n  ~* you're reaching the dial. mind the static. *~\r\n\r\n",
  },
  (client, info) => {
    let username = info.username || "anon";

    client.on("authentication", (ctx) => {
      // open radio - anyone can tune in. we just want their name.
      username = ctx.username || username;
      switch (ctx.method) {
        case "none":
        case "password":
        case "publickey":
        case "keyboard-interactive":
          ctx.accept();
          break;
        default:
          ctx.reject(["none", "password", "publickey"]);
      }
    });

    client.on("ready", () => {
      client.on("session", (accept, reject) => {
        const session = accept();
        let cols = 80;
        let rows = 24;
        let sess = null;

        
        const safeAccept = (fn) => {
          if (typeof fn === "function") {
            try { fn(); } catch (e) {
              console.error("[dial] accept failed:", e.message);
            }
          }
        };

        session.on("pty", (accept2, reject2, info2) => {
          try {
            if (info2 && info2.cols) cols = info2.cols;
            if (info2 && info2.rows) rows = info2.rows;
          } catch (e) { /* info missing is fine */ }
          safeAccept(accept2);
        });

        session.on("window-change", (accept2, reject2, info2) => {
          try {
            if (info2 && info2.cols) cols = info2.cols;
            if (info2 && info2.rows) rows = info2.rows;
            if (sess) sess.resize(cols, rows);
          } catch (e) { /* ignore */ }
          safeAccept(accept2);
        });

        session.on("env", (accept2) => {
          safeAccept(accept2);
        });

        session.on("exec", (accept2) => {
          // no shell commands here, just a chat. 
          try {
            const stream = typeof accept2 === "function" ? accept2() : null;
            if (stream) {
              stream.write("this isn't a shell, it's a radio. try ssh -p " + PORT + " " + HOST + "\r\n");
              stream.exit(1);
              stream.end();
            }
          } catch (e) {
            console.error("[dial] exec failed:", e.message);
          }
        });

        session.on("shell", (accept2) => {
          try {
            const stream = typeof accept2 === "function" ? accept2() : null;
            if (!stream) {
              console.error("[dial] shell accept was not a function");
              return;
            }
            sess = new Session(client, stream, hub, server);
            sess.cols = cols;
            sess.rows = rows;

            // if ssh'd in with a username, offer it as a starting guess
            if (username && username !== "anon" && username.length <= 16) {
              sess.pendingHandle = username;
            }

            sess.start();

            stream.on("data", (data) => {
              sess.onData(data);
            });

            stream.on("close", () => {
              sess.close();
            });
          } catch (e) {
            console.error("[dial] shell setup failed:", e.message, e.stack);
          }
        });

        session.on("sftp", (accept2) => {
          // we don't do sftp. 
          if (typeof reject === "function") {
            try { reject(); } catch (e) { /* fine */ }
          }
        });
      });
    });

    client.on("error", (err) => {
      // ssh clients disconnect in weird ways all the time. stay chill.
      if (err.level !== "client-socket") {
        console.error("[dial] client error:", err.message);
      }
    });

    client.on("close", () => {

    });
  }
);

// ---- boil tick ---------------------------------------------------------------


let boilFrame = 0;
setInterval(() => {
  boilFrame = (boilFrame + 1) % 100000;
  for (const sess of hub.sessions.values()) {
    sess.tick(boilFrame);
  }
}, 320);

// ---- boot --------------------------------------------------------------------

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error("[dial] port " + PORT + " is already taken.");
    console.error("       try:  DIAL_PORT=2223 npm start");
  } else {
    console.error("[dial] server error:", err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  ~*  D I A L  *~");
  console.log("");
  console.log("  the radio is on. ssh in with:");
  console.log("");
  console.log("    ssh -p " + PORT + " localhost");
  console.log("");
  console.log("  (" + hub.count + " connected)");
  console.log("");
});
