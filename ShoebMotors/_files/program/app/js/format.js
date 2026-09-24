/* ================= format.js — money, dates, words, csv ================= */
var F = (function () {
  function cur() { return (DB.state && DB.state.settings.currency) || '৳'; }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var text = String(v == null ? '' : v).trim()
      .replace(/[০-৯]/g, function (d) { return String('০১২৩৪৫৬৭৮৯'.indexOf(d)); })
      .replace(/,/g, '').replace(/৳/g, '').replace(/\s+/g, '');
    var n = parseFloat(text);
    return isNaN(n) || !isFinite(n) ? 0 : n;
  }
  function withCommas(n, dec) {
    n = num(n);
    var neg = n < 0; n = Math.abs(n);
    var parts = n.toFixed(dec === undefined ? 2 : dec).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var out = parts[1] && parseInt(parts[1], 10) !== 0 ? parts[0] + '.' + parts[1] : parts[0];
    return (neg ? '-' : '') + out;
  }
  /* ইংরেজি মোডে সংখ্যা/তারিখ ইংরেজিতে, বাংলা মোডে বাংলায় */
  function enMode() { try { return DB.state.settings.lang === 'en'; } catch (e) { return false; } }
  function money(v, showCur) {
    var s = withCommas(v, 2);
    if (showCur === false) return s;
    return cur() + ' ' + s;
  }
  function moneyPlain(v) { return withCommas(v, 2); }
  /* Bangla digits — used on customer-facing papers (invoice / thermal) */
  function bn(v) {
    if (enMode()) return String(v == null ? '' : v);
    return String(v == null ? '' : v).replace(/[0-9]/g, function (d) { return '০১২৩৪৫৬৭৮৯'.charAt(+d); });
  }
  function qty(v) { return withCommas(v, 0); }
  var BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  var BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  var EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function d(dt) {
    if (!dt) return '';
    var x = new Date(dt);
    if (isNaN(x)) return '';
    if (enMode()) return x.getDate() + ' ' + EN_MONTHS[x.getMonth()] + ' ' + x.getFullYear();
    return x.getDate() + ' ' + BN_MONTHS[x.getMonth()] + ' ' + x.getFullYear();
  }
  function weekday(dt) {
    var x = dt ? new Date(dt) : new Date();
    return enMode() ? EN_DAYS[x.getDay()] : BN_DAYS[x.getDay()];
  }
  function time(dt) {
    var x = dt ? new Date(dt) : new Date();
    var h = x.getHours();
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return String(h12).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0') + ' ' + ampm;
  }
  function dt(dt) { return d(dt) + ', ' + time(dt); }
  function today() { return DB.todayStr(); }
  function addDays(dateStr, n) {
    var x = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    x.setDate(x.getDate() + n);
    return DB.todayStr(x);
  }
  function startOfMonth(dateStr) { return (dateStr || today()).slice(0, 7) + '-01'; }
  function startOfYear(dateStr) { return (dateStr || today()).slice(0, 4) + '-01-01'; }
  function relDay(dateStr) {
    var t = today();
    if (dateStr === t) return enMode() ? 'Today' : 'আজ';
    if (dateStr === addDays(t, -1)) return enMode() ? 'Yesterday' : 'গতকাল';
    return d(dateStr);
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* ===== Bangla amount in words (কোটি / লক্ষ / হাজার / শতক) ===== */
  var BN_NUM = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ',
    'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ', 'বিশ',
    'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আটাশ', 'ঊনত্রিশ', 'ত্রিশ',
    'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ', 'চল্লিশ',
    'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ', 'পঞ্চাশ',
    'একান্ন', 'বাহান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট', 'ষাট',
    'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর', 'সত্তর',
    'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি', 'আশি',
    'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'ঊননব্বই', 'নব্বই',
    'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];
  var BN_HUNDRED = ['', 'একশ', 'দুইশ', 'তিনশ', 'চারশ', 'পাঁচশ', 'ছয়শ', 'সাতশ', 'আটশ', 'নয়শ'];
  function wordsBn(n) {
    n = Math.floor(num(n));
    if (n === 0) return 'শূন্য';
    if (n < 0) return 'ঋণাত্মক ' + wordsBn(-n);
    var out = [];
    function under1000(x) {
      var h = Math.floor(x / 100), r = x % 100, t = [];
      if (h) t.push(BN_HUNDRED[h]);
      if (r) t.push(BN_NUM[r]);
      return t.join(' ');
    }
    var crore = Math.floor(n / 10000000); n = n % 10000000;
    var lakh = Math.floor(n / 100000); n = n % 100000;
    var thousand = Math.floor(n / 1000); n = n % 1000;
    if (crore) out.push((crore > 99 ? wordsBn(crore) : BN_NUM[crore]) + ' কোটি');
    if (lakh) out.push((lakh > 99 ? wordsBn(lakh) : BN_NUM[lakh]) + ' লক্ষ');
    if (thousand) out.push((thousand > 99 ? wordsBn(thousand) : BN_NUM[thousand]) + ' হাজার');
    if (n) out.push(under1000(n));
    return out.join(' ');
  }
  function wordsMoneyBn(v) {
    var n = num(v);
    var taka = Math.floor(n);
    var poisha = Math.round((n - taka) * 100);
    var s = wordsBn(taka) + ' টাকা';
    if (poisha > 0) s += ' এবং ' + wordsBn(poisha) + ' পয়সা';
    return s + ' মাত্র';
  }

  /* Bangladeshi/international numbering: crore / lakh / thousand */
  function words(n) {
    n = Math.floor(num(n));
    if (n === 0) return 'zero';
    var ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
      'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    var tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    function two(x) { return x < 20 ? ones[x] : (tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '')); }
    function three(x) { var o = '', h = Math.floor(x / 100); if (h) o += ones[h] + ' hundred'; if (x % 100) o += (o ? ' ' : '') + two(x % 100); return o; }
    var crore = Math.floor(n / 10000000); n = n % 10000000;
    var lakh = Math.floor(n / 100000); n = n % 100000;
    var th = Math.floor(n / 1000); n = n % 1000;
    var out = [];
    if (crore) out.push(two(crore) + ' crore');
    if (lakh) out.push(two(lakh) + ' lakh');
    if (th) out.push(two(th) + ' thousand');
    if (n) out.push(three(n));
    return out.join(' ');
  }
  function wordsMoney(v) {
    var n = num(v);
    var taka = Math.floor(n), poisha = Math.round((n - taka) * 100);
    var s = words(taka) + ' taka';
    if (poisha > 0) s += ' and ' + words(poisha) + ' poisha';
    return s.charAt(0).toUpperCase() + s.slice(1) + ' only';
  }
  function csv(rows) {
    return '\ufeff' + rows.map(function (r) {
      return r.map(function (c) {
        var s = (c === undefined || c === null) ? '' : String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
  }
  return {
    money: money, moneyPlain: moneyPlain, bn: bn, withCommas: withCommas, qty: qty, num: num, cur: cur,
    d: d, dt: dt, weekday: weekday, time: time, today: today, addDays: addDays, startOfMonth: startOfMonth,
    startOfYear: startOfYear, relDay: relDay, esc: esc, words: words, wordsMoney: wordsMoney,
    csv: csv, download: download,
    wordsBn: wordsBn, wordsMoneyBn: wordsMoneyBn
  };
})();
