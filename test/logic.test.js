'use strict';
// 第4章のロジックの単体テスト。実行: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../logic.js');

/* ---------- テスト用の部品 ---------- */
const ex = (id, o = {}) => ({ id, name: id, cat: '多', main: '胸', aux: [], range: [8, 10], sets: 3, inc: 2.5, rest: null, memo: '', alts: [], ...o });
const set = (w, r, l = false) => ({ w, r, l });
const entry = (id, sets, orig = null) => ({ id, orig, sets });
const day = (date, list, menuId = null) => ({ date, menuId, ex: list });
const daysMap = (...ds) => Object.fromEntries(ds.map(d => [d.date, d]));
const menu = (id, list, o = {}) => ({ id, name: id, paused: false, ex: list, ...o });
const exMap = (...es) => Object.fromEntries(es.map(e => [e.id, e]));
const one = [set(50, 10)];

/* ---------- 日付 ---------- */
test('addDays は月をまたいで日付を進める', () => {
  assert.equal(L.addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(L.addDays('2026-03-01', -1), '2026-02-28');
});
test('diffDays は日数の差を返す', () => {
  assert.equal(L.diffDays('2026-11-02', '2026-10-30'), 3);
  assert.equal(L.diffDays('2026-10-11', '2026-10-11'), 0);
});
test('dateKey は端末の日付を YYYY-MM-DD にする', () => {
  assert.equal(L.dateKey(new Date(2026, 0, 5)), '2026-01-05');
});

/* ---------- 4.4 推定1RM ---------- */
test('e1RM は O\'Connor 式（重量 × (1 + 0.025 × 回数)）', () => {
  assert.equal(L.e1rm(100, 10), 125);
  assert.equal(L.e1rm(80, 8), 96);
});
test('RM表示は、10回以下かつ限界到達のセットだけ', () => {
  assert.equal(L.rmShown(set(100, 10, true)), true);
  assert.equal(L.rmShown(set(100, 11, true)), false);
  assert.equal(L.rmShown(set(100, 8, false)), false);
});
test('RM表示は、重量0や回数0のセットでは出さない', () => {
  assert.equal(L.rmShown(set(0, 8, true)), false);
  assert.equal(L.rmShown(set(50, 0, true)), false);
});

/* ---------- 4.1 実施判定 ---------- */
test('実施判定: 種目数の半分（切り上げ）以上を記録したメニューを実施とみなす', () => {
  const m = menu('A', ['a', 'b', 'c', 'd', 'e']); // 5種目 → 3種目で実施
  const two = day('2026-10-01', [entry('a', one), entry('b', one)]);
  const three = day('2026-10-02', [entry('a', one), entry('b', one), entry('c', one)]);
  assert.deepEqual(L.performedMenus(two, [m]), []);
  assert.deepEqual(L.performedMenus(three, [m]), ['A']);
});
test('実施判定: 代替種目は元の種目に換算する', () => {
  const m = menu('A', ['a', 'b']);
  const d = day('2026-10-01', [entry('x', one, 'a')]);
  assert.deepEqual(L.performedMenus(d, [m]), ['A']);
});
test('実施判定: セットが0の種目は数えない', () => {
  const m = menu('A', ['a', 'b']);
  const d = day('2026-10-01', [entry('a', []), entry('b', [])]);
  assert.deepEqual(L.performedMenus(d, [m]), []);
});
test('実施判定: 当てはまるメニューはすべて実施扱い。種目のないメニューは対象外', () => {
  const ms = [menu('A', ['a', 'b']), menu('B', ['b', 'c']), menu('E', [])];
  const d = day('2026-10-01', [entry('b', one)]);
  assert.deepEqual(L.performedMenus(d, ms), ['A', 'B']);
});
test('lastPerformed はメニューごとの最終実施日を返す', () => {
  const ms = [menu('A', ['a']), menu('B', ['b'])];
  const days = daysMap(day('2026-10-01', [entry('a', one)]), day('2026-10-05', [entry('a', one)]));
  assert.deepEqual(L.lastPerformed(days, ms), { A: '2026-10-05' });
});

/* ---------- 4.1 おすすめ ---------- */
const ROT = [menu('A', ['a']), menu('B', ['b']), menu('C', ['c'])];
test('方式1: 最終実施日が一番古いメニューをすすめる', () => {
  const days = daysMap(day('2026-10-01', [entry('b', one)]), day('2026-10-03', [entry('c', one)]), day('2026-10-05', [entry('a', one)]));
  assert.equal(L.recommend(ROT, days, 1), 'B');
});
test('方式1: 一度も実施していないメニューを、並び順で優先する', () => {
  const days = daysMap(day('2026-10-01', [entry('a', one)]));
  assert.equal(L.recommend(ROT, days, 1), 'B');
  assert.equal(L.recommend(ROT, {}, 1), 'A');
});
test('方式1: 休止中のメニューと、種目のないメニューはすすめない', () => {
  const ms = [menu('A', ['a'], { paused: true }), menu('E', []), menu('B', ['b'])];
  assert.equal(L.recommend(ms, {}, 1), 'B');
});
test('方式2: 最後に実施したメニューの次を、並び順で循環してすすめる', () => {
  const afterA = daysMap(day('2026-10-01', [entry('a', one)]));
  const afterC = daysMap(day('2026-10-01', [entry('a', one)]), day('2026-10-03', [entry('c', one)]));
  assert.equal(L.recommend(ROT, afterA, 2), 'B');
  assert.equal(L.recommend(ROT, afterC, 2), 'A');
});
test('方式2: 休止中のメニューは飛ばす', () => {
  const ms = [menu('A', ['a']), menu('B', ['b'], { paused: true }), menu('C', ['c'])];
  const days = daysMap(day('2026-10-01', [entry('a', one)]));
  assert.equal(L.recommend(ms, days, 2), 'C');
});
test('方式2: 実施がまだなければ、最初の休止していないメニュー', () => {
  assert.equal(L.recommend(ROT, {}, 2), 'A');
});
test('方式2: 同じ日に複数のメニューを実施していたら、並び順で後ろを「最後」とする', () => {
  const days = daysMap(day('2026-10-01', [entry('a', one), entry('b', one)]));
  assert.equal(L.recommend(ROT, days, 2), 'C');
});
test('おすすめ: すすめられるメニューがなければ null', () => {
  assert.equal(L.recommend([], {}, 1), null);
  assert.equal(L.recommend([menu('A', ['a'], { paused: true })], {}, 2), null);
});

/* ---------- 4.3 前回値と直近3回 ---------- */
test('履歴は、その種目IDの記録を新しい順に返す', () => {
  const days = daysMap(
    day('2026-10-01', [entry('a', [set(50, 10)])]),
    day('2026-10-03', [entry('b', one)]),
    day('2026-10-05', [entry('a', [set(52.5, 9)])]),
  );
  const h = L.historyOf(days, 'a', null, 3);
  assert.deepEqual(h.map(x => x.date), ['2026-10-05', '2026-10-01']);
  assert.deepEqual(h[0].sets, [set(52.5, 9)]);
});
test('履歴: 代替種目は自分の履歴だけ。元の種目には混ぜない', () => {
  const days = daysMap(day('2026-10-01', [entry('a', one)]), day('2026-10-03', [entry('x', [set(20, 12)], 'a')]));
  assert.deepEqual(L.historyOf(days, 'a', null, 3).map(x => x.date), ['2026-10-01']);
  assert.deepEqual(L.historyOf(days, 'x', null, 3).map(x => x.date), ['2026-10-03']);
});
test('履歴: 開いている日より前だけを対象にし、件数で切る。セット0の記録は飛ばす', () => {
  const days = daysMap(
    day('2026-10-01', [entry('a', one)]), day('2026-10-02', [entry('a', one)]), day('2026-10-03', [entry('a', [])]),
    day('2026-10-04', [entry('a', one)]), day('2026-10-05', [entry('a', one)]), day('2026-10-06', [entry('a', one)]),
  );
  assert.deepEqual(L.historyOf(days, 'a', '2026-10-06', 3).map(x => x.date), ['2026-10-05', '2026-10-04', '2026-10-02']);
});
test('セットの要約: 重量が全セット同じなら「35kg 15/12/12」', () => {
  assert.equal(L.fmtSets([set(35, 15), set(35, 12), set(35, 12)]), '35kg 15/12/12');
  assert.equal(L.fmtSets([set(2.5, 12)]), '2.5kg 12');
});
test('セットの要約: 重量が違えば「35×15, 40×10」', () => {
  assert.equal(L.fmtSets([set(35, 15), set(40, 10)]), '35×15, 40×10');
});
test('履歴の1行は日付付き', () => {
  assert.equal(L.fmtHist({ date: '2026-10-08', sets: [set(35, 15), set(35, 12)] }), '10/8 35kg 15/12');
});

/* ---------- 4.2 重量提案 ---------- */
const E = ex('a', { range: [8, 10], sets: 3, inc: 2.5 });
test('提案: セット数を満たし、全セットがレンジ上限以上なら増量', () => {
  const s = L.suggest(E, { date: '2026-10-01', sets: [set(50, 10), set(50, 10), set(50, 11)] });
  assert.equal(s.kind, 'up');
  assert.equal(s.text, '増量: +2.5kg');
});
test('提案: 1セットでも上限に届かなければ、同じ重量で回数を伸ばす', () => {
  const s = L.suggest(E, { date: '2026-10-01', sets: [set(50, 10), set(50, 10), set(50, 9)] });
  assert.equal(s.kind, 'same');
  assert.equal(s.text, '同じ重量で回数を伸ばす');
});
test('提案: 記録セット数が種目のセット数より少なければ増量しない', () => {
  assert.equal(L.suggest(E, { date: '2026-10-01', sets: [set(50, 10), set(50, 10)] }).kind, 'same');
});
test('提案: 増量幅0の種目は「回数を伸ばす」だけ', () => {
  const s = L.suggest(ex('a', { inc: 0 }), { date: '2026-10-01', sets: [set(0, 10), set(0, 10), set(0, 10)] });
  assert.equal(s.kind, 'reps');
  assert.equal(s.text, '回数を伸ばす');
});
test('提案: 履歴がなければ「初回」', () => {
  assert.equal(L.suggest(E, undefined).kind, 'first');
});

/* ---------- 3.2 セット追加の初期値 ---------- */
test('セット追加: 同日の前セットの重量と回数を引き継ぎ、限界到達はオフ', () => {
  assert.deepEqual(L.nextSet([set(50, 10), set(52.5, 8, true)], { sets: [set(40, 12)] }, E), set(52.5, 8, false));
});
test('セット追加: 1セット目は、前回のその種目の1セット目の値', () => {
  assert.deepEqual(L.nextSet([], { sets: [set(40, 12, true), set(40, 10)] }, E), set(40, 12, false));
});
test('セット追加: 履歴がなければ重量0、回数はレンジ下限', () => {
  assert.deepEqual(L.nextSet([], undefined, E), set(0, 8, false));
});

/* ---------- 4.6 部位別の週セット数 ---------- */
const EXS = exMap(
  ex('bench', { main: '胸', aux: ['上腕三頭'], sets: 3 }),
  ex('row', { main: '背中', aux: ['上腕二頭'], sets: 3 }),
  ex('curl', { main: '上腕二頭', aux: [], sets: 2, cat: '単' }),
  ex('pd', { main: '上腕三頭', aux: [], sets: 2, cat: '単' }),
);
test('週セット数: 主働筋に1、補助筋に0.5', () => {
  const days = daysMap(day('2026-10-10', [entry('bench', [set(70, 10), set(70, 9), set(70, 8)]), entry('pd', [set(30, 12)])]));
  const a = L.weeklyActual(days, EXS, '2026-10-11');
  assert.equal(a.totals['胸'], 3);
  assert.equal(a.totals['上腕三頭'], 2.5);
  assert.equal(a.totals['背中'], 0);
});
test('週セット数: 直近7日（今日を含む）だけを数える', () => {
  const days = daysMap(
    day('2026-10-04', [entry('bench', one)]), // 7日前 → 対象外
    day('2026-10-05', [entry('bench', one)]), // 6日前 → 対象
    day('2026-10-11', [entry('bench', one)]), // 今日 → 対象
    day('2026-10-12', [entry('bench', one)]), // 明日 → 対象外
  );
  assert.equal(L.weeklyActual(days, EXS, '2026-10-11').totals['胸'], 2);
});
test('週セット数: 代替種目は、実際にやった種目の部位で数える', () => {
  const days = daysMap(day('2026-10-10', [entry('curl', [set(10, 12), set(10, 10)], 'row')]));
  const a = L.weeklyActual(days, EXS, '2026-10-11');
  assert.equal(a.totals['上腕二頭'], 2);
  assert.equal(a.totals['背中'], 0);
});
test('週セット数: 部位ごとの内訳（種目、セット数、係数）を返す', () => {
  const days = daysMap(day('2026-10-09', [entry('row', one)]), day('2026-10-10', [entry('row', one), entry('curl', one)]));
  assert.deepEqual(L.weeklyActual(days, EXS, '2026-10-11').detail['上腕二頭'], [
    { id: 'row', sets: 2, coef: 0.5, log: [{ date: '2026-10-09', sets: one }, { date: '2026-10-10', sets: one }] },
    { id: 'curl', sets: 1, coef: 1, log: [{ date: '2026-10-10', sets: one }] },
  ]);
});
test('目標を出す部位: 休止していないメニューに、主働筋の種目がある部位だけ', () => {
  const ms = [menu('A', ['bench', 'pd']), menu('B', ['row', 'curl'], { paused: true })];
  assert.deepEqual([...L.targetMuscles(ms, EXS)].sort(), ['上腕三頭', '胸'].sort());
});
test('計画値: セット数 × 係数 の合計に、週N回 ÷ 休止していないメニュー数 を掛ける', () => {
  const ms = [menu('A', ['bench', 'pd']), menu('B', ['row', 'curl'])];
  const p = L.weeklyPlan(ms, EXS, 3); // 3 ÷ 2 = 1.5
  assert.equal(p['胸'], 4.5);
  assert.equal(p['上腕三頭'], (1.5 + 2) * 1.5);
  assert.equal(p['上腕二頭'], (1.5 + 2) * 1.5);
  assert.equal(p['腹筋'], 0);
});
test('計画値: 休止中のメニューは計算から外す。全部休止なら0', () => {
  const ms = [menu('A', ['bench']), menu('B', ['row'], { paused: true })];
  assert.equal(L.weeklyPlan(ms, EXS, 3)['胸'], 9);
  assert.equal(L.weeklyPlan(ms, EXS, 3)['背中'], 0);
  assert.equal(L.weeklyPlan([menu('B', ['row'], { paused: true })], EXS, 3)['背中'], 0);
});
test('色分け: 4未満 / 4〜目標未満 / 目標以上 の3段階（0は実績なし）', () => {
  assert.equal(L.level(0, 10), 0);
  assert.equal(L.level(3.5, 10), 1);
  assert.equal(L.level(4, 10), 2);
  assert.equal(L.level(9.5, 10), 2);
  assert.equal(L.level(10, 10), 3);
  assert.equal(L.level(6, 6), 3);
});
test('人体図の細かい段階: 0 / 1〜3 / 4〜5 / 6〜7 / 8〜9 / 目標到達', () => {
  const t = n => L.tier(n, 10);
  assert.deepEqual([0, 3.5, 4, 5.5, 6, 7.5, 8, 9.5, 10, 12].map(t), [0, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(L.tier(6, 6), 5);   // 目標が小さい部位は、目標に着いた時点で到達
  assert.equal(L.tier(4.5, 6), 2);
});
test('色分けの表示名', () => {
  assert.equal(L.levelLabel(0, 10), '最小有効量未満');
  assert.equal(L.levelLabel(4, 10), '中間');
  assert.equal(L.levelLabel(12, 10), '目標到達');
});

/* ---------- 4.7 コピー ---------- */
test('日のコピー: 同じ種目があれば末尾に追加し、なければ種目ごと足す', () => {
  const target = day('2026-10-11', [entry('a', [set(50, 10)])], 'A');
  const source = day('2026-10-01', [entry('a', [set(45, 12)]), entry('b', [set(20, 15), set(20, 14)])], 'B');
  const out = L.copyDay(target, source);
  assert.deepEqual(out.ex, [entry('a', [set(50, 10), set(45, 12)]), entry('b', [set(20, 15), set(20, 14)])]);
  assert.equal(out.menuId, 'A');
});
test('日のコピー: 回数と重量は元のまま、限界到達はオフに戻す。代替の元種目は引き継ぐ', () => {
  const out = L.copyDay(day('2026-10-11', []), day('2026-10-01', [entry('x', [set(20, 12, true)], 'a')], 'B'));
  assert.deepEqual(out.ex, [entry('x', [set(20, 12, false)], 'a')]);
});
test('日のコピー: コピー先が空なら、コピー元のメニューを引き継ぐ', () => {
  assert.equal(L.copyDay(day('2026-10-11', []), day('2026-10-01', [entry('a', one)], 'B')).menuId, 'B');
});
test('日のコピー: コピー元もコピー先も書き換えない。セット0の種目はコピーしない', () => {
  const target = day('2026-10-11', [entry('a', [set(50, 10)])]);
  const source = day('2026-10-01', [entry('a', [set(45, 12)]), entry('c', [])]);
  const out = L.copyDay(target, source);
  out.ex[0].sets[1].r = 99;
  assert.equal(target.ex[0].sets.length, 1);
  assert.equal(source.ex[0].sets[0].r, 12);
  assert.equal(out.ex.length, 1);
});
test('種目のコピー: その種目の末尾にセットを足す', () => {
  const target = day('2026-10-11', [entry('a', []), entry('b', [set(20, 15)])]);
  const out = L.copyExercise(target, 1, [set(22.5, 12, true)]);
  assert.deepEqual(out.ex[1].sets, [set(20, 15), set(22.5, 12, false)]);
  assert.equal(target.ex[1].sets.length, 1);
});

/* ---------- 4.8 インターバルの基準値 ---------- */
test('インターバル: 区分の基準値を使い、種目の上書きがあればそちらを使う', () => {
  const cfg = L.defaultSettings();
  assert.equal(L.restFor(ex('a', { cat: '多' }), cfg), 150);
  assert.equal(L.restFor(ex('a', { cat: '単' }), cfg), 105);
  assert.equal(L.restFor(ex('a', { cat: 'カ腹' }), cfg), 75);
  assert.equal(L.restFor(ex('a', { cat: '多', rest: 180 }), cfg), 180);
});

/* ---------- 集計の小物 ---------- */
test('日の合計: 記録のある種目数、セット数、総レップ数', () => {
  const d = day('2026-10-11', [entry('a', [set(50, 10), set(50, 8)]), entry('b', [])]);
  assert.deepEqual(L.dayTotals(d), { ex: 1, sets: 2, reps: 18 });
});
test('実施日: 1セット以上ある日だけ', () => {
  const days = daysMap(day('2026-10-01', [entry('a', one)]), day('2026-10-02', [entry('a', [])]));
  assert.deepEqual([...L.doneDates(days)], ['2026-10-01']);
});
test('使用回数: 種目ごとに、記録のある日数を数える', () => {
  const days = daysMap(day('2026-10-01', [entry('a', one), entry('b', [])]), day('2026-10-02', [entry('a', one)]));
  assert.deepEqual(L.usage(days), { a: 2 });
});
test('部位ごとの最終実施日（主働筋で見る）', () => {
  const days = daysMap(day('2026-10-01', [entry('bench', one)]), day('2026-10-05', [entry('bench', one), entry('row', one)]));
  assert.deepEqual(L.lastDoneByMuscle(days, EXS), { 胸: '2026-10-05', 背中: '2026-10-05' });
});
test('増量幅の%と、2〜10%の目安から外れたときの注意', () => {
  assert.equal(L.incPercent(2.5, 50), 5);
  assert.equal(L.incPercent(2.5, 0), null);
  assert.equal(L.incOutOfRange(5), false);
  assert.equal(L.incOutOfRange(1.9), true);
  assert.equal(L.incOutOfRange(12.5), true);
  assert.equal(L.incOutOfRange(null), false);
});
test('バックアップの催促: 前回の保存から30日以上で出す', () => {
  assert.equal(L.backupDue('2026-09-11', '2026-09-01', '2026-10-11'), true);
  assert.equal(L.backupDue('2026-09-12', '2026-09-01', '2026-10-11'), false);
});
test('バックアップの催促: 一度も保存していなければ、最初の記録日から数える。記録がなければ出さない', () => {
  assert.equal(L.backupDue(null, '2026-09-01', '2026-10-11'), true);
  assert.equal(L.backupDue(null, '2026-10-01', '2026-10-11'), false);
  assert.equal(L.backupDue(null, null, '2026-10-11'), false);
});

/* ---------- 4.9 バックアップ ---------- */
function sampleState() {
  const exercises = exMap(
    ex('bench', { name: 'ベンチプレス', main: '胸', aux: ['上腕三頭'], alts: ['db'] }),
    ex('db', { name: 'ダンベルベンチ', main: '胸', aux: ['上腕三頭'], inc: 2 }),
    ex('curl', { name: 'カール, "EZ"', cat: '単', main: '上腕二頭', range: [10, 12], sets: 2, rest: 90, memo: '幅は肩幅' }),
  );
  const settings = L.defaultSettings();
  settings.freq = 4; settings.lastBackup = '2026-10-01'; settings.hide['腹筋'] = true; settings.target['胸'] = 12;
  return {
    exercises,
    menus: [menu('A', ['bench', 'curl'], { name: '上半身A' }), menu('B', ['curl'], { name: '腕', paused: true })],
    days: daysMap(
      day('2026-10-08', [entry('bench', [set(70, 10, true), set(70, 9)]), entry('curl', [set(25, 12, true)])], 'A'),
      day('2026-10-10', [entry('db', [set(24, 8, true)], 'bench')]),
    ),
    settings,
  };
}
test('バックアップ: 書き出して読み戻すと、元と同じ内容になる', () => {
  const st = sampleState();
  const text = JSON.stringify(L.makeBackup(st, '2026-10-11T09:00:00.000Z'));
  assert.deepEqual(L.parseBackup(text), st);
});
test('バックアップ: メニュー、種目、記録、設定を1ファイルに含む', () => {
  const b = L.makeBackup(sampleState(), '2026-10-11T09:00:00.000Z');
  assert.equal(b.format, 'kintore-backup');
  assert.equal(b.version, 1);
  assert.equal(b.exportedAt, '2026-10-11T09:00:00.000Z');
  assert.deepEqual(b.menus.map(m => m.name), ['上半身A', '腕']);
  assert.equal(b.exercises.length, 3);
  assert.deepEqual(b.days.map(d => d.date), ['2026-10-08', '2026-10-10']);
  assert.equal(b.settings.freq, 4);
});
test('復元: JSONでないファイル、形式の違うファイルは読み込まない', () => {
  assert.throws(() => L.parseBackup('こんにちは'), /読めません/);
  assert.throws(() => L.parseBackup('{"format":"other"}'), /バックアップではありません/);
  assert.throws(() => L.parseBackup(JSON.stringify({ format: 'kintore-backup', version: 99 })), /版/);
});
test('復元: 存在しない種目を指すメニューや記録は、理由を示して読み込まない', () => {
  const b = L.makeBackup(sampleState(), 'x');
  const badMenu = JSON.parse(JSON.stringify(b)); badMenu.menus[0].ex.push('nothing');
  const badDay = JSON.parse(JSON.stringify(b)); badDay.days[0].ex[0].id = 'nothing';
  const badAlt = JSON.parse(JSON.stringify(b)); badAlt.exercises[0].alts = ['nothing'];
  assert.throws(() => L.parseBackup(JSON.stringify(badMenu)), /nothing/);
  assert.throws(() => L.parseBackup(JSON.stringify(badDay)), /nothing/);
  assert.throws(() => L.parseBackup(JSON.stringify(badAlt)), /nothing/);
});
test('復元: 部位や区分が不正な種目は読み込まない', () => {
  const b = L.makeBackup(sampleState(), 'x');
  const badMain = JSON.parse(JSON.stringify(b)); badMain.exercises[0].main = '前腕';
  const badRange = JSON.parse(JSON.stringify(b)); badRange.exercises[0].range = [12, 8];
  assert.throws(() => L.parseBackup(JSON.stringify(badMain)), /ベンチプレス/);
  assert.throws(() => L.parseBackup(JSON.stringify(badRange)), /ベンチプレス/);
});
test('復元: 省略された項目は初期値で補う（seed.json は記録と設定を省ける）', () => {
  const text = JSON.stringify({
    format: 'kintore-backup', version: 1,
    exercises: [{ id: 'a', name: 'A', cat: '多', main: '胸', range: [8, 10], sets: 3, inc: 2.5 }],
    menus: [{ id: 'm', name: 'M', ex: ['a'] }],
  });
  const st = L.parseBackup(text);
  assert.deepEqual(st.exercises.a, { id: 'a', name: 'A', cat: '多', main: '胸', aux: [], range: [8, 10], sets: 3, inc: 2.5, rest: null, memo: '', alts: [] });
  assert.deepEqual(st.menus, [{ id: 'm', name: 'M', paused: false, ex: ['a'] }]);
  assert.deepEqual(st.days, {});
  assert.deepEqual(st.settings, L.defaultSettings());
});
test('設定の初期値: 週3回、方式1、基準値150/105/75秒、目標は全部位10', () => {
  const s = L.defaultSettings();
  assert.equal(s.freq, 3);
  assert.equal(s.method, 1);
  assert.equal(s.lastBackup, null);
  assert.deepEqual(s.rest, { 多: 150, 単: 105, カ腹: 75 });
  assert.equal(Object.keys(s.target).length, 10);
  assert.ok(Object.values(s.target).every(v => v === 10));
});

/* ---------- 4.9 CSV ---------- */
test('CSV: 日本語ヘッダー、BOMなし、1行が1セット', () => {
  const lines = L.toCsv(sampleState()).split('\n');
  assert.equal(lines[0], '日付,メニュー,種目,代替元の種目,主働筋,セット,重量kg,回数,限界到達,推定1RM');
  assert.equal(lines[0].charCodeAt(0), '日'.charCodeAt(0));
  assert.equal(lines.length, 1 + 4);
});
test('CSV: 推定1RMは、10回以下かつ限界到達のセットだけ', () => {
  const lines = L.toCsv(sampleState()).split('\n');
  assert.equal(lines[1], '2026-10-08,上半身A,ベンチプレス,,胸,1,70,10,1,87.5');
  assert.equal(lines[2], '2026-10-08,上半身A,ベンチプレス,,胸,2,70,9,0,');
});
test('CSV: カンマや引用符を含む名前は、引用符で囲む。12回のセットは推定1RMなし', () => {
  const lines = L.toCsv(sampleState()).split('\n');
  assert.equal(lines[3], '2026-10-08,上半身A,"カール, ""EZ""",,上腕二頭,1,25,12,1,');
});
test('CSV: 代替の行には元の種目名が入る。メニューなしの日は実施判定のメニュー名', () => {
  const lines = L.toCsv(sampleState()).split('\n');
  assert.equal(lines[4], '2026-10-10,上半身A,ダンベルベンチ,ベンチプレス,胸,1,24,8,1,28.8');
});

/* ---------- 初期メニュー（seed.json はリポジトリに置かない。あるときだけ検査する） ---------- */
const seedPath = path.join(__dirname, '..', 'seed.json');
test('seed.json: バックアップと同じ形式で読め、付録Aのとおりの3メニュー', { skip: !fs.existsSync(seedPath) }, () => {
  const st = L.parseBackup(fs.readFileSync(seedPath, 'utf8'));
  assert.deepEqual(st.menus.map(m => m.name), ['上半身A', '下半身', '上半身B']);
  assert.deepEqual(st.menus.map(m => m.ex.length), [6, 4, 6]);
  assert.deepEqual(st.menus[1].ex.map(id => st.exercises[id].name), ['ハックスクワット', 'レッグエクステンション', 'カーフレイズ', '腹筋（マシン）']);
  assert.deepEqual(st.days, {});
  const byName = Object.fromEntries(Object.values(st.exercises).map(e => [e.name, e]));
  assert.equal(byName['ハックスクワット'].inc, 5);
  assert.equal(byName['ハーフデッドリフト'].inc, 5);
  assert.equal(byName['サイドレイズ'].inc, 1);
  assert.deepEqual(byName['ハーフデッドリフト'].range, [6, 8]);
  assert.deepEqual(byName['レッグエクステンション'].alts, []);
  assert.deepEqual(byName['懸垂'].alts.map(id => st.exercises[id].name), ['ラットプルダウン']);
  assert.deepEqual(byName['ラットプルダウン'].alts.map(id => st.exercises[id].name), ['懸垂']);
});
test('seed.json: 計画値は付録Aの数字と合う（週3回、3メニュー）', { skip: !fs.existsSync(seedPath) }, () => {
  const st = L.parseBackup(fs.readFileSync(seedPath, 'utf8'));
  const p = L.weeklyPlan(st.menus, st.exercises, 3);
  assert.equal(p['胸'], 9);            // ベンチ3 + インクライン3 + インクラインDB3
  assert.equal(p['背中'], 9);          // ロウ3 + ハーフデッド3 + 懸垂3
  assert.equal(p['大腿四頭'], 5);      // ハック3 + レッグエクステンション2
  assert.equal(p['上腕三頭'], 2 + 4.5); // プレスダウン2 + ベンチ系9×0.5
  assert.equal(p['上腕二頭'], 4 + 3);   // カール2+2 + ロウ・懸垂6×0.5
  assert.equal(p['ハムストリングス'], 3); // レッグカールだけ。ハーフデッド（膝の高さから）は数えない
});

/* ---------- 版とキャッシュの食い違い防止 ---------- */
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
test('app.js の版（BUILD）と sw.js のキャッシュ名が一致している', () => {
  const build = read('app.js').match(/const BUILD = '([^']+)'/)[1];
  const cache = read('sw.js').match(/const CACHE = 'kintore-([^']+)'/)[1];
  assert.equal(cache, build);
});
test('index.html が読むスクリプトとスタイルは、すべて sw.js のキャッシュ対象に入っている', () => {
  const html = read('index.html');
  const used = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).concat([...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]));
  const files = read('sw.js').match(/const FILES = \[([^\]]+)\]/)[1];
  used.forEach(f => assert.ok(files.includes(`'${f}'`), `${f} が sw.js の FILES にない`));
  assert.ok(used.includes('logic.js'));
});

