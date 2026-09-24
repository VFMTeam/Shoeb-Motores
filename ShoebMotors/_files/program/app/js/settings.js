/* ================= settings.js — shop details, PIN, backup / restore ================= */
var Settings = (function () {

  function savedServerPath() {
    var info = DB.serverInfo || {};
    return info.dataDir || info.savedDataDir || '';
  }

  function fill() {
    var st = DB.state.settings;
    document.getElementById('setShopName').value = st.shopName || '';
    document.getElementById('setShopNameBn').value = st.shopNameBn || '';
    document.getElementById('setShopTag').value = st.tagline || '';
    document.getElementById('setAddress').value = st.address || '';
    document.getElementById('setPhone').value = st.phone || '';
    document.getElementById('setCurrency').value = st.currency || '৳';
    document.getElementById('setPrefix').value = st.invoicePrefix || 'INV';
    document.getElementById('setDiscountNote').value = st.discountNote || '';
    renderLogo();
    document.getElementById('setReturnNote').value = st.footerNote || '';
    document.getElementById('setFooter').value = st.footerNote || '';
    document.getElementById('setThanks').value = st.thanksLine || '';
    document.getElementById('setLang').value = (st.lang === 'en') ? 'en' : 'bn';
    document.getElementById('setTheme').value = window.Theme ? Theme.choice() : ((st.theme === 'dark' || st.theme === 'light') ? st.theme : 'system');
    renderStorage();
    renderDeleted();
  }

  function renderStorage() {
    var t = document.getElementById('storageTable');
    var mode = DB.mode;
    var fixedPath = (DB.serverInfo && DB.serverInfo.dataDir) || savedServerPath() || 'D:\\Private\\Do Not Delete';
    var label = mode === 'server' ? 'লোকাল সার্ভার (Installed App)' : 'Local Data সংযোগ নেই';
    var where = mode === 'server' ? fixedPath : 'লোকাল সার্ভার পাওয়া যায়নি — browser-এ business data রাখা হয় না';
    var last = DB.lastSavedAt ? (F.d(DB.lastSavedAt) + ' ' + F.time(DB.lastSavedAt)) : '—';

    t.innerHTML =
      '<tr><td class="muted">সেভের ধরন</td><td><b>' + label + '</b></td></tr>' +
      '<tr><td class="muted">তথ্য কোথায় আছে</td><td class="mono">' + F.esc(where) + '</td></tr>' +
      '<tr><td class="muted">শেষ সেভ</td><td>' + last + '</td></tr>' +
      '<tr><td class="muted">মোট হিসাব</td><td>' + DB.state.sales.length + ' টি বিক্রি · ' + DB.state.products.length + ' পণ্য · ' + DB.state.customers.length + ' কাস্টমার</td></tr>' +
      '<tr><td class="muted">Online Backup</td><td><b>Manual only</b> — কোনো auto sync / auto retry নেই</td></tr>';
    document.getElementById('backupInfo').textContent = mode === 'server'
      ? ''
      : 'SETUP.bat চালিয়ে local server চালু করুন। Server ছাড়া নতুন business data browser-এ স্থায়ীভাবে save হবে না।';
  }

  function saveDetails() {
    var st = DB.state.settings;
    st.shopName = document.getElementById('setShopName').value.trim() || 'Shoeb Motors & Tyre House';
    st.shopNameBn = document.getElementById('setShopNameBn').value.trim();
    st.tagline = document.getElementById('setShopTag').value.trim();
    st.address = document.getElementById('setAddress').value.trim();
    st.phone = document.getElementById('setPhone').value.trim();
    st.currency = document.getElementById('setCurrency').value.trim() || '৳';
    st.invoicePrefix = document.getElementById('setPrefix').value.trim() || 'INV';
    st.discountNote = document.getElementById('setDiscountNote').value.trim();
    st.theme = document.getElementById('setTheme').value || 'system';
    st.lang = document.getElementById('setLang').value === 'en' ? 'en' : 'bn';
    var ret = document.getElementById('setReturnNote').value.trim();
    if (ret) st.footerNote = ret;
    st.footerNote = document.getElementById('setFooter').value.trim();
    st.thanksLine = document.getElementById('setThanks').value.trim();
    DB.save();
    if (window.Theme) Theme.set(st.theme);
    App.applyBranding();
    renderStorage();
    if (window.Lang) { Lang.set(st.lang); }
  }

  function renderLogo() {
    var img = document.getElementById('setLogoPreview');
    if (img) img.src = (DB.state.settings.logoImage || 'img/logo.png');
  }

  /* নিজের লোগো — ছবিটি ছোট করে সেভ হয়, তাই ব্যাকআপের সাথে নিজেই চলে যায় */
  function logoChosen(ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) { UI.toast('PNG বা JPG ছবি বেছে নিন।', 'bad'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var im = new Image();
      im.onload = function () {
        var max = 512;
        var sc = Math.min(1, max / Math.max(im.width || 1, im.height || 1));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round((im.width || 1) * sc));
        c.height = Math.max(1, Math.round((im.height || 1) * sc));
        var g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(im, 0, 0, c.width, c.height);
        var out = c.toDataURL('image/jpeg', 0.9);
        if (out.length > 420000) out = c.toDataURL('image/jpeg', 0.72);
        DB.state.settings.logoImage = out;
        DB.save(); renderLogo(); App.applyBranding();
        UI.toast('লোগো বদলানো হয়েছে।', 'ok');
      };
      im.onerror = function () { UI.toast('ছবিটি খোলা গেল না — অন্য ছবি দিয়ে দেখুন।', 'bad'); };
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    DB.state.settings.logoImage = '';
    DB.save(); renderLogo(); App.applyBranding();
    UI.toast('আগের লোগোতে ফিরে গেছে।', 'ok');
  }

  function changePin() {
    var cur = document.getElementById('curPin').value.trim();
    var n1 = document.getElementById('newPin').value.trim();
    var n2 = document.getElementById('newPin2').value.trim();
    if ((DB.state.settings.pin || '') !== cur) { UI.toast('এখনকার পিন ভুল হয়েছে।', 'bad'); return; }
    if (!/^[0-9]{4,6}$/.test(n1)) { UI.toast('নতুন পিন ৪ থেকে ৬ সংখ্যার হতে হবে।', 'bad'); return; }
    if (n1 !== n2) { UI.toast('নতুন দুইবার লেখা পিন মিলছে না।', 'bad'); return; }
    DB.state.settings.pin = n1;
    DB.save();
    document.getElementById('curPin').value = '';
    document.getElementById('newPin').value = '';
    document.getElementById('newPin2').value = '';
    UI.toast('পিন বদলানো হয়েছে। মনে রাখুন!', 'ok');
  }

  function downloadBackup() {
    var text = JSON.stringify(DB.state, null, 2);
    F.download('shoeb-motors-backup-' + F.today() + '.json', text, 'application/json');
    UI.toast('ব্যাকআপ ফাইল নামানো হয়েছে। নিরাপদ জায়গায় কপি রেখে দিন।', 'ok');
  }

  function validBackupShape(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    var lists = ['products', 'customers', 'sales', 'receipts', 'payments', 'expenses', 'heldSales', 'dayClosings', 'deleted'];
    for (var i = 0; i < lists.length; i++) {
      var k = lists[i];
      if (data[k] !== undefined && !Array.isArray(data[k])) return false;
    }
    if (data.settings !== undefined && (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings))) return false;
    if (Array.isArray(data.sales)) {
      for (var j = 0; j < data.sales.length; j++) {
        var sale = data.sales[j];
        if (!sale || typeof sale !== 'object' || Array.isArray(sale)) return false;
        if (sale.items !== undefined && !Array.isArray(sale.items)) return false;
      }
    }
    return !!(data.settings || data.meta || data.sales || data.products || data.customers);
  }

  function restoreFile(ev) {
    var file = ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (e) { UI.toast('ফাইলটি সঠিক ব্যাকআপ ফাইল নয়।', 'bad'); return; }
      if (!validBackupShape(data)) { UI.toast('এই ফাইলটির data structure সঠিক নয় — restore করা হয়নি।', 'bad'); return; }
      UI.confirmDialog({
        title: 'ব্যাকআপ থেকে তথ্য ফিরিয়ে আনবেন?',
        message: 'ব্যাকআপ ফাইলের তথ্য দিয়ে এখনকার সব তথ্য বদলে যাবে (' +
          ((data.sales || []).length) + ' টি বিক্রি, ' + ((data.products || []).length) + ' পণ্য, ' + ((data.customers || []).length) + ' কাস্টমার)।<br><br>নিরাপত্তার জন্য আগে এখনকার তথ্যের একটি কপি ফাইল আকারে নামিয়ে রাখা হবে।',
        danger: true, confirmText: 'হ্যাঁ, ফিরিয়ে আনুন'
      }).then(function (ok) {
        if (!ok) return;
        F.download('shoeb-motors-before-restore-' + F.today() + '.json', JSON.stringify(DB.state, null, 2), 'application/json');
        DB.state = DB.normalize(data);
        DB.save('restore-file');
        App.applyBranding();
        App.refreshAll();
        UI.toast('ব্যাকআপ থেকে তথ্য ফিরিয়ে আনা হয়েছে।', 'ok');
      });
    };
    reader.readAsText(file);
    ev.target.value = '';
  }

  function openFolder() {
    if (DB.mode === 'server') {
      fetch('api/open-folder').then(function (r) {
        if (!r.ok) throw new Error('folder unavailable');
        UI.toast('আপনার ডেটা ফোল্ডার খোলা হচ্ছে…', 'ok');
      }).catch(function () { UI.toast('নিজে এই ফোল্ডারটি খুলুন: ' + (savedServerPath() || 'ShoebMotors Data Folder'), 'warn', 5000); });
    } else {
      UI.toast('SETUP.bat চালিয়ে local Data Folder প্রস্তুত করুন।', 'warn', 4500);
    }
  }

  function clearAll() {
    UI.confirmDialog({
      title: 'সব তথ্য মুছে ফেলুন?',
      message: 'স্টক, কাস্টমার, বিক্রি, কালেকশন, খরচ ও ডে-ক্লোজিং সব local data খালি হবে।<br><br><b>Local নিরাপত্তার জন্য ShoebMotors\\Data\\Deleted Backup-এ একটি কপি থাকবে।</b><br><b>Online data স্পর্শ করা হবে না।</b> Online Backup সম্পূর্ণ manual-only।',
      danger: true, confirmText: 'সব মুছে ফেলুন',
      extraHtml: '<label style="margin-top:10px">মালিকের পিন<input id="clearPin" type="password" inputmode="numeric" maxlength="6"></label>',
      collect: function () {
        var pin = (document.getElementById('clearPin') || {}).value || '';
        if (pin.trim() !== (DB.state.settings.pin || '')) { UI.toast('পিন ভুল — কিছুই মুছে ফেলা হয়নি।', 'bad'); return false; }
        return true;
      }
    }).then(async function (ok) {
      if (!ok) return;

      // Keep app/shop settings, PIN, theme and low-stock preferences; clear all business records.
      var keepSettings = JSON.parse(JSON.stringify(DB.state.settings || DB.defaultSettings()));
      var fresh = DB.defaultState();
      fresh.settings = keepSettings;
      fresh.settings.setupDone = true;
      fresh.deleted = [];
      fresh.meta.createdAt = new Date().toISOString();
      fresh.meta.updatedAt = fresh.meta.createdAt;
      fresh.meta.lastBackupDay = '';

      if (DB.mode !== 'server') {
        UI.toast('Local Data/server সংযোগ নেই — নিরাপত্তার জন্য কোনো data মুছিনি। SETUP দিয়ে app চালু করে আবার চেষ্টা করুন।', 'bad', 7500);
        return;
      }

      try {
        UI.toast('Local data clear করা হচ্ছে… Online data স্পর্শ করা হবে না।', 'warn', 5000);
        var r = await fetch('api/delete-all', {
          method: 'POST', headers: { 'Content-Type':'application/json; charset=utf-8' },
          body: JSON.stringify({ state:fresh })
        });
        var out = await r.json().catch(function () { return {}; });
        if (!r.ok || !out.ok) throw new Error(out.error || ('Delete failed — server did not return a reason (HTTP ' + r.status + '). local server-এর terminal window চেক করুন।'));
        if (out.localVerifiedEmpty !== true) throw new Error('Local delete verification পাওয়া যায়নি — safety-এর জন্য app state reset করা হয়নি।');

        DB.state = fresh;
        DB.isOwnerUnlocked = true;
        DB.save('delete-all-finalize');
        await DB.flush();
        App.refreshAll();
        UI.toast('সব local data মুছে গেছে এবং local database verify করা হয়েছে। Online data স্পর্শ করা হয়নি। Local Deleted Backup রাখা হয়েছে।', 'ok', 8000);
      } catch (e) {
        UI.toast('কিছুই মুছিনি: ' + (e.message || e) + ' — Deleted Backup থাকলে নির্বাচিত ডেটা ফোল্ডারের Deleted Backup-এ আছে।', 'bad', 9000);
      }
    });
  }

  /* ---- মুছে ফেলা তথ্য (শুধু মালিক) ---- */
  function renderDeleted() {
    var tb = document.querySelector('#delTable tbody');
    if (!tb) return;
    var list = DB.deletedList().slice(0, 40);
    tb.innerHTML = list.length ? list.map(function (d) {
      var s2 = DB.state.settings;
      var kind = d.type === 'sale' ? 'ইনভয়েস' : d.type === 'product' ? 'পণ্য' : d.type === 'customer' ? 'কাস্টমার' : d.type === 'vehicle' ? 'গাড়ি' : 'পুরোনো তথ্য';
      var cls = d.type === 'sale' ? 'bad' : d.type === 'product' ? 'warn' : '';
      return '<tr>' +
        '<td><span class="tag ' + cls + '">' + kind + '</span></td>' +
        '<td><b>' + F.esc(d.label || '—') + '</b>' + (d.customer ? '<div class="cell-sub">' + F.esc(d.customer) + '</div>' : '') + '</td>' +
        '<td class="tiny">' + F.d(d.at) + ' ' + F.time(d.at) + '</td>' +
        '<td class="num">' + (d.amount === undefined || d.amount === null ? '—' : F.money(d.amount)) + '</td>' +
        '<td><div class="row-actions">' +
        (d.type === 'sale' ? '<button class="btn small" data-restore="' + d.id + '">ফিরিয়ে আনুন</button>' : '') +
        '<button class="btn small ghost" data-download="' + d.id + '">সেভ করুন</button>' +
        '</div></td></tr>';
    }).join('') : UI.emptyRow(5, 'কিছু মুছে ফেলা হয়নি।');
    tb.querySelectorAll('[data-restore]').forEach(function (b) { b.onclick = function () { restoreSale(b.getAttribute('data-restore')); }; });
    tb.querySelectorAll('[data-download]').forEach(function (b) {
      b.onclick = function () {
        var d = DB.deletedById(b.getAttribute('data-download'));
        if (!d) return;
        F.download('deleted-' + (d.label || d.id).replace(/[^\w-]+/g, '-') + '.json', JSON.stringify(d, null, 2), 'application/json');
      };
    });
    document.getElementById('delInfo').textContent = DB.deletedList().length + ' টি তথ্য সংরক্ষিত আছে';
  }

  function restoreSale(id) {
    var d = DB.deletedById(id);
    if (!d || !d.data) return;
    var sale = d.data;
    if (DB.state.sales.filter(function (x) { return x.id === sale.id; }).length) {
      UI.toast('এই ইনভয়েসটি তালিকায় আবার আছে।', 'warn'); return;
    }
    var lacking = [];
    (sale.items || []).forEach(function (i) {
      if (!i.productId) return;
      var p = DB.productById(i.productId);
      if (!p) { lacking.push(i.name); return; }
      if (F.num(p.qty) < F.num(i.qty)) lacking.push(i.name);
    });
    UI.confirmDialog({
      title: 'ইনভয়েস ' + (sale.invoiceNo || '') + ' ফিরিয়ে আনবেন?',
      message: (lacking.length ? '<b>স্টকে যথেষ্ট নেই:</b> ' + F.esc(lacking.join(', ')) + '<br><br>' : '') +
        'বিক্রিটি আবার বিক্রির তালিকায় ফিরে আসবে এবং স্টক থেকে পরিমাণ কমে যাবে।',
      confirmText: 'ফিরিয়ে আনুন'
    }).then(function (ok) {
      if (!ok) return;
      (sale.items || []).forEach(function (i) {
        if (!i.productId) return;
        var p = DB.productById(i.productId);
        if (!p) return;
        p.qty = DB.round2(F.num(p.qty) - F.num(i.qty));
      });
      var restoredReceiptIds = {};
      var linked = Array.isArray(d.linkedReceipts) ? d.linkedReceipts.slice() : [];
      // Backward compatibility: older deletes archived each collection separately.
      if (!linked.length) {
        (DB.deletedList() || []).forEach(function (x) {
          if (x && x.type === 'collection' && x.data && x.data.saleId === sale.id) linked.push(x.data);
        });
      }
      DB.state.receipts = DB.state.receipts || [];
      linked.forEach(function (r) {
        if (!r || !r.id) return;
        if (!DB.state.receipts.some(function (x) { return x.id === r.id; })) DB.state.receipts.push(JSON.parse(JSON.stringify(r)));
        restoredReceiptIds[r.id] = true;
      });
      if (sale.collectionTracking === true) {
        var collected = (DB.state.receipts || []).reduce(function (sum, r) {
          return sum + (r.saleId === sale.id && r.type === 'collection' ? F.num(r.amount) : 0);
        }, 0);
        sale.paid = DB.round2(collected);
        sale.due = DB.round2(Math.max(0, F.num(sale.total) - sale.paid));
        sale.credit = DB.round2(Math.max(0, sale.paid - F.num(sale.total)));
      }
      DB.state.sales.push(sale);
      // Remove the sale tombstone and any collection tombstones that were restored.
      DB.state.deleted = (DB.state.deleted || []).filter(function (x) {
        if (x.id === id) return false;
        return !(x.type === 'collection' && x.data && restoredReceiptIds[x.data.id]);
      });
      DB.save();
      renderDeleted();
      if (window.Sales) Sales.render();
      if (window.Dashboard) Dashboard.render();
    });
  }

  function restoreOnlineBackup() {
    UI.confirmDialog({
      title: 'Online Backup থেকে সব data Restore করবেন?',
      message: '<b>এই কাজটি শুধু SSD/PC নষ্ট হলে বা নতুন PC-তে recovery-এর জন্য।</b><br><br>Online-এর সর্বশেষ full snapshot এই PC-এর local SQLite/Data-কে replace করবে। Restore-এর আগে এখনকার local data-এর safety copy local backups folder-এ রাখা হবে।<br><br>Normal কাজের সময় এই button ব্যবহার করার দরকার নেই।',
      danger: true, confirmText: 'Online Backup Restore করুন',
      extraHtml: '<label style="margin-top:10px">মালিকের পিন<input id="onlineRestorePin" type="password" inputmode="numeric" maxlength="6"></label>',
      collect: function () {
        var pin=(document.getElementById('onlineRestorePin')||{}).value||'';
        if (pin.trim() !== (DB.state.settings.pin || '')) { UI.toast('পিন ভুল — Restore শুরু হয়নি।', 'bad'); return false; }
        return true;
      }
    }).then(function(ok){
      if (!ok) return;
      if (!window.Cloud || !Cloud.restoreNow) { UI.toast('Online Restore পাওয়া যায়নি।', 'bad'); return; }
      Cloud.restoreNow();
    });
  }

  function bind() {
    document.getElementById('saveSettingsBtn').onclick = saveDetails;
    document.getElementById('changePinBtn').onclick = changePin;
    document.getElementById('downloadBackupBtn').onclick = downloadBackup;
    document.getElementById('restoreBtn').onclick = function () { document.getElementById('restoreFile').click(); };
    document.getElementById('restoreFile').onchange = restoreFile;
    var onlineRestoreBtn = document.getElementById('onlineRestoreBtn'); if (onlineRestoreBtn) onlineRestoreBtn.onclick = restoreOnlineBackup;
    document.getElementById('saveNowBtn').onclick = function () {
      DB.save();
      setTimeout(function () { renderStorage(); UI.toast('সেভ হয়েছে।', 'ok'); }, 700);
    };
    var syncNowBtn = document.getElementById('syncNowBtn');
    if (syncNowBtn) syncNowBtn.onclick = function () {
      function syncPopup(ok, title, message) {
        UI.modal({
          title: title,
          body: '<p style="font-size:14.5px;margin:4px 0">' + message + '</p>',
          buttons: [
            { label: 'ঠিক আছে', cls: ok ? 'primary' : 'danger', onClick: function () { UI.closeModal(); } }
          ]
        });
      }
      if (!window.Cloud || !Cloud.syncNow) {
        syncPopup(false, 'Online Sync Failed', 'Online Backup সংযোগ পাওয়া যায়নি। Local data নিরাপদ আছে।');
        return;
      }
      syncNowBtn.disabled = true;
      Cloud.syncNow().then(function (out) {
        var complete = !!(out && out.ok === true && out.complete !== false && out.enabled !== false);
        if (complete) {
          syncPopup(true, 'Online Sync Success', 'Online Backup সফলভাবে সম্পূর্ণ হয়েছে।');
        } else {
          var parts = [];
          if (out && out.supabase === true) parts.push('Supabase ✓'); else if (out && out.supabase === false) parts.push('Supabase ✗');
          if (out && out.sheet === true) parts.push('Sheet ✓'); else if (out && out.sheet === false) parts.push('Sheet ✗');
          var detail = parts.length ? '<br><br>' + F.esc(parts.join(' · ')) : '';
          var reason = out && out.error ? '<br><br>' + F.esc(String(out.error)) : '';
          var disabled = out && out.enabled === false ? '<br><br>এই কপিতে Online Backup সংযোগ চালু নেই।' : '';
          syncPopup(false, 'Online Sync Failed', 'Online Backup সম্পূর্ণ হয়নি। Local data নিরাপদ আছে।' + detail + reason + disabled);
        }
        setTimeout(function () { syncNowBtn.disabled = false; renderStorage(); }, 350);
      }).catch(function (e) {
        syncNowBtn.disabled = false;
        syncPopup(false, 'Online Sync Failed', 'Online Backup করা যায়নি। Local data নিরাপদ আছে।<br><br>' + F.esc(e && e.message ? e.message : String(e || 'Unknown error')));
      });
    };
    document.getElementById('setTheme').onchange = function () {
      var v = this.value || 'system';
      if (window.Theme) Theme.set(v);
    };
    document.getElementById('setLang').onchange = function () {
      var l = this.value === 'en' ? 'en' : 'bn';
      var wasEn = Lang.isEn();
      if (l === (wasEn ? 'en' : 'bn')) return;
      Lang.set(l);
      UI.toast(l === 'en' ? 'Language: English' : 'ভাষা: বাংলা', 'warn', 2500);
    };
    document.getElementById('delClearBtn').onclick = function () {
      if (!DB.deletedList().length) { UI.toast('মুছে ফেলা তালিকা খালি।', 'warn'); return; }
      UI.confirmDialog({
        title: 'মুছে ফেলা তালিকা খালি করবেন?',
        message: 'শুধু প্রোগ্রামের ভেতরের তালিকাটি খালি হবে। <b>ডেটা ফোল্ডারের deleted ফোল্ডারের ফাইলগুলো</b> মুছে যাবে না — ওগুলো থাকবে।',
        danger: true, confirmText: 'হ্যাঁ, খালি করুন'
      }).then(function (ok) {
        if (!ok) return;
        DB.state.deleted = [];
        DB.save(); renderDeleted();
      });
    };
    document.getElementById('clearDataBtn').onclick = clearAll;
    document.getElementById('setLogoPick').onclick = function () { document.getElementById('setLogoFile').click(); };
    document.getElementById('setLogoFile').onchange = logoChosen;
    document.getElementById('setLogoClear').onclick = clearLogo;
    var of = document.createElement('button');
    of.className = 'btn ghost';
    of.textContent = '📂 ডেটা ফোল্ডার খুলুন';
    of.onclick = openFolder;
    document.getElementById('saveNowBtn').parentNode.appendChild(of);
  }

  return { fill: fill, bind: bind, renderStorage: renderStorage, openFolder: openFolder };
})();
