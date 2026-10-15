'use strict';
/* 画面と操作。ロジックは logic.js（純関数）、保存は db.js、人体図は figure.js、並べ替えは drag.js、タイマーは timer.js。 */

const BUILD = 'p2-1015-a'; // 更新のたびに上げる。sw.js の CACHE と同じ値にする（テストで照合）
const L = Logic;
const MUSCLES = L.MUSCLES;
const CATS = L.CATS;
const CAT_NAME = { 多: '多関節', 単: '単関節', カ腹: 'カーフ・腹筋' };

/* ========== データ（起動時に IndexedDB から読む） ========== */
let EX = {};   // 種目ID → 種目
let DAYS = {}; // 日付 → 日の記録

const S = {
  ready: false,
  tab: 'home',
  day: null,      // 開いている日（保存前の作業用。種目ごとに画面用の uid を持つ）
  dayOpen: null,
  cal: (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; })(),
  muscle: null,
  menuPick: null, // ホームで選んだメニュー。null ならおすすめ
  menus: [],
  cfg: L.defaultSettings(),
  openMenu: null,
  pick: { also: false, mode: 'day' },
  persisted: null,
  storeError: false,
  updated: false,
};

/* ========== ユーティリティ ========== */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(2, '0');
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const todayKey = () => L.dateKey(new Date());
const fmtKg = L.fmtKg;
let idSeq = 0;
const newId = p => p + Date.now().toString(36) + (idSeq++).toString(36) + Math.random().toString(36).slice(2, 5);
const rangeText = e => (e.range[0] === e.range[1] ? String(e.range[0]) : e.range.join('-'));
const dateJa = k => { const d = L.parseKey(k); return `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`; };
const actual = () => L.weeklyActual(DAYS, EX, todayKey()).totals;

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('on'), 2600);
}

/* ========== 保存 ========== */
function saveFail(e) {
  console.error(e);
  toast('保存できませんでした');
}
function save(fn) {
  try { Promise.resolve(fn()).catch(saveFail); } catch (e) { saveFail(e); }
}
const saveEx = e => save(() => Store.putExercise(e));
const saveMenus = () => save(() => Store.putMenus(S.menus));
const saveCfg = () => save(() => Store.putSettings(S.cfg));
// 開いている日を保存する。種目が1つもなくなった日は消す
function saveDay() {
  const D = S.day;
  if (!D) return;
  const clean = { date: D.date, menuId: D.menuId, ex: D.ex.map(e => ({ id: e.id, orig: e.orig, sets: e.sets.map(s => ({ w: s.w, r: s.r, l: s.l })) })) };
  if (clean.ex.length) { DAYS[D.date] = clean; save(() => Store.putDay(clean)); }
  else if (DAYS[D.date]) { delete DAYS[D.date]; save(() => Store.delDay(D.date)); }
}

/* ========== 画面 ========== */
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === S.tab && !(S.day && S.tab !== 'home')));
  const v = $('#view');
  const top = v.scrollTop;
  v.innerHTML = !S.ready ? '' : S.day ? viewDay() : { home: viewHome, body: viewBody, menu: viewMenu, settings: viewSettings }[S.tab]();
  if (S.keepScroll) v.scrollTop = top;
}
function rerender() { S.keepScroll = true; render(); S.keepScroll = false; }

