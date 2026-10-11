/* لوحة تحكم المحل: تعديل المنتجات والأسعار والإعدادات ونشرها مباشرة إلى GitHub */
(function () {
  'use strict';
  var U = window.U, h = U.h, icon = U.icon, r2 = U.r2, toLatin = U.toLatin, toast = U.toast, UNITS = U.UNITS;
  var LS_CFG = 'shopAdminCfg', LS_TOKEN = 'shopAdminToken';
  var enc = encodeURIComponent;
  var root = document.getElementById('root');

  var cfg = null, token = '', state = null, sha = '';
  var dirty = false, saving = false, tab = 'prices', toDelete = [], logoutArmed = false, aEls = {};

  /* ---------- GitHub API ---------- */
  function b64decode(b) {
    var bin = atob(String(b).replace(/\s/g, '')), by = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(by);
  }
  function b64encode(str) {
    var by = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < by.length; i += 8192) bin += String.fromCharCode.apply(null, by.subarray(i, i + 8192));
    return btoa(bin);
  }
  function api(path, opt) {
    opt = opt || {};
    var headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opt.body) headers['Content-Type'] = 'application/json';
    return fetch('https://api.github.com/repos/' + enc(cfg.owner) + '/' + enc(cfg.repo) + path, {
      method: opt.method || 'GET', headers: headers, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: 'no-store'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.message || ('HTTP ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function errMsg(e) {
    var s = e && e.status;
    if (s === 401) return 'المفتاح غير صحيح أو منتهي. أنشئ مفتاح جديد.';
    if (s === 403) return 'المفتاح ما عنده صلاحية. لازم يكون Contents: Read and write على هذا المستودع.';
    if (s === 404) return 'ما لقينا المستودع أو الملف data/store.json. تأكد من اسم المستخدم واسم المستودع، وأن المفتاح مربوط بهذا المستودع.';
    if (s === 409 || s === 422) return 'تعذر الحفظ بسبب تعارض. حدّث الصفحة وأعد التعديل.';
    return 'تعذر الاتصال بـ GitHub: ' + (e && e.message ? e.message : 'خطأ غير معروف');
  }
  function normalize(d) {
    d.settings = d.settings || {};
    d.settings.delivery = d.settings.delivery || { mode: 'free', fee: 500, freeFrom: 5000 };
    d.categories = d.categories || [];
    d.products = (d.products || []).map(function (p) {
      p.price = Number(p.price) || 0; p.inStock = p.inStock !== false; p.unit = p.unit || 'كيلو';
      p.desc = p.desc || ''; p.emoji = p.emoji || '🥬'; p.img = p.img || '';
      return p;
    });
    return d;
  }
  function loadStore() {
    return api('/contents/data/store.json?ref=' + enc(cfg.branch)).then(function (j) {
      state = normalize(JSON.parse(b64decode(j.content)));
      sha = j.sha;
    });
  }
  function inferCfg() {
    var host = location.hostname, parts = location.pathname.split('/').filter(Boolean), o = '', r = '';
    if (/\.github\.io$/.test(host)) {
      o = host.split('.')[0];
      r = (parts[0] && parts[0] !== 'admin') ? parts[0] : host;
    }
    return { owner: o, repo: r, branch: 'main' };
  }

  /* ---------- تسجيل الدخول ---------- */
  function showLogin(msg) {
    var c = Object.assign(inferCfg(), U.lsGet(LS_CFG) || {});
    function inp(id, val, type, ph) { return h('input', { id: id, type: type || 'text', value: val, placeholder: ph || '', autocomplete: 'off', dir: 'ltr', spellcheck: 'false' }); }
    var owner = inp('g-owner', c.owner), repo = inp('g-repo', c.repo), branch = inp('g-branch', c.branch), tk = inp('g-token', '', 'password', 'github_pat_...');
    var err = h('div', { class: 'errbox', hidden: !msg, text: msg || '' });
    var btn = h('button', { class: 'btn block', type: 'button', onclick: go }, 'دخول');
    function go() {
      var o = owner.value.trim(), r = repo.value.trim(), b = branch.value.trim() || 'main', t = tk.value.trim();
      if (!o || !r || !t) { err.hidden = false; err.textContent = 'اكتب اسم المستخدم واسم المستودع والمفتاح.'; return; }
      cfg = { owner: o, repo: r, branch: b }; token = t;
      btn.disabled = true; btn.textContent = 'جارٍ الدخول…'; err.hidden = true;
      loadStore().then(function () {
        U.lsSet(LS_CFG, cfg); U.lsSet(LS_TOKEN, token); renderApp();
      }, function (e) {
        btn.disabled = false; btn.textContent = 'دخول'; err.hidden = false; err.textContent = errMsg(e);
      });
    }
    tk.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    root.replaceChildren(h('div', { class: 'ainner' }, h('div', { class: 'login' },
      h('h1', { text: 'لوحة تحكم المحل' }),
      h('p', { class: 'mut', text: 'ادخل مرة وحدة بمفتاح GitHub الخاص بك. المفتاح يتحفظ في هذا المتصفح فقط.' }),
      err,
      h('label', { class: 'f', 'for': 'g-token' }, 'مفتاح GitHub', tk),
      h('label', { class: 'f', 'for': 'g-owner' }, 'اسم المستخدم في GitHub', owner),
      h('label', { class: 'f', 'for': 'g-repo' }, 'اسم المستودع', repo),
      h('label', { class: 'f', 'for': 'g-branch' }, 'الفرع (غالباً main)', branch),
      btn)));
  }

  /* ---------- الواجهة ---------- */
  function markDirty() {
    dirty = true;
    window.onbeforeunload = function (e) { e.preventDefault(); e.returnValue = ''; return ''; };
    updateUI();
  }
  function setStat(t, cls) { if (aEls.stat) { aEls.stat.textContent = t; aEls.stat.className = 'dstat' + (cls ? ' ' + cls : ''); } }
  function updateUI() {
    if (saving) setStat('جارٍ النشر…');
    else if (dirty) setStat('فيه تغييرات غير منشورة', 'dirty');
    else setStat('كل شيء منشور');
    if (aEls.save) { aEls.save.disabled = !dirty || saving; aEls.save.setAttribute('aria-disabled', String(!dirty || saving)); }
  }
  function renderApp() {
    aEls.top = h('div', { class: 'atop' });
    aEls.body = h('div', { class: 'abody' });
    root.replaceChildren(h('div', { class: 'ainner' }, aEls.top, aEls.body));
    renderTop(); renderBody();
  }
  function logout() {
    if (dirty && !logoutArmed) { logoutArmed = true; toast('فيه تغييرات غير منشورة. اضغط خروج مرة ثانية لو تبي تتجاهلها.'); return; }
    window.onbeforeunload = null; U.lsDel(LS_TOKEN); location.reload();
  }
  function renderTop() {
    aEls.stat = h('span', { class: 'dstat' });
    aEls.save = h('button', { class: 'btn', type: 'button', onclick: save }, 'حفظ ونشر');
    var TABS = [['prices', 'تحديث الأسعار'], ['products', 'المنتجات'], ['cats', 'الأقسام'], ['settings', 'إعدادات المحل']];
    var tabs = h('div', { class: 'tabs', role: 'tablist' }, TABS.map(function (t) {
      return h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(tab === t[0]), text: t[1], onclick: function () { tab = t[0]; renderTop(); renderBody(); } });
    }));
    aEls.top.replaceChildren(
      h('div', { class: 'atoprow' },
        h('h2', { class: 'atitle', text: 'لوحة التحكم' }),
        h('div', { class: 'abtns' }, aEls.save,
          h('a', { class: 'btn quiet', href: '../', target: '_blank', rel: 'noopener' }, 'عرض الموقع'),
          h('button', { class: 'btn quiet', type: 'button', onclick: logout }, 'خروج'))),
      aEls.stat, tabs);
    updateUI();
  }
  function renderBody() {
    aEls.body.replaceChildren();
    if (state.seed) aEls.body.append(h('div', { class: 'banner', text: 'المنتجات والأسعار الحالية أمثلة. عدّلها أو احذفها، وأضف رقم واتساب في إعدادات المحل، ثم اضغط حفظ ونشر.' }));
    if (tab === 'prices') tabPrices();
    else if (tab === 'products') tabProducts();
    else if (tab === 'cats') tabCats();
    else tabSettings();
  }

  function catOf(p) {
    for (var i = 0; i < state.categories.length; i++) { if (state.categories[i].id === p.cat) return state.categories[i]; }
    return state.categories[0] || null;
  }
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function imgSrc(p) { return p._prev || (p.img ? '../' + p.img : ''); }
  function queueDelete(path) { if (path && /^images\/[\w.\-]+$/.test(path)) toDelete.push(path); }

  function stockPill(p) {
    var b = h('button', {
      class: 'pill', type: 'button', 'aria-pressed': String(!!p.inStock), text: p.inStock ? 'متوفر' : 'نفد', onclick: function () {
        p.inStock = !p.inStock; b.setAttribute('aria-pressed', String(p.inStock)); b.textContent = p.inStock ? 'متوفر' : 'نفد'; markDirty();
      }
    });
    return b;
  }
  function priceInput(p) {
    var input = h('input', { type: 'number', inputmode: 'decimal', step: '50', min: '0', 'aria-label': 'سعر ' + p.name, value: p.price });
    input.addEventListener('input', function () { var v = parseFloat(toLatin(input.value)); p.price = isNaN(v) || v < 0 ? 0 : v; markDirty(); });
    return input;
  }
  function filterRows(box, q, cat) {
    Array.prototype.forEach.call(box.querySelectorAll('[data-n]'), function (r) {
      var okQ = !q || r.getAttribute('data-n').indexOf(q) > -1;
      var okC = !cat || cat === 'all' || r.getAttribute('data-c') === cat;
      r.hidden = !(okQ && okC);
    });
  }
  function armedButton(label, armedLabel, onconfirm) {
    var armed = false, t = null;
    var b = h('button', {
      class: 'btn danger sm', type: 'button', onclick: function () {
        if (!armed) { armed = true; b.textContent = armedLabel; clearTimeout(t); t = setTimeout(function () { armed = false; b.textContent = label; }, 3500); return; }
        clearTimeout(t); onconfirm();
      }
    }, label);
    return b;
  }

  /* قص الصورة مربعة من الوسط بمقاس موحد لتناسب بطاقة العرض */
  function cropSquare(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = rej;
      fr.onload = function () {
        var img = new Image();
        img.onerror = rej;
        img.onload = function () {
          var SIZE = 600, side = Math.min(img.width, img.height);
          var sx = (img.width - side) / 2, sy = (img.height - side) / 2;
          var c = document.createElement('canvas'); c.width = SIZE; c.height = SIZE;
          var g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, SIZE, SIZE);
          g.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
          res(c.toDataURL('image/jpeg', 0.82));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* ---------- تبويب: تحديث الأسعار ---------- */
  function tabPrices() {
    var box = h('div', { class: 'abody', style: 'padding:0' });
    var q = h('input', { type: 'search', placeholder: 'ابحث عن منتج', 'aria-label': 'بحث' });
    q.addEventListener('input', function () { filterRows(box, q.value.trim(), 'all'); });
    aEls.body.append(h('p', { class: 'mut', text: 'غيّر سعر اليوم أو اجعل المنتج نفد، ثم اضغط حفظ ونشر.' }), q, box);
    state.categories.forEach(function (c) {
      var items = state.products.filter(function (p) { return catOf(p) === c; });
      if (!items.length) return;
      box.append(h('h3', { class: 'qsec', text: c.name }));
      items.forEach(function (p) {
        box.append(h('div', { class: 'qrow', 'data-n': p.name + ' ' + (p.desc || ''), 'data-c': c.id },
          h('div', { class: 'qname' }, h('b', { text: p.name || '(بدون اسم)' }), h('span', { class: 'mut', text: 'السعر لكل ' + p.unit })),
          h('label', { class: 'pricein' }, priceInput(p), h('span', { text: 'ر.ي' })),
          stockPill(p)));
      });
    });
    if (!state.products.length) box.append(h('p', { class: 'empty', text: 'ما فيه منتجات. أضف أول منتج من تبويب المنتجات.' }));
  }

  /* ---------- تبويب: المنتجات ---------- */
  function productEditor(p) {
    var thumb = h('div', { class: 'ethumb' });
    var removeImg = h('button', {
      class: 'btn quiet sm', type: 'button', onclick: function () {
        if (p.img) { queueDelete(p.img); p.img = ''; }
        delete p._pend; delete p._prev; paint(); markDirty();
      }
    }, 'إزالة الصورة');
    function paint() {
      var src = imgSrc(p);
      thumb.replaceChildren(src ? h('img', { src: src, alt: '' }) : document.createTextNode(p.emoji || '🥬'));
      removeImg.hidden = !src;
    }
    var file = h('input', { type: 'file', accept: 'image/*', class: 'vh', 'aria-label': 'رفع صورة ' + (p.name || 'المنتج') });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      cropSquare(f).then(function (u) {
        if (p.img) { queueDelete(p.img); p.img = ''; }
        p._pend = u; p._prev = u; paint(); markDirty();
      }, function () { toast('تعذر قراءة الصورة، جرّب صورة ثانية'); });
      file.value = '';
    });
    paint();
    function txt(label, key, ph, wide, attrs) {
      var i = h('input', Object.assign({ type: 'text', placeholder: ph || '' }, attrs || {}));
      i.value = p[key] || '';
      i.addEventListener('input', function () {
        p[key] = i.value;
        if (key === 'emoji') paint();
        if (key === 'name' || key === 'desc') row.setAttribute('data-n', p.name + ' ' + (p.desc || ''));
        markDirty();
      });
      return h('label', { class: 'f' + (wide ? ' wide' : '') }, label, i);
    }
    var unit = h('select', { value: p.unit }, UNITS.map(function (u) { return h('option', { value: u, text: u }); }));
    if (UNITS.indexOf(p.unit) < 0) { unit.append(h('option', { value: p.unit, text: p.unit })); unit.value = p.unit; }
    unit.addEventListener('change', function () { p.unit = unit.value; markDirty(); });
    var cat = h('select', { value: (catOf(p) || {}).id }, state.categories.map(function (c) { return h('option', { value: c.id, text: c.name }); }));
    cat.addEventListener('change', function () { p.cat = cat.value; row.setAttribute('data-c', p.cat); markDirty(); });
    var row = h('div', { class: 'erow', 'data-n': p.name + ' ' + (p.desc || ''), 'data-c': (catOf(p) || {}).id || '' },
      h('label', { class: 'pick' }, thumb, h('span', { class: 'cap', text: 'تغيير الصورة' }), file),
      h('div', { class: 'efields' },
        txt('اسم المنتج', 'name', 'مثال: طماطم', true),
        h('label', { class: 'f' }, 'السعر (ر.ي)', priceInput(p)),
        h('label', { class: 'f' }, 'الوحدة', unit),
        h('label', { class: 'f wide' }, 'القسم', cat),
        txt('وصف قصير (اختياري)', 'desc', 'مثال: من المزرعة', true),
        txt('رمز بديل عن الصورة', 'emoji', '🥬', false, { maxlength: '4' })),
      h('div', { class: 'eacts' },
        stockPill(p), removeImg,
        armedButton('حذف المنتج', 'تأكيد الحذف', function () {
          if (p.img) queueDelete(p.img);
          state.products = state.products.filter(function (x) { return x !== p; });
          markDirty(); renderBody();
        })));
    return row;
  }
  function tabProducts() {
    var list = h('div', { class: 'abody', style: 'padding:0' });
    var q = h('input', { type: 'search', placeholder: 'ابحث عن منتج', 'aria-label': 'بحث' });
    var cat = h('select', { 'aria-label': 'القسم' }, h('option', { value: 'all', text: 'كل الأقسام' }), state.categories.map(function (c) { return h('option', { value: c.id, text: c.name }); }));
    function apply() { filterRows(list, q.value.trim(), cat.value); }
    q.addEventListener('input', apply); cat.addEventListener('change', apply);
    var add = h('button', {
      class: 'btn', type: 'button', onclick: function () {
        var cid = cat.value !== 'all' ? cat.value : (state.categories[0] || {}).id;
        if (!cid) { toast('أضف قسم أولاً من تبويب الأقسام'); return; }
        state.products.unshift({ id: uid(), name: '', price: 0, unit: 'كيلو', cat: cid, img: '', emoji: '🥬', desc: '', inStock: true });
        markDirty(); renderBody();
        var first = aEls.body.querySelector('.erow input[type="text"]'); if (first) first.focus();
      }
    }, icon('plus'), 'منتج جديد');
    aEls.body.append(h('div', { class: 'toolbar' }, q, cat, add), list);
    state.products.forEach(function (p) { list.append(productEditor(p)); });
    if (!state.products.length) list.append(h('p', { class: 'empty', text: 'ما فيه منتجات. اضغط منتج جديد.' }));
  }

  /* ---------- تبويب: الأقسام ---------- */
  function tabCats() {
    var box = h('div', { class: 'abody', style: 'padding:0' });
    function move(i, d) {
      var j = i + d; if (j < 0 || j >= state.categories.length) return;
      var t = state.categories[i]; state.categories[i] = state.categories[j]; state.categories[j] = t;
      markDirty(); renderBody();
    }
    state.categories.forEach(function (c, i) {
      var inp = h('input', { type: 'text', 'aria-label': 'اسم القسم', value: c.name });
      inp.addEventListener('input', function () { c.name = inp.value; markDirty(); });
      var del = armedButton('حذف', 'تأكيد', function () {
        var used = state.products.some(function (p) { return p.cat === c.id; });
        if (used) { toast('فيه منتجات داخل هذا القسم، انقلها لقسم ثاني أول'); return; }
        if (state.categories.length < 2) { toast('لازم يبقى قسم واحد على الأقل'); return; }
        state.categories.splice(i, 1); markDirty(); renderBody();
      });
      box.append(h('div', { class: 'crow' }, inp,
        h('div', { class: 'cacts' },
          h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'رفع القسم', onclick: function () { move(i, -1); } }, icon('up')),
          h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'إنزال القسم', onclick: function () { move(i, 1); } }, icon('down')),
          del)));
    });
    var nin = h('input', { type: 'text', placeholder: 'اسم قسم جديد', id: 'newcat' });
    var addBtn = h('button', {
      class: 'btn', type: 'button', onclick: function () {
        var v = nin.value.trim(); if (!v) { nin.focus(); return; }
        state.categories.push({ id: 'c' + Date.now().toString(36), name: v });
        markDirty(); renderBody();
      }
    }, icon('plus'), 'إضافة قسم');
    aEls.body.append(h('p', { class: 'mut', text: 'رتّب الأقسام بالأسهم. الزبون يشوفها بنفس الترتيب.' }), box, h('div', { class: 'toolbar' }, nin, addBtn));
  }

  /* ---------- تبويب: الإعدادات ---------- */
  function tabSettings() {
    var s = state.settings;
    function txt(label, key, ph, wide, hint, type) {
      var i = h('input', { type: type || 'text', placeholder: ph || '', autocomplete: 'off' });
      i.value = s[key] || '';
      i.addEventListener('input', function () { s[key] = i.value; markDirty(); });
      return h('label', { class: 'f' + (wide ? ' wide' : '') }, label, i, hint ? h('span', { class: 'hint', text: hint }) : null);
    }
    function num(label, obj, key, hint) {
      var i = h('input', { type: 'number', inputmode: 'decimal', min: '0', step: '50' });
      i.value = obj[key] || 0;
      i.addEventListener('input', function () { var v = parseFloat(toLatin(i.value)); obj[key] = isNaN(v) || v < 0 ? 0 : v; markDirty(); });
      return h('label', { class: 'f' }, label, i, hint ? h('span', { class: 'hint', text: hint }) : null);
    }
    var d = s.delivery;
    var mode = h('select', { value: d.mode },
      h('option', { value: 'free', text: 'مجاني لكل الطلبات' }),
      h('option', { value: 'fee', text: 'برسوم ثابتة' }),
      h('option', { value: 'freeFrom', text: 'مجاني لما يوصل الطلب لمبلغ معيّن' }));
    mode.addEventListener('change', function () { d.mode = mode.value; markDirty(); renderBody(); });
    var openPill = h('button', {
      class: 'pill', type: 'button', 'aria-pressed': String(s.open !== false), text: s.open !== false ? 'مفتوح' : 'مغلق', onclick: function () {
        s.open = !(s.open !== false); openPill.setAttribute('aria-pressed', String(s.open)); openPill.textContent = s.open ? 'مفتوح' : 'مغلق'; markDirty();
      }
    });
    var siteUrl = new URL('../', location.href).href;
    var urlBox = h('input', { type: 'text', value: siteUrl, readonly: true, dir: 'ltr', 'aria-label': 'رابط الموقع' });
    var copyUrl = h('button', {
      class: 'btn quiet sm', type: 'button', style: 'grid-column:auto', onclick: function () {
        try { navigator.clipboard.writeText(siteUrl).then(function () { toast('تم نسخ الرابط'); }, function () { urlBox.select(); }); } catch (e) { urlBox.select(); }
      }
    }, icon('copy'), 'نسخ');
    aEls.body.append(
      h('div', { class: 'sgrid' },
        h('label', { class: 'f wide' }, 'رابط موقعك للزبائن (شاركه في واتساب وسناب)', h('div', { class: 'toolbar', style: 'grid-template-columns:minmax(0,1fr) auto' }, urlBox, copyUrl)),
        txt('اسم المحل', 'name', '', true),
        txt('جملة تحت الاسم', 'tagline', '', true),
        txt('رقم واتساب لاستقبال الطلبات', 'phone', '7XXXXXXXX', true, 'مثال يمني: 7XXXXXXXX، سعودي: 5XXXXXXXX. توصلك الطلبات على هذا الرقم برسالة جاهزة.', 'tel'),
        txt('ساعات الدوام', 'hours', 'مثال: من 7 الصباح إلى 11 الليل'),
        txt('مناطق التوصيل', 'areas', 'مثال: الشرج وما حوله'),
        txt('رسالة تظهر أعلى الصفحة (اختياري)', 'notice', '', true),
        h('label', { class: 'f' }, 'حالة المحل', openPill),
        num('الحد الأدنى للطلب (ر.ي)', s, 'minOrder', 'اتركه 0 لو ما فيه حد أدنى.'),
        h('label', { class: 'f wide' }, 'التوصيل', mode),
        d.mode !== 'free' ? num('رسوم التوصيل (ر.ي)', d, 'fee') : null,
        d.mode === 'freeFrom' ? num('التوصيل مجاني من (ر.ي)', d, 'freeFrom') : null));
  }

  /* ---------- الحفظ والنشر ---------- */
  async function save() {
    if (saving || !dirty) return;
    saving = true; updateUI();
    try {
      var cur = await api('/contents/data/store.json?ref=' + enc(cfg.branch));
      if (cur.sha !== sha) { var ce = new Error('conflict'); ce.conflict = true; throw ce; }
      var ts = Date.now().toString(36);
      for (var i = 0; i < state.products.length; i++) {
        var p = state.products[i];
        if (p._pend) {
          var path = 'images/' + p.id + '-' + ts + '.jpg';
          setStat('جارٍ رفع صورة ' + (p.name || 'المنتج') + '…');
          await api('/contents/' + path, { method: 'PUT', body: { message: 'رفع صورة منتج', content: p._pend.split(',')[1], branch: cfg.branch } });
          p.img = path; delete p._pend;
        }
      }
      state.seed = false;
      setStat('جارٍ نشر التعديلات…');
      var body = JSON.stringify(state, function (k, v) { return k.charAt(0) === '_' ? undefined : v; }, 2);
      var res = await api('/contents/data/store.json', { method: 'PUT', body: { message: 'تحديث المتجر', content: b64encode(body), sha: cur.sha, branch: cfg.branch } });
      sha = res.content.sha;
      dirty = false; window.onbeforeunload = null;
      var old = toDelete.slice(); toDelete = [];
      for (var k = 0; k < old.length; k++) {
        try {
          var f = await api('/contents/' + old[k] + '?ref=' + enc(cfg.branch));
          await api('/contents/' + old[k], { method: 'DELETE', body: { message: 'حذف صورة قديمة', sha: f.sha, branch: cfg.branch } });
        } catch (e) { /* تجاهل: حذف الصورة القديمة اختياري */ }
      }
      toast('تم النشر. تظهر التعديلات للزبائن خلال دقيقة تقريباً.');
    } catch (e) {
      toast(e && e.conflict ? 'تم تعديل المتجر من مكان ثاني. حدّث الصفحة ثم أعد التعديل.' : errMsg(e));
    } finally {
      saving = false; renderTop(); renderBody();
    }
  }

  /* ---------- البداية ---------- */
  (function boot() {
    var c = U.lsGet(LS_CFG), t = U.lsGet(LS_TOKEN);
    if (c && c.owner && c.repo && t) {
      cfg = c; token = t;
      root.replaceChildren(h('p', { class: 'empty', text: 'جارٍ التحميل…' }));
      loadStore().then(renderApp, function (e) { showLogin(errMsg(e)); });
    } else {
      showLogin('');
    }
  })();
})();
