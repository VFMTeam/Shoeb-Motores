/* ================= suppliers.js — সাপ্লায়ার: কার কাছ থেকে কত টাকার মাল, কত দিলাম, কত বাকি (owner only) ================= */
var Suppliers = (function () {
  var currentId = null;
  var wired = false;

  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function kpi(cls, label, value) {
    return '<div class="kpi ' + cls + '"><span class="kpi-label">' + label + '</span><span class="kpi-value">' + value + '</span><span class="kpi-sub"></span></div>';
  }
  function dueCell(due) {
    if (due > 0.009) return '<b class="pend">' + F.money(due) + '</b>';
    if (due < -0.009) return '<span class="muted">অগ্রিম ' + F.money(-due) + '</span>';
    return '<span class="muted">পরিশোধিত</span>';
  }

  /* ------- তালিকা ------- */
  function render() {
    var q = norm((document.getElementById('supSearch') || {}).value);
    var list = (DB.state.suppliers || []).map(function (s) { return { s: s, st: DB.supplierStats(s.id) }; });
    var totals = list.reduce(function (a, x) { a.total += x.st.total; a.paid += x.st.paid; a.due += Math.max(0, x.st.due); return a; }, { total: 0, paid: 0, due: 0 });
    document.getElementById('supKpis').innerHTML =
      kpi('blue', 'মোট কেনা', F.money(totals.total)) +
      kpi('green', 'মোট দিয়েছি', F.money(totals.paid)) +
      kpi('', 'মোট বাকি (দিতে হবে)', F.money(totals.due));
    if (q) list = list.filter(function (x) { return [x.s.name, x.s.phone, x.s.address].some(function (v) { return norm(v).indexOf(q) >= 0; }); });
    list.sort(function (a, b) { return (b.st.due - a.st.due) || String(a.s.name).localeCompare(String(b.s.name)); });
    var tb = document.querySelector('#supTable tbody');
    tb.innerHTML = list.length ? list.map(function (x) {
      return '<tr>' +
        '<td><div class="cell-main cell-link" data-sup-open="' + F.esc(x.s.id) + '">' + F.esc(x.s.name) + '</div>' + (x.s.address ? '<div class="cell-sub">' + F.esc(x.s.address) + '</div>' : '') + '</td>' +
        '<td class="mono">' + (F.esc(x.s.phone) || '—') + '</td>' +
        '<td class="num">' + F.money(x.st.total) + '</td>' +
        '<td class="num">' + F.money(x.st.paid) + '</td>' +
        '<td class="num">' + dueCell(x.st.due) + '</td>' +
        '<td>' + (x.st.last ? F.d(x.st.last) : '—') + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="btn small primary" data-sup-pay="' + F.esc(x.s.id) + '">টাকা দিন</button>' +
          '<button class="btn small ghost" data-sup-edit="' + F.esc(x.s.id) + '">বদলান</button>' +
        '</div></td></tr>';
    }).join('') : '<tr class="empty-row"><td colspan="7">কোনো সাপ্লায়ার নেই।</td></tr>';
    tb.querySelectorAll('[data-sup-open]').forEach(function (b) { b.onclick = function () { open(b.getAttribute('data-sup-open')); }; });
    tb.querySelectorAll('[data-sup-pay]').forEach(function (b) { b.onclick = function () { pay(b.getAttribute('data-sup-pay')); }; });
    tb.querySelectorAll('[data-sup-edit]').forEach(function (b) { b.onclick = function () { form(b.getAttribute('data-sup-edit')); }; });
    if (window.Lang) Lang.apply();
  }

  /* ------- একজন সাপ্লায়ারের হিসাব ------- */
  function open(id) {
    currentId = id;
    App.show('supplier');
    refresh();
  }
  function refresh() {
    var s = currentId && DB.supplierById(currentId);
    if (!s) return;
    var st = DB.supplierStats(s.id);
    document.getElementById('spName').textContent = s.name;
    document.getElementById('spMeta').textContent = [s.phone, s.address].filter(Boolean).join(' · ');
    document.getElementById('spKpis').innerHTML =
      kpi('blue', 'মোট কেনা', F.money(st.total)) +
      kpi('green', 'দিয়েছি', F.money(st.paid)) +
      kpi('', st.due < -0.009 ? 'অগ্রিম দেওয়া' : 'বাকি (দিতে হবে)', F.money(Math.abs(st.due)));
    document.querySelector('#spPurchases tbody').innerHTML = st.purchases.length ? st.purchases.map(function (x) {
      return '<tr><td>' + F.d(x.date) + '</td><td>' + F.esc(x.product) + (x.note ? '<div class="cell-sub">' + F.esc(x.note) + '</div>' : '') + '</td>' +
        '<td class="num">' + F.qty(x.qty) + ' ' + F.esc(x.unit) + '</td>' +
        '<td class="num">' + (x.buyPrice > 0 ? F.money(x.buyPrice) : '—') + '</td>' +
        '<td class="num"><b>' + F.money(x.total) + '</b></td></tr>';
    }).join('') : '<tr class="empty-row"><td colspan="5">এই সাপ্লায়ার থেকে এখনো কোনো মাল নেওয়া হয়নি।</td></tr>';
    document.querySelector('#spPayments tbody').innerHTML = st.payments.length ? st.payments.map(function (r) {
      return '<tr><td>' + F.d(r.date) + '</td><td>' + (F.esc(r.note) || '—') + '</td><td class="num"><b>' + F.money(r.amount) + '</b></td>' +
        '<td><div class="row-actions"><button class="btn small ghost" data-spay-del="' + F.esc(r.id) + '">বাতিল</button></div></td></tr>';
    }).join('') : '<tr class="empty-row"><td colspan="4">এখনো কোনো টাকা দেওয়া হয়নি।</td></tr>';
    document.querySelectorAll('#spPayments [data-spay-del]').forEach(function (b) {
      b.onclick = function () { removePayment(b.getAttribute('data-spay-del')); };
    });
    if (window.Lang) Lang.apply();
  }

  /* ------- ফর্ম: নতুন / বদলান ------- */
  function form(id) {
    var s = id ? DB.supplierById(id) : null;
    UI.modal({ title: s ? 'সাপ্লায়ারের তথ্য বদলান' : 'নতুন সাপ্লায়ার',
      body: '<div class="grid2"><label>নাম *<input id="sfName" autocomplete="off" value="' + F.esc(s ? s.name : '') + '"></label>' +
        '<label>মোবাইল<input id="sfPhone" autocomplete="off" value="' + F.esc(s ? s.phone : '') + '"></label></div>' +
        '<label>ঠিকানা<input id="sfAddress" autocomplete="off" value="' + F.esc(s ? s.address : '') + '"></label>',
      buttons: [{ label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
        { label: 'সেভ করুন', cls: 'primary', onClick: function () {
          try {
            DB.saveSupplier(s ? s.id : null, { name: document.getElementById('sfName').value, phone: document.getElementById('sfPhone').value, address: document.getElementById('sfAddress').value });
          } catch (err) { UI.toast(F.esc(err.message), 'bad'); return; }
          UI.closeModal(); App.refreshAll(); UI.toast(s ? 'সাপ্লায়ারের তথ্য বদল হয়েছে।' : 'সাপ্লায়ার যোগ হয়েছে।', 'ok');
        } }],
      onOpen: function (root) { root.querySelector('#sfName').focus(); }
    });
  }

  /* ------- সাপ্লায়ারকে টাকা দেওয়া ------- */
  function pay(id) {
    var s = DB.supplierById(id);
    if (!s) return;
    var st = DB.supplierStats(id);
    var submitted = false;
    UI.modal({ title: 'টাকা দিন — ' + s.name,
      body: '<p>মোট কেনা: <b>' + F.money(st.total) + '</b> · দিয়েছি: <b>' + F.money(st.paid) + '</b> · বাকি: <b>' + F.money(Math.max(0, st.due)) + '</b></p>' +
        '<div class="grid2"><label>কত টাকা দিলেন<input id="spAmount" inputmode="decimal" autocomplete="off"></label>' +
        '<label>তারিখ<input id="spDate" type="date" value="' + F.today() + '"></label></div>' +
        '<label>নোট<input id="spNote" autocomplete="off"></label>' +
        (st.due > 0.009 ? '<button type="button" class="btn small ghost" id="spFull">পুরো বাকি</button>' : ''),
      buttons: [{ label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
        { label: 'সেভ করুন', cls: 'primary', onClick: function () {
          if (submitted) return;
          try { DB.addSupplierPayment(id, document.getElementById('spAmount').value, document.getElementById('spDate').value, document.getElementById('spNote').value); }
          catch (err) { UI.toast(F.esc(err.message), 'bad'); return; }
          submitted = true;
          UI.closeModal(); App.refreshAll(); UI.toast('সাপ্লায়ারকে দেওয়া টাকা সেভ হয়েছে।', 'ok');
        } }],
      onOpen: function (root) {
        var full = root.querySelector('#spFull');
        if (full) full.onclick = function () { root.querySelector('#spAmount').value = st.due; };
        root.querySelector('#spAmount').focus();
      }
    });
  }

  function removePayment(payId) {
    UI.confirmDialog({ title: 'এই টাকা দেওয়ার এন্ট্রি বাতিল করবেন?', message: 'সাপ্লায়ারের বাকি আবার বাড়বে।', danger: true, confirmText: 'বাতিল করুন' })
      .then(function (ok) {
        if (!ok) return;
        DB.removeSupplierPayment(payId);
        App.refreshAll(); UI.toast('এন্ট্রি বাতিল হয়েছে।', 'ok');
      });
  }

  function bind() {
    if (wired) return; wired = true;
    document.getElementById('addSupplierBtn').onclick = function () { form(null); };
    document.getElementById('supSearch').oninput = UI.debounce(render, 160);
    document.getElementById('supProfileBack').onclick = function () { App.show('suppliers'); };
    document.getElementById('spPayBtn').onclick = function () { if (currentId) pay(currentId); };
    document.getElementById('spEditBtn').onclick = function () { if (currentId) form(currentId); };
  }

  return { render: render, refresh: refresh, open: open, bind: bind, form: form, pay: pay };
})();
