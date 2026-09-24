/* ================= theme.js — System / Dark / Light appearance =================
   Appearance is a browser/UI preference only. Business data is not stored here.
   Default = System. System mode follows prefers-color-scheme through one change event
   listener (no timer/polling/repeated function calls). Manual Dark/Light persists. */
var Theme = (function () {
  var PREF_KEY = 'shoebMotorsThemeV2';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var bound = false;

  function valid(v) { return v === 'dark' || v === 'light' || v === 'system'; }
  function choice() {
    var v = '';
    try { v = localStorage.getItem(PREF_KEY) || ''; } catch (e) { }
    return valid(v) ? v : 'system';
  }
  function remember(v) {
    try { localStorage.setItem(PREF_KEY, v); } catch (e) { }
  }
  function resolved(v) {
    v = valid(v) ? v : choice();
    if (v === 'system') return (mq && mq.matches) ? 'dark' : 'light';
    return v;
  }
  function paintBtn() {
    var b = document.getElementById('themeBtn');
    if (!b) return;
    var c = choice(), dark = resolved(c) === 'dark';
    b.textContent = dark ? '☀️' : '🌙';
    b.title = c === 'system'
      ? (dark ? 'System: Dark — click for Light' : 'System: Light — click for Dark')
      : (dark ? 'Dark mode — click for Light' : 'Light mode — click for Dark');
  }
  function syncSettingsControl() {
    var el = document.getElementById('setTheme');
    if (el && el.value !== choice()) el.value = choice();
  }
  function apply(v) {
    v = valid(v) ? v : choice();
    var r = resolved(v);
    document.documentElement.setAttribute('data-theme', r);
    document.documentElement.setAttribute('data-theme-choice', v);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', r === 'dark' ? '#090e14' : '#f5f6f7');
    paintBtn();
    syncSettingsControl();
    return r;
  }
  function set(v) {
    v = valid(v) ? v : 'system';
    remember(v);
    // Keep the in-memory setting compatible with backups, but browser preference is authoritative.
    try { if (DB && DB.state && DB.state.settings) DB.state.settings.theme = v; } catch (e) { }
    return apply(v);
  }
  function toggle() {
    // Quick button intentionally chooses an explicit mode; Settings can switch back to System.
    set(resolved() === 'dark' ? 'light' : 'dark');
  }
  function onSystemChange() {
    if (choice() === 'system') apply('system');
  }
  function bindSystemOnce() {
    if (!mq || bound) return;
    bound = true;
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }
  bindSystemOnce();
  // First run/upgrade: System is the default and is saved as a UI preference.
  if (!valid(choice())) remember('system');
  apply(choice());
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('themeBtn');
    if (btn) btn.onclick = toggle;
    apply(choice());
  }, { once:true });
  return { apply: apply, set: set, toggle: toggle, choice: choice, resolved: resolved };
})();
