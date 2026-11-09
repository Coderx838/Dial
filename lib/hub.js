// hub.js - the in-memory pub.sub, keeps track of who's connected..
// and there data



const { MAX_AUDIBLE, isAudible } = require("./radio");

class Hub{
    constructor(){
        this.sessions = new Map(); // id -> session
        this.history = []; // all the messages
        this.nextSessionId = 1;
        this.nextMsgId = 1;
        // keeps the log from growing forever, few hundred is plenty
        this.maxHistory = 400;
        this.handshakes = new Set();
    }

    add(session){
        session.id = this.nextSessionId++;
        this.sessions.set(session.id, session);
        return session.id;
    }

    remove(id){
        this.sessions.delete(id);
    }

    get count(){
        return this.sessions.size;
    }

    // who's already in the chat 

    liveSessions(){
        const out = [];
        for (const s of this.sessions.values()){
            if (s.phase === "chat") out.push(s);
        }
        return out;
    }


    // handle uniqueness check 100% yeh

    handleTaken(handle, selfId){
        const h = String(handle).trim().toLocaleLowerCase();
        if (!h) return false;
        for (const s of this.sessions.values()){
            if(s.id === selfId) continue;
            if (s.handle && s.handle.trim().toLocaleLowerCase() === h) return true;
        }
        return false;
    }

    // everyone tuned within the range of a freq

    nearby(freq, range){
        range = range === undefined ? MAX_AUDIBLE : range;
        const out = [];
        for (const s of this.liveSessions()){
            if (Math.abs(s.freq - freq) <= range) out.push(s);
        }
        return out;
    }

    // how many ppls sit righ  on this exact freq (within one step)

    onFrequency(freq){
        let n = 0;
        for (const s of this.liveSessions()){
            if (Math.abs(s.freq - freq) <= 0.05) n ++;
        }
        return n;

    }


    // broadcast a message from  a session to everyone who can hear it
    // we store it once with the sender's freq, and each receiver

    broadcast(fromSession, text){
        const msg = {
            id: this.nextMsgId++,
            handle: fromSession.handle,
            doodleIdx : fromSession.doodleIdx,
            item : fromSession.worn ,
            freq : fromSession.freq,
            date: nowDate(),
            time: nowHM(),
            text: text,
        };
        this.history.push(msg);
        if(this.history.length > this.maxHistory){

            this.history.splice(0, this.history.length - this.maxHistory);
        }

        // kick every lve session so they re-render
        for (const s of this.liveSessions()){
            s.markDirty();
        }
        return msg;


    }


    // a sysmte line (someone joined , left , retuned) -- not altered by freq(not distorted)

    announce(text, freq){
        const msg = {
            id : this.nextMsgId++,
            handle: null,
            doodleIdx: -1,
            freq: freq,
            time: nowHM(),
            date: nowDate(),
            text: text,
            system: true,

        }
        this.history.push(msg);
        if (this.history.length > this.maxHistory){
            this.history.splice(0, this.history.length - this.maxHistory);

        }
        for (const s of this.liveSessions()){
            s.markDirty();
        }
        return msg;
    }

    // pull the messages aubible from a given freq

    audibleHistory(freq){
        const out = [];
        for (const m of this.history){
            if (m.system){
                // system messages only show if you're basically on that freq
                if (Math.abs(m.freq - freq) <= 0.15) out.push(m);
            } else if (isAudible(Math.abs(m.freq - freq))){
                out.push(m);

            }
        }
        return out;
    }

    handshakesKey(a , b){
        return a < b ? a + "|" + b : b + "|" + a;
    }
    isHandshakeDone(id1, id2){
        return this.handshakes.has(this.handshakesKey(id1, id2));
    }
    recordHandshake(id1, id2){
        this.handshakes.add(this.handshakesKey(id1, id2));
    }

    checkHandshakes(session, autoEquipAllowed){
        const peers = this.nearby(session.freq, 0.05).filter(
            (S) => S.id !== session.id && S.phase === "chat"
        );
        const itemPool = ["^", "<>", "[]", "*", "~"]; // hat , flag , badge, pin , ribbon
        for (const peer of peers){
            if (this.isHandshakeDone(session.id , peer.id)) continue;
            this.recordHandshake(session.id, peer.id);

            const item = itemPool[Math.floor(Math.random() * itemPool.length)];

            // give to both

            session.inventory.add(item);
            peer.inventory.add(item);

            const equip = autoEquipAllowed && session.autoEquip && peer.autoEquip;

            if (equip){
                session.worn = item;
                peer.worn = item;
            }

            const announceText = "~" + session.handle + " shook hands with " + peer.handle + " at " + session.freq.toFixed(1) + " MHz ~";
            this.announce(announceText, session.freq);
        }
    }
}

function nowHM() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return h + ":" + m;
}


function nowDate() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

module.exports = { Hub };