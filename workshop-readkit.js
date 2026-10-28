/* workshop-readkit.js — page progress, notes, export (localStorage) */
window.WorkshopReadkit = function (cfg) {
  const LS = cfg.storageKey || "workshop-read-default";
  const pages = cfg.pages || [];
  const N = pages.length;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  function st() {
    let s = {};
    try {
      s = JSON.parse(localStorage.getItem(LS)) || {};
    } catch (e) {}
    if (!s.done) s.done = {};
    if (!s.notes) s.notes = {};
    if (s.page == null) s.page = 0;
    return s;
  }
  function save(s) {
    s.t = Date.now();
    try {
      localStorage.setItem(LS, JSON.stringify(s));
    } catch (e) {}
    if (window.KargahSync && KargahSync.pushSoon) KargahSync.pushSoon();
  }

  function faNum(n) {
    return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  }

  function toast(msg) {
    let el = document.getElementById("wk-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "wk-toast";
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;bottom:72px;left:50%;transform:translateX(-50%);background:#14352e;color:#86e0a3;border:1px solid #86e0a3;padding:10px 18px;border-radius:12px;z-index:80;font:600 15px Tahoma,sans-serif;display:none;max-width:90%";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.display = "none";
    }, 2200);
  }

  const main = $("#main");
  const toc = $("#toc");
  if (!main || !toc) return;

  if (window.matchMedia("(max-width: 800px)").matches) {
    const lay = $("#layout");
    if (lay) lay.classList.add("toc-off");
  }

  if (!document.getElementById("readkit-layout-extra")) {
    const style = document.createElement("style");
    style.id = "readkit-layout-extra";
    style.textContent =
      "main{min-width:0;width:100%}\n" +
      ".layout.toc-off{grid-template-columns:1fr!important}\n" +
      ".layout.toc-off #toc{display:none!important}\n" +
      ".layout.toc-off main{max-width:none!important;margin:0!important}\n" +
      ".flag{display:flex;align-items:center;gap:10px;margin-top:14px;padding:12px 14px;border:1px solid #334155;border-radius:12px;background:#0d1117;font-weight:800;cursor:pointer}\n" +
      ".flag input{width:22px;height:22px;accent-color:#86e0a3}\n" +
      ".flag:has(input:checked){border-color:#86e0a3;background:#14352e;color:#86e0a3}\n" +
      "#toc a.done{color:#86e0a3}\n" +
      "#toc a.done::before{content:'✓ ';color:#86e0a3}\n" +
      "html.hdr-off{--hdr:56px}\n" +
      "html.hdr-off .freeze .widgets,html.hdr-off .freeze .hint{display:none!important}\n" +
      "html.hdr-off .freeze{padding:6px 10px}\n" +
      "#btnHdr{margin-right:auto}\n" +
      "@media (max-width:800px){\n" +
      "html,body{font-size:18px}\n" +
      ".freeze{padding:8px 8px 6px}\n" +
      ".row{gap:6px}\n" +
      ".row button{flex:1 1 42%;min-height:46px}\n" +
      ".widgets{grid-template-columns:1fr 1fr!important}\n" +
      ".hint{display:none}\n" +
      ".layout{grid-template-columns:1fr!important}\n" +
      ".pager{padding:8px 10px calc(8px + env(safe-area-inset-bottom))}\n" +
      ".pager button{min-height:48px;min-width:104px;font-size:17px}\n" +
      "main{padding-bottom:calc(108px + env(safe-area-inset-bottom))}\n" +
      "#searchBox,.notebox{font-size:16px}\n" +
      ".steps li{padding:12px 12px}\n" +
      "}\n";
    document.head.appendChild(style);
  }

  function isCode(x) {
    const t = String(x);
    // بلوک اجباری کد — حتی اگر داخلش حرف فارسی باشد
    if (t.startsWith("CODE::")) return true;
    const bare = t.trim();
    if (!bare) return false;
    if (/[\u0600-\u06FF]/.test(bare)) return false;
    // هر خطی که هیچ حرف فارسی ندارد، یک قطعه لاتین است و باید چپ‌به‌راست جدا بیفتد
    return true;
  }

  // بلوک لاتین ممکن است نشانه‌گذاری داشته باشد، پس قبل از تزریق باید بی‌اثر شود
  function esc(x) {
    return String(x)
      .replace(/^CODE::/, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  pages.forEach((p, i) => {
    const a = document.createElement("a");
    a.href = "#";
    a.dataset.go = String(i);
    a.textContent = p.t;
    toc.appendChild(a);
    const art = document.createElement("article");
    art.className = "page" + (i ? "" : " on");
    art.dataset.page = String(i);
    let html =
      "<h2>" +
      p.t +
      '</h2><div class="card"><p class="do">' +
      p.d +
      '</p><pre class="src" dir="ltr">' +
      esc(p.l || "") +
      '</pre><ol class="steps">';
    (p.s || []).forEach((x) => {
      if (isCode(x)) html += '</ol><pre class="src" dir="ltr">' + esc(x) + "</pre><ol class=\"steps\">";
      else html += "<li>" + x + "</li>";
    });
    html += "</ol>";
    if (p.g && p.g.length) {
      html += '<div class="gal">';
      p.g.forEach((im) => {
        const href = im.href || im.src || "#";
        const src = im.src || im.href || "";
        const cap = im.cap || im.id || "";
        const id = im.id || "";
        html +=
          '<a class="gal-item" href="' +
          href +
          '" download target="_blank" rel="noopener">' +
          (src
            ? '<img src="' + src + '" alt="' + cap + '" loading="lazy"/>'
            : "") +
          '<span class="gal-id" dir="ltr">' +
          id +
          "</span>" +
          '<span class="gal-cap">' +
          cap +
          "</span></a>";
      });
      html += "</div>";
    }
    html +=
      '<div class="flags" data-id="p' +
      i +
      '"></div>';
    if (cfg.notes !== false) {
      html +=
        '<label class="note-lbl">یادداشت من (ذخیره خودکار)</label><textarea class="notebox" data-note="p' +
        i +
        '" rows="2" placeholder="نتیجه، خطا، عدد فضای خالی، نام سرور…"></textarea>';
    }
    html += "</div></article>";
    art.innerHTML = html;
    main.appendChild(art);
  });

  const pageEls = $$(".page");

  function paintNotes() {
    const s = st();
    $$(".notebox").forEach((ta) => {
      const k = ta.dataset.note;
      if (s.notes[k] != null) ta.value = s.notes[k];
    });
  }

  function paint() {
    const s = st();
    let n = 0;
    pageEls.forEach((_, i) => {
      if (s.done["p" + i]) n++;
    });
    const wDone = $("#wDone");
    if (wDone) wDone.textContent = faNum(n) + " / " + faNum(N);
    $$("#toc a").forEach((a, i) => {
      a.classList.toggle("done", !!s.done["p" + i]);
    });
    $$(".flags").forEach((el) => {
      const id = el.dataset.id;
      el.innerHTML =
        '<label class="flag"><input type="checkbox" data-done="' +
        id +
        '" ' +
        (s.done[id] ? "checked" : "") +
        "> خواندم — این صفحه سبز شود</label>";
    });
    const bar = $("#progBar");
    const reached = Math.min(N, Math.max(n, (s.page || 0) + 1));
    const pct = N ? Math.round((reached / N) * 100) : 0;
    if (bar) bar.style.width = pct + "%";
    const wPct = $("#wPct");
    if (wPct) wPct.textContent = faNum(pct) + "٪";
    paintNotes();
  }

  function go(i) {
    i = Math.max(0, Math.min(N - 1, i));
    const s = st();
    s.page = i;
    save(s);
    pageEls.forEach((p, n) => p.classList.toggle("on", n === i));
    const pn = $("#pagerNum");
    if (pn) pn.textContent = faNum(i + 1) + " / " + faNum(N);
    const chip = $("#pageChip");
    if (chip) chip.textContent = "صفحه " + faNum(i + 1);
    $$("#toc a").forEach((a, n) => a.classList.toggle("here", n === i));
    paint();
    window.scrollTo(0, 0);
  }

  document.addEventListener("change", (e) => {
    if (e.target.dataset && e.target.dataset.done) {
      const s = st();
      s.done[e.target.dataset.done] = e.target.checked;
      save(s);
      paint();
      if (e.target.checked) {
        const n = Object.keys(s.done).filter((k) => s.done[k]).length;
        toast("خوانده شد — " + faNum(n) + " از " + faNum(N));
      }
    }
  });

  document.addEventListener(
    "input",
    (e) => {
      if (e.target.classList && e.target.classList.contains("notebox")) {
        const s = st();
        s.notes[e.target.dataset.note] = e.target.value;
        save(s);
      }
    },
    true
  );

  function buildExportText() {
    const s = st();
    const title = cfg.exportTitle || document.title || "workshop";
    let out = title + "\n" + new Date().toISOString() + "\n" + "=".repeat(40) + "\n\n";
    pages.forEach((p, i) => {
      const id = "p" + i;
      out += "[" + (s.done[id] ? "X" : " ") + "] " + p.t + "\n";
      if (s.notes[id]) out += "    یادداشت: " + s.notes[id].replace(/\n/g, " ") + "\n";
      out += "\n";
    });
    out += "صفحه آخر باز شده: " + (s.page + 1) + " / " + N + "\n";
    return out;
  }

  function downloadExport() {
    const blob = new Blob([buildExportText()], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (cfg.exportFile || "workshop-report") + ".txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const bp = $("#btnPrev");
  const bn = $("#btnNext");
  const bm = $("#btnMenu");
  const br = $("#btnResume");
  const be = $("#btnExport");
  const bc = $("#btnClear");
  function markCurrentRead() {
    const s = st();
    const id = "p" + s.page;
    if (!s.done[id]) {
      s.done[id] = true;
      save(s);
    }
  }
  if (bp) bp.onclick = () => go(st().page - 1);
  if (bn)
    bn.onclick = () => {
      markCurrentRead();
      paint();
      go(st().page + 1);
    };
  if (bm) bm.onclick = () => $("#layout").classList.toggle("toc-off");
  if (br) br.onclick = () => go(st().page);
  if (be) be.onclick = downloadExport;
  if (bc)
    bc.onclick = () => {
      if (confirm("همه تیک‌ها و یادداشت‌ها پاک شود؟")) {
        localStorage.removeItem(LS);
        paint();
        go(0);
      }
    };

  $$("#toc a").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      go(+a.dataset.go);
    })
  );

  const btnTodo = $("#btnTodo");
  if (btnTodo)
    btnTodo.onclick = () => {
      const s = st();
      for (let i = 0; i < N; i++) {
        if (!s.done["p" + i]) {
          go(i);
          return;
        }
      }
      alert("همه گام‌ها تیک خورده‌اند.");
    };

  const box = $("#searchBox");
  if (box)
    box.addEventListener("input", () => {
      const q = box.value.trim().toLowerCase();
      $$("#toc a").forEach((a, i) => {
        const hay = (pages[i].t + " " + pages[i].d + " " + (pages[i].l || "") + " " + (pages[i].s || []).join(" ")).toLowerCase();
        a.style.display = !q || hay.indexOf(q) !== -1 ? "" : "none";
      });
    });

  function applyHdr(off) {
    document.documentElement.classList.toggle("hdr-off", !!off);
    try {
      localStorage.setItem("kargah-hdr-off", off ? "1" : "0");
    } catch (e) {}
    const b = document.getElementById("btnHdr");
    if (b) b.textContent = off ? "نمایش هدر" : "پنهان هدر";
  }
  function setupHdr() {
    const row = document.querySelector(".freeze .row");
    if (row && !document.getElementById("btnSyncCode")) {
      const c = document.createElement("button");
      c.id = "btnSyncCode";
      c.type = "button";
      c.textContent = "کپی کد همگام";
      row.appendChild(c);
      c.onclick = () => {
        try {
          if (!window.KargahSync || !KargahSync.encodeCode) {
            toast("همگام آماده نیست");
            return;
          }
          const t = KargahSync.encodeCode();
          navigator.clipboard.writeText(t).then(
            () => toast("کد همگام کپی شد — در فهرست گوشی بچسبان"),
            () => {
              prompt("کپی کن", t);
            }
          );
        } catch (e) {
          toast("کد ساخته نشد");
        }
      };
    }
    if (row && !document.getElementById("btnHdr")) {
      const b = document.createElement("button");
      b.id = "btnHdr";
      b.type = "button";
      b.textContent = "پنهان هدر";
      row.appendChild(b);
      b.onclick = () => applyHdr(!document.documentElement.classList.contains("hdr-off"));
    }
    let off = false;
    try {
      off = localStorage.getItem("kargah-hdr-off") === "1";
    } catch (e) {}
    applyHdr(off);
  }

  function start() {
    setupHdr();
    paint();
    go(st().page);
  }
  if (window.KargahSync && KargahSync.boot) {
    KargahSync.boot().then(start).catch(start);
  } else {
    start();
  }
};
