'use strict';
/* フェーズ0: 見た目の試作。データはすべてダミー。保存もしない（タイマーの終了時刻だけ localStorage）。 */

/* ========== ダミーデータ ========== */
const BUILD = 'p0-1011-h';
const MUSCLES = ['胸', '背中', '三角筋側部', '三角筋後部', '上腕二頭', '上腕三頭', '大腿四頭', 'ハムストリングス', 'ふくらはぎ', '腹筋'];
const CAT_REST = { 多: 150, 単: 105, カ腹: 75 };
const CAT_NAME = { 多: '多関節', 単: '単関節', カ腹: 'カーフ・腹筋' };

// [id, 名前, 区分, 主働筋, 補助筋, [下限,上限], セット数, 増量幅, 代替]
const EX_ROWS = [
  ['bench', 'ベンチプレス', '多', '胸', '上腕三頭', [8, 10], 3, 2.5, ['ダンベルベンチ', 'スミスマシン・ベンチ']],
  ['incline', 'インクラインベンチ', '多', '胸', '上腕三頭', [8, 10], 3, 2.5, ['インクラインダンベルプレス', 'マシンのインクラインプレス']],
  ['csrow', 'チェストサポートロウ', '多', '背中', '上腕二頭', [8, 10], 3, 2.5, ['傾斜ベンチにうつ伏せのダンベルロウ', '片手ダンベルロウ']],
  ['sider', 'サイドレイズ', '単', '三角筋側部', null, [12, 15], 3, 1, ['ケーブルサイドレイズ', 'マシンサイドレイズ']],
  ['pdown', 'プレスダウン', '単', '上腕三頭', null, [12, 15], 2, 2.5, ['オーバーヘッドのダンベルエクステンション', 'スカルクラッシャー']],
  ['dbcurl', 'インクラインダンベルカール', '単', '上腕二頭', null, [10, 12], 2, 1, ['ケーブルカール', '立位のダンベルカール']],
  ['hack', 'ハックスクワット', '多', '大腿四頭', null, [8, 10], 3, 5, ['レッグプレス', 'スミススクワット', 'ダンベルのブルガリアンスクワット']],
  ['legext', 'レッグエクステンション', '単', '大腿四頭', null, [12, 15], 2, 2.5, []],
  ['calf', 'カーフレイズ', 'カ腹', 'ふくらはぎ', null, [12, 15], 3, 2.5, ['段差での片足カーフレイズ', 'レッグプレスでのカーフレイズ']],
  ['abs', '腹筋（マシン）', 'カ腹', '腹筋', null, [15, 20], 3, 2.5, ['ケーブルクランチ', 'ハンギングレッグレイズ']],
  ['halfdl', 'ハーフデッドリフト', '多', '背中', 'ハムストリングス', [6, 8], 3, 5, ['ルーマニアンデッドリフト', 'ラックプル']],
  ['chin', '懸垂', '多', '背中', '上腕二頭', [8, 10], 3, 2.5, ['ラットプルダウン']],
  ['dbpress', 'インクラインダンベルプレス', '多', '胸', '上腕三頭', [8, 10], 3, 2.5, ['インクラインベンチ', 'マシンのインクラインプレス']],
  ['reard', 'リアデルト', '単', '三角筋後部', null, [12, 15], 3, 2.5, ['前傾のダンベルリアレイズ', 'ケーブルのフェイスプル']],
  ['legcurl', 'レッグカール', '単', 'ハムストリングス', null, [10, 12], 3, 2.5, ['ダンベルのルーマニアンデッドリフト', 'ノルディックカール']],
  ['ezcurl', 'EZバーカール', '単', '上腕二頭', null, [8, 10], 2, 2.5, ['ダンベルカール', 'ケーブルカール']],
];
const EX = {};
EX_ROWS.forEach(r => {
  EX[r[0]] = { id: r[0], name: r[1], cat: r[2], main: r[3], aux: r[4], range: r[5], sets: r[6], inc: r[7], alts: r[8], memo: r[0] === 'hack' ? 'シート位置 3、足は肩幅やや外' : '' };
});

// 種目ライブラリ: 使用回数（ダミー）。代替種目も、種目として登録する
const USE = { bench: 14, incline: 9, dbpress: 8, csrow: 10, halfdl: 6, chin: 7, sider: 12, reard: 8, pdown: 9, dbcurl: 6, ezcurl: 5, hack: 11, legext: 10, legcurl: 8, calf: 9, abs: 9 };
const DAYS_AGO = { 胸: 4, 背中: 4, 三角筋側部: 4, 三角筋後部: 11, 上腕二頭: 4, 上腕三頭: 4, 大腿四頭: 6, ハムストリングス: 6, ふくらはぎ: 6, 腹筋: 6 };
(function addAltsToLibrary() {
  Object.values(EX).slice().forEach(e => {
    e.alts.forEach((name, k) => {
      if (Object.values(EX).some(x => x.name === name)) return;
      const id = 'a_' + e.id + '_' + k;
      EX[id] = { id, name, cat: e.cat, main: e.main, aux: e.aux, range: e.range, sets: e.sets, inc: e.inc, alts: [], memo: '' };
      USE[id] = 1 + ((k + e.id.length) % 3);
    });
  });
})();

const S = {
  tab: 'home',
  day: null,
  cal: (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; })(),
  body: 'front',
  muscle: null,
  menuPick: 'lower',
  freq: 3,
  method: 1,
  rest: { ...CAT_REST },
  target: Object.fromEntries(MUSCLES.map(m => [m, 10])),
  hide: {},
  menus: [
    { id: 'upA', name: '上半身A', paused: false, ex: ['bench', 'incline', 'csrow', 'sider', 'pdown', 'dbcurl'] },
    { id: 'lower', name: '下半身', paused: false, ex: ['hack', 'legext', 'calf', 'abs'] },
    { id: 'upB', name: '上半身B', paused: false, ex: ['halfdl', 'chin', 'dbpress', 'reard', 'legcurl', 'ezcurl'] },
  ],
  openMenu: 'lower',
  pick: { also: false, mode: 'day' },
};

// 直近7日のダミー実績（種目ID → セット数）
const RECENT = { bench: 4, incline: 3, csrow: 3, sider: 3, pdown: 2, dbcurl: 2, dbpress: 3, halfdl: 3, chin: 3, hack: 3, legext: 2 };
const BASE_W = { bench: 70, incline: 60, csrow: 50, sider: 8, pdown: 30, dbcurl: 10, hack: 100, legext: 55, calf: 80, abs: 45, halfdl: 90, chin: 10, dbpress: 24, reard: 25, legcurl: 40, ezcurl: 25 };

/* ========== ユーティリティ ========== */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const today = new Date();
const todayKey = key(today);
const fmtKg = n => (Math.round(n * 10) / 10).toString();
const e1rm = (w, r) => w * (1 + 0.025 * r); // O'Connor式

const DONE_DAYS = new Set([-1, -3, -5, -8, -10, -12, -15, -17, -20, -24, -27, -31, -34].map(o => {
  const d = new Date(today); d.setDate(d.getDate() + o); return key(d);
}));

function histFor(id, n = 3) {
  const b = BASE_W[id] || 20, e = EX[id], hi = e.range[1];
  const mk = (off, w, reps, ws) => {
    const d = new Date(today); d.setDate(d.getDate() - off);
    return { d: `${d.getMonth() + 1}/${d.getDate()}`, date: d, w, reps, sets: reps.map((r, k) => ({ w: ws ? ws[k] : w, r, l: false })) };
  };
  const all = [
    mk(3, b, [hi, hi - 1, hi - 1].slice(0, e.sets)),
    mk(10, b - e.inc, [hi, hi, hi - 1].slice(0, e.sets)),
    mk(17, b - e.inc, [hi - 1, hi - 1, hi - 2].slice(0, e.sets)),
    mk(24, b - e.inc, [hi, hi - 1, hi - 2].slice(0, e.sets), [b - e.inc, b - e.inc, b - 2 * e.inc].slice(0, e.sets)),
    mk(31, b - 2 * e.inc, [hi, hi, hi].slice(0, e.sets)),
    mk(38, b - 2 * e.inc, [hi - 1, hi - 2, hi - 2].slice(0, e.sets)),
  ];
  return all.slice(0, n);
}
function fmtHist(h) {
  const same = h.reps;
  return `${h.d} ${fmtKg(h.w)}kg ${same.join('/')}`;
}

