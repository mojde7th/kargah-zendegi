/* همگام پیشرفت کارگاه‌ها بین گوشی و لپ‌تاپ — کلادفلر */
(function (global) {
  const ROOM_LS = "kargah-sync-room";
  const DEFAULT_ROOM = "zendegi-home";
  const API = "https://kargah-sync.minasi24100.workers.dev";
  const KNOWN = [
    "kargah-zendegi-v1",
    "nama-neshast-negah-v1",
    "nama-vaghee-form-v2",
    "personal-os-recomp-v2",
    "personal-os-kamel-v2",
    "form-neshast-v1",
    "form-vaghee-class-v1"
  ];
  const ALIASES = {
    "kargah-zendegi-v1": [
      "personal-os-kamel-v2",
      "personal-os-recomp-v2",
      "personal-os-recomp-v1"
    ]
  };

  function faNum(n) {
    return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  }

  function b64url(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function unb64url(s) {
    s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function packDone(done, n) {
    const bytes = new Uint8Array(Math.ceil(n / 8) || 1);
    for (let i = 0; i < n; i++) {
      if (done && done["p" + i]) bytes[i >> 3] |= 1 << (i & 7);
    }
    return b64url(bytes);
  }
  function unpackDone(bits, n) {
    const done = {};
    if (!bits) return done;
    const bytes = unb64url(bits);
    for (let i = 0; i < n; i++) {
      const b = bytes[i >> 3];
      if (b && b & (1 << (i & 7))) done["p" + i] = true;
    }
    return done;
  }

  function readLocal(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function countDone(done) {
    let n = 0;
    Object.keys(done || {}).forEach((k) => {
      if (done[k]) n++;
    });
    return n;
  }
  function mergeItems(a, b) {
    const aa = (a && a.items) || [];
    const bb = (b && b.items) || [];
    if (!aa.length && !bb.length) return null;
    const n = Math.max(aa.length, bb.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      const x = aa[i] || {};
      const y = bb[i] || {};
      const o = {};
      const keys = {};
      Object.keys(x).forEach((k) => (keys[k] = 1));
      Object.keys(y).forEach((k) => (keys[k] = 1));
      Object.keys(keys).forEach((k) => {
        const sx = String(x[k] == null ? "" : x[k]);
        const sy = String(y[k] == null ? "" : y[k]);
        o[k] = sy.length >= sx.length ? y[k] : x[k];
      });
      out.push(o);
    }
    return out;
  }
  function mergeState(a, b) {
    const out = {
      done: {},
      notes: {},
      page: 0,
      t: Math.max(Number(a && a.t) || 0, Number(b && b.t) || 0)
    };
    [a, b].forEach((s) => {
      const d = (s && s.done) || {};
      Object.keys(d).forEach((k) => {
        if (d[k]) out.done[k] = true;
      });
      const notes = (s && s.notes) || {};
      Object.keys(notes).forEach((k) => {
        const cur = out.notes[k] || "";
        const nxt = notes[k] || "";
        if (String(nxt).length >= String(cur).length) out.notes[k] = nxt;
      });
      const p = Number(s && s.page) || 0;
      if (p > out.page) out.page = p;
    });
    const items = mergeItems(a, b);
    if (items) out.items = items;
    const ta = a && a.transcript ? String(a.transcript) : "";
    const tb = b && b.transcript ? String(b.transcript) : "";
    if (tb.length >= ta.length && tb) out.transcript = b.transcript;
    else if (ta) out.transcript = a.transcript;
    return out;
  }
  function migrateAliases() {
    Object.keys(ALIASES).forEach((main) => {
      let acc = readLocal(main);
      ALIASES[main].forEach((k) => {
        acc = mergeState(acc, readLocal(k));
      });
      try {
        localStorage.setItem(main, JSON.stringify(acc));
      } catch (e) {}
    });
  }
  function snapshot() {
    migrateAliases();
    const keys = {};
    KNOWN.forEach((k) => {
      const s = readLocal(k);
      if (s && (s.done || s.page != null || s.notes || s.items || s.transcript)) keys[k] = s;
    });
    return { v: 1, t: Date.now(), keys: keys };
  }
  function applySnapshot(snap) {
    if (!snap || !snap.keys) return;
    Object.keys(snap.keys).forEach((k) => {
      const merged = mergeState(readLocal(k), snap.keys[k]);
      try {
        localStorage.setItem(k, JSON.stringify(merged));
      } catch (e) {}
    });
  }

  function encodeLink(origin) {
    const parts = ["1"];
    KNOWN.forEach((k) => {
      const s = readLocal(k);
      const n = Math.max(
        8,
        Object.keys(s.done || {}).reduce((m, id) => {
          const i = parseInt(String(id).replace(/^p/, ""), 10);
          return isNaN(i) ? m : Math.max(m, i + 1);
        }, 0)
      );
      const page = Number(s.page) || 0;
      const bits = packDone(s.done || {}, n);
      if (countDone(s.done) === 0 && !page) return;
      parts.push(k, String(n), String(page), bits);
    });
    const q = parts.join("~");
    const base =
      origin ||
      (typeof location !== "undefined" ? location.origin + location.pathname.replace(/[^/]+$/, "") : "");
    return base.replace(/\/?$/, "/") + "index.html?s=" + encodeURIComponent(q);
  }
  function decodeQuery(q) {
    const raw = String(q || "").replace(/^s=/, "");
    const parts = decodeURIComponent(raw).split("~");
    if (parts[0] !== "1") return null;
    const keys = {};
    for (let i = 1; i + 3 < parts.length; i += 4) {
      const k = parts[i];
      const n = parseInt(parts[i + 1], 10) || 0;
      const page = parseInt(parts[i + 2], 10) || 0;
      const done = unpackDone(parts[i + 3], n);
      keys[k] = { done: done, page: page, notes: {}, t: Date.now() };
    }
    return { v: 1, t: Date.now(), keys: keys };
  }

  async function api(path, method, body) {
    const r = await fetch(API + path, {
      method: method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body != null ? JSON.stringify(body) : undefined
    });
    if (!r.ok) throw new Error("api " + r.status);
    return r.json();
  }

  let pushTimer = 0;
  function room() {
    try {
      return localStorage.getItem(ROOM_LS) || "";
    } catch (e) {
      return "";
    }
  }
  function setRoom(id) {
    try {
      if (id) localStorage.setItem(ROOM_LS, id);
      else localStorage.removeItem(ROOM_LS);
    } catch (e) {}
  }
  function roomLink() {
    const id = room();
    if (!id || typeof location === "undefined") return "";
    const base = location.origin + location.pathname.replace(/[^/]+$/, "");
    return base.replace(/\/?$/, "/") + "index.html?room=" + encodeURIComponent(id);
  }

  async function pull() {
    const id = room();
    if (!id) return false;
    try {
      const r = await fetch(API + "/room/" + encodeURIComponent(id), {
        headers: { Accept: "application/json" }
      });
      if (r.status === 404) return false;
      if (!r.ok) throw new Error("api " + r.status);
      applySnapshot(await r.json());
      return true;
    } catch (e) {
      return null;
    }
  }
  async function push() {
    const id = room();
    if (!id) return false;
    try {
      const merged = await api("/room/" + encodeURIComponent(id), "PUT", snapshot());
      applySnapshot(merged);
      return true;
    } catch (e) {
      return false;
    }
  }
  function pushSoon() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      push();
    }, 700);
  }

  async function boot() {
    migrateAliases();
    try {
      const usp = new URLSearchParams(location.search);
      const s = usp.get("s");
      if (s) {
        const snap = decodeQuery(s);
        if (snap) applySnapshot(snap);
      }
      const r = usp.get("room");
      if (r) setRoom(r.replace(/[^a-zA-Z0-9_-]/g, ""));
    } catch (e) {}
    if (!room()) setRoom(DEFAULT_ROOM);
    const got = await pull();
    if (got === null) return;
    await push();
  }

  async function createRoom() {
    const j = await api("/room", "POST", snapshot());
    setRoom(j.id);
    return j.id;
  }
  async function joinRoom(id) {
    id = String(id || "").trim();
    if (!id) throw new Error("empty");
    setRoom(id);
    const got = await pull();
    if (got === null) throw new Error("join");
    await push();
    return id;
  }

  async function helpFill(body) {
    return api("/help", "POST", body);
  }
  async function transcribe(audioB64, mime) {
    return api("/transcribe", "POST", { audio: audioB64, mime: mime || "" });
  }

  global.KargahSync = {
    API: API,
    DEFAULT_ROOM: DEFAULT_ROOM,
    KNOWN: KNOWN,
    faNum: faNum,
    snapshot: snapshot,
    applySnapshot: applySnapshot,
    readLocal: readLocal,
    countDone: countDone,
    encodeLink: encodeLink,
    decodeQuery: decodeQuery,
    room: room,
    setRoom: setRoom,
    roomLink: roomLink,
    pull: pull,
    push: push,
    pushSoon: pushSoon,
    boot: boot,
    createRoom: createRoom,
    joinRoom: joinRoom,
    helpFill: helpFill,
    transcribe: transcribe,
    migrateAliases: migrateAliases
  };
})(typeof window !== "undefined" ? window : this);
