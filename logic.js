'use strict';
/* 仕様書 第4章のロジック。純関数だけを置く（画面にも保存にも触らない）。
   ブラウザでは Logic、Node では require('./logic.js') で使う。テストは test/logic.test.js。

   データの形（バックアップも同じ項目名）
   種目:   { id, name, cat: '多'|'単'|'カ腹', main, aux: [], range: [下限, 上限], sets, inc, rest: 秒|null, memo, alts: [種目ID] }
   メニュー: { id, name, paused, ex: [種目ID] }            ※配列の順が並び順
   日:     { date: 'YYYY-MM-DD', menuId: ID|null, ex: [{ id, orig: 元の種目ID|null, sets: [{ w, r, l }] }] }
   設定:   { freq, method: 1|2, lastBackup: 日付|null, rest: { 多, 単, カ腹 }, target: { 部位: セット }, hide: { 部位: true } } */
(function (root) {
  const MUSCLES = ['胸', '背中', '三角筋側部', '三角筋後部', '上腕二頭', '上腕三頭', '大腿四頭', 'ハムストリングス', 'ふくらはぎ', '腹筋'];
  const CATS = ['多', '単', 'カ腹'];
  const FORMAT = 'kintore-backup', VERSION = 1;

  /* ---------- 日付（'YYYY-MM-DD' の文字列で扱う） ---------- */
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); }
  function diffDays(a, b) { return Math.round((parseKey(a) - parseKey(b)) / 86400000); }
  const sortedDates = days => Object.keys(days).sort();

  /* ---------- 数値の表示 ---------- */
  const fmtKg = n => String(Math.round(n * 100) / 100);
  const fmt1 = n => String(Math.round(n * 10) / 10);

  /* ---------- 4.4 推定1RM（O'Connor式） ---------- */
  const e1rm = (w, r) => w * (1 + 0.025 * r);
  const rmShown = s => !!s.l && s.w > 0 && s.r >= 1 && s.r <= 10;

  /* ---------- 4.1 実施判定とおすすめ ---------- */
  // その日に記録した種目（代替は元の種目に換算）
  function doneSlots(day) {
    return new Set(day.ex.filter(e => e.sets.length).map(e => e.orig || e.id));
  }
  function performedMenus(day, menus) {
    const done = doneSlots(day);
    return menus.filter(m => m.ex.length && m.ex.filter(id => done.has(id)).length >= Math.ceil(m.ex.length / 2)).map(m => m.id);
  }
  function lastPerformed(days, menus) {
    const out = {};
    sortedDates(days).forEach(d => performedMenus(days[d], menus).forEach(id => { out[id] = d; }));
    return out;
  }
  function recommend(menus, days, method) {
    const ok = m => !m.paused && m.ex.length > 0;
    const cands = menus.filter(ok);
    if (!cands.length) return null;
    const last = lastPerformed(days, menus);
    if (method === 2) {
      let at = -1, latest = '';
      menus.forEach((m, i) => { if (last[m.id] && last[m.id] >= latest) { latest = last[m.id]; at = i; } });
      for (let k = 1; k <= menus.length; k++) {
        const m = menus[(at + k + menus.length) % menus.length];
        if (ok(m)) return m.id;
      }
      return null;
    }
    let best = null;
    for (const m of cands) {
      if (!last[m.id]) return m.id;
      if (!best || last[m.id] < last[best.id]) best = m;
    }
    return best.id;
  }

  /* ---------- 4.3 前回値と直近3回 ---------- */
  // その種目ID自身の記録を新しい順に。before があれば、その日より前だけ
  function historyOf(days, exId, before, n) {
    const out = [];
    const dates = sortedDates(days).reverse();
    for (const d of dates) {
      if (before && d >= before) continue;
      const sets = [];
      days[d].ex.forEach(e => { if (e.id === exId) sets.push(...e.sets); });
      if (!sets.length) continue;
      out.push({ date: d, sets });
      if (n && out.length >= n) break;
    }
    return out;
  }
  function fmtSets(sets) {
    if (!sets.length) return '';
    return sets.every(s => s.w === sets[0].w)
      ? `${fmtKg(sets[0].w)}kg ${sets.map(s => s.r).join('/')}`
      : sets.map(s => `${fmtKg(s.w)}×${s.r}`).join(', ');
  }
  const fmtMD = k => { const [, m, d] = k.split('-').map(Number); return `${m}/${d}`; };
  const fmtHist = rec => `${fmtMD(rec.date)} ${fmtSets(rec.sets)}`;

  /* ---------- 4.2 重量提案（ダブルプログレッション） ---------- */
  function suggest(ex, lastRec) {
    if (!lastRec || !lastRec.sets.length) return { kind: 'first', text: '初回' };
    if (!(ex.inc > 0)) return { kind: 'reps', text: '回数を伸ばす' };
    const up = lastRec.sets.length >= ex.sets && lastRec.sets.every(s => s.r >= ex.range[1]);
    return up ? { kind: 'up', text: `増量: +${fmtKg(ex.inc)}kg` } : { kind: 'same', text: '同じ重量で回数を伸ばす' };
  }

  /* ---------- 3.2 セット追加の初期値 ---------- */
  function nextSet(sets, lastRec, ex) {
    const src = sets.length ? sets[sets.length - 1] : lastRec && lastRec.sets[0];
    return src ? { w: src.w, r: src.r, l: false } : { w: 0, r: ex.range[0], l: false };
  }

  /* ---------- 4.6 部位別の週セット数 ---------- */
  const zeros = () => Object.fromEntries(MUSCLES.map(m => [m, 0]));
  // 直近7日（今日を含む）の実績。totals: 部位→セット数、detail: 部位→[{ id, sets, coef }]
  function weeklyActual(days, exMap, today) {
    const from = addDays(today, -6);
    const totals = zeros(), detail = Object.fromEntries(MUSCLES.map(m => [m, []]));
    const add = (muscle, id, n, coef) => {
      totals[muscle] += n * coef;
      const row = detail[muscle].find(x => x.id === id && x.coef === coef);
      if (row) row.sets += n; else detail[muscle].push({ id, sets: n, coef });
    };
    sortedDates(days).forEach(d => {
      if (d < from || d > today) return;
      days[d].ex.forEach(e => {
        const x = exMap[e.id], n = e.sets.length;
        if (!x || !n) return;
        add(x.main, x.id, n, 1);
        x.aux.forEach(a => add(a, x.id, n, 0.5));
      });
    });
    return { totals, detail };
  }
  function targetMuscles(menus, exMap) {
    const out = new Set();
    menus.filter(m => !m.paused).forEach(m => m.ex.forEach(id => { if (exMap[id]) out.add(exMap[id].main); }));
    return out;
  }
  // 計画値: セット数 × 係数 の合計 ×（週N回 ÷ 休止していないメニュー数）
  function weeklyPlan(menus, exMap, freq) {
    const act = menus.filter(m => !m.paused);
    const out = zeros();
    if (!act.length) return out;
    act.forEach(m => m.ex.forEach(id => {
      const x = exMap[id];
      if (!x) return;
      out[x.main] += x.sets;
      x.aux.forEach(a => { out[a] += x.sets * 0.5; });
    }));
    const k = freq / act.length;
    MUSCLES.forEach(m => { out[m] *= k; });
    return out;
  }
  // 0: 実績なし、1: 最小有効量未満（4未満）、2: 中間、3: 目標到達
  function level(n, target) {
    if (n <= 0) return 0;
    if (n >= target) return 3;
    return n >= 4 ? 2 : 1;
  }
  const levelLabel = (n, target) => ['最小有効量未満', '最小有効量未満', '中間', '目標到達'][level(n, target)];

  /* ---------- 4.7 コピー ---------- */
  const copySets = sets => sets.map(s => ({ w: s.w, r: s.r, l: false }));
  const cloneDay = day => ({ ...day, ex: day.ex.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s })) })) });
  function copyDay(target, source) {
    const out = cloneDay(target);
    if (!target.ex.length && !target.menuId) out.menuId = source.menuId || null;
    source.ex.forEach(e => {
      if (!e.sets.length) return;
      const hit = out.ex.find(x => x.id === e.id);
      if (hit) hit.sets.push(...copySets(e.sets));
      else out.ex.push({ id: e.id, orig: e.orig || null, sets: copySets(e.sets) });
    });
    return out;
  }
  function copyExercise(target, index, sets) {
    const out = cloneDay(target);
    out.ex[index].sets.push(...copySets(sets));
    return out;
  }

  /* ---------- 4.8 インターバルの基準値 ---------- */
  const restFor = (ex, settings) => ex.rest || settings.rest[ex.cat];

  /* ---------- 集計の小物 ---------- */
  function dayTotals(day) {
    const done = day.ex.filter(e => e.sets.length);
    return {
      ex: done.length,
      sets: done.reduce((a, e) => a + e.sets.length, 0),
      reps: done.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.r, 0), 0),
    };
  }
  const doneDates = days => new Set(sortedDates(days).filter(d => days[d].ex.some(e => e.sets.length)));
  function usage(days) {
    const out = {};
    Object.values(days).forEach(day => new Set(day.ex.filter(e => e.sets.length).map(e => e.id)).forEach(id => { out[id] = (out[id] || 0) + 1; }));
    return out;
  }
  function lastDoneByMuscle(days, exMap) {
    const out = {};
    sortedDates(days).forEach(d => days[d].ex.forEach(e => { if (e.sets.length && exMap[e.id]) out[exMap[e.id].main] = d; }));
    return out;
  }
  const incPercent = (inc, w) => (w > 0 ? (inc / w) * 100 : null);
  const incOutOfRange = pct => pct != null && pct > 0 && (pct < 2 || pct > 10);
  // 前回の保存（なければ最初の記録日）から30日以上
  function backupDue(lastBackup, firstRecord, today) {
    const base = lastBackup || firstRecord;
    return !!base && diffDays(today, base) >= 30;
  }

  /* ---------- プリセット種目 ---------- */
  // プリセットの1行: [名前, 区分, 主働筋, 補助筋, レンジ下限, 上限, セット数, 増量幅, 代替の名前[]（任意）]
  function presetExercise(p) {
    return { name: p[0], cat: p[1], main: p[2], aux: p[3] ? [p[3]] : [], range: [p[4], p[5]], sets: p[6], inc: p[7], rest: null, memo: '', alts: [] };
  }
  // プリセットを種目にする。代替も一緒に種目にして、IDでつなぐ。同じ名前の種目があればそれを使う。
  // 返り値: { id, added: [新しく作った種目] }。exercises は書き換えない
  function materialize(name, presets, exercises, makeId) {
    const byName = {};
    Object.values(exercises).forEach(e => { byName[e.name] = e; });
    const added = [];
    const get = n => {
      if (byName[n]) return byName[n];
      const p = presets.find(x => x[0] === n);
      if (!p) return null;
      const e = { id: makeId(), ...presetExercise(p) };
      byName[n] = e; added.push(e);
      e.alts = (p[8] || []).map(get).filter(Boolean).map(a => a.id);
      return e;
    };
    const e = get(name);
    return { id: e ? e.id : null, added };
  }

  /* ---------- 4.9 バックアップ ---------- */
  function defaultSettings() {
    return {
      freq: 3, method: 1, lastBackup: null,
      rest: { 多: 150, 単: 105, カ腹: 75 },
      target: Object.fromEntries(MUSCLES.map(m => [m, 10])),
      hide: {},
    };
  }
  const fail = msg => { throw new Error(msg); };
  const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const num = (v, min) => typeof v === 'number' && isFinite(v) && v >= min;
  const int = (v, min) => num(v, min) && Number.isInteger(v);

  function cleanSettings(s) {
    const d = defaultSettings();
    if (!s || typeof s !== 'object') return d;
    if (int(s.freq, 1) && s.freq <= 7) d.freq = s.freq;
    if (s.method === 2) d.method = 2;
    if (isDate(s.lastBackup)) d.lastBackup = s.lastBackup;
    CATS.forEach(c => { if (s.rest && num(s.rest[c], 1)) d.rest[c] = s.rest[c]; });
    MUSCLES.forEach(m => {
      if (s.target && num(s.target[m], 1)) d.target[m] = s.target[m];
      if (s.hide && s.hide[m]) d.hide[m] = true;
    });
    return d;
  }
  // バックアップ（配列）→ アプリ内の形（種目と日はIDと日付で引ける形）。不正なら理由を付けて例外
  function fromBackup(b) {
    if (!b || typeof b !== 'object' || b.format !== FORMAT) fail('このファイルは筋トレアプリのバックアップではありません');
    if (b.version !== VERSION) fail(`バックアップの版（${b.version}）に対応していません`);
    const exercises = {};
    (Array.isArray(b.exercises) ? b.exercises : fail('種目の一覧がありません')).forEach(e => {
      if (!e || typeof e.id !== 'string' || !e.id) fail('IDのない種目があります');
      const tag = `種目「${e.name || e.id}」`;
      if (exercises[e.id]) fail(`${tag}のIDが重複しています（${e.id}）`);
      if (typeof e.name !== 'string' || !e.name.trim()) fail(`${tag}の名前がありません`);
      if (!CATS.includes(e.cat)) fail(`${tag}の区分が不正です`);
      if (!MUSCLES.includes(e.main)) fail(`${tag}の主働筋が不正です`);
      const aux = e.aux == null ? [] : Array.isArray(e.aux) ? e.aux : [e.aux];
      aux.forEach(a => { if (!MUSCLES.includes(a)) fail(`${tag}の補助筋が不正です`); });
      if (!Array.isArray(e.range) || !int(e.range[0], 1) || !int(e.range[1], e.range[0])) fail(`${tag}の目標レンジが不正です`);
      if (!int(e.sets, 1)) fail(`${tag}のセット数が不正です`);
      if (!num(e.inc, 0)) fail(`${tag}の増量幅が不正です`);
      exercises[e.id] = {
        id: e.id, name: e.name.trim(), cat: e.cat, main: e.main,
        aux: [...new Set(aux)].filter(a => a !== e.main),
        range: [e.range[0], e.range[1]], sets: e.sets, inc: e.inc,
        rest: num(e.rest, 1) ? e.rest : null,
        memo: typeof e.memo === 'string' ? e.memo : '',
        alts: Array.isArray(e.alts) ? [...new Set(e.alts)].filter(a => a !== e.id) : [],
      };
    });
    Object.values(exercises).forEach(e => e.alts.forEach(a => {
      if (!exercises[a]) fail(`種目「${e.name}」の代替が、存在しない種目（${a}）を指しています`);
    }));
    const seen = new Set();
    const menus = (b.menus || []).map(m => {
      if (!m || typeof m.id !== 'string' || !m.id || seen.has(m.id)) fail('IDのない、またはIDが重複したメニューがあります');
      seen.add(m.id);
      if (typeof m.name !== 'string' || !m.name.trim()) fail('名前のないメニューがあります');
      const ex = [...new Set(m.ex || [])];
      ex.forEach(id => { if (!exercises[id]) fail(`メニュー「${m.name}」が、存在しない種目（${id}）を指しています`); });
      return { id: m.id, name: m.name.trim(), paused: !!m.paused, ex };
    });
    const days = {};
    (b.days || []).forEach(d => {
      if (!d || !isDate(d.date)) fail('日付が不正な記録があります');
      const ex = (d.ex || []).map(e => {
        if (!e || !exercises[e.id]) fail(`${d.date} の記録が、存在しない種目（${e && e.id}）を指しています`);
        if (e.orig && !exercises[e.orig]) fail(`${d.date} の記録が、存在しない種目（${e.orig}）を指しています`);
        const sets = (e.sets || []).map(s => {
          if (!s || !num(s.w, 0) || !int(s.r, 0)) fail(`${d.date} の「${exercises[e.id].name}」に、不正なセットがあります`);
          return { w: s.w, r: s.r, l: !!s.l };
        });
        return { id: e.id, orig: e.orig || null, sets };
      });
      if (ex.length) days[d.date] = { date: d.date, menuId: typeof d.menuId === 'string' && d.menuId ? d.menuId : null, ex };
    });
    return { exercises, menus, days, settings: cleanSettings(b.settings) };
  }
  function parseBackup(text) {
    let b;
    try { b = JSON.parse(text); } catch (_) { fail('ファイルが読めません（JSONではありません）'); }
    return fromBackup(b);
  }
  function makeBackup(state, exportedAt) {
    const copy = v => JSON.parse(JSON.stringify(v));
    return {
      format: FORMAT, version: VERSION, exportedAt,
      settings: copy(state.settings),
      menus: copy(state.menus),
      exercises: copy(Object.values(state.exercises)),
      days: sortedDates(state.days).map(d => copy(state.days[d])),
    };
  }

  /* ---------- 4.9 CSV（1行が1セット。UTF-8、BOMなし） ---------- */
  const CSV_HEAD = ['日付', 'メニュー', '種目', '代替元の種目', '主働筋', 'セット', '重量kg', '回数', '限界到達', '推定1RM'];
  const csvCell = v => { const s = String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  // その日のメニュー名。始めたメニューがあればそれ、なければ実施判定に当てはまるメニュー
  function menuLabel(day, menus) {
    const own = menus.find(m => m.id === day.menuId);
    if (own) return own.name;
    const ids = performedMenus(day, menus);
    return menus.filter(m => ids.includes(m.id)).map(m => m.name).join('/');
  }
  function toCsv(state) {
    const rows = [CSV_HEAD];
    sortedDates(state.days).forEach(d => {
      const day = state.days[d], label = menuLabel(day, state.menus);
      day.ex.forEach(e => {
        const x = state.exercises[e.id], o = e.orig && state.exercises[e.orig];
        e.sets.forEach((s, k) => rows.push([
          d, label, x ? x.name : e.id, o ? o.name : '', x ? x.main : '', k + 1,
          fmtKg(s.w), s.r, s.l ? 1 : 0, rmShown(s) ? fmt1(e1rm(s.w, s.r)) : '',
        ]));
      });
    });
    return rows.map(r => r.map(csvCell).join(',')).join('\n');
  }

  const api = {
    MUSCLES, CATS,
    dateKey, parseKey, addDays, diffDays, fmtKg, fmt1, fmtMD,
    e1rm, rmShown,
    performedMenus, lastPerformed, recommend,
    historyOf, fmtSets, fmtHist, suggest, nextSet,
    weeklyActual, targetMuscles, weeklyPlan, level, levelLabel,
    copyDay, copyExercise, restFor,
    dayTotals, doneDates, usage, lastDoneByMuscle, incPercent, incOutOfRange, backupDue,
    presetExercise, materialize,
    defaultSettings, fromBackup, parseBackup, makeBackup, menuLabel, toCsv,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof self !== 'undefined' ? self : this);