function plan() {
  const act = S.menus.filter(m => !m.paused);
  const out = Object.fromEntries(MUSCLES.map(m => [m, 0]));
  act.forEach(m => m.ex.forEach(id => {
    const e = EX[id];
    out[e.main] += e.sets;
    if (e.aux) out[e.aux] += e.sets * 0.5;
  }));
  const k = act.length ? S.freq / act.length : 0;
  MUSCLES.forEach(m => { out[m] *= k; });
  return out;
}
function targetMuscles() {
  const set = new Set();
  S.menus.filter(m => !m.paused).forEach(m => m.ex.forEach(id => set.add(EX[id].main)));
  return set;
}
function actual() {
  const out = Object.fromEntries(MUSCLES.map(m => [m, 0]));
  Object.entries(RECENT).forEach(([id, n]) => {
    const e = EX[id];
    out[e.main] += n;
    if (e.aux) out[e.aux] += n * 0.5;
  });
  return out;
}
function level(n, tgt) {
  if (n <= 0) return 0;
  if (n >= (tgt || 10)) return 3;
  if (n >= 4) return 2;
  return 1;
}
const LV_LABEL = ['実績なし', '最小有効量未満', '中間', '目標到達'];
function lvLabel(n, tgt) {
  if (n >= tgt) return '目標到達';
  if (n >= 4) return '中間';
  return '最小有効量未満';
}
const barLv = (n, tgt) => (n >= tgt ? 3 : n >= 4 ? 2 : n > 0 ? 1 : 0);

function recommended() { return S.menus.find(m => m.id === S.menuPick) || S.menus[0]; }

/* ========== 人体図（自作SVG・様式化） ========== */
// m:1 は左右反転コピーも描く。座標は 240x420、中心 x=120。
const HEAD = 'M120 6C133 6 139 18 138 32C137 44 130 52 120 52C110 52 103 44 102 32C101 18 107 6 120 6Z';
const ARM_UP = 'M52 122L70 120Q74 144 68 170L52 168Q46 144 52 122Z';
const FOREARM = 'M50 168L68 170Q70 200 62 228L48 226Q42 196 50 168Z';
const HAND = 'M48 228L62 230Q64 248 58 254Q48 254 46 244Z';
const DELT = 'M90 76Q66 72 54 90Q48 104 52 122L70 120Q74 100 88 92Z';
const KNEE = 'M90 316Q103 324 117 314L116 332L94 334Z';
const FOOT = 'M100 392L113 392L116 408L94 408Z';
const FIG = {
  front: {
    neutral: [
      { d: HEAD },
      { d: 'M107 50L106 66L120 74L120 50Z', m: 1 },
      { d: 'M106 66Q92 70 84 78L92 90L118 86L120 74Z', m: 1 },
      { d: FOREARM, m: 1 }, { d: HAND, m: 1 },
      { d: 'M82 120L104 134L104 206L90 202Q84 164 82 120Z', m: 1 },
      { d: 'M92 204L148 204L156 232Q140 250 120 252Q100 250 84 232Z' },
      { d: KNEE, m: 1 }, { d: FOOT, m: 1 },
    ],
    muscles: {
      胸: [{ d: 'M118 86L90 90Q80 94 80 108Q82 124 100 130Q112 132 118 128Z', m: 1 }],
      三角筋側部: [{ d: DELT, m: 1 }],
      上腕二頭: [{ d: ARM_UP, m: 1 }],
      腹筋: [{ d: 'M107 134h12v14h-12zM107 151h12v14h-12zM107 168h12v14h-12zM107 185h12v14h-12z', m: 1 }],
      大腿四頭: [{ d: 'M84 232L119 246L117 314Q103 324 90 316Q74 282 76 256Q78 240 84 232Z', m: 1 }],
      ふくらはぎ: [{ d: 'M94 334L116 332L113 392L100 392Q90 362 94 334Z', m: 1 }],
    },
    lines: [
      { d: 'M84 102Q96 114 118 114', m: 1 }, { d: 'M72 94Q64 106 62 120', m: 1 }, { d: 'M61 128Q64 146 60 166', m: 1 },
      { d: 'M101 254Q97 286 105 312', m: 1 }, { d: 'M88 264Q86 290 94 308', m: 1 }, { d: 'M104 342Q100 366 106 388', m: 1 },
    ],
  },
  back: {
    neutral: [
      { d: HEAD },
      { d: 'M107 50L106 62Q112 66 120 68L120 50Z', m: 1 },
      { d: FOREARM, m: 1 }, { d: HAND, m: 1 },
      { d: 'M120 196L96 198Q84 214 86 240Q104 254 120 248Z', m: 1 },
      { d: KNEE, m: 1 }, { d: FOOT, m: 1 },
    ],
    muscles: {
      背中: [
        { d: 'M120 58L106 62Q92 70 86 78L92 92Q108 100 120 126Z', m: 1 },
        { d: 'M92 92Q108 100 120 126L120 196L98 196Q82 160 80 124Q82 100 92 92Z', m: 1 },
      ],
      三角筋後部: [{ d: DELT, m: 1 }],
      上腕三頭: [{ d: ARM_UP, m: 1 }],
      ハムストリングス: [{ d: 'M86 244Q104 256 119 250L117 314Q103 324 90 316Q76 284 78 262Q80 250 86 244Z', m: 1 }],
      ふくらはぎ: [{ d: 'M95 332Q86 350 92 372Q96 384 101 392L112 392Q118 360 117 332Z', m: 1 }],
    },
    lines: [
      { d: 'M120 62L120 196' }, { d: 'M98 100Q104 114 114 122', m: 1 }, { d: 'M100 152Q108 170 118 178', m: 1 },
      { d: 'M62 132Q66 148 60 168', m: 1 }, { d: 'M72 94Q64 106 62 120', m: 1 },
      { d: 'M104 262Q102 290 106 312', m: 1 }, { d: 'M105 340Q101 366 106 390', m: 1 },
    ],
  },
};
const MIRROR = 'transform="translate(240 0) scale(-1 1)"';
function paths(list) {
  return list.map(p => `<path d="${p.d}"/>` + (p.m ? `<path d="${p.d}" ${MIRROR}/>` : '')).join('');
}
const GRAD = [['#47474e', '#2c2c31'], ['#2d5aa8', '#1a3566'], ['#58a0ff', '#2468e0'], ['#d2f3ff', '#7fd0f5'], ['#2f2f35', '#1d1d21']];
function figureSvg(side) {
  const f = FIG[side], act = actual();
  const defs = '<defs>' + GRAD.map((g, i) => `<linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset="1" stop-color="${g[1]}"/></linearGradient>`).join('') + '</defs>';
  const neutral = `<g class="neutral">${paths(f.neutral)}</g>`;
  const ms = Object.entries(f.muscles).map(([name, list]) => {
    const lv = level(act[name], S.target[name]);
    return `<g data-m="${name}" class="${S.muscle === name ? 'sel' : ''}" style="fill:url(#g${lv})">${paths(list)}</g>`;
  }).join('');
  const lines = `<g class="lines">${paths(f.lines)}</g>`;
  return `<svg viewBox="0 0 240 420" role="img" aria-label="${side === 'front' ? '前面' : '背面'}の人体図">${defs}${neutral}${ms}${lines}</svg>`;
}

/* ========== 画面 ========== */
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === S.tab && !(S.day && S.tab !== 'home')));
  const v = $('#view');
  const top = v.scrollTop;
  v.innerHTML = S.day ? viewDay() : { home: viewHome, body: viewBody, menu: viewMenu, settings: viewSettings }[S.tab]();
  if (S.keepScroll) v.scrollTop = top;
}

