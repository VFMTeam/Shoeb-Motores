/* =====================================================================
   store.js — data + storage engine
   Primary storage is the offline folder selected by setup.bat via the local server.
   New business data is NEVER stored in browser storage. Browser persistence is restricted to
   PIN/UI preferences plus static app files (CSS/JS/images) in the service-worker cache.
   Older browser-cache builds are migrated once to the local Data folder, then their business cache is removed.
   ===================================================================== */
var DB = (function () {
  var state = null;
  var mode = 'local';
  var serverInfo = null;
  var LOCAL_UNLOCK_KEY = 'shoebMotorsUnlocked';
  var BROWSER_PIN_KEY = 'shoebMotorsPin';
  var BROWSER_THEME_KEY = 'shoebMotorsThemeV2';
  var saveQueueTimer = null;
  var saving = false;
  var dirty = false;
  var lastSavedAt = null;
  var listeners = { change: [], save: [] };
  var fixedTexts = 0;
  var saveRetryDelay = 2000;
  var lastFlushOk = true;
  // Optimistic-concurrency baseline. Every normal save says which durable server
  // revision this tab was based on, so a stale second tab can never overwrite newer data.
  var lastServerSeq = 0;
  var lastServerLineage = '';
  var replacePending = false;
  var lastSaveConflict = false;

  /* ------------------------- defaults ------------------------- */
  function iso(d) { return (d ? new Date(d) : new Date()).toISOString(); }
  function todayStr(d) {
    var x = d ? new Date(d) : new Date();
    var m = String(x.getMonth() + 1).padStart(2, '0'), day = String(x.getDate()).padStart(2, '0');
    return x.getFullYear() + '-' + m + '-' + day;
  }
  /* ---- মুছে ফেলা তথ্য সংরক্ষণ ---- */
  var DELETED_LIMIT = 500;
  function archiveDeleted(type, labelText, data, extra) {
    if (!data) return null;
    var rec = {
      id: uid('del'), type: type, label: labelText || '',
      at: new Date().toISOString(), data: data
    };
    if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k)) rec[k] = extra[k]; } }
    state.deleted = state.deleted || [];
    state.deleted.unshift(rec);
    while (state.deleted.length > DELETED_LIMIT) state.deleted.pop();

    /* একই সাথে ফাইল আকারে সেভ: ডেটা ফোল্ডারের ভেতরে “deleted” ফোল্ডারে */
    try {
      var name = (type + '-' + (labelText || rec.id)).replace(/[\/\\:*?"<>|]+/g, '-');
      fetch('api/archive', {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ name: name, data: rec })
      }).catch(function () { });
    } catch (e) { }
    return rec;
  }
  function deletedList() { return state.deleted || []; }
  function deletedById(id) { return (state.deleted || []).filter(function (d) { return d.id === id; })[0]; }
  function dropDeleted(id) {
    state.deleted = (state.deleted || []).filter(function (d) { return d.id !== id; });
  }
  function defaultSettings() {
    return {
      shopName: 'Shoeb Motors & Tyre House',
      tagline: 'এখানে টায়ার, টিউব, রিম, পলি ত্রিপল, রশি ও মটর গাড়ীর যাবতীয় যন্ত্রাংশ বিক্রয় করা হয়',
      address: 'কালীগঞ্জ, ঝিনাইদহ',
      phone: '০১৭১১-৭২৮৯৭৫, ০১৭১২-২৮১৭৭২',
      logoImage: '',             /* নিজের লোগো (ছবি) — খালি থাকলে প্রোগ্রামের লোগো */
      currency: '৳',
      invoicePrefix: 'INV',
      lowStockLevel: 2,
      footerNote: 'বিক্রয় করা মাল ফেরত নেওয়া হয় না।',
      thanksLine: 'ধন্যবাদ, আবার আসবেন।',
      discountNote: '',
      showDiscountOnInvoice: true,  /* বন্ধ থাকলে ইনভয়েসে ছাড়ের লাইন/লেখা দেখাবে না (শুধু চূড়ান্ত বিল দেখাবে) */
      lang: 'bn',               /* 'bn' = বাংলা · 'en' = English */
      theme: 'system',           /* browser appearance: 'system' | 'dark' | 'light' */
      shopNameBn: 'সোয়েব মটরস এন্ড টায়ার হাউস',
      invoiceStatus: { due: 'বাকি', paid: 'পরিশোধিত', partial: 'আংশিক পরিশোধিত' },
      pin: '2828',
      setupDone: true
    };
  }
  function defaultState() {
    return {
      version: 1,
      meta: { createdAt: iso(), updatedAt: iso(), saveSeq: 0, shop: 'Shoeb Motors & Tyre House', lastBackupDay: '' },
      deleted: [],                 /* মুছে ফেলা তথ্য (শুধু মালিক দেখে; ফাইলও জমা থাকে) */
      settings: defaultSettings(),
      products: [],
      customers: [],
      sales: [],
      receipts: [],
      payments: [],
      expenses: [],
      heldSales: [],
      dayClosings: [],
      counters: { invoice: 0, product: 0, customer: 0, payment: 0, expense: 0, vehicle: 0 }
    };
  }
  function normalize(s) {
    var d = defaultState();
    /* প্রথমবার চালু: কোনো তথ্য নেই — যেন ভুল না হয় */
    if (!s || typeof s !== 'object') return d;
    if (s.settings && ['MS Shoeb Motors & Tyre House','Shoeb Motors & Tyre House'].indexOf(s.settings.shopName) >= 0) s.settings.shopName = 'Shoeb Motors & Tyre House';
    if (s.settings && ['শোয়েব মটরস ও টায়ার হাউস','সোয়েব মটরস ও টায়ার হাউস','মেসার্স সোয়েব মটরস এন্ড টায়ার হাউজ','মেসার্স সোয়েব মোটর্স এন্ড টায়ার হাউজ','সোয়েব মটরস','সোয়েব মোটরস','সোয়েব মোটরস','সোয়েব মটরস'].indexOf(s.settings.shopNameBn) >= 0) s.settings.shopNameBn = 'সোয়েব মটরস এন্ড টায়ার হাউস';
    if (s.settings && s.settings.tagline === 'টায়ার · টিউব · মোটর পার্টস') s.settings.tagline = 'এখানে টায়ার, টিউব, রিম, পলি ত্রিপল, রশি ও মটর গাড়ীর যাবতীয় যন্ত্রাংশ বিক্রয় করা হয়';
    if (s.settings && s.settings.address === 'ঢাকা রোড, কালীগঞ্জ, ঝিনাইদহ') s.settings.address = 'কালীগঞ্জ, ঝিনাইদহ';
    if (s.settings && !s.settings.phone) s.settings.phone = '০১৭১১-৭২৮৯৭৫, ০১৭১২-২৮১৭৭২';
    /* পুরনো অপ্রয়োজনীয় নম্বর থাকলে শুধু সেগুলো পরিষ্কার করি। Custom একটিমাত্র নম্বরও
       বৈধ — comma না থাকার কারণে সেটিকে default নম্বর দিয়ে আর overwrite করা হবে না। */
    if (s.settings && s.settings.phone) {
      var _ph = String(s.settings.phone)
        .replace(/\s*০১৭১৪-?৫৪৪৫৮১\s*,?/g, '').replace(/\s*০১৮৪২-?২৮১৭৭২\s*,?/g, '')
        .replace(/^\s*,+\s*/, '').replace(/\s*,+\s*$/g, '').replace(/\s*,\s*/g, ', ').replace(/,\s*,/g, ',').trim();
      _ph = _ph.replace('০১৭১১৭২৮৯৭৫', '০১৭১১-৭২৮৯৭৫').replace('০১৭১২২৮১৭৭২', '০১৭১২-২৮১৭৭২');
      if (!_ph) _ph = '০১৭১১-৭২৮৯৭৫, ০১৭১২-২৮১৭৭২';
      s.settings.phone = _ph;
    }
    if (s.settings && typeof s.settings.logoImage !== 'string') s.settings.logoImage = '';
    s.version = s.version || 1;
    if (!Array.isArray(s.deleted)) s.deleted = [];
    s.meta = Object.assign(d.meta, s.meta || {});
    s.settings = Object.assign(d.settings, s.settings || {});
    s.settings.setupDone = true;
    s.products = s.products || []; s.customers = s.customers || [];
    s.sales = s.sales || []; s.expenses = s.expenses || [];
    s.heldSales = s.heldSales || [];
    s.dayClosings = Array.isArray(s.dayClosings) ? s.dayClosings : [];
    // receipts = every money-in event (money taken on an invoice + payments against old dues)
    s.receipts = s.receipts || [];
    if (s.payments && s.payments.length) {
      s.payments.forEach(function (p) { p.type = p.type || 'due'; s.receipts.push(p); });
    }
    s.payments = [];
    s.counters = Object.assign(d.counters, s.counters || {});
    s.products.forEach(function (p) {
      p.qty = num(p.qty); p.buyPrice = num(p.buyPrice); p.sellPrice = num(p.sellPrice);
      if (p.position === undefined) p.position = '';
      if (p.position === 'সামনে') p.position = 'F';
      if (p.position === 'পিছনে') p.position = 'R';
      var rawLow = p.lowStock;
      var lvl = num(rawLow);
      /* কম স্টকের সীমা business data: 0-ও valid এবং D-drive state-এ স্থায়ীভাবে থাকে।
         শুধু field একেবারে missing/blank বা legacy 3 হলে default 2 করি। */
      p.lowStock = (rawLow === undefined || rawLow === null || rawLow === '' || lvl === 3)
        ? 2
        : Math.max(0, Math.floor(lvl));
      p.purchases = p.purchases || []; p.adjustments = p.adjustments || [];
      p.active = p.active === false ? false : true;
      if (p.pricePending === undefined) p.pricePending = num(p.sellPrice) <= 0;
      if (p.buyPricePending === undefined) p.buyPricePending = num(p.buyPrice) <= 0;
    });
    s.customers.forEach(function (c) { c.vehicles = c.vehicles || []; c.payments = c.payments || []; });
    s.sales.forEach(function (sale) {
      sale.items = sale.items || []; sale.paid = num(sale.paid); sale.discount = num(sale.discount);
      /* Collection tracking was introduced after the invoice-only build.
         Old simpleSale invoices stay historically settled so an upgrade never creates false dues. */
      if (sale.collectionTracking === undefined) {
        if (sale.simpleSale === true || sale.paymentTracking === false) {
          sale.collectionTracking = false;
          sale.paid = num(sale.total);
          sale.due = 0;
        } else {
          sale.collectionTracking = true;
          sale.due = round2(Math.max(0, num(sale.total) - sale.paid));
        }
      } else if (sale.collectionTracking === true) {
        sale.due = round2(Math.max(0, num(sale.total) - sale.paid));
        sale.credit = round2(Math.max(0, sale.paid - num(sale.total)));
        sale.duePending = sale.items && sale.items.some(function (i) { return i.pricePending === true || num(i.price) <= 0; });
      }
      var computedSub = 0, computedCost = 0;
      var storedSaleCost = num(sale.cost);
      var completeItemCost = true;
      sale.items.forEach(function (i) {
        var hasUnitCost = i.cost !== undefined && i.cost !== null && i.cost !== '';
        var hasCostTotal = i.costTotal !== undefined && i.costTotal !== null && i.costTotal !== '';
        i.qty = num(i.qty); i.price = num(i.price);
        // Old/imported invoices sometimes stored only sale.cost or item.costTotal. Do not
        // silently turn that historical cost into zero while normalizing the invoice.
        if (!hasUnitCost && hasCostTotal && i.qty) i.cost = round2(num(i.costTotal) / i.qty);
        else i.cost = num(i.cost);
        if (!hasUnitCost && !hasCostTotal) completeItemCost = false;
        i.total = round2(i.qty * i.price);
        i.costTotal = round2(i.qty * i.cost);
        computedSub += i.total; computedCost += i.costTotal;
        if (i.position === undefined) i.position = '';
        if (i.position === 'সামনে') i.position = 'F';
        if (i.position === 'পিছনে') i.position = 'R';
        if (i.pricePending === undefined) i.pricePending = num(i.price) <= 0;
      });
      if (sale.subTotal === undefined || sale.subTotal === null || sale.subTotal === '') sale.subTotal = round2(computedSub);
      sale.cost = round2(completeItemCost ? computedCost : (storedSaleCost || computedCost));
      // Canonical profit is always net invoice total minus cost. This repairs historical
      // invoices created by the old proportional-discount formula without changing sales totals.
      sale.profit = round2(num(sale.total) - sale.cost);
    });
    return s;
  }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var text = String(v == null ? '' : v).trim()
      .replace(/[০-৯]/g, function (d) { return String('০১২৩৪৫৬৭৮৯'.indexOf(d)); })
      .replace(/,/g, '').replace(/৳/g, '').replace(/\s+/g, '');
    var n = parseFloat(text);
    return isNaN(n) || !isFinite(n) ? 0 : n;
  }
  function round2(n) { return Math.round((num(n) + Number.EPSILON) * 100) / 100; }
  function uid(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  function nextNo(kind) {
    state.counters[kind] = (state.counters[kind] || 0) + 1;
    return state.counters[kind];
  }
  function nextInvoiceNo() {
    var pre = (state.settings.invoicePrefix || 'INV').trim();
    var n = nextNo('invoice');
    return pre + '-' + String(n).padStart(4, '0');
  }

  /* ------------------------- browser-only login preference ------------------------- */
  function readLegacyBusinessCache() {
    // Read-only migration path for older releases. This version never writes a business
    // snapshot back to localStorage. We keep the old copy until a D-drive migration or
    // archive has been confirmed, so upgrading cannot silently destroy the only copy.
    try {
      var raw = localStorage.getItem('shoebMotorsState');
      if (!raw || raw.trim().length < 3) return null;
      var obj = JSON.parse(raw);
      return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : null;
    } catch (e) { return null; }
  }
  function purgeLegacyBusinessCache() {
    // Older builds kept a full recovery copy in localStorage. Remove it only after the
    // current build has confirmed that the D-drive/local-server side has a safe copy.
    try {
      localStorage.removeItem('shoebMotorsState');
      var remove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (k.indexOf('shoebMotorsConflict-') === 0) remove.push(k);
      }
      remove.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { } });
    } catch (e) { }
  }
  async function archiveLegacyBusinessCache(obj) {
    try {
      var r = await fetch('api/archive', {
        method:'POST', cache:'no-store',
        headers:{ 'Content-Type':'application/json; charset=utf-8' },
        body:JSON.stringify({ name:'legacy-browser-cache-before-removal', data:obj })
      });
      return r.ok;
    } catch (e) { return false; }
  }
  function readUnlockState() {
    try { return localStorage.getItem(LOCAL_UNLOCK_KEY) === '1'; } catch (e) { return false; }
  }
  function writeUnlockState(v) {
    try { localStorage.setItem(LOCAL_UNLOCK_KEY, v ? '1' : '0'); } catch (e) { }
  }
  function syncBrowserPrefs() {
    // Explicit browser allow-list: PIN + visual preference only. No products, invoices,
    // customers, receipts, stock history, deleted records, or counters are persisted here.
    try {
      var st = state && state.settings ? state.settings : {};
      if (st.pin) localStorage.setItem(BROWSER_PIN_KEY, String(st.pin));
      else localStorage.removeItem(BROWSER_PIN_KEY);
      if (!localStorage.getItem(BROWSER_THEME_KEY)) localStorage.setItem(BROWSER_THEME_KEY, 'system');
    } catch (e) { }
  }
  function purgeUnexpectedBrowserBusinessData() {
    // Do not touch unrelated sites/app keys. For this app, only these small UI/security
    // preferences may remain in localStorage. Business data belongs on the D-drive server.
    try {
      var allowed = {};
      allowed[LOCAL_UNLOCK_KEY] = true;
      allowed[BROWSER_PIN_KEY] = true;
      allowed[BROWSER_THEME_KEY] = true;
      allowed['shoebmotors.lastView'] = true;
      var remove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (/^shoeb/i.test(k) && !allowed[k]) remove.push(k);
      }
      remove.forEach(function (k) { try { localStorage.removeItem(k); } catch (_) { } });
    } catch (e) { }
    try {
      var sr = [];
      for (var j = 0; j < sessionStorage.length; j++) {
        var sk = sessionStorage.key(j) || '';
        if (/^shoeb/i.test(sk)) sr.push(sk);
      }
      sr.forEach(function (k) { try { sessionStorage.removeItem(k); } catch (_) { } });
    } catch (e) { }
    // This app does not use IndexedDB. Remove only old Shoeb-named databases if the
    // browser supports database enumeration, so no historical stock/invoice DB lingers.
    try {
      if (window.indexedDB && indexedDB.databases) {
        indexedDB.databases().then(function (dbs) {
          (dbs || []).forEach(function (d) {
            var n = d && d.name ? String(d.name) : '';
            if (/shoeb/i.test(n)) { try { indexedDB.deleteDatabase(n); } catch (_) { } }
          });
        }).catch(function () { });
      }
    } catch (e) { }
  }
  function writePcTrust(v) {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    try {
      fetch(v ? 'api/login-trust/on' : 'api/login-trust/off', { method:'POST', cache:'no-store' }).catch(function () { });
      if (serverInfo) serverInfo.trustedLogin = !!v;
    } catch (e) { }
  }

  /* ------------------------- লেখার গোলমাল সারানো -------------------------
     পুরনো ভার্সনের এক সমস্যায় বাংলা লেখা “à¦à§‡à¦·” ধরনের আকারে সেভ হয়ে যেত।
     এখানে সেটি নিজে থেকেই ঠিক হয়ে যায় (কিছু হারায় না)। */
  var CP1252_REV = {
    '\u20AC': 0x80, '\u201A': 0x82, '\u0192': 0x83, '\u201E': 0x84, '\u2026': 0x85, '\u2020': 0x86, '\u2021': 0x87,
    '\u02C6': 0x88, '\u2030': 0x89, '\u0160': 0x8A, '\u2039': 0x8B, '\u0152': 0x8C, '\u017D': 0x8E, '\u2018': 0x91,
    '\u2019': 0x92, '\u201C': 0x93, '\u201D': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97, '\u02DC': 0x98,
    '\u2122': 0x99, '\u0161': 0x9A, '\u203A': 0x9B, '\u0153': 0x9C, '\u017E': 0x9E, '\u0178': 0x9F
  };
  /* একবারে এক লেয়ারের ভুল এনকোডিং ফিরিয়ে (reverse) দেয়; আর সম্ভব না হলে null */
  function fixTextOnce(v) {
    if (typeof v !== 'string' || v.length < 2) return null;
    var i, high = 0, bytes = new Uint8Array(v.length);
    for (i = 0; i < v.length; i++) {
      var ch = v.charAt(i), code = v.charCodeAt(i);
      if (code < 0x80) { bytes[i] = code; continue; }
      if (code <= 0xFF) { bytes[i] = code; high++; continue; }
      var back = CP1252_REV[ch];
      if (back === undefined) return null;
      bytes[i] = back; high++;
    }
    if (!high) return null;
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) { return null; }
  }
  /* কিছু পুরনো ডেটায় এই গোলমাল ২-৩ বার পরপর হয়ে জমে গেছে (এক লেয়ারের উপর আরেক লেয়ার)।
     তাই একবারে না থেমে, যতবার সম্ভব ততবার লেয়ার খুলে দেখা হয় — আসল বাংলা লেখা
     (যেটা আর এভাবে ভাঙা যায় না) পাওয়া গেলেই থেমে যায়। */
  function fixText(v) {
    if (typeof v !== 'string' || v.length < 2) return v;
    var cur = v, best = null, guard = 0;
    while (guard++ < 6) {
      var next = fixTextOnce(cur);
      if (next === null) break;
      cur = next;
      if (/[\u0980-\u09FF]/.test(cur)) best = cur;
    }
    if (best && !/[\u0980-\u09FF]/.test(v)) return best;
    return v;
  }
  function repairTree(node, counter) {
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) node[i] = repairTree(node[i], counter);
      return node;
    }
    if (node && typeof node === 'object') {
      Object.keys(node).forEach(function (k) {
        var v = node[k];
        if (typeof v === 'string') {
          var f = fixText(v);
          if (f !== v) { node[k] = f; counter.n++; }
        } else if (v && typeof v === 'object') {
          node[k] = repairTree(v, counter);
        }
      });
      return node;
    }
    return node;
  }
  function repairText(input) {
    var counter = { n: 0 };
    var out = repairTree(input, counter);
    return { value: out, fixed: counter.n };
  }

  function stateStamp(obj) {
    var x = obj && obj.meta && (obj.meta.updatedAt || obj.meta.createdAt);
    var t = x ? Date.parse(x) : 0;
    return isFinite(t) ? t : 0;
  }
  function stateSeq(obj) {
    var n = obj && obj.meta ? Number(obj.meta.saveSeq || 0) : 0;
    return isFinite(n) ? n : 0;
  }
  function sameStateLineage(a, b) {
    var ac = a && a.meta && a.meta.createdAt, bc = b && b.meta && b.meta.createdAt;
    return !!(ac && bc && ac === bc);
  }
  /* JSON snapshot of the current state, sent as the save request body. */
  function serialize() {
    return JSON.stringify(state);
  }
  function isStateNewer(a, b) {
    if (!b) return !!a;
    if (!a) return false;
    if (sameStateLineage(a, b) && stateSeq(a) !== stateSeq(b)) return stateSeq(a) > stateSeq(b);
    return stateStamp(a) > stateStamp(b);
  }

  /* ------------------------- load ------------------------- */
  async function load() {
    var loaded = null;
    var serverLoaded = null;
    var serverDetected = false;
    var serverUnconfigured = false;

    // Mode 1 — installed local server
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      try {
        var ctl = new AbortController();
        var t = setTimeout(function () { ctl.abort(); }, 900);
        var infoRes = await fetch('api/info', { signal: ctl.signal, cache: 'no-store' });
        clearTimeout(t);
        if (infoRes.ok) {
          var info = await infoRes.json();
          if (info && info.ok) {
            serverInfo = info; mode = 'server'; serverDetected = true;
            serverUnconfigured = (info.configured === false);
            if (!serverUnconfigured) {
              var st = await fetch('api/state', { cache: 'no-store' });
              var txt = await st.text();
              if (st.ok && txt && txt.trim().length > 3 && txt.trim() !== '{}') {
                serverLoaded = JSON.parse(txt);
                loaded = serverLoaded;
                lastServerSeq = stateSeq(serverLoaded);
                lastServerLineage = (serverLoaded.meta && serverLoaded.meta.createdAt) || '';
              }
            }
          }
        }
      } catch (e) { /* no server — continue */ }
    }

    // One-time upgrade from older browser-cache builds. Promote the old snapshot only if
    // the D-drive copy is empty, or if it is clearly a newer revision of the same lineage.
    // Otherwise archive the old snapshot on D: before removing it from localStorage.
    var legacyBrowserState = readLegacyBusinessCache();
    if (legacyBrowserState && serverDetected && !serverUnconfigured) {
      var promoteLegacy = !serverLoaded || (sameStateLineage(legacyBrowserState, serverLoaded) && isStateNewer(legacyBrowserState, serverLoaded));
      var legacySafeOnDisk = false;
      if (promoteLegacy) {
        try {
          var mig = await fetch('api/state', {
            method:'POST', cache:'no-store',
            headers:{
              'Content-Type':'application/json; charset=utf-8',
              'X-Shoeb-Allow-Replace':'1',
              'X-Shoeb-Base-Seq':String(lastServerSeq || 0)
            },
            body:JSON.stringify(legacyBrowserState)
          });
          var migReply = await mig.json().catch(function () { return {}; });
          if (mig.ok && migReply && migReply.saved === true) {
            serverLoaded = legacyBrowserState; loaded = legacyBrowserState;
            lastServerSeq = Number(migReply.savedSeq !== undefined ? migReply.savedSeq : stateSeq(legacyBrowserState)) || 0;
            lastServerLineage = (legacyBrowserState.meta && legacyBrowserState.meta.createdAt) || '';
            legacySafeOnDisk = true;
          }
        } catch (e) { }
      } else {
        legacySafeOnDisk = await archiveLegacyBusinessCache(legacyBrowserState);
      }
      if (legacySafeOnDisk) purgeLegacyBusinessCache();
    }

    // Once the safe migration opportunity has run, remove any Shoeb business/session cache.
    // If an old browser snapshot is temporarily the ONLY known copy because the local server
    // is unavailable, preserve it until a later successful D-drive migration rather than lose data.
    // Static CSS/JS files remain available through CacheStorage/service worker.
    if (!legacyBrowserState || (serverDetected && !serverUnconfigured)) purgeUnexpectedBrowserBusinessData();
    state = normalize(loaded);
    var browserUnlocked = readUnlockState();
    var pcTrusted = !!(serverInfo && serverInfo.trustedLogin === true);
    state.ui_unlocked = browserUnlocked || pcTrusted;
    // Upgrade an old browser-only remembered login to the PC trust marker. This stores no
    // business records in the browser; only the unlock preference remains there.
    if (serverDetected && browserUnlocked && !pcTrusted) writePcTrust(true);
    if (!serverDetected || serverUnconfigured) { state.meta = state.meta || {}; state.meta.storageUnconfigured = true; }
    syncBrowserPrefs();
    if (loaded) {
      var rep = repairText(state);
      state = rep.value;
      if (rep.fixed > 0) {
        fixedTexts = rep.fixed;
        setTimeout(function () { try { save('textfix'); } catch (e) { } }, 250);
      }
    }
    return { mode: mode, serverInfo: serverInfo, hasData: !!loaded, folder: '' };
  }

  /* ------------------------- save ------------------------- */
  function postStateSync(text) {
    if (mode !== 'server' || !serverInfo || serverInfo.configured === false) {
      return { ok:false, error:'লোকাল Data ফোল্ডার/সার্ভার পাওয়া যায়নি' };
    }
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'api/state', false);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
      xhr.setRequestHeader('X-Shoeb-Base-Seq', String(lastServerSeq || 0));
      xhr.setRequestHeader('X-Shoeb-Lineage', String(lastServerLineage || ''));
      if (replacePending) xhr.setRequestHeader('X-Shoeb-Allow-Replace', '1');
      xhr.send(text);
      var reply = null;
      try { reply = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch (_) { }
      if (xhr.status === 409 && reply && reply.conflict === true) return { ok:false, conflict:true, reply:reply };
      if (xhr.status < 200 || xhr.status >= 300 || !reply || reply.saved !== true) {
        return { ok:false, error:(reply && reply.error) || ('Local save failed (' + xhr.status + ')') };
      }
      return { ok:true, reply:reply };
    } catch (e) {
      return { ok:false, error:(e && e.message) || String(e) };
    }
  }

  function save(reason) {
    dirty = true;
    lastSaveConflict = false;
    if (reason === 'restore-file' || reason === 'delete-all-finalize') replacePending = true;
    state.meta = state.meta || {};
    state.meta.updatedAt = new Date().toISOString();
    state.meta.saveSeq = Math.max(0, Math.floor(num(state.meta.saveSeq))) + 1;
    var text = serialize();

    // No business state is written to localStorage. Confirm the durable local D-drive save
    // synchronously so a successful button click means data.json/SQLite has already been written.
    setSavePill('saving', 'Local Data-তে সেভ হচ্ছে…');
    var result = postStateSync(text);
    if (result.conflict) {
      dirty = false;
      lastSaveConflict = true;
      replacePending = false;
      setTimeout(function () { handleSaveConflict(text, result.reply); }, 0);
      return false;
    }
    if (result.ok) {
      dirty = false;
      lastSaveConflict = false;
      lastServerSeq = Number(result.reply.savedSeq !== undefined ? result.reply.savedSeq : stateSeq(state)) || 0;
      lastServerLineage = (state.meta && state.meta.createdAt) || lastServerLineage;
      replacePending = false;
      lastSavedAt = new Date();
      saveRetryDelay = 2000;
      lastFlushOk = true;
      syncBrowserPrefs();
      purgeUnexpectedBrowserBusinessData();
      setSavePill('ok', '');
      emit('save', { at:lastSavedAt, durableLocal:true });
      return true;
    }

    // Keep the changed state in RAM and retry the D-drive write while the app remains open.
    // We deliberately do NOT fall back to browser storage.
    dirty = true;
    lastFlushOk = false;
    setSavePill('error', 'Local Data-তে সেভ হয়নি — আবার চেষ্টা হচ্ছে');
    if (window.UI && UI.toast) UI.toast('লোকাল ডেটা ফোল্ডারে সেভ নিশ্চিত হয়নি: ' + (result.error || 'অজানা সমস্যা') + '। সফটওয়্যার বন্ধ করবেন না।', 'bad', 9000);
    if (saveQueueTimer) clearTimeout(saveQueueTimer);
    saveQueueTimer = setTimeout(flush, saveRetryDelay);
    return false;
  }

  async function handleSaveConflict(localText, reply) {
    // The server already writes the rejected snapshot under Data\deleted, so recovery never
    // needs browser storage. Reload the canonical D-drive state after warning the user.
    try {
      var st = await fetch('api/state', { cache: 'no-store' });
      var txt = await st.text();
      if (st.ok && txt && txt.trim().length > 3) {
        var canonical = JSON.parse(txt);
        lastServerSeq = stateSeq(canonical);
        lastServerLineage = (canonical.meta && canonical.meta.createdAt) || '';
      }
    } catch (e) { }
    var rf = reply && reply.recoveryFile ? (' Recovery file: ' + reply.recoveryFile) : '';
    setSavePill('error', 'অন্য ট্যাবে নতুন ডেটা সেভ হয়েছে — Local recovery copy রাখা হয়েছে');
    if (window.UI && UI.toast) UI.toast('একই সফটওয়্যার অন্য ট্যাব/উইন্ডোতে বদলানো হয়েছে। এই ট্যাবের পরিবর্তনের Local Recovery Copy রাখা হয়েছে; নতুন ডেটা রক্ষার জন্য পেজ রিলোড হচ্ছে।' + rf, 'warn', 7000);
    setTimeout(function () { try { location.reload(); } catch (e) { } }, 1200);
  }

  async function flush() {
    if (saveQueueTimer) { clearTimeout(saveQueueTimer); saveQueueTimer = null; }
    if (saving) {
      while (saving) await new Promise(function (resolve) { setTimeout(resolve, 100); });
      if (dirty) return flush();
      return lastFlushOk;
    }
    if (!dirty) return true;

    saving = true; dirty = false;
    state.meta = state.meta || {};
    if (!state.meta.updatedAt) state.meta.updatedAt = new Date().toISOString();
    var text = serialize();

    try {
      if (mode !== 'server' || !serverInfo || serverInfo.configured === false) throw new Error('লোকাল Data ফোল্ডার/সার্ভার পাওয়া যায়নি');
      var headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Shoeb-Base-Seq': String(lastServerSeq || 0),
        'X-Shoeb-Lineage': String(lastServerLineage || '')
      };
      if (replacePending) headers['X-Shoeb-Allow-Replace'] = '1';
      var res = await fetch('api/state', { method: 'POST', headers: headers, body: text, cache:'no-store' });
      var reply = null;
      try { reply = await res.json(); } catch (_) { }
      if (res.status === 409 && reply && reply.conflict === true) {
        dirty = false; lastSaveConflict = true; replacePending = false;
        await handleSaveConflict(text, reply);
        lastFlushOk = false;
        return false;
      }
      if (!res.ok || !reply || reply.saved !== true) throw new Error((reply && reply.error) || 'Local Data-তে সেভ হয়নি');
      lastSaveConflict = false;
      lastServerSeq = Number(reply.savedSeq !== undefined ? reply.savedSeq : stateSeq(state)) || 0;
      lastServerLineage = (state.meta && state.meta.createdAt) || lastServerLineage;
      replacePending = false;
      lastSavedAt = new Date();
      saveRetryDelay = 2000;
      setSavePill('ok', '');
      emit('save', { at:lastSavedAt, durableLocal:true });
      lastFlushOk = true;
      return true;
    } catch (e) {
      dirty = true;
      setSavePill('error', 'Local Data-তে সেভ অপেক্ষমাণ');
      emit('save', { at:lastSavedAt, localOnly:false, error:e });
      saveRetryDelay = Math.min(30000, Math.max(2000, saveRetryDelay * 2));
      lastFlushOk = false;
      return false;
    } finally {
      saving = false;
      if (dirty && !saveQueueTimer) saveQueueTimer = setTimeout(flush, saveRetryDelay);
    }
  }
  /* সেভের অবস্থা শুধু সমস্যা হলেই দেখা যায় — সফল সেভে কিছু দেখানো হয় না */
  function setSavePill(kind, text) {
    var p = document.getElementById('savePill');
    if (!p) return;
    if (kind === 'ok') { p.hidden = true; p.textContent = ''; return; }
    p.hidden = false;
    p.textContent = text;
    p.className = 'save-pill' + (kind === 'error' ? ' error' : '');
  }

  /* ---- not-confirmed price helpers (দর নিশ্চিত হয়নি) ---- */
  function itemPending(it) { return !!it && (it.pricePending === true || num(it.price) <= 0); }
  function salePendingItems(sale) { return ((sale && sale.items) || []).filter(itemPending); }
  function saleHasPending(sale) { return salePendingItems(sale).length > 0; }
  function recalcSale(sale) {
    var sub = 0, cost = 0;
    (sale.items || []).forEach(function (i) {
      i.total = round2(num(i.qty) * num(i.price));
      i.costTotal = round2(num(i.qty) * num(i.cost));
      sub += i.total; cost += i.costTotal;
    });
    sale.subTotal = round2(sub);
    sale.discount = round2(Math.min(sale.subTotal, Math.max(0, num(sale.discount))));
    sale.total = round2(Math.max(0, sub - sale.discount));
    sale.cost = round2(cost);
    sale.profit = round2(sale.total - cost);
    if (sale.collectionTracking === true) {
      /* Cash already received must never disappear when a pending price is edited. */
      sale.paid = round2(num(sale.paid));
      sale.due = round2(Math.max(0, sale.total - sale.paid));
      sale.credit = round2(Math.max(0, sale.paid - sale.total));
      sale.duePending = saleHasPending(sale);
    } else if (sale.simpleSale === true || sale.paymentTracking === false) {
      /* historical invoice-only records remain settled */
      sale.paid = sale.total;
      sale.due = 0;
      sale.credit = 0;
      sale.duePending = false;
    } else {
      sale.paid = round2(num(sale.paid));
      sale.due = round2(Math.max(0, sale.total - sale.paid));
      sale.credit = round2(Math.max(0, sale.paid - sale.total));
      sale.duePending = saleHasPending(sale);
    }
    return sale;
  }
  /* Backfill ONLY missing historical buy-cost snapshots for one product.
     Sale price, discount, paid/due and invoice totals are never changed here.
     Existing non-zero item costs remain immutable. */
  function backfillMissingProductCost(productId, unitCost) {
    productId = String(productId || '');
    unitCost = round2(unitCost);
    if (!productId || unitCost <= 0) return { items:0, invoices:0 };
    var itemCount = 0, invoiceCount = 0;
    (state.sales || []).forEach(function (sale) {
      var addedCost = 0, changed = false;
      (sale.items || []).forEach(function (i) {
        if (String(i.productId || '') !== productId) return;
        var existingUnit = num(i.cost);
        var existingTotal = num(i.costTotal);
        if (existingUnit > 0 || existingTotal > 0) return;
        i.cost = unitCost;
        i.costTotal = round2(num(i.qty) * unitCost);
        i.costBackfilledAt = new Date().toISOString();
        addedCost += i.costTotal;
        itemCount++;
        changed = true;
      });
      if (!changed) return;
      sale.cost = round2(num(sale.cost) + addedCost);
      sale.profit = round2(num(sale.total) - sale.cost);
      invoiceCount++;
    });
    return { items:itemCount, invoices:invoiceCount };
  }

  /* fix old sales that were saved before this rule */
  function migratePending(state2) {
    (state2.sales || []).forEach(function (s) {
      var dirty = false;
      (s.items || []).forEach(function (i) {
        if (i.pricePending === undefined) { i.pricePending = num(i.price) <= 0; dirty = true; }
      });
      if (saleHasPending(s)) { /* keep as is */ }
    });
    return state2;
  }

  /* ------------------------- cash collection ledger ------------------------- */
  function collectionById(id) {
    return (state.receipts || []).filter(function (r) { return r.id === id && r.type === 'collection'; })[0];
  }
  /* Always the source of truth for "how much is left on this invoice".
     Never trust a cached sale.due field for validation — it can drift out of
     sync (stale reference held across a refresh/cloud-sync, an older object
     snapshot, etc.) and a stale/too-small due wrongly blocks a legitimate
     collection. Recompute from total/paid every time and self-heal the
     cached field so future reads/writes stay correct too. */
  function trueDue(sale) {
    if (!sale) return 0;
    var due = round2(Math.max(0, num(sale.total) - num(sale.paid)));
    sale.due = due; // self-heal any stale cached value
    return due;
  }
  function addCollection(saleId, amount, date, note, reminderDate) {
    var sale = saleById(saleId);
    if (!sale) throw new Error('Invoice not found');
    if (sale.collectionTracking !== true) throw new Error('This historical invoice is not in collection tracking');
    var amt = round2(amount);
    var hasPendingPrice = saleHasPending(sale);
    var due = trueDue(sale);
    if (amt <= 0) throw new Error('Collection amount must be greater than zero');
    /* Pending-price invoice: final due is unknown, so received cash is allowed as an advance. */
    if (!hasPendingPrice && amt > due + 0.01) throw new Error('Collection cannot be more than the invoice due');
    /* Amount is within a poisha of the due (e.g. user typed the on-screen
       rounded due) — treat it as a full settlement instead of rejecting it. */
    if (!hasPendingPrice && amt > due) amt = due;
    var rec = {
      id: uid('col'), no: 'COL-' + String(nextNo('payment')).padStart(5, '0'), type: 'collection',
      saleId: sale.id, invoiceNo: sale.invoiceNo, customerId: sale.customerId || '',
      customerName: sale.customerNameBn || sale.customerName || '', amount: amt,
      date: date ? new Date(date + 'T12:00:00').toISOString() : new Date().toISOString(),
      note: (note || '').trim(), createdAt: new Date().toISOString()
    };
    state.receipts = state.receipts || [];
    state.receipts.push(rec);
    sale.paid = round2(num(sale.paid) + amt);
    sale.due = round2(Math.max(0, num(sale.total) - sale.paid));
    sale.credit = round2(Math.max(0, sale.paid - num(sale.total)));
    sale.duePending = saleHasPending(sale);
    /* বাকি রিমাইন্ডার — এই কালেকশনের পর যদি এখনও বাকি থাকে (বা দর অপেক্ষমাণ থাকে),
       "কবে বাকিটা দেবে" তারিখ ও নোট সেলে সেভ হয়। বাকি সম্পূর্ণ মিটে গেলে রিমাইন্ডার মুছে যায়। */
    if (reminderDate && (sale.due > 0.009 || sale.duePending)) {
      sale.dueReminderDate = reminderDate;
      sale.dueReminderNote = (note || '').trim();
    } else {
      sale.dueReminderDate = '';
      sale.dueReminderNote = '';
    }
    save();
    return rec;
  }

  function dueKey(sale) {
    if (sale.customerId) return 'id:' + sale.customerId;
    var phone = String(sale.customerPhone || '').trim().replace(/\D+/g, '');
    if (phone) return 'ph:' + phone;
    return 'nm:' + String(sale.customerNameBn || sale.customerName || 'ওয়াক-ইন').trim().toLowerCase();
  }
  function duePaymentAccount(key) {
    var c = key.indexOf('id:') === 0 ? customerById(key.slice(3)) : null;
    var matches = state.sales.filter(function (s) { return dueKey(s) === key && s.collectionTracking === true; });
    var sales = matches.filter(function (s) { return !saleHasPending(s) && trueDue(s) > 0.009; })
      .sort(function (a,b) { return (new Date(a.date) - new Date(b.date)) || String(a.id).localeCompare(String(b.id)); });
    var opening = c ? openingDue(c.id) : 0;
    var first = matches[0] || {};
    return { customerId:c ? c.id : first.customerId || '', name:c ? c.nameBn || c.name : first.customerNameBn || first.customerName || 'ওয়াক-ইন',
      phone:c ? c.phone || '' : first.customerPhone || '', opening:opening, sales:sales,
      pending:matches.some(saleHasPending), total:round2(opening + sales.reduce(function (a,s) { return a + trueDue(s); },0)) };
  }
  function collectionReceipt(rec) {
    if (!rec || !rec.paymentGroup) return rec;
    var parts = collectionsInRange(null, null).filter(function (r) { return r.paymentGroup === rec.paymentGroup; });
    if (!parts.length) return rec;
    var summary = Object.assign({}, parts[0]);
    summary.amount = round2(parts.reduce(function (a,r) { return a + num(r.amount); },0));
    summary.invoiceNo = parts.map(function (r) { return r.invoiceNo; }).join(', ');
    summary.paymentParts = parts.map(function (r) { return { invoiceNo:r.invoiceNo, amount:r.amount }; });
    return summary;
  }
  function payCustomerDue(key, value, date) {
    var account = duePaymentAccount(key), amount = balanceAmount(value);
    var dateValue = String(date || '');
    var parsed = new Date(dateValue + 'T12:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !isFinite(parsed.getTime()) || todayStr(parsed) !== dateValue)
      throw new Error('সঠিক পেমেন্টের তারিখ নির্বাচন করুন।');
    if (amount <= 0 || amount > account.total) throw new Error('জমার পরিমাণ শূন্যের বেশি এবং মোট বকেয়ার মধ্যে হতে হবে।');
    var remaining = amount, parts = [];
    if (account.opening > 0) {
      var openingAmount = Math.min(remaining, account.opening);
      parts.push({openingBalance:true, saleId:'', invoiceNo:'আগের বকেয়া', amount:openingAmount});
      remaining = round2(remaining - openingAmount);
    }
    account.sales.forEach(function (sale) {
      if (remaining <= 0) return;
      var paid = Math.min(remaining, trueDue(sale));
      parts.push({saleId:sale.id, invoiceNo:sale.invoiceNo, amount:paid});
      remaining = round2(remaining - paid);
    });
    var group = uid('pay'), no = 'COL-' + String(nextNo('payment')).padStart(5,'0'), now = iso();
    state.receipts = state.receipts || [];
    parts.forEach(function (part) {
      Object.assign(part, {id:uid('col'), no:no, type:'collection', paymentGroup:group, dueKey:key,
        customerId:account.customerId, customerName:account.name, customerPhone:account.phone,
        date:parsed.toISOString(), createdAt:now, note:'বাকি তালিকা থেকে পেমেন্ট',
        balanceAfter:round2(account.total - amount), pendingPrice:account.pending});
      if (part.saleId) {
        var sale = saleById(part.saleId);
        sale.paid = round2(num(sale.paid) + part.amount);
        sale.due = round2(Math.max(0, num(sale.total) - sale.paid));
        sale.credit = round2(Math.max(0, sale.paid - num(sale.total)));
        sale.duePending = false;
        if (sale.due <= 0.009) { sale.dueReminderDate = ''; sale.dueReminderNote = ''; }
      }
      state.receipts.push(part);
    });
    // One durable save for every allocation in this payment.
    var saved = save();
    return { saved:saved, receipt:collectionReceipt(parts[0]) };
  }

  function removeCollection(id) {
    var rec = collectionById(id);
    if (!rec) return false;
    var parts = rec.paymentGroup ? (state.receipts || []).filter(function (r) { return r.paymentGroup === rec.paymentGroup; }) : [rec];
    parts.forEach(function (part) {
      var sale = saleById(part.saleId);
      archiveDeleted('collection', part.invoiceNo || part.no, part, { amount:num(part.amount), date:part.date, customer:part.customerName || '' });
      state.receipts = state.receipts.filter(function (r) { return r.id !== part.id; });
      if (sale && sale.collectionTracking === true) {
        sale.paid = round2(Math.max(0, num(sale.paid) - num(part.amount)));
        sale.due = round2(Math.max(0, num(sale.total) - sale.paid));
        sale.credit = round2(Math.max(0, sale.paid - num(sale.total)));
        sale.duePending = saleHasPending(sale);
      }
    });
    save();
    return true;
  }
  function collectionsInRange(from, to) {
    return (state.receipts || []).filter(function (r) {
      if (r.type !== 'collection') return false;
      // Old builds could leave a collection behind after its invoice was deleted. Keep the
      // raw record for recovery, but do not let an orphan receipt distort cash totals.
      if (r.saleId && !saleById(r.saleId)) return false;
      var d = todayStr(r.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  function trackedDueTotal() {
    return round2(state.sales.reduce(function (a, sale) {
      return a + (sale.collectionTracking === true && !saleHasPending(sale) ? num(sale.due) : 0);
    }, 0) + state.customers.reduce(function (a, c) { return a + openingDue(c.id); }, 0));
  }

  /* ------------------------- day closing ledger ------------------------- */
  function dayClosingByDate(date) {
    var day = todayStr(date);
    return (state.dayClosings || []).filter(function (r) { return r.date === day; })[0];
  }
  function dayClosingById(id) {
    return (state.dayClosings || []).filter(function (r) { return r.id === id; })[0];
  }
  function saveDayClosing(date, data) {
    var day = todayStr(date), now = new Date().toISOString();
    state.dayClosings = state.dayClosings || [];
    var rec = dayClosingByDate(day);
    if (!rec) {
      rec = { id: uid('close'), date: day, createdAt: now };
      state.dayClosings.push(rec);
    }
    data = data || {};
    rec.invoiceCount = num(data.invoiceCount);
    rec.salesTotal = round2(data.salesTotal);
    rec.collectionCount = num(data.collectionCount);
    rec.expectedCash = round2(data.expectedCash);
    rec.dayExpense = Math.max(0, round2(data.dayExpense));
    rec.adjustedExpectedCash = round2(data.adjustedExpectedCash !== undefined ? data.adjustedExpectedCash : (rec.expectedCash - rec.dayExpense));
    rec.actualCash = round2(data.actualCash);
    rec.difference = round2(rec.actualCash - rec.adjustedExpectedCash);
    rec.newInvoiceCollected = round2(data.newInvoiceCollected);
    rec.oldInvoiceCollected = round2(data.oldInvoiceCollected);
    rec.invoiceDueAtClose = round2(data.invoiceDueAtClose);
    rec.note = String(data.note || '').trim();
    rec.closedAt = now;
    rec.updatedAt = now;
    save();
    return rec;
  }
  function dayClosingsList() {
    return (state.dayClosings || []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  }

  /* ------------------------- queries / helpers ------------------------- */
  function productById(id) { return state.products.filter(function (p) { return p.id === id; })[0]; }
  function customerById(id) { return state.customers.filter(function (c) { return c.id === id; })[0]; }
  function saleById(id) { return state.sales.filter(function (s) { return s.id === id; })[0]; }
  function stockQty(pid) { var p = productById(pid); return p ? num(p.qty) : 0; }
  function todaysSales() { var t = todayStr(); return state.sales.filter(function (s) { return todayStr(s.date) === t; }); }

  // how much each customer owes: the unpaid part of their invoices (each invoice keeps its own
  // paid/due, so a later collection already reduces it — receipts are only the money ledger)

  // Opening receivables stay outside sales, stock and profit.
  function openingPaid(cid) {
    return round2((state.receipts || []).reduce(function (a, r) {
      return a + (r.type === 'collection' && r.openingBalance === true && r.customerId === cid ? num(r.amount) : 0);
    }, 0));
  }
  function openingDue(cid) {
    var c = customerById(cid);
    return c ? round2(Math.max(0, num(c.openingBalance) - openingPaid(cid))) : 0;
  }
  function balanceAmount(value) {
    var raw = String(value == null ? '' : value).trim().replace(/[০-৯]/g, function(d) { return String('০১২৩৪৫৬৭৮৯'.indexOf(d)); });
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) throw new Error('সঠিক টাকার পরিমাণ লিখুন (সর্বোচ্চ দুই দশমিক)।');
    var amount = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount > 999999999999) throw new Error('টাকার পরিমাণ সীমার বাইরে।');
    return round2(amount);
  }
  function setOpeningBalance(cid, value) {
    var c = customerById(cid), amount = balanceAmount(value);
    if (!c) throw new Error('কাস্টমার পাওয়া যায়নি।');
    if (amount < openingPaid(cid)) throw new Error('ইতিমধ্যে জমা নেওয়া টাকার চেয়ে আগের বকেয়া কম হতে পারবে না।');
    c.openingBalance = amount;
    c.openingBalanceUpdatedAt = iso();
    save();
  }
  function collectOpeningBalance(cid, value) {
    var c = customerById(cid), amount = balanceAmount(value);
    if (!c) throw new Error('কাস্টমার পাওয়া যায়নি।');
    if (amount <= 0 || amount > openingDue(cid)) throw new Error('জমার পরিমাণ শূন্যের বেশি এবং আগের অবশিষ্ট বকেয়ার মধ্যে হতে হবে।');
    var rec = { id: uid('col'), no: 'COL-' + String(nextNo('payment')).padStart(5, '0'),
      type: 'collection', openingBalance: true, saleId: '', invoiceNo: 'আগের বকেয়া',
      customerId: cid, customerName: c.nameBn || c.name || '', amount: amount,
      date: iso(), createdAt: iso(), note: 'আগের বকেয়া আদায়' };
    state.receipts = state.receipts || [];
    state.receipts.push(rec);
    save();
    return rec;
  }

  function customerBalance(cid) {
    if (!cid) return 0;
    var due = openingDue(cid);
    state.sales.forEach(function (s) { if (s.customerId === cid) due += num(s.due); });
    return round2(Math.max(0, due));
  }
  function customerStats(cid) {
    var sales = state.sales.filter(function (s) { return s.customerId === cid; });
    var total = 0, items = 0, last = null, profit = 0, discount = 0, subTotal = 0, paid = 0;
    sales.forEach(function (s) {
      total += num(s.total); items += s.items.reduce(function (a, i) { return a + num(i.qty); }, 0);
      profit += num(s.profit);
      discount += num(s.discount);
      subTotal += num(s.subTotal);
      paid += num(s.paid);
      if (!last || new Date(s.date) > new Date(last)) last = s.date;
    });
    return { count: sales.length, total: round2(total), items: items, last: last, profit: round2(profit), due: customerBalance(cid), discount: round2(discount), subTotal: round2(subTotal), paid: round2(paid) };
  }
  function saleNetFactor(sale) {
    var gross = num(sale && sale.subTotal);
    if (gross <= 0 && sale && sale.items) gross = sale.items.reduce(function (a, i) { return a + num(i.total || (num(i.qty) * num(i.price))); }, 0);
    if (gross <= 0) return 0;
    return Math.max(0, num(sale.total) / gross);
  }
  function itemNetRevenue(sale, item) {
    var gross = num(item && item.total);
    if (!gross && item) gross = num(item.qty) * num(item.price);
    return gross * saleNetFactor(sale);
  }
  function itemNetProfit(sale, item) {
    return itemNetRevenue(sale, item) - (num(item && item.qty) * num(item && item.cost));
  }

  function productStats(pid, from, to) {
    var qty = 0, revenue = 0, profit = 0, count = 0;
    state.sales.forEach(function (s) {
      if (from && todayStr(s.date) < from) return;
      if (to && todayStr(s.date) > to) return;
      s.items.forEach(function (i) {
        if (i.productId !== pid) return;
        qty += num(i.qty); revenue += itemNetRevenue(s, i);
        profit += itemNetProfit(s, i);
        count++;
      });
    });
    return { qty: qty, revenue: round2(revenue), profit: round2(profit), count: count };
  }
  // sales in range (dates as yyyy-mm-dd)
  function salesInRange(from, to) {
    return state.sales.filter(function (s) {
      var d = todayStr(s.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  function receiptsInRange(from, to) {
    return (state.receipts || []).filter(function (p) {
      var d = todayStr(p.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  function paymentsInRange(from, to) {
    return (state.receipts || []).filter(function (p) { if (p.type === 'sale') return false;
      var d = todayStr(p.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  function expensesInRange(from, to) {
    return state.expenses.filter(function (e) {
      var d = todayStr(e.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  function stockValue() {
    return round2(state.products.reduce(function (a, p) { return a + num(p.qty) * num(p.buyPrice); }, 0));
  }
  function expectedProfit() {
    // স্টকে থাকা সব পণ্য বিক্রয়মূল্যে বিক্রি হলে সম্ভাব্য লাভ (ক্রয়মূল্য বাদ দিয়ে)।
    // কাস্টমারকে ছাড় দিলে আসল লাভ এর চেয়ে কম হতে পারে — তাই এটি "প্রত্যাশিত/সম্ভাব্য" লাভ।
    return round2(state.products.reduce(function (a, p) {
      return a + num(p.qty) * (num(p.sellPrice) - num(p.buyPrice));
    }, 0));
  }
  function totalDue() {
    return state.customers.reduce(function (a, c) { return a + Math.max(0, customerBalance(c.id)); }, 0);
  }
  function lowStockList() {
    return state.products.filter(function (p) { var limit = num(p.lowStock); return p.active !== false && limit > 0 && num(p.qty) <= limit; });
  }

  /* বাকি রিমাইন্ডার — যেসব sale-এ "কবে বাকিটা দেবে" তারিখ সেট করা আছে, এখনও বাকি আছে,
     এবং সেই তারিখ আজ অথবা পার হয়ে গেছে (overdue)। টাকা না মেটা পর্যন্ত এখানেই থাকবে। */
  function dueReminderList() {
    var today = todayStr();
    return state.sales.filter(function (s) {
      if (!s.dueReminderDate) return false;
      if (s.collectionTracking !== true) return false;
      var due = trueDue(s);
      if (due <= 0.009 && !saleHasPending(s)) return false;
      return s.dueReminderDate <= today;
    }).sort(function (a, b) { return String(a.dueReminderDate).localeCompare(String(b.dueReminderDate)); });
  }

  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, data) { (listeners[evt] || []).forEach(function (f) { try { f(data); } catch (e) { console.error(e); } }); }

  /* ------------------------- public API ------------------------- */
  return {
    load: load, save: save, flush: flush, id: uid, nextNo: nextNo, nextInvoiceNo: nextInvoiceNo,
    get state() { return state; }, set state(v) { state = v; },
    get mode() { return mode; }, get serverInfo() { return serverInfo; },
    get lastSavedAt() { return lastSavedAt; },
    get lastSaveConflict() { return lastSaveConflict; },
    get isOwnerUnlocked() { return !!(state && state.ui_unlocked); },
    set isOwnerUnlocked(v) {
      if (state) state.ui_unlocked = !!v;
      writeUnlockState(!!v);
      writePcTrust(!!v);
    },
    archiveDeleted: archiveDeleted, deletedList: deletedList, deletedById: deletedById, dropDeleted: dropDeleted,
    defaultState: defaultState, normalize: normalize, defaultSettings: defaultSettings,
round2: round2, num: num, todayStr: todayStr, iso: iso, uid: uid,
  itemPending: itemPending, salePendingItems: salePendingItems, saleHasPending: saleHasPending,
  recalcSale: recalcSale, backfillMissingProductCost: backfillMissingProductCost, migratePending: migratePending,
    on: on, emit: emit, fixText: fixText, repairText: repairText,
    get fixedTexts() { return fixedTexts; },
    productById: productById, customerById: customerById, saleById: saleById, stockQty: stockQty,
    openingPaid: openingPaid, openingDue: openingDue, setOpeningBalance: setOpeningBalance, collectOpeningBalance: collectOpeningBalance,
    customerBalance: customerBalance, customerStats: customerStats, productStats: productStats,
    saleNetFactor: saleNetFactor, itemNetRevenue: itemNetRevenue, itemNetProfit: itemNetProfit,
    salesInRange: salesInRange, paymentsInRange: paymentsInRange, expensesInRange: expensesInRange,
    receiptsInRange: receiptsInRange, collectionsInRange: collectionsInRange,
    dueKey: dueKey, duePaymentAccount: duePaymentAccount, payCustomerDue: payCustomerDue, collectionReceipt: collectionReceipt,
    addCollection: addCollection, removeCollection: removeCollection, collectionById: collectionById, trackedDueTotal: trackedDueTotal, trueDue: trueDue,
    dayClosingByDate: dayClosingByDate, dayClosingById: dayClosingById, saveDayClosing: saveDayClosing, dayClosingsList: dayClosingsList,
    stockValue: stockValue, expectedProfit: expectedProfit, totalDue: totalDue, lowStockList: lowStockList, dueReminderList: dueReminderList, todaysSales: todaysSales,
  };
})();
