/* 修行日课 · 纯前端，数据只存 localStorage */
(function () {
  'use strict';

  var APP_VERSION = '1.5.0';

  /* ========= 清单配置：以后增改就改这里 =========
   * 每一项要有唯一且不再改动的 id（历史记录靠 id 对应）。
   * 带 children 的是一组，组本身不计数，只算子项。          */
  var CHECKLIST = [
    { id: 'sanqingli', title: '三清理断舍离', children: [
      { id: 'qingli-huanjing', title: '清理环境' },
      { id: 'qingli-shenti', title: '清理身体和情绪', link: { text: '回春叩问', href: 'https://xiangshu3721.github.io/huichun/', title: '打开《回春明点叩问》' } },
      { id: 'qingli-xiangfa', title: '清理信息&关系&想法&念头' }
    ] },
    // v1.3 起去掉了独立的「断舍离」（id: duansheli）。旧日子里的记录仍留在数据里，但不再显示、不参与计数。
    { id: 'chanhuizhou', title: '10 遍忏悔咒', scripture: 'chanhui' },
    { id: 'dazuo', title: '打坐🧘‍♂️' },
    { id: 'shaitaiyang', title: '晒太阳' }
  ];

  /* 经文：清单项里写 scripture: 'xxx' 就会在那一项旁边出现「看经文」 */
  var SCRIPTURES = {
    chanhui: {
      title: '忏悔文',
      img: 'img/chanhui.jpg?v=8',
      lines: ['往昔所造诸恶业', '皆由无始贪嗔痴', '从身语意之所生', '今对佛前求忏悔',
              '罪从心起将心忏', '心若灭时罪亦亡', '心灭罪亡两俱空', '是则名为真忏悔']
    }
  };

  var DAY_START_HOUR = 5;             // 凌晨 5 点为一天的分界
  var STORE_KEY = 'xiuxing-rike.v1';
  var WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var CHEERS = [
    '今天的功课都做完了，辛苦了。',
    '{N}项圆满，好好歇一歇。',
    '日日是好日，今天也是。',
    '一点一点做，已经很好了。',
    '心定了，今天就圆满了。'
  ];

  /* ========= 工具 ========= */
  var LEAVES = [];   // 可勾项（目前 6 个）
  var LABELS = {};
  CHECKLIST.forEach(function (it) {
    if (it.children) it.children.forEach(function (c) { LEAVES.push(c); LABELS[c.id] = c.title; });
    else { LEAVES.push(it); LABELS[it.id] = it.title; }
  });
  var LEAF_IDS = LEAVES.map(function (l) { return l.id; });
  var CN_NUM = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
  CHEERS = CHEERS.map(function (c) { return c.replace('{N}', CN_NUM[LEAF_IDS.length] || String(LEAF_IDS.length)); });

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
    // 一律按“当前清单”计数：已经去掉的项（如旧的断舍离）不算，旧日子做完当前这几项也算全勤
    var items = LEAF_IDS;
    var n = 0;
    items.forEach(function (id) { if (day.done && day.done[id]) n++; });
    return { done: n, total: items.length, ratio: items.length ? n / items.length : 0 };
  }
  function isFull(k) { var s = dayStat(k); return !!s && s.total > 0 && s.done >= s.total; }

  /* ========= 今天视图 ========= */
  var CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
  // 外链：手机/微信里在当前页打开（返回后打卡状态从本地存储恢复），电脑上开新标签
  function linkTarget() {
    var wx = /MicroMessenger/i.test(navigator.userAgent);
    var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    return wx || coarse ? '' : ' target="_blank" rel="noopener"';
  }
  function linkHtml(link) {
    if (!link || !/^https:\/\//.test(link.href)) return '';
    return '<a class="sutra-btn link-btn" data-ext href="' + esc(link.href) + '"' + linkTarget() +
      ' title="' + esc(link.title || link.text) + '">' + esc(link.text) + '<span class="ext-arrow" aria-hidden="true">↗</span></a>';
  }
  function rowHtml(id, title, isGroup, scripture, link) {
    return '<label class="row' + (isGroup ? ' group-title' : '') + '">' +
      '<input type="checkbox" ' + (isGroup ? 'data-group="' + id + '"' : 'data-id="' + id + '"') + '>' +
      '<span class="box">' + CHECK_SVG + (isGroup ? '<span class="dash"></span>' : '') + '</span>' +
      '<span class="label"><span class="tx">' + esc(title) + '</span></span>' +
      linkHtml(link) +
      (scripture && SCRIPTURES[scripture] ? '<button type="button" class="sutra-btn" data-sutra="' + scripture + '" aria-label="看' + esc(SCRIPTURES[scripture].title) + '">看经文</button>' : '') +
      (isGroup ? '<span class="count"></span>' : '<span class="time"></span>') +
      '</label>';
  }
  function buildList() {
    var html = '';
    CHECKLIST.forEach(function (it) {
      if (it.children) {
        html += '<li class="group" data-gid="' + it.id + '">' + rowHtml(it.id, it.title, true) + '<ul class="sub-list">';
        it.children.forEach(function (c) { html += '<li class="item sub" data-li="' + c.id + '">' + rowHtml(c.id, c.title, false, c.scripture, c.link) + '</li>'; });
        html += '</ul></li>';
      } else {
        html += '<li class="item" data-li="' + it.id + '">' + rowHtml(it.id, it.title, false, it.scripture, it.link) + '</li>';
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

  var SHARE_DAY_BTN = '<div class="detail-share"><button class="btn btn-small" type="button" data-share-day>保存这一天的图片</button></div>';
  function renderDetail() {
    var k = selectedKey;
    var day = data.days[k];
    var s = dayStat(k);
    var head = '<div class="detail-head"><h2 class="card-title" style="margin:0">' + cnDate(k) + ' ' + weekOf(k) +
      (k === currentKey ? '（今天）' : '') + '</h2>' +
      (s ? '<span class="ratio">完成 ' + s.done + '/' + s.total + (s.done >= s.total ? ' · 全勤' : '') + '</span>' : '') + '</div>';
    if (!day) { $('dayDetail').innerHTML = head + '<p class="empty">这天没有打开过，没有记录。</p>' + SHARE_DAY_BTN; return; }
    var ids = LEAF_IDS.slice();   // 只显示当前清单里的项
    var list = ids.map(function (id) {
      var ts = day.done[id];
      return '<li class="' + (ts ? 'ok' : 'no') + '"><span class="mk">✓</span><span>' + esc(LABELS[id] || id) + '</span>' +
        '<span class="t">' + (ts ? hm(ts) + ' 完成' : '未完成') + '</span></li>';
    }).join('');
    $('dayDetail').innerHTML = head + '<ul class="detail-list">' + list + '</ul>' +
      (k === currentKey && s.done < s.total ? '<p class="empty" style="margin-top:8px">今天还没结束，明早 5 点前都还能勾。</p>' : '') + SHARE_DAY_BTN;
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


  /* ========= 分享图（Canvas 纯前端生成） ========= */
  var SITE = 'xiangshu3721.github.io/xiuxing-rike';
  var C = { paper: '#f5f0e6', card: '#fbf8f2', line: '#e2dacb', ink: '#2b2a27', soft: '#6b665c', faint: '#aaa497',
    green: '#3f5e4f', green2: '#557566', gold: '#b8924a', qinghui: '#8f9b98', track: '#e9e2d3' };
  var SERIF = '"Songti SC","STSong","Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif';
  var SANS = '-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Noto Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
  function noEmoji(t) {
    return String(t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u200D\uFE0F\u20E3]/gu, '').replace(/\s+$/, '').trim();
  }
  function streakAt(k) {
    // 全勤日：从这天往回数；没全勤的日子：数到前一天（“此前连续”）
    var n = 0, x = isFull(k) ? k : addDays(k, -1);
    while (isFull(x)) { n++; x = addDays(x, -1); }
    return n;
  }
  function spaced(ctx, text, x, y, gap, align) {
    var chars = Array.from(text), w = 0;
    chars.forEach(function (c, i) { w += ctx.measureText(c).width + (i < chars.length - 1 ? gap : 0); });
    var cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    var oldAlign = ctx.textAlign; ctx.textAlign = 'left';
    chars.forEach(function (c) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + gap; });
    ctx.textAlign = oldAlign;
    return w;
  }
  function wrapLines(ctx, text, maxW) {
    // 优先在 & 或空格后断行，放不下再按字断
    var tokens = text.match(/[^&\s]+[&\s]*|[&\s]+/g) || [text];
    var lines = [], cur = '';
    tokens.forEach(function (t) {
      if (ctx.measureText(cur + t).width <= maxW) { cur += t; return; }
      if (cur) { lines.push(cur.trim()); cur = ''; }
      Array.from(t).forEach(function (ch) {
        if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ''; }
        cur += ch;
      });
    });
    if (cur.trim()) lines.push(cur.trim());
    return lines.length ? lines : [text];
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function enso(ctx, cx, cy, r) {
    ctx.save(); ctx.strokeStyle = C.green; ctx.lineCap = 'round';
    var a0 = -50 * Math.PI / 180, a1 = 262 * Math.PI / 180, steps = 60;
    for (var i = 0; i < steps; i++) {
      var t = i / steps;
      ctx.lineWidth = r * 0.16 * (0.55 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
      ctx.beginPath(); ctx.arc(cx, cy, r, a0 + (a1 - a0) * t, a0 + (a1 - a0) * (t + 1 / steps) + 0.01); ctx.stroke();
    }
    var ga = -72 * Math.PI / 180;
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(cx + r * Math.cos(ga), cy + r * Math.sin(ga), r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function checkBox(ctx, x, y, size, done) {
    rrect(ctx, x, y, size, size, size * 0.26);
    if (done) {
      ctx.fillStyle = C.green; ctx.fill();
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = size * 0.11; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x + size * 0.24, y + size * 0.52); ctx.lineTo(x + size * 0.43, y + size * 0.7); ctx.lineTo(x + size * 0.77, y + size * 0.31); ctx.stroke(); ctx.restore();
    } else {
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#c3c8c3'; ctx.lineWidth = 3; ctx.stroke();
    }
  }
  function seal(ctx, cx, cy, size) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-8 * Math.PI / 180);
    rrect(ctx, -size / 2, -size / 2, size, size, size * 0.14);
    ctx.fillStyle = 'rgba(184,146,74,0.08)'; ctx.fill();
    ctx.lineWidth = size * 0.05; ctx.strokeStyle = C.gold; ctx.stroke();
    rrect(ctx, -size / 2 + size * 0.09, -size / 2 + size * 0.09, size * 0.82, size * 0.82, size * 0.09);
    ctx.lineWidth = size * 0.015; ctx.stroke();
    ctx.fillStyle = C.gold; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + Math.round(size * 0.3) + 'px ' + SERIF;
    ctx.fillText('圆', 0, -size * 0.17); ctx.fillText('满', 0, size * 0.19);
    ctx.restore();
  }

  function shareMessage(k, s) {
    var isToday = k === currentKey;
    if (s.total > 0 && s.done >= s.total) return CHEERS[parseKey(k).getDate() % CHEERS.length];
    if (s.done === 0) return isToday ? '新的一天，从一件小事开始。' : '这一天歇了歇，明天又是新的开始。';
    return isToday ? '已完成 ' + s.done + ' 项，继续慢慢来。' : '这天完成了 ' + s.done + ' 项，一点一点来就好。';
  }

  function drawShare(k) {
    var day = data.days[k] || { items: LEAF_IDS.slice(), done: {} };
    var done = day.done || {};
    var s = dayStat(k) || { done: 0, total: LEAF_IDS.length, ratio: 0 };
    var full = s.total > 0 && s.done >= s.total;
    var isToday = k === currentKey;
    var st = streakAt(k);

    // 行：只画已完成的项（按当前清单结构，组里有完成的子项才画组标题）；没完成的、已从清单去掉的都不画
    var rows = [];
    CHECKLIST.forEach(function (it) {
      if (it.children) {
        var doneKids = it.children.filter(function (c) { return done[c.id]; });
        if (!doneKids.length) return;
        rows.push({ type: 'group', title: it.title, n: doneKids.length, total: it.children.length });
        doneKids.forEach(function (c) { rows.push({ type: 'sub', title: c.title, ts: done[c.id] }); });
      } else if (done[it.id]) rows.push({ type: 'item', title: it.title, ts: done[it.id] });
    });

    var W = 1080, PX = 96;
    var ROW = { group: 104, sub: 92, item: 108 };
    var cx0 = PX - 16, cw = W - (PX - 16) * 2;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = 10;
    var ctx = cv.getContext('2d');
    // 先量好每行要几行字（长名字自动换行）
    rows.forEach(function (r) {
      var indent = r.type === 'sub' ? 64 : 0;
      r.box = r.type === 'sub' ? 44 : 50;
      r.bx = cx0 + 40 + indent;
      r.fs = r.type === 'group' ? 46 : r.type === 'sub' ? 40 : 44;
      r.font = (r.type === 'group' ? '700 ' : '') + r.fs + 'px ' + SERIF;
      ctx.font = '32px ' + SANS;
      var rightW = r.type === 'group' ? 70 : ctx.measureText('00:00 完成').width;
      var tx = r.bx + r.box + 28;
      ctx.font = r.font;
      r.lines = wrapLines(ctx, noEmoji(r.title), (cx0 + cw - 44) - rightW - 28 - tx);
      r.lh = Math.round(r.fs * 1.32);
      r.h = ROW[r.type] + (r.lines.length - 1) * r.lh;
    });
    var listH = rows.length ? 28 + rows.reduce(function (a, r) { return a + r.h; }, 0) + 20 : 0;
    var listTop = 750;
    var H = rows.length ? listTop + listH + 220 : 930;   // 0 项：不画清单卡片，只留那句话
    cv.height = H;
    ctx.textBaseline = 'alphabetic';

    // 底色 + 双线框
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#ddd2bd'; ctx.lineWidth = 3; ctx.strokeRect(36, 36, W - 72, H - 72);
    ctx.strokeStyle = 'rgba(184,146,74,0.45)'; ctx.lineWidth = 1.5; ctx.strokeRect(50, 50, W - 100, H - 100);

    // 抬头
    enso(ctx, PX + 40, 158, 38);
    ctx.fillStyle = C.ink; ctx.font = '700 58px ' + SERIF;
    spaced(ctx, '修行日课', PX + 104, 180, 12);
    ctx.fillStyle = C.soft; ctx.font = '30px ' + SANS;
    ctx.textAlign = 'right'; ctx.fillText(isToday ? '今日功课' : '打卡回顾', W - PX, 176); ctx.textAlign = 'left';

    // 日期
    var d = parseKey(k);
    ctx.fillStyle = C.ink; ctx.font = '700 100px ' + SERIF;
    ctx.fillText((d.getMonth() + 1) + '月' + d.getDate() + '日', PX, 330);
    ctx.fillStyle = C.soft; ctx.font = '38px ' + SERIF;
    spaced(ctx, weekOf(k) + ' · ' + d.getFullYear() + '年', PX + 4, 396, 4);
    var rightX = W - PX;
    if (full) seal(ctx, rightX - 84, 304, 150);

    // 进度
    ctx.fillStyle = full ? C.green : C.green2; ctx.font = '700 150px ' + SERIF;
    ctx.fillText(String(s.done), PX - 4, 548);
    var nw = ctx.measureText(String(s.done)).width;
    ctx.fillStyle = C.soft; ctx.font = '60px ' + SERIF;
    ctx.fillText('/' + s.total, PX + nw + 4, 548);
    var tw = ctx.measureText('/' + s.total).width;
    ctx.font = '34px ' + SANS; ctx.fillStyle = C.soft;
    ctx.fillText('项完成', PX + nw + tw + 20, 546);

    // 连续全勤（右侧）
    if (full || st > 0) {
      var stLabel = full ? '连续全勤' : (isToday ? '已连续全勤' : '此前连续全勤');
      ctx.textAlign = 'right';
      ctx.fillStyle = C.soft; ctx.font = '34px ' + SANS; ctx.fillText(stLabel, rightX, 466);
      ctx.fillText('天', rightX, 546);
      var tianW = ctx.measureText('天').width;
      ctx.fillStyle = full ? C.gold : C.green; ctx.font = '700 84px ' + SERIF; ctx.fillText(String(st), rightX - tianW - 12, 548);
      ctx.textAlign = 'left';
    }

    // 进度条
    var by = 592, bw = W - PX * 2;
    rrect(ctx, PX, by, bw, 14, 7); ctx.fillStyle = C.track; ctx.fill();
    if (s.ratio > 0) {
      var g = ctx.createLinearGradient(PX, 0, PX + bw, 0);
      g.addColorStop(0, C.green2); g.addColorStop(1, full ? C.gold : C.green);
      rrect(ctx, PX, by, Math.max(14, bw * s.ratio), 14, 7); ctx.fillStyle = g; ctx.fill();
    }

    // 一句话
    ctx.font = (full ? '700 ' : '') + '40px ' + SERIF;
    ctx.fillStyle = full ? C.gold : C.soft;
    ctx.fillText(shareMessage(k, s), PX, 686);

    // 清单卡片
    if (rows.length) {
      rrect(ctx, cx0, listTop, cw, listH, 28); ctx.fillStyle = C.card; ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    }
    var y = listTop + 28;
    rows.forEach(function (r, i) {
      var h = r.h, indent = r.type === 'sub' ? 64 : 0;
      var bx = r.bx, box = r.box;
      var mid = y + h / 2;
      var firstBase = function (off) { return mid + off - (r.lines.length - 1) * r.lh / 2; };
      var drawTitle = function (off) { r.lines.forEach(function (ln, j) { ctx.fillText(ln, bx + box + 28, firstBase(off) + j * r.lh); }); };
      if (i > 0) {
        ctx.save(); ctx.strokeStyle = '#ebe4d6'; ctx.lineWidth = 2;
        if (r.type === 'sub') ctx.setLineDash([8, 8]);
        ctx.beginPath(); ctx.moveTo(cx0 + 32 + (r.type === 'sub' ? indent : 0), y); ctx.lineTo(cx0 + cw - 32, y); ctx.stroke(); ctx.restore();
      }
      if (r.type === 'group') {
        var gdone = r.n === r.total;
        checkBox(ctx, bx, mid - box / 2, box, gdone);
        if (!gdone && r.n > 0) { ctx.fillStyle = C.green; rrect(ctx, bx + 13, mid - 3, box - 26, 6, 3); ctx.fill(); }
        ctx.fillStyle = gdone || r.n ? C.ink : C.faint; ctx.font = r.font;
        drawTitle(16);
        ctx.textAlign = 'right'; ctx.fillStyle = gdone ? C.green : C.soft; ctx.font = '34px ' + SANS;
        ctx.fillText(r.n + '/' + r.total, cx0 + cw - 44, mid + 12); ctx.textAlign = 'left';
      } else {
        checkBox(ctx, bx, mid - box / 2, box, !!r.ts);
        ctx.fillStyle = r.ts ? C.ink : C.faint;
        ctx.font = r.font;
        drawTitle(15);
        ctx.textAlign = 'right'; ctx.font = '32px ' + SANS;
        ctx.fillStyle = r.ts ? C.green2 : '#c2bcae';
        ctx.fillText(r.ts ? hm(r.ts) + ' 完成' : '未完成', cx0 + cw - 44, mid + 11); ctx.textAlign = 'left';
      }
      y += h;
    });

    // 落款
    ctx.textAlign = 'center';
    ctx.fillStyle = C.faint; ctx.font = '28px ' + SANS;
    ctx.fillText('修行日课 · ' + SITE, W / 2, H - 104);
    ctx.fillStyle = 'rgba(184,146,74,0.7)';
    ctx.beginPath(); ctx.arc(W / 2, H - 150, 5, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'left';
    return cv;
  }

  var shareState = { url: '', name: '', dataUrl: '' };
  function isWeChat() { return /MicroMessenger/i.test(navigator.userAgent); }
  function isTouch() { return window.matchMedia && matchMedia('(pointer:coarse)').matches; }
  function isIOS() {
    var ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isStandalone() {
    return navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  }
  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(','), bin = atob(parts[1]), n = bin.length, arr = new Uint8Array(n);
    for (var i = 0; i < n; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: 'image/png' });
  }
  function openShare(k) {
    var cv;
    try { cv = drawShare(k); } catch (e) { toast('图片生成失败了，请再试一次'); return; }
    var dataUrl = cv.toDataURL('image/png');
    // 旧的 blob 链接稍后释放（给可能刚打开的新页面留时间）
    if (shareState.url) { var old = shareState.url; setTimeout(function () { URL.revokeObjectURL(old); }, 60000); }
    shareState = { dataUrl: dataUrl, name: '修行日课-' + k + '.png', url: '' };
    try { shareState.url = URL.createObjectURL(dataUrlToBlob(dataUrl)); } catch (e) { shareState.url = ''; }
    var img = $('shareImg');
    img.src = dataUrl;   // 预览用 data URL：微信 / iOS 长按保存最稳
    img.alt = '修行日课 ' + cnDate(k) + ' 打卡图';
    img.setAttribute('data-day', k);
    var wx = isWeChat(), touch = isTouch() || isIOS();
    $('shareDownload').hidden = wx;   // 微信里下载不可用，只提示长按
    $('shareHint').classList.remove('emph');
    $('shareHint').textContent = wx ? '长按图片，选择「保存图片」或「发送给朋友」'
      : touch ? '长按图片保存到相册，或点「下载图片」' : '点「下载图片」保存到电脑';
    $('shareMask').hidden = false;
  }
  function longPressHint(msg) {
    var h = $('shareHint');
    h.textContent = msg; h.classList.remove('emph'); void h.offsetWidth; h.classList.add('emph');
    toast(msg);
  }
  function downloadShare() {
    var st = shareState;
    if (!st.dataUrl) return;
    var url = st.url || st.dataUrl;
    var canDownload = 'download' in document.createElement('a');
    if (isIOS() || !canDownload || !st.url) {
      // iOS（含 iPadOS、主屏模式）不支持把图片直接下载到相册：
      // Safari 里在新页面打开图片供长按保存；主屏模式或被拦截时，直接提示长按预览图
      if (isIOS() && !isStandalone() && st.url) {
        var w = null;
        try { w = window.open(st.url, '_blank'); } catch (e) { w = null; }
        if (w) { toast('图片已在新页面打开，长按图片选「存储到照片」'); return; }
      }
      longPressHint(isIOS() ? '请长按上方图片，选择「存储到照片」' : '请长按上方图片保存');
      return;
    }
    var a = document.createElement('a');
    a.href = url; a.download = st.name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 1000);
    toast(isTouch() ? '已开始下载；如果没反应，请长按上方图片保存' : '已开始下载，可在浏览器的下载列表里找到');
  }
  function closeShare() { $('shareMask').hidden = true; }

  /* ========= 经文弹层 ========= */
  function openSutra(key) {
    var sc = SCRIPTURES[key]; if (!sc) return;
    $('sutraTitle').textContent = sc.title;
    var img = $('sutraImg');
    img.alt = sc.title + '（手写经文图）';
    if (img.getAttribute('src') !== sc.img) img.src = sc.img;
    $('sutraText').innerHTML = sc.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('');
    $('sutraMask').hidden = false;
    $('sutraMask').scrollTop = 0;
    $('sutraClose').focus({ preventScroll: true });
  }
  function closeSutra() { $('sutraMask').hidden = true; }

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
    $('ruleCount').textContent = LEAF_IDS.length;
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
    // 看经文：按钮在 label 里，拦住点击，不触发打卡
    $('list').addEventListener('click', function (e) {
      // 外链：放行跳转，但不让它冒泡成打卡
      if (e.target.closest('[data-ext]')) { e.stopPropagation(); return; }
      var b = e.target.closest('[data-sutra]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      openSutra(b.dataset.sutra);
    });
    $('sutraClose').addEventListener('click', closeSutra);
    $('sutraMask').addEventListener('click', function (e) { if (e.target === this || e.target.classList.contains('sutra-scroll')) closeSutra(); });
    // 分享图
    $('shareTodayBtn').addEventListener('click', function () { checkRollover(); openShare(currentKey); });
    $('dayDetail').addEventListener('click', function (e) { if (e.target.closest('[data-share-day]')) openShare(selectedKey); });
    $('shareClose').addEventListener('click', closeShare);
    $('shareMask').addEventListener('click', function (e) { if (e.target === this) closeShare(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeShare(); closeSutra(); $('confirmMask').hidden = true; } });
    $('shareDownload').addEventListener('click', downloadShare);

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
  window.__rike = { todayKey: todayKey, drawShare: function (k) { return drawShare(k).toDataURL('image/png'); }, data: function () { return data; }, importText: importText, version: APP_VERSION };

  init();
})();
