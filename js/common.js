/* أدوات مشتركة بين صفحة الزبون ولوحة التحكم */
(function () {
  'use strict';

  function h(tag, props) {
    var e = document.createElement(tag), p = props || {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v == null || v === false || k === 'value') return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : String(v));
    });
    var kids = Array.prototype.slice.call(arguments, 2);
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) return add(c);
        e.append(c.nodeType ? c : document.createTextNode(String(c)));
      });
    })(kids);
    if ('value' in p && p.value != null) e.value = p.value;
    return e;
  }

  var IC = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'
  };
  function icon(n) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ic');
    s.innerHTML = IC[n] || '';
    return s;
  }

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function r2(n) { return Math.round(n * 100) / 100; }
  function fmtNum(n) { return r2(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function money(n) { return fmtNum(n) + ' ر.ي'; }
  function toLatin(s) {
    return String(s == null ? '' : s)
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 1776); });
  }
  function digits(s) { return toLatin(s).replace(/\D/g, ''); }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast'); if (!t) return;
    t.replaceChildren(h('span', { text: msg }));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.replaceChildren(); }, 4200);
  }

  window.U = {
    h: h, icon: icon, lsGet: lsGet, lsSet: lsSet, lsDel: lsDel,
    r2: r2, fmtNum: fmtNum, money: money, toLatin: toLatin, digits: digits, toast: toast,
    UNITS: ['كيلو', 'نصف كيلو', 'حبة', 'ربطة', 'علبة', 'كرتون', 'صندوق', 'سلة']
  };
})();
