/* ================= sales.js — Sales & Invoices list, filters, actions ================= */
var Sales = (function () {
  var lastFiltered = [];
  var salesPage = 1, PAGE_SIZE = 50;

  function currentFilters() {
    return {
      q: (document.getElementById('salesSearch').value || '').trim(),
      from: document.getElementById('salesFrom').value,
      to: document.getElementById('salesTo').value,
      day: document.getElementById('salesDay').value,
      quick: document.getElementById('salesQuick').value
    };
  }

  function applyQuick(f) {
    if (f.quick === 'today') { f.from = F.today(); f.to = F.today(); }
    else if (f.quick === 'week') { f.from = F.addDays(F.today(), -6); f.to = F.today(); }
    else if (f.quick === 'month') { f.from = F.startOfMonth(); f.to = F.today(); }
    return f;
  }

  function filtered() {
    var f = applyQuick(currentFilters());
    var list = DB.state.sales.slice();
    if (f.day) { f.from = f.day; f.to = f.day; }
    if (f.from) list = list.filter(function (s) { return DB.todayStr(s.date) >= f.from; });
    if (f.to) list = list.filter(function (s) { return DB.todayStr(s.date) <= f.to; });
    if (f.q) {
      var q = f.q.toLowerCase();
      list = list.filter(function (s) {
        return [s.invoiceNo, s.customerName, s.customerNameBn, s.customerPhone, s.vehicleNo, s.note].some(function (x) {
          return (x || '').toLowerCase().indexOf(q) >= 0;
        }) || s.items.some(function (i) { return (i.name || '').toLowerCase().indexOf(q) >= 0; });
      });
    }
    list.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return list;
  }

  function render() {
    var list = filtered();
    lastFiltered = list;
    var totalRows = list.length;
    var totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    if (salesPage > totalPages) salesPage = totalPages;
    if (salesPage < 1) salesPage = 1;
    var pageList = list.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);
    var f = applyQuick(currentFilters());
    if (f.day) { f.from = f.day; f.to = f.day; }
    var range = document.getElementById('salesRangeSummary');
    var rangeText = 'সব সময়ের ইনভয়েস';
    if (f.from && f.to && f.from === f.to) rangeText = F.d(f.from) + ' — ' + list.length + ' টি ইনভয়েস';
    else if (f.quick === 'week') rangeText = 'শেষ ৭ দিন — ' + list.length + ' টি ইনভয়েস';
    else if (f.quick === 'month') rangeText = 'এই মাস — ' + list.length + ' টি ইনভয়েস';
    else if (f.from || f.to) rangeText = (f.from ? F.d(f.from) : 'শুরু') + ' থেকে ' + (f.to ? F.d(f.to) : 'আজ') + ' — ' + list.length + ' টি ইনভয়েস';
    else rangeText += ' — ' + list.length + ' টি';
    if (range) range.innerHTML = '<b>' + rangeText + '</b>';

    var dayMap = {};
    list.forEach(function (s) { var d = DB.todayStr(s.date); dayMap[d] = (dayMap[d] || 0) + 1; });
    var dayBox = document.getElementById('salesDayBreakdown');
    if (dayBox) {
      var days = Object.keys(dayMap).sort().reverse().slice(0, 31);
      dayBox.innerHTML = days.length > 1 ? days.map(function (d) {
        return '<button class="day-chip" data-day="' + d + '">' + F.d(d) + ' · <b>' + dayMap[d] + '</b></button>';
      }).join('') : '';
      dayBox.querySelectorAll('[data-day]').forEach(function (b) { b.onclick = function () {
        salesPage = 1;
        document.getElementById('salesDay').value = b.getAttribute('data-day');
        document.getElementById('salesQuick').value = '';
        document.getElementById('salesFrom').value = ''; document.getElementById('salesTo').value = '';
        render();
      }; });
    }

    var tb = document.querySelector('#salesTable tbody');
    tb.innerHTML = pageList.length ? pageList.map(function (s) {
      return '<tr>' +
        '<td><b>' + F.esc(s.invoiceNo) + '</b></td>' +
        '<td>' + F.d(s.date) + '<div class="cell-sub">' + F.time(s.date) + '</div></td>' +
        '<td><div class="cell-main">' + F.esc(Lang.showName(s.customerNameBn || s.customerName, s.customerName) || 'ওয়াক-ইন') + '</div><div class="cell-sub mono">' + (s.vehicleNo ? F.esc(s.vehicleNo) : F.esc(s.customerPhone || '')) + '</div></td>' +
        '<td class="tiny">' + s.items.map(function (i) { return F.esc(i.name) + ' ×' + i.qty; }).join('<br>') + '</td>' +
        '<td class="num"><b>' + F.money(s.total) + '</b>' + (F.num(s.discount) > 0 ? '<div class="cell-sub">ছাড় ' + F.money(s.discount) + '</div>' : '') + '</td>' +
        '<td class="num">' + (DB.saleHasPending(s) ? '<span class="tag warn">দর বসান</span>' : '<span class="tag ok">সম্পূর্ণ</span>') + '</td>' +
        '<td><div class="row-actions">' +
        '<button class="btn small" data-view="' + s.id + '">ইনভয়েস</button>' +
        (s.collectionTracking === true && F.num(s.due) > 0.009 ? '<button class="btn small primary" data-collect="' + s.id + '">＋ ক্যাশ</button>' : '') +
        (DB.saleHasPending(s) ? '<button class="btn small" data-price="' + s.id + '">দাম বসান</button>' : '') +
        '<button class="btn small ghost" data-wa="' + s.id + '" title="কাস্টমারকে হোয়াটসঅ্যাপে বিলের হিসাব পাঠান">বিল পাঠান</button>' +
        '<button class="btn small ghost" data-thermal="' + s.id + '" title="80mm থার্মাল রোলে ছাপুন">🧾</button>' +
        '<button class="btn small ghost" data-a5="' + s.id + '" title="A5 কাগজে ছাপুন">A5</button>' +
        '<button class="btn small ghost" data-del="' + s.id + '" title="ইনভয়েস মুছে ফেলুন">🗑</button>' +
        '</div></td>' +
        '</tr>';
    }).join('') : UI.emptyRow(7, 'এই ফিল্টারে কোনো ইনভয়েস নেই।');

    var pager = document.getElementById('salesPager');
    if (pager) {
      pager.hidden = totalPages <= 1;
      var en = window.Lang && Lang.isEn();
      pager.innerHTML = totalPages > 1 ?
        '<button class="btn small ghost pager-btn" data-pager-prev' + (salesPage <= 1 ? ' disabled' : '') + '>‹ ' + (en ? 'Previous' : 'আগের') + '</button>' +
        '<span class="pager-info">' + (en ? 'Page ' : 'পৃষ্ঠা ') + salesPage + ' / ' + totalPages + ' · ' + totalRows + (en ? ' invoices' : ' টি') + '</span>' +
        '<button class="btn small ghost pager-btn" data-pager-next' + (salesPage >= totalPages ? ' disabled' : '') + '>' + (en ? 'Next' : 'পরের') + ' ›</button>' : '';
      var prev = pager.querySelector('[data-pager-prev]'), next = pager.querySelector('[data-pager-next]');
      if (prev) prev.onclick = function () { if (salesPage > 1) { salesPage--; render(); } };
      if (next) next.onclick = function () { if (salesPage < totalPages) { salesPage++; render(); } };
    }

    tb.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { UI.openInvoice(b.getAttribute('data-view')); }; });
    tb.querySelectorAll('[data-collect]').forEach(function (b) { b.onclick = function () { Collections.open(b.getAttribute('data-collect')); }; });
    tb.querySelectorAll('[data-wa]').forEach(function (b) { b.onclick = function () { whatsapp(DB.saleById(b.getAttribute('data-wa'))); }; });
    tb.querySelectorAll('[data-thermal]').forEach(function (b) {
      b.onclick = function () { UI.printInvoice(DB.saleById(b.getAttribute('data-thermal')), '80'); };
    });
    tb.querySelectorAll('[data-a5]').forEach(function (b) {
      b.onclick = function () { UI.openInvoice(b.getAttribute('data-a5'), 'a5'); };
    });
    tb.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { remove(b.getAttribute('data-del')); }; });
    tb.querySelectorAll('[data-price]').forEach(function (b) { b.onclick = function () { setPrices(b.getAttribute('data-price')); }; });

    var total = list.reduce(function (a, s) { return a + F.num(s.total); }, 0);
    var discount = list.reduce(function (a, s) { return a + F.num(s.discount); }, 0);
    var items = list.reduce(function (a, s) { return a + s.items.reduce(function (x, i) { return x + F.num(i.qty); }, 0); }, 0);
    document.getElementById('salesTotals').innerHTML =
      '<span class="tag">' + list.length + ' টি ইনভয়েস</span>' +
      '<span class="tag">' + F.qty(items) + ' পিস বিক্রি</span>' +
      '<span class="tag ok">মোট ' + F.money(total) + '</span>' +
      (discount > 0 ? '<span class="tag">ছাড় ' + F.money(discount) + '</span>' : '');
  }

  function shareInvoice(s) { whatsapp(s); }

  function whatsapp(s) {
    s = UI.invoiceSaleView ? UI.invoiceSaleView(s) : s;
    var st = DB.state.settings;
    var lines = ['*' + st.shopName + '*', (st.address ? st.address : ''), (st.phone ? 'মোবাইল: ' + st.phone : ''), '',
      'ইনভয়েস: ' + s.invoiceNo, 'তারিখ: ' + F.d(s.date), 'ক্রেতা: ' + (Lang.showName(s.customerNameBn || s.customerName, s.customerName) || 'ওয়াক-ইন'),
      (s.vehicleNo ? 'গাড়ির নম্বর: ' + s.vehicleNo : ''), ''].filter(function (x) { return !!x; });
    s.items.forEach(function (i) {
      lines.push('• ' + i.name + ' ×' + i.qty + ' = ' + F.money(i.total));
    });
    if (F.num(s.discount) > 0.009) lines.push('ছাড়: ' + F.money(s.discount));
    lines.push('', 'সর্বমোট: *' + F.money(s.total) + '*');
    lines.push('', st.thanksLine || '');
    var phone = (s.customerPhone || '').replace(/[^0-9]/g, '');
    if (phone.length === 11 && phone.indexOf('0') === 0) phone = '88' + phone;
    var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(lines.join('\n'));
    window.open(url, '_blank');
  }

  function remove(id) {
    var s = DB.saleById(id);
    UI.confirmDialog({
      title: 'ইনভয়েস মুছে ফেলুন ' + s.invoiceNo + '?',
      message: 'এই বিক্রিটি মুছে যাবে এবং পণ্যের পরিমাণ আবার স্টকে যোগ হবে।<br>এই বিক্রির সাথে সংযুক্ত রেকর্ডও সরিয়ে দেওয়া হবে।',
      danger: true, confirmText: 'মুছে ফেলুন'
    }).then(function (ok) {
      if (!ok) return;
      /* মুছে ফেলার আগে invoice + linked collection records একসাথে recovery metadata-তে রাখি।
         এতে Restore করলে paid/due এবং cash collection ledger দুটোই একই transaction হিসেবে ফেরে। */
      var linkedReceipts = (DB.state.receipts || []).filter(function (r) { return r.saleId === id; })
        .map(function (r) { return JSON.parse(JSON.stringify(r)); });
      DB.archiveDeleted('sale', s.invoiceNo, JSON.parse(JSON.stringify(s)), {
        amount: F.num(s.total), date: s.date, customer: s.customerNameBn || s.customerName || '',
        linkedReceipts: linkedReceipts
      });
      s.items.forEach(function (i) {
        if (!i.productId) return;
        var p = DB.productById(i.productId);
        if (!p) return;
        p.qty = DB.round2(F.num(p.qty) + F.num(i.qty));
        p.adjustments = p.adjustments || [];
        p.adjustments.push({ date: DB.todayStr(), delta: F.num(i.qty), reason: 'ইনভয়েস ' + s.invoiceNo + ' মুছে ফেলা হয়েছে', note: '' });
      });
      DB.state.sales = DB.state.sales.filter(function (x) { return x.id !== id; });
      DB.state.receipts = (DB.state.receipts || []).filter(function (r) {
        if (r.saleId === id) {
          if (r.type === 'collection') DB.archiveDeleted('collection', r.invoiceNo || r.no || s.invoiceNo, r, { amount: F.num(r.amount), date: r.date, customer: r.customerName || '' });
          return false;
        }
        if (r.allocations) r.allocations = r.allocations.filter(function (a) { return a.saleId !== id; });
        return true;
      });
      DB.save(); render();
      if (App.currentView === 'dashboard') Dashboard.render();
    });
  }

  function exportCsv() {
    var rows = [['ইনভয়েস', 'তারিখ', 'ক্রেতা', 'মোবাইল', 'গাড়ি', 'আইটেম', 'উপমোট', 'ছাড়', 'মোট', 'ক্রয়মূল্য', 'নোট']];
    lastFiltered.forEach(function (s) {
      rows.push([s.invoiceNo, DB.todayStr(s.date), s.customerNameBn || s.customerName, s.customerPhone, s.vehicleNo,
        s.items.map(function (i) { return i.name + ' x' + i.qty; }).join(' | '),
      s.subTotal, s.discount, s.total, s.cost, s.note]);
    });
    F.download('shoeb-motors-sales-' + F.today() + '.csv', F.csv(rows), 'text/csv');
    UI.toast('বিক্রির হিসাব CSV ফাইলে সেভ হয়েছে (Excel-এ খুলবে)।', 'ok');
  }

  function bind() {
    ['salesSearch'].forEach(function (id) { document.getElementById(id).oninput = UI.debounce(function () { salesPage = 1; render(); }, 180); });
    ['salesDay', 'salesFrom', 'salesTo', 'salesQuick'].forEach(function (id) {
      document.getElementById(id).onchange = function () {
        salesPage = 1;
        if (id === 'salesQuick' && this.value) {
          document.getElementById('salesDay').value = '';
          document.getElementById('salesFrom').value = '';
          document.getElementById('salesTo').value = '';
        }
        if (id === 'salesDay' && this.value) {
          document.getElementById('salesQuick').value = '';
          document.getElementById('salesFrom').value = '';
          document.getElementById('salesTo').value = '';
        }
        render();
      };
    });
    document.getElementById('salesClearFilters').onclick = function () {
      salesPage = 1;
      document.getElementById('salesSearch').value = '';
      document.getElementById('salesDay').value = '';
      document.getElementById('salesFrom').value = '';
      document.getElementById('salesTo').value = '';
      document.getElementById('salesQuick').value = '';
      render();
    };
    document.getElementById('exportSalesBtn').onclick = exportCsv;
  }


  /* ---------- নিশ্চিত হয়নি এমন দরের আইটেমে পরে দাম বসানো ---------- */
  function setPrices(saleId) {
    var s = DB.state.sales.filter(function (x) { return x.id === saleId; })[0];
    if (!s) { UI.toast('ইনভয়েস পাওয়া যায়নি।', 'bad'); return; }
    var pend = DB.salePendingItems(s);
    if (!pend.length) { UI.toast('এই ইনভয়েসের সব দর ঠিক আছে।', 'ok'); return; }
    var body = '' +
      '<table class="table compact"><thead><tr><th>আইটেম</th><th class="num">পরিমাণ</th><th class="num">ক্রয়মূল্য (মালিক)</th><th class="num">দর (প্রতি পিস)</th></tr></thead><tbody>' +
      pend.map(function (i) {
        var idx = s.items.indexOf(i);
        var cost = F.num(i.cost);
        return '<tr><td>' + F.esc(i.name) + (i.size ? ' <span class="tiny muted">(' + F.esc(i.size) + ')</span>' : '') + '</td>' +
          '<td class="num">' + F.qty(i.qty) + '</td>' +
          '<td class="num owner-only">' + (cost > 0 ? F.money(cost) : '—') + '</td>' +
          '<td class="num"><input class="mini-input" id="pp' + idx + '" type="number" step="0.01" min="0"></td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="grid2" style="margin-top:12px">' +
        '<label>ছাড় (৳)<input id="ppDiscount" type="number" step="0.01" min="0" value="' + (F.num(s.discount) || '') + '"></label>' +
        '<label>ছাড়ের কারণ<input id="ppDiscountReason" value="' + F.esc(s.discountReason || '') + '"></label>' +
      '</div>' +
      '';

    UI.modal({
      title: 'দাম বসান — ইনভয়েস ' + s.invoiceNo,
      body: body,
      buttons: [
        { label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
        {
          label: 'দাম সেভ করুন', cls: 'primary', onClick: function () {
            var root = document.getElementById('modalBody'), changed = 0;
            pend.forEach(function (i) {
              var idx = s.items.indexOf(i);
              if (idx < 0) return;
              var el = root.querySelector('#pp' + idx);
              var v = F.num(el && el.value);
              if (v > 0) { i.price = v; i.pricePending = false; changed++; }
            });
            var dEl = root.querySelector('#ppDiscount');
            var drEl = root.querySelector('#ppDiscountReason');
            var oldDiscount = F.num(s.discount);
            var newDiscount = Math.max(0, F.num(dEl && dEl.value));
            var discountChanged = Math.abs(oldDiscount - newDiscount) > 0.009 || String(s.discountReason || '') !== String((drEl && drEl.value) || '').trim();
            s.discount = newDiscount;
            s.discountReason = newDiscount > 0 ? String((drEl && drEl.value) || '').trim() : '';
            if (!changed && !discountChanged) { UI.toast('কোনো দাম বা ছাড় পরিবর্তন করা হয়নি।', 'warn'); return; }
            DB.recalcSale(s);
            DB.save();
            App.refreshAll();
            UI.closeModal();
            UI.toast('দাম বসানো হয়েছে · ইনভয়েস <b>' + s.invoiceNo + '</b> · সর্বমোট <b>' + F.money(s.total) + '</b>', 'ok', 7000);
            if (DB.saleHasPending(s)) UI.toast('আরও ' + DB.salePendingItems(s).length + 'টি আইটেমের দর বসানো বাকি।', 'warn', 6000);
          }
        }
      ],
      onOpen: function (root) {
        var first = root.querySelector('input.mini-input');
        if (first) first.focus();
      }
    });
  }

  return { setPrices: setPrices, render: render, bind: bind, exportCsv: exportCsv, shareInvoice: shareInvoice, whatsapp: whatsapp };
})();
