/* 修行日课 · 纯前端，数据只存 localStorage */
(function () {
  'use strict';

  var APP_VERSION = '1.0.0';

  /* ========= 清单配置：以后增改就改这里 =========
   * 每一项要有唯一且不再改动的 id（历史记录靠 id 对应）。
   * 带 children 的是一组，组本身不计数，只算子项。          */
  var CHECKLIST = [
    { id: 'sanqingli', title: '三清理', children: [
      { id: 'qingli-huanjing', title: '清理环境' },
      { id: 'qingli-shenti', title: '清理身体' },
      { id: 'qingli-xiangfa', title: '清理想法&念头' }
    ] },
    { id: 'duansheli', title: '断舍离' },
    { id: 'chanhuizhou', title: '10 遍忏悔咒' },
    { id: 'dazuo', title: '打坐🧘‍♂️' },
    { id: 'shaitaiyang', title: '晒太阳' }
  ];

  var DAY_START_HOUR = 5;             // 凌晨 5 点为一天的分界
  var STORE_KEY = 'xiuxing-rike.v1';
  var WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var CHEERS = [
    '今天的功课都做完了，辛苦了。',
    '七项圆满，好好歇一歇。',
    '日日是好日，今天也是。',
    '一点一点做，已经很好了。',
    '心定了，今天就圆满了。'
  ];

  /* ========= 工具 ========= */
  var LEAVES = [];   // 7 个可勾项
  var LABELS = {};
  CHECKLIST.forEach(function (it) {
    if (it.children) it.children.forEach(function (c) { LEAVES.push(c); LABELS[c.id] = c.title; });
    else { LEAVES.push(it); LABELS[it.id] = it.title; }
  });
  var LEAF_IDS = LEAVES.map(function (l) { return l.id; });

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dayKeyOf(ts) { return ymd(new Date(ts - DAY_START_HOUR * 3600 * 1000)); }
  function todayKey() { return dayKeyOf(Date.now()); }
  function parseKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function addDays(k, n) { var d = parseKey(k); d.setDate(d.getDate() + n); return ymd(d); }
  function hm(ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function cnDate(k) { var d = parseKey(k); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function weekOf(k) { return WEEK[parseKey(k).getDay()]; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ========= 存储 ========= */
  var storageOk = true;
  try { var t = '__rike_test__'; localStorage.setItem(t, '1'); localStorage.removeItem(t); }
  catch (e) { storageOk = false; }
  var memoryStore = null;

  function emptyData() { return { app: 'xiuxing-rike', version: 1, days: {} }; }
  function load() {
    if (!storageOk) return memoryStore || (memoryStore = emptyData());
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyData();
      var d = JSON.parse(raw);
      if (!d || typeof d.days !== 'object') return emptyData();
      return d;
    } catch (e) { return emptyData(); }
  }
  function save() {
    if (!storageOk) { memoryStore = data; return; }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (e) { toast('保存失败了，存储空间可能满了'); }
  }

  var data = load();
  var currentKey = todayKey();

  function ensureDay(k) {
    if (!data.days[k]) data.days[k] = { items: LEAF_IDS.slice(), done: {} };
    var day = data.days[k];
    if (!day.done) day.done = {};
    if (!day.items) day.items = LEAF_IDS.slice();
    if (k === currentKey) {
      // 今天：清单以当前配置为准（以后增改清单当天就生效）
      day.items = LEAF_IDS.slice();
    }
    return day;
  }
  function dayStat(k) {
    var day = data.days[k];
    if (!day) return null;
    var items = day.items && day.items.length ? day.items : LEAF_IDS;
    var n = 0;
    items.forEach(function (id) { if (day.done && day.done[id]) n++; });
    return { done: n, total: items.length, ratio: items.length ? n / items.length : 0 };
  }
  function isFull(k) { var s = dayStat(k); return !!s && s.total > 0 && s.done >= s.total; }

  /* ========= 今天视图 ========= */
  var CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
  function rowHtml(id, title, isGroup) {
    return '<label class="row' + (isGroup ? ' group-title' : '') + '">' +
      '<input type="checkbox" ' + (isGroup ? 'data-group="' + id + '"' : 'data-id="' + id + '"') + '>' +
      '<span class="box">' + CHECK_SVG + (isGroup ? '<span class="dash"></span>' : '') + '</span>' +
      '<span class="label">' + esc(title) + '</span>' +
      (isGroup ? '<span class="count"></span>' : '<span class="time"></span>') +
      '</label>';
  }
  function buildList() {
    var html = '';
    CHECKLIST.forEach(function (it) {
      if (it.children) {
        html += '<li class="group" data-gid="' + it.id + '">' + rowHtml(it.id, it.title, true) + '<ul class="sub-list">';
        it.children.forEach(function (c) { html += '<li class="item sub" data-li="' + c.id + '">' + rowHtml(c.id, c.title, false) + '</li>'; });
        html += '</ul></li>';
      } else {
        html += '<li class="item" data-li="' + it.id + '">' + rowHtml(it.id, it.title, false) + '</li>';
      }
    });
    $('list').innerHTML = html;
  }

  function renderToday() {
    var day = ensureDay(currentKey);
    LEAVES.forEach(function (l) {
      var li = document.querySelector('[data-li="' + l.id + '"]');
      var input = li.querySelector('input');
      var ts = day.done[l.id];
      input.checked = !!ts;
      li.classList.toggle('done', !!ts);
      li.querySelector('.time').textContent = ts ? hm(ts) : '';
    });
    CHECKLIST.forEach(function (g) {
      if (!g.children) return;
      var li = document.querySelector('[data-gid="' + g.id + '"]');
      var n = g.children.filter(function (c) { return day.done[c.id]; }).length;
      var all = n === g.children.length;
      li.classList.toggle('done', all);
      li.classList.toggle('partial', n > 0 && !all);
      var gi = li.querySelector('input');
      gi.checked = all; gi.indeterminate = n > 0 && !all;
      li.querySelector('.count').textContent = n + '/' + g.children.length;
    });
    var s = dayStat(currentKey);
    $('dateText').textContent = cnDate(currentKey);
    $('weekText').textContent = weekOf(currentKey);
    updateLateNote();
    $('progressText').innerHTML = '今天完成 <b>' + s.done + '</b>/' + s.total;
    $('progressBar').style.width = (s.ratio * 100) + '%';
    $('progressBar').parentNode.classList.toggle('full', s.done === s.total);
    var cheer = $('cheer');
    if (s.done === s.total) {
      var idx = parseKey(currentKey).getDate() % CHEERS.length;
      if (cheer.hidden || cheer.textContent !== CHEERS[idx]) { cheer.textContent = CHEERS[idx]; cheer.hidden = false; }
    } else cheer.hidden = true;
    document.title = '修行日课 · ' + s.done + '/' + s.total;
  }

  function updateLateNote() {
    var late = ymd(new Date()) !== currentKey;
    $('lateNote').hidden = !late;
    if (late) $('lateNote').textContent = '还没到早上 5 点，现在仍算 ' + cnDate(currentKey) + ' 这一天。';
  }

  function onListChange(e) {
    var input = e.target;
    if (input.tagName !== 'INPUT') return;
    if (checkRollover()) { toast('已经是新的一天了，清单重新开始'); return; }
    var day = ensureDay(currentKey);
    var now = Date.now();
    if (input.dataset.group) {
      var g = CHECKLIST.filter(function (x) { return x.id === input.dataset.group; })[0];
      var allDone = g.children.every(function (c) { return day.done[c.id]; });
      g.children.forEach(function (c) {
        if (allDone) delete day.done[c.id];
        else if (!day.done[c.id]) day.done[c.id] = now;
      });
    } else {
      var id = input.dataset.id;
      if (input.checked) day.done[id] = now; else delete day.done[id];
    }
    day.updatedAt = now;
    save();
    renderToday();
    renderRecords();
    if (isFull(currentKey) && (input.checked || input.dataset.group)) {
      var st = streak();
      if (st.now > 1) toast('已连续全勤 ' + st.now + ' 天');
    }
  }

  /* ========= 跨天 ========= */
  function checkRollover() {
    var k = todayKey();
    if (k === currentKey) return false;
    currentKey = k;
    ensureDay(currentKey);
    save();
    selectedKey = currentKey;
    viewMonth = monthOf(currentKey);
    renderToday();
    renderRecords();
    return true;
  }
  function softCheck() { if (checkRollover()) toast('新的一天开始了，清单已清零'); else updateLateNote(); }

  /* ========= 记录视图 ========= */
  function monthOf(k) { return k.slice(0, 7); }
  var selectedKey = currentKey;
  var viewMonth = monthOf(currentKey);

  function streak() {
    // 当前连续：今天全勤就从今天数，否则从昨天往回数（今天没做完不算断）
    var k = isFull(currentKey) ? currentKey : addDays(currentKey, -1);
    var now = 0;
    while (isFull(k)) { now++; k = addDays(k, -1); }
    // 最长连续
    var keys = Object.keys(data.days).filter(function (x) { return x <= currentKey && isFull(x); }).sort();
    var best = 0, run = 0, prev = null;
    keys.forEach(function (x) {
      run = (prev && addDays(prev, 1) === x) ? run + 1 : 1;
      if (run > best) best = run;
      prev = x;
    });
    return { now: now, best: Math.max(best, now) };
  }
  function level(k) {
    var s = dayStat(k);
    if (!s || s.done === 0) return 0;
    if (s.done >= s.total) return 4;
    if (s.ratio <= 1 / 3) return 1;
    if (s.ratio <= 2 / 3) return 2;
    return 3;
  }
  function earliestMonth() {
    var keys = Object.keys(data.days).sort();
    return keys.length ? monthOf(keys[0]) : monthOf(currentKey);
  }
  function shiftMonth(m, n) {
    var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + n;
    var d = new Date(y, mo, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function renderRecords() {
    var st = streak();
    $('streakNow').textContent = st.now;
    $('streakBest').textContent = st.best;
    var curMonth = monthOf(currentKey);
    $('monthFull').textContent = Object.keys(data.days).filter(function (k) { return monthOf(k) === curMonth && isFull(k); }).length;

    // 月历
    var y = +viewMonth.slice(0, 4), m = +viewMonth.slice(5, 7);
    $('monthTitle').textContent = y + '年' + m + '月';
    $('prevMonth').disabled = viewMonth <= earliestMonth();
    $('nextMonth').disabled = viewMonth >= curMonth;
    var first = new Date(y, m - 1, 1);
    var lead = (first.getDay() + 6) % 7;      // 周一开头
    var days = new Date(y, m, 0).getDate();
    var html = '';
    for (var i = 0; i < lead; i++) html += '<span class="cell blank"></span>';
    for (var d = 1; d <= days; d++) {
      var k = viewMonth + '-' + pad(d);
      var cls = 'cell';
      if (k > currentKey) cls += ' future';
      else cls += ' lv' + level(k);
      if (k === currentKey) cls += ' today';
      if (k === selectedKey) cls += ' sel';
      var s = dayStat(k);
      var tip = cnDate(k) + (s ? ' 完成 ' + s.done + '/' + s.total : ' 没有记录');
      html += k > currentKey
        ? '<span class="' + cls + '">' + d + '</span>'
        : '<button class="' + cls + '" data-day="' + k + '" title="' + tip + '" aria-label="' + tip + '">' + d + '</button>';
    }
    $('calGrid').innerHTML = html;

    renderDetail();
    renderItemStats();
  }

  function renderDetail() {
    var k = selectedKey;
    var day = data.days[k];
    var s = dayStat(k);
    var head = '<div class="detail-head"><h2 class="card-title" style="margin:0">' + cnDate(k) + ' ' + weekOf(k) +
      (k === currentKey ? '（今天）' : '') + '</h2>' +
      (s ? '<span class="ratio">完成 ' + s.done + '/' + s.total + (s.done >= s.total ? ' · 全勤' : '') + '</span>' : '') + '</div>';
    if (!day) { $('dayDetail').innerHTML = head + '<p class="empty">这天没有打开过，没有记录。</p>'; return; }
    var ids = (day.items && day.items.length ? day.items : LEAF_IDS).slice();
    Object.keys(day.done || {}).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    var list = ids.map(function (id) {
      var ts = day.done[id];
      return '<li class="' + (ts ? 'ok' : 'no') + '"><span class="mk">✓</span><span>' + esc(LABELS[id] || id) + '</span>' +
        '<span class="t">' + (ts ? hm(ts) + ' 完成' : '未完成') + '</span></li>';
    }).join('');
    $('dayDetail').innerHTML = head + '<ul class="detail-list">' + list + '</ul>' +
      (k === currentKey && s.done < s.total ? '<p class="empty" style="margin-top:8px">今天还没结束，明早 5 点前都还能勾。</p>' : '');
  }

  function renderItemStats() {
    var keys = [];
    for (var i = 0; i < 30; i++) keys.push(addDays(currentKey, -i));
    var html = LEAVES.map(function (l) {
      var n = keys.filter(function (k) { var d = data.days[k]; return d && d.done && d.done[l.id]; }).length;
      return '<li data-stat="' + l.id + '"><span class="nm">' + esc(l.title) + '</span><span class="tr"><i style="width:' + (n / 30 * 100) + '%"></i></span><span class="n">' + n + ' 次</span></li>';
    }).join('');
    $('itemStats').innerHTML = html;
  }

  /* ========= 导出 / 导入 / 清空 ========= */
  function exportData() {
    var out = { app: 'xiuxing-rike', version: 1, exportedAt: new Date().toISOString(), dayStartHour: DAY_START_HOUR,
      checklist: CHECKLIST, days: data.days };
    var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '修行日课-备份-' + ymd(new Date()) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('已导出 ' + Object.keys(data.days).length + ' 天的记录');
  }
  function importText(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { toast('这个文件读不了，不是有效的备份'); return false; }
    if (!obj || typeof obj.days !== 'object' || Array.isArray(obj.days)) { toast('这个文件里没有找到打卡记录'); return false; }
    var n = 0;
    Object.keys(obj.days).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      var src = obj.days[k];
      if (!src || typeof src !== 'object') return;
      var dst = data.days[k] || (data.days[k] = { items: Array.isArray(src.items) ? src.items.slice() : LEAF_IDS.slice(), done: {} });
      var sd = src.done && typeof src.done === 'object' ? src.done : {};
      Object.keys(sd).forEach(function (id) {
        var ts = Number(sd[id]);
        if (!ts || !isFinite(ts)) return;
        if (!dst.done[id] || ts < dst.done[id]) dst.done[id] = ts;   // 合并：保留更早的完成时间
      });
      if (Array.isArray(src.items)) src.items.forEach(function (id) { if (dst.items.indexOf(id) < 0) dst.items.push(id); });
      n++;
    });
    save();
    renderToday(); renderRecords();
    toast('已导入 ' + n + ' 天的记录（和现有记录合并）');
    return true;
  }
  function clearAll() {
    data = emptyData();
    ensureDay(currentKey);
    save();
    selectedKey = currentKey; viewMonth = monthOf(currentKey);
    renderToday(); renderRecords();
    toast('记录已清空');
  }

  /* ========= 小部件 ========= */
  var toastTimer;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }
  function switchView(v) {
    document.querySelectorAll('.tab').forEach(function (b) {
      var on = b.dataset.view === v;
      b.classList.toggle('active', on); b.setAttribute('aria-selected', on);
    });
    document.querySelectorAll('.view').forEach(function (s) { s.classList.toggle('active', s.id === 'view-' + v); });
    if (v === 'records') renderRecords();
  }

  /* ========= 启动 ========= */
  function init() {
    $('ver').textContent = APP_VERSION;
    if (!storageOk) $('storageWarn').hidden = false;
    buildList();
    ensureDay(currentKey);
    save();
    renderToday();
    renderRecords();

    $('list').addEventListener('change', onListChange);
    document.querySelectorAll('.tab').forEach(function (b) { b.addEventListener('click', function () { switchView(b.dataset.view); }); });
    $('calGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-day]'); if (!b) return;
      selectedKey = b.dataset.day; renderRecords();
    });
    $('prevMonth').addEventListener('click', function () { viewMonth = shiftMonth(viewMonth, -1); renderRecords(); });
    $('nextMonth').addEventListener('click', function () { viewMonth = shiftMonth(viewMonth, 1); renderRecords(); });
    $('exportBtn').addEventListener('click', exportData);
    $('importBtn').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { importText(String(r.result)); };
      r.readAsText(f);
      this.value = '';
    });
    $('clearBtn').addEventListener('click', function () { $('confirmMask').hidden = false; $('confirmNo').focus(); });
    $('confirmNo').addEventListener('click', function () { $('confirmMask').hidden = true; });
    $('confirmYes').addEventListener('click', function () { $('confirmMask').hidden = true; clearAll(); });
    $('confirmMask').addEventListener('click', function (e) { if (e.target === this) this.hidden = true; });

    // 跨过 5 点自动换天：定时检查 + 回到页面时检查
    setInterval(softCheck, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) softCheck(); });
    window.addEventListener('focus', softCheck);
    window.addEventListener('pageshow', softCheck);
    // 其他标签页改了数据
    window.addEventListener('storage', function (e) {
      if (e.key !== STORE_KEY) return;
      data = load(); renderToday(); renderRecords();
    });

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  // 给测试和调试用的只读入口
  window.__rike = { todayKey: todayKey, data: function () { return data; }, importText: importText, version: APP_VERSION };

  init();
})();
