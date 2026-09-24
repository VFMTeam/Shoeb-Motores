/* ================= ui.js — toasts, modals, invoice printing ================= */
var UI = (function () {
  var EN = function () { try { return DB.state.settings.lang === 'en'; } catch (e) { return false; } };
  var MAP = [
    ['বিক্রয় করা মাল ফেরত নেওয়া হয় না।', 'Sold items are not returnable.'],
    ['ধন্যবাদ, আবার আসবেন।', 'Thank you. Please visit again.'],
    ['মূল্য পরিশোধের রসিদ', 'Payment receipt'],
    ['অনুমোদিত স্বাক্ষর', 'Authorised signature'],
    ['গ্রহণকারীর স্বাক্ষর', 'Receiver signature'],
    ['এই রসিদে প্রাপ্ত টাকা', 'Amount received'],
    ['এই পেমেন্টের পর অবশিষ্ট', 'Balance after this payment'],
    ['ওয়াক-ইন কাস্টমার', 'Walk-in customer'],
    ['মোট পরিমাণ', 'Total items'],
    ['টাকা', 'Subtotal'],
    ['ছাড়', 'Discount'],
    ['মোট টাকা', 'Grand total'],
    ['কথায়:', 'In words:'],
    ['বিক্রয় চালান', 'Sale invoice'],
    ['ক্রেতার নাম', 'Customer name'],
    ['গাড়ির নম্বর:', 'Vehicle no.'],
    ['গাড়ির নম্বর', 'Vehicle no.'],
    ['রসিদ', 'Receipt'],
    ['নম্বর:', 'No.'],
    ['নম্বর', 'No.'],
    ['তারিখ:', 'Date:'],
    ['তারিখ', 'Date'],
    ['সময়', 'Time'],
    ['ক্রেতা:', 'Customer:'],
    ['মোবাইল:', 'Mobile:'],
    ['মোবাইল', 'Mobile'],
    ['ঠিকানা:', 'Address:'],
    ['ঠিকানা', 'Address'],
    ['ক্রম', 'SL'],
    ['বিবরণ', 'Description'],
    ['ব্র্যান্ড', 'Brand'],
    ['সাইজ', 'Size'],
    ['পরিমাণ', 'Qty'],
    ['দর (', 'Rate ('],
    ['টাকা (', 'Amount ('],
    [' পিস × ', ' pcs × '],
  ];
  function enHtml(h) {
    if (!EN()) return h;
    for (var i = 0; i < MAP.length; i++) h = h.split(MAP[i][0]).join(MAP[i][1]);
    return h;
  }


  /* ---------------- toast ---------------- */
  function toast(msg, kind, ms) {
    /* শুধু দরকারি বার্তা দেখানো হয় — “সেভ হয়েছে” জাতীয় নিশ্চিতকরণ আর দেখানো হয় না */
    if (kind === 'ok' || kind === undefined) return;
    var wrap = document.getElementById('toastWrap');
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = msg;
    wrap.appendChild(el);
    setTimeout(function () { el.style.transition = '.3s'; el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; }, (ms || 3200) - 300);
    setTimeout(function () { if (el.parentNode) wrap.removeChild(el); }, ms || 3200);
  }

  /* ---------------- modal ---------------- */
  var backdrop = document.getElementById('modalBackdrop');
  var box = document.getElementById('modalBox');
  var titleEl = document.getElementById('modalTitle');
  var bodyEl = document.getElementById('modalBody');
  var footEl = document.getElementById('modalFoot');
  var escHandler = null;
  var closeCb = null;

  function modal(opts) {
    opts = opts || {};
    closeCb = opts.onClose || null;
    titleEl.textContent = opts.title || '';
    box.className = 'modal' + (opts.wide ? ' wide' : '');
    bodyEl.innerHTML = '';
    if (typeof opts.body === 'string') bodyEl.innerHTML = opts.body;
    else if (opts.body) bodyEl.appendChild(opts.body);
    footEl.innerHTML = '';
    (opts.buttons || []).forEach(function (b) {
      var btn = document.createElement('button');
      btn.className = 'btn ' + (b.cls || '');
      btn.textContent = b.label;
      if (b.disabled) btn.disabled = true;
      btn.onclick = function () { if (b.onClick) b.onClick(btn); };
      footEl.appendChild(btn);
    });
    if (!opts.buttons || !opts.buttons.length) footEl.style.display = 'none';
    else footEl.style.display = 'flex';
    backdrop.hidden = false;
    if (opts.onOpen) setTimeout(function () { opts.onOpen(bodyEl); }, 20);
    escHandler = function (e) { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', escHandler);
    return { close: closeModal, body: bodyEl };
  }
  function closeModal() {
    backdrop.hidden = true;
    bodyEl.innerHTML = '';
    if (escHandler) document.removeEventListener('keydown', escHandler);
    if (closeCb) { var cb = closeCb; closeCb = null; cb(); }
  }
  document.getElementById('modalClose').onclick = closeModal;
  backdrop.addEventListener('mousedown', function (e) { if (e.target === backdrop) closeModal(); });

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      modal({
        title: opts.title || 'নিশ্চিত করুন',
        body: '<p style="font-size:14.5px;margin:4px 0">' + (opts.message || '') + '</p>' +
          (opts.extraHtml || ''),
        buttons: [
          { label: opts.cancelText || 'বাতিল', cls: 'ghost', onClick: function () { closeModal(); resolve(null); } },
          {
            label: opts.confirmText || 'ঠিক আছে', cls: opts.danger ? 'danger' : 'primary',
            onClick: function () {
              var data = null;
              if (opts.collect) { data = opts.collect(); if (data === false) return; }
              closeModal(); resolve(data === null ? true : data);
            }
          }
        ],
        onOpen: opts.onOpen
      });
    });
  }

  /* ---------------- small helpers ---------------- */
  function emptyRow() { return ''; }
  function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms || 220); }; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------------- INVOICE BUILDERS ---------------- */
  function shopHead() {
    var st = DB.state.settings;
    return {
      name: st.shopName || 'Shoeb Motors & Tyre House',
      nameBn: st.shopNameBn || '',
      tagline: st.tagline || '', address: st.address || '', phone: st.phone || '',
      footer: st.footerNote || '', thanks: st.thanksLine || '', currency: st.currency || '৳'
    };
  }

  function invoiceCustomerName(sale, cust) {
    var name = sale.customerNameBn || (cust && cust.nameBn) || sale.customerName || (cust && cust.name) || 'ওয়াক-ইন কাস্টমার';
    if (name === 'Walk-in customer' || name === 'ওয়াক-ইন') name = 'ওয়াক-ইন কাস্টমার';
    return name;
  }

  function priceCell(i) {
    return F.bn(F.moneyPlain(i.price));
  }
  function signBlock(sh) {
    /* সই করার জন্য উপরে ফাঁকা জায়গা, নিচে রেখা — A4-এ বড় করে */
    return '<div class="sign"><span class="sign-space"></span>' +
      '<span class="sign-line">Authorised signature</span></div>';
  }

  /* ---------- ইনভয়েস (A4 / A5) ----------
     বেশি তথ্য: ব্র্যান্ড · সাইজ · ধরন · পরিমাণ · দর · টাকা
     সব কলামে-কলামে সাজানো, খোপ ছাড়া — শুধু যেখানে দরকার সেখানে সরু রেখা। */
  function logoTag(cls, fallback) {
    var data = (DB.state.settings && DB.state.settings.logoImage) || '';
    return '<img class="' + cls + '" src="' + (data || fallback) + '" alt="">';
  }


  /* Invoice item details are immutable sale-time snapshots.
     Never rebuild invoice details from the current stock record. */
  function invoiceItemDetail(i, key) {
    return String((i && i[key]) || '').trim();
  }

  function invoiceReferenceLabel(sale) {
    /* দোকানের সব পণ্যই গাড়ির জন্য — তাই পণ্যের ধরন যা-ই হোক, এই ফিল্ডের লেবেল সবসময় "গাড়ির নম্বর"। */
    return 'গাড়ির নম্বর';
  }

  /* ইনভয়েসে "ছাড় দেখান" বন্ধ থাকলে: ছাপা/দেখানো ইনভয়েসে ছাড়ের কথা থাকে না — আইটেমের আসল দর ও আসল মোট (ছাড়ের আগের বিল) দেখায়।
     সফটওয়্যারের আসল রেকর্ড (ছাড়, চূড়ান্ত বিল, লাভ) একটুও বদলায় না — এটা শুধু ইনভয়েস আঁকার সময়ের একটি কপি। */
  function invoiceSaleView(sale) {
    if (!sale || sale.showDiscount !== false) return sale;
    if (F.num(sale.discount) <= 0.009) return sale;
    var v = Object.assign({}, sale);
    v.total = F.num(sale.subTotal);
    v.discount = 0;
    v.discountReason = '';
    return v;
  }