/* --- ホーム --- */
function pickedMenu() {
  const ok = S.menus.filter(m => !m.paused && m.ex.length);
  return ok.find(m => m.id === S.menuPick) || ok.find(m => m.id === L.recommend(S.menus, DAYS, S.cfg.method)) || null;
}
function viewHome() {
  const { y, m } = S.cal, today = todayKey();
  const done = L.doneDates(DAYS);
  const cell = (d, out) => {
    const k = L.dateKey(d);
    const cls = [out ? 'out' : '', done.has(k) ? 'done' : '', k === today ? 'today' : ''].join(' ');
    return `<button class="${cls}" data-act="day" data-d="${k}"><span class="d">${d.getDate()}</span></button>`;
  };
  const startDow = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += cell(new Date(y, m, 1 - (startDow - i)), true);
  for (let d = 1; d <= days; d++) cells += cell(new Date(y, m, d), false);
  const tail = (7 - ((startDow + days) % 7)) % 7;
  for (let i = 1; i <= tail; i++) cells += cell(new Date(y, m + 1, i), true);

  const due = L.backupDue(S.cfg.lastBackup, [...done][0] || null, today);
  const T = DAYS[today];
  let card;
  if (T) {
    const t = L.dayTotals(T);
    card = `
      <div class="sub">今日の記録</div>
      <div class="rec-name">${esc(L.menuLabel(T, S.menus) || 'メニューなし')}</div>
      <div class="sub" style="margin-bottom:12px">${T.ex.length}種目 ・ ${t.sets}セット記録済み</div>
      <button class="btn primary block" data-act="todayOpen" style="min-height:56px;font-size:18px">今日の記録を開く</button>`;
  } else if (!S.menus.length && !Object.keys(DAYS).length) {
    card = `
      <div class="rec-name" style="font-size:22px">はじめに、メニューを作ります</div>
      <div class="sub" style="margin-bottom:12px">名前（例: 上半身A）を付けて、種目を選ぶだけです。前に使っていてバックアップがある人は、復元を選びます。</div>
      <button class="btn primary block" data-act="startMenu" style="min-height:56px;font-size:18px">新しいメニューを作る</button>
      <button class="btn block ghost" data-act="restore" style="margin-top:10px">バックアップから復元</button>
      <button class="btn block ghost" data-act="todayFree" style="margin-top:10px">メニューなしで始める</button>`;
  } else {
    const rec = pickedMenu();
    const recId = L.recommend(S.menus, DAYS, S.cfg.method);
    const last = rec && L.lastPerformed(DAYS, S.menus)[rec.id];
    const ago = last ? L.diffDays(today, last) : null;
    const chips = S.menus.filter(x => !x.paused && x.ex.length);
    card = `
      <div class="sub">${rec && rec.id !== recId ? '選んだメニュー' : '今日のおすすめメニュー'}</div>
      ${rec ? `
      <div class="rec-name">${esc(rec.name)}</div>
      <div class="sub">${rec.ex.length}種目 ・ ${last ? `最終実施 ${ago}日前` : 'まだ実施なし'}</div>
      <div class="chips">${chips.map(x => `<button class="chip ${x.id === rec.id ? 'on' : ''}" data-act="pick" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>
      <button class="btn primary block" data-act="today" style="min-height:56px;font-size:18px">このメニューで始める</button>` : `
      <div class="rec-name" style="font-size:22px">すすめられるメニューがありません</div>
      <div class="sub" style="margin-bottom:12px">メニュータブで、種目の追加か休止の解除をしてください</div>`}
      <button class="btn block ghost" data-act="todayFree" style="margin-top:10px">メニューなしで始める</button>`;
  }
  return `
    ${S.storeError ? '<div class="banner">この画面では記録を保存できません（プライベートブラウズでは保存できません）。</div>' : ''}
    ${due ? '<div class="banner">バックアップを30日以上保存していません。設定から保存してください。</div>' : ''}
    <div id="cal">
    <div class="cal-head">
      <button data-act="cal" data-d="-1" aria-label="前の月">‹</button>
      <div class="ttl">${y}年${m + 1}月</div>
      <button data-act="cal" data-d="1" aria-label="次の月">›</button>
    </div>
    <div class="cal-week">${WD.map(w => `<div>${w}</div>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    </div>
    <div class="card" style="margin-top:14px">${card}</div>
    <button class="btn block" data-act="rm">RM計算</button>`;
}

/* --- 日別 --- */
let UID = 1;
const menuEntries = menu => menu.ex.filter(id => EX[id]).map(id => ({ uid: UID++, id, orig: null, sets: [] }));
// 保存済みの日があればそれを開く。なければ、メニュー（任意）から新しい日を作る（操作するまで保存しない）
function openDay(date, menu) {
  S.swipeUid = null;
  const saved = DAYS[date];
  S.day = saved
    ? { date, menuId: saved.menuId, ex: saved.ex.filter(e => EX[e.id]).map(e => ({ uid: UID++, id: e.id, orig: e.orig, sets: e.sets.map(s => ({ ...s })) })) }
    : { date, menuId: menu ? menu.id : null, ex: menu ? menuEntries(menu) : [] };
  openFirstUnfinished();
  S.keepScroll = false; render(); $('#view').scrollTop = 0;
}
function openFirstUnfinished() {
  if (S.day.date !== todayKey()) { S.dayOpen = null; return; }   // 過去の日は全種目を閉じて開く
  const e = S.day.ex.find(x => x.sets.length < EX[x.id].sets) || S.day.ex[0];
  S.dayOpen = e ? e.uid : null;
}
function viewDay() {
  const D = S.day, t = L.dayTotals(D);
  const menus = S.menus.filter(m => m.ex.length);
  return `
    <div class="day-head">
      <button class="back" data-act="back" aria-label="戻る">‹</button>
      <div class="grow">
        <div class="row" style="gap:8px;align-items:baseline"><h1 style="margin:0;font-size:22px">${dateJa(D.date)}</h1><span class="sub">${esc(L.menuLabel(D, S.menus) || 'メニューなし')}</span></div>
        <div class="sumline num"><b>${t.ex}</b>種目 <b>${t.sets}</b>セット <b>${t.reps}</b>レップ</div>
      </div>
    </div>
    ${D.ex.length ? '' : `<div class="card empty" style="padding:22px 16px">まだ種目がありません。<br>${menus.length ? 'メニューを選ぶか、' : ''}下の「＋ 種目を追加」から入れてください。
      ${menus.length ? `<div class="chips" style="justify-content:center;margin:14px 0 0">${menus.map(m => `<button class="chip" data-act="dayMenu" data-id="${m.id}">${esc(m.name)}</button>`).join('')}</div>` : ''}</div>`}
    <div class="dlist" data-list="day">${D.ex.map((e, i) => exCard(e, i)).join('')}</div>
    <div class="row" style="gap:8px;margin-top:4px">
      <button class="btn primary grow" data-act="dayAdd">＋ 種目を追加</button>
      <button class="btn ghost" data-act="copyDay">過去の日をコピー</button>
    </div>
    ${D.date !== todayKey() && t.sets ? `<button class="btn block ghost" data-act="copyToToday" style="margin-top:8px">この日の内容を今日にコピー</button>` : ''}
    ${D.ex.length ? `<div class="hint" style="margin:10px 0 0;text-align:center">種目名を長押しして、ドラッグで並べ替え</div>` : ''}`;
}
function exCard(e, i) {
  const x = EX[e.id], slot = e.orig ? EX[e.orig] : x;
  const open = S.dayOpen === e.uid;
  const done = e.sets.length >= x.sets;
  const head = `
    <button class="exhead dgrip" data-act="exToggle" data-i="${i}" aria-expanded="${open}">
      <span class="en">${e.orig ? '<span class="tag">代替</span>' : ''}${esc(x.name)}${e.orig ? `<span class="sub" style="font-weight:500"> ／ ${esc(slot.name)}</span>` : ''}</span>
      <span class="ec ${done ? 'ok' : ''}">${e.sets.length}/${x.sets}</span>
      <span class="chev">${open ? '▴' : '▾'}</span>
      <span class="esum">${e.sets.length ? esc(L.fmtSets(e.sets)) : '未記録'} <span class="range">・ ${rangeText(x)}×${x.sets}</span></span>
    </button>`;
  const sw = S.swipeUid === e.uid ? ' swiped' : '';
  const del = `<button class="swipe-del" data-act="dayDel" data-i="${i}" aria-label="この種目を外す">外す</button>`;
  if (!open) return `<div class="ex c ditem${sw}" data-i="${i}">${head}${del}</div>`;
  const h = L.historyOf(DAYS, e.id, S.day.date, 3);
  const sugg = L.suggest(x, h[0]);
  return `
  <div class="ex c open ditem${sw}" data-i="${i}">
    ${head}${del}
    <details class="hist">
      <summary><span class="sugg">${sugg.text}</span>${h.length ? `<span class="pv1"> ｜ 前回 ${esc(L.fmtHist(h[0]))}</span><span class="more" aria-label="直近3回を開く">▾</span>` : ''}</summary>
      ${h.length ? `<div class="hist-list">${h.map(r => `<div>${esc(L.fmtHist(r))}</div>`).join('')}</div>` : ''}
    </details>
    <button class="exset" data-act="editEx" data-id="${x.id}"><span class="m ${x.memo ? 'has' : ''}">${x.memo ? 'メモ: ' + esc(x.memo) : '固定メモなし'}</span><span class="g">種目の設定 ›</span></button>
    ${e.sets.length ? `<div class="set-h"><span class="a"></span><span class="b">kg</span><span class="c">回</span></div>` : ''}
    ${e.sets.map((s, j) => setRow(i, j, s, x)).join('')}
    <div class="row addrow"><button class="btn primary grow addset" data-act="addset" data-i="${i}">＋ セット追加</button><button class="btn ghost addset" data-act="timer" data-i="${i}">インターバル</button></div>
    <div class="ex-actions">
      ${slot.alts.length ? `<button class="chip" data-act="alt" data-i="${i}">代替に変更</button>` : ''}
      <button class="chip" data-act="copyEx" data-i="${i}">過去の記録をコピー</button>
      <button class="chip dangerchip" data-act="dayDel" data-i="${i}">${S.day.date === todayKey() ? '今日' : 'この日'}から外す</button>
    </div>
  </div>`;
}
function setRow(i, j, s, x) {
  const rm = L.rmShown(s) ? `e1RM ${L.fmt1(L.e1rm(s.w, s.r))}kg` : '';
  const at = `data-i="${i}" data-j="${j}"`;
  return `
  <div class="set">
    <div class="set-main">
      <span class="set-n">${j + 1}</span>
      <div class="stepper w">
        <button data-act="step" ${at} data-f="w" data-d="-${x.inc || 1}" aria-label="重量を減らす">−</button>
        <input class="num" inputmode="decimal" value="${fmtKg(s.w)}" data-act="inp" ${at} data-f="w" aria-label="重量kg">
        <button data-act="step" ${at} data-f="w" data-d="${x.inc || 1}" aria-label="重量を増やす">＋</button>
      </div>
      <div class="stepper r">
        <button data-act="step" ${at} data-f="r" data-d="-1" aria-label="回数を減らす">−</button>
        <input class="num" inputmode="numeric" value="${s.r}" data-act="inp" ${at} data-f="r" aria-label="回数">
        <button data-act="step" ${at} data-f="r" data-d="1" aria-label="回数を増やす">＋</button>
      </div>
      <button class="toggle lim ${s.l ? 'on' : ''}" data-act="limit" ${at} aria-pressed="${s.l}" aria-label="限界到達">限界</button>
      <button class="del" data-act="delset" ${at} aria-label="セットを削除">✕</button>
    </div>
    ${rm ? `<div class="rm">${rm}</div>` : ''}
  </div>`;
}

/* --- 部位 --- */
function viewBody() {
  const today = todayKey();
  const A = L.weeklyActual(DAYS, EX, today), act = A.totals, tg = L.targetMuscles(S.menus, EX);
  const sel = S.muscle;
  let detail = '';
  if (sel) {
    const rows = A.detail[sel];
    detail = `<div class="card">
      <div class="row between"><div><h2 style="margin:0">${sel}</h2><div class="sub">内訳</div></div><span class="big num">${fmtKg(act[sel])}<span class="sub"> セット</span></span></div>
      ${rows.length ? rows.map(r => `<div class="setrow"><div><div style="font-weight:700">${esc(EX[r.id].name)}</div><div class="sub">${r.sets}セット ・ ${r.coef === 1 ? '主働筋 ×1' : '補助筋 ×0.5'}</div></div><b class="num">${fmtKg(r.sets * r.coef)}</b></div>`).join('') : '<div class="empty">直近7日の記録はありません</div>'}
    </div>`;
  }
  const visible = MUSCLES.filter(m => !S.cfg.hide[m]);
  const withTarget = visible.filter(m => tg.has(m));
  const noTarget = visible.filter(m => !tg.has(m) && act[m] > 0);
  const range = `${L.fmtMD(L.addDays(today, -6))}〜${L.fmtMD(today)}`;
  return `
    <div class="figure" id="fig">${figureSvg()}</div>
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
      ${withTarget.map(m => mrow(m, act[m], S.cfg.target[m])).join('') || (noTarget.length ? '' : '<div class="empty">メニューに種目を入れると、目標が出ます</div>')}
      ${noTarget.length ? `<div class="sub" style="margin-top:8px">目標なし（メニューに種目がない部位）</div>` + noTarget.map(m => `<div class="setrow"><b>${m}</b><b class="num">${fmtKg(act[m])} <span class="sub">セット</span></b></div>`).join('') : ''}
      <div class="note" style="margin-top:10px">主働筋は1セット、補助筋は0.5セットで計算。</div>
    </div>`;
}
function mrow(m, n, tgt) {
  return `<div class="mrow">
    <div class="t"><b>${m}</b><span class="n">${fmtKg(n)} <i>/ ${tgt} セット</i></span></div>
    <div class="bar"><div class="lv${L.level(n, tgt)}" style="width:${Math.min(100, (n / tgt) * 100)}%"></div></div>
    <div class="lbl">${L.levelLabel(n, tgt)}</div>
  </div>`;
}

/* --- メニュー --- */
function planNote() {
  const n = S.menus.filter(m => !m.paused).length;
  if (!n) return '休止していないメニューがありません';
  const k = Math.round((S.cfg.freq / n) * 10) / 10;
  return `各メニューを週${k}回ずつやる場合（週${S.cfg.freq}回 ÷ ${n}メニュー）`;
}
function viewMenu() {
  const pl = L.weeklyPlan(S.menus, EX, S.cfg.freq), tg = L.targetMuscles(S.menus, EX);
  const planRows = MUSCLES.filter(m => tg.has(m) && !S.cfg.hide[m]);
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
                <span class="meta">${rangeText(e)}×${e.sets}</span>
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
    ${S.menus.length ? '<div class="foot-hint" style="padding:0 8px 10px">長押しで並べ替え。種目をタップで編集</div>' : ''}
    <button class="btn block ghost small" data-act="menuNew" style="margin-bottom:12px">＋ メニューを追加</button>
    ${planRows.length ? `<div class="card c">
      <h2 style="font-size:17px;margin-bottom:2px">週のセット数（予定）</h2>
      <div class="sub" style="margin-bottom:6px;font-size:12px">${planNote()}</div>
      ${planRows.map(m => {
        const n = pl[m], t = S.cfg.target[m];
        return `<div class="prow"><span class="pn">${m}</span><span class="pbar"><i class="lv${L.level(n, t)}" style="width:${Math.min(100, n / t * 100)}%"></i></span><span class="pv num">${fmtKg(Math.round(n * 10) / 10)}<small>/${t}</small></span></div>`;
      }).join('')}
    </div>` : ''}`;
}

/* --- 設定 --- */
function viewSettings() {
  const c = S.cfg;
  const lb = c.lastBackup ? `前回の保存: ${dateJa(c.lastBackup)}` : 'まだ保存していません';
  const prot = S.persisted == null ? '' : ` ・ 保存の保護: ${S.persisted ? '有効' : '未設定'}`;
  return `
    ${themeCard()}
    <div class="card">
      <h2>週の頻度</h2>
      <div class="setrow"><div>トレーニングする回数</div>${stepper('freq', c.freq, '回')}</div>
    </div>
    <div class="card">
      <h2>おすすめメニューの方式</h2>
      <div class="seg" style="margin:4px 0 8px">
        <button class="${c.method === 1 ? 'on' : ''}" data-act="method" data-v="1">方式1</button>
        <button class="${c.method === 2 ? 'on' : ''}" data-act="method" data-v="2">方式2</button>
      </div>
      <div class="note">方式1: 最終実施が一番古いメニュー<br>方式2: 最後に実施したメニューの次</div>
    </div>
    <div class="card">
      <h2>インターバルの基準値</h2>
      ${CATS.map(k => `<div class="setrow"><div>${CAT_NAME[k]}</div>${stepper('rest:' + k, c.rest[k], '秒', 15)}</div>`).join('')}
    </div>
    <div class="card">
      <h2>部位の目標セット数（週）</h2>
      ${MUSCLES.map(m => `<div class="setrow"><div class="grow">${m}</div>${stepper('tg:' + m, c.target[m], '', 1)}<button class="switch ${c.hide[m] ? '' : 'on'}" style="margin-left:10px" data-act="vis" data-m="${m}" aria-label="${m}を表示"></button></div>`).join('')}
      <div class="note">右のスイッチは部位の表示・非表示です。</div>
    </div>
    <div class="card">
      <h2>データ</h2>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <button class="btn" data-act="backup" style="flex-basis:100%">バックアップを保存</button>
        <button class="btn grow" data-act="restore">復元</button>
        <button class="btn grow" data-act="csv">CSV書き出し</button>
      </div>
      <div class="note" style="margin-top:10px">${lb}。記録はこのiPhoneの中だけにあります。保存では「ファイルに保存」を選びます。iCloud Drive に置くと、iPhoneが壊れても残ります。</div>
    </div>
    <div class="card">
      <h2>メモ</h2>
      <div class="note">・推定1RMはO'Connor式（重量 × (1 + 0.025 × 回数)）です。他アプリ（Epley系など）と数値が違う場合があります。<br>
      ・タイマー画面の誤操作を防ぐには、iPhoneのガイドアクセス（設定→アクセシビリティ）を使ってください。ホームバー付近のスワイプは、ウェブ側では止められません。</div>
    </div>
    <div class="card">
      <h2>動作確認</h2>
      <button class="btn block" data-act="timer10">タイマー画面を試す（10秒）</button>
    </div>
    <div class="foot-hint">版 ${BUILD}${prot}${S.updated ? ' ・ 新しい版があります（開き直すと反映）' : ''}</div>`;
}
function stepper(k, v, unit, step = 1) {
  return `<div class="stepper"><button data-act="cfg" data-k="${k}" data-d="-${step}">−</button><span class="num" style="min-width:52px;text-align:center;font-weight:800;font-size:18px">${v}<small style="margin-left:2px">${unit}</small></span><button data-act="cfg" data-k="${k}" data-d="${step}">＋</button></div>`;
}

/* ========== シート ========== */
function sheet(html) {
  $('#sheet-root').innerHTML = `<div class="back" data-act="close"></div><div class="sheet">${html}</div>`;
}
function closeSheet() { $('#sheet-root').innerHTML = ''; }
function infoSheet(title, msg) {
  sheet(`<h2>${esc(title)}</h2><div class="note" style="font-size:15px;color:var(--text)">${esc(msg)}</div><button class="btn block" data-act="close" style="margin-top:14px">閉じる</button>`);
}
// msg はHTML（呼び出し側で esc する）
function confirmSheet(msg, okLabel, fn, danger = true) {
  S.confirmFn = fn;
  sheet(`<h2>確認</h2><div class="note" style="font-size:15px;color:var(--text);margin-bottom:14px">${msg}</div>
    <button class="btn block ${danger ? 'danger' : 'primary'}" data-act="doConfirm" ${danger ? 'style="background:var(--card2)"' : ''}>${esc(okLabel)}</button>
    <button class="btn block ghost" data-act="close" style="margin-top:8px">やめる</button>`);
}
function textSheet(title, value, mode, id) {
  S.text = { mode, id };
  sheet(`<h2>${esc(title)}</h2>
    <div class="field"><label>メニュー名</label><input id="txt" value="${esc(value)}" maxlength="20"></div>
    <button class="btn primary block" data-act="saveText">保存</button>
    <button class="btn block ghost" data-act="close" style="margin-top:8px">キャンセル</button>`);
  setTimeout(() => { const t = $('#txt'); if (t) { t.focus(); t.select(); } }, 50);
}

function rmSheet() {
  sheet(`<h2>RM計算</h2>
    <div class="field two row" style="gap:10px">
      <div class="grow"><label>重量 (kg)</label><input id="rm-w" class="num" inputmode="decimal" value="80"></div>
      <div class="grow"><label>回数</label><input id="rm-r" class="num" inputmode="numeric" value="8"></div>
    </div>
    <div class="result"><div class="sub">推定1RM（O'Connor式）</div><div class="big num" id="rm-out">96</div><div class="sub" id="rm-note"></div></div>
    <button class="btn block" data-act="close" style="margin-top:12px">閉じる</button>`);
  const calc = () => {
    const w = parseFloat($('#rm-w').value.replace(',', '.')), r = parseInt($('#rm-r').value, 10);
    if (!(w > 0) || !(r > 0)) { $('#rm-out').textContent = '—'; $('#rm-note').textContent = ''; return; }
    $('#rm-out').innerHTML = `${L.fmt1(L.e1rm(w, r))}<span class="sub"> kg</span>`;
    $('#rm-note').textContent = r >= 11 ? '参考値（精度低）' : '';
  };
  $('#rm-w').addEventListener('input', calc); $('#rm-r').addEventListener('input', calc); calc();
}

/* ----- 代替種目（日別） ----- */
function altSheet(i) {
  const e = S.day.ex[i], slot = EX[e.orig || e.id];
  const used = id => S.day.ex.some((x, k) => k !== i && x.id === id);
  const row = (id, label, v) => {
    const now = id === e.id, dis = now || used(id);
    return `<button class="pick" ${dis ? 'disabled style="opacity:.45"' : `data-act="altPick" data-i="${i}" data-v="${v}"`}>${label}<span class="sub">${now ? '選択中' : dis ? '今日すでにあります' : '選ぶ'}</span></button>`;
  };
  sheet(`<h2>代替種目</h2>
    <div class="sub" style="margin-bottom:6px">記録は代替種目自身の履歴に残ります（重量は換算しません）</div>
    ${e.orig ? row(slot.id, `元の種目に戻す（${esc(slot.name)}）`, '') : ''}
    ${slot.alts.filter(a => EX[a]).map(a => row(a, esc(EX[a].name), a)).join('')}
    <button class="btn block ghost" data-act="close" style="margin-top:12px">やめる</button>`);
}

/* ----- コピー ----- */
function copySheet(kind, i) {
  const D = S.day;
  if (kind === 'ex') {
    const e = D.ex[i];
    const recs = S.copyRecs = L.historyOf(DAYS, e.id, D.date, 8);
    sheet(`<h2>過去の記録をコピー</h2>
      <div class="sub" style="margin-bottom:2px">${esc(EX[e.id].name)}</div>
      ${recs.length ? `<div class="sub" style="margin-bottom:6px">コピー元の日を選ぶと、そのセットがこの日の末尾に入ります（回数は元の値のまま）</div>` : '<div class="empty">この日より前の記録はありません</div>'}
      ${recs.map((r, k) => `<button class="pick cp" data-act="copyPickEx" data-i="${i}" data-k="${k}">
        <span class="cp-top"><b>${dateJa(r.date)}</b><span class="sub">${r.sets.length}セット</span></span>
        <span class="cp-sets num">${r.sets.map(x => `<i>${fmtKg(x.w)}<small>kg</small> × ${x.r}</i>`).join('')}</span>
      </button>`).join('')}
      <button class="btn block ghost" data-act="close" style="margin-top:12px">やめる</button>`);
    return;
  }
  const dates = [...L.doneDates(DAYS)].filter(d => d < D.date).reverse().slice(0, 20);
  sheet(`<h2>過去の日をコピー（全種目）</h2>
    ${dates.length ? '<div class="sub" style="margin-bottom:6px">選んだ日の全種目を、この日の記録にコピーします（回数は元の値のまま）</div>' : '<div class="empty">この日より前の記録はありません</div>'}
    ${dates.map(d => { const t = L.dayTotals(DAYS[d]); return `<button class="pick" data-act="copyPick" data-d="${d}"><span>${dateJa(d)} <span class="sub">${esc(L.menuLabel(DAYS[d], S.menus))}</span></span><span class="sub">${t.ex}種目 ${t.sets}セット</span></button>`; }).join('')}
    <button class="btn block ghost" data-act="close" style="margin-top:12px">やめる</button>`);
}

/* ========== 種目の追加（日別・メニュー・代替の3か所から開く） ========== */
const toKana = t => t.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60)).toLowerCase();
// 保存済みの種目 + まだ使っていないプリセット（id は 'preset:番号'）
function library() {
  const list = Object.values(EX);
  const have = new Set(list.map(e => e.name));
  EX_PRESETS.forEach((p, i) => {
    if (!have.has(p[0])) list.push({ id: 'preset:' + i, ...L.presetExercise(p), preset: true });
  });
  return list;
}
// プリセットを選んだら、種目として保存して（代替種目も一緒に）、そのIDを返す
function resolveEx(id) {
  if (EX[id]) return id;
  const r = L.materialize(EX_PRESETS[+id.slice(7)][0], EX_PRESETS, EX, () => newId('x'));
  r.added.forEach(e => { EX[e.id] = e; saveEx(e); });
  return r.id;
}
function pickCtx() {
  const mode = S.pick.mode; // 'day' / 'menu:<メニューID>' / 'alt'（種目編集の代替）
  if (mode === 'alt') return { isDay: false, isAlt: true, menu: null, have: new Set([S.form.id, ...S.form.alts]) };
  const isDay = mode === 'day';
  const menu = isDay ? S.menus.find(m => m.id === S.day.menuId) : S.menus.find(m => 'menu:' + m.id === mode);
  return { isDay, isAlt: false, menu, have: new Set(isDay ? S.day.ex.map(e => e.id) : (menu ? menu.ex : [])) };
}
function pickListHtml() {
  const { have, isAlt } = pickCtx();
  const q = (S.pick.q || '').trim(), nq = toKana(q);
  const open = S.pick.open || (S.pick.open = {});
  const lib = library(), use = L.usage(DAYS), today = todayKey();
  const inMenu = new Set(S.menus.flatMap(m => m.ex));
  const rank = e => (use[e.id] || 0) * 4 + (inMenu.has(e.id) ? 2 : 0) + (e.preset ? 0 : 1);
  const lastM = L.lastDoneByMuscle(DAYS, EX);
  const ago = m => (lastM[m] ? (lastM[m] === today ? '今日' : L.diffDays(today, lastM[m]) + '日前') : '記録なし');
  let groups = MUSCLES.map(m => ({ m, list: lib.filter(e => e.main === m).sort((a, b) => rank(b) - rank(a)) }));
  if (nq) groups = groups.map(g => ({ m: g.m, list: g.list.filter(e => toKana(e.name).includes(nq)) }));
  groups = groups.filter(g => g.list.length);
  const exact = nq && lib.some(e => toKana(e.name) === nq);
  const addNew = q && !exact && !isAlt ? `<button class="pick pk newrow" data-act="newEx" data-name="${esc(q)}"><span>「${esc(q)}」を新しい種目として追加</span><span class="sub">作成</span></button>` : '';
  const none = nq && !groups.length ? '<div class="empty" style="padding:12px 0">一致する種目がありません</div>' : '';
  return addNew + none + groups.map(g => {
    const shown = open[g.m] || nq ? g.list : g.list.slice(0, 3);
    return `<div class="pg">
        ${nq ? `<div class="pgh"><b>${g.m}</b><span class="sub">${g.list.length}件</span></div>` : `<button class="pgh" data-act="pickMore" data-m="${g.m}" aria-expanded="${!!open[g.m]}"><b>${g.m}</b><span class="sub">${ago(g.m)}${g.list.length > 3 ? (open[g.m] ? ' ▴' : ' ▾') : ''}</span></button>`}
        ${shown.map(e => { const dis = have.has(e.id); return `<button class="pick pk" ${dis ? 'disabled style="opacity:.4"' : `data-act="pickEx" data-id="${e.id}"`}><span>${esc(e.name)}</span><span class="sub">${dis ? '追加済み' : '＋'}</span></button>`; }).join('')}
        ${nq ? '' : `<div class="pgf">
          ${isAlt ? '<span></span>' : `<button data-act="newEx" data-m="${g.m}" class="acc">種目を追加</button>`}
          ${g.list.length > 3 ? `<button data-act="pickMore" data-m="${g.m}">${open[g.m] ? '閉じる ▴' : 'すべて表示 (' + g.list.length + ') ▾'}</button>` : '<span></span>'}
        </div>`}
      </div>`;
  }).join('');
}
function pickSheet(mode) {
  S.pick.mode = mode;
  const keepScroll = $('#sheet-root .sheet') && $('#pklist') ? $('#sheet-root .sheet').scrollTop : 0;
  const { isDay, isAlt, menu } = pickCtx();
  const also = isDay && menu ? `<button class="toggle ${S.pick.also ? 'on' : ''}" style="width:100%;margin-bottom:6px" data-act="pickAlso">${S.pick.also ? '✓ ' : ''}今後の「${esc(menu.name)}」メニューにも追加する</button>` : '';
  const to = isAlt ? `「${esc(S.form.name)}」の代替に入れます` : isDay ? 'この日の記録に入れます' : `「${esc(menu.name)}」に入れます`;
  sheet(`<h2 style="margin-bottom:4px">${isAlt ? '代替種目を追加' : '種目を追加'}</h2>
    <div class="sub" style="margin-bottom:8px">${to}。よくやる種目が上に出ます</div>
    <input id="pk-q" class="pkq" type="text" inputmode="text" autocomplete="off" autocapitalize="off" placeholder="${isAlt ? '種目名で探す' : '種目名で探す。なければ、そのまま入力して追加'}" value="${esc(S.pick.q || '')}">
    ${also}
    <div id="pklist">${pickListHtml()}</div>
    <button class="btn block" data-act="${isAlt ? 'formBack' : 'close'}" style="margin-top:14px">${isAlt ? '戻る' : '閉じる'}</button>`);
  $('#sheet-root .sheet').scrollTop = keepScroll;
}

/* ----- 種目の作成と編集（F.id があれば編集） ----- */
const CAT_DEF = { 多: [8, 10], 単: [12, 15], カ腹: [12, 15] };
function exFormOpen(name, main) {
  const cat = main === 'ふくらはぎ' || main === '腹筋' ? 'カ腹' : '単';
  S.form = { id: null, name: name || '', main: main || '', aux: [], cat, lo: CAT_DEF[cat][0], hi: CAT_DEF[cat][1], sets: 3, inc: 2.5, rest: null, memo: '', alts: [], msg: '' };
  exFormSheet();
}
function exEditOpen(id) {
  const e = EX[id];
  S.form = { id, name: e.name, main: e.main, aux: e.aux.slice(), cat: e.cat, lo: e.range[0], hi: e.range[1], sets: e.sets, inc: e.inc, rest: e.rest, memo: e.memo, alts: e.alts.filter(a => EX[a]), msg: '' };
  exFormSheet();
  $('#sheet-root .sheet').scrollTop = 0;
}
function readForm() {
  const F = S.form, v = id => { const e = document.getElementById(id); return e ? e.value : null; };
  const n = (id, cur, float) => { const x = parseFloat((v(id) || '').replace(',', '.')); return x >= 0 ? (float ? x : Math.round(x)) : cur; };
  if (v('exf-name') !== null) F.name = v('exf-name');
  if (v('exf-lo') !== null) { F.lo = n('exf-lo', F.lo); F.hi = n('exf-hi', F.hi); F.sets = n('exf-sets', F.sets); F.inc = n('exf-inc', F.inc, true); }
  if (v('exf-main') !== null) F.main = v('exf-main');
  if (v('exf-cat') !== null) F.cat = v('exf-cat');
  if (v('exf-rest') !== null) F.rest = v('exf-rest') ? +v('exf-rest') : null;
  if (v('exf-memo') !== null) F.memo = v('exf-memo');
  F.aux = F.aux.filter(a => a !== F.main);
}
function exFormSheet() {
  const F = S.form, edit = !!F.id;
  const sh = $('#sheet-root .sheet'), keep = sh && $('#exf-name') ? sh.scrollTop : 0;
  const opt = (v, label, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label}</option>`;
  const stack = S.formStack || [], parent = stack[stack.length - 1];
  const busy = new Set(stack.map(f => f.id).concat(F.id));
  let extra = '';
  if (edit) {
    const last = L.historyOf(DAYS, F.id, null, 1)[0];
    const pct = last ? L.incPercent(F.inc, last.sets[0].w) : null;
    const rests = []; for (let s = W_MIN; s <= W_MAX; s += W_STEP) rests.push(s);
    extra = `
    ${pct ? `<div class="note" style="margin:-4px 0 10px">増量幅は、直近の重量（${fmtKg(last.sets[0].w)}kg）の約${pct.toFixed(1)}%です。${L.incOutOfRange(pct) ? '<b>2〜10%の目安から外れています。</b>' : ''}</div>` : ''}
    <div class="field"><label>補助筋（1セットを0.5セットとして数える。任意）</label>
      <div class="chips sm">${MUSCLES.filter(m => m !== F.main).map(m => `<button class="chip ${F.aux.includes(m) ? 'on' : ''}" data-act="fAux" data-m="${m}">${m}</button>`).join('')}</div></div>
    <div class="field"><label>インターバル</label>
      <select id="exf-rest">${opt('', `区分の基準値（${mmss(S.cfg.rest[F.cat])}）`, F.rest ? String(F.rest) : '')}${rests.map(s => opt(String(s), mmss(s), F.rest ? String(F.rest) : '')).join('')}</select></div>
    <div class="field"><label>固定メモ（シート位置など）</label><input id="exf-memo" value="${esc(F.memo)}" maxlength="80" autocomplete="off"></div>
    <div class="field"><label>代替種目（上から優先。名前をタップで、その種目の設定）</label>
      ${F.alts.map((a, k) => `<div class="altrow">${busy.has(a) ? `<span>${esc(EX[a].name)}</span>` : `<button class="altname" data-act="fAltEdit" data-k="${k}"><span>${esc(EX[a].name)}</span><span class="sub">${rangeText(EX[a])}×${EX[a].sets} ›</span></button>`}<button class="mv dangertxt" data-act="fAltDel" data-k="${k}" aria-label="代替から外す">✕</button></div>`).join('')}
      <button class="btn small ghost block" data-act="fAltAdd" style="margin-top:6px">＋ 代替種目を追加</button></div>`;
  }
  sheet(`<h2>${edit ? '種目の設定' : '種目を作成'}</h2>
    ${edit && parent ? `<div class="sub" style="margin:-8px 0 10px">「${esc(parent.name)}」の代替種目</div>` : ''}
    <div class="field"><label>名前${edit ? '（変えても履歴はつながります）' : ''}</label><input id="exf-name" value="${esc(F.name)}" maxlength="30" placeholder="例: ケーブルプルオーバー" autocomplete="off"></div>
    ${edit ? `<div class="field two row" style="gap:10px">
      <div class="grow"><label>部位（主働筋）</label><select id="exf-main">${MUSCLES.map(m => opt(m, m, F.main)).join('')}</select></div>
      <div class="grow"><label>区分</label><select id="exf-cat">${CATS.map(k => opt(k, CAT_NAME[k], F.cat)).join('')}</select></div>
    </div>` : `
    <div class="field"><label>部位（主働筋）</label>
      <div class="chips" style="margin:0;gap:6px">${MUSCLES.map(m => `<button class="chip ${F.main === m ? 'on' : ''}" data-act="fMain" data-m="${m}">${m}</button>`).join('')}</div></div>
    <div class="field"><label>区分</label>
      <div class="seg" style="margin:0">${CATS.map(k => `<button class="${F.cat === k ? 'on' : ''}" data-act="fCat" data-c="${k}">${CAT_NAME[k]}</button>`).join('')}</div></div>`}
    <div class="fgrid">
      <div class="field"><label>レンジ下限</label><input id="exf-lo" class="num" inputmode="numeric" value="${F.lo}"></div>
      <div class="field"><label>上限</label><input id="exf-hi" class="num" inputmode="numeric" value="${F.hi}"></div>
      <div class="field"><label>セット数</label><input id="exf-sets" class="num" inputmode="numeric" value="${F.sets}"></div>
      <div class="field"><label>増量幅kg</label><input id="exf-inc" class="num" inputmode="decimal" value="${F.inc}"></div>
    </div>
    ${extra}
    <div class="note" id="exf-msg" style="color:var(--danger);min-height:18px">${esc(F.msg)}</div>
    <button class="btn primary block" data-act="fCreate" style="min-height:52px">${edit ? '保存' : '作成して追加'}</button>
    <button class="btn block ghost" data-act="${!edit ? 'pickBack' : parent ? 'formPop' : 'close'}" style="margin-top:8px">${!edit ? '戻る' : parent ? `保存せずに「${esc(parent.name)}」へ戻る` : 'やめる'}</button>`);
  $('#sheet-root .sheet').scrollTop = keep;
}
function exFormSave() {
  readForm();
  const F = S.form, name = F.name.trim();
  const bad = msg => { F.msg = msg; exFormSheet(); };
  if (!name) return bad('名前を入力してください');
  if (!F.main) return bad('部位を選んでください');
  if (!(F.lo >= 1 && F.hi >= F.lo)) return bad('レンジは、下限 ≦ 上限 で入れてください');
  const same = Object.values(EX).find(x => toKana(x.name) === toKana(name));
  const fields = { name, cat: F.cat, main: F.main, aux: F.aux, range: [F.lo, F.hi], sets: Math.max(1, F.sets), inc: F.inc, rest: F.rest, memo: F.memo.trim(), alts: F.alts };
  if (F.id) {
    if (same && same.id !== F.id) return bad('同じ名前の種目がすでにあります');
    Object.assign(EX[F.id], fields);
    saveEx(EX[F.id]);
    if (S.formStack && S.formStack.length) { rerender(); formPop(); return; } // 代替の設定から、元の種目の設定へ戻る
    closeSheet(); rerender();
    return;
  }
  let e = same;
  if (!e) { const id = newId('x'); e = EX[id] = { id, ...fields }; saveEx(e); }
  addPicked(e.id);
  closeSheet(); rerender();
}
function formPop() { S.form = S.formStack.pop(); S.form.msg = ''; exFormSheet(); }
// 選んだ種目を、開いている追加先（日 / メニュー）に入れる
function addPicked(id) {
  const { isDay, menu, have } = pickCtx();
  if (have.has(id)) return;
  if (isDay) {
    const ne = { uid: UID++, id, orig: null, sets: [] };
    S.day.ex.push(ne); S.dayOpen = ne.uid;
    saveDay();
    if (S.pick.also && menu && !menu.ex.includes(id)) { menu.ex.push(id); saveMenus(); }
  } else if (menu) { menu.ex.push(id); saveMenus(); }
}

/* ========== 並べ替え（drag.js から呼ばれる） ========== */
function reorderTarget(name) {
  if (name === 'day') return S.day.ex;
  if (name === 'menus') return S.menus;
  if (name.startsWith('menu:')) return S.menus.find(m => m.id === name.slice(5)).ex;
  return null;
}
function reorderSave(name) { if (name === 'day') saveDay(); else saveMenus(); }

/* ========== バックアップ・復元・CSV ========== */
const currentState = () => ({ exercises: EX, menus: S.menus, days: DAYS, settings: S.cfg });
// 共有メニュー（ファイル付き）で渡す。使えなければダウンロード。キャンセルなら false
async function shareFile(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; }
    catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return true;
}
const stamp = () => todayKey().replace(/-/g, '');
async function doBackup() {
  const text = JSON.stringify(L.makeBackup(currentState(), new Date().toISOString()), null, 1);
  if (!(await shareFile(`kintore-${stamp()}.backup.json`, text, 'application/json'))) return;
  S.cfg.lastBackup = todayKey(); saveCfg();
  rerender();
}
function doCsv() { shareFile(`kintore-${stamp()}.csv`, L.toCsv(currentState()), 'text/csv'); }
// ファイル選択の前に、どこで何を選ぶかを案内する（開く場所はアプリからは指定できない）
function restoreSheet() {
  const lb = S.cfg.lastBackup;
  sheet(`<h2>バックアップから復元</h2>
    <div class="steps">
      <div><b>1</b><span>下の「ファイルを選ぶ」を押すと、iPhoneの「ファイル」の画面が開きます。</span></div>
      <div><b>2</b><span>バックアップを保存した場所を開きます。保存のときに「ファイルに保存」で選んだ場所です（iCloud Drive か「このiPhone内」が多いです）。</span></div>
      <div><b>3</b><span><em>kintore-日付.backup.json</em> を選びます。見つからないときは、上の検索欄に <em>kintore</em> と入れてください。</span></div>
    </div>
    ${lb ? `<div class="note" style="margin-bottom:8px">前回の保存は${dateJa(lb)}、ファイル名は kintore-${lb.replace(/-/g, '')}.backup.json です。</div>` : ''}
    <div class="note">選ぶと、中身の件数を表示して確認します。そこで「読み込む」を押すまで、何も変わりません。</div>
    <button class="btn primary block" data-act="restoreGo" style="min-height:52px;margin-top:12px">ファイルを選ぶ</button>
    <button class="btn block ghost" data-act="close" style="margin-top:8px">やめる</button>`);
}
async function onRestoreFile(file) {
  let st;
  try { st = L.parseBackup(await file.text()); }
  catch (e) { infoSheet('読み込めません', e.message); return; }
  const has = S.menus.length || Object.keys(DAYS).length;
  const msg = `メニュー ${st.menus.length}、種目 ${Object.keys(st.exercises).length}、記録 ${Object.keys(st.days).length}日分 を読み込みます。`
    + (has ? '<br><b>今のメニューと記録は、すべてこの内容に置き換わります。</b>' : '');
  confirmSheet(msg, has ? '置き換えて読み込む' : '読み込む', () => applyState(st), !!has);
}
async function applyState(st) {
  try { await Store.replaceAll(st); } catch (e) { closeSheet(); saveFail(e); return; }
  EX = st.exercises; DAYS = st.days; S.menus = st.menus; S.cfg = st.settings;
  S.day = null; S.menuPick = null; S.openMenu = null; S.muscle = null;
  closeSheet(); render();
  toast('読み込みました');
}

/* ========== イベント ========== */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  const a = el.dataset.act, i = +el.dataset.i, j = +el.dataset.j;
  const D = S.day;
  S.keepScroll = true;
  switch (a) {
    case 'tab': S.tab = el.dataset.t; S.day = null; S.keepScroll = false; render(); $('#view').scrollTop = 0; maybeReload(); return;
    case 'cal': S.cal = L.shiftMonth(S.cal, +el.dataset.d); break;
    case 'pick': S.menuPick = el.dataset.id; break;
    case 'today': openDay(todayKey(), pickedMenu()); return;
    case 'todayFree': case 'todayOpen': openDay(todayKey(), null); return;
    case 'day': if (Date.now() - SWIPE.at < 400) return; openDay(el.dataset.d, el.dataset.d === todayKey() ? pickedMenu() : null); return;
    case 'dayMenu': {
      const m = S.menus.find(x => x.id === el.dataset.id);
      D.menuId = m.id; D.ex = menuEntries(m); openFirstUnfinished(); saveDay(); break;
    }
    case 'back': S.day = null; render(); S.keepScroll = false; maybeReload(); return;
    case 'rm': rmSheet(); return;
    case 'close': closeSheet(); return;
    case 'addset': {
      const e = D.ex[i];
      e.sets.push(L.nextSet(e.sets, L.historyOf(DAYS, e.id, D.date, 1)[0], EX[e.id]));
      saveDay(); break;
    }
    case 'timer': timerSheet(L.restFor(EX[D.ex[i].id], S.cfg)); return;
    case 'timerGo': { wheelSync(); const v = S.timerPick; clearInterval(S.wheelIv); closeSheet(); startTimer(v); return; }
    case 'timerPreset': case 'wheelItem': wheelTo(+el.dataset.v, true); return;
    case 'exToggle': { const u = D.ex[i].uid; S.dayOpen = S.dayOpen === u ? null : u; break; }
    case 'step': {
      const s = D.ex[i].sets[j], f = el.dataset.f, d = parseFloat(el.dataset.d);
      s[f] = Math.max(0, Math.round((s[f] + d) * 100) / 100);
      saveDay(); break;
    }
    case 'limit': { const s = D.ex[i].sets[j]; s.l = !s.l; saveDay(); break; }
    case 'delset': D.ex[i].sets.splice(j, 1); saveDay(); break;
    case 'alt': altSheet(i); return;
    case 'altPick': {
      const e = D.ex[i], v = el.dataset.v;
      if (v) { e.orig = e.orig || e.id; e.id = v; } else { e.id = e.orig; e.orig = null; }
      saveDay(); closeSheet(); break;
    }
    case 'copyDay': copySheet('day'); return;
    case 'copyEx': copySheet('ex', i); return;
    case 'copyPickEx': S.day = L.copyExercise(D, i, S.copyRecs[+el.dataset.k].sets); saveDay(); closeSheet(); break;
    case 'copyPick': {
      const out = L.copyDay(D, DAYS[el.dataset.d]);
      out.ex.forEach(e => { if (!e.uid) e.uid = UID++; });
      S.day = out;
      if (!S.day.ex.some(e => e.uid === S.dayOpen)) openFirstUnfinished();
      saveDay(); closeSheet(); toast('コピーしました'); break;
    }
    case 'copyToToday': {
      // 開いている日の全種目を、今日の記録にコピーして、今日を開く
      const today = todayKey(), cur = DAYS[today];
      const go = () => {
        const out = L.copyDay(cur || { date: today, menuId: null, ex: [] }, D);
        DAYS[today] = out; save(() => Store.putDay(out));
        closeSheet(); openDay(today, null); toast('今日にコピーしました');
      };
      const n = cur ? L.dayTotals(cur).sets : 0;
      if (n) confirmSheet('今日はすでに' + n + 'セットの記録があります。その末尾に追加します。', '追加する', go, false);
      else go();
      return;
    }
    case 'dayDel': {
      const e = D.ex[i];
      const go = () => { D.ex.splice(i, 1); S.swipeUid = null; saveDay(); closeSheet(); rerender(); };
      if (e.sets.length) confirmSheet('「' + esc(EX[e.id].name) + '」の' + e.sets.length + 'セットの記録も、この日の記録から消えます。', '外す', go);
      else go();
      return;
    }
    case 'doConfirm': { const f = S.confirmFn; S.confirmFn = null; if (f) f(); return; }


    case 'openMenu': S.openMenu = S.openMenu === el.dataset.id ? null : el.dataset.id; break;
    case 'pause': { const m = S.menus.find(x => x.id === el.dataset.id); m.paused = !m.paused; saveMenus(); break; }
    case 'menuDelEx': S.menus[+el.dataset.mi].ex.splice(+el.dataset.k, 1); saveMenus(); break;
    case 'menuNew': textSheet('メニューを追加', '', 'new'); return;
    case 'startMenu': S.tab = 'menu'; S.keepScroll = false; render(); textSheet('最初のメニューを作る', '', 'new'); return;
    case 'menuRename': textSheet('名前を変更', S.menus.find(x => x.id === el.dataset.id).name, 'rename', el.dataset.id); return;
    case 'saveText': {
      const v = $('#txt').value.trim();
      if (!v) return;
      if (S.text.mode === 'new') {
        const id = newId('m');
        S.menus.push({ id, name: v, paused: false, ex: [] }); S.openMenu = id;
        saveMenus(); render(); S.keepScroll = false;
        S.pick = { also: false, mode: 'menu:' + id }; pickSheet(S.pick.mode);
        return;
      }
      S.menus.find(x => x.id === S.text.id).name = v;
      saveMenus(); closeSheet(); break;
    }
    case 'menuDel': {
      const m = S.menus.find(x => x.id === el.dataset.id);
      confirmSheet('メニュー「' + esc(m.name) + '」を削除します。過去の記録は消えません。', '削除する', () => {
        S.menus = S.menus.filter(x => x !== m);
        if (S.openMenu === m.id) S.openMenu = null;
        saveMenus(); closeSheet(); rerender();
      });
      return;
    }

    case 'dayAdd': S.pick = { also: false, mode: 'day' }; pickSheet('day'); return;
    case 'menuAddEx': S.pick = { also: false, mode: 'menu:' + el.dataset.id }; pickSheet(S.pick.mode); return;
    case 'pickMore': S.pick.open = S.pick.open || {}; S.pick.open[el.dataset.m] = !S.pick.open[el.dataset.m]; pickSheet(S.pick.mode); return;
    case 'pickAlso': S.pick.also = !S.pick.also; pickSheet(S.pick.mode); return;
    case 'pickEx': {
      const id = resolveEx(el.dataset.id);
      if (S.pick.mode === 'alt') { S.form.alts.push(id); exFormSheet(); return; }
      addPicked(id);
      render(); pickSheet(S.pick.mode); return;
    }
    case 'pickBack': readForm(); pickSheet(S.pick.mode); return;

    case 'editEx': S.formStack = []; exEditOpen(el.dataset.id); return;
    case 'newEx': S.pick.q = ''; exFormOpen(el.dataset.name || '', el.dataset.m || ''); return;
    case 'fMain': readForm(); S.form.main = el.dataset.m; S.form.msg = ''; exFormSheet(); return;
    case 'fCat': { readForm(); const c = el.dataset.c; S.form.cat = c; S.form.lo = CAT_DEF[c][0]; S.form.hi = CAT_DEF[c][1]; exFormSheet(); return; }
    case 'fAux': { readForm(); const m = el.dataset.m, F = S.form; F.aux = F.aux.includes(m) ? F.aux.filter(x => x !== m) : F.aux.concat(m); exFormSheet(); return; }
    case 'fAltDel': readForm(); S.form.alts.splice(+el.dataset.k, 1); exFormSheet(); return;
    case 'fAltEdit': readForm(); S.formStack.push(S.form); exEditOpen(S.form.alts[+el.dataset.k]); return;
    case 'formPop': formPop(); return;
    case 'fAltAdd': readForm(); S.pick = { also: false, mode: 'alt' }; pickSheet('alt'); return;
    case 'formBack': exFormSheet(); return;
    case 'fCreate': exFormSave(); return;

    case 'theme': applyTheme(el.dataset.t); break;
    case 'method': S.cfg.method = +el.dataset.v; saveCfg(); break;
    case 'vis': { const m = el.dataset.m; if (S.cfg.hide[m]) delete S.cfg.hide[m]; else S.cfg.hide[m] = true; saveCfg(); break; }
    case 'cfg': {
      const k = el.dataset.k, d = +el.dataset.d, c = S.cfg;
      if (k === 'freq') c.freq = Math.min(7, Math.max(1, c.freq + d));
      else if (k.startsWith('rest:')) { const t = k.slice(5); c.rest[t] = Math.min(W_MAX, Math.max(W_MIN, c.rest[t] + d)); }
      else if (k.startsWith('tg:')) { const m = k.slice(3); c.target[m] = Math.max(1, c.target[m] + d); }
      saveCfg(); break;
    }
    case 'backup': doBackup(); return;
    case 'csv': doCsv(); return;
    case 'restore': restoreSheet(); return;
    case 'restoreGo': { const f = $('#file'); f.value = ''; f.click(); return; }
    case 'timer10': startTimer(10); return;
    default: return;
  }
  render(); S.keepScroll = false;
});

/* 日別画面: 日付の帯を左右スワイプで前後の日へ。種目カードを左スワイプで「外す」を出す（右スワイプで戻す） */
const DSW = { t: null, x: 0, y: 0, card: null };
document.addEventListener('touchstart', e => {
  DSW.t = null;
  if (e.touches.length !== 1 || !S.day || e.target.closest('input, #sheet-root')) return;
  const head = e.target.closest('.day-head'), card = e.target.closest('.ex.ditem');
  if (!head && !card) return;
  DSW.t = head ? 'head' : 'card'; DSW.card = card;
  DSW.x = e.touches[0].clientX; DSW.y = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchmove', e => {
  // 横に動かしているときは、長押しの並べ替えを始めない
  if (DSW.t !== 'card' || DR.on) return;
  const p = e.touches[0], dx = p.clientX - DSW.x, dy = p.clientY - DSW.y;
  if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { clearTimeout(DR.timer); DR.pending = null; }
}, { passive: true });
document.addEventListener('touchend', e => {
  const t = DSW.t; DSW.t = null;
  if (!t || DR.on || !S.day) return;
  const p = e.changedTouches[0], dir = L.swipeDir(p.clientX - DSW.x, p.clientY - DSW.y);
  if (!dir) return;
  if (t === 'head') {
    const date = L.addDays(S.day.date, dir);
    openDay(date, date === todayKey() ? pickedMenu() : null);
    return;
  }
  const e0 = S.day.ex[+DSW.card.dataset.i];
  if (!e0) return;
  if (dir === 1 && S.swipeUid !== e0.uid) { S.swipeUid = e0.uid; rerender(); }
  else if (dir === -1 && S.swipeUid === e0.uid) { S.swipeUid = null; rerender(); }
});
// 「外す」が出ているときに、ほかをタップしたら閉じる（カードのタップは、閉じるだけにする）
document.addEventListener('click', e => {
  if (S.swipeUid == null || e.target.closest('.swipe-del')) return;
  S.swipeUid = null;
  if (e.target.closest('.ex.ditem')) { e.stopPropagation(); e.preventDefault(); }
  rerender();
}, true);

/* カレンダー: 左右スワイプで月を移動 */
const SWIPE = { on: false, x: 0, y: 0, at: 0 };
document.addEventListener('touchstart', e => {
  SWIPE.on = e.touches.length === 1 && !!e.target.closest('#cal');
  if (SWIPE.on) { SWIPE.x = e.touches[0].clientX; SWIPE.y = e.touches[0].clientY; }
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!SWIPE.on) return;
  SWIPE.on = false;
  const p = e.changedTouches[0], dir = L.swipeDir(p.clientX - SWIPE.x, p.clientY - SWIPE.y);
  if (!dir) return;
  SWIPE.at = Date.now(); // スワイプ直後のタップ扱い（日を開く）を止める
  S.cal = L.shiftMonth(S.cal, dir);
  rerender();
});