/* ---------- プリセット種目（メニューを一から作る道） ---------- */
const P = [
  ['ベンチ', '多', '胸', '上腕三頭', 8, 10, 3, 2.5, ['ダンベルベンチ', 'スミス']],
  ['ダンベルベンチ', '多', '胸', '上腕三頭', 8, 10, 3, 2],
  ['スミス', '多', '胸', null, 8, 10, 3, 2.5],
  ['懸垂', '多', '背中', '上腕二頭', 8, 10, 3, 2.5, ['ラット']],
  ['ラット', '多', '背中', '上腕二頭', 8, 10, 3, 2.5, ['懸垂']],
];
const counter = () => { let n = 0; return () => 'n' + (++n); };
test('プリセットの1行を種目の形にする', () => {
  assert.deepEqual(L.presetExercise(P[0]), { name: 'ベンチ', cat: '多', main: '胸', aux: ['上腕三頭'], range: [8, 10], sets: 3, inc: 2.5, rest: null, memo: '', alts: [] });
  assert.deepEqual(L.presetExercise(P[2]).aux, []);
});
test('プリセットを選ぶと、代替種目も一緒に種目になり、IDでつながる', () => {
  const r = L.materialize('ベンチ', P, {}, counter());
  assert.deepEqual(r.added.map(e => e.name), ['ベンチ', 'ダンベルベンチ', 'スミス']);
  const bench = r.added[0];
  assert.equal(r.id, bench.id);
  assert.deepEqual(bench.alts, [r.added[1].id, r.added[2].id]);
});
test('プリセット: 同じ名前の種目がすでにあれば作らず、それを代替につなぐ', () => {
  const have = exMap(ex('old', { name: 'ダンベルベンチ' }));
  const r = L.materialize('ベンチ', P, have, counter());
  assert.deepEqual(r.added.map(e => e.name), ['ベンチ', 'スミス']);
  assert.equal(r.added[0].alts[0], 'old');
  assert.deepEqual(Object.keys(have), ['old']);
});
test('プリセット: すでにある種目を選んだら、何も作らずそのIDを返す', () => {
  const r = L.materialize('スミス', P, exMap(ex('s1', { name: 'スミス' })), counter());
  assert.deepEqual(r, { id: 's1', added: [] });
});
test('プリセット: 互いを代替に持つ種目（懸垂とラットプルダウン）でも止まる', () => {
  const r = L.materialize('懸垂', P, {}, counter());
  assert.deepEqual(r.added.map(e => e.name), ['懸垂', 'ラット']);
  assert.deepEqual(r.added[1].alts, [r.added[0].id]);
  assert.deepEqual(r.added[0].alts, [r.added[1].id]);
});
test('presets.js: 名前の重複がなく、区分と部位が正しく、代替はすべてプリセットにある', () => {
  const presets = new Function(read('presets.js') + '; return EX_PRESETS;')();
  const names = presets.map(p => p[0]);
  assert.equal(new Set(names).size, names.length);
  presets.forEach(p => {
    assert.ok(L.CATS.includes(p[1]), p[0]);
    assert.ok(L.MUSCLES.includes(p[2]), p[0]);
    assert.ok(p[3] === null || L.MUSCLES.includes(p[3]), p[0]);
    assert.ok(p[4] >= 1 && p[5] >= p[4] && p[6] >= 1 && p[7] >= 0, p[0]);
    (p[8] || []).forEach(a => assert.ok(names.includes(a), `${p[0]} の代替 ${a} がない`));
  });
});
test('presets.js: 付録Aの16種目と付録Bの代替が入っていて、一から同じメニューを作れる', () => {
  const presets = new Function(read('presets.js') + '; return EX_PRESETS;')();
  const need = ['ベンチプレス', 'インクラインベンチ', 'チェストサポートロウ', 'サイドレイズ', 'プレスダウン', 'インクラインダンベルカール', 'ハックスクワット', 'レッグエクステンション', 'カーフレイズ', '腹筋（マシン）', 'ハーフデッドリフト', '懸垂', 'インクラインダンベルプレス', 'リアデルト', 'レッグカール', 'EZバーカール'];
  let exs = {};
  const mk = counter();
  need.forEach(n => { L.materialize(n, presets, exs, mk).added.forEach(e => { exs[e.id] = e; }); });
  const byName = Object.fromEntries(Object.values(exs).map(e => [e.name, e]));
  need.forEach(n => assert.ok(byName[n], n));
  const alts = n => byName[n].alts.map(id => exs[id].name);
  assert.deepEqual(alts('ハックスクワット'), ['レッグプレス', 'スミススクワット', 'ダンベルのブルガリアンスクワット']);
  assert.deepEqual(alts('懸垂'), ['ラットプルダウン']);
  assert.deepEqual(alts('レッグエクステンション'), []);
  assert.equal(byName['ハーフデッドリフト'].inc, 5);
  assert.equal(byName['サイドレイズ'].inc, 1);
  assert.equal(Object.keys(exs).length, 16 + 26);
  // ハーフデッドリフトは膝の高さから引く形（ユーザー確認済み）。ハムストリングスには数えない
  assert.deepEqual(byName['ハーフデッドリフト'].aux, []);
  assert.deepEqual(byName['ラックプル'].aux, []);
  assert.equal(byName['ルーマニアンデッドリフト'].main, 'ハムストリングス');
  assert.deepEqual(byName['ルーマニアンデッドリフト'].aux, ['背中']);
});

