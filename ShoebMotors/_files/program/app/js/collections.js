/* ================= collections.js — day-end cash collection against invoices ================= */
var Collections = (function () {
  var wired = false;

  function saleName(s) {
    return Lang.showName(s.customerNameBn || s.customerName, s.customerName) || 'ওয়াক-ইন';
  }

  /* তারিখ খালি থাকলে: যেসব ইনভয়েসে টাকা বাকি; তারিখ দিলে: সেই দিনের সব ইনভয়েস */
  function dayValue() {
    var el = document.getElementById('collectionDay');
    return (el && el.value) || '';
  }

  function trackedSales() {
    return DB.state.sales.filter(function (s) { return s.collectionTracking === true; });
  }

  function currentList() {
    var day = dayValue();
    var q = ((document.getElementById('collectionSearch') || {}).value || '').trim().toLowerCase();
    var list = trackedSales();
    if (day) list = list.filter(function (s) { return DB.todayStr(s.date) === day; });
    else if (!q) list = list.filter(function (s) { return DB.saleHasPending(s) || DB.trueDue(s) > 0.009; });
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

  function stat(label, value, sub) {
    return '<div class="collection-stat"><span class="cs-label">' + label + '</span><span class="cs-value">' + value + '</span><span class="cs-sub">' + (sub || '') + '</span></div>';
  }

  function renderKpis() {
    var day = dayValue() || F.today();
    var daySales = trackedSales().filter(function (s) { return DB.todayStr(s.date) === day; });
    var cash = DB.collectionsInRange(day, day).reduce(function (a, r) { return a + F.num(r.amount); }, 0);
    var full = 0, open = 0;
    daySales.forEach(function (s) {
      if (DB.saleHasPending(s) || DB.trueDue(s) > 0.009) open++;
      else if (F.num(s.total) > 0) full++;
    });
    document.getElementById('collectionKpis').innerHTML =
      stat('নগদ পাওয়া', F.money(cash), F.d(day)) +
      stat('পুরো টাকা পাওয়া', full + ' টি', '') +
      stat('বাকি আছে', open + ' টি', '');
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
    }).join('') : UI.emptyRow(7, 'কোনো ইনভয়েস নেই।');

    tb.querySelectorAll('[data-invoice]').forEach(function (b) { b.onclick = function () { UI.openInvoice(b.getAttribute('data-invoice')); }; });
    tb.querySelectorAll('[data-collect]').forEach(function (b) { b.onclick = function () { open(b.getAttribute('data-collect')); }; });
    tb.querySelectorAll('[data-full-collect]').forEach(function (b) { b.onclick = function () { collectFull(b.getAttribute('data-full-collect')); }; });
  }

  function renderHistory() {
    var day = dayValue();
    var rows = DB.collectionsInRange(day || null, day || null).slice().sort(function (a, b) { return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date); });
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
          '<label>বাকিটা কবে দেবে<input id="collectReminderDate" type="date" value="' + F.esc(s.dueReminderDate || '') + '"></label>' +
        '</div>' +
        (!pendingPrice ? '<div class="row" style="margin:8px 0"><button class="btn small ghost" type="button" id="collectFullBtn">পুরো বাকি টাকা</button></div>' : '') +
        '<label>নোট<input id="collectNote" value="' + F.esc(s.dueReminderNote || '') + '"></label>' +
        '',
      buttons: [
        { label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
        { label: 'কালেকশন সেভ করুন', cls: 'primary', onClick: function () {
          var amount = F.num(document.getElementById('collectAmount').value);
          var date = F.today();
          var note = document.getElementById('collectNote').value.trim();
          var reminderDate = (document.getElementById('collectReminderDate') || {}).value || '';
          if (amount <= 0) { UI.toast('কালেকশনের টাকা লিখুন।', 'bad'); return; }
          if (!pendingPrice && amount > DB.trueDue(s) + 0.01) { UI.toast('Due-এর চেয়ে বেশি টাকা যোগ করা যাবে না।', 'bad'); return; }
          try {
            var rec = DB.addCollection(s.id, amount, date, note, reminderDate);
            UI.closeModal();
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
    var day = document.getElementById('collectionDay');
    if (day) day.onchange = render;
  }

  return { render: render, bind: bind, open: open };
})();