document.addEventListener('input', ev => {
  if (ev.target.id === 'pk-q') { S.pick.q = ev.target.value; const l = document.getElementById('pklist'); if (l) l.innerHTML = pickListHtml(); }
});

document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.id === 'file') { if (el.files[0]) onRestoreFile(el.files[0]); return; }
  if (el.id === 'exf-main' || el.id === 'exf-cat') { readForm(); exFormSheet(); return; }
  if (el.dataset.act !== 'inp') return;
  const s = S.day.ex[+el.dataset.i].sets[+el.dataset.j], f = el.dataset.f;
  const v = parseFloat(el.value.replace(',', '.'));
  if (v >= 0) { s[f] = f === 'r' ? Math.round(v) : Math.round(v * 100) / 100; saveDay(); }
  rerender();
});

document.addEventListener('click', ev => {
  const g = ev.target.closest('#fig g[data-m]');
  if (!g) return;
  S.muscle = S.muscle === g.dataset.m ? null : g.dataset.m;
  rerender();
});

/* ========== カラーテーマ ========== */
// [id, 表示名, 明るさ, テーマカラー(ステータスバー用)]
const THEMES = [
  ['paper', 'ペーパー', 'light', '#f2f4f8'], ['mint', 'ミント', 'light', '#eef6f2'], ['sand', 'サンド', 'light', '#f7f2ea'], ['lavender', 'ラベンダー', 'light', '#f4f1fb'],
  ['black', 'ブラック', 'dark', '#0d0d0f'], ['midnight', 'ミッドナイト', 'dark', '#0a1020'], ['forest', 'フォレスト', 'dark', '#0b130f'], ['graphite', 'グラファイト', 'dark', '#121110'],
];
S.theme = document.documentElement.getAttribute('data-theme') || 'black';
function applyTheme(id) {
  const t = THEMES.find(x => x[0] === id) || THEMES[4];
  document.documentElement.setAttribute('data-theme', t[0]);
  const sb = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (sb) sb.setAttribute('content', t[2] === 'light' ? 'default' : 'black');
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', t[3]);
  try { localStorage.setItem('kintore-theme', t[0]); } catch (_) {}
  S.theme = t[0];
}
function themeTile(t) {
  return `<button class="theme ${S.theme === t[0] ? 'on' : ''}" data-theme="${t[0]}" data-act="theme" data-t="${t[0]}" aria-pressed="${S.theme === t[0]}"><span class="tp"><i></i><i></i><u></u></span><b>${t[1]}</b></button>`;
}
function themeCard() {
  return `<div class="card">
      <h2>カラー</h2>
      <div class="theme-group">明るい</div>
      <div class="themes">${THEMES.filter(t => t[2] === 'light').map(themeTile).join('')}</div>
      <div class="theme-group">暗い</div>
      <div class="themes">${THEMES.filter(t => t[2] === 'dark').map(themeTile).join('')}</div>
      <div class="note" style="margin-top:10px">画面上の時計の帯（ステータスバー）の色は、アプリを開き直すと変わります。</div>
    </div>`;
}