/* ---------- カレンダーの月移動（ボタンとスワイプで共通） ---------- */
test('月の移動: 年をまたいで前後に動く', () => {
  assert.deepEqual(L.shiftMonth({ y: 2026, m: 9 }, 1), { y: 2026, m: 10 });
  assert.deepEqual(L.shiftMonth({ y: 2026, m: 11 }, 1), { y: 2027, m: 0 });
  assert.deepEqual(L.shiftMonth({ y: 2026, m: 0 }, -1), { y: 2025, m: 11 });
});
test('スワイプの向き: 左へ払うと次の月、右へ払うと前の月。短い動きや縦の動きは無視', () => {
  assert.equal(L.swipeDir(-80, 10), 1);
  assert.equal(L.swipeDir(80, -10), -1);
  assert.equal(L.swipeDir(-30, 0), 0);
  assert.equal(L.swipeDir(-80, 70), 0);
});

/* ---------- AI に貼るためのメニュー文章 ---------- */
test('メニュー文章: 休止中は除き、種目・レンジ×セット数・直近の記録を含む', () => {
  const bench = ex('ベンチ'), row = ex('ロウ', { main: '背中', range: [10, 10] });
  const ms = [menu('A', ['ベンチ', 'ロウ'], { name: '胸の日' }), menu('B', ['ベンチ'], { name: '休止の日', paused: true })];
  const days = daysMap(day('2026-10-01', [entry('ベンチ', [set(50, 10)])]), day('2026-10-10', [entry('ベンチ', [set(60, 10), set(60, 9), set(60, 8)])]), day('2026-09-20', [entry('ベンチ', [set(45, 10)])]), day('2026-09-10', [entry('ベンチ', [set(40, 10)])]));
  assert.equal(L.menuText(ms, exMap(bench, row), days),
    '■ 胸の日\n・ベンチ 8-10回×3セット　直近: 10/10 60kg 10/9/8 ／ 10/1 50kg 10 ／ 9/20 45kg 10\n・ロウ 10回×3セット　直近: 記録なし');
});
test('メニュー文章: 使えるメニューがなければ空文字', () => {
  assert.equal(L.menuText([], {}, {}), '');
  assert.equal(L.menuText([menu('A', ['x'], { paused: true })], exMap(ex('x')), {}), '');
});
