/* ================= stock.js — stock (type-wise forms, v12.10), buy price (owner), purchases ================= */
var Stock = (function () {
  var stockPage = 1, PAGE_SIZE = 50;
  var VEHICLES = ['মোটরসাইকেল', 'কার / জিপ', 'সিএনজি / অটো', 'ইজি বাইক', 'লাগোনা / পিকআপ', 'বাস', 'ট্রাক', 'সাইকেল', 'অন্যান্য'];
  var TYPES = ['টায়ার', 'টিউব', 'ব্যাটারি', 'মোটর অয়েল', 'মোটর পার্টস', 'রশি', 'টায়ার জেল', 'পলিথিন', 'পলি ত্রিপল', 'রিম', 'অন্যান্য'];
  var UNITS = ['পিস', 'কেজি', 'ফুট', 'লিটার'];

  function products() { return DB.state.products; }

  function search(q) {
    if (!q) return products();
    var words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return products().filter(function (p) {
      var hay = [p.name, p.brand, p.size, p.model, p.description, p.vehicleType, p.barcode, p.code, p.type, p.note].join(' ').toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    });
  }

  function label(p) {
    if (p && p.name) return p.name;
    return [p.brand, p.size, p.model].filter(Boolean).join(' ');
  }

  /* ---------------- list + tyre-aware sorting ---------------- */
  function asciiDigits(v) {
    return String(v == null ? '' : v).replace(/[০-৯]/g, function (d) { return String('০১২৩৪৫৬৭৮৯'.indexOf(d)); });
  }
  function tyreWidthMm(size) {
    var t = asciiDigits(size).toUpperCase().replace(/,/g, '').trim();
    var m = t.match(/(\d{2,3}(?:\.\d+)?)\s*\//);
    if (m) return parseFloat(m[1]) || 0; // 295/80R22.5 -> 295 mm
    m = t.match(/(\d{1,4}(?:\.\d+)?)\s*(?:R|[-X])/);
    if (!m) m = t.match(/(\d{1,4}(?:\.\d+)?)/);
    if (!m) return 0;
    var n = parseFloat(m[1]) || 0;
    if (n <= 20) return n * 25.4;       // 7.50-16 / 11R22.5 -> inch width
    if (n >= 500 && n <= 1500 && /^\d{3,4}$/.test(m[1])) return (n / 100) * 25.4; // 750-16 / 1000-20
    return n;
  }
  function tyreRim(size) {
    var t = asciiDigits(size).toUpperCase().trim();
    var m = t.match(/(?:R|[-X])\s*(\d{2}(?:\.\d+)?)(?:\D|$)/);
    return m ? (parseFloat(m[1]) || 0) : 0;
  }
  function brandSizeCompare(a, b) {
    var wa = tyreWidthMm(a.size), wb = tyreWidthMm(b.size);
    if (wa !== wb) return wb - wa; // মোটা/চওড়া tyre আগে
    var ra = tyreRim(a.size), rb = tyreRim(b.size);
    if (ra !== rb) return rb - ra; // একই width হলে বড় rim আগে (8.25R20 আগে, 8.25R16 পরে)
    var ba = String(a.brand || '').trim(), bb = String(b.brand || '').trim();
    var bc = ba.localeCompare(bb, undefined, { sensitivity:'base', numeric:true });
    if (bc) return bc;
    return String(b.size || '').localeCompare(String(a.size || ''), undefined, { numeric:true, sensitivity:'base' });
  }
  function sortedList(q, lowOnly, sortBy) {
    var list = search(q || '').filter(function (p) { var limit = F.num(p.lowStock); return !lowOnly || (limit > 0 && F.num(p.qty) <= limit); });
    list = list.slice();
    list.sort(function (a, b) {
      if (sortBy === 'qty' || sortBy === 'qtyHigh') return (F.num(b.qty) - F.num(a.qty)) || brandSizeCompare(a, b);
      if (sortBy === 'qtyLow') return (F.num(a.qty) - F.num(b.qty)) || brandSizeCompare(a, b);
      if (sortBy === 'new') return (new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) || brandSizeCompare(a, b);
      if (sortBy === 'value') return ((F.num(b.qty) * F.num(b.buyPrice)) - (F.num(a.qty) * F.num(a.buyPrice))) || brandSizeCompare(a, b);
      return brandSizeCompare(a, b);
    });
    return list;
  }

  function renderDetailStock() {
    var body = document.querySelector('#detailStockTable tbody');
    if (!body) return;
    var all = products().filter(function (p) { return p && p.active !== false; });
    var en = window.Lang && Lang.isEn();
    var groups = {};
    all.forEach(function (p) {
      var type = productType(p);
      var unit = String(p.unit || 'পিস').trim() || 'পিস';
      if (!groups[type]) groups[type] = { count: 0, units: {} };
      groups[type].count++;
      groups[type].units[unit] = F.num(groups[type].units[unit]) + F.num(p.qty);
    });

    var known = TYPES.filter(function (t) { return groups[t]; });
    Object.keys(groups).forEach(function (t) { if (known.indexOf(t) < 0) known.push(t); });
    var unitEn = { 'পিস':'pcs', 'কেজি':'kg', 'ফুট':'ft', 'লিটার':'litre' };
    var typeEn = {
      'টায়ার':'Tyre', 'টিউব':'Tube', 'ব্যাটারি':'Battery', 'মোটর অয়েল':'Motor oil', 'মোটর পার্টস':'Motor parts',
      'রশি':'Rope', 'টায়ার জেল':'Tyre gel', 'পলিথিন':'Polythene', 'পলি ত্রিপল':'Poly tarpaulin', 'রিম':'Rim', 'অন্যান্য':'Other'
    };
    function unitLabel(u) { return en ? (unitEn[u] || u) : u; }
    function typeLabel(t) { return en ? (typeEn[t] || t) : t; }
    function totals(g) {
      var units = Object.keys(g.units);
      units.sort(function (a, b) {
        var ai = UNITS.indexOf(a), bi = UNITS.indexOf(b);
        if (ai < 0) ai = 999; if (bi < 0) bi = 999;
        return ai - bi || a.localeCompare(b);
      });
      return units.map(function (u) {
        return '<b>' + F.qty(g.units[u]) + '</b> ' + F.esc(unitLabel(u));
      }).join(' <span class="detail-stock-sep">·</span> ');
    }

    if (!known.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="3">' + (en ? 'No stock yet.' : 'এখনো কোনো স্টক নেই।') + '</td></tr>';
      return;
    }
    body.innerHTML = known.map(function (t) {
      var g = groups[t];
      return '<tr><td><b>' + F.esc(typeLabel(t)) + '</b></td>' +
        '<td class="num mono">' + F.bn(g.count) + '</td>' +
        '<td class="detail-stock-total">' + totals(g) + '</td></tr>';
    }).join('');
  }

  function L(t) { return (window.Lang && Lang.isEn && Lang.isEn() && Lang.translate) ? Lang.translate(t) : t; }

  function render() {
    var q = (document.getElementById('stockSearch').value || '').trim();
    var lowOnly = document.getElementById('stockLowOnly').checked;
    var sortBy = document.getElementById('stockSort').value;
    var list = sortedList(q, lowOnly, sortBy);
    var totalRows = list.length;
    var totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    if (stockPage > totalPages) stockPage = totalPages;
    if (stockPage < 1) stockPage = 1;
    var pageList = list.slice((stockPage - 1) * PAGE_SIZE, stockPage * PAGE_SIZE);

    var tb = document.querySelector('#stockTable tbody');
    tb.innerHTML = pageList.length ? pageList.map(function (p) {
      var lowLimit = F.num(p.lowStock);
      var low = lowLimit > 0 && F.num(p.qty) <= lowLimit;
      var qtyCls = F.num(p.qty) <= 0 ? 'color:var(--red);font-weight:700' : (low ? 'color:var(--amber);font-weight:700' : '');
      return '<tr>' +
        '<td class="st-name"><a href="#" class="cell-main stock-open" data-sd="' + F.esc(p.id) + '" style="color:inherit;text-decoration:none">' + F.esc(real(p.brand) || p.description || p.name || '—') + '</a><div class="cell-sub">' + F.esc(productType(p)) + '</div>' +
          ((real(p.brand) && productType(p) !== 'টায়ার' && p.description && p.description !== autoDesc(productType(p), p.brand, p.size, p.model)) ? '<div class="cell-sub">' + F.esc(p.description) + '</div>' : '') + '</td>' +
        '<td class="mono st-size" data-label="' + L('সাইজ') + '">' + F.esc(real(p.size) || '—') + '</td>' +
        '<td class="st-model" data-label="' + L('মডেল') + '">' + F.esc(p.model || '—') + '</td>' +
        '<td class="num st-qty" data-label="' + L('পরিমাণ') + '" style="' + qtyCls + '">' + F.qty(p.qty) + ((p.unit && p.unit !== 'পিস') ? ' <span class="tiny muted">' + F.esc(p.unit) + '</span>' : '') + (low ? '<div><span class="tag warn low-stock-tag">কম স্টক</span></div>' : '') + '</td>' +
        '<td class="num owner-only st-buy" data-label="' + L('ক্রয়মূল্য') + '">' + ((p.buyPricePending === true || F.num(p.buyPrice) <= 0) ? '—' : F.money(p.buyPrice)) + '</td>' +
        '<td class="num st-sell" data-label="' + L('বিক্রয়মূল্য') + '"><b>' + (F.num(p.sellPrice) > 0 ? F.money(p.sellPrice) : '<span class="pend">দর নিশ্চিত হয়নি</span>') + '</b></td>' +
        '<td class="num owner-only st-val" data-label="' + L('স্টকের মূল্য') + '">' + F.money(F.num(p.qty) * F.num(p.buyPrice)) + '</td>' +
        '<td class="st-act"><div class="st-btns"><button type="button" class="btn small ghost" data-se="' + F.esc(p.id) + '">বদলান</button>' +
        '<button type="button" class="btn small ghost" data-sa="' + F.esc(p.id) + '">＋ স্টক</button></div></td>' +
        '</tr>';
    }).join('') : UI.emptyRow(8, q ? 'কোনো পণ্য মেলেনি।' : 'স্টকে এখনো কোনো পণ্য নেই।');


    tb.querySelectorAll('[data-se]').forEach(function (b) {
      b.onclick = function () { var x = DB.productById(b.getAttribute('data-se')); if (x) form(x); };
    });
    tb.querySelectorAll('[data-sa]').forEach(function (b) {
      b.onclick = function () { addStockForm(b.getAttribute('data-sa')); };
    });
    tb.querySelectorAll('[data-sd]').forEach(function (a) {
      a.onclick = function (e) { e.preventDefault(); details(a.getAttribute('data-sd')); };
    });

    var pager = document.getElementById('stockPager');
    if (pager) {
      pager.hidden = totalPages <= 1;
      var en = window.Lang && Lang.isEn();
      pager.innerHTML = totalPages > 1 ?
        '<button class="btn small ghost pager-btn" data-pager-prev' + (stockPage <= 1 ? ' disabled' : '') + '>‹ ' + (en ? 'Previous' : 'আগের') + '</button>' +
        '<span class="pager-info">' + (en ? 'Page ' : 'পৃষ্ঠা ') + stockPage + ' / ' + totalPages + ' · ' + totalRows + (en ? ' items' : ' টি') + '</span>' +
        '<button class="btn small ghost pager-btn" data-pager-next' + (stockPage >= totalPages ? ' disabled' : '') + '>' + (en ? 'Next' : 'পরের') + ' ›</button>' : '';
      var prev = pager.querySelector('[data-pager-prev]'), next = pager.querySelector('[data-pager-next]');
      if (prev) prev.onclick = function () { if (stockPage > 1) { stockPage--; render(); } };
      if (next) next.onclick = function () { if (stockPage < totalPages) { stockPage++; render(); } };
    }

  }

  /* ================= ধরন অনুযায়ী আলাদা ফর্ম (v12.10) =================
     আগে ধরন বাছুন → তারপর শুধু সেই ধরনের দরকারি ঘরগুলো আসবে।
     ঘর = [লেবেল, বাধ্যতামূলক?(1/0), (ব্যবহার হয় না)] · null মানে ঘরটি দেখাবে না।
     units[0] হলো ডিফল্ট একক। descReq = পণ্যের নাম নিজে লিখতে হবে (না হলে ব্র্যান্ড+সাইজ থেকে নিজে তৈরি হয়)। */
  var NA = '—';
  var TYPE_CFG = {
    'টায়ার':      { units: ['পিস'], noDesc: true,
                    brand: ['ব্র্যান্ড', 1, ''], size: ['সাইজ', 1, ''], model: ['মডেল / প্যাটার্ন', 0, ''] },
    'টিউব':       { units: ['পিস'],
                    brand: ['ব্র্যান্ড', 0, ''], size: ['সাইজ', 1, ''], model: null },
    'ব্যাটারি':    { units: ['পিস'],
                    brand: ['ব্র্যান্ড', 1, ''], size: ['ক্ষমতা (ভোল্ট / Ah)', 1, ''], model: ['মডেল', 0, ''] },
    'মোটর অয়েল':  { units: ['পিস', 'লিটার'],
                    brand: ['ব্র্যান্ড', 1, ''], size: ['গ্রেড ও প্যাক সাইজ', 1, ''], model: ['কোন অয়েল', 0, ''] },
    'মোটর পার্টস': { units: ['পিস'], descReq: 'পার্টসের নাম',
                    brand: ['ব্র্যান্ড / কোম্পানি', 0, ''], size: ['গাড়ি / পার্ট নম্বর', 0, ''], model: null },
    'রশি':        { units: ['কেজি', 'ফুট', 'পিস'], descReq: 'রশির নাম',
                    brand: ['ব্র্যান্ড / কোম্পানি', 0, ''], size: ['মোটা / মাপ', 0, ''], model: null },
    'টায়ার জেল':  { units: ['পিস', 'কেজি', 'লিটার'],
                    brand: ['ব্র্যান্ড', 0, ''], size: ['প্যাক / ওজন', 0, ''], model: null },
    'পলিথিন':     { units: ['কেজি', 'পিস', 'ফুট'], descReq: 'পলিথিনের নাম / ধরন',
                    brand: ['ব্র্যান্ড / কোম্পানি', 0, ''], size: ['মাপ / মাইক্রন', 0, ''], model: null },
    'পলি ত্রিপল':  { units: ['পিস', 'ফুট'], descReq: 'ত্রিপলের নাম',
                    brand: ['ব্র্যান্ড / কোম্পানি', 0, ''], size: ['মাপ (ফুট × ফুট)', 0, ''], model: null },
    'রিম':        { units: ['পিস'],
                    brand: ['ব্র্যান্ড', 0, ''], size: ['সাইজ', 1, ''], model: ['মডেল / ধরন', 0, ''] },
    'অন্যান্য':    { units: UNITS.slice(), descReq: 'পণ্যের নাম / বিবরণ',
                    brand: ['ব্র্যান্ড', 0, ''], size: ['সাইজ / স্পেসিফিকেশন', 0, ''], model: ['মডেল', 0, ''] }
  };
  function cfgFor(type) { return TYPE_CFG[type] || TYPE_CFG['অন্যান্য']; }
  function real(v) { v = String(v == null ? '' : v).trim(); return (v && v !== NA) ? v : ''; }
  function autoDesc(type, brand, size, model) {
    var parts = [real(brand), real(size), real(model)].filter(Boolean);
    if (!parts.length) return '';
    var s = parts.join(' ');
    if (type && type !== 'টায়ার' && s.indexOf(type) < 0) s += ' ' + type;
    return s;
  }
  function productType(p) { return (p && String(p.type || '').trim()) || 'টায়ার'; }

  /* ধাপ ১: কী ধরনের পণ্য? */
  function typePicker(cb) {
    var body = '' +
      '<div class="type-grid">' + TYPES.map(function (t, i) {
        return '<button type="button" class="type-btn" data-tp="' + i + '"><span><b>' + F.esc(t) + '</b></span></button>';
      }).join('') + '</div>';
    UI.modal({
      title: 'নতুন পণ্য — কী ধরনের?',
      body: body,
      buttons: [{ label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal }],
      onOpen: function (root) {
        root.querySelectorAll('[data-tp]').forEach(function (b) {
          b.onclick = function () { var t = TYPES[parseInt(b.getAttribute('data-tp'), 10)]; UI.closeModal(); setTimeout(function () { cb(t); }, 40); };
        });
        var first = root.querySelector('[data-tp]'); if (first) first.focus();
      }
    });
  }

  /* ধাপ ২: ধরন অনুযায়ী ফর্ম (নতুন যোগ + বদলানো দুটোই) */
  function form(p, presetType, options) {
    options = options || {};
    var isNew = !p;
    if (isNew && !presetType) { typePicker(function (t) { form(null, t, options); }); return; }
    var startType = isNew ? presetType : productType(p);
    var startUnit = isNew ? '' : (p.unit || 'পিস');
    var typeOpts = TYPES.slice();
    if (typeOpts.indexOf(startType) < 0) typeOpts.push(startType);

    function lab(key, id, val, extra) {
      return '<label data-f="' + key + '"><span class="lbl"></span><input id="' + id + '"' + (extra || '') +
        (val ? ' value="' + F.esc(val) + '"' : '') + '></label>';
    }
    var curSell = isNew ? '' : (F.num(p.sellPrice) > 0 ? p.sellPrice : '');
    var curBuy = isNew ? '' : ((p.buyPricePending || F.num(p.buyPrice) <= 0) ? '' : p.buyPrice);

    var body = '' +
      '<div class="pf-typebar"><label><span class="lbl">ধরন</span><select id="pfType">' +
      typeOpts.map(function (t) { return '<option value="' + F.esc(t) + '"' + (t === startType ? ' selected' : '') + '>' + F.esc(t) + '</option>'; }).join('') +
      '</select></label></div>' +
      '<div class="grid2" id="pfIdent">' +
      lab('desc', 'pfDescription', isNew ? (options.description || '') : (p.description || p.name || '')) +
      lab('brand', 'pfBrand', isNew ? '' : real(p.brand), ' list="brandList" autocomplete="off"') +
      lab('size', 'pfSize', isNew ? '' : real(p.size)) +
      lab('model', 'pfModel', isNew ? '' : (p.model || '')) +
      '</div>' +
      '<datalist id="brandList"></datalist>' +
      '<div class="section-title" style="margin-top:12px">স্টক ও দাম</div>' +
      '<div class="grid2">' +
      '<label id="pfUnitLabel"><span class="lbl">একক</span><select id="pfUnit"></select></label>' +
      '<label><span class="lbl" id="pfQtyLbl">পরিমাণ *</span><input id="pfQty" type="number" min="0" required value="' + (isNew ? '1' : p.qty) + '"></label>' +
      '<label><span class="lbl" id="pfBuyLbl">ক্রয়মূল্য</span><input id="pfBuy" type="number" step="0.01" min="0" value="' + F.esc(curBuy) + '"></label>' +
      '<label><span class="lbl" id="pfSellLbl">বিক্রয়মূল্য</span><input id="pfSell" type="number" step="0.01" min="0" value="' + F.esc(curSell) + '"></label>' +
      '<label>সম্ভাব্য বিক্রয় মোট<input id="pfTotal" type="text" readonly value="0.00"></label>' +
      '<label>কম স্টকের সীমা<input id="pfLowStock" type="number" step="1" min="0" value="' + (isNew ? (F.num(DB.state.settings.lowStockLevel) || 2) : F.num(p.lowStock)) + '"></label>' +
      '</div>' +
      (isNew ? '<label class="check" style="margin-top:10px"><input type="checkbox" id="pfMore"> আরও পণ্য যোগ করব (একই ধরন)</label>' : '');

    UI.modal({
      title: isNew ? 'স্টকে নতুন ' + presetType + ' যোগ করুন' : 'পণ্যের তথ্য বদলান — ' + label(p),
      body: body,
      buttons: [
        { label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
        { label: isNew ? (options.onCreate ? 'স্টক ও বিলে যোগ করুন' : 'স্টকে যোগ করুন') : 'পরিবর্তন সেভ করুন', cls: 'primary', onClick: function () { save(p, isNew); } }
      ],
      onOpen: function (root) {
        var brands = {};
        products().forEach(function (x) { if (real(x.brand)) brands[x.brand] = 1; });
        root.querySelector('#brandList').innerHTML = Object.keys(brands).map(function (b) { return '<option value="' + F.esc(b) + '">'; }).join('');

        var typeEl = root.querySelector('#pfType'), uEl = root.querySelector('#pfUnit');
        var qEl = root.querySelector('#pfQty'), rEl = root.querySelector('#pfSell'), tEl = root.querySelector('#pfTotal');
        var ident = root.querySelector('#pfIdent');
        var unitTouched = false, firstRun = true;
        function fld(k) { return ident.querySelector('[data-f="' + k + '"]'); }
        function val(id) { return String((root.querySelector('#' + id) || {}).value || '').trim(); }

        function setField(key, def, order) {
          var el = fld(key); if (!el) return;
          if (!def) { el.hidden = true; return; }
          el.hidden = false; el.style.order = order;
          el.querySelector('.lbl').textContent = def[0] + (def[1] ? ' *' : '');
          el.querySelector('input').required = !!def[1];
        }
        function unitText() {
          var u = uEl.value || 'পিস';
          qEl.step = (u === 'পিস') ? '1' : '0.01';
          root.querySelector('#pfQtyLbl').textContent = 'পরিমাণ (' + u + ') *';
          root.querySelector('#pfBuyLbl').textContent = 'ক্রয়মূল্য — প্রতি ' + u;
          root.querySelector('#pfSellLbl').textContent = 'বিক্রয়মূল্য — প্রতি ' + u;
        }
        function applyCfg() {
          var t = typeEl.value, c = cfgFor(t);
          var manual = !!c.descReq;
          var descDef = manual ? [c.descReq, 1, ''] : (c.noDesc ? null : ['পণ্যের নাম / বিবরণ', 0, '']);
          setField('desc', descDef, manual ? 1 : 4);
          fld('desc').style.gridColumn = manual ? '1 / -1' : '';
          if (isNew) { var ti = document.getElementById('modalTitle'); if (ti) ti.textContent = 'স্টকে নতুন ' + t + ' যোগ করুন'; }
          setField('brand', c.brand, manual ? 2 : 1);
          setField('size', c.size, manual ? 3 : 2);
          setField('model', c.model, manual ? 4 : 3);
          /* একক: ধরন অনুযায়ী বিকল্প; বদলানোর সময় আগের একক হারায় না */
          var allowed = c.units.slice();
          var cur = uEl.value || startUnit;
          if (!isNew && startUnit && allowed.indexOf(startUnit) < 0) allowed.push(startUnit);
          uEl.innerHTML = allowed.map(function (u) { return '<option value="' + u + '">' + u + '</option>'; }).join('');
          if (isNew) uEl.value = (unitTouched && allowed.indexOf(cur) >= 0) ? cur : allowed[0];
          else uEl.value = (allowed.indexOf(cur) >= 0) ? cur : allowed[0];
          root.querySelector('#pfUnitLabel').hidden = allowed.length < 2;
          unitText();
          if (!firstRun) { var f = manual ? root.querySelector('#pfDescription') : root.querySelector('#pfBrand'); if (f) f.focus(); }
        }
        function calcTotal() { if (tEl) tEl.value = (F.num(qEl && qEl.value) * F.num(rEl && rEl.value)).toFixed(2); }

        typeEl.onchange = function () { applyCfg(); };
        uEl.onchange = function () { unitTouched = true; unitText(); };
        if (qEl) qEl.oninput = calcTotal;
        if (rEl) rEl.oninput = calcTotal;
        applyCfg(); firstRun = false; calcTotal();
        var c0 = cfgFor(typeEl.value);
        (c0.descReq ? root.querySelector('#pfDescription') : root.querySelector('#pfBrand')).focus();
      },
      onClose: null
    });

    function save(p, isNew) {
      var root = document.getElementById('modalBody');
      function v(id) { return String((root.querySelector('#' + id) || {}).value || '').trim(); }
      var type = v('pfType') || 'অন্যান্য';
      var cfg = cfgFor(type);
      var brand = v('pfBrand'), size = v('pfSize');
      var model = cfg.model ? v('pfModel') : (isNew ? '' : (p.model || ''));
      var description = v('pfDescription');
      if (cfg.descReq && !description) { UI.toast(cfg.descReq + ' লিখুন।', 'bad'); return; }
      if (cfg.brand && cfg.brand[1] && !brand) { UI.toast(cfg.brand[0] + ' লিখুন।', 'bad'); return; }
      if (cfg.size && cfg.size[1] && !size) { UI.toast(cfg.size[0] + ' লিখুন।', 'bad'); return; }
      if (!description) description = autoDesc(type, brand, size, model);
      if (!description) { UI.toast('পণ্যের নাম বা ব্র্যান্ড / সাইজ লিখুন।', 'bad'); return; }
      /* ইনভয়েসে ব্র্যান্ড ও সাইজ ফাঁকা রাখা যায় না — তাই না থাকলে “—” বসে */
      if (!brand) brand = NA;
      if (!size) size = NA;

      var sellRaw = v('pfSell'), buyRaw = v('pfBuy');
      var sell = sellRaw ? F.num(sellRaw) : 0;
      var buy = buyRaw ? F.num(buyRaw) : 0;
      var qty = F.num(v('pfQty'));
      var lowStock = Math.max(0, Math.floor(F.num(v('pfLowStock'))));
      if (isNew && qty <= 0) { UI.toast('পরিমাণ লিখুন (০-এর বেশি)।', 'bad'); return; }
      if (!isNew && qty < 0) { UI.toast('পরিমাণ ঠিক লিখুন।', 'bad'); return; }

      var pending = sell <= 0;
      var unit = v('pfUnit') || 'পিস';
      var data = {
        brand: brand, size: size, model: model,
        description: description,
        type: type,
        unit: unit,
        sellPrice: sell,
        pricePending: pending,
        buyPrice: buy,
        buyPricePending: !buyRaw,
        lowStock: lowStock
      };
      data.name = description;

      if (isNew) {
        var n = DB.nextNo('product');
        var np = Object.assign({
          id: DB.uid('p'), code: 'SKU-' + String(n).padStart(4, '0'), qty: 0, unit: 'পিস',
          lowStock: F.num(DB.state.settings.lowStockLevel) || 2,
          vehicleType: '', barcode: '', photo: '', note: '', description: '',
          active: true, createdAt: new Date().toISOString(), purchases: [], adjustments: []
        }, data);
        np.qty = qty;
        if (np.qty) np.purchases.push({ date: DB.todayStr(), qty: np.qty, buyPrice: np.buyPrice, buyPricePending: np.buyPricePending === true, supplier: '', note: '' });
        DB.state.products.push(np);
        if (!DB.save('product-create')) {
          DB.state.products = DB.state.products.filter(function (x) { return x.id !== np.id; });
          DB.state.counters.product = Math.max(0, F.num(DB.state.counters.product) - 1);
          UI.toast('পণ্য/কম স্টকের সীমা Local Drive-এ সেভ হয়নি। Data drive ঠিক করে আবার Save করুন।', 'bad', 9000);
          return;
        }
        var more = root.querySelector('#pfMore');
        var again = !!(more && more.checked);
        UI.closeModal();
        UI.toast(F.qty(qty) + ' ' + unit + ' ' + description + ' স্টকে যোগ হয়েছে', 'ok');
        if (options.onCreate) options.onCreate(np, qty);
        if (again) { render(); form(null, type, options); return; }
      } else {
        var beforeEdit = JSON.parse(JSON.stringify(p));
        var beforeSales = buy > 0 ? JSON.parse(JSON.stringify(DB.state.sales || [])) : null;
        var qtyDelta = qty - F.num(p.qty);
        Object.assign(p, data);
        if (qtyDelta) {
          p.qty = qty;
          p.adjustments = p.adjustments || [];
          p.adjustments.push({ date: DB.todayStr(), delta: qtyDelta, reason: 'নিজে বদলানো', note: '' });
        }
        if (buy > 0 && DB.backfillMissingProductCost) DB.backfillMissingProductCost(p.id, p.buyPrice);
        if (!DB.save('product-edit')) {
          Object.keys(p).forEach(function (k) { delete p[k]; });
          Object.assign(p, beforeEdit);
          if (beforeSales) DB.state.sales = beforeSales;
          UI.toast('কম স্টকের সীমাসহ পরিবর্তন Local Drive-এ সেভ হয়নি। Data drive ঠিক করে আবার Save করুন।', 'bad', 9000);
          return;
        }
        UI.closeModal();
      }
      render();
      if (App.currentView === 'dashboard') Dashboard.render();
    }
  }

  /* ---------------- দ্রুত স্টক যোগ: আগে ধরন (ঐচ্ছিক) → পণ্য বাছুন → পরিমাণ লিখুন ---------------- */
  function quickAddStock() {
    var typeFilter = '';
    var body = '' +
      '<div class="quick-stock-picker">' +
      '<label>পণ্য খুঁজুন<input id="qsSearch" type="text" autocomplete="off"></label>' +
      '<div class="type-chips" id="qsChips"></div>' +
      '<div class="quick-stock-list" id="qsList"></div>' +
      '<div class="quick-stock-foot"><button class="btn small ghost" id="qsNewTyre">＋ নতুন পণ্য</button></div>' +
      '</div>';

    UI.modal({
      title: '＋ স্টক যোগ',
      body: body,
      buttons: [],
      onOpen: function (root) {
        var input = root.querySelector('#qsSearch');
        var listBox = root.querySelector('#qsList');
        var chipBox = root.querySelector('#qsChips');
        var newBtn = root.querySelector('#qsNewTyre');

        function drawChips() {
          var counts = {}, order = [];
          products().forEach(function (p) {
            if (p.active === false) return;
            var t = productType(p);
            if (!(t in counts)) { counts[t] = 0; order.push(t); }
            counts[t]++;
          });
          order.sort(function (a, b) {
            var ia = TYPES.indexOf(a), ib = TYPES.indexOf(b);
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
          });
          if (order.length < 2) { chipBox.innerHTML = ''; chipBox.hidden = true; return; }
          chipBox.hidden = false;
          var all = products().filter(function (p) { return p.active !== false; }).length;
          chipBox.innerHTML = '<button type="button" class="type-chip' + (typeFilter ? '' : ' on') + '" data-tf="">সব <small>' + all + '</small></button>' +
            order.map(function (t) {
              return '<button type="button" class="type-chip' + (typeFilter === t ? ' on' : '') + '" data-tf="' + F.esc(t) + '">' + F.esc(t) + ' <small>' + counts[t] + '</small></button>';
            }).join('');
          chipBox.querySelectorAll('[data-tf]').forEach(function (b) {
            b.onclick = function () { typeFilter = b.getAttribute('data-tf'); drawChips(); draw(); input.focus(); };
          });
          newBtn.textContent = typeFilter ? '＋ নতুন ' + typeFilter : '＋ নতুন পণ্য';
        }
        function draw() {
          var q = input.value.trim();
          var list = search(q).filter(function (p) { return p.active !== false && (!typeFilter || productType(p) === typeFilter); }).slice(0, 12);
          listBox.innerHTML = list.length ? list.map(function (p) {
            return '<button class="quick-stock-row" data-qsp="' + p.id + '">' +
              '<span><b>' + F.esc(label(p)) + '</b><small>' + F.esc([productType(p), real(p.brand), real(p.size)].filter(Boolean).join(' · ')) + '</small></span>' +
              '<span class="quick-stock-meta"><b>' + F.qty(p.qty) + ' ' + F.esc(p.unit || 'পিস') + '</b><small>' + (F.num(p.sellPrice) > 0 ? F.money(p.sellPrice) : 'দর নেই') + '</small></span>' +
              '<span class="core-arrow">→</span></button>';
          }).join('') : '';
          listBox.querySelectorAll('[data-qsp]').forEach(function (b) {
            b.onclick = function () { var id = b.getAttribute('data-qsp'); UI.closeModal(); setTimeout(function () { addStockForm(id); }, 40); };
          });
        }
        input.oninput = UI.debounce(draw, 100);
        input.onkeydown = function (e) {
          if (e.key === 'Enter') {
            var first = listBox.querySelector('[data-qsp]');
            if (first) { e.preventDefault(); first.click(); }
          }
        };
        newBtn.onclick = function () { var t = typeFilter; UI.closeModal(); setTimeout(function () { form(null, t || undefined); }, 40); };
        drawChips(); draw(); input.focus();
      }
    });
  }

  /* ---------------- স্টক যোগ (ক্রয়): সাপ্লায়ার · কত পিস · কত টাকা ---------------- */
  function addStockForm(id) {
    var p = DB.productById(id);
    var u = p.unit || 'পিস';
    var body = '' +
      '<div class="inv-note" style="margin-bottom:10px">এখন স্টকে আছে: <b>' + F.qty(p.qty) + ' ' + F.esc(u) + '</b> · ' + F.esc(productType(p)) + '</div>' +
      '<div class="grid2">' +
      '<label>সাপ্লায়ার / কোথা থেকে<input id="asSupplier" type="text"></label>' +
      '<label>তারিখ<input id="asDate" type="date"></label>' +
      '<label>কত ' + u + ' নিলেন *<input id="asQty" type="number" step="' + (u === 'পিস' ? '1' : '0.01') + '" min="' + (u === 'পিস' ? '1' : '0.01') + '"></label>' +
      '<label>মোট কত টাকা দিলেন<input id="asTotal" type="number" step="0.01" min="0"></label>' +
      '<label>ক্রয়মূল্য — প্রতি ' + u + '<input id="asBuy" type="number" step="0.01" min="0"></label>' +
      '<label>বিক্রয়মূল্য — প্রতি ' + u + '<input id="asSell" type="number" step="0.01" min="0"></label>' +
      '</div>' +
      '<label>নোট<input id="asNote" type="text"></label>' +
      '<div class="inv-note" id="asSum" style="margin-top:8px"></div>';

    UI.modal({
      title: '＋ স্টক যোগ — ' + label(p),
      body: body,
      buttons: [
        { label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
        {
          label: 'স্টকে যোগ করুন', cls: 'primary', onClick: function () {
            var root = document.getElementById('modalBody');
            var qty = F.num(root.querySelector('#asQty').value);
            var buyRaw = String(root.querySelector('#asBuy').value || '').trim();
            var totalRaw = String(root.querySelector('#asTotal').value || '').trim();
            var buy = buyRaw ? F.num(buyRaw) : 0;
            var enteredTotal = totalRaw ? F.num(totalRaw) : 0;
            if (!buyRaw && enteredTotal > 0 && qty > 0) buy = DB.round2(enteredTotal / qty);
            var total = enteredTotal > 0 ? DB.round2(enteredTotal) : DB.round2(qty * buy);
            var hasBuy = buy > 0;
            var supplier = root.querySelector('#asSupplier').value.trim();
            var note = root.querySelector('#asNote').value.trim();
            if (qty <= 0) { UI.toast('কত ' + u + ' পেয়েছেন লিখুন।', 'bad'); return; }
            var oldQty = F.num(p.qty), oldBuy = F.num(p.buyPrice);
            var newQty = oldQty + qty;
            if (hasBuy) {
              if (oldQty > 0 && oldBuy > 0 && p.buyPricePending !== true) p.buyPrice = DB.round2(((oldQty * oldBuy) + (qty * buy)) / newQty);
              else p.buyPrice = DB.round2(buy);
              p.buyPricePending = false;
            } else if (!(F.num(p.buyPrice) > 0)) {
              p.buyPrice = 0;
              p.buyPricePending = true;
            }
            p.qty = newQty;
            var sell = F.num(root.querySelector('#asSell').value);
            if (sell > 0) { p.sellPrice = sell; p.pricePending = false; }
            if (F.num(p.buyPrice) > 0 && DB.backfillMissingProductCost) DB.backfillMissingProductCost(p.id, p.buyPrice);
            p.purchases = p.purchases || [];
            p.purchases.push({
              date: root.querySelector('#asDate').value || DB.todayStr(), qty: qty, buyPrice: buy, buyPricePending: !hasBuy,
              total: total, supplier: supplier, note: note
            });
            DB.save(); UI.closeModal();
            UI.toast(F.qty(qty) + ' ' + u + ' স্টকে যোগ' + (hasBuy ? ' · ' + F.money(total) : ' · ক্রয়মূল্য পরে দিতে পারবেন'), 'ok');
            render();
            if (App.currentView === 'dashboard') Dashboard.render();
          }
        }
      ],
      onOpen: function (root) {
        var qty = root.querySelector('#asQty');
        var total = root.querySelector('#asTotal');
        var buy = root.querySelector('#asBuy');
        var sum = root.querySelector('#asSum');
        var last = 'total';
        var r2 = function (n) { return Math.round((n + Number.EPSILON) * 100) / 100; };
        function show() {
          var q = F.num(qty.value), b = F.num(buy.value), t = F.num(total.value);
          if (q <= 0) {
            sum.innerHTML = '';
            return;
          }
          if (b <= 0) {
            sum.innerHTML = '<span class="muted"><b>' + F.qty(q) + ' ' + u + '</b> stock-এ যোগ হবে · ক্রয়মূল্য খালি থাকবে</span>';
            return;
          }
          var line = '<b>' + F.qty(q) + ' ' + u + ' × ' + F.money(b) + ' = ' + F.money(r2(q * b)) + '</b>';
          if (t > 0 && Math.abs(t - r2(q * b)) > 0.5) line += ' <span class="muted">(মোট লিখেছেন ' + F.money(t) + ')</span>';
          sum.innerHTML = line;
        }
        function fromTotal() {
          var q = F.num(qty.value), t = F.num(total.value);
          if (q > 0 && t > 0) buy.value = r2(t / q);
          show();
        }
        function fromBuy() {
          var q = F.num(qty.value), b = F.num(buy.value);
          if (q > 0 && b > 0) total.value = r2(q * b);
          show();
        }
        qty.oninput = function () { if (last === 'buy') fromBuy(); else fromTotal(); };
        total.oninput = function () { last = 'total'; fromTotal(); };
        buy.oninput = function () { last = 'buy'; fromBuy(); };
        sum.innerHTML = '';
      }
    });
  }

  /* ---------------- details modal ---------------- */
  function details(id) {
    var p = DB.productById(id);
    var allTime = DB.productStats(id);
    var month = DB.productStats(id, F.startOfMonth());
    var body = '' +
      '<div class="row" style="gap:14px;align-items:flex-start">' +
      '<div style="flex:1">' +
      '<div style="font-size:17px;font-weight:700">' + F.esc(label(p)) + '</div>' +
      '<div class="tiny muted">' + F.esc([p.type || 'টায়ার', p.brand || '', p.size || ''].filter(Boolean).join(' · ')) + '</div>' +
      '<div style="margin-top:8px" class="row wrap">' +
      '<span class="tag ' + (F.num(p.qty) <= 0 ? 'bad' : ((F.num(p.lowStock) > 0 && F.num(p.qty) <= F.num(p.lowStock)) ? 'warn' : 'ok')) + '">স্টকে: ' + F.qty(p.qty) + ' ' + F.esc(p.unit || 'পিস') + '</span>' +
      '<span class="tag">বিক্রয়: ' + (F.num(p.sellPrice) > 0 ? F.money(p.sellPrice) : 'দর নিশ্চিত হয়নি') + '</span>' +
      '<span class="tag owner-only">ক্রয়: ' + ((p.buyPricePending === true || F.num(p.buyPrice) <= 0) ? '—' : F.money(p.buyPrice)) + '</span>' +
      '</div>' +
      (p.note ? '<div class="tiny muted" style="margin-top:6px">নোট: ' + F.esc(p.note) + '</div>' : '') +
      '</div></div>' +
      '<div class="section-title">বিক্রি হয়েছে</div>' +
      '<table class="table compact"><tbody>' +
      '<tr><td>এই মাসে</td><td class="num">' + F.qty(month.qty) + ' ' + F.esc(p.unit || 'পিস') + ' · ' + F.money(month.revenue) + '</td></tr>' +
      '<tr><td>সব সময়</td><td class="num">' + F.qty(allTime.qty) + ' ' + F.esc(p.unit || 'পিস') + ' · ' + F.money(allTime.revenue) + '</td></tr>' +
      '</tbody></table>' +
      '<div class="section-title">কেনার হিসাব (স্টক যোগ)</div>' +
      '<table class="table compact"><thead><tr><th>তারিখ</th><th class="num">পরিমাণ</th><th class="num">প্রতি ' + F.esc(p.unit || 'পিস') + '</th><th class="num">মোট টাকা</th><th>সাপ্লায়ার</th></tr></thead><tbody>' +
      ((p.purchases || []).length ? p.purchases.slice().reverse().map(function (x) {
        var tot = F.num(x.total) || (F.num(x.qty) * F.num(x.buyPrice));
        return '<tr><td>' + F.d(x.date) + '</td><td class="num">' + F.qty(x.qty) + '</td><td class="num owner-only">' + F.money(x.buyPrice) + '</td><td class="num">' + F.money(tot) + '</td><td>' + (F.esc(x.supplier) || '—') + '</td></tr>';
      }).join('') : '') +
      ((p.purchases || []).length ? (function () {
        var tq = 0, tm = 0;
        p.purchases.forEach(function (x) { tq += F.num(x.qty); tm += (F.num(x.total) || (F.num(x.qty) * F.num(x.buyPrice))); });
        return '<tr class="totals"><td>মোট কেনা</td><td class="num">' + F.qty(tq) + '</td><td class="num"></td><td class="num">' + F.money(tm) + '</td><td></td></tr>';
      })() : '') +
      '</tbody></table>' +
      ((p.adjustments || []).length ? '<div class="section-title">স্টকের পরিবর্তন</div><table class="table compact"><tbody>' +
        p.adjustments.slice().reverse().map(function (a) {
          return '<tr><td>' + F.d(a.date) + '</td><td class="num">' + (a.delta > 0 ? '+' : '') + a.delta + '</td><td>' + F.esc(a.reason || '') + '</td></tr>';
        }).join('') + '</tbody></table>' : '');

    UI.modal({
      title: 'পণ্যের তথ্য', body: body, wide: true,
      buttons: [
        { label: 'মুছে ফেলুন', cls: 'ghost', onClick: function () { remove(p); } },
        { label: 'বদলান', cls: 'ghost', onClick: function () { UI.closeModal(); form(p); } },
        { label: '＋ স্টক যোগ', cls: 'primary', onClick: function () { UI.closeModal(); addStockForm(p.id); } }
      ]
    });
  }

  function remove(p) {
    UI.confirmDialog({
      title: 'পণ্যটি মুছে ফেলবেন?',
      message: '<b>' + F.esc(label(p)) + '</b> আপনার স্টক তালিকা থেকে মুছে যাবে। পুরনো ইনভয়েসে এর হিসাব থেকে যাবে, তাই আগের বিক্রির রেকর্ড ঠিক থাকবে।',
      danger: true, confirmText: 'হ্যাঁ, মুছে ফেলুন'
    }).then(function (ok) {
      if (!ok) return;
      DB.archiveDeleted('product', label(p), p, { date: DB.todayStr() });
      DB.state.products = DB.state.products.filter(function (x) { return x.id !== p.id; });
      DB.save(); UI.closeModal(); render();
    });
  }

  function fullStockPrintHtml() {
    // Print/PDF/share mirrors whatever the stock view is currently showing: same search text
    // and same "low stock only" toggle as on screen. So if the low-stock-only checkbox is on,
    // Print/PDF/Share will only include low-stock items too.
    // Buy Price is included in stock print/PDF/share. Stock Value (total cost) stays omitted.
    // No total row — just the plain product list.
    var sortEl = document.getElementById('stockSort');
    var sortBy = sortEl ? sortEl.value : 'brand';
    var searchEl = document.getElementById('stockSearch');
    var q = searchEl ? (searchEl.value || '').trim() : '';
    var lowOnlyEl = document.getElementById('stockLowOnly');
    var lowOnly = !!(lowOnlyEl && lowOnlyEl.checked);
    var list = sortedList(q, lowOnly, sortBy);
    var shop = (DB.state.settings && DB.state.settings.shopName) || 'Shoeb Motors & Tyre House';
    var listTitle = lowOnly ? 'Low Stock List' : 'Full Stock List';
    var rows = list.map(function (p, i) {
      return '<tr><td class="num">' + (i + 1) + '</td><td><b>' + F.esc(p.brand || '—') + '</b></td><td class="mono"><b>' + F.esc(p.size || '—') + '</b></td>' +
        '<td>' + F.esc(p.model || p.description || '—') + '</td><td class="num"><b>' + F.qty(p.qty) + '</b></td>' +
        '<td class="num">' + ((p.buyPricePending === true || F.num(p.buyPrice) <= 0) ? '—' : F.money(p.buyPrice)) + '</td>' +
        '<td class="num">' + F.money(p.sellPrice) + '</td></tr>';
    }).join('');
    return '<div class="stock-print">' +
      '<div class="stock-print-head"><img src="img/logo-print.jpg" alt=""><div><h1>' + F.esc(shop) + '</h1><h2>' + listTitle + '</h2></div></div>' +
      '<div class="stock-print-meta"><span>Stock Create Date: ' + F.esc(F.today()) + '</span><span>' + list.length + ' items</span></div>' +
      '<table><thead><tr><th>#</th><th>Brand</th><th>Size</th><th>Model / Description</th><th class="num">Qty</th><th class="num">Buy Price</th><th class="num">Sell Price</th></tr></thead><tbody>' +
      (rows || '') +
      '</tbody></table></div>';
  }

  function printFullStock() { UI.printHtml(fullStockPrintHtml(), 'a4'); }
  function stockPdfName() { return 'Stock-' + F.today(); }
  function downloadFullStockPdf() { return UI.downloadPdf(fullStockPrintHtml(), stockPdfName(), 'a4'); }
  function shareFullStockPdf() { return UI.sharePdf(fullStockPrintHtml(), stockPdfName(), 'a4', 'Stock update: ' + F.today()); }

  function openStockShare() {
    var lowOnlyEl = document.getElementById('stockLowOnly');
    var lowOnly = !!(lowOnlyEl && lowOnlyEl.checked);
    var printLabel = lowOnly ? '🖨 কম স্টক প্রিন্ট' : '🖨 পুরো স্টক প্রিন্ট';
    UI.modal({
      title: 'Stock Share',
      body: '',
      buttons: [
        { label: printLabel, cls: 'ghost', onClick: function () { UI.closeModal(); printFullStock(); } },
        { label: '⬇ PDF', cls: 'ghost', onClick: function () { UI.closeModal(); downloadFullStockPdf(); } },
        { label: '📤 WhatsApp / Share PDF', cls: 'ghost', onClick: function () { UI.closeModal(); shareFullStockPdf(); } },
        { label: 'CSV', cls: 'ghost', onClick: function () { UI.closeModal(); exportCsv(); } }
      ]
    });
  }

  /* ---------------- export ---------------- */
  function exportCsv() {
    var rows = [['কোড', 'ব্র্যান্ড', 'সাইজ', 'মডেল', 'গাড়ি', 'ধরন', 'বারকোড', 'পরিমাণ', 'ক্রয়মূল্য', 'বিক্রয়মূল্য', 'স্টকের মূল্য', 'কম স্টকের সীমা', 'নোট']];
    search('').forEach(function (p) {
      rows.push([p.code, p.brand, p.size, p.model, p.vehicleType, p.type, p.barcode, p.qty, p.buyPrice, p.sellPrice,
      (F.num(p.qty) * F.num(p.buyPrice)).toFixed(2), p.lowStock, p.note]);
    });
    F.download('shoeb-motors-stock-' + F.today() + '.csv', F.csv(rows), 'text/csv');
    UI.toast('স্টকের তালিকা CSV ফাইলে সেভ হয়েছে (Excel-এ খুলবে)।', 'ok');
  }

  function bind() {
    document.getElementById('stockSearch').oninput = UI.debounce(function () { stockPage = 1; render(); }, 180);
    document.getElementById('stockLowOnly').onchange = function () { stockPage = 1; render(); };
    document.getElementById('stockSort').onchange = function () { stockPage = 1; render(); };
    document.getElementById('addTyreBtn').onclick = function () { form(null); };
    var qTop = document.getElementById('quickAddStockTop'); if (qTop) qTop.onclick = quickAddStock;
    var qPage = document.getElementById('quickAddStockPage'); if (qPage) qPage.onclick = quickAddStock;
    var qDash = document.getElementById('dashQuickAddStock'); if (qDash) qDash.onclick = quickAddStock;
    var stockShareBtn = document.getElementById('stockShareBtn'); if (stockShareBtn) stockShareBtn.onclick = openStockShare;
    var detailStockBtn = document.getElementById('detailStockBtn'); if (detailStockBtn) detailStockBtn.onclick = function () { App.show('detailstock'); };
    var detailStockBackBtn = document.getElementById('detailStockBackBtn'); if (detailStockBackBtn) detailStockBackBtn.onclick = function () { App.show('stock'); };
  }

  /* ইংরেজি মোডের জন্য নতুন লেখাগুলোর অনুবাদ */
  if (window.Lang && Lang.dict) {
    var NEW_EN = {
      'নতুন পণ্য — কী ধরনের?': 'New item — what kind?',
      'কী যোগ করছেন? ধরন বাছলে শুধু সেই ধরনের দরকারি ঘরগুলো আসবে।': 'What are you adding? Pick a type and only the relevant fields will appear.',
      'স্টক ও দাম': 'Stock & price', 'একক': 'Unit', 'সব': 'All',
      'পিস': 'pcs', 'কেজি': 'kg', 'ফুট': 'ft', 'লিটার': 'litre',
      'টায়ার': 'Tyre', 'টিউব': 'Tube', 'ব্যাটারি': 'Battery', 'মোটর অয়েল': 'Motor oil', 'মোটর পার্টস': 'Motor parts',
      'রশি': 'Rope', 'টায়ার জেল': 'Tyre gel', 'পলিথিন': 'Polythene', 'পলি ত্রিপল': 'Poly tarpaulin', 'রিম': 'Rim', 'অন্যান্য': 'Other',
      'ব্র্যান্ড · সাইজ · মডেল': 'Brand · size · model', 'ব্র্যান্ড · সাইজ': 'Brand · size', 'ব্র্যান্ড · ভোল্ট / Ah': 'Brand · volt / Ah',
      'ব্র্যান্ড · গ্রেড · প্যাক': 'Brand · grade · pack', 'পার্টসের নাম · ব্র্যান্ড': 'Part name · brand', 'নাম · মোটা · কেজি / ফুট': 'Name · thickness · kg / ft',
      'ব্র্যান্ড · প্যাক': 'Brand · pack', 'নাম · মাপ · কেজি': 'Name · size · kg', 'নাম · মাপ': 'Name · size', 'নিজে নাম লিখুন': 'Type the name yourself',
      'ব্র্যান্ড': 'Brand', 'ব্র্যান্ড *': 'Brand *', 'ব্র্যান্ড / কোম্পানি': 'Brand / company', 'সাইজ': 'Size', 'সাইজ *': 'Size *',
      'মডেল': 'Model', 'মডেল / প্যাটার্ন': 'Model / pattern', 'মডেল / ধরন': 'Model / kind', 'কোন অয়েল': 'Oil kind',
      'ক্ষমতা (ভোল্ট / Ah) *': 'Capacity (volt / Ah) *', 'গ্রেড ও প্যাক সাইজ *': 'Grade & pack size *', 'গাড়ি / পার্ট নম্বর': 'Vehicle / part no.',
      'মোটা / মাপ': 'Thickness / size', 'প্যাক / ওজন': 'Pack / weight', 'মাপ / মাইক্রন': 'Size / micron', 'মাপ (ফুট × ফুট)': 'Size (ft × ft)',
      'সাইজ / স্পেসিফিকেশন': 'Size / specification',
      'পণ্যের নাম / বিবরণ': 'Item name / description', 'পার্টসের নাম *': 'Part name *', 'রশির নাম *': 'Rope name *', 'পলিথিনের নাম / ধরন *': 'Polythene name / kind *',
      'ত্রিপলের নাম *': 'Tarpaulin name *', 'পণ্যের নাম / বিবরণ *': 'Item name / description *',
      'না থাকলে খালি রাখুন': 'Leave empty if not applicable',
      'না লিখলে ব্র্যান্ড + সাইজ থেকে নিজে তৈরি হবে': 'If left empty, it is built from brand + size',
      'আরও পণ্য যোগ করব (একই ধরন)': 'Add more items (same type)',
      'কেজি / ফুট / লিটার দরে বিক্রি হলে এখান থেকে বেছে নিন': 'Choose here if sold by kg / ft / litre',
      'কোনো পণ্য পাওয়া যায়নি। নিচের “＋ নতুন” বোতামে চাপুন।': 'No item found. Use the “＋ New” button below.',
      '＋ নতুন পণ্য': '＋ New item'
    };
    Object.keys(NEW_EN).forEach(function (k) { if (!Lang.dict[k]) Lang.dict[k] = NEW_EN[k]; });   /* আগের অনুবাদ বদলায় না */
  }

  return { render: render, renderDetailStock: renderDetailStock, form: form, quickAddStock: quickAddStock, addStockForm: addStockForm, details: details, bind: bind, exportCsv: exportCsv, printFullStock: printFullStock, downloadFullStockPdf: downloadFullStockPdf, shareFullStockPdf: shareFullStockPdf, fullStockPrintHtml: fullStockPrintHtml, label: label, search: search, real: real, typePicker: typePicker, cfgFor: cfgFor, autoDesc: autoDesc, productType: productType, NA: NA, VEHICLES: VEHICLES, TYPES: TYPES, UNITS: UNITS };
})();
