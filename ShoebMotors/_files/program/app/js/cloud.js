/* ================= cloud.js — MANUAL-ONLY online backup =================
   Local work never starts a network request. Invoice, stock, customer and all
   other business saves remain local-first. The ONLY upload path is syncNow(),
   called by the explicit "☁ এখনই Online Backup" button.

   Reminder rule: if local data changed after the last successful online backup
   and that unsynced change is from a previous calendar day, show one reminder
   when the app opens. No timed/automatic upload or retry exists here.
*/
var Cloud = (function () {
  var busy = false;
  var lastStatus = null;
  var REMINDER_KEY = 'shoebmotors.onlineBackupReminderDay';

  function available() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }
  function en() {
    try { return !!(window.Lang && Lang.isEn && Lang.isEn()); } catch (e) { return false; }
  }
  function txt(bn, english) { return en() ? english : bn; }
  function dayOf(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }
  function today() { return dayOf(new Date()); }

  function hideGlobalPill() {
    var p = document.getElementById('cloudPill');
    if (p) { p.hidden = true; p.textContent = ''; }
  }

  function getStatus() {
    if (!available()) return Promise.resolve(null);
    return fetch('api/cloud/status', { cache:'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (st) { lastStatus = st || lastStatus; return st; })
      .catch(function () { return null; });
  }

  function syncNow() {
    if (!available() || busy) return Promise.resolve(null);
    busy = true;
    return fetch('api/cloud/push', { method:'POST', cache:'no-store' })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (out) {
          out = out || {};
          if (!r.ok && !out.error) out.error = 'HTTP ' + r.status;
          return { httpOk:r.ok, out:out };
        });
      })
      .then(function (result) {
        busy = false;
        var out = result && result.out || {};
        lastStatus = out;
        if (out.enabled === false) {
          if (window.UI && UI.toast) UI.toast(txt('এই কপিতে Online Backup সংযোগ চালু নেই। অনলাইনে কোনো ডেটা পাঠানো হয়নি।', 'Online Backup is not configured for this copy. No data was uploaded.'), 'warn', 7000);
          return out;
        }
        var complete = result && result.httpOk && out.ok === true && out.complete !== false;
        var recoverySafe = result && result.httpOk && (out.recoverySafe === true || out.supabase === true || complete);
        if (complete || recoverySafe) {
          try { localStorage.removeItem(REMINDER_KEY); } catch (e) { }
          if (window.UI && UI.toast) {
            var zipNote = out.localZip ? txt(' Local full ZIP: ', ' Local full ZIP: ') + out.localZip : '';
            if (complete) UI.toast(txt('Online backup সম্পূর্ণ হয়েছে।', 'Online backup completed.') + zipNote, 'ok', 5000);
            else UI.toast(txt('Online backup আংশিক হয়েছে। Supabase/Sheet status নিচে দেখুন।', 'Online backup partially completed. Check Supabase/Sheet status below.') + zipNote, 'warn', 7500);
          }
          return out;
        }
        if (window.UI && UI.toast) {
          var parts = [];
          if (out.supabase === true) parts.push('Supabase ✓'); else if (out.supabase === false) parts.push('Supabase ✗');
          if (out.sheet === true) parts.push('Sheet ✓'); else if (out.sheet === false) parts.push('Sheet ✗');
          var detail = parts.length ? (' (' + parts.join(' · ') + ')') : '';
          UI.toast(txt('Online backup সম্পূর্ণ হয়নি' + detail + '। Local data নিরাপদ আছে — পরে আবার Manual Backup চাপুন।', 'Online backup did not complete' + detail + '. Local data is safe — try Manual Backup again later.'), 'warn', 7000);
        }
        return out;
      })
      .catch(function () {
        busy = false;
        if (window.UI && UI.toast) UI.toast(txt('Internet/Cloud পাওয়া যায়নি। Local data নিরাপদ আছে — কোনো auto retry হবে না।', 'Internet/Cloud is unavailable. Local data is safe — there will be no automatic retry.'), 'warn', 5500);
        return null;
      });
  }

  function restoreNow() {
    if (!available() || busy) return Promise.resolve(null);
    busy = true;
    return fetch('api/cloud/restore', { method:'POST', cache:'no-store', headers:{'Content-Type':'application/json; charset=utf-8'}, body:JSON.stringify({confirm:true}) })
      .then(function(r){ return r.json().catch(function(){return {};}).then(function(out){ return {httpOk:r.ok,out:out||{}}; }); })
      .then(function(result){
        busy=false;
        var out=result.out||{};
        if (!result.httpOk || !out.ok) throw new Error(out.error || 'Online restore failed');
        if (window.UI && UI.toast) UI.toast(txt('Online Backup থেকে local data restore হয়েছে। App আবার খুলছে…', 'Local data was restored from Online Backup. Reopening the app…'), 'ok', 5000);
        setTimeout(function(){ location.reload(); }, 900);
        return out;
      })
      .catch(function(e){
        busy=false;
        if (window.UI && UI.toast) UI.toast(txt('Restore হয়নি: ', 'Restore failed: ') + (e && e.message ? e.message : e), 'bad', 7500);
        return null;
      });
  }

  function remindIfNeeded() {
    hideGlobalPill();
    if (!available()) return Promise.resolve(null);
    return getStatus().then(function (st) {
      if (!st || !st.enabled || !st.needsReminder) return st;
      var td = today();
      var already = '';
      try { already = localStorage.getItem(REMINDER_KEY) || ''; } catch (e) { }
      if (already === td) return st;
      try { localStorage.setItem(REMINDER_KEY, td); } catch (e) { }
      if (window.UI && UI.toast) {
        UI.toast(txt('☁ মনে করিয়ে দিচ্ছি: আগের দিনের পরিবর্তন এখনো Online Backup করা হয়নি। সময় হলে “এখনই Online Backup” চাপুন।', '☁ Reminder: changes from a previous day have not been backed up online yet. Use “Online Backup Now” when convenient.'), 'warn', 9000);
      }
      return st;
    });
  }

  // Compatibility no-ops: older modules may still call these names. They NEVER touch network.
  function noAuto() { return Promise.resolve(null); }

  hideGlobalPill();
  return {
    autoPush:noAuto,
    autoReconcile:noAuto,
    syncNow:syncNow,
    restoreNow:restoreNow,
    status:getStatus,
    remindIfNeeded:remindIfNeeded,
    lastStatus:function () { return lastStatus; }
  };
})();
