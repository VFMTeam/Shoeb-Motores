/* ================= collections.js — day-end cash collection against invoices ================= */
var Collections = (function () {
  var wired = false;

  function saleName(s) {
    return Lang.showName(s.customerNameBn || s.customerName, s.customerName) || 'ওয়াক-ইন';
  }

  function dayValue() {
    var el = document.getElementById('collectionDay');
    return (el && el.value) || F.today();
  }
  function rangeStart() {
    var el = document.getElementById('collectionStart');
    return el && el.value ? el.value : null;
  }
  function rangeEnd() {
    var el = document.getElementById('collectionEnd');
    return el && el.value ? el.value : null;
  }

  function trackedSales() {
    return DB.state.sales.filter(function (s) { return s.collectionTracking === true; });
  }

  function currentList() {
    var scope = (document.getElementById('collectionScope') || {}).value || 'day';
    var day = dayValue();
    var q = ((document.getElementById('collectionSearch') || {}).value || '').trim().toLowerCase();
    var list = trackedSales();
    if (scope === 'day') list = list.filter(function (s) { return DB.todayStr(s.date) === day; });
    if (scope === 'range') {
      var rs = rangeStart(), re = rangeEnd();
      if (rs) list = list.filter(function (s) { return s.date >= rs; });
      if (re) list = list.filter(function (s) { return s.date <= re + 'T23:59:59'; });
    }
    if (scope === 'due') list = list.filter(function (s) { return F.num(s.due) > 0.009; });
    if (q) {
      list = list.filter(function (s) {
        return [s.invoiceNo, s.customerName, s.customerNameBn, s.customerPhone, s.vehicleNo].some(function (x) {
          return String(x || '').toLowerCase().indexOf(q) >= 0;
        });
      });
    }
    list.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return list;
  }

  function rangeCollections() {
    var rs = rangeStart(), re = rangeEnd();
    if (!rs && !re) return [];
    return DB.collectionsInRange(rs, re);
  }

  function stat(label, value, sub) {
    return '<div class="collection-stat"><span class="cs-label">' + label + '</span><span class="cs-value">' + value + '</span><span class="cs-sub">' + (sub || '') + '</span></div>';
  }

  function renderKpis() {
    var scope = (document.getElementById('collectionScope') || {}).value || 'day';
    var day = dayValue();
    var rangeMode = scope === 'range';
    var periodSales, periodCollections, periodLabel;

    if (rangeMode) {
      var rs = rangeStart(), re = rangeEnd();
      periodLabel = (rs || '?') + ' → ' + (re || '?');
      periodSales = trackedSales().filter(function (s) {
        if (rs && s.date < rs) return false;
        if (re && s.date > re + 'T23:59:59') return false;
        return true;
      });
      periodCollections = DB.collectionsInRange(rs, re);
    } else {
      periodLabel = F.d(day);
      periodSales = trackedSales().filter(function (s) { return DB.todayStr(s.date) === day; });
      periodCollections = DB.collectionsInRange(day, day);
    }

    var totalSales = periodSales.reduce(function (a, s) { return a + F.num(s.total); }, 0);
    var cash = periodCollections.reduce(function (a, r) { return a + F.num(r.amount); }, 0);
    var totalQty = periodSales.reduce(function (a, s) {
      return a + s.items.reduce(function (b, i) { return b + F.num(i.qty); }, 0);
    }, 0);
    var full = 0, partial = 0, unpaid = 0, pending = 0;
    periodSales.forEach(function (s) {
      if (DB.saleHasPending(s)) { pending++; return; }
      var paid = F.num(s.paid), due = F.num(s.due), total = F.num(s.total);
      if (total > 0 && due <= 0.009 && paid > 0) full++;
      else if (paid > 0 && due > 0.009) partial++;
      else if (due > 0.009) unpaid++;
    });
    document.getElementById('collectionKpis').innerHTML =
      stat(rangeMode ? 'সময়কাল' : 'আজকের বিক্রি', periodSales.length + ' টি বিক্রি', periodLabel + ' · ' + F.money(totalSales)) +
      stat('মোট পণ্য বিক্রি', totalQty + ' পিস', 'ইনভয়েসে বিক্রিত মোট পণ্য') +
      stat('নগদ পাওয়া', F.money(cash), new Set(periodCollections.map(function (r) { return r.paymentGroup || r.id; })).size + ' টি collection entry') +
      stat('পুরো টাকা পাওয়া', full + ' টি', 'ফুল পেইড') +
      stat('আংশিক টাকা', partial + ' টি', 'আবার টাকা যোগ করা যাবে') +
      stat('এখনও টাকা যোগ হয়নি', unpaid + ' টি', pending ? ('দাম বাকি ' + pending + ' টি') : '');
  }

  function renderTable() {
    var list = currentList();
    var tb = document.querySelector('#collectionTable tbody');
    tb.innerHTML = list.length ? list.map(function (s) {
      var pendingPrice = DB.saleHasPending(s), due = DB.trueDue(s), collected = F.num(s.paid);
      var cust = s.customerId ? DB.customerById(s.customerId) : null;
      var address = cust ? [cust.addressBn, cust.address].filter(Boolean).join(', ') : '';
      var ref = s.reference || null;
      var refText = ref && (ref.name || ref.phone || ref.address) ? '<div class="cell-sub">রেফারেন্স: ' + F.esc([ref.name, ref.phone, ref.address].filter(Boolean).join(' · ')) + '</div>' : '';
      return '<tr>' +
        '<td><b>' + F.esc(s.invoiceNo) + '</b></td>' +
        '<td>' + F.d(s.date) + '<div class="cell-sub">' + F.time(s.date) + '</div></td>' +
        '<td><div class="cell-main">' + F.esc(saleName(s)) + '</div><div class="cell-sub mono">' + F.esc(s.customerPhone || s.vehicleNo || '') + '</div>' + (address ? '<div class="cell-sub">' + F.esc(address) + '</div>' : '') + refText + '</td>' +
        '<td class="num"><b>' + F.money(s.total) + '</b></td>' +
        '<td class="num">' + F.money(collected) + '</td>' +
        '<td class="num collection-due ' + (!pendingPrice && due <= 0.009 ? 'collection-zero' : '') + '">' + F.money(due) + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="btn small" data-invoice="' + s.id + '">ইনভয়েস</button>' +
          (pendingPrice ? '<button class="btn small primary" data-collect="' + s.id + '">＋ ক্যাশ</button>' :
            (due > 0.009 ? '<button class="btn small primary" data-collect="' + s.id + '">আংশিক</button><button class="btn small ghost" data-full-collect="' + s.id + '">পুরো</button>' : '<span class="tag ok">হিসাব মিলেছে</span>')) +
        '</div></td></tr>';
    }).join('') : UI.emptyRow(7, 'এই ফিল্টারে কোনো ট্র্যাক করা ইনভয়েস নেই।');

    tb.querySelectorAll('[data-invoice]').forEach(function (b) { b.onclick = function () { UI.openInvoice(b.getAttribute('data-invoice')); }; });
    tb.querySelectorAll('[data-collect]').forEach(function (b) { b.onclick = function () { open(b.getAttribute('data-collect')); }; });
    tb.querySelectorAll('[data-full-collect]').forEach(function (b) { b.onclick = function () { collectFull(b.getAttribute('data-full-collect')); }; });
  }

  function renderHistory() {
    var scope = (document.getElementById('collectionScope') || {}).value || 'day';
    var rows;
    if (scope === 'range') {
      rows = rangeCollections().slice().sort(function (a, b) { return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date); });
    } else {
      rows = DB.collectionsInRange(null, null).slice().sort(function (a, b) { return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date); });
    }
    var seenPayments = {};
    rows = rows.filter(function (r) {
      if (!r.paymentGroup) return true;
      if (seenPayments[r.paymentGroup]) return false;
      seenPayments[r.paymentGroup] = true; return true;
    }).map(DB.collectionReceipt);
    var tb = document.querySelector('#collectionHistoryTable tbody');
    tb.innerHTML = rows.length ? rows.map(function (r) {
      var s = DB.saleById(r.saleId);
      return '<tr>' +
        '<td>' + F.d(r.date) + '<div class="cell-sub">' + F.time(r.createdAt || r.date) + '</div></td>' +
        '<td><b>' + F.esc(r.invoiceNo || (s && s.invoiceNo) || '—') + '</b><div class="cell-sub mono">' + F.esc(r.no || '') + '</div></td>' +
        '<td>' + F.esc(r.customerName || (s ? saleName(s) : '—')) + '</td>' +
        '<td class="num"><b>' + F.money(r.amount) + '</b></td>' +
        '<td class="collection-history-note">' + F.esc(r.note || '—') + '</td>' +
        '<td><div class="row-actions"><button class="btn small" data-print-collection="' + r.id + '">রসিদ</button><button class="btn small ghost" data-remove-collection="' + r.id + '">বাতিল</button></div></td>' +
        '</tr>';
    }).join('') : UI.emptyRow(6, 'কোনো ক্যাশ কালেকশন এন্ট্রি নেই।');

    tb.querySelectorAll('[data-print-collection]').forEach(function (b) {
      b.onclick = function () { var r = DB.collectionById(b.getAttribute('data-print-collection')); if (r) UI.openCollectionReceipt(r); };
    });
    tb.querySelectorAll('[data-remove-collection]').forEach(function (b) {
      b.onclick = function () { remove(b.getAttribute('data-remove-collection')); };
    });
  }

  function render() {
    renderKpis();
    renderTable();
    renderHistory();
    if (window.Lang) Lang.apply();
  }

  function open(saleId) {
    var s = DB.saleById(saleId);
    if (!s) { UI.toast('ইনভয়েস পাওয়া যায়নি।', 'bad'); return; }
    if (s.collectionTracking !== true) {
      UI.toast('এটি পুরোনো invoice-only হিসাব। ভুল Due তৈরি না করতে এতে Cash Collection tracking চালু করা হয়নি।', 'warn', 6500);
      return;
    }
    var pendingPrice = DB.saleHasPending(s);
    var due = DB.trueDue(s);
    var ref = s.reference || null;
    var refCard = ref && (ref.name || ref.phone || ref.address) ? '<div class="existing-customer-card" style="margin-top:8px"><div class="ec-name">রেফারেন্স</div><div class="ec-meta">' + F.esc([ref.name, ref.phone, ref.address].filter(Boolean).join(' · ')) + '</div></div>' : '';
    if (!pendingPrice && due <= 0.009) { UI.toast('এই ইনভয়েসের হিসাব ইতিমধ্যে মিলেছে।', 'ok'); return; }
    UI.modal({
      title: 'ক্যাশ কালেকশন — ' + s.invoiceNo,
      body: '<div class="existing-customer-card">' +
          '<div class="ec-name">' + F.esc(saleName(s)) + '</div>' +
          '<div class="ec-meta">ইনভয়েস মোট: <b>' + F.money(s.total) + '</b> · আগে কালেকশন: <b>' + F.money(s.paid) + '</b> · ' + (pendingPrice ? '<b>দর বসালে Final Due আপডেট হবে</b>' : 'Due: <b>' + F.money(due) + '</b>') + '</div>' +
        '</div>' +
        refCard +
        '<div class="grid2" style="margin-top:12px">' +
          '<label>আজ কত টাকা পেলেন<input id="collectAmount" type="number" min="0.01" step="0.01"></label>' +
          '<label>কালেকশনের তারিখ<input id="collectDate" type="date"></label>' +
        '</div>' +
        (!pendingPrice ? '<div class="row" style="margin:8px 0"><button class="btn small ghost" type="button" id="collectFullBtn">পুরো বাকি টাকা</button></div>' : '<p class="tiny warnline">এই invoice-এ কিছু আইটেমের দর পরে বসানো হবে। এখন পাওয়া টাকা advance collection হিসেবে যোগ হবে; পরে দর বসালে final Due নিজে হিসাব হবে।</p>') +
        '<label>নোট<input id="collectNote" value="' + F.esc(s.dueReminderNote || '') + '"></label>' +
        '<label>বাকিটা কবে দেবে (রিমাইন্ডার)<input id="collectReminderDate" type="date" value="' + F.esc(s.dueReminderDate || '') + '"></label>' +
        '<p class="tiny muted" style="margin-top:2px">এই তারিখ পার হয়ে গেলেও বাকি মিটে না গেলে ড্যাশবোর্ডে দেখাবে। বাকি পুরো মিটে গেলে রিমাইন্ডার নিজে মুছে যাবে।</p>' +
        '',
      buttons: [
        { label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
        { label: 'কালেকশন সেভ করুন', cls: 'primary', onClick: function () {
          var amount = F.num(document.getElementById('collectAmount').value);
          var date = document.getElementById('collectDate').value || F.today();
          var note = document.getElementById('collectNote').value.trim();
          var reminderDate = (document.getElementById('collectReminderDate') || {}).value || '';
          if (amount <= 0) { UI.toast('কালেকশনের টাকা লিখুন।', 'bad'); return; }
          if (!pendingPrice && amount > DB.trueDue(s) + 0.01) { UI.toast('Due-এর চেয়ে বেশি টাকা যোগ করা যাবে না।', 'bad'); return; }
          try {
            var rec = DB.addCollection(s.id, amount, date, note, reminderDate);
            UI.closeModal();
            var dayEl = document.getElementById('collectionDay'); if (dayEl) dayEl.value = date;
            /* App.refreshAll() already re-renders this Collections view when it's
               the active view — calling render() again here duplicated the work
               and added extra delay for no visible benefit. */
            App.refreshAll();
            setTimeout(function () { UI.openCollectionReceipt(rec); }, 120);
          } catch (e) { UI.toast(e.message || 'কালেকশন সেভ করা যায়নি।', 'bad'); }
        } }
      ],
      onOpen: function (root) { var fb = root.querySelector('#collectFullBtn'); if (fb) fb.onclick = function () { var a = root.querySelector('#collectAmount'); a.value = due > 0 ? due : ''; a.focus(); }; }
    });
  }

  function collectFull(saleId) {
    var s = DB.saleById(saleId);
    if (!s || DB.saleHasPending(s)) { UI.toast('দর সম্পূর্ণ না হওয়া পর্যন্ত পুরো কালেকশন করা যাবে না।', 'warn'); return; }
    var due = DB.trueDue(s);
    if (due <= 0.009) { UI.toast('এই ইনভয়েসের হিসাব ইতিমধ্যে মিলেছে।', 'ok'); return; }
    UI.confirmDialog({
      title: 'পুরো টাকা কালেকশন করবেন?',
      message: '<b>' + F.esc(s.invoiceNo) + '</b> · এখনকার Due <b>' + F.money(due) + '</b><br>আজকের তারিখে পুরো টাকাটা Cash Collection-এ যোগ হবে।',
      confirmText: 'পুরো টাকা যোগ করুন'
    }).then(function (ok) {
      if (!ok) return;
      try {
        var rec = DB.addCollection(s.id, due, F.today(), 'সম্পূর্ণ কালেকশন');
        /* App.refreshAll() already re-renders this Collections view when it's
           the active view — the extra render() call here was duplicate work. */
        App.refreshAll();
        setTimeout(function () { UI.openCollectionReceipt(rec); }, 120);
      } catch (e) { UI.toast(e.message || 'কালেকশন সেভ করা যায়নি।', 'bad'); }
    });
  }

  function remove(id) {
    var r = DB.collectionReceipt(DB.collectionById(id));
    if (!r) return;
    UI.confirmDialog({
      title: 'কালেকশন এন্ট্রি বাতিল করবেন?',
      message: '<b>' + F.esc(r.invoiceNo || '') + '</b> থেকে <b>' + F.money(r.amount) + '</b> কালেকশন বাদ যাবে এবং বকেয়া আবার বাড়বে।',
      danger: true, confirmText: 'এন্ট্রি বাতিল করুন'
    }).then(function (ok) {
      if (!ok) return;
      DB.removeCollection(id);
      /* App.refreshAll() already re-renders this Collections view — the extra
         render() call here duplicated the work. */
      App.refreshAll();
      UI.toast('কালেকশন এন্ট্রি বাতিল হয়েছে।', 'ok');
    });
  }

  function bind() {
    if (wired) return;
    wired = true;
    var search = document.getElementById('collectionSearch');
    if (search) search.oninput = UI.debounce(render, 160);
    ['collectionDay', 'collectionScope', 'collectionStart', 'collectionEnd'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.onchange = render;
    });
    var today = document.getElementById('collectionTodayBtn');
    if (today) today.onclick = function () {
      document.getElementById('collectionDay').value = F.today();
      document.getElementById('collectionScope').value = 'day'; render();
    };
    var due = document.getElementById('collectionAllDueBtn');
    if (due) due.onclick = function () { document.getElementById('collectionScope').value = 'due'; render(); };
    var today2 = document.getElementById('closingTodayBtn');
    if (today2) today2.onclick = function () {
      document.getElementById('collectionDay').value = F.today();
      document.getElementById('collectionScope').value = 'day';
    };
  }

  return { render: render, bind: bind, open: open };
})();
