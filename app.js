/* 修行日课 · 纯前端，数据只存 localStorage */
(function () {
  'use strict';

  var APP_VERSION = '1.12.0';

  /* ========= 清单配置：以后增改就改这里 =========
   * 每一项要有唯一且不再改动的 id（历史记录靠 id 对应）。
   * 带 children 的是一组，组本身不计数，只算子项。
   * v1.12 起这里只放「固定项」（不能删、不能改名、固定在最前面）；后面的是用户的自定义任务（见 DEFAULT_TASKS / data.tasks）。 */
  var CHECKLIST = [
    // info：分组标题右侧出现「查看」，点开看说明（见下面 INFOS；v1.11 起）
    { id: 'sanqingli', title: '三清理断舍离', info: 'sanqingli', children: [
      // v1.11 起只改了显示名称，id 不变（历史数据、连续天数照旧）；「回春叩问」从 qingli-shenti 移到 qingli-xiangfa
      { id: 'qingli-huanjing', title: '清理周围环境和能量场' },
      { id: 'qingli-shenti', title: '清理身体和自己物品、信息' },
      { id: 'qingli-xiangfa', title: '清理内心和情绪', link: { text: '回春叩问', href: 'https://xiangshu3721.github.io/huichun/', title: '打开《回春明点叩问》' } }
    ] },
    // v1.3 起去掉了独立的「断舍离」（id: duansheli）。旧日子里的记录仍留在数据里，但不再显示、不参与计数。
    // since：从哪一天（按 5 点分界的日期）开始生效。之前的日子没有这一项，不算进当天的完成数和全勤
    // record：这一项不能直接勾，要点「记录」写下天气 / 压力 / 能量，保存后自动完成（v1.8 起）
    { id: 'tianqi-juecha', title: '天气预报觉察', since: '2026-10-06', record: true },
    { id: 'chanhuizhou', title: '10 遍忏悔咒', scripture: 'chanhui' }
  ];
  /* 自定义任务（v1.12）：存在 data.tasks 里，[{ id, title, since?, until?, at? }]，数组顺序就是显示顺序。
   * - 旧用户第一次打开时自动迁移成下面两项（id 不变，历史打卡、连续天数照旧）。
   * - 新增：id = custom-时间戳，since = 添加那天，之前的日子不算这一项。
   * - 删除：不真删，记 until = 删除那天，从那天起不再计入；之前的日子仍按当时清单算全勤、连续天数、历史详情、分享图。
   * - 改名：只改 title，id 不变。
   * - 图标：名字里有「打坐」的任务旁边画打坐小人（自绘 SVG，见 ICONS；v1.0～v1.9.0 是 🧘‍♂️ emoji，v1.9.1 起自绘三处一致）。 */
  var DEFAULT_TASKS = [{ id: 'dazuo', title: '打坐' }, { id: 'shaitaiyang', title: '晒太阳' }];
  var TASK_MAX = 20;      // 名称最多 20 个字
  var TASK_LIMIT = 20;    // 自定义任务最多 20 个

  /* 经文：清单项里写 scripture: 'xxx' 就会在那一项旁边出现「看经文」 */
  var SCRIPTURES = {
    chanhui: {
      title: '忏悔文',
      img: 'img/chanhui.jpg?v=19',
      lines: ['往昔所造诸恶业', '皆由无始贪嗔痴', '从身语意之所生', '今对佛前求忏悔',
              '罪从心起将心忏', '心若灭时罪亦亡', '心灭罪亡两俱空', '是则名为真忏悔']
    }
  };

  /* 说明：清单项 / 分组里写 info: 'xxx'，右侧出现「查看」，弹层显示下面的文字（逐字照用户原文，不加不改）。
     每段是若干行 [强调词, 后半句]，显示成「强调词：后半句」 */
  var INFOS = {
    sanqingli: {
      title: '三清理断舍离',
      sections: [
        [['断', '断掉无益之烦恼'], ['舍', '放舍执念与妄念'], ['离', '远离负能量']],
        [['早上', '清理周围环境和能量场'], ['下午', '清理自己和自己物品'], ['晚上', '清理内心']]
      ]
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

  /* 清单项小图标：24×24 线条路径，页面用内联 SVG、分享图用 Canvas Path2D 画同一份，iPhone / 安卓 / 微信显示一致 */
  var ICONS = {
    // 盘腿打坐的小人：实心头 + 身子 + 两手搭膝 + 盘起的腿
    dazuo: { label: '打坐', head: [12, 4.3, 2.6],
      d: 'M8.7 15.3c.3-4 1.4-7.3 3.3-7.3s3 3.3 3.3 7.3 M9.1 10.2c-1.8 1.3-3.2 3.1-4.3 5.2 M14.9 10.2c1.8 1.3 3.2 3.1 4.3 5.2 M2.4 18c3-2 6.2-2.7 9.6-2.7s6.6.7 9.6 2.7 M2.4 18c3 1.8 6.2 2.6 9.6 2.6s6.6-.8 9.6-2.6' }
  };
  function iconSvg(key) {
    var ic = ICONS[key]; if (!ic) return '';
    return '<svg class="item-icon" data-icon="' + key + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      (ic.head ? '<circle class="hd" cx="' + ic.head[0] + '" cy="' + ic.head[1] + '" r="' + ic.head[2] + '"/>' : '') + '<path d="' + ic.d + '"/></svg>';
  }

  /* ========= 工具 ========= */
  var FIXED_LEAVES = [];   // 固定的可勾项（三清理 3 项 + 天气预报觉察 + 忏悔咒）
  var LABELS = {}, ICON_OF = {}, FIXED_IDS = {}, FIXED_TITLES = [];
  CHECKLIST.forEach(function (it) {
    FIXED_IDS[it.id] = 1; FIXED_TITLES.push(it.title);
    (it.children || [it]).forEach(function (c) {
      if (c !== it) { FIXED_IDS[c.id] = 1; FIXED_TITLES.push(c.title); }
      FIXED_LEAVES.push(c); LABELS[c.id] = c.title; if (c.icon) ICON_OF[c.id] = c.icon;
    });
  });
  var tasks = [];   // = data.tasks（含已删除的，删除的带 until）
  function taskIcon(title) { return title.indexOf(ICONS.dazuo.label) >= 0 ? 'dazuo' : ''; }
  function taskLive(t, k) { return (!t.since || k >= t.since) && (!t.until || k < t.until); }
  function taskLeaf(t) { return { id: t.id, title: t.title, icon: taskIcon(t.title), custom: true }; }
  function activeTasks() { return tasks.filter(function (t) { return !t.until || t.until > currentKey; }); }   // 没删除的（管理弹层里列的）
  function refreshLabels() {
    tasks.forEach(function (t) { LABELS[t.id] = t.title; var ic = taskIcon(t.title); if (ic) ICON_OF[t.id] = ic; else delete ICON_OF[t.id]; });
  }
  // 某一天生效的清单：固定项（带 since 的只从那天起算）+ 当天有效的自定义任务（since ≤ 那天 < until）
  function leavesFor(k) {
    return FIXED_LEAVES.filter(function (l) { return !l.since || k >= l.since; })
      .concat(tasks.filter(function (t) { return taskLive(t, k); }).map(taskLeaf));
  }
  function leafIdsFor(k) { return leavesFor(k).map(function (l) { return l.id; }); }
  // 中文数字：0～99（2 用「两」，如「两项圆满」）
  function cnNum(n) {
    var D = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    if (n === 2) return '两';
    if (n < 0 || n > 99 || n % 1) return String(n);
    if (n < 10) return D[n];
    var t = Math.floor(n / 10), o = n % 10;
    return (t === 1 ? '' : D[t]) + '十' + (o ? D[o] : '');
  }
  function cheerFor(k) {
    var n = leafIdsFor(k).length;
    var line = CHEERS[parseKey(k).getDate() % CHEERS.length];
    if (line.indexOf('{N}') >= 0 && n <= 0) line = CHEERS[0];   // 0 项的边界：不说「零项圆满」
    return line.replace('{N}', cnNum(n));
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dayKeyOf(ts) { return ymd(new Date(ts - DAY_START_HOUR * 3600 * 1000)); }
  function todayKey() { return dayKeyOf(Date.now()); }
  function parseKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function addDays(k, n) { var d = parseKey(k); d.setDate(d.getDate() + n); return ymd(d); }
  function cnDate(k) { var d = parseKey(k); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function weekOf(k) { return WEEK[parseKey(k).getDay()]; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ========= 天气预报觉察（v1.8）=========
   * 每天的记录里加一个新字段 juecha：{ weather: 文字(1～50 字), stress: 1～10, energy: 1～10, at: 最后保存的时间戳(只存不显示) }
   * 完成与否仍看 done['tianqi-juecha']（含义不变）：保存觉察时自动写入，清除时一起删掉。 */
  var RECORD_ID = 'tianqi-juecha';
  var WEATHER_MAX = 50;
  function charLen(t) { return Array.from(t).length; }
  function cleanJuecha(j) {
    // 校验并规整一条觉察；不合格返回 null（导入旧/坏数据时用）
    if (!j || typeof j !== 'object') return null;
    var w = typeof j.weather === 'string' ? j.weather.trim() : '';
    var st = Number(j.stress), en = Number(j.energy);
    if (!w || charLen(w) > WEATHER_MAX) return null;
    if (!(st >= 1 && st <= 10 && st % 1 === 0) || !(en >= 1 && en <= 10 && en % 1 === 0)) return null;
    var out = { weather: w, stress: st, energy: en };
    var at = Number(j.at);
    if (at && isFinite(at)) out.at = at;
    return out;
  }
  function juechaOf(day) { return day ? cleanJuecha(day.juecha) : null; }
  function juechaText(j) { return j.weather + ' · 压力 ' + j.stress + ' · 能量 ' + j.energy; }

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

  /* ========= 自定义任务：规整 / 迁移 ========= */
  var KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
  function normTasks(arr) {
    var seen = {}, out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (t) {
      if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !/^[A-Za-z0-9_-]{1,48}$/.test(t.id)) return;
      if (FIXED_IDS[t.id] || seen[t.id]) return;   // 固定项不能出现在自定义里
      var title = typeof t.title === 'string' ? t.title.trim() : '';
      if (!title) return;
      if (charLen(title) > TASK_MAX) title = Array.from(title).slice(0, TASK_MAX).join('');
      var o = { id: t.id, title: title };
      if (KEY_RE.test(t.since || '')) o.since = t.since;
      if (KEY_RE.test(t.until || '')) o.until = t.until;
      var at = Number(t.at); if (at && isFinite(at)) o.at = at;
      seen[t.id] = 1; out.push(o);
    });
    return out;
  }
  function ensureTasks() {
    // 旧数据没有 tasks 字段：迁移成默认的 [打坐, 晒太阳]（id 不变）
    if (!Array.isArray(data.tasks)) data.tasks = DEFAULT_TASKS.map(function (t) { return { id: t.id, title: t.title }; });
    data.tasks = normTasks(data.tasks);
    tasks = data.tasks;
    refreshLabels();
  }
  ensureTasks();

  function ensureDay(k) {
    if (!data.days[k]) data.days[k] = { items: leafIdsFor(k), done: {} };
    var day = data.days[k];
    if (!day.done) day.done = {};
    if (!day.items) day.items = leafIdsFor(k);
    if (k === currentKey) {
      // 今天：清单以当前配置为准（增删自定义任务当天就生效）
      day.items = leafIdsFor(k);
    }
    return day;
  }
  function dayStat(k) {
    var day = data.days[k];
    if (!day) return null;
    // 按“当天生效的清单”计数：已经去掉的项（如旧的断舍离）不算；新加的项（天气预报觉察）只从加入那天起算
    var items = leafIdsFor(k);
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
  function rowHtml(id, title, isGroup, scripture, link, record, info) {
    return '<label class="row' + (isGroup ? ' group-title' : '') + '">' +
      '<input type="checkbox" ' + (isGroup ? 'data-group="' + id + '"' : 'data-id="' + id + '"') + '>' +
      '<span class="box">' + CHECK_SVG + (isGroup ? '<span class="dash"></span>' : '') + '</span>' +
      '<span class="label"><span class="tx">' + esc(title) + '</span>' + (isGroup ? '' : iconSvg(ICON_OF[id])) + '</span>' +
      linkHtml(link) +
      (scripture && SCRIPTURES[scripture] ? '<button type="button" class="sutra-btn" data-sutra="' + scripture + '" aria-label="看' + esc(SCRIPTURES[scripture].title) + '">看经文</button>' : '') +
      (record ? '<button type="button" class="sutra-btn record-btn" data-record="' + id + '" aria-label="记录' + esc(title) + '">记录</button>' : '') +
      (info && INFOS[info] ? '<button type="button" class="sutra-btn view-btn" data-info="' + info + '" aria-label="查看' + esc(INFOS[info].title) + '说明">查看</button>' : '') +
      (isGroup ? '<span class="count"></span>' : '') +   // v1.7 起不显示完成时间（内部仍记录时间戳）
      '</label>';
  }
  function buildList() {
    var html = '';
    CHECKLIST.forEach(function (it) {
      if (it.children) {
        html += '<li class="group" data-gid="' + it.id + '">' + rowHtml(it.id, it.title, true, null, null, null, it.info) + '<ul class="sub-list">';
        it.children.forEach(function (c) { html += '<li class="item sub" data-li="' + c.id + '">' + rowHtml(c.id, c.title, false, c.scripture, c.link, c.record) + '</li>'; });
        html += '</ul></li>';
      } else {
        html += '<li class="item' + (it.record ? ' has-record' : '') + '" data-li="' + it.id + '">' + rowHtml(it.id, it.title, false, it.scripture, it.link, it.record) +
          (it.record ? '<p class="jc-sum" data-record="' + it.id + '" hidden></p>' : '') + '</li>';
      }
    });
    // 自定义任务排在固定项后面
    leavesFor(currentKey).filter(function (l) { return l.custom; }).forEach(function (l) {
      html += '<li class="item custom" data-li="' + l.id + '">' + rowHtml(l.id, l.title, false) + '</li>';
    });
    $('list').innerHTML = html;
    $('ruleCount').textContent = leafIdsFor(currentKey).length;
  }

  function renderToday() {
    var day = ensureDay(currentKey);
    leavesFor(currentKey).forEach(function (l) {
      var li = document.querySelector('[data-li="' + l.id + '"]');
      if (!li) { buildList(); li = document.querySelector('[data-li="' + l.id + '"]'); }
      var input = li.querySelector('input');
      var ts = day.done[l.id];
      input.checked = !!ts;
      li.classList.toggle('done', !!ts);
      if (l.record) {
        var sum = li.querySelector('.jc-sum'), j = ts ? juechaOf(day) : null;
        sum.hidden = !j;
        sum.textContent = j ? juechaText(j) : '';   // 不显示时间
      }
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
      var line = cheerFor(currentKey);
      if (cheer.hidden || cheer.textContent !== line) { cheer.textContent = line; cheer.hidden = false; }
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
      if (id === RECORD_ID) { input.checked = !!day.done[id]; openJuecha(); return; }   // 不能直接勾，只能通过「记录」完成
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
    buildList();
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
  var MIN_MONTH = '2000-01';   // 往前最多翻到这里（v1.10 起不再卡在「最早有记录的月份」）
  function clampMonth(m) { var cur = monthOf(currentKey); return m > cur ? cur : m < MIN_MONTH ? MIN_MONTH : m; }
  function monthLabel(m) {
    var y = +m.slice(0, 4), mo = +m.slice(5, 7);
    return (y === +currentKey.slice(0, 4) ? '' : y + '年') + mo + '月';
  }
  function monthCounts(m) {
    var checked = 0, full = 0;
    Object.keys(data.days).forEach(function (k) {
      if (monthOf(k) !== m || k > currentKey) return;
      var st = dayStat(k);
      if (st && st.done > 0) checked++;
      if (isFull(k)) full++;
    });
    return { checked: checked, full: full };
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
    viewMonth = clampMonth(viewMonth);
    // 月度统计跟着日历所选的月份走；连续全勤是全局的，不变
    var mc = monthCounts(viewMonth);
    $('monthFull').textContent = mc.full;
    $('monthFullLabel').textContent = (viewMonth === curMonth ? '本月' : monthLabel(viewMonth)) + '全勤（天）';
    $('calSummary').textContent = monthLabel(viewMonth) + ' · 打卡 ' + mc.checked + ' 天 · 全勤 ' + mc.full + ' 天';

    // 月历
    var y = +viewMonth.slice(0, 4), m = +viewMonth.slice(5, 7);
    $('monthTitle').textContent = y + '年' + m + '月';
    $('prevMonth').disabled = viewMonth <= MIN_MONTH;
    $('nextMonth').disabled = viewMonth >= curMonth;   // 不能翻到未来
    $('calToday').hidden = viewMonth === curMonth;
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
    renderTrend();
  }

  /* ========= 日历：展开 / 收起、切月、年月选择、左右滑动 ========= */
  function setCalOpen(open) {
    var card = $('calCard'), body = $('calBody');
    card.classList.toggle('open', open);
    $('calToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    $('calToggleText').textContent = open ? '收起' : '展开';
    if (open) body.removeAttribute('inert'); else body.setAttribute('inert', '');
  }
  function goMonth(m, anim) {
    m = clampMonth(m);
    if (m === viewMonth) return false;
    var dir = m > viewMonth ? 'next' : 'prev';
    viewMonth = m;
    renderRecords();
    if (anim !== false) {
      var g = $('calGrid');
      g.classList.remove('slide-next', 'slide-prev'); void g.offsetWidth; g.classList.add('slide-' + dir);
    }
    return true;
  }
  var ymYear = 0;
  function renderYm() {
    var cur = monthOf(currentKey), curY = +cur.slice(0, 4), html = '';
    $('ymYear').textContent = ymYear + '年';
    $('ymPrevYear').disabled = ymYear <= +MIN_MONTH.slice(0, 4);
    $('ymNextYear').disabled = ymYear >= curY;
    var has = {};
    Object.keys(data.days).forEach(function (k) { var st = dayStat(k); if (st && st.done > 0) has[monthOf(k)] = 1; });
    for (var i = 1; i <= 12; i++) {
      var m = ymYear + '-' + pad(i), dis = m > cur || m < MIN_MONTH;
      html += '<button type="button" class="ym-m' + (m === viewMonth ? ' on' : '') + (m === cur ? ' now' : '') + (has[m] ? ' has' : '') + '" data-ym="' + m + '"' +
        (dis ? ' disabled' : '') + ' aria-label="' + ymYear + '年' + i + '月' + (dis ? '（还没到）' : '') + '">' + i + '月</button>';
    }
    $('ymGrid').innerHTML = html;
  }
  function openYm() { ymYear = +viewMonth.slice(0, 4); renderYm(); $('ymMask').hidden = false; $('ymClose').focus({ preventScroll: true }); }
  function closeYm() { $('ymMask').hidden = true; }
  function initCalendar() {
    setCalOpen(false);   // 默认收起，不记住展开状态
    $('calToggle').addEventListener('click', function () { setCalOpen(!$('calCard').classList.contains('open')); });
    $('prevMonth').addEventListener('click', function () { goMonth(shiftMonth(viewMonth, -1)); });
    $('nextMonth').addEventListener('click', function () { goMonth(shiftMonth(viewMonth, 1)); });
    $('calToday').addEventListener('click', function () { goMonth(monthOf(currentKey)); });
    $('monthTitle').addEventListener('click', openYm);
    $('ymClose').addEventListener('click', closeYm);
    $('ymMask').addEventListener('click', function (e) { if (e.target === this) closeYm(); });
    $('ymPrevYear').addEventListener('click', function () { ymYear--; renderYm(); });
    $('ymNextYear').addEventListener('click', function () { ymYear++; renderYm(); });
    $('ymNow').addEventListener('click', function () { closeYm(); goMonth(monthOf(currentKey)); setCalOpen(true); });
    $('ymGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ym]'); if (!b || b.disabled) return;
      closeYm(); goMonth(b.dataset.ym); setCalOpen(true);
    });
    // 手机上左右滑动切月：只认明显的水平滑动，竖向滚动不受影响
    var sw = null, swipedAt = 0, body = $('calBody');
    body.addEventListener('touchstart', function (e) {
      sw = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
    }, { passive: true });
    body.addEventListener('touchend', function (e) {
      if (!sw || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - sw.x, dy = e.changedTouches[0].clientY - sw.y, dt = Date.now() - sw.t;
      sw = null;
      if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 900) {
        if (goMonth(shiftMonth(viewMonth, dx < 0 ? 1 : -1))) swipedAt = Date.now();
        else toast(dx < 0 ? '已经是本月了' : '不能再往前了');
      }
    }, { passive: true });
    body.addEventListener('touchcancel', function () { sw = null; }, { passive: true });
    // 滑动结束时手指下的那一天不要被当成点击
    $('calGrid').addEventListener('click', function (e) { if (Date.now() - swipedAt < 450) { e.stopPropagation(); e.preventDefault(); } }, true);
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
    var ids = leafIdsFor(k);   // 只显示那天生效的清单项
    var jc = juechaOf(day);
    var list = ids.map(function (id) {
      var ts = day.done[id];
      var note = id === RECORD_ID && ts && jc ? '<span class="jc-sub">' + esc(juechaText(jc)) + '</span>' : '';
      return '<li class="' + (ts ? 'ok' : 'no') + '"' + (id === RECORD_ID ? ' data-detail="' + id + '"' : '') + '><span class="mk">✓</span><span>' + esc(LABELS[id] || id) + iconSvg(ICON_OF[id]) + note + '</span>' +
        (ts ? '' : '<span class="t">未完成</span>') + '</li>';
    }).join('');
    $('dayDetail').innerHTML = head + '<ul class="detail-list">' + list + '</ul>' +
      (k === currentKey && s.done < s.total ? '<p class="empty" style="margin-top:8px">今天还没结束，明早 5 点前都还能勾。</p>' : '') + SHARE_DAY_BTN;
  }

  function renderItemStats() {
    var keys = [];
    for (var i = 0; i < 30; i++) keys.push(addDays(currentKey, -i));
    var html = leavesFor(currentKey).map(function (l) {
      var n = keys.filter(function (k) { var d = data.days[k]; return d && d.done && d.done[l.id]; }).length;
      return '<li data-stat="' + l.id + '"><span class="nm">' + esc(l.title) + iconSvg(l.icon) + '</span><span class="tr"><i style="width:' + (n / 30 * 100) + '%"></i></span><span class="n">' + n + ' 次</span></li>';
    }).join('');
    $('itemStats').innerHTML = html;
  }

  // 近 30 天压力 / 能量：一张很简单的 SVG 折线（没记的日子断开）
  function renderTrend() {
    var keys = [];
    for (var i = 29; i >= 0; i--) keys.push(addDays(currentKey, -i));
    var pts = keys.map(function (k) { var d = data.days[k]; return d && d.done && d.done[RECORD_ID] ? juechaOf(d) : null; });
    var n = pts.filter(Boolean).length;
    var el = $('trend');
    if (!n) { el.innerHTML = '<p class="empty">还没有觉察记录。每天在「天气预报觉察」点「记录」，这里会出现近 30 天的压力和能量。</p>'; return; }
    var X0 = 26, X1 = 312, Y0 = 12, Y1 = 112;
    var x = function (i) { return (X0 + (X1 - X0) * i / 29).toFixed(1); };
    var y = function (v) { return (Y1 - (Y1 - Y0) * (v - 1) / 9).toFixed(1); };
    function series(key, cls) {
      var segs = [], cur = [], dots = '';
      pts.forEach(function (p, i) {
        if (p) { cur.push(x(i) + ',' + y(p[key])); dots += '<circle class="' + cls + '" cx="' + x(i) + '" cy="' + y(p[key]) + '" r="2.6"/>'; }
        else if (cur.length) { segs.push(cur); cur = []; }
      });
      if (cur.length) segs.push(cur);
      return segs.filter(function (s) { return s.length > 1; }).map(function (s) { return '<polyline class="' + cls + '" points="' + s.join(' ') + '"/>'; }).join('') + dots;
    }
    var grid = [1, 5, 10].map(function (v) {
      return '<line class="g" x1="' + X0 + '" x2="' + X1 + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="ax" x="' + (X0 - 8) + '" y="' + (+y(v) + 3.5) + '" text-anchor="end">' + v + '</text>';
    }).join('');
    var avg = function (key) { var t = 0; pts.forEach(function (p) { if (p) t += p[key]; }); return (t / n).toFixed(1).replace(/\.0$/, ''); };
    el.innerHTML =
      '<div class="trend-legend"><span class="lg stress">压力</span><span class="lg energy">能量</span><span class="avg">' + n + ' 天 · 平均压力 ' + avg('stress') + ' · 平均能量 ' + avg('energy') + '</span></div>' +
      '<svg class="trend-svg" viewBox="0 0 320 132" role="img" aria-label="近 30 天压力和能量折线">' + grid +
      series('stress', 'stress') + series('energy', 'energy') +
      '<text class="ax" x="' + X0 + '" y="128">' + cnDate(keys[0]) + '</text><text class="ax" x="' + X1 + '" y="128" text-anchor="end">今天</text></svg>';
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
  /* ========= 全勤印章（v1.9：每次生成分享图都随机词 / 样式 / 颜色）========= */
  // 鼓励词：中文最多两个字；英文是单个短词（最多 6 个字母，印章里横排）
  var STAMP_WORDS_ZH = ['真棒', '优秀', '牛', '坚持', '圆满', '精进', '厉害', '给力', '漂亮', '满分', '超棒', '加油', '好样',
    '稳', '赞', '自在', '清净', '善哉', '功成', '不错', '威武', '了得', '欢喜', '安然', '甚好', '妙', '绝了', '很强', '出色',
    '完美', '极好', '赞叹', '喜乐', '光明', '吉祥', '如意', '有恒', '心安', '日新', '精彩', '帅', '好极'];
  var STAMP_WORDS_EN = ['Nice', 'Good', 'Great', 'Cool', 'Wow', 'Yes', 'Bravo', 'Super', 'Top', 'Yay', 'Neat', 'Ace', 'Epic', 'Bingo'];
  function isEnWord(w) { return /^[A-Za-z]+$/.test(w); }
  var STAMP_WORDS = STAMP_WORDS_ZH.filter(function (w) { return Array.from(w).length <= 2; })
    .concat(STAMP_WORDS_EN.filter(function (w) { return isEnWord(w) && w.length <= 6; }));
  var EN_FONT = 'Georgia,"Times New Roman","Noto Serif","DejaVu Serif",serif';
  // 东方配色（米白纸上都清楚，不用荧光色）
  var STAMP_COLORS = [
    { name: '朱砂', hex: '#b5382a' }, { name: '暖金', hex: '#a9823a' }, { name: '墨绿', hex: '#3f5e4f' },
    { name: '靛青', hex: '#2e4a6b' }, { name: '赭石', hex: '#9a5a2e' }, { name: '胭脂', hex: '#a03650' }, { name: '紫檀', hex: '#6b3a3a' }
  ];
  // 样式：双线方章 / 圆章 / 椭圆章 / 圆角方 / 白文（实底）/ 八角章
  var STAMP_SHAPES = [
    { id: 'fang', name: '双线方章' }, { id: 'yuan', name: '圆章' }, { id: 'tuo', name: '椭圆章' },
    { id: 'yuanjiao', name: '圆角方章' }, { id: 'baiwen', name: '白文实底' }, { id: 'bajiao', name: '八角章' }
  ];
  var lastStamp = null;
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randomStamp() {
    // 词、样式、颜色、角度各自独立随机；角度在 -15° ~ +12° 之间
    return { word: pick(STAMP_WORDS), color: pick(STAMP_COLORS), shape: pick(STAMP_SHAPES), angle: Math.round(-15 + Math.random() * 27) };
  }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function stampPath(ctx, shape, w, h, inset) {
    var x = -w / 2 + inset, y = -h / 2 + inset, ww = w - inset * 2, hh = h - inset * 2;
    ctx.beginPath();
    if (shape === 'yuan' || shape === 'tuo') { ctx.ellipse(0, 0, ww / 2, hh / 2, 0, 0, Math.PI * 2); return; }
    if (shape === 'bajiao') {
      var c = Math.min(ww, hh) * 0.29;
      ctx.moveTo(x + c, y); ctx.lineTo(x + ww - c, y); ctx.lineTo(x + ww, y + c); ctx.lineTo(x + ww, y + hh - c);
      ctx.lineTo(x + ww - c, y + hh); ctx.lineTo(x + c, y + hh); ctx.lineTo(x, y + hh - c); ctx.lineTo(x, y + c); ctx.closePath(); return;
    }
    var r = shape === 'yuanjiao' || shape === 'baiwen' ? Math.min(ww, hh) * 0.26 : Math.min(ww, hh) * 0.1;
    rrect(ctx, x, y, ww, hh, r);
  }
  function seal(ctx, cx, cy, size, st) {
    st = st || randomStamp();
    lastStamp = { word: st.word, color: st.color.name, hex: st.color.hex, shape: st.shape.id, shapeName: st.shape.name, angle: st.angle };
    var shape = st.shape.id, col = st.color.hex;
    var w = shape === 'tuo' ? size * 0.8 : size * (shape === 'yuan' ? 1.04 : 1), h = shape === 'tuo' ? size * 1.1 : w;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(st.angle * Math.PI / 180);
    ctx.globalAlpha = 0.9 + Math.random() * 0.08;   // 印泥浓淡略有不同
    var solid = shape === 'baiwen';
    stampPath(ctx, shape, w, h, 0);
    if (solid) { ctx.fillStyle = col; ctx.fill(); }
    else {
      ctx.fillStyle = hexA(col, 0.07); ctx.fill();
      ctx.lineWidth = size * (shape === 'yuanjiao' ? 0.065 : 0.05); ctx.strokeStyle = col; ctx.stroke();
      if (shape === 'fang' || shape === 'yuan' || shape === 'bajiao') {   // 双线
        stampPath(ctx, shape, w, h, size * 0.09); ctx.lineWidth = size * 0.016; ctx.stroke();
      }
    }
    // 字：英文横排（斜体衬线，字号按印面宽度自适应，上下两道细线）；中文两个字竖排，一个字居中放大
    var chars = Array.from(st.word);
    ctx.fillStyle = solid ? C.paper : col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (isEnWord(st.word)) {
      var maxW = size * (shape === 'tuo' ? 0.56 : shape === 'yuan' ? 0.68 : shape === 'bajiao' ? 0.66 : 0.72);
      var efs = size * (st.word.length <= 3 ? 0.34 : 0.3);
      ctx.font = 'italic 700 ' + Math.round(efs) + 'px ' + EN_FONT;
      var tw = ctx.measureText(st.word).width;
      if (tw > maxW) { efs = Math.floor(efs * maxW / tw * 10) / 10; ctx.font = 'italic 700 ' + efs + 'px ' + EN_FONT; tw = ctx.measureText(st.word).width; }
      ctx.fillText(st.word, 0, size * 0.015);
      var lw = Math.min(maxW, Math.max(tw * 0.75, size * 0.3)), ly = efs * 0.62 + size * 0.04;
      ctx.fillRect(-lw / 2, -ly - size * 0.006, lw, size * 0.012);
      ctx.fillRect(-lw / 2, ly + size * 0.024, lw, size * 0.012);
    } else if (chars.length === 1) {
      ctx.font = '700 ' + Math.round(size * (shape === 'tuo' ? 0.46 : 0.52)) + 'px ' + SERIF;
      ctx.fillText(chars[0], 0, size * 0.02);
    } else {
      var fs = size * (shape === 'yuan' ? 0.27 : shape === 'bajiao' ? 0.28 : 0.3);
      var gap = shape === 'tuo' ? size * 0.2 : shape === 'yuan' ? size * 0.155 : size * 0.175;
      ctx.font = '700 ' + Math.round(fs) + 'px ' + SERIF;
      ctx.fillText(chars[0], 0, -gap + size * 0.01); ctx.fillText(chars[1], 0, gap + size * 0.01);
    }
    // 做旧：印面里撒一些米白小点（印泥不均），点小、不挡字
    ctx.globalAlpha = 1;
    stampPath(ctx, shape, w + size * 0.06, h + size * 0.06, 0); ctx.clip();
    for (var i = 0; i < 70; i++) {
      var a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 0.55;
      ctx.fillStyle = hexA(C.paper, 0.18 + Math.random() * (solid ? 0.35 : 0.3));
      ctx.beginPath(); ctx.arc(Math.cos(a) * d * w, Math.sin(a) * d * h, size * (0.004 + Math.random() * 0.014), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // 分享图里只在 0 项的日子用到这句话
  function shareMessage(k) {
    return k === currentKey ? '新的一天，从一件小事开始。' : '这一天歇了歇，明天又是新的开始。';
  }

  var shareIcons = [];
  function drawShare(k, forceStamp) {
    lastStamp = null;
    shareIcons = [];
    var day = data.days[k] || { items: leafIdsFor(k), done: {} };
    var done = day.done || {};
    var s = dayStat(k) || { done: 0, total: leafIdsFor(k).length, ratio: 0 };
    var eff = leafIdsFor(k);
    var full = s.total > 0 && s.done >= s.total;
    var isToday = k === currentKey;
    var st = streakAt(k);

    // 行：只画已完成的项（按当前清单结构，组里有完成的子项才画组标题）；没完成的、已从清单去掉的都不画
    var rows = [];
    // 固定项 + 那天有效的自定义任务（删除前的日子仍画当时的任务）
    CHECKLIST.concat(leavesFor(k).filter(function (l) { return l.custom; })).forEach(function (it) {
      if (it.children) {
        var doneKids = it.children.filter(function (c) { return done[c.id] && eff.indexOf(c.id) >= 0; });
        if (!doneKids.length) return;
        rows.push({ type: 'group', title: it.title, n: doneKids.length, total: it.children.length });
        doneKids.forEach(function (c) { rows.push({ type: 'sub', title: c.title, ts: done[c.id], icon: c.icon }); });
      } else if (done[it.id] && eff.indexOf(it.id) >= 0) {
        var jc = it.id === RECORD_ID ? juechaOf(day) : null;
        rows.push({ type: 'item', title: it.title, ts: done[it.id], note: jc ? juechaText(jc) : '', icon: it.icon });   // 觉察：下面附一行小字（不含时间）
      }
    });

    var W = 1080, PX = 96, NOTE_FONT = '32px ' + SANS, NOTE_LH = 46;
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
      var rightW = r.type === 'group' ? 70 : 0;   // 不画完成时间
      var tx = r.bx + r.box + 28;
      ctx.font = r.font;
      r.iconS = r.icon && ICONS[r.icon] ? Math.round(r.fs * 1.3) : 0;   // 图标约一个字高，跟在名字后面
      r.lines = wrapLines(ctx, noEmoji(r.title), (cx0 + cw - 44) - rightW - 28 - tx - (r.iconS ? r.iconS + 14 : 0));
      r.lh = Math.round(r.fs * 1.32);
      r.h = ROW[r.type] + (r.lines.length - 1) * r.lh;
      r.titleH = r.h;
      if (r.note) {
        ctx.font = NOTE_FONT;
        r.noteLines = wrapLines(ctx, r.note, (cx0 + cw - 44) - tx);
        r.h += r.noteLines.length * NOTE_LH - 6;
      }
    });
    var listH = rows.length ? 28 + rows.reduce(function (a, r) { return a + r.h; }, 0) + 20 : 0;
    var listTop = 460;   // 日期/星期下面直接接清单（v1.6.1 去掉了大数字、进度条和那句话）
    var contentBottom = rows.length ? listTop + listH : listTop + 90;   // 0 项：清单位置只放一句温和的话
    // 连续全勤：一行淡淡的小字，N ≥ 2 才显示
    var streakText = '';
    if (full && st >= 2) streakText = '连续全勤 ' + st + ' 天';
    else if (!full && isToday && st >= 2) streakText = '已连续全勤 ' + st + ' 天';
    var H = contentBottom + (streakText ? 70 : 0) + 210;
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
    seal(ctx, rightX - 84, 304, 150, forceStamp);   // v1.10：不管打卡几项（含 0 项）都盖随机印章，每次生成都重新随机

    // 0 项：清单区域只放一句温和的话
    if (!rows.length) {
      ctx.fillStyle = C.soft; ctx.font = '40px ' + SERIF;
      ctx.fillText(shareMessage(k, s), PX, listTop + 64);
    }

    // 清单卡片
    if (rows.length) {
      rrect(ctx, cx0, listTop, cw, listH, 28); ctx.fillStyle = C.card; ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    }
    var y = listTop + 28;
    rows.forEach(function (r, i) {
      var h = r.h, indent = r.type === 'sub' ? 64 : 0;
      var bx = r.bx, box = r.box;
      var mid = y + r.titleH / 2;   // 有小字的行：勾和标题在上，小字接在下面
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
        if (r.iconS) {
          var lastLn = r.lines[r.lines.length - 1], ibase = firstBase(15) + (r.lines.length - 1) * r.lh;
          var ix = bx + box + 28 + ctx.measureText(lastLn).width + 12, iy = ibase - r.fs * 1.08;
          ctx.save(); ctx.translate(ix, iy); ctx.scale(r.iconS / 24, r.iconS / 24);
          ctx.strokeStyle = C.green; ctx.fillStyle = C.green; ctx.lineWidth = 1.9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.stroke(new Path2D(ICONS[r.icon].d));
          var hd = ICONS[r.icon].head;
          if (hd) { ctx.beginPath(); ctx.arc(hd[0], hd[1], hd[2], 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
          shareIcons.push({ icon: r.icon, x: Math.round(ix), y: Math.round(iy), s: r.iconS });
        }
        if (r.noteLines) {
          ctx.fillStyle = C.soft; ctx.font = NOTE_FONT;
          var nb = firstBase(15) + (r.lines.length - 1) * r.lh + 52;
          r.noteLines.forEach(function (ln, j) { ctx.fillText(ln, bx + box + 28, nb + j * NOTE_LH); });
        }
      }
      y += h;
    });

    if (streakText) {
      ctx.fillStyle = C.faint; ctx.font = '30px ' + SANS;
      ctx.fillText(streakText, PX, contentBottom + 62);
    }

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
    var wx = isWeChat();
    // 能直接下载的环境（电脑、安卓 Chrome 等）：生成后直接下载，不弹预览
    if (canDirectDownload()) { triggerDownload(); return; }
    // iOS（Safari / 主屏）、微信、不支持下载的浏览器：弹预览，长按保存
    $('shareHint').classList.remove('emph');
    $('shareHint').textContent = wx ? '长按图片，选择「保存图片」或「发送给朋友」'
      : isIOS() ? '长按图片保存，选择「存储到照片」' : '长按图片保存';
    $('shareDownload').hidden = wx || !isIOS();   // 预览层里的按钮只给 iOS Safari 用（新页面打开图片）
    $('shareMask').hidden = false;
  }
  function longPressHint(msg) {
    var h = $('shareHint');
    h.textContent = msg; h.classList.remove('emph'); void h.offsetWidth; h.classList.add('emph');
    toast(msg);
  }
  function canDirectDownload() {
    return !isIOS() && !isWeChat() && !!shareState.url && ('download' in document.createElement('a'));
  }
  function triggerDownload() {
    var a = document.createElement('a');
    a.href = shareState.url; a.download = shareState.name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 1000);
    toast('已保存到下载');
  }
  function downloadShare() {
    var st = shareState;
    if (!st.dataUrl) return;
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
    triggerDownload();
  }
  function closeShare() { $('shareMask').hidden = true; }

  /* ========= 经文弹层 ========= */
  function openSutra(key) {
    var sc = SCRIPTURES[key]; if (!sc) return;
    $('sutraMask').classList.remove('info-mode');
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
  // 「查看」说明：复用经文弹层（不显示图片），强调词稍大、墨绿
  function openInfo(key) {
    var inf = INFOS[key]; if (!inf) return;
    $('sutraMask').classList.add('info-mode');
    $('sutraTitle').textContent = inf.title;
    $('sutraText').innerHTML = inf.sections.map(function (sec) {
      return '<div class="info-sec">' + sec.map(function (l) {
        return '<p><b class="info-k' + (l[0].length === 1 ? ' one' : '') + '">' + esc(l[0]) + '</b>：' + esc(l[1]) + '</p>';
      }).join('') + '</div>';
    }).join('');
    $('sutraMask').hidden = false;
    $('sutraMask').scrollTop = 0;
    $('sutraClose').focus({ preventScroll: true });
  }

  /* ========= 「记录」弹层：天气预报觉察 ========= */
  var jcForm = { stress: 0, energy: 0, key: '' };
  /* 压力 / 能量：左右拖动的滑杆（1～10，步长 1）。
   * 新建时是「未选择」（显示 —、滑块淡色，值 0），拖动、点按或用方向键动过才算选了。 */
  var SLIDER_MID = 5;   // 未选择时滑块停在中间（只是位置，不算数）
  function rangeEl(name) { return $('jcRange-' + name); }
  function setScore(name, v) {
    v = v ? Math.max(1, Math.min(10, Math.round(v))) : 0;
    var changed = jcForm[name] !== v;
    jcForm[name] = v;
    var el = rangeEl(name), wrap = $('jcSl-' + name);
    el.value = v || SLIDER_MID;
    wrap.classList.toggle('unset', !v);
    $('jc-f-' + name).classList.toggle('unset', !v);
    wrap.style.setProperty('--f', v ? ((v - 1) / 9).toFixed(4) : '0');
    el.setAttribute('aria-valuetext', v ? v + ' 分' : '未选择');
    $('jcVal-' + name).textContent = v ? String(v) : '—';
    if (v) $('jc-f-' + name).classList.remove('missing');
    if (changed && $('jcErr').textContent) validateJuecha(true);
  }
  function valueFromX(el, clientX) {
    var r = el.getBoundingClientRect();
    var t = parseFloat(getComputedStyle(el).getPropertyValue('--thumb')) || 30;
    var f = (clientX - r.left - t / 2) / Math.max(1, r.width - t);
    return Math.round(1 + Math.max(0, Math.min(1, f)) * 9);
  }
  function bindSlider(name) {
    var el = rangeEl(name), touch = null;
    var pick = function () { setScore(name, +el.value); };
    el.addEventListener('input', pick);
    el.addEventListener('change', pick);
    // 鼠标点在滑块上没挪动（值没变、不触发 input）也算选了
    el.addEventListener('pointerup', function (e) { if (e.pointerType !== 'touch') pick(); });
    el.addEventListener('keyup', function (e) { if (/^(Arrow|Home|End|Page)/.test(e.key)) pick(); });
    // 触屏：点哪里跳到哪里、横向拖动跟手（iPhone 原生只能拖滑块本身）；竖向滑动是滚动页面，不算选
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      touch = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    });
    el.addEventListener('pointermove', function (e) {
      if (!touch || e.pointerId !== touch.id) return;
      if (!touch.moved && Math.abs(e.clientX - touch.x) > 4 && Math.abs(e.clientX - touch.x) >= Math.abs(e.clientY - touch.y)) touch.moved = true;
      if (touch.moved) setScore(name, valueFromX(el, e.clientX));
    });
    el.addEventListener('pointerup', function (e) {
      if (!touch || e.pointerId !== touch.id) return;
      if (Math.abs(e.clientY - touch.y) < 10 || touch.moved) setScore(name, valueFromX(el, e.clientX));
      touch = null;
    });
    el.addEventListener('pointercancel', function () {
      // 原生滑杆接管了拖动时也会 cancel：值变了的话 input 事件已经记下；这里不再改
      touch = null;
    });
  }
  function weatherInfo() {
    var w = $('jcWeather').value.trim();
    var n = charLen(w);
    $('jcCount').textContent = n + '/' + WEATHER_MAX;
    $('jcCount').classList.toggle('over', n > WEATHER_MAX);
    return { text: w, n: n };
  }
  function validateJuecha(quiet) {
    var w = weatherInfo(), miss = [];
    var badW = !w.n || w.n > WEATHER_MAX;
    if (badW) miss.push('天气');
    if (!jcForm.stress) miss.push('压力');
    if (!jcForm.energy) miss.push('能量');
    $('jc-f-weather').classList.toggle('missing', badW);
    $('jc-f-stress').classList.toggle('missing', !jcForm.stress);
    $('jc-f-energy').classList.toggle('missing', !jcForm.energy);
    var msg = '';
    if (miss.length) msg = w.n > WEATHER_MAX && miss.length === 1 ? '天气最多 ' + WEATHER_MAX + ' 字，现在 ' + w.n + ' 字' : '还缺：' + miss.join('、') + '（三项都要记）';
    $('jcErr').textContent = msg;
    if (!quiet) {
      $('jcErr').classList.remove('emph'); void $('jcErr').offsetWidth; $('jcErr').classList.add('emph');
    }
    return miss.length ? null : { weather: w.text, stress: jcForm.stress, energy: jcForm.energy };
  }
  function openJuecha() {
    checkRollover();
    var day = ensureDay(currentKey);
    var j = juechaOf(day), done = !!day.done[RECORD_ID];
    jcForm.key = currentKey;
    $('jcDate').textContent = cnDate(currentKey) + ' ' + weekOf(currentKey);
    $('jcWeather').value = j ? j.weather : '';
    $('jcErr').textContent = '';
    ['weather', 'stress', 'energy'].forEach(function (f) { $('jc-f-' + f).classList.remove('missing'); });
    setScore('stress', j ? j.stress : 0);
    setScore('energy', j ? j.energy : 0);
    weatherInfo();
    $('jcState').textContent = done ? '今天已完成，可以查看和修改' : '三项都记下，保存后这一项自动完成';
    $('jcSave').textContent = done ? '保存修改' : '保存';
    $('jcClear').hidden = !(done || j);
    $('jcConfirm').hidden = true;
    $('jcActions').hidden = false;
    $('jcMask').hidden = false;
    $('jcMask').scrollTop = 0;
    if (!j && !isTouch()) $('jcWeather').focus({ preventScroll: true });
    else $('jcClose').focus({ preventScroll: true });
  }
  function closeJuecha() { $('jcMask').hidden = true; }
  function saveJuecha() {
    var v = validateJuecha(false);
    if (!v) return;
    if (checkRollover() || jcForm.key !== currentKey) { closeJuecha(); toast('已经是新的一天了，请重新记录'); return; }
    var day = ensureDay(currentKey), now = Date.now();
    var first = !day.done[RECORD_ID], wasEmpty = !juechaOf(day);
    v.at = now;
    day.juecha = v;
    if (first) day.done[RECORD_ID] = now;   // 保存即完成；修改时保留原来的完成时间戳
    day.updatedAt = now;
    save();
    closeJuecha();
    renderToday(); renderRecords();
    var st = streak();
    if (first && isFull(currentKey) && st.now > 1) toast('已记录，已连续全勤 ' + st.now + ' 天');
    else toast(first || wasEmpty ? '已记录，觉察完成' : '觉察已更新');
  }
  function clearJuecha() {
    var day = ensureDay(currentKey);
    delete day.juecha;
    delete day.done[RECORD_ID];
    day.updatedAt = Date.now();
    save();
    closeJuecha();
    renderToday(); renderRecords();
    toast('已清除今天的觉察');
  }
  function initJuecha() {
    bindSlider('stress'); bindSlider('energy');
    $('jcMask').addEventListener('click', function (e) {
      if (e.target === this || e.target.classList.contains('jc-scroll')) closeJuecha();
    });
    $('jcWeather').addEventListener('input', function () { weatherInfo(); if ($('jcErr').textContent) validateJuecha(true); });
    $('jcForm').addEventListener('submit', function (e) { e.preventDefault(); saveJuecha(); });
    $('jcClose').addEventListener('click', closeJuecha);
    $('jcCancel').addEventListener('click', closeJuecha);
    $('jcClear').addEventListener('click', function () { $('jcActions').hidden = true; $('jcConfirm').hidden = false; $('jcConfirmNo').focus({ preventScroll: true }); });
    $('jcConfirmNo').addEventListener('click', function () { $('jcConfirm').hidden = true; $('jcActions').hidden = false; });
    $('jcConfirmYes').addEventListener('click', clearJuecha);
  }

  /* ========= 管理任务（v1.12）：自定义任务的新增 / 改名 / 删除 / 排序 ========= */
  var tkEdit = null, tkAsk = null;   // 正在改名 / 正在确认删除的任务 id
  var LOCK_SVG = '<svg class="tk-lock" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="7" width="9.6" height="6.8" rx="1.6"/><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7"/></svg>';
  var CHEV = { up: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 10.2 8 5.8l4.5 4.4"/></svg>', down: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 5.8 8 10.2l4.5-4.4"/></svg>' };
  function checkTitle(raw, selfId) {
    var t = String(raw == null ? '' : raw).trim();
    if (!t) return { err: '请输入任务名称' };
    var n = charLen(t);
    if (n > TASK_MAX) return { err: '名称最多 ' + TASK_MAX + ' 个字（现在 ' + n + ' 个字）' };
    var low = t.toLowerCase();
    var names = FIXED_TITLES.concat(activeTasks().filter(function (x) { return x.id !== selfId; }).map(function (x) { return x.title; }));
    var clash = names.filter(function (x) { return x.toLowerCase() === low; })[0];
    if (clash) return { err: '已经有「' + clash + '」了，换个名字吧' };
    return { title: t };
  }
  function tasksChanged() {
    refreshLabels();
    ensureDay(currentKey);   // 今天的 items 跟着变
    save();
    buildList(); renderToday(); renderRecords(); renderManage();
  }
  function addTask(raw) {
    checkRollover();
    if (activeTasks().length >= TASK_LIMIT) return { err: '自定义任务最多 ' + TASK_LIMIT + ' 个' };
    var c = checkTitle(raw); if (c.err) return c;
    var now = Date.now(), id = 'custom-' + now;
    while (tasks.some(function (t) { return t.id === id; })) id = 'custom-' + (++now);
    tasks.push({ id: id, title: c.title, since: currentKey, at: Date.now() });
    tasksChanged();
    return { id: id, title: c.title };
  }
  function renameTask(id, raw) {
    var t = tasks.filter(function (x) { return x.id === id; })[0]; if (!t) return { err: '找不到这个任务' };
    var c = checkTitle(raw, id); if (c.err) return c;
    if (c.title !== t.title) { t.title = c.title; t.at = Date.now(); }
    tkEdit = null;
    tasksChanged();
    return c;
  }
  function deleteTask(id) {
    checkRollover();
    var t = tasks.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    t.until = currentKey; t.at = Date.now();   // 不删历史：从今天起不再计入
    if (t.since && t.since >= t.until) tasks.splice(tasks.indexOf(t), 1);   // 今天才加今天就删：从没生效过，直接拿掉（打卡数据仍留着）
    tkAsk = null;
    tasksChanged();
    toast('已删除「' + t.title + '」，以前的打卡记录都还在');
  }
  function moveTask(id, dir) {
    var act = activeTasks(), i = act.map(function (t) { return t.id; }).indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= act.length) return;
    var a = tasks.indexOf(act[i]), b = tasks.indexOf(act[j]);
    tasks[a] = act[j]; tasks[b] = act[i];
    act[i].at = act[j].at = Date.now();
    tasksChanged();
    var btn = document.querySelector('[data-tk="' + id + '"] [data-act="' + (dir < 0 ? 'up' : 'down') + '"]');
    if (btn && !btn.disabled) btn.focus({ preventScroll: true });
    else { btn = document.querySelector('[data-tk="' + id + '"] [data-act="' + (dir < 0 ? 'down' : 'up') + '"]'); if (btn) btn.focus({ preventScroll: true }); }
  }
  function renderManage() {
    var fx = '';
    CHECKLIST.forEach(function (it) {
      fx += '<li class="tk-fx' + (it.children ? ' grp' : '') + '"><span class="nm">' + esc(it.title) + '</span><span class="tk-tag">' + LOCK_SVG + '默认</span></li>';
      (it.children || []).forEach(function (c) { fx += '<li class="tk-fx sub"><span class="nm">' + esc(c.title) + '</span></li>'; });
    });
    $('tkFixed').innerHTML = fx;
    var act = activeTasks();
    var html = act.map(function (t, i) {
      var nm = esc(t.title);
      if (tkEdit === t.id) {
        return '<li class="tk-item editing" data-tk="' + t.id + '"><input class="jc-input tk-input" type="text" value="' + nm + '" maxlength="40" enterkeyhint="done" autocomplete="off" aria-label="「' + nm + '」的新名称">' +
          '<div class="tk-acts"><button type="button" class="btn btn-small" data-act="cancel">取消</button><button type="button" class="btn btn-small btn-primary" data-act="save">保存</button></div><p class="jc-err tk-ierr" role="alert"></p></li>';
      }
      if (tkAsk === t.id) {
        return '<li class="tk-item asking" data-tk="' + t.id + '"><p class="tk-q">删除「' + nm + '」？从今天起不再计入，以前的打卡记录都保留。</p>' +
          '<div class="tk-acts"><button type="button" class="btn btn-small" data-act="nodel">先不了</button><button type="button" class="btn btn-small btn-danger-solid" data-act="del">删除</button></div></li>';
      }
      return '<li class="tk-item" data-tk="' + t.id + '"><span class="nm">' + nm + iconSvg(taskIcon(t.title)) + '</span><div class="tk-acts">' +
        '<button type="button" class="tk-ib" data-act="up" aria-label="上移「' + nm + '」"' + (i === 0 ? ' disabled' : '') + '>' + CHEV.up + '</button>' +
        '<button type="button" class="tk-ib" data-act="down" aria-label="下移「' + nm + '」"' + (i === act.length - 1 ? ' disabled' : '') + '>' + CHEV.down + '</button>' +
        '<button type="button" class="tk-tb" data-act="edit" aria-label="改名「' + nm + '」">改名</button>' +
        '<button type="button" class="tk-tb del" data-act="ask" aria-label="删除「' + nm + '」">删除</button></div></li>';
    }).join('');
    $('tkList').innerHTML = html || '<li class="tk-empty">还没有自定义任务，在下面添加一个吧。</li>';
    $('tkCount').textContent = act.length + ' 个';
    var full = act.length >= TASK_LIMIT;
    $('tkNew').disabled = full; $('tkAddBtn').disabled = full;
    $('tkNew').placeholder = full ? '最多 ' + TASK_LIMIT + ' 个自定义任务' : '新任务，如：读书 20 分钟';
    var inp = document.querySelector('.tk-input');
    if (inp) { inp.focus({ preventScroll: true }); var L = inp.value.length; inp.setSelectionRange(L, L); }
  }
  function tkError(el, msg) {
    el.textContent = msg || '';
    el.classList.remove('emph'); if (msg) { void el.offsetWidth; el.classList.add('emph'); }
  }
  function openManage() {
    checkRollover();
    tkEdit = tkAsk = null;
    tkError($('tkErr'), ''); $('tkNew').value = ''; $('tkAdd').classList.remove('missing');
    renderManage();
    $('tkMask').hidden = false;
    $('tkBody').scrollTop = 0;
    $('tkClose').focus({ preventScroll: true });
  }
  function closeManage() { $('tkMask').hidden = true; tkEdit = tkAsk = null; }
  function initManage() {
    $('manageBtn').addEventListener('click', openManage);
    $('tkClose').addEventListener('click', closeManage);
    $('tkMask').addEventListener('click', function (e) { if (e.target === this) closeManage(); });
    $('tkAdd').addEventListener('submit', function (e) {
      e.preventDefault();
      var r = addTask($('tkNew').value);
      if (r.err) { tkError($('tkErr'), r.err); $('tkAdd').classList.add('missing'); $('tkNew').focus(); return; }
      tkError($('tkErr'), ''); $('tkAdd').classList.remove('missing'); $('tkNew').value = '';
      toast('已添加「' + r.title + '」，从今天起算');
      var body = $('tkBody'); body.scrollTop = body.scrollHeight;
    });
    $('tkNew').addEventListener('input', function () { if ($('tkErr').textContent) { tkError($('tkErr'), ''); $('tkAdd').classList.remove('missing'); } });
    $('tkList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      var li = b.closest('[data-tk]'), id = li.dataset.tk, act = b.dataset.act;
      if (act === 'up') moveTask(id, -1);
      else if (act === 'down') moveTask(id, 1);
      else if (act === 'edit') { tkEdit = id; tkAsk = null; renderManage(); }
      else if (act === 'cancel') { tkEdit = null; renderManage(); focusAct(id, 'edit'); }
      else if (act === 'save') saveRename(li);
      else if (act === 'ask') { tkAsk = id; tkEdit = null; renderManage(); focusAct(id, 'nodel'); }
      else if (act === 'nodel') { tkAsk = null; renderManage(); focusAct(id, 'ask'); }
      else if (act === 'del') deleteTask(id);
    });
    $('tkList').addEventListener('keydown', function (e) {
      if (!e.target.classList.contains('tk-input')) return;
      if (e.key === 'Enter') { e.preventDefault(); saveRename(e.target.closest('[data-tk]')); }
      else if (e.key === 'Escape') { e.stopPropagation(); var id = tkEdit; tkEdit = null; renderManage(); focusAct(id, 'edit'); }
    });
    $('tkList').addEventListener('input', function (e) {
      if (!e.target.classList.contains('tk-input')) return;
      var er = e.target.closest('[data-tk]').querySelector('.tk-ierr'); if (er.textContent) { tkError(er, ''); e.target.closest('[data-tk]').classList.remove('missing'); }
    });
  }
  function focusAct(id, act) { var b = document.querySelector('[data-tk="' + id + '"] [data-act="' + act + '"]'); if (b) b.focus({ preventScroll: true }); }
  function saveRename(li) {
    var id = li.dataset.tk, inp = li.querySelector('.tk-input');
    var r = renameTask(id, inp.value);
    if (r.err) { tkError(li.querySelector('.tk-ierr'), r.err); li.classList.add('missing'); inp.focus(); return; }
    toast('已改名为「' + r.title + '」');
    focusAct(id, 'edit');
  }

  /* ========= 导出 / 导入 / 清空 ========= */
  function exportData() {
    // days 里每天的 juecha（天气 / 压力 / 能量）原样导出
    var out = { app: 'xiuxing-rike', version: 1, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), dayStartHour: DAY_START_HOUR,
      checklist: CHECKLIST.concat(leavesFor(currentKey).filter(function (l) { return l.custom; })),   // 给人看的：今天的清单
      tasks: tasks, days: data.days };   // tasks：自定义任务（含已删除的，用于按当时清单计算历史）
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
      var dst = data.days[k] || (data.days[k] = { items: Array.isArray(src.items) ? src.items.slice() : leafIdsFor(k), done: {} });
      var sd = src.done && typeof src.done === 'object' ? src.done : {};
      Object.keys(sd).forEach(function (id) {
        var ts = Number(sd[id]);
        if (!ts || !isFinite(ts)) return;
        if (!dst.done[id] || ts < dst.done[id]) dst.done[id] = ts;   // 合并：保留更早的完成时间
      });
      if (Array.isArray(src.items)) src.items.forEach(function (id) { if (dst.items.indexOf(id) < 0) dst.items.push(id); });
      // 觉察内容（v1.8 新字段，旧备份没有就跳过）：本机没有就用备份的；两边都有时保留最后保存的那份
      var sj = cleanJuecha(src.juecha), dj = cleanJuecha(dst.juecha);
      if (sj && (!dj || (sj.at || 0) > (dj.at || 0))) dst.juecha = sj;
      n++;
    });
    // 自定义任务（v1.12）：旧备份没有 tasks 就保持本机清单；有就按 id 合并——本机没有的加到后面，两边都有时以后改的为准
    var tn = 0;
    if (Array.isArray(obj.tasks)) {
      normTasks(obj.tasks).forEach(function (t) {
        var cur = tasks.filter(function (x) { return x.id === t.id; })[0];
        if (!cur) { tasks.push(t); tn++; return; }
        if ((t.at || 0) > (cur.at || 0)) {
          cur.title = t.title; cur.at = t.at;
          if (t.since) cur.since = t.since; else delete cur.since;
          if (t.until) cur.until = t.until; else delete cur.until;
          tn++;
        }
      });
      refreshLabels();
    }
    save();
    buildList(); renderToday(); renderRecords();
    toast('已导入 ' + n + ' 天的记录（和现有记录合并）');
    return true;
  }
  function clearAll() {
    var keep = data.tasks;   // 清空的是打卡记录；自定义任务清单保留
    data = emptyData();
    data.tasks = keep; ensureTasks();
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
    if (v === 'records') { setCalOpen(false); renderRecords(); }   // 每次进入「打卡记录」日历默认收起
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

    initJuecha();
    $('list').addEventListener('change', onListChange);
    document.querySelectorAll('.tab').forEach(function (b) { b.addEventListener('click', function () { switchView(b.dataset.view); }); });
    $('calGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-day]'); if (!b) return;
      selectedKey = b.dataset.day; renderRecords();
    });
    initCalendar();
    initManage();
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
      // 天气预报觉察：整行（勾选框、项名、「记录」、下面的小字）都打开记录弹层，不直接勾选
      var rec = e.target.closest('[data-record]') || e.target.closest('[data-li="' + RECORD_ID + '"] > label.row');
      if (rec) { e.preventDefault(); e.stopPropagation(); openJuecha(); return; }
      var inf = e.target.closest('[data-info]');
      if (inf) { e.preventDefault(); e.stopPropagation(); openInfo(inf.dataset.info); return; }   // 不触发分组全勾
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
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeShare(); closeSutra(); closeJuecha(); closeYm(); closeManage(); $('confirmMask').hidden = true; } });
    $('shareDownload').addEventListener('click', downloadShare);

    // 跨过 5 点自动换天：定时检查 + 回到页面时检查
    setInterval(softCheck, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) softCheck(); });
    window.addEventListener('focus', softCheck);
    window.addEventListener('pageshow', softCheck);
    // 其他标签页改了数据
    window.addEventListener('storage', function (e) {
      if (e.key !== STORE_KEY) return;
      data = load(); ensureTasks(); buildList(); renderToday(); renderRecords(); if (!$('tkMask').hidden) renderManage();
    });

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  // 给测试和调试用的只读入口
  window.__rike = { todayKey: todayKey, drawShare: function (k) { return drawShare(k).toDataURL('image/png'); }, data: function () { return data; }, importText: importText, version: APP_VERSION, openJuecha: openJuecha,
    lastStamp: function () { return lastStamp; }, tasks: function () { return JSON.parse(JSON.stringify(tasks)); }, leavesFor: function (k) { return leafIdsFor(k); }, cheerFor: cheerFor, cnNum: cnNum, shareIcons: function () { return shareIcons.slice(); },
    // 调试 / 测试用：指定印章画一张（word 文字、color 颜色名、shape 样式 id、angle 角度）
    drawShareWith: function (k, o) {
      var c = STAMP_COLORS.filter(function (x) { return x.name === o.color; })[0] || STAMP_COLORS[0];
      var sh = STAMP_SHAPES.filter(function (x) { return x.id === o.shape; })[0] || STAMP_SHAPES[0];
      return drawShare(k, { word: String(o.word || '圆满'), color: c, shape: sh, angle: +o.angle || 0 }).toDataURL('image/png');
    }, stampWords: STAMP_WORDS.slice(), stampWordsEn: STAMP_WORDS_EN.slice(), stampColors: STAMP_COLORS.map(function (c) { return c.name; }), stampShapes: STAMP_SHAPES.map(function (x) { return x.id; }) };

  init();
})();
