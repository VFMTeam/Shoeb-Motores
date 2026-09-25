/* ================= dashboard.js — সংক্ষিপ্ত ড্যাশবোর্ড (হোম) ================= */
var Dashboard = (function () {

  /* ---------------- ছোট সহায়ক ---------------- */
  function sum(list, fn) { return list.reduce(function (a, x) { return a + F.num(fn(x)); }, 0); }
  function invCount(list) { return list.length; }
  function pcs(list) {
    return sum(list, function (s) { return (s.items || []).reduce(function (x, i) { return x + F.num(i.qty); }, 0); });
  }
  function setDashboardMoney(id, v) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = F.money(v);
  }
  function moneyWithHover(v) { return F.money(v); }

  function render() {
    var today = F.today();
    var sales = DB.state.sales;

    /* --- আজ --- */
    var todayList = sales.filter(function (s) { return DB.todayStr(s.date) === today; });
    var tSales = sum(todayList, function (s) { return s.total; });

    setDashboardMoney('kpiTodaySales', tSales);
    var tsEl = document.getElementById('kpiTodaySales');
    if (tsEl) { tsEl.title = tSales > 0 ? F.moneyWords(tSales) : ''; tsEl.classList.toggle('money-words', tSales > 0); }
    document.getElementById('kpiTodayCount').textContent = F.qty(pcs(todayList)) + ' পিস বিক্রি';

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
    document.getElementById('kpiLowSub').textContent = '';

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
      if (!remMap[key]) remMap[key] = { name: (Lang.custName(s) || 'ওয়াক-ইন কাস্টমার'), phone: s.customerPhone || '', due: 0, date: s.dueReminderDate };
      remMap[key].due += DB.trueDue(s);
      if (s.dueReminderDate < remMap[key].date) remMap[key].date = s.dueReminderDate;
    });
    var remList = Object.keys(remMap).map(function (k) { remMap[k].due = DB.round2(remMap[k].due); return remMap[k]; })
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });


    /* আজকের কার্ড: আজকের বিলে কত বাকি রইল, আর আজ আগের দিনের ইনভয়েস / আগের বকেয়া থেকে কত পেলাম */
    setDashboardMoney('kpiTodayNewDue', sum(finalToday, function (s) { return DB.trueDue(s); }));
    setDashboardMoney('kpiTodayOldCollected', sum(todayCollections, function (r) {
      if (r.openingBalance) return r.amount;
      var rs = r.saleId && DB.saleById(r.saleId);
      return rs && DB.todayStr(rs.date) < today ? r.amount : 0;
    }));

    /* আজকের কার্ড: যাদের টাকা দেওয়ার তারিখ পার হয়েছে, আর সব কাস্টমারের মোট পাওনা */
    var overdueTotal = DB.round2(remList.reduce(function (a, x) { return a + x.due; }, 0));
    var ov = document.getElementById('kpiOverdue');
    if (ov) {
      ov.innerHTML = remList.length ? moneyWithHover(overdueTotal) + ' <small>· ' + remList.length + ' জন</small>' : '০ জন';
      ov.classList.toggle('pend', remList.length > 0);
    }
    setDashboardMoney('kpiTotalReceivable', DB.trackedDueTotal());

    var dueBanner = document.getElementById('dueReminderBanner');
    if (dueBanner) {
      if (remList.length) {
        var remNames = remList.slice(0, 5).map(function (x) {
          return F.esc(x.name) + (x.phone ? ' ' + F.esc(x.phone) : '') + ' — ' + moneyWithHover(x.due);
        }).join(' · ');
        dueBanner.hidden = false;
        var en = window.Lang && Lang.isEn();
        dueBanner.innerHTML = '<div><b>⚠ ' + (en ? 'Due reminder: ' + remList.length + ' customers' : 'বাকি রিমাইন্ডার: ' + remList.length + ' জন') + '</b><span>' + remNames + (remList.length > 5 ? (en ? ' · ' + (remList.length - 5) + ' more' : ' · আরও ' + (remList.length - 5) + ' জন') : '') + '</span></div>' +
          '<button class="btn small" id="dueReminderOpenBtn">বাকি তালিকা দেখুন →</button>';
        var dueBtn = document.getElementById('dueReminderOpenBtn');
        if (dueBtn) dueBtn.onclick = function () { App.show('due'); };
      } else {
        dueBanner.hidden = true;
        dueBanner.innerHTML = '';
      }
    }

    /* --- আজকের ইনভয়েস --- */
    document.getElementById('kpiTodayInv').textContent = todayList.length;

    document.getElementById('dashDate').textContent = F.weekday(today) + ', ' + F.d(today);
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
