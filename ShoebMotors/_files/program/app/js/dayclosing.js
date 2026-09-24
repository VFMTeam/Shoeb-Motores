/* ================= dayclosing.js — owner day-end reconciliation ================= */
var DayClosing = (function () {
  var wired = false;
  var activeDay = '';
  var activeMetrics = null;

  function en() { return !!(window.Lang && Lang.isEn && Lang.isEn()); }
  function tx(bn, english) { return en() ? english : bn; }

  function dayValue() {
    var el = document.getElementById('closingDay');
    if (el && !el.value) el.value = F.today();
    return (el && el.value) || F.today();
  }

  function collectionsForSaleThroughDay(saleId, day) {
    return (DB.state.receipts || []).filter(function (r) {
      return r.type === 'collection' && r.saleId === saleId && DB.todayStr(r.date) <= day;
    }).reduce(function (a, r) { return a + F.num(r.amount); }, 0);
  }

  function metrics(day) {
    var sales = DB.salesInRange(day, day);
    var invoiceCount = sales.length;
    var salesTotal = sales.reduce(function (a, s) { return a + F.num(s.total); }, 0);
    var dayCollections = DB.collectionsInRange(day, day);
    var expectedCash = dayCollections.reduce(function (a, r) { return a + F.num(r.amount); }, 0);
    var newInvoiceCollected = 0, oldInvoiceCollected = 0;

    dayCollections.forEach(function (r) {
      var sale = DB.saleById(r.saleId);
      if (sale && DB.todayStr(sale.date) === day) newInvoiceCollected += F.num(r.amount);
      else oldInvoiceCollected += F.num(r.amount);
    });

    var invoiceDueAtClose = sales.reduce(function (a, s) {
      if (s.collectionTracking !== true) return a;
      var collected = collectionsForSaleThroughDay(s.id, day);
      return a + Math.max(0, F.num(s.total) - collected);
    }, 0);

    return {
      day: day,
      invoiceCount: invoiceCount,
      salesTotal: DB.round2(salesTotal),
      collectionCount: new Set(dayCollections.map(function (r) { return r.paymentGroup || r.id; })).size,
      expectedCash: DB.round2(expectedCash),
      newInvoiceCollected: DB.round2(newInvoiceCollected),
      oldInvoiceCollected: DB.round2(oldInvoiceCollected),
      invoiceDueAtClose: DB.round2(invoiceDueAtClose)
    };
  }

  function stat(label, value, sub, cls) {
    return '<div class="collection-stat ' + (cls || '') + '"><span class="cs-label">' + label + '</span><span class="cs-value">' + value + '</span><span class="cs-sub">' + (sub || '') + '</span></div>';
  }

  function sameMoney(a, b) { return Math.abs(F.num(a) - F.num(b)) < 0.01; }

  function closingChanged(rec, m) {
    if (!rec) return false;
    return F.num(rec.invoiceCount) !== F.num(m.invoiceCount) ||
      !sameMoney(rec.salesTotal, m.salesTotal) ||
      F.num(rec.collectionCount) !== F.num(m.collectionCount) ||
      !sameMoney(rec.expectedCash, m.expectedCash) ||
      !sameMoney(rec.newInvoiceCollected, m.newInvoiceCollected) ||
      !sameMoney(rec.oldInvoiceCollected, m.oldInvoiceCollected) ||
      !sameMoney(rec.invoiceDueAtClose, m.invoiceDueAtClose);
  }

  function diffClass(n) {
    n = F.num(n);
    if (Math.abs(n) < 0.01) return 'closing-match';
    return n > 0 ? 'closing-over' : 'closing-short';
  }

  function diffText(n) {
    n = DB.round2(n);
    if (Math.abs(n) < 0.01) return tx('✓ ক্যাশ মিলেছে', '✓ Cash matched');
    return (n > 0 ? tx('বেশি ', 'Extra ') : tx('কম ', 'Short ')) + F.money(Math.abs(n));
  }

  function expenseValue() {
    var el = document.getElementById('closingExpense');
    return el ? Math.max(0, F.num(el.value)) : 0;
  }

  function adjustedExpectedCash(m) {
    m = m || activeMetrics || { expectedCash: 0 };
    return DB.round2(F.num(m.expectedCash) - expenseValue());
  }

  function renderDifference() {
    var el = document.getElementById('closingActualCash');
    var out = document.getElementById('closingDifference');
    var targetEl = document.getElementById('closingAdjustedCash');
    if (!el || !out || !activeMetrics) return;
    var expense = expenseValue();
    var target = adjustedExpectedCash(activeMetrics);
    if (targetEl) targetEl.textContent = F.money(target);
    if (expense > activeMetrics.expectedCash) {
      out.className = 'closing-difference closing-short';
      out.textContent = tx('দিনের খরচ প্রত্যাশিত ক্যাশের চেয়ে বেশি হতে পারে না', 'Day expense cannot exceed Expected Cash');
      return;
    }
    if (String(el.value).trim() === '') {
      out.className = 'closing-difference';
      out.textContent = tx('হাতে গোনা ক্যাশ লিখলে কম / বেশি দেখা যাবে', 'Enter Actual Cash to see the difference');
      return;
    }
    var d = DB.round2(F.num(el.value) - target);
    out.className = 'closing-difference ' + diffClass(d);
    out.textContent = diffText(d);
  }

  function renderStatus(rec, changed) {
    var box = document.getElementById('closingStatus');
    if (!rec) {
      box.innerHTML = '<span class="tag warn">' + tx('এই দিনের হিসাব এখনো বন্ধ করা হয়নি', 'This day has not been closed yet') + '</span>';
      return;
    }
    var when = rec.closedAt ? F.d(rec.closedAt) + ' · ' + F.time(rec.closedAt) : '';
    box.innerHTML = changed
      ? '<span class="tag warn">' + tx('⚠ হিসাব বন্ধ করার পর তথ্য পরিবর্তন হয়েছে', '⚠ Records changed after closing') + '</span><span class="tiny muted"> · ' + tx('আবার সেভ করলে সংরক্ষিত হিসাব আপডেট হবে', 'save again to update the snapshot') + '</span>'
      : '<span class="tag ok">' + tx('✓ দিনের হিসাব বন্ধ', '✓ Day Closed') + '</span><span class="tiny muted"> · ' + F.esc(when) + '</span>';
  }

  function renderKpis(m) {
    document.getElementById('closingKpis').innerHTML =
      stat(tx('মোট ইনভয়েস', 'Total invoices'), en() ? String(m.invoiceCount) : (m.invoiceCount + ' টি'), tx('মোট বিক্রি ', 'Total sales ') + F.money(m.salesTotal)) +
      stat(tx('প্রত্যাশিত ক্যাশ', 'Expected Cash'), F.money(m.expectedCash), en() ? (m.collectionCount + ' Cash Collection entries') : (m.collectionCount + ' টি ক্যাশ কালেকশন')) +
      stat(tx('নতুন ইনভয়েস থেকে ক্যাশ', 'Cash from today’s invoices'), F.money(m.newInvoiceCollected), '') +
      stat(tx('পুরোনো ইনভয়েস থেকে ক্যাশ', 'Cash from older invoices'), F.money(m.oldInvoiceCollected), '');
  }

  function renderBreakdown(m) {
    document.getElementById('closingBreakdown').innerHTML =
      '<div class="closing-line"><span>' + tx('দিনের মোট বিক্রি', 'Total sales for the day') + '</span><b>' + F.money(m.salesTotal) + '</b></div>' +
      '<div class="closing-line"><span>' + tx('ইনভয়েস সংখ্যা', 'Invoice count') + '</span><b>' + (en() ? String(m.invoiceCount) : (m.invoiceCount + ' টি')) + '</b></div>' +
      '<div class="closing-line"><span>' + tx('ক্যাশ কালেকশন এন্ট্রি', 'Cash Collection entries') + '</span><b>' + (en() ? String(m.collectionCount) : (m.collectionCount + ' টি')) + '</b></div>' +
      '<div class="closing-line"><span>' + tx('আজকের ক্যাশ কালেকশন', 'Cash collected that day') + '</span><b>' + F.money(m.expectedCash) + '</b></div>' +
      '<div class="closing-line"><span>' + tx('আজকের ইনভয়েসে দিন শেষে বাকি', 'End-of-day Due on that day’s invoices') + '</span><b>' + F.money(m.invoiceDueAtClose) + '</b></div>' +
      '<div class="closing-line"><span>' + tx('দিনের খরচ', 'Day expense') + '</span><b>− ' + F.money(expenseValue()) + '</b></div>' +
      '<div class="closing-line closing-strong"><span>' + tx('খরচ বাদে হাতে থাকার কথা', 'Cash expected after expense') + '</span><b>' + F.money(adjustedExpectedCash(m)) + '</b></div>';
  }

  function renderHistory() {
    var rows = DB.dayClosingsList().slice(0, 30);
    var tb = document.querySelector('#closingHistoryTable tbody');
    tb.innerHTML = rows.length ? rows.map(function (r) {
      var live = metrics(r.date);
      var changed = closingChanged(r, live);
      var exp = Math.max(0, F.num(r.dayExpense));
      var adjusted = r.adjustedExpectedCash !== undefined ? F.num(r.adjustedExpectedCash) : DB.round2(F.num(r.expectedCash) - exp);
      var d = r.difference !== undefined ? F.num(r.difference) : DB.round2(F.num(r.actualCash) - adjusted);
      return '<tr>' +
        '<td><b>' + F.d(r.date) + '</b><div class="cell-sub">' + (r.closedAt ? F.time(r.closedAt) : '') + '</div></td>' +
        '<td class="num">' + F.num(r.invoiceCount) + '</td>' +
        '<td class="num">' + F.money(r.salesTotal) + '</td>' +
        '<td class="num">' + F.money(r.expectedCash) + '</td>' +
        '<td class="num">' + F.money(exp) + '</td>' +
        '<td class="num">' + F.money(adjusted) + '</td>' +
        '<td class="num">' + F.money(r.actualCash) + '</td>' +
        '<td class="num"><span class="closing-mini-diff ' + diffClass(d) + '">' + diffText(d) + '</span></td>' +
        '<td>' + (r.note ? F.esc(r.note) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + (changed ? '<span class="tag warn">' + tx('হিসাব পরিবর্তিত', 'Changed') + '</span>' : '<span class="tag ok">' + tx('বন্ধ', 'Closed') + '</span>') + '</td>' +
        '<td><button class="btn small ghost" data-closing-open="' + F.esc(r.date) + '">' + tx('খুলুন', 'Open') + '</button></td>' +
        '</tr>';
    }).join('') : '';

    tb.querySelectorAll('[data-closing-open]').forEach(function (b) {
      b.onclick = function () {
        document.getElementById('closingDay').value = b.getAttribute('data-closing-open');
        render(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });
  }

  function loadForm(day, rec, force) {
    var actual = document.getElementById('closingActualCash');
    var expense = document.getElementById('closingExpense');
    var note = document.getElementById('closingNote');
    if (force || activeDay !== day) {
      actual.value = rec ? DB.round2(rec.actualCash) : '';
      if (expense) expense.value = rec && F.num(rec.dayExpense) ? DB.round2(rec.dayExpense) : '';
      note.value = rec ? (rec.note || '') : '';
    }
    document.getElementById('saveClosingBtn').textContent = rec ? tx('✓ দিনের হিসাব আপডেট করুন', '✓ Update Day Closing') : tx('✓ দিনের হিসাব সেভ করুন', '✓ Save Day Closing');
    document.getElementById('closingSavedAt').textContent = rec && rec.closedAt ? (tx('শেষ সেভ: ', 'Last saved: ') + F.d(rec.closedAt) + ' · ' + F.time(rec.closedAt)) : '';
  }

  function render(forceForm) {
    var day = dayValue();
    var m = metrics(day);
    var rec = DB.dayClosingByDate(day);
    var changed = closingChanged(rec, m);
    loadForm(day, rec, !!forceForm);
    activeDay = day;
    activeMetrics = m;
    renderStatus(rec, changed);
    renderKpis(m);
    renderBreakdown(m);
    renderDifference();
    renderHistory();
    if (window.Lang) Lang.apply();
  }

  function saveClosing() {
    var day = dayValue();
    var actualEl = document.getElementById('closingActualCash');
    if (String(actualEl.value).trim() === '') {
      UI.toast(tx('হাতে গোনা ক্যাশ লিখুন।', 'Enter the Actual Cash you counted.'), 'bad'); actualEl.focus(); return;
    }
    var actual = F.num(actualEl.value);
    if (actual < 0) { UI.toast(tx('হাতে গোনা ক্যাশ শূন্যের কম হতে পারে না।', 'Actual Cash cannot be below zero.'), 'bad'); return; }
    var noteEl = document.getElementById('closingNote');
    var note = noteEl.value.trim();
    var m = metrics(day);
    var expense = expenseValue();
    if (expense > m.expectedCash) {
      UI.toast(tx('দিনের খরচ প্রত্যাশিত ক্যাশের চেয়ে বেশি হতে পারে না।', 'Day expense cannot exceed Expected Cash.'), 'bad');
      document.getElementById('closingExpense').focus(); return;
    }
    var adjusted = DB.round2(m.expectedCash - expense);
    var diff = DB.round2(actual - adjusted);
    if ((expense > 0 || Math.abs(diff) >= 0.01) && !note) {
      UI.toast(tx('খরচ বা হিসাব না মিললে সমাপনী নোট লিখুন।', 'Add a closing note for an expense or cash mismatch.'), 'bad');
      noteEl.focus(); return;
    }
    DB.saveDayClosing(day, {
      invoiceCount: m.invoiceCount,
      salesTotal: m.salesTotal,
      collectionCount: m.collectionCount,
      expectedCash: m.expectedCash,
      dayExpense: expense,
      adjustedExpectedCash: adjusted,
      actualCash: actual,
      newInvoiceCollected: m.newInvoiceCollected,
      oldInvoiceCollected: m.oldInvoiceCollected,
      invoiceDueAtClose: m.invoiceDueAtClose,
      note: note
    });
    render(true);
    UI.toast(tx('দিনের হিসাব সেভ হয়েছে', 'Day Closing saved') + ' · ' + F.d(day) + ' · ' + diffText(diff), Math.abs(diff) < 0.01 ? 'ok' : 'warn', 6500);
  }

  function bind() {
    if (wired) return;
    wired = true;
    var day = document.getElementById('closingDay');
    if (day) day.onchange = function () { render(true); };
    var today = document.getElementById('closingTodayBtn');
    if (today) today.onclick = function () { document.getElementById('closingDay').value = F.today(); render(true); };
    var expense = document.getElementById('closingExpense');
    if (expense) expense.oninput = function () { renderBreakdown(activeMetrics || metrics(dayValue())); renderDifference(); };
    var actual = document.getElementById('closingActualCash');
    if (actual) actual.oninput = renderDifference;
    var save = document.getElementById('saveClosingBtn');
    if (save) save.onclick = saveClosing;
  }

  return { render: render, bind: bind, metrics: metrics };
})();