/* --- ホーム --- */
function viewHome() {
  const { y, m } = S.cal;
  const first = new Date(y, m, 1), startDow = first.getDay();
  const days = new Date(y, m + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < startDow; i++) {
    const d = new Date(y, m, 1 - (startDow - i));
    cells += cell(d, true);
  }
  for (let d = 1; d <= days; d++) cells += cell(new Date(y, m, d), false);
  const tail = (7 - ((startDow + days) % 7)) % 7;
  for (let i = 1; i <= tail; i++) cells += cell(new Date(y, m + 1, i), true);
  const rec = recommended();
  const others = S.menus.filter(x => !x.paused);
  return `
    <div class="banner">前回のバックアップから30日以上たっています。設定から保存してください。</div>
    <div class="cal-head">
      <button data-act="cal" data-d="-1" aria-label="前の月">‹</button>
      <div class="ttl">${y}年${m + 1}月</div>
      <button data-act="cal" data-d="1" aria-label="次の月">›</button>
    </div>
    <div class="cal-week">${WD.map(w => `<div>${w}</div>`).join('')}</div>
    <div class="cal-grid">${cells}</div>

    <div class="card" style="margin-top:14px">
      <div class="sub">今日のおすすめメニュー</div>
      ${rec ? `
      <div class="rec-name">${esc(rec.name)}</div>
      <div class="sub">${rec.ex.length}種目 ・ 最終実施 6日前</div>
      <div class="chips">${others.map(x => `<button class="chip ${x.id === rec.id ? 'on' : ''}" data-act="pick" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>
      <button class="btn primary block" data-act="today" style="min-height:56px;font-size:18px">このメニューで始める</button>` : `
      <div class="rec-name">メニューなし</div>
      <div class="sub" style="margin-bottom:12px">メニュータブで追加できます</div>`}
      <button class="btn block ghost" data-act="todayFree" style="margin-top:10px">メニューなしで始める</button>
    </div>
    <button class="btn block" data-act="rm">RM計算</button>`;
}
function cell(d, out) {
  const k = key(d);
  const cls = [out ? 'out' : '', DONE_DAYS.has(k) ? 'done' : '', k === todayKey ? 'today' : ''].join(' ');
  return `<button class="${cls}" data-act="day" data-d="${k}"><span class="d">${d.getDate()}</span></button>`;
}

/* --- 日別 --- */
let UID = 1;
function newDay(dateKey, menu) {
  const preset = {
    hack: [{ w: 100, r: 10, l: false }, { w: 100, r: 9, l: true }],
  };
  if (!menu) return { date: dateKey, menuId: null, menuName: 'メニューなし', ex: [] };
  const D = {
    date: dateKey,
    menuId: menu.id,
    menuName: menu.name,
    ex: menu.ex.map(id => ({ uid: UID++, id, alt: null, sets: (preset[id] || []).map(s => ({ ...s })) })),
  };
  return D;
}
function openFirstUnfinished() {
  const e = S.day.ex.find(x => x.sets.length < EX[x.id].sets) || S.day.ex[0];
  S.dayOpen = e ? e.uid : null;
}
function setsSummary(sets) {
  if (!sets.length) return '';
  const sameW = sets.every(s => s.w === sets[0].w);
  return sameW ? `${fmtKg(sets[0].w)}kg ${sets.map(s => s.r).join('/')}` : sets.map(s => `${fmtKg(s.w)}×${s.r}`).join(', ');
}
function viewDay() {
  const D = S.day;
  const [yy, mm, dd] = D.date.split('-').map(Number);
  const dt = new Date(yy, mm - 1, dd);
  const nEx = D.ex.filter(e => e.sets.length).length;
  const nSet = D.ex.reduce((a, e) => a + e.sets.length, 0);
  const nRep = D.ex.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.r, 0), 0);
  return `
    <div class="day-head">
      <button class="back" data-act="back" aria-label="戻る">‹</button>
      <div class="grow">
        <div class="row" style="gap:8px;align-items:baseline"><h1 style="margin:0;font-size:22px">${mm}月${dd}日（${WD[dt.getDay()]}）</h1><span class="sub">${esc(D.menuName)}</span></div>
        <div class="sumline num"><b>${nEx}</b>種目 <b>${nSet}</b>セット <b>${nRep}</b>レップ</div>
      </div>
    </div>
    ${D.ex.length ? '' : `<div class="card empty" style="padding:28px 16px">まだ種目がありません。<br>下の「＋ 種目を追加」から入れてください。</div>`}
    <div class="dlist" data-list="day">${D.ex.map((e, i) => exCard(e, i)).join('')}</div>
    <div class="row" style="gap:8px;margin-top:4px">
      <button class="btn primary grow" data-act="dayAdd">＋ 種目を追加</button>
      <button class="btn ghost" data-act="copyDay">過去の日をコピー</button>
    </div>
    ${D.ex.length ? `<div class="hint" style="margin:10px 0 0;text-align:center">種目名を長押しして、ドラッグで並べ替え</div>` : ''}`;
}
function exCard(e, i) {
  const base = EX[e.id];
  const rng = base.range[0] === base.range[1] ? base.range[0] : base.range.join('-');
  const open = S.dayOpen === e.uid;
  const name = e.alt ? `<span class="tag">代替</span>${esc(e.alt)}` : esc(base.name);
  const done = e.sets.length >= base.sets;
  const head = `
    <button class="exhead dgrip" data-act="exToggle" data-i="${i}" aria-expanded="${open}">
      <span class="en">${name}${e.alt ? `<span class="sub" style="font-weight:500"> ／ ${esc(base.name)}</span>` : ''}</span>
      <span class="ec ${done ? 'ok' : ''}">${e.sets.length}/${base.sets}</span>
      <span class="chev">${open ? '▴' : '▾'}</span>
      <span class="esum">${e.sets.length ? esc(setsSummary(e.sets)) : '未記録'} <span class="range">・ ${rng}×${base.sets}</span></span>
    </button>`;
  if (!open) return `<div class="ex c ditem" data-i="${i}">${head}</div>`;
  const h = histFor(e.id);
  const up = base.inc > 0 && i % 2 === 0;
  const sugg = base.inc === 0 ? '回数を伸ばす' : up ? `増量: +${fmtKg(base.inc)}kg` : '同じ重量で回数を伸ばす';
  return `
  <div class="ex c open ditem" data-i="${i}">
    ${head}
    <details class="hist">
      <summary><span class="sugg">${sugg}</span><span class="pv1"> ｜ 前回 ${fmtHist(h[0])}</span><span class="more">直近3回 ▾</span></summary>
      <div class="hist-list">${h.map(x => `<div>${fmtHist(x)}</div>`).join('')}</div>
    </details>
    ${base.memo ? `<details class="memo"><summary>固定メモ</summary><p>${esc(base.memo)}</p></details>` : ''}
    ${e.sets.length ? `<div class="set-h"><span class="a"></span><span class="b">kg</span><span class="c">回</span></div>` : ''}
    ${e.sets.map((s, j) => setRow(i, j, s, base)).join('')}
    <div class="row addrow"><button class="btn primary grow addset" data-act="addset" data-i="${i}">＋ セット追加</button><button class="btn ghost addset" data-act="timer" data-i="${i}">休息タイマー</button></div>
    <div class="ex-actions">
      ${base.alts.length ? `<button class="chip" data-act="alt" data-i="${i}">代替に変更</button>` : ''}
      <button class="chip" data-act="copyEx" data-i="${i}">過去の記録をコピー</button>
      <button class="chip dangerchip" data-act="dayDel" data-i="${i}">今日から外す</button>
    </div>
  </div>`;
}
function setRow(i, j, s, base) {
  const rm = s.r <= 10 && s.l ? `e1RM ${fmtKg(e1rm(s.w, s.r))}kg` : '';
  return `
  <div class="set">
    <div class="set-main">
      <span class="set-n">${j + 1}</span>
      <div class="stepper w">
        <button data-act="step" data-i="${i}" data-j="${j}" data-f="w" data-d="-${base.inc || 1}" aria-label="重量を減らす">−</button>
        <input class="num" inputmode="decimal" value="${fmtKg(s.w)}" data-act="inp" data-i="${i}" data-j="${j}" data-f="w" aria-label="重量kg">
        <button data-act="step" data-i="${i}" data-j="${j}" data-f="w" data-d="${base.inc || 1}" aria-label="重量を増やす">＋</button>
      </div>
      <div class="stepper r">
        <button data-act="step" data-i="${i}" data-j="${j}" data-f="r" data-d="-1" aria-label="回数を減らす">−</button>
        <input class="num" inputmode="numeric" value="${s.r}" data-act="inp" data-i="${i}" data-j="${j}" data-f="r" aria-label="回数">
        <button data-act="step" data-i="${i}" data-j="${j}" data-f="r" data-d="1" aria-label="回数を増やす">＋</button>
      </div>
      <button class="toggle lim ${s.l ? 'on' : ''}" data-act="limit" data-i="${i}" data-j="${j}" aria-pressed="${s.l}" aria-label="限界到達">限界</button>
      <button class="del" data-act="delset" data-i="${i}" data-j="${j}" aria-label="セットを削除">✕</button>
    </div>
    ${rm ? `<div class="rm">${rm}</div>` : ''}
  </div>`;
}

/* --- 部位 --- */
function viewBody() {
  const act = actual(), tg = targetMuscles();
  const sel = S.muscle;
  let detail = '';
  if (sel) {
    const rows = [];
    Object.entries(RECENT).forEach(([id, n]) => {
      const e = EX[id];
      if (e.main === sel) rows.push([e.name, n, '主働筋 ×1', n]);
      else if (e.aux === sel) rows.push([e.name, n, '補助筋 ×0.5', n * 0.5]);
    });
    detail = `<div class="card">
      <div class="row between"><div><h2 style="margin:0">${sel}</h2><div class="sub">内訳</div></div><span class="big num">${fmtKg(act[sel])}<span class="sub"> セット</span></span></div>
      ${rows.length ? rows.map(r => `<div class="setrow"><div><div style="font-weight:700">${esc(r[0])}</div><div class="sub">${r[1]}セット ・ ${r[2]}</div></div><b class="num">${fmtKg(r[3])}</b></div>`).join('') : '<div class="empty">直近7日の記録はありません</div>'}
    </div>`;
  } else {
    detail = '';
  }
  const visible = MUSCLES.filter(m => !S.hide[m]);
  const withTarget = visible.filter(m => tg.has(m));
  const noTarget = visible.filter(m => !tg.has(m) && act[m] > 0);
  const d0 = new Date(today); d0.setDate(d0.getDate() - 6);
  const range = `${d0.getMonth() + 1}/${d0.getDate()}〜${today.getMonth() + 1}/${today.getDate()}`;
  return `
    <div class="seg">
      <button class="${S.body === 'front' ? 'on' : ''}" data-act="side" data-s="front">前面</button>
      <button class="${S.body === 'back' ? 'on' : ''}" data-act="side" data-s="back">背面</button>
    </div>
    <div class="figure" id="fig">${figureSvg(S.body)}</div>
    <div class="legend">
      <span><i style="background:var(--lv0)"></i>0セット</span>
      <span><i style="background:var(--lv1)"></i>1〜3</span>
      <span><i style="background:var(--lv2)"></i>4〜9</span>
      <span><i style="background:var(--lv3)"></i>目標に到達</span>
    </div>
    <div style="height:14px"></div>
    ${detail}
    <div class="foot-hint" style="padding:0 8px 10px"><b>直近7日（${range}）</b>の部位別セット数。明るいほど多い。タップで内訳。</div>
    <div class="card">
      <h2>部位ごとのセット数</h2>
      <div class="sub" style="margin:-6px 0 6px">直近7日 / 週の目標（目安）</div>
      ${withTarget.map(m => mrow(m, act[m], S.target[m])).join('')}
      ${noTarget.length ? `<div class="sub" style="margin-top:8px">目標なし（メニューに種目がない部位）</div>` + noTarget.map(m => `<div class="setrow"><b>${m}</b><b class="num">${fmtKg(act[m])} <span class="sub">セット</span></b></div>`).join('') : ''}
      <div class="note" style="margin-top:10px">主働筋は1セット、補助筋は0.5セットで計算。</div>
    </div>`;
}
function mrow(m, n, tgt) {
  const lv = barLv(n, tgt);
  return `<div class="mrow">
    <div class="t"><b>${m}</b><span class="n">${fmtKg(n)} <i>/ ${tgt} セット</i></span></div>
    <div class="bar"><div class="lv${lv}" style="width:${Math.min(100, (n / tgt) * 100)}%"></div></div>
    <div class="lbl">${lvLabel(n, tgt)}</div>
  </div>`;
}

/* --- メニュー --- */
function planNote() {
  const n = S.menus.filter(m => !m.paused).length;
  if (!n) return '休止していないメニューがありません';
  const k = Math.round((S.freq / n) * 10) / 10;
  return `各メニューを週${k}回ずつやる場合（週${S.freq}回 ÷ ${n}メニュー）`;
}
function viewMenu() {
  const pl = plan(), tg = targetMuscles();
  return `
    <div class="dlist" data-list="menus">
    ${S.menus.map((m, mi) => `
      <div class="menu-card c ditem ${m.paused ? 'paused' : ''} ${S.openMenu === m.id ? 'open' : ''}" data-id="${m.id}">
        <div class="row between">
          <button class="grow dgrip mhead" data-act="openMenu" data-id="${m.id}">
            <span class="chev">${S.openMenu === m.id ? '▾' : '▸'}</span><span class="menu-name">${esc(m.name)}</span><span class="sub">${m.ex.length}種目${m.paused ? ' ・ 休止中' : ''}</span>
          </button>
          <span class="sub">休止</span>
          <button class="switch sm ${m.paused ? 'on' : ''}" data-act="pause" data-id="${m.id}" aria-label="休止"></button>
        </div>
        ${S.openMenu === m.id ? `
          <div class="dlist" data-list="menu:${m.id}">
          ${m.ex.map((id, k) => { const e = EX[id]; return `
            <div class="exrow c ditem" data-id="${id}">
              <button class="main dgrip" data-act="editEx" data-id="${id}">
                <span class="nm">${esc(e.name)}</span>
                <span class="meta">${e.range[0] === e.range[1] ? e.range[0] : e.range.join('-')}×${e.sets}</span>
              </button>
              <button class="mv dangertxt" data-act="menuDelEx" data-mi="${mi}" data-k="${k}" aria-label="メニューから外す">✕</button>
            </div>`; }).join('') || '<div class="empty" style="padding:10px 0">種目がありません</div>'}
          </div>
          <div class="row" style="padding:8px 0 2px;gap:8px">
            <button class="btn small ghost grow" data-act="menuAddEx" data-id="${m.id}">＋ 種目</button>
            <button class="btn small ghost" data-act="menuRename" data-id="${m.id}">名前変更</button>
            <button class="btn small ghost danger" data-act="menuDel" data-id="${m.id}">削除</button>
          </div>` : ''}
      </div>`).join('')}
    </div>
    <div class="foot-hint" style="padding:0 8px 10px">名前を長押ししてドラッグすると並べ替え</div>
    <button class="btn block ghost small" data-act="menuNew" style="margin-bottom:12px">＋ メニューを追加</button>
    <div class="card c">
      <h2 style="font-size:17px;margin-bottom:2px">週のセット数（予定）</h2>
      <div class="sub" style="margin-bottom:6px;font-size:12px">${planNote()}</div>
      ${MUSCLES.filter(m => tg.has(m) && !S.hide[m]).map(m => {
        const n = pl[m], t = S.target[m];
        return `<div class="prow"><span class="pn">${m}</span><span class="pbar"><i class="lv${barLv(n, t)}" style="width:${Math.min(100, n / t * 100)}%"></i></span><span class="pv num">${fmtKg(n)}<small>/${t}</small></span></div>`;
      }).join('')}
    </div>`;
}

/* --- 設定 --- */
function viewSettings() {
  return `
    <div class="card">
      <div class="setrow"><div>週の頻度</div>${stepper('freq', S.freq, '回')}</div>
      <div class="setrow"><div>おすすめの方式</div>
        <div class="seg" style="margin:0;width:190px">
          <button class="${S.method === 1 ? 'on' : ''}" data-act="method" data-v="1">方式1</button>
          <button class="${S.method === 2 ? 'on' : ''}" data-act="method" data-v="2">方式2</button>
        </div>
      </div>
      <div class="note" style="padding-bottom:6px">方式1: 最終実施が一番古いメニュー ／ 方式2: 最後に実施したメニューの次</div>
    </div>
    <div class="card">
      <h2>休息秒数の既定</h2>
      ${['多', '単', 'カ腹'].map(c => `<div class="setrow"><div>${CAT_NAME[c]}</div>${stepper('rest:' + c, S.rest[c], '秒', 15)}</div>`).join('')}
    </div>
    <div class="card">
      <h2>部位の目標セット数（週）</h2>
      ${MUSCLES.map(m => `<div class="setrow"><div class="grow">${m}</div>${stepper('tg:' + m, S.target[m], '', 1)}<button class="switch ${S.hide[m] ? '' : 'on'}" style="margin-left:10px" data-act="vis" data-m="${m}" aria-label="${m}を表示"></button></div>`).join('')}
      <div class="note">右のスイッチは部位の表示・非表示です。</div>
    </div>
    <div class="card">
      <h2>データ</h2>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <button class="btn grow" data-act="dummy">バックアップを保存</button>
        <button class="btn grow" data-act="dummy">復元</button>
        <button class="btn grow" data-act="dummy">CSV書き出し</button>
      </div>
    </div>
    <div class="card">
      <h2>メモ</h2>
      <div class="note">・推定1RMはO'Connor式（重量 × (1 + 0.025 × 回数)）です。他アプリ（Epley系など）と数値が違う場合があります。<br>
      ・タイマー画面の誤操作を防ぐには、iPhoneのガイドアクセス（設定→アクセシビリティ）を使ってください。ホームバー付近のスワイプは、ウェブ側では止められません。</div>
    </div>
    <div class="card">
      <h2>試作用</h2>
      <button class="btn block" data-act="timer10">タイマー画面を試す（10秒）</button>
    </div>
    <div class="foot-hint">版 ${BUILD}</div>`;
}
function stepper(k, v, unit, step = 1) {
  return `<div class="stepper"><button data-act="cfg" data-k="${k}" data-d="-${step}">−</button><span class="num" style="min-width:52px;text-align:center;font-weight:800;font-size:18px">${v}<small style="margin-left:2px">${unit}</small></span><button data-act="cfg" data-k="${k}" data-d="${step}">＋</button></div>`;
}

/* ========== シート ========== */
function sheet(html) {
  const r = $('#sheet-root');
  r.innerHTML = `<div class="back" data-act="close"></div><div class="sheet">${html}</div>`;
}
function closeSheet() { $('#sheet-root').innerHTML = ''; }

function rmSheet() {
  sheet(`<h2>RM計算</h2>
    <div class="field two row" style="gap:10px">
      <div class="grow"><label>重量 (kg)</label><input id="rm-w" class="num" inputmode="decimal" value="80"></div>
      <div class="grow"><label>回数</label><input id="rm-r" class="num" inputmode="numeric" value="8"></div>
    </div>
    <div class="result"><div class="sub">推定1RM（O'Connor式）</div><div class="big num" id="rm-out">96</div><div class="sub" id="rm-note"></div></div>
    <button class="btn block" data-act="close" style="margin-top:12px">閉じる</button>`);
  const calc = () => {
    const w = parseFloat($('#rm-w').value), r = parseInt($('#rm-r').value, 10);
    if (!(w > 0) || !(r > 0)) { $('#rm-out').textContent = '—'; $('#rm-note').textContent = ''; return; }
    $('#rm-out').innerHTML = `${fmtKg(e1rm(w, r))}<span class="sub"> kg</span>`;
    $('#rm-note').textContent = r >= 11 ? '参考値（精度低）' : '';
  };
  $('#rm-w').addEventListener('input', calc); $('#rm-r').addEventListener('input', calc); calc();
}
function editExSheet(id) {
  const e = EX[id], pct = e.inc && BASE_W[id] ? (e.inc / BASE_W[id]) * 100 : 0;
  const warn = pct && (pct < 2 || pct > 10) ? `<div class="note" style="color:#9cc4ff">増量幅が2〜10%の目安から外れています（表示のみ）</div>` : '';
  sheet(`<h2>${esc(e.name)}</h2>
    <div class="field"><label>名前</label><input value="${esc(e.name)}"></div>
    <div class="field two row" style="gap:10px">
      <div class="grow"><label>区分</label><input value="${CAT_NAME[e.cat]}"></div>
      <div class="grow"><label>セット数</label><input class="num" value="${e.sets}"></div>
    </div>
    <div class="field two row" style="gap:10px">
      <div class="grow"><label>主働筋</label><input value="${e.main}"></div>
      <div class="grow"><label>補助筋（任意）</label><input value="${e.aux || ''}"></div>
    </div>
    <div class="field two row" style="gap:10px">
      <div class="grow"><label>目標レンジ</label><input class="num" value="${e.range.join('-')}"></div>
      <div class="grow"><label>増量幅 kg${pct ? `（約${pct.toFixed(1)}%）` : ''}</label><input class="num" value="${e.inc}"></div>
    </div>
    ${warn}
    <div class="field"><label>休息秒数（空欄で区分の既定 ${S.rest[e.cat]}秒）</label><input class="num" placeholder="${S.rest[e.cat]}"></div>
    <div class="field"><label>固定メモ</label><input value="${esc(e.memo)}"></div>
    <div class="field"><label>代替種目</label><input value="${esc(e.alts.join('、') || 'なし')}"></div>
    <div class="note">試作のため、保存はしません。</div>
    <button class="btn primary block" data-act="close" style="margin-top:12px">閉じる</button>`);
}
function altSheet(i) {
  const e = S.day.ex[i], base = EX[e.id];
  sheet(`<h2>代替種目</h2>
    <div class="sub" style="margin-bottom:6px">記録は代替種目自身の履歴に残ります（重量は換算しません）</div>
    ${e.alt ? `<button class="pick" data-act="altPick" data-i="${i}" data-v="">元の種目に戻す（${esc(base.name)}）</button>` : ''}
    ${base.alts.map(a => `<button class="pick" data-act="altPick" data-i="${i}" data-v="${esc(a)}">${esc(a)}<span class="sub">選ぶ</span></button>`).join('')}`);
}
function copySheet(kind, i) {
  if (kind === 'ex') {
    const e = S.day.ex[i], base = EX[e.id];
    const recs = histFor(e.id, 6);
    sheet(`<h2>過去の記録をコピー</h2>
      <div class="sub" style="margin-bottom:2px">${esc(e.alt || base.name)}</div>
      <div class="sub" style="margin-bottom:6px">コピー元の日を選ぶと、そのセットが今日の末尾に入ります（回数は元の値のまま）</div>
      ${recs.map((r, k) => `<button class="pick cp" data-act="copyPickEx" data-i="${i}" data-k="${k}">
        <span class="cp-top"><b>${r.date.getMonth() + 1}月${r.date.getDate()}日（${WD[r.date.getDay()]}）</b><span class="sub">${r.sets.length}セット</span></span>
        <span class="cp-sets num">${r.sets.map(x => `<i>${fmtKg(x.w)}<small>kg</small> × ${x.r}</i>`).join('')}</span>
      </button>`).join('')}
      <button class="btn block ghost" data-act="close" style="margin-top:12px">やめる</button>`);
    return;
  }
  const items = [-2, -5, -9, -12].map(o => { const d = new Date(today); d.setDate(d.getDate() + o); return d; });
  sheet(`<h2>${kind === 'day' ? '過去の日をコピー（全種目）' : '過去の記録をコピー'}</h2>
    <div class="sub" style="margin-bottom:6px">選んだ日の全種目を、今日の記録にコピーします（回数は元の値のまま）</div>
    ${items.map(d => `<button class="pick" data-act="copyPick">${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）<span class="sub">${kind === 'day' ? '4種目' : '3セット'}</span></button>`).join('')}`);
}

/* ========== 休息タイマーの時間選択 ========== */
const W_MIN = 15, W_MAX = 600, W_STEP = 15, W_H = 44;
const PRESETS = [60, 90, 120, 150, 180];
const mmss = n => `${Math.floor(n / 60)}:${pad(n % 60)}`;
function timerSheet(def) {
  const vals = [];
  for (let v = W_MIN; v <= W_MAX; v += W_STEP) vals.push(v);
  S.timerPick = def;
  const presets = PRESETS.concat(PRESETS.includes(def) ? [] : [def]).sort((a, b) => a - b);
  sheet(`<h2>休息タイマー</h2>
    <div class="chips" id="presets" style="margin:0 0 6px">${presets.map(v => `<button class="chip" data-act="timerPreset" data-v="${v}">${mmss(v)}${v === def ? '<span class="sub" style="margin-left:4px;font-size:11px">既定</span>' : ''}</button>`).join('')}</div>
    <div class="wheelwrap"><div class="wheel" id="wheel">${vals.map(v => `<div data-act="wheelItem" data-v="${v}">${mmss(v)}</div>`).join('')}</div></div>
    <div class="note" style="text-align:center;margin:4px 0 10px">スクロールで時間を変えられます（15秒刻み）</div>
    <button class="btn primary block" data-act="timerGo" style="min-height:56px;font-size:18px">スタート</button>
    <button class="btn block ghost" data-act="close" style="margin-top:8px">やめる</button>`);
  const w = $('#wheel');
  w.scrollTop = ((def - W_MIN) / W_STEP) * W_H;
  wheelSync();
  w.addEventListener('scroll', wheelSync, { passive: true });
  clearInterval(S.wheelIv);
  S.wheelIv = setInterval(() => { if ($('#wheel')) wheelSync(); else clearInterval(S.wheelIv); }, 100);
}
function wheelSync() {
  const w = $('#wheel');
  if (!w) return;
  const max = (W_MAX - W_MIN) / W_STEP;
  const idx = Math.max(0, Math.min(max, Math.round(w.scrollTop / W_H)));
  const v = W_MIN + idx * W_STEP;
  S.timerPick = v;
  [...w.children].forEach((c, k) => c.classList.toggle('sel', k === idx));
  document.querySelectorAll('#presets .chip').forEach(c => c.classList.toggle('on', +c.dataset.v === v));
}
function wheelTo(v, smooth) {
  const w = $('#wheel');
  if (!w) return;
  w.scrollTo({ top: ((v - W_MIN) / W_STEP) * W_H, behavior: smooth ? 'smooth' : 'auto' });
  S.timerPick = v;
  [...w.children].forEach(c => c.classList.toggle('sel', +c.dataset.v === v));
  document.querySelectorAll('#presets .chip').forEach(c => c.classList.toggle('on', +c.dataset.v === v));
}

/* ========== 種目の追加・メニュー編集・確認 ========== */
function pickSheet(mode) {
  // mode: 'day' または 'menu:<メニューID>'
  const keepScroll = $('#sheet-root .sheet') ? $('#sheet-root .sheet').scrollTop : 0;
  const isDay = mode === 'day';
  const menu = isDay ? S.menus.find(m => m.id === S.day.menuId) : S.menus.find(m => 'menu:' + m.id === mode);
  const have = new Set(isDay ? S.day.ex.map(e => e.id) : menu.ex);
  const open = S.pick.open || (S.pick.open = {});
  const also = isDay && menu ? `<button class="toggle ${S.pick.also ? 'on' : ''}" style="width:100%;margin-bottom:6px" data-act="pickAlso">${S.pick.also ? '✓ ' : ''}「${esc(menu.name)}」メニューにも追加する</button>` : '';
  const groups = MUSCLES.map(m => ({
    m,
    list: Object.values(EX).filter(e => e.main === m).sort((x, y) => (USE[y.id] || 0) - (USE[x.id] || 0) || x.name.localeCompare(y.name, 'ja')),
  })).filter(g => g.list.length);
  sheet(`<h2 style="margin-bottom:4px">種目を追加</h2>
    <div class="sub" style="margin-bottom:8px">${isDay ? '今日の記録に入れます' : `「${esc(menu.name)}」に入れます`}。よくやる種目が上に出ます</div>
    ${also}
    ${groups.map(g => {
      const shown = open[g.m] ? g.list : g.list.slice(0, 3);
      return `<div class="pg">
        <div class="pgh"><b>${g.m}</b><span class="sub">${DAYS_AGO[g.m] != null ? DAYS_AGO[g.m] + '日前' : '記録なし'}</span></div>
        ${shown.map(e => { const dis = have.has(e.id); return `<button class="pick pk" ${dis ? 'disabled style="opacity:.4"' : `data-act="pickEx" data-id="${e.id}"`}><span>${esc(e.name)}</span><span class="sub">${dis ? '追加済み' : '＋'}</span></button>`; }).join('')}
        <div class="pgf">
          <button data-act="dummy" class="acc">種目を追加</button>
          ${g.list.length > 3 ? `<button data-act="pickMore" data-m="${g.m}">${open[g.m] ? '閉じる ▴' : 'すべて表示 (' + g.list.length + ') ▾'}</button>` : '<span></span>'}
        </div>
      </div>`;
    }).join('')}
    <button class="btn block" data-act="close" style="margin-top:14px">閉じる</button>`);
  S.pick.mode = mode;
  $('#sheet-root .sheet').scrollTop = keepScroll;
}
function textSheet(title, value, mode, id) {
  S.text = { mode, id };
  sheet(`<h2>${esc(title)}</h2>
    <div class="field"><label>メニュー名</label><input id="txt" value="${esc(value)}" maxlength="20"></div>
    <button class="btn primary block" data-act="saveText">保存</button>
    <button class="btn block ghost" data-act="close" style="margin-top:8px">キャンセル</button>`);
  setTimeout(() => { const t = $('#txt'); if (t) { t.focus(); t.select(); } }, 50);
}
function confirmSheet(msg, okLabel, fn) {
  S.confirmFn = fn;
  sheet(`<h2>確認</h2><div class="note" style="font-size:15px;color:var(--text);margin-bottom:14px">${msg}</div>
    <button class="btn block danger" data-act="doConfirm" style="background:var(--card2)">${esc(okLabel)}</button>
    <button class="btn block ghost" data-act="close" style="margin-top:8px">やめる</button>`);
}
function reorderTarget(name) {
  if (name === 'day') return S.day.ex;
  if (name === 'menus') return S.menus;
  if (name.startsWith('menu:')) return S.menus.find(m => m.id === name.slice(5)).ex;
  return null;
}

/* ========== 長押しドラッグで並べ替え ========== */
const DR = { timer: 0, on: false, item: null, list: null, items: [], rects: [], from: 0, to: 0, y0: 0, s0: 0, y: 0, gap: 0, auto: 0, moved: false, pending: null };
function dragBegin(target, y) {
  const grip = target.closest('.dgrip');
  if (!grip) return false;
  const item = grip.closest('.ditem');
  if (!item) return false;
  DR.pending = { item, y };
  DR.moved = false;
  clearTimeout(DR.timer);
  DR.timer = setTimeout(() => dragActivate(item, y), 420);
  return true;
}
function dragActivate(item, y) {
  const list = item.parentElement;
  DR.items = [...list.children].filter(c => c.classList.contains('ditem'));
  if (DR.items.length < 2) { DR.pending = null; return; }
  const v = $('#view');
  DR.on = true; DR.item = item; DR.list = list; DR.pending = null;
  DR.from = DR.to = DR.items.indexOf(item);
  DR.y0 = y; DR.y = y; DR.s0 = v.scrollTop;
  DR.rects = DR.items.map(el => { const r = el.getBoundingClientRect(); return { top: r.top + v.scrollTop, h: r.height }; });
  DR.gap = DR.items.length > 1 ? DR.rects[1].top - (DR.rects[0].top + DR.rects[0].h) : 0;
  item.classList.add('dragging');
  DR.items.forEach(el => { if (el !== item) el.style.transition = 'transform .15s'; });
  if (navigator.vibrate) try { navigator.vibrate(15); } catch (_) {}
  DR.auto = setInterval(() => {
    const vr = v.getBoundingClientRect();
    const edge = 90;
    if (DR.y < vr.top + edge) v.scrollTop -= 12;
    else if (DR.y > vr.bottom - edge) v.scrollTop += 12;
    dragUpdate();
  }, 16);
  dragUpdate();
}
function dragUpdate() {
  const v = $('#view');
  const dy = DR.y - DR.y0 + (v.scrollTop - DR.s0);
  DR.item.style.transform = `translateY(${dy}px)`;
  const me = DR.rects[DR.from];
  const center = me.top + me.h / 2 + dy;
  let to = 0;
  DR.rects.forEach((r, k) => { if (k !== DR.from && r.top + r.h / 2 < center) to++; });
  DR.to = to;
  const shift = me.h + DR.gap;
  DR.items.forEach((el, k) => {
    if (k === DR.from) return;
    let t = 0;
    if (DR.from < k && k <= to) t = -shift;
    else if (to <= k && k < DR.from) t = shift;
    el.style.transform = t ? `translateY(${t}px)` : '';
  });
}
function dragMove(y, ev) {
  if (DR.on) { DR.y = y; if (ev && ev.cancelable) ev.preventDefault(); dragUpdate(); return; }
  if (DR.pending && Math.abs(y - DR.pending.y) > 8) { clearTimeout(DR.timer); DR.pending = null; }
}
function dragEnd() {
  clearTimeout(DR.timer); DR.pending = null;
  if (!DR.on) return;
  clearInterval(DR.auto);
  DR.on = false;
  const arr = reorderTarget(DR.list.dataset.list);
  const from = DR.from, to = DR.to;
  DR.items.forEach(el => { el.style.transform = ''; el.style.transition = ''; el.classList.remove('dragging'); });
  DR.moved = true;
  setTimeout(() => { DR.moved = false; }, 350);
  if (arr && from !== to) arr.splice(to, 0, arr.splice(from, 1)[0]);
  S.keepScroll = true; render(); S.keepScroll = false;
}
document.addEventListener('touchstart', e => { if (e.touches.length === 1) dragBegin(e.target, e.touches[0].clientY); }, { passive: true });
document.addEventListener('touchmove', e => { dragMove(e.touches[0].clientY, e); }, { passive: false });
document.addEventListener('touchend', dragEnd);
document.addEventListener('touchcancel', dragEnd);
document.addEventListener('mousedown', e => { if (e.button === 0) dragBegin(e.target, e.clientY); });
document.addEventListener('mousemove', e => { if (DR.pending || DR.on) dragMove(e.clientY, e); });
document.addEventListener('mouseup', dragEnd);
// ドラッグ直後のクリックは無効にする（種目編集などが開かないように）
document.addEventListener('click', e => { if (DR.moved || DR.on) { e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener('contextmenu', e => { if (e.target.closest('.dgrip')) e.preventDefault(); });

/* ========== タイマー ========== */
const T = { end: 0, total: 0, iv: 0, done: false, wl: null, press: 0, ctx: null, beeped: false };
const RING_LEN = 2 * Math.PI * 130;

function startTimer(sec) {
  try {
    T.ctx = T.ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (T.ctx.state === 'suspended') T.ctx.resume();
  } catch (_) { /* 音が出なくても続ける */ }
  T.total = sec * 1000;
  T.end = Date.now() + T.total;
  try { localStorage.setItem('timerEnd', JSON.stringify({ end: T.end, total: T.total })); } catch (_) {}
  openTimer();
}
function openTimer() {
  T.done = false; T.beeped = false;
  const t = $('#timer');
  t.hidden = false; t.classList.remove('done', 'pressing');
  document.body.style.overflow = 'hidden';
  $('#ring-fg').style.strokeDasharray = RING_LEN;
  $('#ring-press').style.strokeDasharray = 2 * Math.PI * 112;
  $('#ring-press').style.strokeDashoffset = 2 * Math.PI * 112;
  tick();
  clearInterval(T.iv);
  T.iv = setInterval(tick, 200);
  getWakeLock();
}
function tick() {
  const left = Math.max(0, T.end - Date.now());
  const s = Math.ceil(left / 1000);
  $('#timer-num').textContent = `${Math.floor(s / 60)}:${pad(s % 60)}`;
  $('#ring-fg').style.strokeDashoffset = RING_LEN * (1 - left / T.total);
  if (left <= 0 && !T.done) {
    T.done = true;
    $('#timer').classList.add('done');
    $('#ring-fg').style.strokeDashoffset = 0;
    if (!T.beeped) { T.beeped = true; beep(); }
  }
}
function beep() {
  if (!T.ctx) return;
  try {
    [0, 0.35, 0.7].forEach(off => {
      const o = T.ctx.createOscillator(), g = T.ctx.createGain();
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, T.ctx.currentTime + off);
      g.gain.exponentialRampToValueAtTime(0.5, T.ctx.currentTime + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, T.ctx.currentTime + off + 0.25);
      o.connect(g); g.connect(T.ctx.destination);
      o.start(T.ctx.currentTime + off); o.stop(T.ctx.currentTime + off + 0.3);
    });
  } catch (_) {}
}
async function getWakeLock() {
  try { if ('wakeLock' in navigator) T.wl = await navigator.wakeLock.request('screen'); } catch (_) { /* 静かに続ける */ }
}
function closeTimer() {
  clearInterval(T.iv);
  $('#timer').hidden = true;
  document.body.style.overflow = '';
  try { localStorage.removeItem('timerEnd'); } catch (_) {}
  try { if (T.wl) { T.wl.release(); T.wl = null; } } catch (_) {}
}
(function bindTimer() {
  const t = $('#timer'), pr = $('#ring-press'), L = 2 * Math.PI * 112;
  const stop = e => { e.preventDefault(); };
  ['touchmove', 'gesturestart', 'gesturechange', 'dblclick', 'contextmenu', 'click', 'wheel'].forEach(ev =>
    t.addEventListener(ev, stop, { passive: false }));
  t.addEventListener('touchstart', stop, { passive: false });
  const down = e => {
    e.preventDefault();
    clearTimeout(T.press);
    t.classList.add('pressing');
    pr.style.transition = 'stroke-dashoffset 1.5s linear';
    pr.style.strokeDashoffset = 0;
    T.press = setTimeout(closeTimer, 1500);
  };
  const up = () => {
    clearTimeout(T.press);
    t.classList.remove('pressing');
    pr.style.transition = 'none';
    pr.style.strokeDashoffset = L;
  };
  t.addEventListener('pointerdown', down);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => t.addEventListener(ev, up));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !t.hidden) { tick(); getWakeLock(); }
  });
})();

/* ========== イベント ========== */
function addSetTo(i, timer = true) {
  const e = S.day.ex[i], base = EX[e.id];
  const last = e.sets[e.sets.length - 1];
  const h = histFor(e.id)[0];
  const s = last ? { w: last.w, r: last.r, l: false } : { w: h.w, r: h.reps[0], l: false };
  e.sets.push(s);
  S.keepScroll = true; render(); S.keepScroll = false;
  if (timer) startTimer(S.rest[base.cat]);
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  const a = el.dataset.act, i = +el.dataset.i, j = +el.dataset.j;
  S.keepScroll = true;
  switch (a) {
    case 'tab': S.tab = el.dataset.t; S.day = null; S.keepScroll = false; render(); $('#view').scrollTop = 0; return;
    case 'cal': S.cal.m += +el.dataset.d; if (S.cal.m < 0) { S.cal.m = 11; S.cal.y--; } if (S.cal.m > 11) { S.cal.m = 0; S.cal.y++; } break;
    case 'pick': S.menuPick = el.dataset.id; break;
    case 'todayFree': S.day = newDay(todayKey, null); S.dayOpen = null; S.keepScroll = false; render(); $('#view').scrollTop = 0; return;
    case 'today': S.day = newDay(todayKey, recommended()); openFirstUnfinished(); S.keepScroll = false; render(); $('#view').scrollTop = 0; return;
    case 'day': S.day = newDay(el.dataset.d, DONE_DAYS.has(el.dataset.d) || el.dataset.d === todayKey ? recommended() : null); openFirstUnfinished(); S.keepScroll = false; render(); $('#view').scrollTop = 0; return;
    case 'back': S.day = null; break;
    case 'rm': rmSheet(); return;
    case 'close': closeSheet(); return;
    case 'addset': closeSheet(); addSetTo(i, false); S.keepScroll = false; return;
    case 'timer': timerSheet(S.rest[EX[S.day.ex[i].id].cat]); return;
    case 'timerGo': { wheelSync(); const v = S.timerPick; clearInterval(S.wheelIv); closeSheet(); startTimer(v); return; }
    case 'timerPreset': wheelTo(+el.dataset.v, true); return;
    case 'wheelItem': wheelTo(+el.dataset.v, true); return;
    case 'exToggle': { const u = S.day.ex[i].uid; S.dayOpen = S.dayOpen === u ? null : u; break; }
    case 'step': {
      const s = S.day.ex[i].sets[j], f = el.dataset.f, d = parseFloat(el.dataset.d);
      s[f] = Math.max(0, Math.round((s[f] + d) * 100) / 100);
      break;
    }
    case 'limit': { const s = S.day.ex[i].sets[j]; s.l = !s.l; break; }
    case 'delset': S.day.ex[i].sets.splice(j, 1); break;
    case 'mv': {
      const k = i + +el.dataset.d, arr = S.day.ex;
      if (k >= 0 && k < arr.length) [arr[i], arr[k]] = [arr[k], arr[i]];
      break;
    }
    case 'alt': altSheet(i); return;
    case 'altPick': S.day.ex[i].alt = el.dataset.v || null; closeSheet(); break;
    case 'copyDay': copySheet('day'); return;
    case 'copyEx': copySheet('ex', i); return;
    case 'copyPickEx': {
      const e = S.day.ex[i], r = histFor(e.id, 6)[+el.dataset.k];
      r.sets.forEach(x => e.sets.push({ w: x.w, r: x.r, l: false }));
      closeSheet(); break;
    }
    case 'copyPick': closeSheet(); sheet(`<h2>コピーしました</h2><div class="note">試作のため、実際のコピーは行いません。</div><button class="btn block" data-act="close" style="margin-top:12px">閉じる</button>`); return;
    case 'side': S.body = el.dataset.s; break;
    case 'openMenu': S.openMenu = S.openMenu === el.dataset.id ? null : el.dataset.id; break;
    case 'pause': { const m = S.menus.find(x => x.id === el.dataset.id); m.paused = !m.paused; break; }
    case 'mmv': {
      const m = S.menus[+el.dataset.mi], k = +el.dataset.k, t = k + +el.dataset.d;
      if (t >= 0 && t < m.ex.length) [m.ex[k], m.ex[t]] = [m.ex[t], m.ex[k]];
      break;
    }
    case 'editEx': editExSheet(el.dataset.id); return;
    case 'dayAdd': S.pick = { also: false, mode: 'day' }; pickSheet('day'); return;
    case 'pickMore': S.pick.open = S.pick.open || {}; S.pick.open[el.dataset.m] = !S.pick.open[el.dataset.m]; pickSheet(S.pick.mode); return;
    case 'pickAlso': S.pick.also = !S.pick.also; pickSheet(S.pick.mode); return;
    case 'pickEx': {
      const id = el.dataset.id, mode = S.pick.mode;
      if (mode === 'day') {
        const ne = { uid: UID++, id, alt: null, sets: [] }; S.day.ex.push(ne); S.dayOpen = ne.uid;
        const menu = S.menus.find(m => m.id === S.day.menuId);
        if (S.pick.also && menu && !menu.ex.includes(id)) menu.ex.push(id);
      } else {
        S.menus.find(m => 'menu:' + m.id === mode).ex.push(id);
      }
      render(); pickSheet(mode); return;
    }
    case 'dayDel': {
      const e = S.day.ex[i];
      const go = () => { S.day.ex.splice(i, 1); closeSheet(); S.keepScroll = true; render(); S.keepScroll = false; };
      if (e.sets.length) confirmSheet('「' + esc(e.alt || EX[e.id].name) + '」の' + e.sets.length + 'セットの記録も、今日の記録から消えます。', '外す', go);
      else go();
      return;
    }
    case 'doConfirm': { const f = S.confirmFn; S.confirmFn = null; if (f) f(); return; }
    case 'menuAddEx': S.pick = { also: false, mode: 'menu:' + el.dataset.id }; pickSheet(S.pick.mode); return;
    case 'menuDelEx': S.menus[+el.dataset.mi].ex.splice(+el.dataset.k, 1); break;
    case 'menuNew': textSheet('メニューを追加', '', 'new'); return;
    case 'menuRename': textSheet('名前を変更', S.menus.find(x => x.id === el.dataset.id).name, 'rename', el.dataset.id); return;
    case 'saveText': {
      const v = $('#txt').value.trim();
      if (!v) return;
      if (S.text.mode === 'new') { const id = 'm' + Date.now(); S.menus.push({ id, name: v, paused: false, ex: [] }); S.openMenu = id; }
      else S.menus.find(x => x.id === S.text.id).name = v;
      closeSheet(); break;
    }
    case 'menuDel': {
      const m = S.menus.find(x => x.id === el.dataset.id);
      confirmSheet('メニュー「' + esc(m.name) + '」を削除します。過去の記録は消えません。', '削除する', () => {
        S.menus = S.menus.filter(x => x !== m);
        if (S.openMenu === m.id) S.openMenu = null;
        closeSheet(); S.keepScroll = true; render(); S.keepScroll = false;
      });
      return;
    }
    case 'dummy': sheet(`<h2>試作</h2><div class="note">この操作はフェーズ1で実装します。</div><button class="btn block" data-act="close" style="margin-top:12px">閉じる</button>`); return;
    case 'method': S.method = +el.dataset.v; break;
    case 'vis': S.hide[el.dataset.m] = !S.hide[el.dataset.m]; break;
    case 'cfg': {
      const k = el.dataset.k, d = +el.dataset.d;
      if (k === 'freq') S.freq = Math.min(7, Math.max(1, S.freq + d));
      else if (k.startsWith('rest:')) { const c = k.slice(5); S.rest[c] = Math.max(15, S.rest[c] + d); }
      else if (k.startsWith('tg:')) { const m = k.slice(3); S.target[m] = Math.max(1, S.target[m] + d); }
      break;
    }
    case 'timer10': startTimer(10); return;
    default: return;
  }
  render(); S.keepScroll = false;
});

document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset.act !== 'inp') return;
  const s = S.day.ex[+el.dataset.i].sets[+el.dataset.j], f = el.dataset.f;
  const v = parseFloat(el.value.replace(',', '.'));
  if (v >= 0) s[f] = f === 'r' ? Math.round(v) : v;
  S.keepScroll = true; render(); S.keepScroll = false;
});

document.addEventListener('click', ev => {
  const g = ev.target.closest('#fig g[data-m]');
  if (!g) return;
  S.muscle = S.muscle === g.dataset.m ? null : g.dataset.m;
  S.keepScroll = true; render(); S.keepScroll = false;
});

/* ========== 起動 ========== */
render();
try {
  const saved = JSON.parse(localStorage.getItem('timerEnd') || 'null');
  if (saved && saved.end) { T.end = saved.end; T.total = saved.total; openTimer(); }
} catch (_) {}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
