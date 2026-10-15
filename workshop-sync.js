/* همگام پیشرفت کارگاه‌ها بین گوشی و لپ‌تاپ — کلادفلر */
(function (global) {
  const ROOM_LS = "kargah-sync-room";
  const DEFAULT_ROOM = "zendegi-home";
  const APIS = [
    "https://kargah-home.pages.dev",
    "https://kargah-sync.minasi24100.workers.dev"
  ];
  const API_LS = "kargah-sync-api";
  let API = "";
  let lastStatus = { ok: false, err: "", at: 0, api: "" };
  const KNOWN = [
    "kargah-zendegi-v1",
    "nama-neshast-negah-v1",
    "nama-vaghee-form-v2",
    "personal-os-recomp-v1",
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
  const MAIN = [
    ["kargah-zendegi-v1", 162],
    ["nama-vaghee-form-v2", 15],
    ["nama-neshast-negah-v1", 23]
  ];

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
    rememberPack();
  }

  function encodeLink(origin) {
    const q = encodeCode();
    const base =
      origin ||
      (typeof location !== "undefined" ? location.origin + location.pathname.replace(/[^/]+$/, "") : "");
    return base.replace(/\/?$/, "/") + "index.html?s=" + encodeURIComponent(q);
  }
  function encodeCode() {
    migrateAliases();
    const parts = ["1"];
    MAIN.forEach(function (pair) {
      const k = pair[0];
      const n = pair[1];
      const s = readLocal(k);
      const page = Number(s.page) || 0;
      parts.push(k, String(n), String(page), packDone(s.done || {}, n));
    });
    return parts.join("~");
  }
  function rememberPack() {
    try {
      localStorage.setItem("kargah-sync-pack", encodeCode());
    } catch (e) {}
  }
  function decodeQuery(q) {
    try {
      const raw = String(q || "").replace(/^s=/, "");
      let decoded = raw;
      try {
        decoded = decodeURIComponent(raw);
      } catch (e) {}
      const parts = decoded.split("~");
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
    } catch (e) {
      return null;
    }
  }
  function parsePack(raw) {
    raw = String(raw || "").trim();
    if (!raw) return null;
    try {
      const m = raw.match(/[?&]s=([^&#]+)/);
      if (m) raw = decodeURIComponent(m[1].replace(/\+/g, "%20"));
    } catch (e) {}
    if (raw.indexOf("%7E") !== -1 || raw.indexOf("%7e") !== -1) {
      try {
        raw = decodeURIComponent(raw);
      } catch (e) {}
    }
    return decodeQuery(raw);
  }
  function applyPack(raw) {
    const snap = parsePack(raw);
    if (!snap) return false;
    applySnapshot(snap);
    pushSoon();
    return true;
  }

  function rememberApi(base) {
    API = base;
    try {
      localStorage.setItem(API_LS, base);
    } catch (e) {}
    lastStatus = { ok: true, err: "", at: Date.now(), api: base };
  }
  function apiOrder() {
    let saved = "";
    try {
      saved = localStorage.getItem(API_LS) || "";
    } catch (e) {}
    const order = [];
    if (API) order.push(API);
    if (saved && order.indexOf(saved) === -1) order.push(saved);
    APIS.forEach(function (a) {
      if (order.indexOf(a) === -1) order.push(a);
    });
    return order;
  }
  async function ping(base, ms) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 4000) : 0;
    try {
      const r = await fetch(base + "/", {
        method: "GET",
        cache: "no-store",
        signal: ctrl ? ctrl.signal : undefined
      });
      return !!r.ok;
    } catch (e) {
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async function pickApi() {
    const order = apiOrder();
    for (let i = 0; i < order.length; i++) {
      if (await ping(order[i], 4000)) {
        rememberApi(order[i]);
        return order[i];
      }
    }
    lastStatus = { ok: false, err: "offline", at: Date.now(), api: "" };
    return "";
  }
  async function send(base, path, method, body, headers, wait) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, wait) : 0;
    try {
      const r = await fetch(base + path, {
        method: method,
        headers: headers,
        body: body,
        signal: ctrl ? ctrl.signal : undefined
      });
      return r;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async function api(path, method, body) {
    let lastErr = "offline";
    const wait = path.indexOf("/transcribe") !== -1 || path.indexOf("/help") !== -1 ? 22000 : 10000;
    const order = apiOrder();
    for (let a = 0; a < order.length; a++) {
      const base = order[a];
      try {
        const r = await send(
          base,
          path,
          method,
          body != null ? JSON.stringify(body) : undefined,
          { "Content-Type": "application/json", Accept: "application/json" },
          wait
        );
        if (!r.ok) {
          lastErr = "api " + r.status;
          if (r.status === 404) {
            rememberApi(base);
            throw new Error(lastErr);
          }
          continue;
        }
        rememberApi(base);
        return r.json();
      } catch (e) {
        lastErr = String(e && e.message ? e.message : e);
      }
    }
    lastStatus = { ok: false, err: lastErr, at: Date.now(), api: "" };
    throw new Error(lastErr);
  }
  async function apiRaw(path, blob, mime) {
    let lastErr = "offline";
    const order = apiOrder();
    for (let a = 0; a < order.length; a++) {
      const base = order[a];
      try {
        const r = await send(
          base,
          path,
          "POST",
          blob,
          { "Content-Type": mime || "audio/wav", Accept: "application/json" },
          22000
        );
        if (!r.ok) {
          lastErr = "api " + r.status;
          continue;
        }
        rememberApi(base);
        return r.json();
      } catch (e) {
        lastErr = String(e && e.message ? e.message : e);
      }
    }
    lastStatus = { ok: false, err: lastErr, at: Date.now(), api: "" };
    throw new Error(lastErr);
  }

  let pushTimer = 0;
  function room() {
    return DEFAULT_ROOM;
  }
  function setRoom(id) {
    try {
      localStorage.setItem(ROOM_LS, DEFAULT_ROOM);
    } catch (e) {}
    return DEFAULT_ROOM;
  }
  function roomLink() {
    const id = room();
    if (!id || typeof location === "undefined") return "";
    const base = location.origin + location.pathname.replace(/[^/]+$/, "");
    return base.replace(/\/?$/, "/") + "index.html?room=" + encodeURIComponent(id);
  }

  async function pull() {
    const id = DEFAULT_ROOM;
    try {
      const remote = await api("/room/" + encodeURIComponent(id), "GET");
      applySnapshot(remote);
      return true;
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      if (msg.indexOf("404") !== -1 || msg.indexOf("api 404") !== -1) return false;
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
    rememberPack();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      push();
    }, 700);
  }

  async function boot() {
    await pickApi();
    migrateAliases();
    let old = "";
    try {
      old = localStorage.getItem(ROOM_LS) || "";
    } catch (e) {}
    setRoom(DEFAULT_ROOM);
    try {
      const usp = new URLSearchParams(location.search);
      const s = usp.get("s");
      if (s) {
        const snap = decodeQuery(s);
        if (snap) applySnapshot(snap);
      }
    } catch (e) {}
    if (old && old !== DEFAULT_ROOM) {
      try {
        const prev = await api("/room/" + encodeURIComponent(old), "GET");
        applySnapshot(prev);
      } catch (e) {}
    }
    rememberPack();
    const got = await pull();
    if (got === null) {
      rememberPack();
      return lastStatus;
    }
    await push();
    rememberPack();
    return lastStatus;
  }

  async function createRoom() {
    setRoom(DEFAULT_ROOM);
    await push();
    return DEFAULT_ROOM;
  }
  async function joinRoom() {
    setRoom(DEFAULT_ROOM);
    await boot();
    return DEFAULT_ROOM;
  }

  const HELP_SYS =
    "تو تسهیل‌گر کارگاه فرم واقعه هستی، نه پزشک. تشخیص بالینی نده. فرض کارگاهی مشخص بده. " +
    "ورودی رونوشت گفتار فارسی با غلط املایی است؛ معنی را حدس بزن. " +
    "خروجی فقط یک شیء جیسون با همین کلیدهای لاتین: title, vaghee, negah, naqab, olgo, dokon, tars, darun, sen, jumle. " +
    "اگر رونوشت خالی است یا صحنهٔ واقعی ندارد، همه کلیدها را رشته خالی بگذار. از خودت داستان نساز. " +
    "فقط وقتی واقعه یک صحنه دارد ستون‌ها را پر کن. " +
    "vaghee: فقط دوربین؛ غلط گفتار را درست کن؛ تفسیر نگذار. " +
    "negah: چشم تو کجا بود، چشم او کجا بود. " +
    "naqab: کدام نسخه از تو جلو آمد تا زنده بماند. " +
    "olgo: محرک، کار بدن، کار دهان، بعد چه شد. " +
    "dokon: اگر آرام می‌ماندی چه کار سختی لازم بود. " +
    "tars: مبادا چه. " +
    "darun: گلو، سینه، صورت، زمان. " +
    "sen: سه احتمال کوتاه؛ یکی را که بدن گرم می‌کند مشخص کن. " +
    "jumle: یک جمله که با «شاید» شروع شود. فارسی روان، کوتاه، ملموس.";

  function parseHelpFields(text) {
    const s = String(text || "");
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    let raw = fence ? fence[1] : "";
    if (!raw) {
      const m = s.match(/\{[\s\S]*\}/);
      raw = m ? m[0] : "";
    }
    if (!raw) throw new Error("no json");
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      obj = JSON.parse(raw.replace(/,\s*([}\]])/g, "$1"));
    }
    const map = {
      نگاه: "negah",
      "نقاب و نقش": "naqab",
      نقاب: "naqab",
      الگو: "olgo",
      "الگوی رفتاری": "olgo",
      دکان: "dokon",
      "ترس و مبادا": "tars",
      ترس: "tars",
      "تجربهٔ درونی": "darun",
      درون: "darun",
      سناریوها: "sen",
      "جملهٔ آزمایشی ته": "jumle",
      "جملهٔ ته": "jumle",
      واقعه: "vaghee",
      عنوان: "title"
    };
    const out = {};
    Object.keys(obj || {}).forEach(function (k) {
      const key = map[k] || k;
      const val = obj[k];
      if (val == null) return;
      out[key] = typeof val === "string" ? val.trim() : String(val);
    });
    if (!out.negah && !out.naqab && !out.olgo) throw new Error("thin");
    return out;
  }

  async function helpOpen(body) {
    const user =
      "عنوان: " +
      (body.title || "") +
      "\nرونوشت خام گفتار:\n" +
      (body.vaghee || body.transcript || "") +
      "\nهر ستون را پر کن. خروجی فقط جیسون.";
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 40000) : 0;
    try {
      const r = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          model: "openai-fast",
          private: true,
          messages: [
            { role: "system", content: HELP_SYS },
            { role: "user", content: user }
          ]
        }),
        signal: ctrl ? ctrl.signal : undefined
      });
      if (!r.ok) throw new Error("open " + r.status);
      const j = await r.json();
      const text =
        (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) ||
        (j && j.content) ||
        "";
      return { ok: true, fields: parseHelpFields(text) };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function helpFill(body) {
    try {
      return await helpOpen(body);
    } catch (e) {}
    return api("/help", "POST", body);
  }
  async function transcribe(audio, mime) {
    if (audio && typeof audio.size === "number") {
      return apiRaw("/transcribe", audio, mime || audio.type || "audio/wav");
    }
    return api("/transcribe", "POST", { audio: audio, mime: mime || "" });
  }

  global.KargahSync = {
    API: API,
    APIS: APIS,
    DEFAULT_ROOM: DEFAULT_ROOM,
    status: function () {
      return lastStatus;
    },
    KNOWN: KNOWN,
    faNum: faNum,
    snapshot: snapshot,
    applySnapshot: applySnapshot,
    readLocal: readLocal,
    countDone: countDone,
    encodeLink: encodeLink,
    encodeCode: encodeCode,
    rememberPack: rememberPack,
    parsePack: parsePack,
    applyPack: applyPack,
    MAIN: MAIN,
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
    pickApi: pickApi,
    migrateAliases: migrateAliases
  };
})(typeof window !== "undefined" ? window : this);
