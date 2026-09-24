/* ================= dashboard.js — সংক্ষিপ্ত ড্যাশবোর্ড (হোম) ================= */
var Dashboard = (function () {

  /* ---------------- ছোট সহায়ক ---------------- */
  function sum(list, fn) { return list.reduce(function (a, x) { return a + F.num(fn(x)); }, 0); }
  function invCount(list) { return list.length; }
  function pcs(list) {
    return sum(list, function (s) { return (s.items || []).reduce(function (x, i) { return x + F.num(i.qty); }, 0); });
  }
  function monthRange() { return { from: F.startOfMonth(), to: F.today() }; }
  function moneyWords(v) {
    var en = (window.Lang && typeof Lang.isEn === 'function') ? Lang.isEn() : !!(DB.state && DB.state.settings && DB.state.settings.lang === 'en');
    return en ? F.wordsMoney(v) : F.wordsMoneyBn(v);
  }
  function setDashboardMoney(id, v) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = F.money(v);
    el.title = moneyWords(v);
  }
  function moneyWithHover(v) {
    return '<span title="' + F.esc(moneyWords(v)) + '">' + F.money(v) + '</span>';
  }

  function render() {
    var today = F.today();
    var sales = DB.state.sales;

    /* --- আজ --- */
    var todayList = sales.filter(function (s) { return DB.todayStr(s.date) === today; });
    var tSales = sum(todayList, function (s) { return s.total; });
    var tProfit = sum(todayList, function (s) { return s.profit; });

    setDashboardMoney('kpiTodaySales', tSales);
    document.getElementById('kpiTodayCount').textContent = todayList.length + ' টি ইনভয়েস · ' + F.qty(pcs(todayList)) + ' পিস';

    /* --- আজকের cash collection status --- */
    var todayCollections = DB.collectionsInRange(today, today);
    var todayCash = sum(todayCollections, function (r) { return r.amount; });
    var finalToday = todayList.filter(function (s) { return s.collectionTracking === true && !DB.saleHasPending(s); });
    var fullyCollected = finalToday.filter(function (s) { return F.num(s.due) <= 0.009; }).length;
    var openCollected = finalToday.filter(function (s) { return F.num(s.due) > 0.009; }).length;
    var pendingPriceCount = todayList.filter(function (s) { return DB.saleHasPending(s); }).length;
    setDashboardMoney('kpiTodayCash', todayCash);
    var pc = document.getElementById('kpiPaidCount'); if (pc) pc.textContent = fullyCollected + ' টি';
    var oc = document.getElementById('kpiOpenCount'); if (oc) oc.textContent = openCollected + ' টি';
    var pp = document.getElementById('kpiPendingPrice'); if (pp) pp.textContent = pendingPriceCount + ' টি';


    /* --- স্টক কম --- */
    var low = DB.lowStockList();
    document.getElementById('kpiLow').textContent = low.length;
    document.getElementById('kpiLowSub').textContent = low.length ? 'পণ্য শেষ হয়ে যাচ্ছে — যোগ করুন' : 'সব পণ্যের স্টক ঠিক আছে';

    /* --- চোখে পড়ার মতো Low Stock warning --- */
    var lowBanner = document.getElementById('lowStockBanner');
    if (lowBanner) {
      if (low.length) {
        var lowNames = low.slice().sort(function (a, b) { return F.num(a.qty) - F.num(b.qty); }).slice(0, 5).map(function (p) {
          return F.esc(Stock.label(p)) + ' — ' + F.qty(p.qty) + ' ' + F.esc(p.unit || 'পিস');
        }).join(' · ');
        lowBanner.hidden = false;
        lowBanner.innerHTML = '<div><b>⚠ কম স্টক: ' + low.length + ' টি পণ্য</b><span>' + lowNames + (low.length > 5 ? ' · আরও ' + (low.length - 5) + ' টি' : '') + '</span></div>' +
          '<button class="btn small" id="lowStockOpenBtn">স্টক দেখুন →</button>';
        var lowBtn = document.getElementById('lowStockOpenBtn');
        if (lowBtn) lowBtn.onclick = function () { App.show('stock'); var c = document.getElementById('stockLowOnly'); if (c) { c.checked = true; Stock.render(); } };
      } else {
        lowBanner.hidden = true;
        lowBanner.innerHTML = '';
      }
    }

    /* --- বাকি রিমাইন্ডার (আজ অথবা তারিখ পার হয়ে যাওয়া) --- */
    var reminders = DB.dueReminderList();
    var remMap = {};
    reminders.forEach(function (s) {
      var phoneKey = String(s.customerPhone || '').replace(/\D+/g, '');
      var key = s.customerId ? ('id:' + s.customerId) : (phoneKey ? ('ph:' + phoneKey) : ('nm:' + (s.customerNameBn || s.customerName || '')));
      if (!remMap[key]) remMap[key] = { name: (s.customerNameBn || s.customerName || 'ওয়াক-ইন কাস্টমার'), phone: s.customerPhone || '', due: 0, date: s.dueReminderDate };
      remMap[key].due += DB.trueDue(s);
      if (s.dueReminderDate < remMap[key].date) remMap[key].date = s.dueReminderDate;
    });
    var remList = Object.keys(remMap).map(function (k) { remMap[k].due = DB.round2(remMap[k].due); return remMap[k]; })
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });

    var kd = document.getElementById('kpiDueReminder'); if (kd) kd.textContent = remList.length;
    var kds = document.getElementById('kpiDueReminderSub'); if (kds) kds.textContent = remList.length ? 'মেয়াদ পার হওয়া বাকি — টাকা তুলুন' : 'কোনো বাকি রিমাইন্ডার নেই';

    var dueBanner = document.getElementById('dueReminderBanner');
    if (dueBanner) {
      if (remList.length) {
        var remNames = remList.slice(0, 5).map(function (x) {
          return F.esc(x.name) + (x.phone ? ' (' + F.esc(x.phone) + ')' : '') + ' — ' + moneyWithHover(x.due);
        }).join(' · ');
        dueBanner.hidden = false;
        dueBanner.innerHTML = '<div><b>⚠ বাকি রিমাইন্ডার: ' + remList.length + ' জন</b><span>' + remNames + (remList.length > 5 ? ' · আরও ' + (remList.length - 5) + ' জন' : '') + '</span></div>' +
          '<button class="btn small" id="dueReminderOpenBtn">বাকি তালিকা দেখুন →</button>';
        var dueBtn = document.getElementById('dueReminderOpenBtn');
        if (dueBtn) dueBtn.onclick = function () { App.show('due'); };
      } else {
        dueBanner.hidden = true;
        dueBanner.innerHTML = '';
      }
    }

    /* --- এই মাসের এক লাইন --- */
    var mr = monthRange();
    var monthList = DB.salesInRange(mr.from, mr.to);
    var mSales = sum(monthList, function (s) { return s.total; });
    /* --- আজকের সংক্ষিপ্ত হিসাব --- */
    document.getElementById('kpiTodayPcs').textContent = F.qty(pcs(todayList)) + ' পিস';
    setDashboardMoney('kpiTodayDiscount', sum(todayList, function (s) { return s.discount; }));
    setDashboardMoney('kpiTodayNewDue', sum(finalToday, function (s) { return DB.trueDue(s); }));
    /* আজ নেওয়া টাকার মধ্যে আগের দিনের ইনভয়েস বা আগের বকেয়ার অংশ */
    setDashboardMoney('kpiTodayOldCollected', sum(todayCollections, function (r) {
      if (r.openingBalance) return r.amount;
      var rs = r.saleId && DB.saleById(r.saleId);
      return rs && DB.todayStr(rs.date) < today ? r.amount : 0;
    }));
    document.getElementById('kpiTodayNewCustomers').textContent = DB.state.customers.filter(function (c) { return c.createdAt && DB.todayStr(c.createdAt) === today; }).length + ' জন';
    var itemQty = {};
    todayList.forEach(function (s) { (s.items || []).forEach(function (i) { var k = i.name || ''; if (k) itemQty[k] = F.num(itemQty[k]) + F.num(i.qty); }); });
    var topName = Object.keys(itemQty).sort(function (a, b) { return itemQty[b] - itemQty[a]; })[0];
    var topEl = document.getElementById('kpiTodayTopItem');
    topEl.textContent = topName ? topName + ' ×' + F.qty(itemQty[topName]) : '—';
    topEl.title = topEl.textContent;
    document.getElementById('kpiMonthInv').textContent = monthList.length;
    document.getElementById('kpiMonthInvSub').textContent = F.qty(pcs(monthList)) + ' পিস বিক্রি';

    document.getElementById('dashDate').textContent = F.weekday(today) + ', ' + F.d(today);

    /* --- বিস্তারিত পাতার দরজা (tiles) --- */
    var stockQty = sum(DB.state.products, function (p) { return p.qty; });
    var tiles = [
      {
        jump: 'reports', cls: 't-red', label: 'রিপোর্ট',
        value: moneyWithHover(mSales), sub: 'দিনভিত্তিক ও পণ্যভিত্তিক বিক্রির হিসাব'
      },
      {
        jump: 'customers', cls: 't-amber', label: 'কাস্টমার',
        value: DB.state.customers.length + ' জন', sub: 'কাস্টমার, মোবাইল ও গাড়ির তথ্য এক জায়গায়'
      },
      {
        jump: 'sales', cls: 't-ink', label: 'বিক্রি ও ইনভয়েস',
        value: invCount(monthList) + ' টি', sub: 'এই মাসের ইনভয়েস — যেকোনো বিল খুলে আবার ছাপতে পারবেন'
      },
      {
        jump: 'stock', cls: 't-slate', label: 'স্টক',
        value: DB.state.products.length + ' ধরনের পণ্য', sub: F.qty(stockQty) + ' পিস' + (low.length ? ' · কম ' + low.length + ' টি' : '')
      },
      {
        jump: 'dayclosing', cls: 't-ink owner-only', label: 'Day Closing',
        value: DB.dayClosingByDate(today) ? '✓ Closed' : ((window.Lang && Lang.isEn()) ? 'Close today' : 'আজ Close করুন'),
        sub: 'Expected Cash ' + moneyWithHover(DayClosing.metrics(today).expectedCash) + ' · ' + ((window.Lang && Lang.isEn()) ? 'reconcile counted cash and finish the day' : 'হাতে গোনা ক্যাশ মিলিয়ে দিন শেষ করুন')
      }
    ];
    var box = document.getElementById('dashTiles');
    box.innerHTML = tiles.map(function (t) {
      return '<button class="tile ' + t.cls + '" data-jump="' + t.jump + '">' +
        '<span class="t-lab">' + t.label + '</span>' +
        '<span class="t-val">' + t.value + '</span>' +
        '<span class="t-sub">' + t.sub + '</span>' +
        '<span class="t-go">খুলুন →</span>' +
        '</button>';
    }).join('');
    wireJumps(box);
  }

  /* ---------------- পাতার লিংক ---------------- */
  function wireJumps(root) {
    (root || document).querySelectorAll('[data-jump]').forEach(function (b) {
      b.onclick = function () { App.show(b.getAttribute('data-jump')); };
    });
  }

  function bind() { wireJumps(document); }

  return { render: render, bind: bind };
})();
