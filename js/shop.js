/* صفحة الزبون: عرض المنتجات والسلة وإرسال الطلب عبر واتساب */
(function () {
  'use strict';
  var U = window.U, h = U.h, icon = U.icon, r2 = U.r2, money = U.money, fmtNum = U.fmtNum, digits = U.digits, toast = U.toast;
  var LS_KEY = 'shopLocalV1';
  var DEFAULT_TITLE = 'خضره وفواكه الشرج';

  function $(s) { return document.querySelector(s); }

  var root = $('#root');
  var state = null, filterCat = 'all', search = '', sheetOpen = false, cards = {}, sheetEls = {};
  var saved = U.lsGet(LS_KEY) || {};
  var cart = saved.cart || {};
  var customer = Object.assign({ name: '', phone: '', addr: '', notes: '' }, saved.customer || {});

  function persist() { U.lsSet(LS_KEY, { cart: cart, customer: customer }); }

  /* ---------- تحميل البيانات (دائماً أحدث نسخة) ---------- */
  function load() {
    fetch('data/store.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        d.settings = d.settings || {};
        d.categories = d.categories || [];
        d.products = (d.products || []).map(function (p) {
          p.price = Number(p.price) || 0;
          p.inStock = p.inStock !== false;
          return p;
        });
        state = d;
        start();
      })
      .catch(function () {
        root.replaceChildren(h('p', { class: 'empty', text: 'تعذر تحميل المنتجات. تأكد من الإنترنت وحدّث الصفحة.' }));
      });
  }

  function catOf(p) {
    for (var i = 0; i < state.categories.length; i++) { if (state.categories[i].id === p.cat) return state.categories[i]; }
    return state.categories[0] || null;
  }
  function stepOf(p) { return p.unit === 'كيلو' ? 0.5 : 1; }
  function qtyStr(n) { return String(r2(n)); }
  function lines() {
    return state.products.filter(function (p) { return cart[p.id] > 0 && p.inStock; }).map(function (p) { return { p: p, q: cart[p.id] }; });
  }
  function subtotal() { return r2(lines().reduce(function (a, l) { return a + l.p.price * l.q; }, 0)); }
  function deliveryFee(sub) {
    var d = state.settings.delivery || { mode: 'free' };
    if (d.mode === 'fee') return Number(d.fee) || 0;
    if (d.mode === 'freeFrom') return sub >= (Number(d.freeFrom) || 0) ? 0 : (Number(d.fee) || 0);
    return 0;
  }
  function deliveryText() {
    var d = state.settings.delivery || { mode: 'free' };
    if (d.mode === 'fee') return 'رسوم التوصيل ' + money(d.fee);
    if (d.mode === 'freeFrom') return 'التوصيل مجاني للطلبات من ' + money(d.freeFrom);
    return 'التوصيل مجاني';
  }
  function waNumber(raw) {
    var d = digits(raw);
    if (!d) return '';
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.indexOf('967') === 0 || d.indexOf('966') === 0) return d.length >= 11 ? d : '';
    if (d.charAt(0) === '0') d = d.slice(1);
    if (d.length === 9 && d.charAt(0) === '7') return '967' + d;
    if (d.length === 9 && d.charAt(0) === '5') return '966' + d;
    return '';
  }

  /* ---------- الهيكل ---------- */
  function start() {
    root.innerHTML = '<div class="wrap"><header id="head" class="head"></header><div class="bar"><div class="search"><input id="q" type="search" placeholder="ابحث عن منتج" autocomplete="off"></div><div id="chips" class="chips"></div></div><main id="catalog"></main><p id="empty" class="empty" hidden>ما لقينا منتج بهذا الاسم.</p><footer id="foot" class="foot"></footer></div><div id="cartbar" class="cartbar" hidden></div><div id="sheet" hidden></div>';
    $('#q').insertAdjacentElement('beforebegin', icon('search'));
    $('#q').addEventListener('input', function (e) { search = e.target.value.trim(); renderGrid(); });
    renderHeader(); renderChips(); renderGrid(); renderCartBar();
  }

  function renderHeader() {
    var s = state.settings, head = $('#head');
    var facts = [h('span', { class: 'fact' }, icon('truck'), h('span', { text: deliveryText() }))];
    if (Number(s.minOrder) > 0) facts.push(h('span', { class: 'fact' }, h('span', { text: 'الحد الأدنى للطلب ' + money(s.minOrder) })));
    if (s.hours) facts.push(h('span', { class: 'fact' }, icon('clock'), h('span', { text: s.hours })));
    if (s.areas) facts.push(h('span', { class: 'fact' }, icon('pin'), h('span', { text: s.areas })));
    head.replaceChildren(
      h('div', { class: 'brandrow' }, h('h1', { text: s.name || DEFAULT_TITLE })),
      s.tagline ? h('p', { class: 'tag', text: s.tagline }) : null,
      h('div', { class: 'facts' }, facts),
      s.open === false ? h('div', { class: 'strip closed', text: 'المحل مغلق حالياً. تقدر تتصفح المنتجات ونستقبل طلباتك عند الفتح.' }) : null,
      s.notice ? h('div', { class: 'strip', text: s.notice }) : null
    );
    document.title = s.name || DEFAULT_TITLE;
    $('#foot').textContent = s.name || DEFAULT_TITLE;
  }

  function renderChips() {
    var box = $('#chips'); box.replaceChildren();
    var used = state.categories.filter(function (c) { return state.products.some(function (p) { return p.name && catOf(p) === c; }); });
    if (filterCat !== 'all' && !used.some(function (c) { return c.id === filterCat; })) filterCat = 'all';
    if (used.length < 2) return;
    function chip(id, name) {
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(filterCat === id), text: name, onclick: function () { filterCat = id; renderChips(); renderGrid(); } });
    }
    box.append(chip('all', 'الكل'));
    used.forEach(function (c) { box.append(chip(c.id, c.name)); });
  }

  function buildCard(p) {
    var q = cart[p.id] || 0, out = !p.inStock;
    var thumb = h('div', { class: 'thumb' },
      p.img ? h('img', { src: p.img, alt: p.name, loading: 'lazy', decoding: 'async' }) : h('span', { class: 'emo', text: p.emoji || '🥬', 'aria-hidden': 'true' }),
      out ? h('span', { class: 'tagout', text: 'نفد' }) : null);
    var act;
    if (out) {
      act = h('button', { class: 'btn quiet sm block', type: 'button', disabled: true, text: 'غير متوفر' });
    } else if (q <= 0) {
      act = h('button', { class: 'btn ghost sm block', type: 'button', onclick: function () { changeQty(p.id, stepOf(p)); } }, icon('plus'), 'أضف');
    } else {
      act = h('div', { class: 'step' },
        h('button', { class: 'sbtn plus', type: 'button', 'aria-label': 'زيادة ' + p.name, onclick: function () { changeQty(p.id, stepOf(p)); } }, icon('plus')),
        h('span', { class: 'qty', text: qtyStr(q) }),
        h('button', { class: 'sbtn', type: 'button', 'aria-label': 'إنقاص ' + p.name, onclick: function () { changeQty(p.id, -stepOf(p)); } }, icon('minus')));
    }
    return h('article', { class: 'card' + (out ? ' out' : '') },
      thumb,
      h('div', { class: 'cbody' },
        h('div', { class: 'pname', text: p.name }),
        p.desc ? h('div', { class: 'pdesc', text: p.desc }) : null,
        h('div', { class: 'price' }, fmtNum(p.price), ' ', h('small', { text: 'ر.ي / ' + p.unit })),
        act));
  }

  function renderGrid() {
    var box = $('#catalog'); box.replaceChildren(); cards = {};
    var list = state.products.filter(function (p) { return p.name && (!search || p.name.indexOf(search) > -1 || (p.desc || '').indexOf(search) > -1); });
    var any = false;
    state.categories.forEach(function (c) {
      if (filterCat !== 'all' && filterCat !== c.id) return;
      var items = list.filter(function (p) { return catOf(p) === c; });
      if (!items.length) return;
      any = true;
      var grid = h('div', { class: 'grid' });
      items.forEach(function (p) { var el = buildCard(p); cards[p.id] = el; grid.append(el); });
      box.append(h('h2', { class: 'sec', text: c.name }), grid);
    });
    $('#empty').hidden = any;
  }

  function updateCard(id) {
    var p = state.products.filter(function (x) { return x.id === id; })[0];
    if (!p || !cards[id]) return;
    var el = buildCard(p); cards[id].replaceWith(el); cards[id] = el;
  }

  function changeQty(id, delta) {
    var cur = cart[id] || 0, n = r2(cur + delta);
    if (n <= 0) delete cart[id]; else cart[id] = n;
    persist(); updateCard(id); renderCartBar();
    if (sheetOpen) refreshSheet();
  }

  function renderCartBar() {
    var bar = $('#cartbar'), L = lines();
    bar.replaceChildren();
    if (!L.length || sheetOpen) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.append(h('button', { class: 'cartbtn', type: 'button', onclick: openSheet },
      h('span', { class: 'cnt', text: String(L.length) }),
      h('span', { text: 'عرض السلة' }),
      h('span', { class: 'tot', text: money(subtotal()) })));
  }

  /* ---------- السلة وإرسال الطلب ---------- */
  function orderText() {
    var s = state.settings, L = lines(), sub = subtotal(), fee = deliveryFee(sub);
    var out = ['طلب جديد من ' + (s.name || DEFAULT_TITLE), '', 'الاسم: ' + customer.name.trim(), 'الجوال: ' + customer.phone.trim(), 'الحي والعنوان: ' + customer.addr.trim(), '', 'المنتجات:'];
    L.forEach(function (l) { out.push('• ' + l.p.name + ' × ' + qtyStr(l.q) + ' ' + l.p.unit + ' = ' + money(l.p.price * l.q)); });
    out.push('', 'مجموع المنتجات: ' + money(sub), 'التوصيل: ' + (fee > 0 ? money(fee) : 'مجاني'), 'الإجمالي: ' + money(sub + fee));
    if (customer.notes.trim()) out.push('', 'ملاحظات: ' + customer.notes.trim());
    out.push('', 'الدفع عند الاستلام');
    return out.join('\n');
  }

  function openSheet() {
    sheetOpen = true; renderCartBar();
    var s = $('#sheet'); s.hidden = false; s.replaceChildren();
    function field(label, key, type, ph, area) {
      var input = area ? h('textarea', { id: 'c-' + key, placeholder: ph || '', rows: '2' }) : h('input', { id: 'c-' + key, type: type || 'text', placeholder: ph || '', autocomplete: 'off' });
      input.value = customer[key] || '';
      input.addEventListener('input', function () { customer[key] = input.value; persist(); refreshSend(); });
      return h('label', { class: 'f', 'for': 'c-' + key }, label, input);
    }
    sheetEls.lines = h('div', { class: 'lines' });
    sheetEls.totals = h('div', { class: 'totals' });
    sheetEls.send = h('div', { class: 'formgrid' });
    var panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'سلة الطلب' },
      h('div', { class: 'prow' }, h('h2', { class: 'ptitle', text: 'سلة الطلب' }),
        h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'إغلاق', onclick: closeSheet }, icon('close'))),
      sheetEls.lines, sheetEls.totals,
      h('div', { class: 'formgrid' },
        field('الاسم', 'name', 'text', 'اسمك'),
        field('رقم الجوال', 'phone', 'tel', '7XXXXXXXX'),
        field('الحي والعنوان', 'addr', 'text', 'الحي، الشارع، أقرب معلم'),
        field('ملاحظات (اختياري)', 'notes', 'text', 'مثال: طماطم ناضجة قليلاً', true)),
      sheetEls.send);
    var scrim = h('div', { class: 'scrim', onclick: function (e) { if (e.target === scrim) closeSheet(); } }, panel);
    s.append(scrim);
    refreshSheet();
  }

  function closeSheet() { sheetOpen = false; var s = $('#sheet'); s.hidden = true; s.replaceChildren(); renderCartBar(); }

  function refreshSheet() {
    var L = lines();
    if (!L.length) { closeSheet(); return; }
    sheetEls.lines.replaceChildren();
    L.forEach(function (l) {
      var p = l.p;
      sheetEls.lines.append(h('div', { class: 'line' },
        h('div', {}, h('div', { class: 'nm', text: p.name }), h('div', { class: 'sub', text: qtyStr(l.q) + ' ' + p.unit + ' × ' + fmtNum(p.price) + ' = ' + money(p.price * l.q) })),
        h('div', { class: 'step' },
          h('button', { class: 'sbtn plus', type: 'button', 'aria-label': 'زيادة ' + p.name, onclick: function () { changeQty(p.id, stepOf(p)); } }, icon('plus')),
          h('span', { class: 'qty', text: qtyStr(l.q) }),
          h('button', { class: 'sbtn', type: 'button', 'aria-label': 'إنقاص ' + p.name, onclick: function () { changeQty(p.id, -stepOf(p)); } }, icon('minus')))));
    });
    var sub = subtotal(), fee = deliveryFee(sub);
    sheetEls.totals.replaceChildren(
      h('div', {}, h('span', { text: 'مجموع المنتجات' }), h('span', { text: money(sub) })),
      h('div', {}, h('span', { text: 'التوصيل' }), h('span', { text: fee > 0 ? money(fee) : 'مجاني' })),
      h('div', { class: 'grand' }, h('span', { text: 'الإجمالي' }), h('span', { text: money(sub + fee) })));
    refreshSend();
  }

  function refreshSend() {
    if (!sheetOpen || !sheetEls.send) return;
    var s = state.settings, sub = subtotal(), num = waNumber(s.phone), problem = '';
    if (s.open === false) problem = 'المحل مغلق حالياً، نستقبل الطلبات عند الفتح.';
    else if (!num) problem = 'استقبال الطلبات عبر واتساب غير مفعّل حالياً.';
    else if (sub < (Number(s.minOrder) || 0)) problem = 'الحد الأدنى للطلب ' + money(s.minOrder) + '، أضف منتجات.';
    else if (!customer.name.trim()) problem = 'اكتب اسمك.';
    else if (digits(customer.phone).length < 9) problem = 'اكتب رقم جوالك.';
    else if (!customer.addr.trim()) problem = 'اكتب الحي والعنوان.';
    var ok = !problem;
    var link = h('a', {
      class: 'btn', href: ok ? ('https://wa.me/' + num + '?text=' + encodeURIComponent(orderText())) : '#',
      target: ok ? '_blank' : null, rel: 'noopener', 'aria-disabled': String(!ok),
      onclick: function (e) { if (!ok) e.preventDefault(); }
    }, icon('chat'), 'أرسل الطلب عبر واتساب');
    var copy = h('button', {
      class: 'btn quiet', type: 'button', disabled: !ok, onclick: function () {
        var t = orderText();
        try { navigator.clipboard.writeText(t).then(function () { toast('تم نسخ نص الطلب'); }, function () { toast('تعذر النسخ'); }); } catch (e) { toast('تعذر النسخ'); }
      }
    }, icon('copy'), 'نسخ نص الطلب');
    sheetEls.send.replaceChildren(
      problem ? h('div', { class: 'hintbox', text: problem }) : h('div', { class: 'okbox', text: 'يفتح واتساب برسالة جاهزة، اضغط إرسال هناك لإكمال الطلب. الدفع عند الاستلام.' }),
      h('div', { class: 'sendrow' }, link, copy));
  }

  load();
})();
