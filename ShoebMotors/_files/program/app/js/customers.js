/* ================= customers.js — customer system + vehicles ================= */
var Customers = (function () {
  var currentId = null;
  var customerPage = 1, PAGE_SIZE = 50;

  /* ------- search / list ------- */
  function all() { return DB.state.customers; }
  function addressText(c) {
    return [c.addressBn, c.address].map(function (v) { return String(v || '').trim(); }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).join(', ');
  }
  function phoneKey(v) { return String(v || '').replace(/[^0-9০-৯]/g, '').replace(/[০-৯]/g, function (d) { return String('০১২৩৪৫৬৭৮৯'.indexOf(d)); }); }
  function digitsOnly(v) { return phoneKey(v).slice(0, 15); }
  function customerByPhone(v, exceptId) {
    var q = phoneKey(v);
    if (q.length < 6) return null;
    return all().filter(function (x) { return (!exceptId || x.id !== exceptId) && phoneKey(x.phone) === q; })[0] || null;
  }

  function haystack(c) {
    var parts = [c.name, c.nameBn, c.phone, addressText(c), c.note];
    (c.vehicles || []).forEach(function (v) { parts.push(v.number, v.model, v.tyreSize, v.type); });
    return parts.filter(Boolean).join(' ').toLowerCase().replace(/[\-\/\s]+/g, ' ');
  }
  function match(c, q) {
    if (!q) return true;
    var hay = haystack(c);
    return q.toLowerCase().trim().split(/\s+/).filter(Boolean).every(function (w) {
      return hay.indexOf(w.replace(/[\-\/]+/g, ' ')) >= 0;
    });
  }

  function searchCustomers(q, limit) {
    var list = all().filter(function (c) { return match(c, q); });
    if (limit) list = list.slice(0, limit);
    return list;
  }

  /* ------- offline smart name autocomplete (no API) ------- */
  function normName(v) {
    return String(v || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  }
  function nameSuggestionPool(exceptId) {
    var map = Object.create(null);
    function add(name, weight, source, date, id) {
      name = String(name || '').replace(/\s+/g, ' ').trim();
      if (!name) return;
      var key = normName(name);
      if (!key || key === 'walk-in customer' || key === 'ওয়াক-ইন' || key === 'ওয়াক-ইন কাস্টমার' || /^কাস্টমার\s+[0-9০-৯]/.test(key)) return;
      if (!map[key]) map[key] = { name: name, weight: 0, source: source || 'history', latest: 0, id: '' };
      map[key].weight += Number(weight || 1);
      /* একই নামে একাধিক সোর্স মিললে সেভ করা কাস্টমারের id-টাই রাখা হয়, যাতে
         সাজেশন বাছাই করলে সরাসরি সেই কাস্টমারের পুরো প্রোফাইলে লিংক করা যায়। */
      if (source === 'customer') { map[key].source = 'customer'; map[key].id = id || map[key].id; }
      var ts = date ? new Date(date).getTime() : 0;
      if (isFinite(ts) && ts > map[key].latest) map[key].latest = ts;
    }

    all().forEach(function (c) {
      if (exceptId && c.id === exceptId) return;
      var n = c.nameBn || c.name || '';
      var st = DB.customerStats ? DB.customerStats(c.id) : { count: 0, last: null };
      add(n, 12 + Math.min(30, Number(st.count || 0) * 3), 'customer', st.last || c.createdAt, c.id);
    });
    (DB.state.sales || []).forEach(function (s) {
      add(s.customerNameBn || s.customerName || '', 2, 'invoice', s.date || s.createdAt);
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function smartNameSuggestions(value, limit, exceptId) {
    var raw = String(value || '').replace(/\s+/g, ' ').replace(/^\s+/, '');
    var q = normName(raw);
    if (!q || q.length < 1) return [];
    var now = Date.now();
    return nameSuggestionPool(exceptId).map(function (x) {
      var n = normName(x.name), score = -1, kind = '';
      if (n === q) return null;
      if (n.indexOf(q) === 0) { score = 1200; kind = 'prefix'; }
      else {
        var words = n.split(' ');
        var wi = words.findIndex(function (w) { return w.indexOf(q) === 0; });
        if (wi >= 0) { score = 800 - wi * 20; kind = 'word'; }
        else if (n.indexOf(q) >= 0) { score = 450; kind = 'contains'; }
      }
      if (score < 0) return null;
      score += Math.min(160, Number(x.weight || 0) * 2);
      if (x.latest) {
        var days = Math.max(0, (now - x.latest) / 86400000);
        score += Math.max(0, 100 - Math.min(100, days / 3));
      }
      return { name: x.name, score: score, kind: kind, source: x.source, id: x.id || '' };
    }).filter(Boolean).sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    }).slice(0, limit || 5);
  }

  function bindNameSuggest(input, opts) {
    if (!input || input.getAttribute('data-smart-name') === '1') return;
    opts = opts || {};
    input.setAttribute('data-smart-name', '1');
    input.setAttribute('autocomplete', 'off');
    var host = input.parentElement;
    if (!host) return;
    host.classList.add('smart-name-host');
    var pop = document.createElement('div');
    pop.className = 'name-smart-suggest';
    pop.hidden = true;
    host.appendChild(pop);
    var current = [];
    var sel = 0;

    function close() { pop.hidden = true; pop.innerHTML = ''; current = []; sel = 0; }
    function accept(i) {
      var x = current[i == null ? sel : i];
      if (!x) return false;
      /* সেভ করা কাস্টমারের নাম বেছে নিলে (id আছে) — যেখানে চাওয়া হয়েছে সেখানে টেক্সট বসানোর
         বদলে সরাসরি সেই কাস্টমারের পুরো প্রোফাইলে লিংক করে দেওয়া হয় (ফোন/ঠিকানা/গাড়ি/হিসাব সহ)। */
      if (opts.onPick && x.id && opts.onPick(x) === true) { close(); return true; }
      input.value = x.name;
      close();
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    function render() {
      current = smartNameSuggestions(input.value, 5, opts.exceptId || '');
      sel = 0;
      if (!current.length) { close(); return; }
      var typed = String(input.value || '').trim();
      var typedNorm = normName(typed);
      pop.innerHTML = '<div class="name-smart-head"><span>⚡ স্মার্ট নাম সাজেশন</span><span>Tab / → নিন</span></div>' + current.map(function (x, i) {
        var full = x.name, fullNorm = normName(full), first = '', rest = full;
        if (fullNorm.indexOf(typedNorm) === 0 && typed) {
          first = full.slice(0, typed.length);
          rest = full.slice(typed.length);
        }
        var why = x.source === 'customer' ? 'আগের কাস্টমার থেকে' : 'পুরোনো ইনভয়েস থেকে';
        return '<div class="name-smart-item' + (i === 0 ? ' sel' : '') + '" data-name-i="' + i + '">' +
          (first ? '<span class="typed">' + F.esc(first) + '</span><span class="rest">' + F.esc(rest) + '</span>' : '<span class="rest">' + F.esc(full) + '</span>') +
          '<span class="why">' + why + '</span></div>';
      }).join('');
      pop.hidden = false;
      pop.querySelectorAll('[data-name-i]').forEach(function (el) {
        el.onmousedown = function (e) { e.preventDefault(); accept(Number(el.getAttribute('data-name-i'))); input.focus(); };
      });
    }

    input.addEventListener('input', render);
    input.addEventListener('focus', function () { if (input.value.trim()) render(); });
    input.addEventListener('blur', function () { setTimeout(close, 130); });
    input.addEventListener('keydown', function (e) {
      if (pop.hidden || !current.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = e.key === 'ArrowDown' ? Math.min(current.length - 1, sel + 1) : Math.max(0, sel - 1);
        pop.querySelectorAll('.name-smart-item').forEach(function (el, i) { el.classList.toggle('sel', i === sel); });
        return;
      }
      var atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
      if ((e.key === 'Tab' || e.key === 'ArrowRight') && (e.key === 'Tab' || atEnd)) {
        e.preventDefault();
        if (accept(sel) && e.key === 'Tab') {
          var focusables = Array.prototype.slice.call(document.querySelectorAll('input,select,textarea,button')).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
          var ix = focusables.indexOf(input); if (ix >= 0 && focusables[ix + 1]) focusables[ix + 1].focus();
        }
      } else if (e.key === 'Escape') close();
    });
  }

  function customerListStats() {
    var idx = Object.create(null);
    (DB.state.sales || []).forEach(function (s) {
      var cid = s.customerId;
      if (!cid) return;
      var x = idx[cid] || (idx[cid] = { count:0, total:0, last:null });
      x.count++; x.total += F.num(s.total);
      if (!x.last || new Date(s.date) > new Date(x.last)) x.last = s.date;
    });
    Object.keys(idx).forEach(function (k) { idx[k].total = DB.round2(idx[k].total); });
    return idx;
  }

  function render() {
    var q = (document.getElementById('custSearch').value || '').trim();
    var sortBy = document.getElementById('custSort').value;
    var stats = customerListStats();
    var list = searchCustomers(q).map(function (c) {
      return { c: c, st: stats[c.id] || { count:0, total:0, last:null } };
    });

    list.sort(function (a, b) {
      if (sortBy === 'spend') return b.st.total - a.st.total;
      if (sortBy === 'new') return new Date(b.c.createdAt || 0) - new Date(a.c.createdAt || 0);
      return (a.c.nameBn || a.c.name || '').localeCompare(b.c.nameBn || b.c.name || '');
    });

    var totalRows = list.length;
    var totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    if (customerPage > totalPages) customerPage = totalPages;
    if (customerPage < 1) customerPage = 1;
    var pageList = list.slice((customerPage - 1) * PAGE_SIZE, customerPage * PAGE_SIZE);

    var tb = document.querySelector('#custTable tbody');
    tb.innerHTML = pageList.length ? pageList.map(function (x) {
      var c = x.c;
      var veh = (c.vehicles || []).map(function (v) { return '<span class="vehicle-chip">' + F.esc(v.number || v.model || 'নম্বরবিহীন গাড়ি') + '</span>'; }).join('') || '<span class="tiny muted">—</span>';
      return '<tr>' +
        '<td><div class="cell-main cell-link" data-open="' + c.id + '">' + F.esc(Lang.showName(c.nameBn || c.name, c.name) || 'নাম নেই') + '</div>' +
        (c.address || c.addressBn ? '<div class="cell-sub">' + F.esc(addressText(c)) + '</div>' : '') + '</td>' +
        '<td><a href="tel:' + F.esc(c.phone) + '" class="mono">' + F.esc(c.phone || '') + '</a></td>' +
        '<td>' + veh + '</td>' +
        '<td class="num">' + x.st.count + '</td>' +
        '<td class="num">' + F.money(x.st.total) + '</td>' +
        '<td>' + (x.st.last ? F.relDay(DB.todayStr(x.st.last)) : '') + '</td>' +
        '<td><div class="row-actions">' +
        '<button class="btn small ghost" data-sell="' + c.id + '">বিক্রি</button>' +
        '<button class="btn small ghost" data-edit="' + c.id + '">বদলান</button>' +
        '</div></td>' +
        '</tr>';
    }).join('') : '';

    document.getElementById('custSummary').textContent = list.length + ' জন কাস্টমার';

    var pager = document.getElementById('custPager');
    if (pager) {
      pager.hidden = totalPages <= 1;
      var en = window.Lang && Lang.isEn();
      pager.innerHTML = totalPages > 1 ?
        '<button class="btn small ghost pager-btn" data-pager-prev' + (customerPage <= 1 ? ' disabled' : '') + '>‹ ' + (en ? 'Previous' : 'আগের') + '</button>' +
        '<span class="pager-info">' + (en ? 'Page ' : 'পৃষ্ঠা ') + customerPage + ' / ' + totalPages + ' · ' + totalRows + (en ? ' customers' : ' জন') + '</span>' +
        '<button class="btn small ghost pager-btn" data-pager-next' + (customerPage >= totalPages ? ' disabled' : '') + '>' + (en ? 'Next' : 'পরের') + ' ›</button>' : '';
      var prev = pager.querySelector('[data-pager-prev]'), next = pager.querySelector('[data-pager-next]');
      if (prev) prev.onclick = function () { if (customerPage > 1) { customerPage--; render(); } };
      if (next) next.onclick = function () { if (customerPage < totalPages) { customerPage++; render(); } };
    }

    tb.querySelectorAll('[data-open]').forEach(function (b) { b.onclick = function () { open(b.getAttribute('data-open')); }; });
    tb.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { form(b.getAttribute('data-edit')); }; });
    tb.querySelectorAll('[data-sell]').forEach(function (b) {
      b.onclick = function () { App.show('sale'); Sale.setCustomer(b.getAttribute('data-sell')); };
    });
  }

  /* ------- add / edit form ------- */
  function vehicleRow(v) {
    v = v || { id: '', number: '', type: 'মোটরসাইকেল', model: '', tyreSize: '', note: '' };
    return '<div class="veh-row" data-vid="' + F.esc(v.id) + '" style="border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:8px">' +
      '<div class="row" style="justify-content:space-between;margin-bottom:6px"><b class="tiny">গাড়ি</b>' +
      '<button class="link-btn veh-del" type="button">মুছুন</button></div>' +
      '<div class="grid2">' +
      '<label>গাড়ির নম্বর (ঐচ্ছিক)<input class="v-number" value="' + F.esc(v.number || v.model || 'নম্বরবিহীন গাড়ি') + '"></label>' +
      '<label>মডেল<input class="v-model" value="' + F.esc(v.model) + '"></label>' +
      '<label>ব্যবহৃত টায়ারের সাইজ<input class="v-size" value="' + F.esc(v.tyreSize) + '"></label>' +
      '<label>নোট<input class="v-note" value="' + F.esc(v.note) + '"></label>' +
      '</div></div>';
  }

  function form(id) {
    var c = id ? DB.customerById(id) : null;
    var isNew = !c;
    var body = '' +
      '<div class="grid2">' +
      '<label>নাম *<input id="cfNameBn" value="' + F.esc(c ? (c.nameBn || c.name || '') : '') + '" lang="bn"></label>' +
      '<label>মোবাইল নম্বর<input id="cfPhone" value="' + F.esc(c ? c.phone : '') + '" inputmode="text" lang="bn" pattern="[0-9০-৯ +()-]*" maxlength="20"></label>' +
      '</div>' +
      '<label>ঠিকানা<input id="cfAddress" value="' + F.esc(c ? addressText(c) : '') + '"></label>' +
      '<div class="section-title">এই কাস্টমারের গাড়ি</div>' +
      '<div id="vehList">' + ((c && c.vehicles && c.vehicles.length) ? c.vehicles.map(vehicleRow).join('') : '') + '</div>' +
      '<button class="btn small ghost" type="button" id="addVehBtn">＋ গাড়ি যোগ করুন</button>' +
      '';

    UI.modal({
      title: isNew ? 'নতুন কাস্টমার' : 'কাস্টমারের তথ্য বদলান',
      body: body,
      buttons: [
        { label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
        {
          label: isNew ? 'কাস্টমার সেভ করুন' : 'পরিবর্তন সেভ করুন', cls: 'primary', onClick: function () {
            var name = '';
            var phone = digitsOnly(document.getElementById('cfPhone').value);
            document.getElementById('cfPhone').value = phone;
            var nameBn = (document.getElementById('cfNameBn') || {}).value.trim();
            if (!nameBn) { UI.toast('কাস্টমারের নাম (বাংলা) লিখুন।', 'bad'); return; }
            var dup = customerByPhone(phone, c ? c.id : '');
            if (dup) { UI.toast('এই মোবাইল নম্বরটি আগেই ব্যবহার করেছেন (' + F.esc(dup.nameBn || dup.name) + ')। অন্য কাস্টমারের নম্বর ব্যবহার করবেন না।', 'bad', 4200); return; }

            var vehicles = UI.$$('#vehList .veh-row').map(function (row) {
              return {
                id: row.getAttribute('data-vid') || DB.uid('v'),
                number: row.querySelector('.v-number').value.trim().toUpperCase(),
                model: row.querySelector('.v-model').value.trim(),
                tyreSize: row.querySelector('.v-size').value.trim(),
                note: row.querySelector('.v-note').value.trim()
              };
            });

            var addressBn = ''; // One address field; legacy values are combined before editing.
            if (isNew) {
              c = {
                id: DB.uid('c'), name: '', nameBn: nameBn, addressBn: addressBn.trim(), phone: phone,
                address: document.getElementById('cfAddress').value.trim(),
                note: '',
                createdAt: new Date().toISOString(), vehicles: vehicles, payments: [], openingDues: []
              };
              DB.state.customers.push(c);
              DB.nextNo('customer');
              UI.toast('কাস্টমার <b>' + F.esc(nameBn) + '</b> যোগ হয়েছে।', 'ok');
            } else {
              c.name = nameBn ? '' : (c.name || ''); c.nameBn = nameBn; c.addressBn = addressBn.trim(); c.phone = phone;
              c.address = document.getElementById('cfAddress').value.trim();
              c.vehicles = vehicles;
              UI.toast('কাস্টমারের তথ্য বদল হয়েছে।', 'ok');
            }
            DB.save(); UI.closeModal();
            if (App.currentView === 'customers') render();
            if (App.currentView === 'customer') open(c.id);
            if (App.currentView === 'dashboard') Dashboard.render();
          }
        }
      ],
      onOpen: function (rootEl) {
        bindNameSuggest(rootEl.querySelector('#cfNameBn'), { exceptId: c ? c.id : '' });
        var phoneEl = rootEl.querySelector('#cfPhone');
        if (phoneEl) {
          phoneEl.addEventListener('input', function () {
            /* Avro/Bangla digit input দৃশ্যমান রাখুন; lookup/save-এ normalized digits ব্যবহার হবে। */
            if (isNew) {
              var existing = customerByPhone(phoneEl.value, '');
              if (existing) UI.toast('এই মোবাইল নম্বরটি আগে থেকেই <b>' + F.esc(existing.nameBn || existing.name || 'কাস্টমার') + '</b>-এর নামে আছে।', 'warn', 3200);
            }
          });
        }
        rootEl.querySelector('#addVehBtn').onclick = function () {
          var wrap = document.createElement('div');
          wrap.innerHTML = vehicleRow({ id: DB.uid('v') });
          rootEl.querySelector('#vehList').appendChild(wrap.firstChild);
          bindDel(rootEl);
        };
        bindDel(rootEl);
      }
    });
    function bindDel(rootEl) {
      rootEl.querySelectorAll('.veh-del').forEach(function (b) {
        b.onclick = function () { b.closest('.veh-row').remove(); };
      });
    }
  }

  /* ------- customer profile ------- */
  function open(id) {
    currentId = id;
    var c = DB.customerById(id);
    if (!c) { UI.toast('কাস্টমার খুঁজে পাওয়া যায়নি।', 'bad'); App.show('customers'); return; }
    App.show('customer');
    renderProfile(c);
  }

  /* Re-draw the open profile in place (after a payment etc.) without resetting scroll/history. */
  function refresh() {
    var c = currentId && DB.customerById(currentId);
    if (c) renderProfile(c);
  }

  function renderProfile(c) {
    var id = c.id;
    var st = DB.customerStats(id);

    document.getElementById('cpName').textContent = c.nameBn || c.name;
    document.getElementById('cpMeta').innerHTML = '📞 <a href="tel:' + F.esc(c.phone) + '">' + F.esc(c.phone) + '</a>' +
      (addressText(c) ? ' · ' + F.esc(addressText(c)) : '') + ' · কাস্টমার হয়েছেন ' + F.d(c.createdAt || Date.now());

    document.getElementById('cpDetails').innerHTML =
      '<tr><td class="muted">নাম</td><td>' + (F.esc(c.nameBn || c.name) || '—') + '</td></tr>' +
      '<tr><td class="muted">মোবাইল</td><td class="mono">' + F.esc(c.phone) + '</td></tr>' +
      '<tr><td class="muted">ঠিকানা</td><td>' + (F.esc(addressText(c)) || '—') + '</td></tr>' +
      '<tr><td class="muted">নোট</td><td>' + (F.esc(c.note) || '—') + '</td></tr>' +
      '<tr><td class="muted">মোট কেনা</td><td>' + st.count + ' টি ইনভয়েস · ' + F.qty(st.items) + ' পিস</td></tr>' +
      '<tr><td class="muted">সব মিলিয়ে টাকা</td><td><b>' + F.money(st.total) + '</b></td></tr>' +
      '<tr><td class="muted">মোট ছাড় দেওয়া হয়েছে</td><td>' + F.money(st.discount) + '</td></tr>' +
      '<tr><td class="muted">এখন পর্যন্ত জমা দিয়েছেন</td><td>' + F.money(st.paid) + '</td></tr>' +
      '<tr><td class="muted">মোট পাওনা (বর্তমান)</td><td><b>' + F.money(st.due) + '</b></td></tr>' +
      '<tr><td class="muted">শেষ এসেছেন</td><td>' + (st.last ? F.d(st.last) : '—') + '</td></tr>';

    var vb = document.querySelector('#cpVehicles tbody');
    vb.innerHTML = (c.vehicles || []).length ? c.vehicles.map(function (v) {
      return '<tr><td><b class="mono">' + F.esc(v.number || v.model || 'নম্বরবিহীন গাড়ি') + '</b></td><td>' + (F.esc(v.model) || '—') + '</td><td class="mono">' + (F.esc(v.tyreSize) || '—') + '</td>' +
        '<td class="tiny muted">' + (F.esc(v.note) || '') + '</td>' +
        '<td><div class="row-actions"><button class="btn small ghost" data-vsale="' + v.id + '">টায়ার বিক্রি</button><button class="btn small ghost" data-vdel="' + v.id + '">মুছে ফেলুন</button></div></td></tr>';
    }).join('') : UI.emptyRow(5, 'এখনো কোনো গাড়ির নম্বর সেভ করা হয়নি। “＋ গাড়ি যোগ করুন” চাপুন।');

    vb.querySelectorAll('[data-vsale]').forEach(function (b) {
      b.onclick = function () {
        var v = (c.vehicles || []).filter(function (x) { return x.id === b.getAttribute('data-vsale'); })[0];
        App.show('sale'); Sale.setCustomer(c.id, v);
      };
    });
    vb.querySelectorAll('[data-vdel]').forEach(function (b) {
      b.onclick = function () {
        var vid = b.getAttribute('data-vdel');
        UI.confirmDialog({ title: 'গাড়িটি মুছে ফেলবেন?', message: 'এই কাস্টমারের তালিকা থেকে গাড়ির নম্বরটি মুছে যাবে।', danger: true, confirmText: 'মুছে ফেলুন' })
          .then(function (ok) {
            if (!ok) return;
            var vv = (c.vehicles || []).filter(function (x) { return x.id === vid; })[0];
            if (vv) DB.archiveDeleted('vehicle', (c.nameBn || c.name || 'কাস্টমার') + ' — ' + (vv.number || ''), { customerId: c.id, vehicle: vv }, { date: DB.todayStr() });
            c.vehicles = c.vehicles.filter(function (x) { return x.id !== vid; });
            DB.save(); open(c.id); UI.toast('গাড়ি মুছে ফেলা হয়েছে।', 'ok');
          });
      };
    });

    var sales = DB.state.sales.filter(function (s) { return s.customerId === id; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    var invoiceDueTotal = 0;
    var rows = sales.map(function (s) {
      var tracked = s.collectionTracking === true;
      var pending = DB.saleHasPending(s);
      var due = tracked && !pending ? DB.trueDue(s) : 0;
      invoiceDueTotal += due;
      var canPay = tracked && (pending || due > 0.009);
      var dueCell = pending ? '<span class="pend">দর অপেক্ষমাণ</span>' :
        (due > 0.009 ? '<b class="pend">' + F.money(due) + '</b>' : '<span class="muted">পরিশোধিত</span>');
      var itemsTxt = s.items.map(function (i) {
        var line = F.esc(i.name) + ' ×' + i.qty + ' · ';
        if (DB.itemPending(i)) line += '<span class="pend">দর ঠিক হয়নি</span>';
        else line += 'দর ' + F.money(i.price) + ' = ' + F.money(i.total);
        var cost = F.num(i.cost);
        if (cost > 0) line += ' <span class="owner-only tiny muted">(ক্রয় ' + F.money(cost) + '/পিস — কাস্টমার দেখবে না)</span>';
        return line;
      }).join('<br>');
      return { date: s.date, html: '<tr><td><b>' + F.esc(s.invoiceNo) + '</b></td><td>' + F.d(s.date) + '</td>' +
        '<td class="tiny">' + itemsTxt + '</td>' +
        '<td class="num">' + F.money(s.subTotal) + '</td>' +
        '<td class="num">' + (F.num(s.discount) ? F.money(s.discount) : '—') + '</td>' +
        '<td class="num"><b>' + F.money(s.total) + '</b></td>' +
        '<td class="num">' + (pending ? '—' : F.money(s.paid)) + '</td>' +
        '<td class="num">' + dueCell + '</td>' +
        '<td><div class="row-actions">' +
        (canPay ? '<button class="btn small primary" data-pay-inv="' + s.id + '">টাকা জমা</button>' : '') +
        '<button class="btn small" data-inv="' + s.id + '">ইনভয়েস</button>' +
        (pending ? '<button class="btn small" data-price="' + s.id + '">দর বসান</button>' : '') +
        '</div></td></tr>' };
    });
    /* আগের বকেয়া — ইনভয়েসের মতোই একটি সারি: নোট, মোট, জমা, বাকি, আর আলাদা করে টাকা জমা। */
    var openingDueTotal = 0;
    DB.openingEntries(id).forEach(function (e) {
      openingDueTotal += e.due;
      rows.push({ date: e.date + 'T00:00:00', html: '<tr class="opening-due-row"><td><span class="tag warn opening-tag">আগের বকেয়া</span></td><td>' + F.d(e.date) + '</td>' +
        '<td class="tiny">' + (F.esc(e.note) || '<span class="muted">পুরোনো হিসাবের বাকি</span>') + '</td>' +
        '<td class="num">' + F.money(e.amount) + '</td><td class="num">—</td>' +
        '<td class="num"><b>' + F.money(e.amount) + '</b></td>' +
        '<td class="num">' + F.money(e.paid) + '</td>' +
        '<td class="num">' + (e.due > 0.009 ? '<b class="pend">' + F.money(e.due) + '</b>' : '<span class="muted">পরিশোধিত</span>') + '</td>' +
        '<td><div class="row-actions">' +
        (e.due > 0.009 ? '<button class="btn small primary" data-pay-opening="' + F.esc(e.id) + '">টাকা জমা</button>' : '') +
        '<button class="btn small" data-edit-opening="' + F.esc(e.id) + '">বদলান</button>' +
        '</div></td></tr>' });
    });
    rows.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    document.querySelector('#cpSales tbody').innerHTML = rows.length ? rows.map(function (r) { return r.html; }).join('') : UI.emptyRow(9, 'এখনো কোনো কেনার হিসাব নেই।');

    document.getElementById('cpTotals').textContent = 'মোট কেনা: ' + F.money(st.total) + ' · মোট বাকি: ' + F.money(DB.round2(invoiceDueTotal + openingDueTotal));
    var account = DB.duePaymentAccount('id:' + id);
    var addOpeningBtn = document.getElementById('cpAddOpeningBtn');
    if (addOpeningBtn) addOpeningBtn.hidden = DB.openingEntries(id).length > 0;
    var payAllBtn = document.getElementById('cpPayDueBtn');
    if (payAllBtn) {
      payAllBtn.hidden = account.total <= 0.009;
      payAllBtn.textContent = 'বকেয়া জমা (' + F.money(account.total) + ')';
    }

    document.querySelector('#cpSales tbody').querySelectorAll('[data-inv]').forEach(function (b) {
      b.onclick = function () { UI.openInvoice(b.getAttribute('data-inv')); };
    });
    document.querySelector('#cpSales tbody').querySelectorAll('[data-pay-inv]').forEach(function (b) {
      b.onclick = function () { Collections.open(b.getAttribute('data-pay-inv')); };
    });
    var tb = document.querySelector('#cpSales tbody');
    tb.querySelectorAll('[data-pay-opening]').forEach(function (b) { b.onclick = function () { payOpening(id, b.getAttribute('data-pay-opening')); }; });
    tb.querySelectorAll('[data-edit-opening]').forEach(function (b) { b.onclick = function () { openingForm(id, b.getAttribute('data-edit-opening')); }; });
    document.querySelector('#cpSales tbody').querySelectorAll('[data-price]').forEach(function (b) {
      b.onclick = function () { if (window.Sales && Sales.setPrices) Sales.setPrices(b.getAttribute('data-price')); };
    });
  }

  /* ------- আগের বকেয়া: যোগ / বদল / টাকা জমা ------- */
  function openingForm(cid, entryId, draft) {
    var e = entryId ? DB.openingEntries(cid).filter(function (x) { return x.id === entryId; })[0] : null;
    if (entryId && !e) { UI.toast('আগের বকেয়ার এন্ট্রি পাওয়া যায়নি।', 'bad'); return; }
    var v = draft || (e ? { amount: String(e.amount), date: e.date, note: e.note } : { amount: '', date: F.today(), note: '' });
    UI.modal({ title: e ? 'আগের বকেয়া বদলান' : 'আগের বকেয়া যোগ করুন',
      body: '<div class="grid2"><label>টাকার পরিমাণ<input id="odAmount" inputmode="decimal" autocomplete="off" value="' + F.esc(v.amount) + '"></label>' +
        '<label>তারিখ<input id="odDate" type="date" value="' + F.esc(v.date) + '"></label></div>' +
        '<label>নোট<input id="odNote" autocomplete="off" value="' + F.esc(v.note) + '"></label>',
      buttons: [{ label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
        { label: 'সেভ করুন', cls: 'primary', onClick: function () {
          var d = { amount: document.getElementById('odAmount').value, date: document.getElementById('odDate').value, note: document.getElementById('odNote').value };
          if (e) {
            try { DB.updateOpeningDue(cid, e.id, d.amount, d.date, d.note); } catch (err) { UI.toast(F.esc(err.message), 'bad'); return; }
            UI.closeModal(); App.refreshAll(); UI.toast('আগের বকেয়া বদল হয়েছে।', 'ok');
            return;
          }
          var amount;
          try { amount = DB.checkNewOpeningDue(cid, d.amount, d.date); } catch (err) { UI.toast(F.esc(err.message), 'bad'); return; }
          var c = DB.customerById(cid);
          UI.confirmDialog({ title: 'আগের বকেয়া যোগ করবেন?',
            message: '<b>' + F.esc(c.nameBn || c.name || '') + '</b> — <b>' + F.money(amount) + '</b> আগের বকেয়া যোগ হবে। একবার যোগ করলে এই কাস্টমারের জন্য আর আগের বকেয়া যোগ করা যাবে না।',
            confirmText: 'হ্যাঁ, যোগ করুন' })
            .then(function (ok) {
              if (!ok) { openingForm(cid, null, d); return; }
              try { DB.addOpeningDue(cid, d.amount, d.date, d.note); } catch (err) { UI.toast(F.esc(err.message), 'bad'); return; }
              App.refreshAll(); UI.toast('আগের বকেয়া যোগ হয়েছে।', 'ok');
            });
        } }],
      onOpen: function (root) { root.querySelector('#odAmount').focus(); }
    });
  }

  function payOpening(cid, entryId) {
    var e = DB.openingEntries(cid).filter(function (x) { return x.id === entryId; })[0];
    if (!e || e.due <= 0.009) { UI.toast('এই বকেয়া ইতিমধ্যে পরিশোধ হয়েছে।', 'ok'); return; }
    var submitted = false;
    UI.modal({ title: 'টাকা জমা — আগের বকেয়া',
      body: '<div class="existing-customer-card"><div class="ec-meta">' + F.d(e.date) + (e.note ? ' · ' + F.esc(e.note) : '') +
          ' · মোট: <b>' + F.money(e.amount) + '</b> · আগে জমা: <b>' + F.money(e.paid) + '</b> · বাকি: <b>' + F.money(e.due) + '</b></div></div>' +
        '<div class="grid2" style="margin-top:12px"><label>আজ কত টাকা পেলেন<input id="odPayAmount" inputmode="decimal" autocomplete="off"></label>' +
        '<label>জমার তারিখ<input id="odPayDate" type="date" value="' + F.today() + '"></label></div>' +
        '<div class="row" style="margin:8px 0"><button class="btn small ghost" type="button" id="odPayFull">পুরো বাকি টাকা</button></div>',
      buttons: [{ label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
        { label: 'জমা সেভ করুন', cls: 'primary', onClick: function () {
          if (submitted) return;
          try {
            var result = DB.collectOpeningDue(cid, e.id, document.getElementById('odPayAmount').value, document.getElementById('odPayDate').value);
          } catch (err) { UI.toast(F.esc(err.message), 'bad'); return; }
          submitted = true;
          UI.closeModal(); App.refreshAll();
          if (!result.saved) { UI.toast('ডেটা সেভ নিশ্চিত হয়নি। আবার জমা চাপবেন না; সেভ স্ট্যাটাস দেখুন।', 'bad', 8000); return; }
          setTimeout(function () { UI.openCollectionReceipt(result.receipt); }, 120);
        } }],
      onOpen: function (root) {
        root.querySelector('#odPayFull').onclick = function () { var a = root.querySelector('#odPayAmount'); a.value = e.due; a.focus(); };
        root.querySelector('#odPayAmount').focus();
      }
    });
  }


  /* ------- vehicle add (from profile) ------- */
  function addVehicleQuick(customerId) {
    form(customerId);
    setTimeout(function () {
      var btn = document.getElementById('addVehBtn');
      if (btn) btn.click();
    }, 60);
  }

  function exportCsv() {
    var rows = [['নাম', 'মোবাইল', 'ঠিকানা', 'গাড়ি', 'ইনভয়েস', 'মোট কেনা', 'নোট', 'কাস্টমার হয়েছেন']];
    all().forEach(function (c) {
      var st = DB.customerStats(c.id);
      rows.push([c.nameBn || c.name || '', c.phone, c.address, (c.vehicles || []).map(function (v) { return v.number; }).join(' | '),
      st.count, st.total, c.note, F.d(c.createdAt)]);
    });
    F.download('shoeb-motors-customers-' + F.today() + '.csv', F.csv(rows), 'text/csv');
    UI.toast('কাস্টমারের তালিকা CSV ফাইলে সেভ হয়েছে।', 'ok');
  }

  function bind() {
    document.getElementById('custSearch').oninput = UI.debounce(function () { customerPage = 1; render(); }, 180);
    document.getElementById('custSort').onchange = function () { customerPage = 1; render(); };
    document.getElementById('addCustomerBtn').onclick = function () { form(null); };
    document.getElementById('exportCustBtn').onclick = exportCsv;
    document.getElementById('custProfileBack').onclick = function () { App.show('customers'); };
    document.getElementById('cpPayDueBtn').onclick = function () { if (currentId) DueList.pay('id:' + currentId); };
    document.getElementById('cpAddOpeningBtn').onclick = function () { if (currentId) openingForm(currentId); };
    document.getElementById('cpEditBtn').onclick = function () { form(currentId); };
    document.getElementById('cpAddVehicleBtn').onclick = function () { addVehicleQuick(currentId); };
    document.getElementById('cpNewSaleBtn').onclick = function () { App.show('sale'); Sale.setCustomer(currentId); };
  }

  return { render: render, open: open, refresh: refresh, form: form, bind: bind, exportCsv: exportCsv, searchCustomers: searchCustomers, match: match, smartNameSuggestions: smartNameSuggestions, bindNameSuggest: bindNameSuggest };
})();
