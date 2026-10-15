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
    "تو تسهیل‌گر جلسهٔ مشاورهٔ کارگاه واقعه هستی، نه پزشک. تشخیص بالینی نده. فرض کارگاهی بده. " +
    "لحن جلسه است: خودمانی، چندلایه، ملموس. شعر تزئینی ننویس. " +
    "ورودی رونوشت یا متن دستی فارسی است. از خود صحنه بیرون نرو. " +
    "خروجی فقط یک شیء جیسون با کلیدهای لاتین: title, vaghee, naqab, olgo, dokon, tars, darun, sen, jumle. " +
    "ستون نگاه نساز. " +
    "هر ستون غیر از title و vaghee باید دقیقاً ده لایه باشد؛ هر خط با «لایهٔ ۱:» تا «لایهٔ ۱۰:». " +
    "لایه‌ها از سطح صحنه به عمق نقش، دکان، مبادا، صندلی سخت، و جملهٔ آزمایشی بروند. " +
    "اگر بدنت نخواند باید بشود خط زد. هیچ لایه را خالی نگذار اگر صحنه هست.";

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
    if (!out.naqab && !out.olgo && !out.dokon && !out.tars && !out.darun) throw new Error("thin");
    return out;
  }
  const IR_KEY_LS = "kargah-ir-key";
  const IR_CHAT = [
    "https://api.avalai.ir/v1",
    "https://api.avalapis.ir/v1",
    "https://api.hooshgar.ir/v1",
    "https://api.gapgpt.app/v1",
    "https://api.metisai.ir/v1"
  ];
  function getIrKey() {
    try {
      return String(localStorage.getItem(IR_KEY_LS) || "").trim();
    } catch (e) {
      return "";
    }
  }
  function setIrKey(k) {
    try {
      if (k) localStorage.setItem(IR_KEY_LS, String(k).trim());
      else localStorage.removeItem(IR_KEY_LS);
    } catch (e) {}
  }
  function pickText(j) {
    if (!j) return "";
    if (typeof j === "string") return j.trim();
    const t =
      j.text ||
      j.result ||
      j.transcript ||
      (j.data && (j.data.text || j.data.result || j.data.transcript)) ||
      (j.transcription && (j.transcription.text || j.transcription)) ||
      (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) ||
      j.generated_text ||
      (Array.isArray(j) && j[0] && (j[0].generated_text || j[0].text)) ||
      "";
    return String(t || "").trim();
  }
  function clipFa(s, n) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    if (s.length <= n) return s;
    return s.slice(0, n).replace(/[،,\s]+[^\s]*$/, "") + "…";
  }
  function splitFa(vg) {
    return String(vg || "")
      .split(/[\n.؟!]+/)
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length > 5; });
  }
  function ten(lines) {
    return lines
      .map(function (t, i) {
        return "لایهٔ " + faNum(i + 1) + ": " + t;
      })
      .join("\n");
  }
  function localHelp(body) {
    const vg = String((body && (body.vaghee || body.transcript)) || "").trim();
    const ss = splitFa(vg);
    const a = ss[0] || clipFa(vg, 110);
    const b = ss[1] || a;
    const c = ss[ss.length - 1] || a;
    const mid = ss[Math.min(1, Math.max(0, ss.length - 1))] || b;
    const q1 = "«" + clipFa(a, 90) + "»";
    const q2 = "«" + clipFa(b, 90) + "»";
    const q3 = "«" + clipFa(c, 90) + "»";
    const qmid = "«" + clipFa(mid, 90) + "»";
    const all = "«" + clipFa(vg, 140) + "»";
    return {
      ok: true,
      via: "local",
      fields: {
        title: clipFa(a, 42),
        vaghee: vg,
        naqab: ten([
          "دوربین همین لحظه است: " + q1 + " نسخه‌ای که جلو آمد همان کسی است که این کار را کرد تا صحنه را زنده بماند.",
          "نقاب روی صورت همان آداب صحنه است؛ نقش زیرش این است که نباید زیاد جا بگیرد یا جنگ درست کند.",
          "این نسخه برای زنده ماندن آمد، نه برای راست گفتن. اگر نمی‌آمد، باید حد یا خواستن را علنی می‌کردی.",
          "مخاطب نقاب همان چشمی است که در " + q2 + " ایستاده؛ روان تو دارد برای او اجرا می‌کند.",
          "فرض کارگاهی: این نقش بوی خانه می‌دهد. جایی که بزرگ بودن خطر بود و کوچک ماندن بلیت امن.",
          "اسم قشنگ روی نقاب نگذار. مؤدب، منطقی، سبک، عادی، شاگرد؛ همه یک کار می‌کنند: دیده شدنِ کامل را عقب می‌اندازند.",
          "هزینهٔ نگه داشتن نقش: بدن باید صحنه را ببلعد و دهان باید کم بگوید.",
          "اگر نقاب می‌افتاد، شاید فقط یک جملهٔ کوتاه لازم بود. آن جمله از خودِ نقش سنگین‌تر است.",
          "نقاب بد نیست؛ نادانسته‌اش خطرناک است. این‌جا دانسته شود: من این نسخه را پوشیدم تا " + q3 + " تمام شود.",
          "خط بزن اگر بدنت نخواند. فرض جلسه است، نه حکم. نقاب را با اسم قشنگ گول نزن."
        ]),
        olgo: ten([
          "محرک از خود واقعه: " + q1 + " بدن قبل از فکر فهمید خطر یا شرم اینجاست.",
          "کار بدن: سفت شدن، کوچک شدن، لبخند، رفتن، ماندنِ بی‌صدا. یکی از این‌ها در " + qmid + " نشسته.",
          "کار دهان: یا حرف اضافه، یا سکوت، یا جملهٔ مؤدب. دهان کار بدن را ترجمه کرد تا خطر بزرگ نشود.",
          "بعد چه شد: " + q3 + " مدار ناتمام ماند یا با فرار بسته شد.",
          "الگو آشناست: محرک می‌آید، بدن زودتر از فکر تصمیم می‌گیرد، دهان صحنه را جمع می‌کند.",
          "این‌جا انجماد یا مهربانی اجباری یا خشمِ به‌جا است. هر سه یک الگویند: از صندلی سخت پایین بیا.",
          "الگو چه کسی را راضی می‌کند؟ همان چشمی که اگر ناراضی شود، جهان برای ساعتی بی‌مهر می‌شود.",
          "الگو از چه معاف می‌کند؟ از پرسیدن، از حد، از ماندن در خواستن بدون شرم.",
          "حلقه: اگر همین محرک فردا بیاید، بدن دوباره همان کار را می‌کند مگر یک توقف کوچک وسطش بگذاری.",
          "توقف آزمایشی: یک نفس، یک جملهٔ کوتاه، بعد ببین بدن گرم می‌ماند یا نه. فرض جلسه است."
        ]),
        dokon: ten([
          "دکان لایهٔ آشکار: به هم ریختن از جدل و ماندن معاف می‌کند. " + q1,
          "دکان هویت آشنا: اگر حال خراب شود، هنوز همان نسخه‌ای هستی که خانه می‌شناسد؛ لازم نیست آدم جدید شوی.",
          "دکان صندلی سخت: فروپاشی تو را از حد روشن و از گفتن «این‌جا برایم تنگ است» پرت می‌کند پایین.",
          "دکان محیط: می‌شود گفت صحنه خراب بود، نه اینکه من از کار سخت گریختم.",
          "دکان استراحت بی‌اجازه: حال بد مجوز ترک است بدون اینکه بگویی خسته‌ام یا می‌ترسم.",
          "دکان ناتمام: اگر مدار کامل نشود، قضاوت نهایی نمی‌آید. ناتمام ارزان‌تر از تمام است.",
          "دکان دیده نشدن: اگر نپرسی و نرمالی، هرگز کاملاً وارد بازار دیده شدن نمی‌شوی.",
          "دکان بزرگ شدن: خراب شدن یعنی هنوز لازم نیست جای پدر یا جای خودت را پر کنی.",
          "اگر آرام می‌ماندی باید قیمت می‌دادی: حد، یا خواستن، یا دیدن اینکه بعضی‌ها آداب را تمام نمی‌کنند و وجود تو به جواب آن‌ها قفل نیست.",
          "آن آزادی سنگین است. دکان همین سنگینی را می‌خرد. اگر بدنت نخواند خط بزن."
        ]),
        tars: ten([
          "مبادا در " + q1 + " برای کسی واقعی نباشی و حرفت در هوا بمیرد.",
          "مبادا زیادی دیده شوی. مبادا اگر محکم بگویی، بد شوی.",
          "مبادا معلوم شود این صحنه به تو نشست و بدنت نامیده شد.",
          "مبادا محتاج به نظر برسی. مبادا گرسنگی دیده شدن پیدا شود.",
          "مبادا خاص شوی و بعد خراب شوی. محبوب بودن بدهی دارد.",
          "مبادا متکبر باشی. مبادا ادعا کنی و رسوا شوی.",
          "مبادا هیچ گوشه‌ای مال تو نباشد و جایت پاک شود.",
          "مبادا بتوانی. مبادا دیگر بهانه‌ای نماند و زندگی مجبور به عوض شدن شود.",
          "مبادا بچسبی. مبادا در چشم او زیاد و کم‌ارزش شوی.",
          "دو قطب یک ترس: مبادا هیچ‌کس نبیندت. مبادا زیادی ببینندت. هر دو زیر " + all + " نشسته‌اند."
        ]),
        darun: ten([
          "گلو: همان جایی که حرف باید می‌آمد و نیامد، یا آمد و پس گرفته شد. " + q1,
          "سینه: فشار یا خالی شدن بعد از " + qmid + " زمان کوتاهی طول می‌کشد و روان آن را ساعت می‌کند.",
          "صورت: گرم شدن، ماسک مؤدب، یا انجماد. صورت دارد نقاب را نگه می‌دارد.",
          "دست و پا: ماندن، رفتن، جمع شدن. بدن رأی داده قبل از اینکه فکر برسد.",
          "زمان درونی: صحنه ممکن است ده ثانیه بوده باشد؛ در درون هنوز قطع نشده، مثل آهنگ ناتمام.",
          "شرم در پوست: اگر دیده شوی، بدن می‌خواهد کوچک شود تا ارزیابی تمام شود.",
          "خشمِ بی‌صدا: گاهی حال خراب همان خشمی است که اجازهٔ جمله نگرفت.",
          "گرسنگی پنهان: هم خواستن نزدیک شدن، هم نفرت از همان خواستن. هر دو می‌توانند در یک گرم شدن باشند.",
          "بعد از صحنه: روان روی نقطه می‌ماند. اگر جواب یا حد نیاید، جهان برای ساعتی بی‌مهر می‌شود.",
          "فرض جلسه: این حس را با بدنت چک کن. اگر نخواند خط بزن. حس حکم پزشکی نیست."
        ]),
        sen: ten([
          "سناریو یک: همین که نوشته شد بماند. " + q1 + " الگو تکرار شود.",
          "سناریو دو: زودتر قطع کنی. بدن را از مدار ناتمام بکشی بیرون.",
          "سناریو سه: یک جملهٔ کوتاه وسط صحنه بگویی و بمانی ببینی چه می‌شود.",
          "سناریو چهار: حد را نرم و روشن بگویی؛ نه جنگ، نه لبخند اجباری.",
          "سناریو پنج: بپرسی چه شد. پرسیدن اعتراف به گرسنگی دیده شدن است و سخت است.",
          "سناریو شش: جا را عوض کنی. گاهی حد کافی نیست و باید اتاق را تنگ کنی.",
          "سناریو هفت: همان را که بدن گرم کرد نگه داری؛ نه کامل‌ترین، همان که زنده است.",
          "سناریو هشت: فردا همان محرک بیاید و تو یک نفس بیشتر وسطش بگذاری.",
          "سناریو نه: نروی. نرفتن یعنی هرگز تکراری نمی‌شوی؛ قیمتش نرفتن به جایی است که دوست داری.",
          "فرض جلسه: بدن معمولاً سناریو یک یا هفت را گرم می‌کند. همان را آزمایش کن، نه هر ده تا را."
        ]),
        jumle: ten([
          "شاید اگر در همان لحظه فقط می‌گفتم این صحنه برایم تنگ است، لازم نبود بدن همه را ببلعد.",
          "شاید سکوت من ادب نبود؛ نقش کسی بود که نباید جا بگیرد.",
          "شاید حال خراب بعد از " + q3 + " خریدِ معافیت بود، نه شکست.",
          "شاید اگر می‌پرسیدم، کوچک نمی‌شدم؛ فقط گرسنگی‌ام پیدا می‌شد.",
          "شاید حد من جنگ نیست؛ یک جملهٔ کوتاه است که خانه یادم نداده.",
          "شاید وجود من به جواب آن چشم قفل نیست.",
          "شاید ناتمام ماندن ارزان‌تر از تمام شدن است و من دارم همان را می‌خرم.",
          "شاید بتوانم و از همین می‌ترسم.",
          "شاید دو ترس با هم باشند: دیده نشوم، و زیادی دیده شوم.",
          "شاید همین یکی را ته جلسه آزمایش کنم و بقیه‌اش را خط بزنم اگر بدن گرم نکرد."
        ])
      }
    };
  }
  async function fetchWait(url, opt, ms) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 7000) : 0;
    try {
      const r = await fetch(url, Object.assign({}, opt, { signal: ctrl ? ctrl.signal : undefined }));
      return r;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async function transcribeIran(blob) {
    if (!blob || !blob.size) throw new Error("empty audio");
    const key = getIrKey();
    if (key) {
      for (let i = 0; i < IR_CHAT.length; i++) {
        try {
          const fd = new FormData();
          fd.append("file", blob, "speech.wav");
          fd.append("model", "whisper-1");
          fd.append("language", "fa");
          fd.append("prompt", "گفتار فارسی محاوره‌ای کارگاه واقعه.");
          const r = await fetchWait(IR_CHAT[i] + "/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: "Bearer " + key },
            body: fd
          }, 8000);
          if (!r.ok) continue;
          const tx = pickText(await r.json());
          if (tx) return { ok: true, text: tx, via: "iran" };
        } catch (e) {}
      }
    }
    try {
      const fd = new FormData();
      fd.append("file", blob, "speech.wav");
      fd.append("audio", blob, "speech.wav");
      fd.append("language", "fa");
      const r = await fetchWait("https://api.ivira.ai/partai/avanegar", {
        method: "POST",
        body: fd
      }, 7000);
      if (r.ok) {
        const tx = pickText(await r.json());
        if (tx) return { ok: true, text: tx, via: "ivira" };
      }
    } catch (e) {}
    try {
      const r = await fetchWait(
        "https://api-inference.huggingface.co/models/openai/whisper-large-v3",
        {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "audio/wav" },
          body: blob
        },
        8000
      );
      if (r.ok) {
        const tx = pickText(await r.json());
        if (tx) return { ok: true, text: tx, via: "hf" };
      }
    } catch (e) {}
    throw new Error("iran stt");
  }
  async function helpIran(body) {
    const user =
      "عنوان: " +
      (body.title || "") +
      "\nرونوشت خام گفتار:\n" +
      (body.vaghee || body.transcript || "") +
      "\nهر ستون را پر کن. خروجی فقط جیسون. ستون نگاه نساز.";
    const key = getIrKey();
    const payload = {
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: HELP_SYS },
        { role: "user", content: user }
      ]
    };
    if (key) {
      for (let i = 0; i < IR_CHAT.length; i++) {
        try {
          const r = await fetchWait(IR_CHAT[i] + "/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + key
            },
            body: JSON.stringify(payload)
          }, 8000);
          if (!r.ok) continue;
          const tx = pickText(await r.json());
          if (tx) return { ok: true, fields: parseHelpFields(tx) };
        } catch (e) {}
      }
    }
    throw new Error("iran help");
  }

  async function helpOpen(body) {
    const user =
      "عنوان: " +
      (body.title || "") +
      "\nرونوشت خام گفتار:\n" +
      (body.vaghee || body.transcript || "") +
      "\nهر ستون را پر کن. خروجی فقط جیسون.";
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 7000) : 0;
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
      const r = await helpIran(body);
      if (r && r.fields) return r;
    } catch (e) {}
    try {
      const r = await helpOpen(body);
      if (r && r.fields) return r;
    } catch (e) {}
    try {
      const r = await api("/help", "POST", body);
      if (r && (r.fields || r.naqab || r.olgo)) {
        return r.fields ? r : { ok: true, fields: r };
      }
    } catch (e) {}
    return localHelp(body);
  }
  async function transcribe(audio, mime) {
    if (audio && typeof audio.size === "number") {
      try {
        return await transcribeIran(audio);
      } catch (e) {}
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
    transcribeIran: transcribeIran,
    helpIran: helpIran,
    localHelp: localHelp,
    getIrKey: getIrKey,
    setIrKey: setIrKey,
    pickApi: pickApi,
    migrateAliases: migrateAliases
  };
})(typeof window !== "undefined" ? window : this);
