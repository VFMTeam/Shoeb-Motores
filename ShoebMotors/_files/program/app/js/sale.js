/* ================= sale.js — New Sale (POS), cart, invoice creation ================= */
var Sale = (function () {
  var cart = [];
  var customerId = '';
  var linkedPhoneOriginal = '';
  var manualCustomerEntry = false;
  var walkInCash = false;
  function setWalkInCash(on) {
    walkInCash = !!on;
    var b = document.getElementById("saleCustClear");
    if (b) { b.classList.toggle("primary", walkInCash); b.classList.toggle("ghost", !walkInCash); b.setAttribute("aria-pressed", String(walkInCash)); }
  }
  var vehicleNo = '';
  var prodIndex = -1;
  var savingSale = false;

  function reset() {
    manualCustomerEntry = false;
    cart = []; customerId = ''; linkedPhoneOriginal = ''; vehicleNo = ''; prodIndex = -1;
    document.getElementById('saleProdSearch').value = '';
    document.getElementById('billDiscount').value = '';
    document.getElementById('billDiscountReason').value = '';
    var sdCb = document.getElementById('saleShowDiscount'); if (sdCb) sdCb.checked = false;
    setWalkInCash(false);
    document.getElementById('saleError').textContent = '';
    hideCustBox();
    var np = document.getElementById('saleNewPhone'); if (np) np.value = '';
    var nv = document.getElementById('saleNewVehicle'); if (nv) nv.value = '';
    var nnb = document.getElementById('saleNewNameBn'); if (nnb) nnb.value = '';
    var narea = document.getElementById('saleNewArea'); if (narea) narea.value = '';
    var refMode = document.getElementById('saleReferenceMode'); if (refMode) refMode.value = 'none';
    var refFields = document.getElementById('saleReferenceFields'); if (refFields) refFields.hidden = true;
    var refName = document.getElementById('saleReferenceName'); if (refName) refName.value = '';
    var refPhone = document.getElementById('saleReferencePhone'); if (refPhone) refPhone.value = '';
    var refAddress = document.getElementById('saleReferenceAddress'); if (refAddress) refAddress.value = '';
    var nb = document.getElementById('newCustBox'); if (nb) nb.hidden = false;
    renderCart();
  }

  function setCustomer(id, vehicle) {
    setWalkInCash(false);
    manualCustomerEntry = false;
    customerId = id || '';
    var c = customerId ? DB.customerById(customerId) : null;
    if (c) {
      showCustBox(c, vehicle);
    } else {
      hideCustBox();
    }
    renderCart();
    setTimeout(function () { document.getElementById('saleProdSearch').focus(); }, 80);
  }

  function showCustBox(c, vehicle) {
    var box = document.getElementById('saleCustBox');
    var nb = document.getElementById('newCustBox');
    if (nb) nb.hidden = true;
    var st = DB.customerStats(c.id);
    linkedPhoneOriginal = c.phone || '';
    var vehOptions = (c.vehicles || []).map(function (v) {
      return '<option value="' + F.esc(v.number || '') + '"' + ((vehicle && vehicle.id === v.id) || (!vehicle && v.number === vehicleNo) ? ' selected' : '') + '>' + F.esc(v.number || 'নম্বরবিহীন গাড়ি') + (v.model ? ' — ' + F.esc(v.model) : '') + '</option>';
    }).join('');
    vehicleNo = vehicle ? vehicle.number : ((c.vehicles || [])[0] ? c.vehicles[0].number : '');
    box.innerHTML =
      '<div><div class="cb-name">' + F.esc(c.nameBn || c.name) + '</div>' +
      '<label class="tiny muted linked-phone-label">মোবাইল নম্বর<input id="saleLinkedPhone" class="mini-input mono" inputmode="text" value="' + F.esc(c.phone) + '"></label>' +
      '<div class="tiny muted">' + st.count + ' বার কেনা · মোট ' + F.money(st.total) + '</div>' +
      '<div class="row" style="margin-top:6px;gap:6px"><span class="tiny muted">গাড়ির নম্বর:</span>' +
      ((c.vehicles || []).length
        ? '<select id="saleVehicleSel" style="width:auto;max-width:330px;padding:5px 8px;font-size:13px">' + vehOptions + '</select>' +
        '<button class="btn small ghost" id="saleAddVeh">＋ যোগ</button>'
        : '<button class="btn small ghost" id="saleAddVeh">＋ গাড়ির নম্বর যোগ করুন</button>') +
      '</div>' +
      '</div>' +
      '<div class="row"><button class="btn small ghost" id="saleCustOpen">প্রোফাইল</button><button class="btn small" id="saleCustChange">বদলান</button></div>';
    box.hidden = false;
    var linkedPhone = document.getElementById('saleLinkedPhone');
    linkedPhone.addEventListener('input', function (e) { if (!e.isComposing) unlinkChangedPhone(true); });
    linkedPhone.addEventListener('compositionend', function () { unlinkChangedPhone(true); });
    var sel = document.getElementById('saleVehicleSel');
    if (sel) sel.onchange = function () { vehicleNo = sel.value; };
    document.getElementById('saleCustChange').onclick = function () {
      setCustomer('');
      var nameEl = document.getElementById('saleNewNameBn');
      if (nameEl) nameEl.focus();
    };
    document.getElementById('saleCustOpen').onclick = function () { Customers.open(c.id); };
    document.getElementById('saleAddVeh').onclick = function () { Customers.form(c.id); };
  }
  function unlinkChangedPhone(focusPhone) {
    if (!customerId) return false;
    var input = document.getElementById('saleLinkedPhone');
    if (!input || phoneKey(input.value) === phoneKey(linkedPhoneOriginal)) return false;
    var raw = input.value, caret = input.selectionStart;
    var previous = DB.customerById(customerId);
    customerId = ''; linkedPhoneOriginal = ''; manualCustomerEntry = true;
    hideCustBox();
    document.getElementById('saleNewNameBn').value = previous ? previous.nameBn || previous.name || '' : '';
    document.getElementById('saleNewArea').value = previous ? [previous.addressBn, previous.address].filter(function (v,i,a) { return v && a.indexOf(v) === i; }).join(', ') : '';
    document.getElementById('saleNewVehicle').value = '';
    var phone = document.getElementById('saleNewPhone');
    phone.value = raw;
    if (focusPhone) {
      phone.focus();
      if (caret !== null) phone.setSelectionRange(caret, caret);
    }
    return true;
  }
  function hideCustBox() {
    var box = document.getElementById('saleCustBox');
    box.hidden = true; box.innerHTML = '';
    var nb = document.getElementById('newCustBox');
    if (nb) nb.hidden = false;
    vehicleNo = '';
  }

  /* ---------------- customer search ---------------- */
  function phoneKey(v) { return String(v || '').replace(/[^0-9০-৯]/g, '').replace(/[০-৯]/g, function (d) { return String('০১২৩৪৫৬৭৮৯'.indexOf(d)); }); }
  function digitsOnly(v) { return phoneKey(v).slice(0, 15); }
  function exactCustomerByPhone(v) {
    var q = phoneKey(v);
    if (q.length < 6) return null;

    // First use the customer's current saved number.
    var direct = DB.state.customers.filter(function (c) { return phoneKey(c.phone) === q; })[0];
    if (direct) return direct;

    // Also honor a number stored on an older invoice. This lets an old invoice number
    // find the same linked customer even if the customer's current number was edited later.
    var sales = (DB.state.sales || []).slice().sort(function (a, b) { return new Date(b.date || 0) - new Date(a.date || 0); });
    for (var i = 0; i < sales.length; i++) {
      var sale = sales[i];
      if (phoneKey(sale.customerPhone) !== q || !sale.customerId) continue;
      var linked = DB.customerById(sale.customerId);
      if (linked) return linked;
    }
    return null;
  }
  /* ---------------- product search ---------------- */
  function prodDetailLine(p) {
    return [Stock.productType(p), Stock.real(p.brand), Stock.real(p.size), Stock.real(p.model)].filter(Boolean).join(' · ');
  }

  function prodShowAll() {
    var box = document.getElementById('saleProdResults');
    var list = DB.state.products.filter(function (p) { return p.active !== false && F.num(p.qty) > 0; }).slice(0, 15);
    prodIndex = list.length ? 0 : -1;
    box.innerHTML = list.length ? list.map(function (p, i) {
      var detail = prodDetailLine(p);
      return '<div class="s-item' + (i === 0 ? ' sel' : '') + '" data-pid="' + p.id + '" data-i="' + i + '">' +
        '<div><div class="s-title">' + F.esc(Stock.label(p)) + '</div>' +
        (detail ? '<div class="s-sub">' + F.esc(detail) + '</div>' : '') +
        '<div class="s-sub"><b style="color:var(--green)">\u09B8\u09CD\u099F\u0995 ' + F.qty(p.qty) + '</b></div></div>' +
        '<div class="s-right">' + (F.money(p.sellPrice)) + '</div></div>';
    }).join('') : '';
    box.hidden = false;
    box.querySelectorAll('.s-item[data-pid]').forEach(function (el) {
      el.onclick = function () {
        addToCart(el.getAttribute('data-pid'));
        box.hidden = true;
        document.getElementById('saleProdSearch').value = '';
      };
    });
  }

  function prodSearchInput() {
    var q = document.getElementById('saleProdSearch').value.trim();
    var box = document.getElementById('saleProdResults');
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }
    var list = Stock.search(q).filter(function (p) { return p.active !== false; }).slice(0, 10);
    prodIndex = list.length ? 0 : -1;
    box.innerHTML = list.length ? list.map(function (p, i) {
      var out = F.num(p.qty) <= 0;
      var detail = prodDetailLine(p);
      return '<div class="s-item' + (i === 0 ? ' sel' : '') + '" data-pid="' + p.id + '" data-i="' + i + '">' +
        '<div><div class="s-title">' + F.esc(Stock.label(p)) + '</div>' +
        (detail ? '<div class="s-sub">' + F.esc(detail) + '</div>' : '') +
        '<div class="s-sub"><b style="' + (out ? 'color:var(--red)' : 'color:var(--green)') + '">' + (out ? 'স্টক নেই' : 'স্টক ' + F.qty(p.qty)) + '</b></div></div>' +
        '<div class="s-right">' + (F.money(p.sellPrice)) + '</div></div>';
    }).join('') : '<div class="s-item" data-custom="1"><div><div class="s-title">＋ নতুন পণ্য — “' + F.esc(q) + '”</div></div></div>';
    box.hidden = false;
    box.querySelectorAll('.s-item').forEach(function (el) {
      el.onclick = function () {
        if (el.getAttribute('data-custom')) customItemForm(q);
        else addToCart(el.getAttribute('data-pid'));
        box.hidden = true;
        document.getElementById('saleProdSearch').value = '';
      };
    });
  }

  function addToCart(pid, qty) {
    var p = DB.productById(pid);
    if (!p) return;
    var invDescription = String(p.description || p.name || '').trim();
    var invBrand = String(p.brand || '').trim();
    var invSize = String(p.size || '').trim();
    var invPrice = F.num(p.sellPrice);
    if (!invDescription || !invBrand || !invSize) {
      UI.toast('এই পণ্যের Invoice তথ্য অসম্পূর্ণ। Stock থেকে Edit করে বিবরণ, ব্র্যান্ড ও সাইজ পূরণ করুন।', 'bad', 6000);
      return;
    }
    var at = cart.findIndex(function (l) { return l.productId === pid; });
    if (at >= 0) {
      var line = cart[at];
      line.qty += (qty || 1);
      /* যে টায়ারটি এখন নির্বাচন করা হয়েছে সেটিই সবসময় প্রথমে দেখাই */
      if (at > 0) { cart.splice(at, 1); cart.unshift(line); }
    } else {
      cart.unshift({
        productId: p.id, name: Stock.label(p), description: p.description || p.name || Stock.label(p), brand: p.brand, size: p.size, type: String(p.type || '').trim(), model: String(p.model || '').trim(), code: p.code,
        qty: qty || 1, price: invPrice, cost: F.num(p.buyPrice), stock: F.num(p.qty),
        pending: invPrice <= 0
      });
    }
    renderCart();
    var first = document.querySelector('#cartTable tbody tr');
    if (first) {
      first.classList.add('cart-new-line');
      setTimeout(function () { first.classList.remove('cart-new-line'); }, 900);
    }
  }
  function customItemForm(q) {
    Stock.form(null, null, {
      description: q || '',
      onCreate: function (product, qty) { addToCart(product.id, qty); }
    });
  }
  /* কার্টে কী ধরনের পণ্য আছে তার উপর ভিত্তি করে "গাড়ির নম্বর" ফিল্ডের লেবেল বদলায় —
     ইনভয়েসে যে লেবেল ছাপা হবে (UI.invoiceReferenceLabel), ঠিক সেই একই নিয়ম এখানেও। */
  function updateVehicleFieldLabel() {
    var el = document.getElementById('saleVehicleLabel');
    if (el && window.UI && UI.invoiceReferenceLabel) el.textContent = UI.invoiceReferenceLabel({ items: cart });
  }
  function renderCart() {
    updateVehicleFieldLabel();
    var tb = document.querySelector('#cartTable tbody');
    tb.innerHTML = cart.length ? cart.map(function (l, i) {
      var warn = (l.stock !== null && l.stock !== undefined && l.qty > l.stock) ? ' <span class="tag bad" style="font-size:10px">স্টকে মাত্র ' + l.stock + '</span>' : '';
      var pend = '';
      return '<tr>' +
        '<td class="num">' + F.bn(i + 1) + '</td>' +
        '<td><div class="cell-main">' + F.esc(l.description || l.name) + pend + '</div></td>' +
        '<td>' + F.esc(l.brand || 'অসম্পূর্ণ') + '</td>' +
        '<td>' + F.esc(l.size || 'অসম্পূর্ণ') + '</td>' +
        '<td class="num"><div class="row" style="justify-content:flex-end;gap:3px">' +
        '<button class="qty-btn" data-minus="' + i + '">−</button>' +
        '<input class="mini-input" style="width:52px;text-align:center" type="number" min="1" step="1" value="' + l.qty + '" data-qty="' + i + '">' +
        '<button class="qty-btn" data-plus="' + i + '">+</button></div>' + warn + '</td>' +
        '<td class="num"><div class="price-edit"><input class="mini-input" style="width:110px" type="number" step="0.01" min="0" value="' + (F.num(l.price) > 0 ? l.price : '') + '" data-price="' + i + '"><button class="qty-btn price-later" type="button" data-clear-price="' + i + '" title="দর মুছুন">দর মুছুন</button></div></td>' +
        '<td class="num"><input class="mini-input line-total-input" style="width:120px" type="number" step="0.01" min="0" value="' + (F.num(l.price) > 0 ? DB.round2(l.qty * l.price) : '') + '" data-total="' + i + '"></td>' +
        '<td><div class="row-actions"><button class="btn small ghost" data-del="' + i + '">✕</button></div></td>' +
        '</tr>';
    }).join('') : '';

    tb.querySelectorAll('[data-qty]').forEach(function (inp) {
      inp.onchange = function () { changeQty(+inp.getAttribute('data-qty'), F.num(inp.value)); };
    });
    tb.querySelectorAll('[data-price]').forEach(function (inp) {
      inp.onchange = function () {
        var i = +inp.getAttribute('data-price');
        var raw = String(inp.value || '').trim();
        var v = raw ? F.num(raw) : 0;
        cart[i].price = v > 0 ? v : 0;
        cart[i].pending = !(v > 0);
        renderCart();
      };
    });
    /* মোট টাকা লিখলে পরিমাণ দিয়ে ভাগ করে এক পিসের দর নিজে বসে; পরে পরিমাণ বদলালে দর একই থাকে, মোট বাড়ে-কমে */
    tb.querySelectorAll('[data-total]').forEach(function (inp) {
      inp.onchange = function () {
        var i = +inp.getAttribute('data-total');
        var raw = String(inp.value || '').trim();
        var t = raw ? F.num(raw) : 0;
        var q = F.num(cart[i].qty) || 1;
        cart[i].price = t > 0 ? DB.round2(t / q) : 0;
        cart[i].pending = !(t > 0);
        renderCart();
      };
    });
    tb.querySelectorAll('[data-clear-price]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute('data-clear-price');
        if (!cart[i]) return;
        cart[i].price = 0;
        cart[i].pending = true;
        renderCart();
      };
    });
    tb.querySelectorAll('[data-plus]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-plus'); changeQty(i, cart[i].qty + 1); }; });
    tb.querySelectorAll('[data-minus]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-minus'); changeQty(i, cart[i].qty - 1); }; });
    tb.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { cart.splice(+b.getAttribute('data-del'), 1); renderCart(); };
    });
    totals();
  }
  function changeQty(i, q) {
    if (q <= 0) {
      cart.splice(i, 1);
    } else {
      cart[i].qty = q;
      /* New Sale থেকে নতুন stock বানালে stock-in qty সবসময় sale qty-এর সমান থাকবে। */
      if (cart[i].createProduct) cart[i].stock = q;
    }
    renderCart();
  }

  function calc() {
    var sub = cart.reduce(function (a, l) { return a + l.qty * l.price; }, 0);
    var cost = cart.reduce(function (a, l) { return a + l.qty * F.num(l.cost); }, 0);
    var disc = Math.max(0, F.num(document.getElementById('billDiscount').value));
    if (disc > sub) disc = sub;
    var total = DB.round2(sub - disc);
    var ratio = sub > 0 ? (total / sub) : 0;
    return { sub: DB.round2(sub), cost: DB.round2(cost), discount: DB.round2(disc), total: total, profit: DB.round2(total - cost), ratio: ratio };
  }

  function totals() {
    var c = calc();
    var items = cart.reduce(function (a, l) { return a + l.qty; }, 0);
    var hasItems = cart.length > 0;
    document.getElementById('billCount').textContent = hasItems ? (items + ' পিস') : '';
    var invBadge = document.getElementById('saleInvoiceCountBadge');
    if (invBadge) invBadge.textContent = F.bn(F.qty(items));
    var hasPendingPrice = cart.some(function (l) { return F.num(l.price) <= 0 || l.pending === true; });
    document.getElementById('billSub').textContent = hasItems ? F.money(c.sub) : '';
    document.getElementById('billTotal').textContent = hasItems ? F.money(c.total) : '';
    document.getElementById('billProfit').textContent = hasItems ? (hasPendingPrice ? '—' : (F.money(c.profit) + (c.cost ? ' (' + (c.total > 0 ? (c.profit / c.total * 100).toFixed(0) : 0) + '%)' : ''))) : '';
    // discount reason box + per-invoice "show discount" toggle: only shown when a discount is given
    var rr = document.getElementById('discReasonRow');
    if (rr) rr.hidden = !(c.discount > 0);
    var sdRow = document.getElementById('showDiscountRow');
    if (sdRow) sdRow.hidden = !(c.discount > 0);
    document.getElementById('billDate').textContent = F.d(Date.now());
    /* দাম না জানা থাকলে cart/invoice item-এ pending থাকবে, কিন্তু New Sale screen-এ বড় warning দেখাব না। */
    var hint = document.getElementById('billPendHint');
    if (hint) { hint.innerHTML = ''; hint.hidden = true; }
  }

  function validateCustomerMode() {
    var err = document.getElementById('saleError');
    if (walkInCash && cart.some(function (l) { return l.pending === true || F.num(l.price) <= 0; })) {
      err.textContent = 'নগদ বিক্রির জন্য সব পণ্যের দর লিখুন।'; return false;
    }
    if (!walkInCash && !customerId && !['saleNewNameBn','saleNewPhone','saleNewVehicle'].some(function (id) { return document.getElementById(id).value.trim(); })) {
      err.textContent = 'কাস্টমার নির্বাচন করুন অথবা ওয়াক-ইন চাপুন।'; return false;
    }
    return true;
  }
  /* ---------------- save sale ---------------- */
  function saveSale() {
    if (savingSale) return;
    var err = document.getElementById('saleError');
    err.textContent = '';
    if (!cart.length) { err.textContent = 'বিলে অন্তত একটি পণ্য যোগ করুন।'; return; }
    if (!validateCustomerMode()) return;
    var incomplete = cart.filter(function (l) {
      return !String(l.description || l.name || '').trim() || !String(l.brand || '').trim() || !String(l.size || '').trim() || F.num(l.qty) <= 0;
    });
    if (incomplete.length) {
      err.textContent = 'Invoice-এর প্রতিটি আইটেমে বিবরণ, ব্র্যান্ড, সাইজ ও পরিমাণ পূরণ করা বাধ্যতামূলক। দর জানা না থাকলে খালি রাখা যাবে।';
      return;
    }
    var over = cart.filter(function (l) {
      if (!l.productId) return false;
      var p = DB.productById(l.productId);
      var liveStock = p ? F.num(p.qty) : 0;
      l.stock = liveStock;
      return l.qty > liveStock;
    });
    if (over.length) {
      var names = over.map(function (l) { return l.name + ' (' + l.stock + ' স্টকে আছে, বিক্রি করা হচ্ছে ' + l.qty + ')'; }).join('<br>');
      UI.confirmDialog({
        title: 'স্টকে যথেষ্ট নেই',
        message: 'এই আইটেমগুলো স্টকের চেয়ে বেশি:<br><b>' + names + '</b><br><br>তবুও বিক্রি করবেন? স্টক ঋণাত্মক হয়ে যাবে। সাধারণত এর মানে নতুন স্টক যোগ করতে ভুলে গেছেন।',
        confirmText: 'তবুও বিক্রি করুন', danger: true
      }).then(function (ok) { if (ok) doSave(); });
      return;
    }
    doSave();
  }

  function createMissingStockProducts() {
    cart.forEach(function (l) {
      if (l.productId || !l.createProduct) return;
      var qty = Math.max(1, Math.floor(F.num(l.qty)));
      var n = DB.nextNo('product');
      var np = {
        id: DB.uid('p'),
        code: 'SKU-' + String(n).padStart(4, '0'),
        name: l.description || l.name || l.brand || '',
        description: l.description || l.name || '',
        brand: l.brand || '',
        size: l.size || '',
        model: '',
        type: 'টায়ার',
        qty: qty,
        unit: 'পিস',
        buyPrice: F.num(l.cost),
        sellPrice: F.num(l.price),
        pricePending: F.num(l.price) <= 0,
        buyPricePending: F.num(l.cost) <= 0,
        lowStock: F.num(DB.state.settings.lowStockLevel) || 2,
        vehicleType: '', barcode: '', photo: '', note: 'New Sale থেকে নতুন টায়ার হিসেবে যোগ হয়েছে',
        active: true,
        createdAt: new Date().toISOString(),
        purchases: [{ date: DB.todayStr(), qty: qty, buyPrice: F.num(l.cost), supplier: '', note: 'New Sale-এর জন্য স্টক' }],
        adjustments: []
      };
      DB.state.products.push(np);
      l.productId = np.id;
      l.code = np.code;
      l.stock = qty;
    });
  }

  async function doSave() {
    if (savingSale || !validateCustomerMode()) return;
    savingSale = true;
    try {
    createMissingStockProducts();
    customerId = walkInCash ? '' : ensureCustomer();
    var c = calc();
    var cust = customerId ? DB.customerById(customerId) : null;
    var referenceMode = (document.getElementById('saleReferenceMode') || {}).value || 'none';
    var reference = referenceMode === 'reference' ? {
      name: ((document.getElementById('saleReferenceName') || {}).value || '').trim(),
      phone: ((document.getElementById('saleReferencePhone') || {}).value || '').trim(),
      address: ((document.getElementById('saleReferenceAddress') || {}).value || '').trim()
    } : null;
    if (cust && vehicleNo && !(cust.vehicles || []).some(function (v) { return v.number === vehicleNo; })) {
      cust.vehicles = cust.vehicles || [];
      cust.vehicles.push({ id: DB.uid('v'), number: vehicleNo, type: '', model: '', tyreSize: '', note: 'বিক্রয়ের সময় যোগ করা' });
    }
    var sale = {
      id: DB.uid('s'),
      invoiceNo: DB.nextInvoiceNo(),
      date: new Date().toISOString(),
      customerId: customerId || '',
      customerName: cust ? (cust.nameBn || cust.name) : 'ওয়াক-ইন কাস্টমার',
      customerNameBn: cust ? (cust.nameBn || '') : '',
      customerPhone: cust ? cust.phone : '',
      vehicleNo: vehicleNo || '',
      items: cart.map(function (l) {
        return {
          productId: l.productId, name: l.name, description: l.description || l.name || '', brand: l.brand, size: l.size, type: String(l.type || '').trim(), model: String(l.model || '').trim(), code: l.code,
          qty: l.qty, price: F.num(l.price), cost: F.num(l.cost),
          pricePending: (l.pending === true || F.num(l.price) <= 0),
          total: DB.round2(l.qty * F.num(l.price)),
          costTotal: DB.round2(l.qty * F.num(l.cost))
        };
      }),
      subTotal: c.sub, discount: c.discount, total: c.total,
      discountReason: c.discount > 0 ? document.getElementById('billDiscountReason').value.trim() : '',
      /* এই বিক্রয়ের সময় "ইনভয়েসে ছাড় দেখান" চেকবক্সে কী ছিল তা এখানে সেভ হয় — প্রতিটি ইনভয়েসে আলাদাভাবে ঠিক করা যায়। */
      showDiscount: (function () { var el = document.getElementById('saleShowDiscount'); return el ? !!el.checked : false; })(),
      paid: 0, due: c.total, credit: 0, duePending: cart.some(function (l) { return l.pending === true || F.num(l.price) <= 0; }),
      method: walkInCash ? 'cash' : '', walkInCash: walkInCash, simpleSale: false, paymentTracking: true, collectionTracking: true,
      cost: c.cost, profit: c.profit,
      reference: reference,
      note: '',
      createdAt: new Date().toISOString()
    };
    // reduce stock
    sale.items.forEach(function (i) {
      if (!i.productId) return;
      var p = DB.productById(i.productId);
      if (!p) return;
      p.qty = DB.round2(F.num(p.qty) - F.num(i.qty));
      p.adjustments = p.adjustments || [];
      p.adjustments.push({ date: DB.todayStr(), delta: -F.num(i.qty), reason: 'বিক্রয় ' + sale.invoiceNo, note: '' });
    });
    DB.state.sales.push(sale);
    if (walkInCash && F.num(sale.total) > 0) {
      // Save the sale and its cash receipt together in the same state snapshot.
      DB.state.receipts = DB.state.receipts || [];
      DB.state.receipts.push({ id:DB.uid('col'), no:'COL-' + String(DB.nextNo('payment')).padStart(5,'0'), type:'collection',
        saleId:sale.id, invoiceNo:sale.invoiceNo, customerId:'', customerName:sale.customerName,
        amount:sale.total, date:sale.date, createdAt:sale.createdAt, note:'নগদ বিক্রি' });
      sale.paid = sale.total; sale.due = 0;
    }
    var savedToDrive = DB.save();
    var durableSaved = await DB.flush();
    if (!durableSaved && DB.lastSaveConflict) return;
    if (durableSaved) {
      UI.toast('বিক্রি সেভ হয়েছে · ইনভয়েস <b>' + sale.invoiceNo + '</b> তৈরি হয়েছে।' + (DB.trueDue(sale) > 0.009 ? ' দিনের শেষে Cash Collection-এ প্রাপ্ত টাকা যোগ করুন।' : ' পুরো টাকা জমা হয়ে গেছে, কোনো বাকি নেই।'), 'ok', 6500);
    } else if (savedToDrive) {
      UI.toast('ইনভয়েস <b>' + sale.invoiceNo + '</b> Local Data-তে সেভ হয়েছে; মূল database verification আবার চেষ্টা হচ্ছে। সফটওয়্যার খোলা রাখুন।', 'warn', 9000);
    } else {
      UI.toast('বিক্রিটি স্থায়ীভাবে সেভ নিশ্চিত করা যায়নি। ডেটা সেভ অবস্থা ঠিক না হওয়া পর্যন্ত নতুন বিক্রি না করাই নিরাপদ।', 'bad', 9000);
    }
    reset();
    // show invoice for printing
    setTimeout(function () { UI.openInvoice(sale.id); }, 250);
    App.refreshAll();
    } finally {
      savingSale = false;
    }
  }

  /* ---------------- hold / resume ---------------- */
  function hold() {
    if (!cart.length) { UI.toast('রাখার মতো কিছু নেই — বিল খালি।', 'warn'); return; }
    DB.state.heldSales = DB.state.heldSales || [];
    DB.state.heldSales.push({
      id: DB.uid('hold'), at: new Date().toISOString(), cart: cart, customerId: customerId, vehicleNo: vehicleNo,
      walkInCash: walkInCash, discount: calc().discount,
      discountReason: document.getElementById('billDiscountReason').value,
      showDiscount: (function () { var el = document.getElementById('saleShowDiscount'); return el ? !!el.checked : false; })(),
      note: ''
    });
    DB.save();
    reset();
    UI.toast('বিল রেখে দেওয়া হয়েছে। “রাখা বিল খুলুন” চেপে ফিরিয়ে আনুন।', 'ok');
  }
  function resume() {
    var list = DB.state.heldSales || [];
    if (!list.length) { UI.toast('কোনো রাখা বিল নেই।', 'warn'); return; }
    UI.modal({
      title: 'রাখা বিলগুলো',
      body: '<table class="table compact"><thead><tr><th>রাখা হয়েছে</th><th>কাস্টমার</th><th class="num">আইটেম</th><th class="num">টাকা</th><th></th></tr></thead><tbody>' +
        list.map(function (h) {
          var amt = h.cart.reduce(function (a, l) { return a + l.qty * l.price; }, 0) - F.num(h.discount);
          var c = h.customerId ? DB.customerById(h.customerId) : null;
          return '<tr><td>' + F.dt(h.at) + '</td><td>' + F.esc(c ? (c.nameBn || c.name) : 'ওয়াক-ইন') + '</td>' +
            '<td class="num">' + h.cart.reduce(function (a, l) { return a + l.qty; }, 0) + '</td>' +
            '<td class="num">' + F.money(amt) + '</td>' +
            '<td><div class="row-actions"><button class="btn small" data-res="' + h.id + '">খুলুন</button><button class="btn small ghost" data-rm="' + h.id + '">মুছে ফেলুন</button></div></td></tr>';
        }).join('') + '</tbody></table>',
      buttons: [],
      onOpen: function (root) {
        root.querySelectorAll('[data-res]').forEach(function (b) {
          b.onclick = function () {
            var h = list.filter(function (x) { return x.id === b.getAttribute('data-res'); })[0];
            cart = (h.cart || []).map(function (line) {
              var x = Object.assign({}, line);
              if (x.productId) {
                var p = DB.productById(x.productId);
                if (p) { x.stock = F.num(p.qty); x.cost = F.num(p.buyPrice); x.name = Stock.label(p); x.description = p.description || p.name || Stock.label(p); x.brand = p.brand; x.size = p.size; x.type = String(p.type || '').trim(); x.model = String(p.model || '').trim(); x.code = p.code; }
              }
              return x;
            }); customerId = h.customerId || ''; vehicleNo = h.vehicleNo || '';
            setWalkInCash(h.walkInCash === true && !customerId);
            document.getElementById('billDiscount').value = F.num(h.discount) ? h.discount : '';
            document.getElementById('billDiscountReason').value = h.discountReason || '';
            var sdCb2 = document.getElementById('saleShowDiscount'); if (sdCb2) sdCb2.checked = (h.showDiscount === true);
            if (customerId) { var c = DB.customerById(customerId); if (c) showCustBox(c); } else hideCustBox();
            DB.state.heldSales = list.filter(function (x) { return x.id !== h.id; });
            DB.save(); renderCart(); UI.closeModal();
            UI.toast('রাখা বিল খোলা হয়েছে।', 'ok');
          };
        });
        root.querySelectorAll('[data-rm]').forEach(function (b) {
          b.onclick = function () {
            DB.state.heldSales = list.filter(function (x) { return x.id !== b.getAttribute('data-rm'); });
            DB.save(); UI.closeModal(); resume();
          };
        });
      }
    });
  }

  /* If the shopkeeper typed a new name / phone / vehicle instead of picking a saved customer,
     the customer is created automatically here and linked to the sale. */
  function ensureCustomer() {
    // Also check at save time if an autofill changed the input without an event.
    unlinkChangedPhone(false);
    if (customerId) return customerId;
    var nameBnEl = document.getElementById('saleNewNameBn');
    var phoneEl = document.getElementById('saleNewPhone');
    var vehEl = document.getElementById('saleNewVehicle');
    var areaEl = document.getElementById('saleNewArea');
    var nameBn = nameBnEl ? nameBnEl.value.trim() : '';
    var phone = phoneEl ? digitsOnly(phoneEl.value) : '';
    if (phoneEl && phoneEl.value && phoneEl.value !== phone) phoneEl.value = phone;
    var veh = vehEl ? vehEl.value.trim().toUpperCase() : '';
    var area = areaEl ? areaEl.value.trim() : '';
    if (!nameBn && !phone && !veh) return '';

    // phone number already saved? then reuse that customer instead of making a duplicate
    if (phone) {
      var found = exactCustomerByPhone(phone);
      if (found) {
        if (veh && !(found.vehicles || []).some(function (v) { return v.number === veh; })) {
          found.vehicles = found.vehicles || [];
          found.vehicles.push({ id: DB.uid('v'), number: veh, type: '', model: '', tyreSize: '', note: 'বিক্রয়ের সময় যোগ করা' });
        }
        vehicleNo = vehicleNo || veh || ((found.vehicles || [])[0] ? found.vehicles[0].number : '');
        UI.toast('এই মোবাইল নম্বর আগে থেকেই আছে — <b>' + F.esc(found.nameBn || found.name || 'কাস্টমার') + '</b> কাস্টমার হিসেবেই সেভ হবে।', 'ok', 4000);
        return found.id;
      }
    }

    var c = {
      id: DB.uid('c'),
      name: '',
      nameBn: nameBn || ('কাস্টমার ' + (phone || veh)),
      addressBn: area,
      phone: phone,
      address: '',
      note: 'বিক্রয়ের সময় নিজে থেকে যোগ হয়েছে',
      createdAt: new Date().toISOString(),
      vehicles: veh ? [{ id: DB.uid('v'), number: veh, type: '', model: '', tyreSize: '', note: 'বিক্রয়ের সময় যোগ করা' }] : [],
      payments: []
    };
    DB.state.customers.push(c);
    DB.nextNo('customer');
    vehicleNo = vehicleNo || veh;
    UI.toast('নতুন কাস্টমার <b>' + F.esc(c.nameBn || c.name) + '</b> কাস্টমার লিস্টে যোগ হয়েছে।', 'ok', 4500);
    return c.id;
  }

  /* ---------------- bindings ---------------- */
  function bind() {
    var saleName = document.getElementById('saleNewNameBn');
    if (saleName && Customers.bindNameSuggest) Customers.bindNameSuggest(saleName, {
      onPick: function (x) {
        if (!x || !x.id) return false;
        UI.toast('আগের কাস্টমার <b>' + F.esc(x.name) + '</b> বেছে নেওয়া হয়েছে — তার তথ্য অটো-ফিল হয়েছে।', 'ok', 3200);
        setCustomer(x.id);
        return true;
      }
    });
    var saleNewPhone = document.getElementById('saleNewPhone');
    if (saleNewPhone) {
      saleNewPhone.oninput = function () {
        /* বাংলা/ইংরেজি digit দুটোই টাইপ করতে দিন (Avro-friendly)।
           তুলনা/সেভের সময় phoneKey/digitsOnly canonical English digits ব্যবহার করে। */
        if (manualCustomerEntry) return;
        var existing = exactCustomerByPhone(this.value);
        if (existing) {
          UI.toast('এই মোবাইল নম্বর আগে থেকেই আছে — <b>' + F.esc(existing.nameBn || existing.name || 'কাস্টমার') + '</b> দেখানো হয়েছে।', 'ok', 3200);
          setCustomer(existing.id);
        }
      };
    }
    document.getElementById('saleProdSearch').oninput = UI.debounce(prodSearchInput, 140);
    document.getElementById('saleProdSearch').onfocus = function () {
      if (!this.value.trim()) prodShowAll();
    };
    document.getElementById('saleCustClear').onclick = function () {
      setCustomer('');
      ['saleNewNameBn','saleNewPhone','saleNewArea','saleNewVehicle'].forEach(function (id) { document.getElementById(id).value = ''; });
      setWalkInCash(true);
    };
    ['saleNewNameBn','saleNewPhone','saleNewArea','saleNewVehicle'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', function () { setWalkInCash(false); });
    });
    document.getElementById('saleProdClear').onclick = function () {
      document.getElementById('saleProdSearch').value = '';
      document.getElementById('saleProdResults').hidden = true;
    };
    document.getElementById('billDiscount').oninput = totals;
    var referenceMode = document.getElementById('saleReferenceMode');
    if (referenceMode) referenceMode.onchange = function () {
      var fields = document.getElementById('saleReferenceFields');
      if (fields) fields.hidden = referenceMode.value !== 'reference';
    };
    document.getElementById('saveSaleBtn').onclick = saveSale;

    // keyboard: product search enter / arrows
    document.getElementById('saleProdSearch').addEventListener('keydown', function (e) {
      var box = document.getElementById('saleProdResults');
      var items = UI.$$('.s-item[data-pid]', box);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        prodIndex = e.key === 'ArrowDown' ? Math.min(items.length - 1, prodIndex + 1) : Math.max(0, prodIndex - 1);
        items.forEach(function (el, i) { el.classList.toggle('sel', i === prodIndex); });
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        var el = items[prodIndex >= 0 ? prodIndex : 0];
        if (el) {
          addToCart(el.getAttribute('data-pid'));
        } else {
          customItemForm(document.getElementById('saleProdSearch').value.trim());
        }
        box.hidden = true;
        document.getElementById('saleProdSearch').value = '';
        prodIndex = -1;
      }
    });
  }

  function onShow() {
    renderCart();
    document.getElementById('billDate').textContent = F.d(Date.now());
  }

  return { bind: bind, reset: reset, setCustomer: setCustomer, onShow: onShow, addToCart: addToCart, get cart() { return cart; } };
})();