function invoiceA4Bn(sale) {
    sale = invoiceSaleView(sale);
    var sh = shopHead();
    var bn = F.bn, m = function (v) { return bn(F.moneyPlain(v)); };
    var cust = sale.customerId ? DB.customerById(sale.customerId) : null;
    var custName = invoiceCustomerName(sale, cust);
    var vehicle = sale.vehicleNo || (cust && cust.vehicles && cust.vehicles[0] ? cust.vehicles[0].number : '');
    var vehicleLabel = invoiceReferenceLabel(sale);
    var addr = sale.customerAddress || (cust && (cust.address || cust.addressBn)) || '';

    /* Invoice-visible stock details come only from the sale-time snapshot. */
    var rows = sale.items.map(function (i, idx) {
      var brand = invoiceItemDetail(i, 'brand');
      var size = invoiceItemDetail(i, 'size');
      var type = invoiceItemDetail(i, 'type');
      var model = invoiceItemDetail(i, 'model');
      var description = invoiceItemDetail(i, 'description') || String(i.name || '').trim();
      var pend = DB.itemPending(i);
      /* Small line contains stock values only — no generated labels such as “মডেল:”. */
      var subBits = [];
      if (type) subBits.push(type);
      if (model) subBits.push(model);
      var sub = subBits.length ? '<div class="item-sub">' + subBits.map(function (s) { return F.esc(s); }).join(' · ') + '</div>' : '';
      return '<tr>' +
        '<td class="c-sl">' + bn(idx + 1) + '</td>' +
        '<td class="c-nm"><div class="item-name">' + F.esc(description) + '</div>' + sub + '</td>' +
        '<td class="c-br">' + F.esc(brand || '—') + '</td>' +
        '<td class="c-sz">' + F.esc(size || '—') + '</td>' +
        '<td class="c-qt">' + bn(F.qty(i.qty)) + '</td>' +
        '<td class="c-dp">' + bn(F.moneyPlain(i.price)) + '</td>' +
        '<td class="c-tt">' + m(i.total) + '</td>' +
        '</tr>';
    }).join('');

    var dReason = (sale.discountReason || '').trim();
    var hasPendingPrice = DB.saleHasPending && DB.saleHasPending(sale);
    /* ইনভয়েসে ছাড় দেখানো/লুকানো — সেটিংস পরে বদলালেও এই ইনভয়েস তৈরির সময়কার অবস্থা অনুযায়ী চলবে। */
    var showDiscount = sale.showDiscount !== false;
    var sums = '';
    if (showDiscount) {
      sums += '<tr><td class="lab">টাকা</td><td class="amt">' + m(sale.subTotal) + '</td></tr>';
      sums += '<tr><td class="lab">ছাড়' + (dReason ? ' <span class="dreason">(' + F.esc(dReason) + ')</span>' : '') + '</td><td class="amt">' + (F.num(sale.discount) ? '- ' + m(sale.discount) : '—') + '</td></tr>';
    }
    sums += '<tr class="grand"><td class="lab">মোট টাকা</td><td class="amt">' + m(sale.total) + '</td></tr>';

    var totalQty = sale.items.reduce(function (a, i) { return a + F.num(i.qty); }, 0);
    var kv = function (k, v, cls) {
      return '<div class="kv ' + (cls || '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
    };

    return '' +
      '<div class="inv-wrap inv-a4">' +

      /* ---- মাথা: লোগো · দোকানের নাম · ইনভয়েস বাক্স ---- */
      '<div class="inv-head">' +
      '<div class="inv-head-left">' +
      logoTag('inv-logo', 'img/logo-print.jpg') +
      '<div class="inv-shop-box">' +
      '<div class="inv-shop">' + F.esc(sh.name) + '</div>' +
      (sh.nameBn ? '<div class="inv-shop-bn">' + F.esc(sh.nameBn) + '</div>' : '') +
      (sh.tagline ? '<div class="inv-sub inv-tag">' + F.esc(sh.tagline) + '</div>' : '') +
      '<div class="inv-sub inv-addr">' + (sh.address ? F.esc(sh.address) : '') + '</div>' +
      (sh.phone ? '<div class="inv-sub">মোবাইল: ' + bn(F.esc(sh.phone)) + '</div>' : '') +
      '</div></div>' +
      '<div class="inv-head-right">' +
      '<div class="inv-title inv-sale-title"><b>বিক্রয় চালান</b></div>' +
      '<table class="inv-meta-t"><tbody>' +
      '<tr><td class="k">নম্বর</td><td class="v nb">' + F.esc(sale.invoiceNo) + '</td></tr>' +
      '<tr><td class="k">তারিখ</td><td class="v">' + bn(F.d(sale.date)) + '</td></tr>' +
      '<tr><td class="k">সময়</td><td class="v">' + bn(F.time(sale.date)) + '</td></tr>' +
      '</tbody></table>' +
      '</div>' +
      '</div>' +

      /* ---- ক্রেতার তথ্য (লেবেল : মান — কোলন দিয়ে আলাদা করা) ---- */
      '<div class="inv-meta">' +
      '<table class="kv-t"><tbody>' +
      '<tr><td class="k">ক্রেতার নাম</td><td class="c">:</td><td class="v v-name">' + F.esc(custName) + '</td></tr>' +
      '<tr><td class="k">মোবাইল</td><td class="c">:</td><td class="v">' + (sale.customerPhone ? bn(F.esc(sale.customerPhone)) : '—') + '</td></tr>' +
      '</tbody></table>' +
      '<table class="kv-t"><tbody>' +
      '<tr><td class="k">' + F.esc(vehicleLabel) + '</td><td class="c">:</td><td class="v">' + (vehicle ? F.esc(vehicle) : '—') + '</td></tr>' +
      '<tr><td class="k">ঠিকানা</td><td class="c">:</td><td class="v">' + (addr ? F.esc(addr) : '—') + '</td></tr>' +
      '</tbody></table>' +
      '</div>' +

      /* ---- মালের তালিকা ---- */
      '<div class="inv-table-box">' +
      '<table class="inv-table">' +
      '<colgroup><col class="c-sl"><col class="c-nm"><col class="c-br"><col class="c-sz"><col class="c-qt"><col class="c-dp"><col class="c-tt"></colgroup>' +
      '<thead><tr>' +
      '<th class="c-sl">ক্রম</th><th class="c-nm">বিবরণ</th><th class="c-br">ব্র্যান্ড</th>' +
      '<th class="c-sz">সাইজ</th><th class="c-qt">পরিমাণ</th>' +
      '<th class="c-dp">দর (' + sh.currency + ')</th><th class="c-tt">টাকা (' + sh.currency + ')</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '</div>' +

      /* ---- টায়ারের সংখ্যা + টাকার হিসাব ---- */
      '<div class="inv-totals-box"><table class="inv-totals"><colgroup><col class="c-lab"><col class="c-amt"></colgroup><tbody><tr><td class="lab">মোট পরিমাণ</td><td class="amt txt">' + bn(F.qty(totalQty)) + '</td></tr>' + sums + '</tbody></table></div>' +

      /* ---- কথায় (টাকার অঙ্ক) ---- */
      '<div class="inv-bottom">' +
      (F.num(sale.total) > 0.009 ? '<div class="words"><b>কথায়:</b> ' + F.wordsMoneyBn(sale.total) + '</div>' : '<div class="words"></div>') +
      '</div>' +

      '<div class="inv-note foot-note">বিক্রয় করা মাল ফেরত নেওয়া হয় না।</div>' +
      signBlock(sh) +
      '<div class="inv-thanks">ধন্যবাদ, আবার আসবেন।</div>' +
      '</div>';
  }
  function invoiceA4(sale) { return invoiceA4Bn(sale); }
  function invoiceCompactSheet(sale) {
    return '<div class="invoice-compact-flow">' + invoiceA4(sale) + '</div>';
  }
  /* ---------- 80mm থার্মাল ইনভয়েস ---------- */
  function invoiceThermalBn(sale) {
    sale = invoiceSaleView(sale);
    var sh = shopHead();
    var bn = F.bn, m = function (v) { return bn(F.moneyPlain(v)); };
    var cust = sale.customerId ? DB.customerById(sale.customerId) : null;
    var custName = invoiceCustomerName(sale, cust);
    var vehicle = sale.vehicleNo || (cust && cust.vehicles && cust.vehicles[0] ? cust.vehicles[0].number : '');
    var vehicleLabel = invoiceReferenceLabel(sale);
    var addr = sale.customerAddress || (cust && (cust.address || cust.addressBn)) || '';
    var rows = sale.items.map(function (i, idx) {
      var brand = invoiceItemDetail(i, 'brand');
      var size = invoiceItemDetail(i, 'size');
      var type = invoiceItemDetail(i, 'type');
      var model = invoiceItemDetail(i, 'model');
      var description = invoiceItemDetail(i, 'description') || String(i.name || '').trim();
      var bits = [brand, size, type, model].filter(Boolean).join(' · ');
      return '<tr><td colspan="2">' + bn(idx + 1) + '. ' + F.esc(description) + (bits ? '<br><span class="thermal-item-sub">' + F.esc(bits) + '</span>' : '') + '</td></tr>' +
        '<tr><td style="text-align:left">' + bn(F.qty(i.qty)) + ' পিস × ' + m(i.price) + '</td><td class="num">' + m(i.total) + '</td></tr>';
    }).join('');
    var totalQty = sale.items.reduce(function (a, i) { return a + F.num(i.qty); }, 0);
    var showDiscountT = sale.showDiscount !== false;
    var sums = '';
    var dReasonT = (sale.discountReason || '').trim();
    if (showDiscountT) {
      sums += '<tr><td>টাকা</td><td class="num">' + m(sale.subTotal) + '</td></tr>';
      sums += '<tr><td>ছাড়' + (dReasonT ? ' (' + F.esc(dReasonT) + ')' : '') + '</td><td class="num">' + (F.num(sale.discount) ? '-' + m(sale.discount) : '—') + '</td></tr>';
    }
    sums += '<tr class="thermal-tot"><td>মোট টাকা</td><td class="num">' + m(sale.total) + '</td></tr>';
    return '' +
      '<div class="thermal-wrap">' +
      '<div class="thermal-head">' + logoTag('thermal-logo', 'img/logo-thermal.jpg') +
      '<div class="t-shop">' + F.esc(sh.name) + '</div>' +
      (sh.nameBn ? '<div>' + F.esc(sh.nameBn) + '</div>' : '') +
      (sh.address ? '<div>' + F.esc(sh.address) + '</div>' : '') +
      (sh.phone ? '<div>মোবাইল: ' + bn(F.esc(sh.phone)) + '</div>' : '') + '</div>' +
      '<div class="thermal-line"></div>' +
      '<div style="text-align:center;font-weight:800">বিক্রয় চালান</div>' +
      '<div>নম্বর: ' + F.esc(sale.invoiceNo) + '</div>' +
      '<div>তারিখ: ' + bn(F.d(sale.date)) + ' ' + bn(F.time(sale.date)) + '</div>' +
      '<div>ক্রেতা: ' + F.esc(custName) + '</div>' +
      (sale.customerPhone ? '<div>মোবাইল: ' + bn(F.esc(sale.customerPhone)) + '</div>' : '') +
      (vehicle ? '<div>' + F.esc(vehicleLabel) + ': ' + F.esc(vehicle) + '</div>' : '') +
      (addr ? '<div>ঠিকানা: ' + F.esc(addr) + '</div>' : '') +
      '<div class="thermal-line"></div>' +
      '<table class="thermal-table">' + rows + '</table>' +
      '<div class="thermal-line"></div>' +
      '<table class="thermal-table thermal-summary"><tr><td>মোট পরিমাণ</td><td class="num">' + bn(F.qty(totalQty)) + '</td></tr></table>' +
      '<table class="thermal-table">' + sums + '</table>' +
      '<div class="thermal-line"></div>' +
      '<div style="font-size:10px;text-align:center;margin-top:6px">বিক্রয় করা মাল ফেরত নেওয়া হয় না।</div>' +
      '<div style="text-align:center;margin-top:5px">ধন্যবাদ, আবার আসবেন।</div>' +
      '</div>';
  }
  function invoiceThermal(sale) { return invoiceThermalBn(sale); }

  /* ---------- মূল্য পরিশোধের রসিদ ---------- */
  function collectionReceiptA4Bn(rec) {
    rec = DB.collectionReceipt(rec);
    var sale = DB.saleById(rec.saleId);
    var sh = shopHead();
    var bn = F.bn, m = function (v) { return bn(F.moneyPlain(v)); };
    var name = rec.customerName || (sale && (sale.customerNameBn || sale.customerName)) || 'ওয়াক-ইন কাস্টমার';
    var customer = (rec.openingBalance || rec.paymentGroup) ? DB.customerById(rec.customerId) : null;
    var phone = rec.customerPhone || (sale ? (sale.customerPhone || '') : (customer ? customer.phone || '' : ''));
    var remaining = rec.paymentGroup ? rec.balanceAfter : rec.openingBalance ? DB.openingDue(rec.customerId) : (sale && !DB.saleHasPending(sale) ? Math.max(0, F.num(sale.due)) : null);
    return '<div class="inv-wrap inv-a4 receipt-a4">' +
      '<div class="inv-head">' +
        '<div class="inv-head-left">' + logoTag('inv-logo','img/logo-print.jpg') +
          '<div class="inv-shop-box"><div class="inv-shop">' + F.esc(sh.name || 'Shoeb Motors & Tyre House') + '</div>' +
          '<div class="inv-shop-bn">' + F.esc(sh.nameBn || 'সোয়েব মটরস এন্ড টায়ার হাউস') + '</div>' +
          '<div class="inv-sub inv-tag">' + F.esc(sh.tagline || '') + '</div>' +
          '<div class="inv-sub inv-addr">' + F.esc(sh.address || '') + '</div>' +
          '<div class="inv-sub">মোবাইল: ' + bn(F.esc(sh.phone || '')) + '</div></div>' +
        '</div>' +
        '<div class="inv-head-right"><div class="inv-title"><b>মূল্য পরিশোধের রসিদ</b></div>' +
          '<table class="inv-meta-t"><tbody>' +
          '<tr><td class="k">রসিদ</td><td class="v nb">' + F.esc(rec.no || '') + '</td></tr>' +
          '<tr><td class="k">তারিখ</td><td class="v">' + bn(F.d(rec.date || rec.createdAt)) + '</td></tr>' +
          '<tr><td class="k">সময়</td><td class="v">' + bn(F.time(rec.createdAt || rec.date)) + '</td></tr>' +
          '</tbody></table></div>' +
      '</div>' +
      '<div class="receipt-body">' +
        '<div class="receipt-row"><span>ক্রেতার নাম</span><b>' + F.esc(name) + '</b></div>' +
        (phone ? '<div class="receipt-row"><span>মোবাইল</span><b>' + bn(F.esc(phone)) + '</b></div>' : '') +
        '<div class="receipt-row"><span>বিক্রয় চালান</span><b>' + F.esc(rec.invoiceNo || (sale && sale.invoiceNo) || '') + '</b></div>' +
        (rec.paymentParts ? '<table class="table"><tbody>' + rec.paymentParts.map(function (p) { return '<tr><td>' + F.esc(p.invoiceNo || 'বকেয়া') + '</td><td class="num">৳ ' + m(p.amount) + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
        '<div class="receipt-paid"><span>এই রসিদে প্রাপ্ত টাকা</span><strong>৳ ' + m(rec.amount) + '</strong></div>' +
        (rec.pendingPrice ? '<div class="receipt-hint">দর অপেক্ষমাণ ইনভয়েস নিচের অবশিষ্ট হিসাবের বাইরে।</div>' : '') +
        (remaining === null ? '<div class="receipt-hint">চালানের কিছু মালের দাম এখনও দেওয়া হয়নি; পরে দাম বসালে অবশিষ্ট হিসাব আপডেট হবে।</div>' :
          '<div class="receipt-row receipt-balance"><span>এই পেমেন্টের পর অবশিষ্ট</span><b>৳ ' + m(remaining) + '</b></div>') +
      '</div>' +
      '<div class="receipt-sign"><span>গ্রহণকারীর স্বাক্ষর</span></div>' +
      '<div class="inv-thanks">ধন্যবাদ, আবার আসবেন।</div>' +
      '</div>';
  }
  function collectionReceiptA4(rec) { return enHtml(collectionReceiptA4Bn(rec)); }
  function collectionReceiptPaper(rec) {
    return '<div class="invoice-page invoice-page-a4 invoice-sheet-a4"><div class="invoice-page-content"><div class="receipt-compact-flow">' + collectionReceiptA4(rec) + '</div></div></div>';
  }
  function printCollectionReceipt(rec) { printHtml(collectionReceiptPaper(rec), 'a4'); }
  function openCollectionReceipt(rec) {
    modal({
      title: EN() ? 'Payment receipt' : 'মূল্য পরিশোধের রসিদ', wide: true,
      body: '<div class="invoice-preview receipt-preview" id="receiptPreview">' + collectionReceiptPaper(rec) + '</div>',
      buttons: [
        { label: 'রসিদ প্রিন্ট / PDF', cls: 'primary', onClick: function () { printCollectionReceipt(rec); } }
      ],
      onOpen: function (root) { fitPreview(root.querySelector('#receiptPreview'), 'a4'); }
    });
  }

  function setPrintLayout(layout) {
    var css = layout === '80'
      ? '@page{size:80mm auto;margin:2mm}'
      : layout === 'a5'
        ? '@page{size:A5 portrait;margin:4mm}'
        : '@page{size:A4 portrait;margin:4mm}';
    var el = document.getElementById('printPageStyle');
    if (!el) { el = document.createElement('style'); el.id = 'printPageStyle'; document.head.appendChild(el); }
    el.textContent = css;
    document.body.classList.remove('print-80', 'print-a4', 'print-a5');
    document.body.classList.add(layout === '80' ? 'print-80' : (layout === 'a5' ? 'print-a5' : 'print-a4'));
  }
  function pdfFileName(name) {
    var out = String(name || 'Shoeb-Motors').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-');
    out = out.replace(/^[-.]+|[-.]+$/g, '');
    if (!/\.pdf$/i.test(out)) out += '.pdf';
    return out || 'Shoeb-Motors.pdf';
  }

  async function createPdfBlob(html, filename, layout) {
    var name = pdfFileName(filename);
    var lay = (layout === 'a5' || layout === '80') ? layout : 'a4';
    var r = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: String(html || ''), filename: name, layout: lay })
    });
    if (!r.ok) {
      var msg = ''; try { var j = await r.json(); msg = j && j.error || ''; } catch (_) {}
      throw new Error(msg || ('PDF service error ' + r.status));
    }
    var blob = await r.blob();
    if (!blob || blob.size < 500) throw new Error('PDF file is empty');
    return { blob: blob, filename: name, layout: lay };
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) {} try { a.remove(); } catch (_) {} }, 1200);
  }

  async function downloadPdf(html, filename, layout) {
    var lay = (layout === 'a5' || layout === '80') ? layout : 'a4';
    try {
      var made = await createPdfBlob(html, filename, lay);
      downloadBlob(made.blob, made.filename);
      return { ok: true, size: made.blob.size, filename: made.filename };
    } catch (e) {
      toast((EN() ? 'Direct PDF download is unavailable. Print dialog opened - choose Save as PDF.' : 'সরাসরি PDF ডাউনলোড করা গেল না। Print dialog খুলেছে — Save as PDF বেছে নিন।'), 'warn', 5200);
      printHtml(html, lay);
      return { ok: false, fallback: true, error: String(e && e.message || e) };
    }
  }

  async function sharePdf(html, filename, layout, shareText) {
    var lay = (layout === 'a5' || layout === '80') ? layout : 'a4';
    try {
      var made = await createPdfBlob(html, filename, lay);
      var file = null;
      try { file = new File([made.blob], made.filename, { type: 'application/pdf' }); } catch (_) {}
      if (file && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: made.filename.replace(/\.pdf$/i, ''),
          text: String(shareText || ''),
          files: [file]
        });
        return { ok: true, shared: true, filename: made.filename };
      }
      downloadBlob(made.blob, made.filename);
      toast((EN() ? 'PDF downloaded. Attach it in WhatsApp to share.' : 'PDF ডাউনলোড হয়েছে। WhatsApp-এ এই PDF ফাইলটি attach করে শেয়ার করুন।'), 'ok', 5200);
      return { ok: true, downloaded: true, filename: made.filename };
    } catch (e) {
      if (e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')))) return { ok: false, cancelled: true };
      toast((EN() ? 'PDF sharing is unavailable on this device/browser.' : 'এই ডিভাইস/ব্রাউজারে PDF শেয়ার করা যাচ্ছে না।'), 'warn', 5200);
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  function printHtml(html, layout) {
    var root = document.getElementById('printRoot');
    var oldTitle = document.title;
    root.innerHTML = html;
    setPrintLayout(layout);
    var done = function () {
      document.title = oldTitle;
      document.body.classList.remove('print-80', 'print-a4', 'print-a5');
      root.innerHTML = '';
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(function () { document.title = ''; window.print(); }, 120);
    setTimeout(done, 1500);
  }
  /* A4/A5 preview and print use the exact same paper wrapper.
     Only the screen preview is visually zoomed; invoice geometry never changes. */
  function invoicePaper(sale, layout) {
    layout = layout === 'a5' ? 'a5' : 'a4';
    if (layout === 'a4') {
      return '<div class="invoice-page invoice-page-a4 invoice-sheet-a4"><div class="invoice-page-content">' + invoiceCompactSheet(sale) + '</div></div>';
    }
    return '<div class="invoice-page invoice-page-' + layout + '"><div class="invoice-page-content">' + invoiceA4(sale) + '</div></div>';
  }
  function printInvoice(sale, layout) {
    printHtml(layout === '80' ? invoiceThermal(sale) : invoicePaper(sale, layout), layout);
  }
  function downloadInvoicePdf(sale, layout) {
    if (!sale) return Promise.resolve({ok:false});
    var lay = layout === 'a5' ? 'a5' : 'a4';
    return downloadPdf(invoicePaper(sale, lay), 'Invoice-' + (sale.invoiceNo || sale.id || F.today()), lay);
  }
  function fitPreview(box, layout) {
    if (!box) return;
    if (layout === '80') { box.style.height = ''; return; }

    /* New invoice previews: zoom the whole physical paper (210mm A4 / 148mm A5),
       not the invoice content itself. This keeps preview and printed positions equal. */
    var page = box.querySelector('.invoice-page');
    if (page) {
      var mmPx = 96 / 25.4;
      var paperPx = (layout === 'a5' ? 148 : 210) * mmPx;
      var apply = function () {
        page.style.zoom = '';
        var available = Math.max(260, (box.clientWidth || 900) - 36);
        var scale = Math.min(0.82, available / paperPx);
        page.style.zoom = String(Math.max(0.42, scale));
        box.style.height = '';
      };
      apply();
      setTimeout(apply, 120);
      return;
    }

    /* Older receipt preview keeps its previous behaviour. */
    var wrap = box.querySelector('.inv-wrap');
    if (!wrap) { box.style.height = ''; return; }
    var scale = 0.8;
    wrap.style.transformOrigin = 'top left';
    wrap.style.transform = 'scale(' + scale + ')';
    wrap.style.width = (100 / scale) + '%';
    /* The 125% width above is only a scale-compensation trick so the
       zoomed-out receipt still measures full width — it is not real
       extra content. Without clipping it, the box shows a draggable
       horizontal scrollbar even though nothing is actually cut off. */
    box.style.overflowX = 'hidden';
    var fit = function () {
      var visual = Math.round(wrap.scrollHeight * scale);
      wrap.style.height = visual + 'px';
      wrap.style.overflow = 'hidden';
      var cap = Math.round(window.innerHeight * 0.72);
      box.style.height = Math.min(visual + 8, cap) + 'px';
    };
    fit();
    setTimeout(fit, 350);
  }

  function invoicePreview(sale, layout) {
    return layout === '80' ? '<div style="overflow:auto">' + invoiceThermal(sale) + '</div>' : '<div class="invoice-preview">' + invoicePaper(sale, layout) + '</div>';
  }

  /* ---------------- invoice actions (used by several screens) ---------------- */

  /* ইনভয়েস সবসময় A4 — তবে চাইলে A5 */
  /* ইনভয়েসটি আলাদা ফ্লোটিং জানালায় খোলে — ✕ দিয়ে বন্ধ, 🖨 দিয়ে প্রিন্ট */
  function invoiceWin(sale, layout) {
    layout = (layout === 'a5') ? 'a5' : 'a4';
    var a5 = layout === 'a5';
    var base = location.href.replace(/[^\/]*$/, '');
    var head = '<!DOCTYPE html><html lang="' + (EN() ? 'en' : 'bn') + '"><head><meta charset="utf-8">' +
      '<base href="' + base + '"><title>' + (EN() ? 'Sale invoice ' : 'বিক্রয় ইনভয়েস ') + F.esc(sale.invoiceNo) + '</title>' +
      '<link rel="stylesheet" href="css/style.css">' +
      '<style>' +
      'html,body{margin:0;background:#e9ecef}' +
      'body{padding:12px 12px 40px}' +
      '.win-bar{position:sticky;top:0;z-index:9;display:flex;align-items:center;gap:8px;' +
      'background:var(--ink,#11181f);color:#fff;border-radius:11px;padding:8px 12px;' +
      'margin:0 auto 12px;max-width:190mm;font-family:"Shoeb Bangla","Nirmala UI","Noto Sans Bengali",sans-serif}' +
      '.win-bar b{font-size:14.5px}' +
      '.win-bar .sp{flex:1}' +
      '.win-bar button{font-family:inherit;border:none;border-radius:9px;padding:8px 14px;' +
      'font-size:14px;font-weight:700;cursor:pointer}' +
      '.win-bar .pr{background:#000;color:#fff}' +
      '.win-bar .cl{background:rgba(255,255,255,.15);color:#fff}' +
      '.invoice-page{box-shadow:0 6px 24px rgba(16,32,55,.18)}' +
      '@page{size:' + (a5 ? 'A5 portrait;margin:4mm' : 'A4 portrait;margin:4mm') + '}' +
      '@media print{' +
      'html,body{margin:0 !important;padding:0 !important;background:#fff !important}' +
      'body > *{display:block !important}' +
      '.win-bar{display:none !important}' +
      '.invoice-page{box-shadow:none !important;margin:0 auto !important}' +
      '}' +
      '</style></head><body class="print-' + layout + '">';
    var bar = '<div class="win-bar"><b>' + (EN() ? 'Sale invoice ' : 'বিক্রয় ইনভয়েস ') + ' — ' + F.esc(sale.invoiceNo) + '</b><span class="sp"></span>' +
      '<button class="pr" id="winPrint">🖨 ' + (EN() ? 'Print' : 'প্রিন্ট') + '</button>' +
      '<button class="pr" id="winPdf">⬇ PDF</button>' +
      '<button class="cl" id="winClose">✕ ' + (EN() ? 'Close' : 'বন্ধ করুন') + '</button></div>';
    var tail = '</body></html>';
    var w = null;
    try { w = window.open('', '_blank'); } catch (e) { w = null; }
    if (!w || !w.document) return false;
    try {
      w.document.open();
      w.document.write(head + bar + invoicePaper(sale, layout) + tail);
      w.document.close();
      /* বোতামের কাজ অ্যাপ থেকে লাগিয়ে দেওয়া হয় — জানালার ভেতরে script রাখতে হয় না */
      var pb = w.document.getElementById('winPrint');
      var pdfb = w.document.getElementById('winPdf');
      var cb = w.document.getElementById('winClose');
      if (pdfb) pdfb.onclick = function () { try { downloadInvoicePdf(sale, layout); } catch (e) {} };
      if (pb) pb.onclick = function () {
        try {
          var oldTitle = w.document.title;
          var restoreTitle = function () { try { w.document.title = oldTitle; w.removeEventListener('afterprint', restoreTitle); } catch (e) { } };
          w.addEventListener('afterprint', restoreTitle);
          w.document.title = '';
          w.focus();
          w.print();
          setTimeout(restoreTitle, 1200);
        } catch (e) { }
      };
      if (cb) cb.onclick = function () { try { w.close(); } catch (e) { } };
    } catch (e) { return false; }
    try { w.focus(); } catch (e) { }
    return true;
  }

  /* নতুন জানালা না খুললে অ্যাপের ভেতরেই ইনভয়েস দেখানো হয় */
  function openInvoiceModal(sale, layout) {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="row wrap" style="margin-bottom:10px">' +
      '<button class="btn small" id="btnPrintNow">🖨 প্রিন্ট</button>' +
      '<button class="btn small primary" id="btnPdfNow">⬇ PDF</button>' +
      '<button class="btn small ghost" id="btnWinAgain">নতুন জানালায় খুলুন</button>' +
      (DB.saleHasPending(sale) ? '<button class="btn small ghost" id="btnSetPrice">' + (EN() ? 'Set price (unconfirmed)' : 'দর বসান (নিশ্চিত হয়নি)') + '</button>' : '') +
      '</div><div id="invPreviewBox"></div>';
    modal({
      title: (EN() ? 'Invoice ' : 'ইনভয়েস ') + sale.invoiceNo, body: wrap, wide: true,
      buttons: [],
      onOpen: function () {
        var bx = document.getElementById('invPreviewBox');
        bx.innerHTML = invoicePreview(sale, layout || 'a4');
        fitPreview(bx, layout || 'a4');
      }
    });
    document.getElementById('btnPrintNow').onclick = function () { printInvoice(sale, layout || 'a4'); };
    document.getElementById('btnPdfNow').onclick = function () { downloadInvoicePdf(sale, layout || 'a4'); };
    document.getElementById('btnWinAgain').onclick = function () {
      if (invoiceWin(sale, layout)) closeModal();
      else toast('ব্রাউজারে নতুন জানালা বন্ধ আছে — উপরের ✕ চিহ্নে চাপ দিয়ে অনুমতি দিন।', 'warn', 4200);
    };
    if (document.getElementById('btnSetPrice')) {
      document.getElementById('btnSetPrice').onclick = function () {
        closeModal();
        if (window.Sales && Sales.setPrices) Sales.setPrices(sale.id);
      };
    }
  }

  /* যে পাতার বোতাম থেকেই ডাকা হোক — একই নিয়ম
     কোনো popup না দেখিয়ে সরাসরি A4 খোলে; A5 লাগলে layout='a5' দিয়ে ডাকতে হবে
     (থার্মালের মতোই — একটা আলাদা বোতাম, কোনো জিজ্ঞেস করা পপআপ নেই)। */
  function openInvoice(saleId, layout) {
    var sale = DB.saleById(saleId);
    if (!sale) return;
    var lay = layout === 'a5' ? 'a5' : 'a4';
    if (!invoiceWin(sale, lay)) {
      toast('নতুন জানালা খোলা যায়নি — ইনভয়েসটি এখানেই দেখানো হচ্ছে।', 'warn', 4200);
      openInvoiceModal(sale, lay);
    }
  }

  return {
    toast: toast, modal: modal, closeModal: closeModal, confirmDialog: confirmDialog,
    emptyRow: emptyRow, debounce: debounce, $: $, $$: $$,
    invoiceWin: invoiceWin,
    invoiceA4: invoiceA4, invoiceThermal: invoiceThermal, invoiceSaleView: invoiceSaleView, printHtml: printHtml, printInvoice: printInvoice, downloadPdf: downloadPdf, sharePdf: sharePdf, downloadInvoicePdf: downloadInvoicePdf, fitPreview: fitPreview,
    invoicePreview: invoicePreview, openInvoice: openInvoice, openCollectionReceipt: openCollectionReceipt, printCollectionReceipt: printCollectionReceipt, collectionReceiptA4: collectionReceiptA4, setPrintLayout: setPrintLayout,
    invoiceReferenceLabel: invoiceReferenceLabel
  };
})();
