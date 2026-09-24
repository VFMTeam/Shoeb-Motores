/* ================= app.js — start-up, login/PIN, setup wizard, router ================= */
var App = (function () {
  var currentView = 'dashboard';
  var booted = false;
  var historyReady = false;
  var historyNavigating = false;

  /* ---------------- branding ---------------- */

  function applyBranding() {
    var st = DB.state.settings;
    document.title = st.shopName + ' — দোকান পরিচালনা';
    document.getElementById('brandName').textContent = st.shopName;
    document.getElementById('brandSub').textContent = st.tagline || 'দোকান পরিচালনা';
    document.getElementById('loginShopName').textContent = st.shopName;
    var lg = st.logoImage || 'img/logo.png';
    var bl = document.getElementById('brandLogo'); if (bl) bl.src = lg;
    var ll = document.getElementById('loginLogo'); if (ll) ll.src = lg;
    var addr = document.getElementById('loginAddress');
    if (addr) addr.textContent = st.address || '';
    var ph = document.getElementById('loginPhone');
    if (ph) ph.textContent = st.phone ? ('মোবাইল: ' + F.bn(st.phone)) : '';
  }

  /* ---------------- lock / unlock ---------------- */
  function applyLock() {
    document.body.classList.toggle('locked', !DB.isOwnerUnlocked);
    document.getElementById('lockBtn').textContent = DB.isOwnerUnlocked ? '🔒 লক' : '🔓 মালিক';
  }

  function requireOwner(cb) {
    if (DB.isOwnerUnlocked) { cb(); return; }
    var pin = DB.state.settings.pin || '';
    UI.modal({
      title: 'মালিকের অনুমতি',
      body: '' +
        '<input id="gatePin" type="password" inputmode="numeric" maxlength="6" class="pin-input" style="font-size:22px;letter-spacing:8px">' +
        '<p class="err" id="gateErr"></p>',
      buttons: [
        { label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
        {
          label: 'চালিয়ে যান', cls: 'primary', onClick: function () {
            var v = (document.getElementById('gatePin') || {}).value || '';
            if (v.trim() !== pin) { document.getElementById('gateErr').textContent = 'পিন ভুল হয়েছে।'; return; }
            DB.isOwnerUnlocked = true;
            applyLock(); UI.closeModal();
            cb();
            refreshAll();
          }
        }
      ],
      onOpen: function (root) {
        var i = root.querySelector('#gatePin');
        i.focus();
        i.onkeydown = function (e) { if (e.key === 'Enter') root.parentNode.querySelectorAll('.modal-foot .btn.primary')[0].click(); };
      }
    });
  }

  /* ---------------- router ---------------- */
var TITLES = {
    dashboard: ['ড্যাশবোর্ড', 'আজকের হিসাব এক নজরে'],
    sale: ['নতুন বিক্রি', 'মোট দিন, ইনভয়েস তৈরি করুন'],
    stock: ['স্টক', 'পণ্যের পরিমাণ ও মূল্য'],
    detailstock: ['Detail Stock', 'ক্যাটাগরি অনুযায়ী মোট স্টক'],
    sales: ['বিক্রি ও ইনভয়েস', 'Invoice খুঁজুন ও print করুন'],
    collections: ['ক্যাশ কালেকশন', 'পুরো বা আংশিক টাকা যোগ করুন'],
    due: ['বাকি তালিকা', 'কার কাছে কত টাকা পাওনা আছে'],
    customers: ['কাস্টমার', 'কাস্টমারের তথ্য ও হিসাব'],
    dayclosing: ['Day Closing', 'দিন শেষে টাকার হিসাব'],
    reports: ['রিপোর্ট', 'লাভ-ক্ষতির রিপোর্ট'],
    settings: ['সেটিংস', 'ইনভয়েস, ডেটা ও নিরাপত্তা']
  };

  /* ---------------- app shell (sidebar + topbar + main) ----------------
     শেলের ভেতরে একটি .app-body তৈরি করে topbar ও appMain-কে
     sidebar-এর পাশে বসায়। লগইন/সেটআপ মূল শেলের বাইরে পড়ে থাকে। */
  function buildShell() {
    var shell = document.getElementById('appShell');
    if (!shell || shell.querySelector('.app-body')) return;
    var body = document.createElement('div');
    body.className = 'app-body';
    shell.appendChild(body);
    var tb = document.getElementById('topbar');
    var main = document.getElementById('appMain');
    if (tb) body.appendChild(tb);
    if (main) body.appendChild(main);
  }

  function syncBrowserHistory(view) {
    if (!historyReady || historyNavigating || !window.history || !window.history.replaceState) return;
    var state = window.history.state || {};
    var nextState = { shoebApp: true, view: view };

    // Keep one dashboard entry underneath the current app page.
    // So Browser Back from any app section returns to Home instead of leaving the app.
    if (view === 'dashboard') {
      window.history.replaceState(nextState, document.title, window.location.href);
    } else if (state.shoebApp && state.view && state.view !== 'dashboard') {
      window.history.replaceState(nextState, document.title, window.location.href);
    } else {
      window.history.pushState(nextState, document.title, window.location.href);
    }
  }

  function initBrowserHistory() {
    if (historyReady || !window.history || !window.history.replaceState) return;
    window.history.replaceState({ shoebApp: true, view: 'dashboard' }, document.title, window.location.href);
    historyReady = true;

    window.addEventListener('popstate', function (e) {
      if (!booted) return;
      var view = e.state && e.state.shoebApp && e.state.view ? e.state.view : 'dashboard';
      historyNavigating = true;
      show(view);
      historyNavigating = false;
    });
  }

  /* ---------------- page-entry rules ----------------
     Every fresh load/reopen starts on Home/Dashboard. No last-page state is
     restored. Settings is protected by its own PIN prompt every time it is
     entered, even when the owner session is already unlocked. */
  var settingsGateBypass = false;

  function requireSettingsPin(cb) {
    var pin = String((DB.state.settings && DB.state.settings.pin) || '');
    if (!pin) { settingsGateBypass = true; cb(); return; }
    UI.modal({
      title: 'সেটিংস খুলতে পিন দিন',
      body: '<input id="settingsGatePin" type="password" inputmode="numeric" maxlength="6" class="pin-input" style="font-size:22px;letter-spacing:8px">' +
        '<p class="err" id="settingsGateErr"></p>',
      buttons: [
        { label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
        {
          label: 'সেটিংস খুলুন', cls: 'primary', onClick: function () {
            var el = document.getElementById('settingsGatePin');
            var v = el ? el.value.trim() : '';
            if (v !== pin) {
              var er = document.getElementById('settingsGateErr');
              if (er) er.textContent = 'পিন ভুল হয়েছে।';
              if (el) { el.value = ''; el.focus(); }
              return;
            }
            settingsGateBypass = true;
            UI.closeModal();
            cb();
          }
        }
      ],
      onOpen: function (root) {
        var el = root.querySelector('#settingsGatePin');
        if (!el) return;
        el.focus();
        el.onkeydown = function (e) {
          if (e.key !== 'Enter') return;
          var btn = root.parentNode && root.parentNode.querySelector('.modal-foot .btn.primary');
          if (btn) btn.click();
        };
      }
    });
  }

  function show(view) {
    if (view === 'settings' && !settingsGateBypass) {
      requireSettingsPin(function () { show('settings'); });
      return;
    }
    if (view === 'settings') settingsGateBypass = false;
    if ((view === 'reports' || view === 'dayclosing') && !DB.isOwnerUnlocked) {
      requireOwner(function () { show(view); });
      return;
    }
    currentView = view;
    syncBrowserHistory(view);
    UI.$$('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + view; });
    UI.$$('.nav-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    var tp = document.getElementById('topbarPage');
    if (tp && TITLES[view]) {
      tp.innerHTML = '<b>' + F.esc(TITLES[view][0]) + '</b>';
    }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'auto' : 'auto' });

    if (view === 'dashboard') Dashboard.render();
    if (view === 'stock') Stock.render();
    if (view === 'detailstock') Stock.renderDetailStock();
    if (view === 'sales') Sales.render();
    if (view === 'collections') Collections.render();
    if (view === 'due') DueList.render();
    if (view === 'dayclosing') DayClosing.render();
    if (view === 'customers') Customers.render();
    if (view === 'customer') { /* rendered by Customers.open */ }
    if (view === 'reports') Reports.render();
    if (view === 'settings') Settings.fill();
    if (view === 'sale') Sale.onShow();
  }

  function refreshAll() {
    applyLock();
    if (!booted) return;
    if (currentView === 'dashboard') Dashboard.render();
    if (currentView === 'stock') Stock.render();
    if (currentView === 'detailstock') Stock.renderDetailStock();
    if (currentView === 'sales') Sales.render();
    if (currentView === 'collections') Collections.render();
    if (currentView === 'due') DueList.render();
    if (currentView === 'dayclosing') DayClosing.render();
    if (currentView === 'customers') Customers.render();
    if (currentView === 'reports') Reports.render();
    if (currentView === 'settings') Settings.fill();
  }

  /* ---------------- setup wizard ---------------- */
  function showSetup() {
    UI.$$('.view').forEach(function (v) { v.hidden = v.id !== 'view-setup'; });
    var shell = document.getElementById('appShell'); if (shell) shell.hidden = true;
    document.getElementById('topbar').hidden = true;
    document.getElementById('appMain').hidden = true;
    var st = DB.state.settings;
    /* First-run setup fields intentionally open blank. No auto values. */
    document.getElementById('setupShopName').value = '';
    document.getElementById('setupShopNameBn').value = '';
    document.getElementById('setupShopTag').value = '';
    document.getElementById('setupAddress').value = '';
    document.getElementById('setupPhone').value = '';
    document.getElementById('setupPrefix').value = '';
    document.getElementById('setupCurrency').value = '';
    document.getElementById('setupPin').value = '';
    document.getElementById('setupPin2').value = '';
  }

  function bindSetup() {
    document.getElementById('finishSetupBtn').onclick = function () {
      var err = document.getElementById('setupError');
      err.textContent = '';
      var name = document.getElementById('setupShopName').value.trim();
      var pin = document.getElementById('setupPin').value.trim();
      var pin2 = document.getElementById('setupPin2').value.trim();
      if (!name) { err.textContent = 'অনুগ্রহ করে দোকানের নাম লিখুন।'; return; }
      if (!/^[0-9]{4,6}$/.test(pin)) { err.textContent = 'পিন ৪ থেকে ৬ সংখ্যার হতে হবে (শুধু সংখ্যা)।'; return; }
      if (pin !== pin2) { err.textContent = 'দুইবার লেখা পিন মিলছে না।'; return; }

      var st = DB.state.settings;
      st.shopName = name;
      st.shopNameBn = document.getElementById('setupShopNameBn').value.trim();
      st.tagline = document.getElementById('setupShopTag').value.trim();
      st.address = document.getElementById('setupAddress').value.trim();
      st.phone = document.getElementById('setupPhone').value.trim();
      st.invoicePrefix = document.getElementById('setupPrefix').value.trim() || 'INV';
      st.currency = document.getElementById('setupCurrency').value.trim() || '৳';
      st.pin = pin;
      st.setupDone = true;

      DB.isOwnerUnlocked = true;
      DB.save();
      enterApp();
    };
  }

  /* ---------------- login ---------------- */
  function showLogin() {
    UI.$$('.view').forEach(function (v) { v.hidden = v.id !== 'view-login'; });
    var shell = document.getElementById('appShell'); if (shell) shell.hidden = true;
    document.getElementById('topbar').hidden = true;
    document.getElementById('appMain').hidden = true;
    var st = DB.state.settings;
    document.getElementById('loginShopName').textContent = st.shopName;
    var addrLine = document.getElementById('loginAddress');
    if (addrLine) addrLine.textContent = st.address || '';
    var phLine = document.getElementById('loginPhone');
    if (phLine) phLine.textContent = st.phone ? ('মোবাইল: ' + F.bn(st.phone)) : '';
    var modeTag = document.getElementById('modeTag');
    if (modeTag) { modeTag.hidden = true; modeTag.textContent = ''; }
    var pinSet = !!(st.pin || '');
    document.getElementById('pinLoginBtn').hidden = !pinSet;
    document.getElementById('setPinFirstBtn').hidden = pinSet;
    document.getElementById('pinInput').value = '';
    document.getElementById('pinError').textContent = '';
    setTimeout(function () { document.getElementById('pinInput').focus(); }, 100);
  }

  function bindLogin() {
    var btn = document.getElementById('pinLoginBtn');
    btn.onclick = function () {
      var v = document.getElementById('pinInput').value.trim();
      if (v === (DB.state.settings.pin || '')) {
        DB.isOwnerUnlocked = true;
        enterApp();
      } else {
        document.getElementById('pinError').textContent = 'পিন ভুল হয়েছে। আবার চেষ্টা করুন।';
        document.getElementById('pinInput').value = '';
      }
    };
    document.getElementById('pinInput').onkeydown = function (e) { if (e.key === 'Enter') { if (document.getElementById('pinLoginBtn').hidden) document.getElementById('setPinFirstBtn').click(); else btn.click(); } };
    document.getElementById('setPinFirstBtn').onclick = function () {
      UI.modal({
        title: 'আপনার মালিক পিন তৈরি করুন',
        body: '' +
          '<input id="np1" type="password" inputmode="numeric" maxlength="6" class="pin-input" style="font-size:20px;letter-spacing:6px">' +
          '<input id="np2" type="password" inputmode="numeric" maxlength="6" class="pin-input" style="font-size:20px;letter-spacing:6px">' +
          '<p class="err" id="npErr"></p>',
        buttons: [
          { label: 'বাতিল', cls: 'ghost', onClick: UI.closeModal },
          {
            label: 'পিন সেভ করুন', cls: 'primary', onClick: function () {
              var a = document.getElementById('np1').value.trim(), b = document.getElementById('np2').value.trim();
              if (!/^[0-9]{4,6}$/.test(a)) { document.getElementById('npErr').textContent = 'পিন ৪–৬ সংখ্যার হতে হবে।'; return; }
              if (a !== b) { document.getElementById('npErr').textContent = 'দুইবার লেখা পিন মিলছে না।'; return; }
              DB.state.settings.pin = a;
              DB.isOwnerUnlocked = true;
              DB.save(); UI.closeModal(); enterApp();
            }
          }
        ]
      });
    };
  }

  /* ---------------- enter app ---------------- */
  function enterApp() {
    var shell = document.getElementById('appShell'); if (shell) shell.hidden = false;
    document.getElementById('topbar').hidden = false;
    document.getElementById('appMain').hidden = false;
    UI.$$('.view').forEach(function (v) { if (v.id === 'view-login' || v.id === 'view-setup') v.hidden = true; });
    booted = true;
    applyBranding();
    applyLock();
    initBrowserHistory();
    try { window.localStorage.removeItem('shoebmotors.lastView'); } catch (e) { /* old versions */ }
    show('dashboard');
    // Reminder only; this never uploads, downloads or retries cloud data.
    if (window.Cloud && Cloud.remindIfNeeded) setTimeout(function () { Cloud.remindIfNeeded(); }, 900);
  }

  /* ---------------- boot ---------------- */
  function bindShell() {
    UI.$$('.nav-btn').forEach(function (b) {
      b.onclick = function () { show(b.getAttribute('data-view')); };
    });
    UI.$$('.nav-more-item').forEach(function (b) {
      b.onclick = function () {
        var more = document.getElementById('navMore');
        if (more) more.open = false;
        show(b.getAttribute('data-view'));
      };
    });
    document.getElementById('lockBtn').onclick = function () {
      if (DB.isOwnerUnlocked) {
        DB.isOwnerUnlocked = false;
        applyLock();
        showLogin();
      } else {
        requireOwner(function () { applyLock(); refreshAll(); });
      }
    };
    Dashboard.bind(); Stock.bind(); Sale.bind(); Sales.bind(); Collections.bind(); DueList.bind(); DayClosing.bind(); Customers.bind();
    Reports.bind(); Settings.bind();
    bindLogin(); bindSetup();
    if (window.Lang) { Lang.bind(); }

    document.addEventListener('keydown', function (e) {
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        var views = ['dashboard', 'sale', 'stock', 'sales', 'collections', 'due', 'dayclosing', 'customers', 'reports'];
        var v = views[parseInt(e.key, 10) - 1];
        if (v && booted) { e.preventDefault(); show(v); }
      }
    });
    window.addEventListener('beforeunload', function () { try { DB.flush(); } catch (e) { } });
    document.addEventListener('visibilitychange', function () { if (document.hidden) DB.flush(); });
    setInterval(function () { DB.flush(); }, 120000);
  }

  function boot() {
    return DB.load().then(function (info) {
      buildShell();
      if (window.Theme) Theme.apply();
      bindShell();
      if (DB.state.settings.pin && !DB.isOwnerUnlocked) {
        showLogin();
      } else {
        // Once the owner has logged in, refresh must NOT lock the app again.
        // It locks only when the Lock button is explicitly pressed.
        DB.isOwnerUnlocked = true;
        enterApp();
      }
    });
  }

  return {
    boot: boot, show: show, refreshAll: refreshAll, requireOwner: requireOwner,
    applyBranding: applyBranding, applyLock: applyLock,
    get currentView() { return currentView; }
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  App.boot().catch(function (e) {
    console.error(e);
    alert('চালু হতে সমস্যা: ' + (e.message || e));
  });
});
