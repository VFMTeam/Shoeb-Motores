/* ================= due.js — customer-wise Due list (LOCAL ONLY) ================= */
var DueList = (function () {
  var wired = false;

  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function saleName(s) { return (window.Lang && Lang.showName) ? (Lang.showName(s.customerNameBn || s.customerName, s.customerName) || 'ওয়াক-ইন') : (s.customerNameBn || s.customerName || 'ওয়াক-ইন'); }

  function dateDayNumber(v) {
    var p = String(v || '').slice(0, 10).split('-');
    if (p.length !== 3) return NaN;
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function reminderTimer(dateStr, today) {
    if (!dateStr) return '—';
    var target = dateDayNumber(dateStr), now = dateDayNumber(today);
    if (!isFinite(target) || !isFinite(now)) return F.d(dateStr) || '—';
    var days = Math.round((target - now) / 86400000);
    var label = '';
    if (days > 0) label = '<b>⏳ আর ' + F.bn(days) + ' দিন</b>';
    else if (days === 0) label = '<b class="pend">⏰ আজ</b>';
    else label = '<b class="pend">⏰ ' + F.bn(Math.abs(days)) + ' দিন পার</b>';
    return '<div class="cell-main">' + label + '</div><div class="cell-sub">' + F.d(dateStr) + '</div>';
  }

  function keyFor(s) { return DB.dueKey(s); }

  function rows() {
    var map = {};
    (DB.state.sales || []).forEach(function (s) {
      if (s.collectionTracking !== true) return;
      var pendingPrice = DB.saleHasPending(s);
      var due = pendingPrice ? 0 : DB.trueDue(s);
      if (due <= 0.009 && !pendingPrice) return;
      var k = keyFor(s), c = s.customerId ? DB.customerById(s.customerId) : null;
      if (!map[k]) map[k] = {
        key:k, customerId:s.customerId || '', name:(c && (c.nameBn || c.name)) || saleName(s),
        phone:(c && c.phone) || s.customerPhone || '', address:(c && [c.addressBn, c.address].filter(Boolean).join(', ')) || '', due:0, invoiceCount:0, pendingPriceCount:0,
        latestDate:'', latestInvoice:'', latestSaleId:'', latestReference:null, earliestDate:'', reminderDate:''
      };
      var x=map[k];
      if (!pendingPrice && due > 0.009) { x.due += due; x.invoiceCount++; }
      if (pendingPrice) x.pendingPriceCount++;
      if (!x.earliestDate || new Date(s.date) < new Date(x.earliestDate)) { x.earliestDate = s.date; }
      if (s.dueReminderDate && (due > 0.009 || pendingPrice) && (!x.reminderDate || s.dueReminderDate < x.reminderDate)) {
        x.reminderDate = s.dueReminderDate;
      }
      if (!x.latestDate || new Date(s.date) > new Date(x.latestDate)) {
        x.latestDate=s.date; x.latestInvoice=s.invoiceNo || ''; x.latestSaleId=s.id; x.latestReference=s.reference || null;
      }
    });
    (DB.state.customers || []).forEach(function (c) {
      var amount = DB.openingDue(c.id);
      if (amount <= 0.009) return;
      var k = 'id:' + c.id;
      if (!map[k]) map[k] = { key:k, customerId:c.id, name:c.nameBn || c.name || '',
        phone:c.phone || '', address:[c.addressBn,c.address].filter(Boolean).join(', '), due:0,
        invoiceCount:0, pendingPriceCount:0, latestDate:'', latestInvoice:'', latestSaleId:'',
        latestReference:null, earliestDate:'', reminderDate:'' };
      map[k].due += amount;
      map[k].openingDue = amount;
    });
    return Object.keys(map).map(function (k) { map[k].due=DB.round2(map[k].due); return map[k]; });
  }

  function pay(key) {
    var account = DB.duePaymentAccount(key);
    if (account.total <= 0) { UI.toast('এই হিসাবে নির্ধারিত বকেয়া নেই।', 'warn'); render(); return; }
    var submitted = false;
    UI.modal({ title:'Paid — বকেয়া পরিশোধ',
      body:'<p><b>' + F.esc(account.name) + '</b> · মোট বকেয়া: <b>' + F.money(account.total) + '</b></p>' +
        '<div class="grid2"><label>পেমেন্টের তারিখ<input id="duePayDate" type="date" value="' + F.today() + '"></label>' +
        '<label>জমার পরিমাণ<input id="duePayAmount" inputmode="decimal" autocomplete="off" placeholder="টাকার পরিমাণ"></label></div>' +
        '<button type="button" class="btn small ghost" id="duePayFull">পুরো বকেয়া</button>' +
        '<p class="tiny muted">টাকা প্রথমে আগের বকেয়া, এরপর পুরোনো ইনভয়েসের বাকি থেকে কমবে।</p>' +
        (account.pending ? '<p class="pend">দর অপেক্ষমাণ ইনভয়েস এই টাকার হিসাবে নেই।</p>' : ''),
      buttons:[{label:'বাতিল', cls:'ghost', onClick:UI.closeModal},
        {label:'পেমেন্ট সেভ করুন', cls:'primary', onClick:function () {
          if (submitted) return;
          try {
            var result = DB.payCustomerDue(key, document.getElementById('duePayAmount').value, document.getElementById('duePayDate').value);
          } catch (err) { UI.toast(F.esc(err.message), 'bad'); return; }
          submitted = true;
          UI.closeModal(); render();
          if (!result.saved) { UI.toast('ডেটা সেভ নিশ্চিত হয়নি। আবার Paid চাপবেন না; সেভ স্ট্যাটাস দেখুন।', 'bad', 8000); return; }
          UI.toast('পেমেন্ট সেভ হয়েছে। বকেয়া কমেছে।', 'ok');
          UI.modal({ title:'পেমেন্ট সেভ হয়েছে — রসিদ খুলবেন?',
            body:'<p>জমা: <b>' + F.money(result.receipt.amount) + '</b> · অবশিষ্ট বকেয়া: <b>' + F.money(result.receipt.balanceAfter) + '</b></p>',
            buttons:[{label:'বন্ধ করুন', cls:'ghost', onClick:UI.closeModal},
              {label:'রসিদ খুলুন', cls:'primary', onClick:function () { UI.closeModal(); UI.openCollectionReceipt(result.receipt); }}]
          });
        }}],
      onOpen:function (root) {
        root.querySelector('#duePayFull').onclick=function () { root.querySelector('#duePayAmount').value=DB.duePaymentAccount(key).total; };
        root.querySelector('#duePayAmount').focus();
      }
    });
  }

  function render() {
    var list=rows(), q=norm((document.getElementById('dueSearch') || {}).value), sort=(document.getElementById('dueSort') || {}).value || 'due';
    if (q) list=list.filter(function (x) { return [x.name,x.phone,x.latestInvoice].some(function(v){return norm(v).indexOf(q)>=0;}); });
    list.sort(function(a,b){
      if (sort==='name') return String(a.name||'').localeCompare(String(b.name||''), undefined, {sensitivity:'base'});
      if (sort==='recent') return new Date(b.latestDate||0)-new Date(a.latestDate||0);
      if (sort==='oldest') return new Date(a.earliestDate||0)-new Date(b.earliestDate||0);
      return (b.due-a.due) || (new Date(b.latestDate||0)-new Date(a.latestDate||0));
    });

    var total=list.reduce(function(a,x){return a+F.num(x.due);},0);
    var inv=list.reduce(function(a,x){return a+x.invoiceCount;},0);
    var pending=list.reduce(function(a,x){return a+x.pendingPriceCount;},0);
    var kpi=document.getElementById('dueKpis');
    if (kpi) kpi.innerHTML =
      '<div class="due-kpi"><span>মোট পাওনা</span><b>'+F.money(total)+'</b></div>'+
      '<div class="due-kpi"><span>কাস্টমার</span><b>'+list.filter(function(x){return x.due>0.009;}).length+' জন</b></div>'+
      '<div class="due-kpi"><span>বাকি ইনভয়েস</span><b>'+inv+' টি</b></div>'+
      (pending ? '<div class="due-kpi warn"><span>দর অপেক্ষমাণ</span><b>'+pending+' টি</b></div>' : '');

    var today = F.today();
    var tb=document.querySelector('#dueTable tbody');
    if (!tb) return;
    tb.innerHTML=list.length ? list.map(function(x){
      var pendingTxt=x.pendingPriceCount ? '<div class="cell-sub pend">দর অপেক্ষমাণ '+x.pendingPriceCount+' টি</div>' : '';
      var reminderTxt = reminderTimer(x.reminderDate, today);
      var ref=x.latestReference || null;
      var refTxt=ref && (ref.name || ref.phone || ref.address) ? '<div class="cell-sub">রেফারেন্স: '+F.esc([ref.name,ref.phone,ref.address].filter(Boolean).join(' · '))+'</div>' : '';
      return '<tr>'+
        '<td><div class="cell-main"><b>'+F.esc(x.name||'ওয়াক-ইন')+'</b></div>'+pendingTxt+'</td>'+
        '<td class="mono">'+F.esc(x.phone||'—')+'</td>'+
        '<td>'+F.esc(x.address||'—')+'</td>'+
        '<td class="num">'+x.invoiceCount+' টি</td>'+
        '<td class="num due-money"><b>'+F.money(x.due)+'</b>'+(x.openingDue ? '<div class="cell-sub">আগের বকেয়া: '+F.money(x.openingDue)+'</div>' : '')+'</td>'+
        '<td>'+reminderTxt+'</td>'+
        '<td>'+(x.latestDate ? F.d(x.latestDate) : '—')+(x.latestInvoice?'<div class="cell-sub">'+F.esc(x.latestInvoice)+'</div>':'')+refTxt+'</td>'+
        '<td><div class="row-actions due-row-actions">'+
          (x.due > 0.009 ? '<button class="btn small primary" data-pay-due="'+F.esc(x.key)+'">টাকা জমা</button>' : '')+
          (x.customerId ? '<button class="btn small ghost" data-customer="'+F.esc(x.customerId)+'">কাস্টমার</button>' :
            ((x.invoiceCount || x.pendingPriceCount) ? '<button class="btn small ghost" data-dueinv="'+F.esc(x.key)+'" data-phone="'+F.esc(x.phone)+'" data-name="'+F.esc(x.name)+'">বাকি ইনভয়েস</button>' : ''))+
        '</div></td></tr>';
    }).join('') : UI.emptyRow(8, 'কোনো বাকি হিসাব নেই।');

    tb.querySelectorAll('[data-pay-due]').forEach(function (b) { b.onclick=function () { pay(b.getAttribute('data-pay-due')); }; });
    tb.querySelectorAll('[data-customer]').forEach(function(b){ b.onclick=function(){ Customers.open(b.getAttribute('data-customer')); }; });
    tb.querySelectorAll('[data-dueinv]').forEach(function(b){ b.onclick=function(){
      var scope=document.getElementById('collectionScope'), search=document.getElementById('collectionSearch');
      if (scope) scope.value='due';
      if (search) search.value=b.getAttribute('data-phone') || b.getAttribute('data-name') || '';
      App.show('collections');
    }; });
    if (window.Lang) Lang.apply();
  }

  function bind() {
    if (wired) return; wired=true;
    var s=document.getElementById('dueSearch'); if (s) s.oninput=UI.debounce(render,160);
    var sort=document.getElementById('dueSort'); if (sort) sort.onchange=render;
    var c=document.getElementById('dueOpenCollections'); if (c) c.onclick=function(){ var sc=document.getElementById('collectionScope'); if(sc) sc.value='due'; App.show('collections'); };
  }
  return {render:render, bind:bind, pay:pay};
})();