/* ========== 起動 ========== */
async function boot() {
  try {
    await Store.open();
    const st = await Store.loadAll();
    EX = st.exercises; DAYS = st.days; S.menus = st.menus;
    if (st.settings) S.cfg = { ...L.defaultSettings(), ...st.settings };
    else await Store.putSettings(S.cfg);
  } catch (e) {
    console.error(e);
    S.storeError = true;
  }
  S.ready = true;
  render();
  try {
    const saved = JSON.parse(localStorage.getItem('timerEnd') || 'null');
    if (saved && saved.end && Date.now() - saved.end < 10 * 60 * 1000) { T.end = saved.end; T.total = saved.total; openTimer(); }
    else localStorage.removeItem('timerEnd');
  } catch (_) {}
  // 保存領域を、空き容量の整理で消されないように要求する
  try {
    if (navigator.storage && navigator.storage.persist) {
      S.persisted = await navigator.storage.persist();
      if (S.tab === 'settings' && !S.day) rerender();
    }
  } catch (_) {}
}
/* ========== オフライン（Service Worker） ========== */
// 新しい版が入ったら、記録の途中でなければ読み直す
function maybeReload() {
  if (!S.updated) return;
  if (!S.day && $('#timer').hidden && !$('#sheet-root').innerHTML) location.reload();
}
// 開発中のPC（localhost）では、古いファイルが出ないように登録しない（?sw=1 で登録して試せる）
const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
if ('serviceWorker' in navigator && (!isLocal || location.search.includes('sw=1'))) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return;
    S.updated = true;
    maybeReload();
  });
}

document.addEventListener('DOMContentLoaded', boot);
