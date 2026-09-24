/* ================= reports.js — sales + profit reports (owner only) ================= */
var Reports = (function () {

  function en() { return !!(window.Lang && Lang.isEn && Lang.isEn()); }
  function tx(bn, english) { return en() ? english : bn; }
  function invoiceCount(n) {
    if (!en()) return n + ' টি ইনভয়েস';
    return n + (n === 1 ? ' invoice' : ' invoices');
  }
  /* টাকার অঙ্ক কথায় — মাউস রাখলে দেখায় */
  function moneyWords(v) { return (en() ? F.wordsMoney(v) : F.wordsMoneyBn(v)).replace(/\s*(মাত্র|only)$/, ''); }
  function pcCount(n) { return F.qty(n) + (en() ? ' pc' : ' পিস'); }

  var appliedRange = null;
  var topCustomerSort = 'amount';
  var productSort = 'rev';

  /* স্টক মূল্য — ব্যবসার গোপন হিসাব, তাই ড্যাশবোর্ডে নয়, শুধু মালিকের রিপোর্টে।
     টাইপ অনুযায়ী মোট পরিমাণ (যেমন টায়ার ৪০০ পিস · রশি ৩০০ কেজি) ও ক্রয়মূল্যে স্টকের দাম। */
  function renderStockValue() {
    var table = document.getElementById('repStock');
    if (!table) return;
    var list = Stock.typeSummary();
    var totalEl = document.getElementById('repStockTotal');
    if (totalEl) { totalEl.textContent = tx('মোট', 'Total') + ': ' + F.money(DB.stockValue()); totalEl.title = moneyWords(DB.stockValue()); totalEl.classList.add('money-words'); }
    table.innerHTML =
      '<thead><tr><th>' + tx('পণ্যের ধরন', 'Product type') + '</th><th class="num">' + tx('পণ্য', 'Products') + '</th><th>' + tx('মোট পরিমাণ', 'Total quantity') + '</th><th class="num">' + tx('ক্রয়মূল্য', 'Value at cost') + '</th></tr></thead><tbody>' +
      (list.length ? list.map(function (g) {
        return '<tr><td><b>' + F.esc(Stock.typeLabel(g.type)) + '</b></td>' +
          '<td class="num">' + g.count + '</td>' +
          '<td class="detail-stock-total">' + Stock.unitTotalsHtml(g) + '</td>' +
          '<td class="num">' + F.money(g.value) + '</td></tr>';
      }).join('') + '<tr class="total-row"><td colspan="3">' + tx('মোট স্টক মূল্য', 'Total stock value') + '</td><td class="num money-words" title="' + F.esc(moneyWords(DB.stockValue())) + '">' + F.money(DB.stockValue()) + '</td></tr>'
        : '<tr class="empty-row"><td colspan="4">' + tx('এখনো কোনো স্টক নেই।', 'No stock yet.') + '</td></tr>') +
      '</tbody>';
  }

  /* ইন্টার‌্যাক্টিভ বিক্রির চার্ট: ১ / ৭ / ১৪ / ৩০ দিন (আজ থেকে পিছনে — রিপোর্টের from/to রেঞ্জ থেকে আলাদা,
     এটা শুধু একটা ট্রেন্ড দেখার চার্ট, কোনো টোটাল নয়, তাই রেঞ্জ-ভিত্তিক হিসাবের সাথে দ্বন্দ্ব হয় না)। */
  function renderSalesChart(dayCount) {
    var today = F.today();
    var sales = DB.state.sales;
    dayCount = [1, 7, 14, 30].indexOf(Number(dayCount)) >= 0 ? Number(dayCount) : 30;
    var rangeSel = document.getElementById('anaChartRange');
    if (rangeSel) rangeSel.value = String(dayCount);
    var titleEl = document.getElementById('anaChartTitle');
    if (titleEl) titleEl.textContent = dayCount === 30 ? tx('বিক্রি — শেষ ১ মাস', 'Sales — last 1 month') : tx('বিক্রি — শেষ ' + dayCount + ' দিন', 'Sales — last ' + dayCount + ' days');

    var days = [];
    for (var ci = dayCount - 1; ci >= 0; ci--) days.push(F.addDays(today, -ci));
    var perDay = days.map(function (dd) {
      var list = sales.filter(function (s) { return DB.todayStr(s.date) === dd; });
      return {
        day: dd,
        sales: list.reduce(function (a, s) { return a + F.num(s.total); }, 0),
        profit: list.reduce(function (a, s) { return a + F.num(s.profit); }, 0),
        pcs: list.reduce(function (a, s) { return a + (s.items || []).reduce(function (x, i) { return x + F.num(i.qty); }, 0); }, 0),
        count: list.length
      };
    });
    var max = Math.max.apply(null, perDay.map(function (x) { return x.sales; }).concat([1]));
    var chart = document.getElementById('dashChart');
    var info = document.getElementById('dashChartInfo');
    if (!chart) return;
    chart.className = 'chart interactive-chart chart-range-' + dayCount;
    chart.innerHTML = perDay.map(function (x) {
      var hS = Math.max(2, Math.round(x.sales / max * 150));
      var lbl = x.day.slice(8) + '/' + x.day.slice(5, 7);
      return '<div class="bar-group chart-day" tabindex="0" role="button" data-chart-day="' + x.day + '"' +
        ' data-sales="' + F.num(x.sales) + '" data-profit="' + F.num(x.profit) + '" data-pcs="' + F.num(x.pcs) + '" data-count="' + x.count + '">' +
        '<div class="bars"><div class="bar" style="height:' + hS + 'px"></div></div>' +
        '<div class="bar-label">' + lbl + '</div></div>';
    }).join('');

    /* হোভার করলে কার্ডের উচ্চতা যেন না বদলায়, তাই info বক্স হাইড না করে সবসময়
       শেষ দিনের হিসাব দেখানো থাকে (ক্লিক করলে সেই দিনে পিন হয়ে থাকে)। */
    var selected = null;
    function showInfo(el, pin) {
      if (!el || !info) return;
      if (pin) {
        selected = el;
        chart.querySelectorAll('.chart-day.selected').forEach(function (x) { x.classList.remove('selected'); });
        el.classList.add('selected');
      }
      info.hidden = false;
      info.innerHTML = '<b>' + F.esc(F.d(el.getAttribute('data-chart-day'))) + '</b>' +
        '<span>' + tx('বিক্রয়মূল্য', 'Sales') + ' <b>' + F.money(el.getAttribute('data-sales')) + '</b></span>' +
        '<span>' + tx('পরিমাণ', 'Qty') + ' <b>' + pcCount(el.getAttribute('data-pcs')) + '</b></span>' +
        '<span>' + tx('ইনভয়েস', 'Invoices') + ' <b>' + el.getAttribute('data-count') + '</b></span>' +
        '<span class="owner-only">' + tx('লাভ', 'Profit') + ' <b>' + F.money(el.getAttribute('data-profit')) + '</b></span>';
    }
    var lastDayEl = null;
    function leaveInfo() {
      if (!info) return;
      showInfo(selected || lastDayEl, false);
    }
    chart.querySelectorAll('.chart-day').forEach(function (el) {
      lastDayEl = el;
      el.onmouseenter = function () { showInfo(el, false); };
      el.onmouseleave = leaveInfo;
      el.onclick = function () { showInfo(el, true); };
      el.onkeydown = function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); showInfo(el, true); }
      };
    });
    selected = null;
    if (lastDayEl) showInfo(lastDayEl, false);
  }

  function oneMonthAgo() {
    var t = F.today();
    var x = new Date(t + 'T00:00:00');
    var day = x.getDate();
    x.setDate(1);
    x.setMonth(x.getMonth() - 1);
    var last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(day, last));
    return DB.todayStr(x);
  }

  function defaultRange() {
    return { from: oneMonthAgo(), to: F.today() };
  }

  function ensureRange() {
    if (!appliedRange) appliedRange = defaultRange();
    var from = document.getElementById('repFrom');
    var to = document.getElementById('repTo');
    if (from && !from.value) from.value = appliedRange.from;
    if (to && !to.value) to.value = appliedRange.to;
  }

  function range() {
    if (!appliedRange) appliedRange = defaultRange();
    return { from: appliedRange.from, to: appliedRange.to };
  }

  function setRange(from, to) {
    document.getElementById('repFrom').value = from;
    document.getElementById('repTo').value = to;
    appliedRange = { from: from, to: to };
    render();
  }

  function applyRange() {
    var from = document.getElementById('repFrom').value || oneMonthAgo();
    var to = document.getElementById('repTo').value || F.today();
    if (from > to) {
      var tmp = from; from = to; to = tmp;
      document.getElementById('repFrom').value = from;
      document.getElementById('repTo').value = to;
    }
    appliedRange = { from: from, to: to };
    render();
  }

  function renderTopCustomers(sales) {
    var sortEl = document.getElementById('repCustomerSort');
    if (sortEl && sortEl.value) topCustomerSort = sortEl.value;
    if (topCustomerSort !== 'qty') topCustomerSort = 'amount';

    var byCustomer = {};
    (sales || []).forEach(function (s) {
      var cust = s.customerId ? DB.customerById(s.customerId) : null;
      var bnName = (cust && (cust.nameBn || cust.name)) || s.customerNameBn || s.customerName || '';
      var enName = (cust && cust.name) || s.customerName || '';
      var phone = (cust && cust.phone) || s.customerPhone || '';
      var shownName = (window.Lang && Lang.showName) ? Lang.showName(bnName, enName) : (bnName || enName);
      var walkIn = /^(ওয়াক-ইন(?: কাস্টমার)?|walk-?in(?: customer)?)$/i.test(String(shownName || '').trim());
      if (!s.customerId && !phone && (!shownName || walkIn)) return;

      var phoneKey = String(phone || '').replace(/[^0-9০-৯]/g, '');
      var key = s.customerId ? ('id:' + s.customerId) : (phoneKey ? ('ph:' + phoneKey) : ('nm:' + String(shownName).trim().toLowerCase()));
      if (!byCustomer[key]) {
        byCustomer[key] = { name: shownName || tx('নাম নেই', 'No name'), phone: phone || '', invoices: 0, qty: 0, amount: 0 };
      }
      var x = byCustomer[key];
      x.invoices += 1;
      x.amount += F.num(s.total);
      x.qty += (s.items || []).reduce(function (sum, i) { return sum + F.num(i.qty); }, 0);
      if (!x.phone && phone) x.phone = phone;
      if (shownName) x.name = shownName;
    });

    var list = Object.keys(byCustomer).map(function (k) { return byCustomer[k]; });
    list.sort(function (a, b) {
      if (topCustomerSort === 'qty') {
        if (b.qty !== a.qty) return b.qty - a.qty;
        if (b.amount !== a.amount) return b.amount - a.amount;
      } else {
        if (b.amount !== a.amount) return b.amount - a.amount;
        if (b.qty !== a.qty) return b.qty - a.qty;
      }
      return String(a.name).localeCompare(String(b.name));
    });
    list = list.slice(0, 10);

    var title = document.getElementById('repTopCustomersTitle');
    if (title) title.textContent = tx('শীর্ষ ১০ কাস্টমার', 'Top 10 customers');
    if (sortEl) {
      sortEl.innerHTML =
        '<option value="amount">' + tx('বেশি টাকা', 'Highest spend') + '</option>' +
        '<option value="qty">' + tx('বেশি পণ্য', 'Most products') + '</option>';
      sortEl.value = topCustomerSort;
      sortEl.setAttribute('aria-label', tx('কাস্টমার সাজান', 'Sort customers'));
    }

    var table = document.getElementById('repTopCustomers');
    if (!table) return;
    table.innerHTML =
      '<thead><tr><th>' + tx('কাস্টমার', 'Customer') + '</th><th class="num">' + tx('ইনভয়েস', 'Invoices') + '</th><th class="num">' + tx('মোট পিস', 'Total pcs') + '</th><th class="num">' + tx('মোট কেনা', 'Total bought') + '</th></tr></thead><tbody>' +
      (list.length ? list.map(function (c) {
        return '<tr><td><div class="cell-main"><b>' + F.esc(c.name) + '</b></div>' +
          (c.phone ? '<div class="cell-sub mono">' + F.esc(c.phone) + '</div>' : '') + '</td>' +
          '<td class="num">' + c.invoices + '</td>' +
          '<td class="num">' + F.qty(c.qty) + '</td>' +
          '<td class="num"><b>' + F.money(c.amount) + '</b></td></tr>';
      }).join('') : UI.emptyRow(4, tx('কোনো তথ্য নেই।', 'No data yet.'))) + '</tbody>';
  }

  function render() {
    var r = range();
    var sales = DB.salesInRange(r.from, r.to);

    renderStockValue();
    var chartRange = document.getElementById('anaChartRange');
    renderSalesChart(chartRange && chartRange.value ? Number(chartRange.value) : 30);

    var totSales = sales.reduce(function (a, s) { return a + F.num(s.total); }, 0);
    var totCost = sales.reduce(function (a, s) { return a + F.num(s.cost); }, 0);
    var totProfit = sales.reduce(function (a, s) { return a + F.num(s.profit); }, 0);
    var totDiscount = sales.reduce(function (a, s) { return a + F.num(s.discount); }, 0);
    var pcs = sales.reduce(function (a, s) { return a + s.items.reduce(function (x, i) { return x + F.num(i.qty); }, 0); }, 0);

    document.getElementById('repKpis').innerHTML =
      kpi('blue', tx('বিক্রি', 'Sales'), F.money(totSales), invoiceCount(sales.length) + ' · ' + pcCount(pcs)) +
      kpi('slate', tx('বিক্রি হওয়া মালের ক্রয়মূল্য', 'Cost of goods sold'), F.money(totCost), '') +
      kpi('green', tx('মোট লাভ', 'Total profit'), F.money(totProfit), totSales > 0 ? (totProfit / totSales * 100).toFixed(1) + tx('% বিক্রির উপর', '% of sales') : '') +
      kpi('', tx('দেওয়া ছাড়', 'Discount given'), F.money(totDiscount), '');

    /* ---- by product ---- */
    var byProd = {};
    sales.forEach(function (s) {
      s.items.forEach(function (i) {
        var k = i.productId || ('x:' + i.name);
        if (!byProd[k]) byProd[k] = { name: i.name, qty: 0, rev: 0, cost: 0, profit: 0 };
        byProd[k].qty += F.num(i.qty);
        byProd[k].rev += DB.itemNetRevenue(s, i);
        byProd[k].cost += F.num(i.qty) * F.num(i.cost);
        byProd[k].profit += DB.itemNetProfit(s, i);
      });
    });
    var prodList = Object.keys(byProd).map(function (k) { return byProd[k]; });

    var prodSortEl = document.getElementById('repProductSort');
    if (prodSortEl && prodSortEl.value) productSort = prodSortEl.value;
    if (productSort !== 'profit' && productSort !== 'qty') productSort = 'rev';
    var prodSortFn = productSort === 'profit' ? function (a, b) { return b.profit - a.profit; }
      : productSort === 'qty' ? function (a, b) { return b.qty - a.qty; }
      : function (a, b) { return b.rev - a.rev; };

    document.getElementById('repByProduct').innerHTML =
      '<thead><tr><th>' + tx('পণ্য', 'Product') + '</th><th class="num">' + tx('পরিমাণ', 'Quantity') + '</th><th class="num">' + tx('বিক্রয়মূল্য', 'Sales value') + '</th><th class="num">' + tx('ক্রয়মূল্য', 'Buy price') + '</th><th class="num">' + tx('লাভ', 'Profit') + '</th><th class="num">' + tx('লাভ %', 'Profit %') + '</th></tr></thead><tbody>' +
      (prodList.length ? prodList.sort(prodSortFn).map(function (p) {
        return '<tr><td>' + F.esc(p.name) + '</td><td class="num">' + F.qty(p.qty) + '</td><td class="num">' + F.money(p.rev) + '</td>' +
          '<td class="num">' + F.money(p.cost) + '</td><td class="num"><b>' + F.money(p.profit) + '</b></td>' +
          '<td class="num">' + (p.rev > 0 ? (p.profit / p.rev * 100).toFixed(0) + '%' : '') + '</td></tr>';
      }).join('') : '') +
      '</tbody>';
    if (prodSortEl) prodSortEl.value = productSort;

    renderTopCustomers(sales);

    /* ---- by day ---- */
    var byDay = {};
    sales.forEach(function (s) {
      var dd = DB.todayStr(s.date);
      if (!byDay[dd]) byDay[dd] = { sales: 0, cost: 0, profit: 0, count: 0, pcs: 0 };
      byDay[dd].sales += F.num(s.total); byDay[dd].cost += F.num(s.cost); byDay[dd].profit += F.num(s.profit);
      byDay[dd].count++;
      byDay[dd].pcs += s.items.reduce(function (x, i) { return x + F.num(i.qty); }, 0);
    });
    var dayKeys = Object.keys(byDay).sort(function (a, b) { return a < b ? 1 : -1; });
    document.getElementById('repDaily').innerHTML =
      '<thead><tr><th>' + tx('তারিখ', 'Date') + '</th><th class="num">' + tx('ইনভয়েস', 'Invoice') + '</th><th class="num">' + tx('পিস', 'pcs') + '</th><th class="num">' + tx('বিক্রি', 'Sales') + '</th><th class="num">' + tx('ক্রয়মূল্য', 'Buy price') + '</th><th class="num">' + tx('লাভ', 'Profit') + '</th><th></th></tr></thead><tbody>' +
      (dayKeys.length ? dayKeys.map(function (k) {
        var x = byDay[k];
        return '<tr><td><b>' + F.relDay(k) + '</b></td><td class="num">' + x.count + '</td><td class="num">' + F.qty(x.pcs) + '</td>' +
          '<td class="num">' + F.money(x.sales) + '</td><td class="num">' + F.money(x.cost) + '</td>' +
          '<td class="num"><b>' + F.money(x.profit) + '</b></td>' +
          '<td><button class="link-btn" data-day="' + k + '">' + tx('দেখুন', 'View') + '</button></td></tr>';
      }).join('') : '') + '</tbody>';

    document.querySelectorAll('#repDaily [data-day]').forEach(function (b) {
      b.onclick = function () {
        var dd = b.getAttribute('data-day');
        document.getElementById('salesSearch').value = '';
        document.getElementById('salesDay').value = dd;
        App.show('sales');
      };
    });


    function kpi(cls, label, value, sub) {
      return '<div class="kpi ' + cls + '"><span class="kpi-label">' + label + '</span><span class="kpi-value">' + value + '</span><span class="kpi-sub">' + sub + '</span></div>';
    }
  }

  function reportPrintHtml() {
    var r = range();
    var sales = DB.salesInRange(r.from, r.to);
    var totSales = sales.reduce(function (a, x) { return a + F.num(x.total); }, 0);
    var totCost = sales.reduce(function (a, x) { return a + F.num(x.cost); }, 0);
    var totProfit = sales.reduce(function (a, x) { return a + F.num(x.profit); }, 0);
    var totDiscount = sales.reduce(function (a, x) { return a + F.num(x.discount); }, 0);
    var pcs = sales.reduce(function (a, x) { return a + (x.items || []).reduce(function (q, i) { return q + F.num(i.qty); }, 0); }, 0);
    var shop = (DB.state.settings && DB.state.settings.shopName) || 'Shoeb Motors & Tyre House';
    var shopBn = (DB.state.settings && DB.state.settings.shopNameBn) || '';

    var byDay = {};
    var byProd = {};
    sales.forEach(function (x) {
      var d = DB.todayStr(x.date);
      if (!byDay[d]) byDay[d] = {count:0, pcs:0, sales:0, cost:0, profit:0};
      byDay[d].count++; byDay[d].sales += F.num(x.total); byDay[d].cost += F.num(x.cost); byDay[d].profit += F.num(x.profit);
      (x.items || []).forEach(function (i) {
        byDay[d].pcs += F.num(i.qty);
        var k = i.productId || ('x:' + i.name);
        if (!byProd[k]) byProd[k] = {name:i.name || '—', qty:0, sales:0, cost:0, profit:0};
        byProd[k].qty += F.num(i.qty); byProd[k].sales += DB.itemNetRevenue(x, i); byProd[k].cost += F.num(i.qty) * F.num(i.cost); byProd[k].profit += DB.itemNetProfit(x, i);
      });
    });
    var days = Object.keys(byDay).sort();
    var products = Object.keys(byProd).map(function(k){ return byProd[k]; }).sort(function(a,b){ return b.sales-a.sales; });
    var dayRows = days.map(function(d){ var x=byDay[d]; return '<tr><td>'+F.esc(F.d(d))+'</td><td class="num">'+x.count+'</td><td class="num">'+F.qty(x.pcs)+'</td><td class="num">'+F.money(x.sales)+'</td><td class="num">'+F.money(x.cost)+'</td><td class="num">'+F.money(x.profit)+'</td></tr>'; }).join('');
    var prodRows = products.map(function(p){ return '<tr><td>'+F.esc(p.name)+'</td><td class="num">'+F.qty(p.qty)+'</td><td class="num">'+F.money(p.sales)+'</td><td class="num">'+F.money(p.cost)+'</td><td class="num">'+F.money(p.profit)+'</td></tr>'; }).join('');

    return '<div class="report-print">' +
      '<div class="report-print-head"><img src="img/logo-print.jpg" alt=""><div><h1>'+F.esc(shop)+'</h1>'+(shopBn?'<div class="bn">'+F.esc(shopBn)+'</div>':'')+'<h2>'+tx('মাসিক / সময়সীমার রিপোর্ট','Monthly / Period Report')+'</h2></div></div>' +
      '<div class="report-period">'+tx('সময়','Period')+': <b>'+F.esc(F.d(r.from))+'</b> - <b>'+F.esc(F.d(r.to))+'</b></div>' +
      '<table class="report-summary"><tbody>' +
        '<tr><td>'+tx('ইনভয়েস','Invoices')+'</td><td class="num">'+sales.length+'</td><td>'+tx('বিক্রি','Sales')+'</td><td class="num">'+F.money(totSales)+'</td></tr>' +
        '<tr><td>'+tx('মোট পিস','Total pcs')+'</td><td class="num">'+F.qty(pcs)+'</td><td>'+tx('ক্রয়মূল্য','Cost')+'</td><td class="num">'+F.money(totCost)+'</td></tr>' +
        '<tr><td>'+tx('দেওয়া ছাড়','Discount')+'</td><td class="num">'+F.money(totDiscount)+'</td><td><b>'+tx('মোট লাভ','Total profit')+'</b></td><td class="num"><b>'+F.money(totProfit)+'</b></td></tr>' +
      '</tbody></table>' +
      '<h3>'+tx('দিন অনুযায়ী','By day')+'</h3><table><thead><tr><th>'+tx('তারিখ','Date')+'</th><th class="num">'+tx('ইনভয়েস','Invoices')+'</th><th class="num">'+tx('পিস','pcs')+'</th><th class="num">'+tx('বিক্রি','Sales')+'</th><th class="num">'+tx('ক্রয়মূল্য','Cost')+'</th><th class="num">'+tx('লাভ','Profit')+'</th></tr></thead><tbody>'+(dayRows || '')+'</tbody></table>' +
      '<h3>'+tx('পণ্য অনুযায়ী','By product')+'</h3><table><thead><tr><th>'+tx('পণ্য','Product')+'</th><th class="num">'+tx('পরিমাণ','Quantity')+'</th><th class="num">'+tx('বিক্রয়মূল্য','Sales value')+'</th><th class="num">'+tx('ক্রয়মূল্য','Cost')+'</th><th class="num">'+tx('লাভ','Profit')+'</th></tr></thead><tbody>'+(prodRows || '')+'</tbody></table>' +
      '<div class="report-print-foot">'+tx('তৈরি হয়েছে','Generated')+': '+F.esc(new Date().toLocaleString(en()?'en-GB':'bn-BD'))+'</div>' +
      '</div>';
  }

  function printReport() { UI.printHtml(reportPrintHtml(), 'a4'); }
  function downloadReportPdf() {
    var r = range();
    return UI.downloadPdf(reportPrintHtml(), 'Shoeb-Motors-Report-' + r.from + '-to-' + r.to, 'a4');
  }

  function bind() {
    ensureRange();
    var apply = document.getElementById('repApplyBtn');
    if (apply) apply.onclick = applyRange;

    var quick = document.getElementById('repQuickRange');
    if (quick) quick.onchange = function () {
      var v = quick.value;
      if (!v) return;
      if (v === 'today') setRange(F.today(), F.today());
      else if (v === 'week') setRange(F.addDays(F.today(), -6), F.today());
      else if (v === 'month') setRange(F.startOfMonth(), F.today());
      else if (v === 'year') setRange(F.startOfYear(), F.today());
      quick.value = '';
    };

    var customerSort = document.getElementById('repCustomerSort');
    if (customerSort) customerSort.onchange = function () {
      topCustomerSort = customerSort.value === 'qty' ? 'qty' : 'amount';
      render();
    };

    var productSortEl = document.getElementById('repProductSort');
    if (productSortEl) productSortEl.onchange = function () {
      productSort = (productSortEl.value === 'profit' || productSortEl.value === 'qty') ? productSortEl.value : 'rev';
      render();
    };

    var p = document.getElementById('repPrintBtn'); if (p) p.onclick = printReport;
    var d = document.getElementById('repPdfBtn'); if (d) d.onclick = downloadReportPdf;

    var chartRange = document.getElementById('anaChartRange');
    if (chartRange) chartRange.onchange = function () { renderSalesChart(Number(chartRange.value)); };
  }

  return { render: render, bind: bind, setRange: setRange, range: range, reportPrintHtml: reportPrintHtml, printReport: printReport, downloadReportPdf: downloadReportPdf };
})();
