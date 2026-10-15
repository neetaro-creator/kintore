'use strict';
/* ========== 人体図（自作SVG・様式化） ========== */
// 前面と背面を1枚に横並びで描く。座標は片面 240x420、中心 x=120。m:1 は左右反転コピーも描く。
const rr = (x, y, w, h, r) => `M${x + r} ${y}h${w - 2 * r}q${r} 0 ${r} ${r}v${h - 2 * r}q0 ${r} ${-r} ${r}h${-(w - 2 * r)}q${-r} 0 ${-r} ${-r}v${-(h - 2 * r)}q0 ${-r} ${r} ${-r}z`;
const HEAD = 'M120 8C130 8 135.5 17 135 29C134.5 40 128 50 120 50C112 50 105.5 40 105 29C104.5 17 110 8 120 8Z';
const DELT = 'M90 71C77 66 62 72 57 88C54 100 55 112 59 123L72 119C73 105 80 93 92 86Q93 78 90 71Z';
const ARM_UP = 'M58 125Q65 120 73 120C79 135 79 152 72 168Q64 172 57 167C51 152 52 137 58 125Z';
const FOREARM = 'M56 170Q64 175 72 171C74 191 70 212 62 230L49 228C46 208 49 187 56 170Z';
const HAND = 'M49 231L62 233Q64 246 58 255Q50 256 46 246Z';
const KNEE = 'M93 317Q104 324 116 315L115 331Q105 337 95 333Z';
const FOOT = 'M100 393L113 393L117 407Q106 410 95 407Z';
const FIG = {
  front: {
    neutral: [
      { d: HEAD },
      { d: 'M111 46Q120 53 129 46L131 60Q120 66 109 60Z' },
      { d: FOREARM, m: 1 }, { d: HAND, m: 1 },
      { d: 'M81 116Q88 129 104 132L104 205L90 200C86 172 80 145 81 116Z', m: 1 },
      { d: 'M90 202L104 207Q120 214 136 207L150 202L157 232Q140 248 120 252Q100 248 83 232Z' },
      { d: KNEE, m: 1 }, { d: FOOT, m: 1 },
    ],
    muscles: {
      背中: [{ d: 'M109 58Q99 66 87 71Q100 75 118 74L118 66Q112 63 109 58Z', m: 1 }], // 僧帽筋
      胸: [{ d: 'M118 77Q104 77 93 87C84 95 80 104 81 113Q88 127 104 129Q113 129 118 124Z', m: 1 }],
      三角筋側部: [{ d: DELT, m: 1 }],
      上腕二頭: [{ d: ARM_UP, m: 1 }],
      腹筋: [{ d: rr(106.5, 134, 11.5, 15, 3) + rr(106.5, 152, 11.5, 15, 3) + rr(106.5, 170, 11.5, 15, 3) + 'M109.5 188h8.5v18q-7 -2 -11 -9v-6q0 -3 2.5 -3z', m: 1 }],
      大腿四頭: [{ d: 'M83 234C76 250 78 284 92 315Q104 322 116 313L119 251Q100 247 83 234Z', m: 1 }],
      ふくらはぎ: [{ d: 'M95 335Q105 339 115 333C117 354 115 374 112 391L101 391C93 374 89 354 95 335Z', m: 1 }],
    },
    lines: [
      { d: 'M71 80Q63 96 63 114', m: 1 }, { d: 'M100 256Q96 286 104 312', m: 1 }, { d: 'M88 262Q86 288 95 308', m: 1 },
      { d: 'M104 342Q101 364 106 388', m: 1 },
    ],
  },
  back: {
    neutral: [
      { d: HEAD },
      { d: 'M110 46Q120 50 130 46L132 57Q120 60 108 57Z' },
      { d: FOREARM, m: 1 }, { d: HAND, m: 1 },
      { d: 'M120 199L100 199Q86 214 86 236Q102 252 120 247Z', m: 1 },
      { d: KNEE, m: 1 }, { d: FOOT, m: 1 },
    ],
    muscles: {
      背中: [
        { d: 'M120 55L108 58Q99 66 87 72L93 88Q109 98 120 126Z', m: 1 },
        { d: 'M93 90Q110 100 120 128L120 197L100 197C90 176 81 150 81 120Q83 100 93 90Z', m: 1 },
      ],
      三角筋後部: [{ d: DELT, m: 1 }],
      上腕三頭: [{ d: ARM_UP, m: 1 }],
      ハムストリングス: [{ d: 'M86 240Q102 255 119 250L116 313Q104 322 92 315C79 286 78 262 86 240Z', m: 1 }],
      ふくらはぎ: [{ d: 'M94 334Q105 339 116 333C120 352 117 372 112 391L101 391C91 372 87 352 94 334Z', m: 1 }],
    },
    lines: [
      { d: 'M120 58L120 197' }, { d: 'M97 98Q104 112 114 120', m: 1 }, { d: 'M100 150Q108 168 118 178', m: 1 },
      { d: 'M71 80Q63 96 63 114', m: 1 }, { d: 'M62 132Q66 148 61 164', m: 1 },
      { d: 'M104 258Q102 288 106 312', m: 1 }, { d: 'M105 340Q102 364 106 388', m: 1 },
    ],
  },
};
const FIG_Y = 0.92;
// 色分けの段階（L.tier）→ グラデーション番号。5 は g1 と g2 の中間、6 は g2 と g3 の中間（4〜5 と 8〜9 を、6〜7 と見分けやすくする）
const TIER_GRAD = [0, 1, 5, 2, 6, 3];
const MIRROR = 'transform="translate(240 0) scale(-1 1)"';
function paths(list) {
  return list.map(p => `<path d="${p.d}"/>` + (p.m ? `<path d="${p.d}" ${MIRROR}/>` : '')).join('');
}
// 片面ぶん。設定で非表示にした部位は、色を付けず、タップもできない
function figureSide(side, act) {
  const f = FIG[side], done = [];
  const ms = Object.entries(f.muscles).map(([name, list]) => {
    if (S.cfg.hide[name]) return `<g class="neutral">${paths(list)}</g>`;
    const t = L.tier(act[name], S.cfg.target[name]);
    if (t === 5) done.push(list);
    return `<g data-m="${name}" class="${S.muscle === name ? 'sel' : ''}" style="fill:url(#g${TIER_GRAD[t]})">${paths(list)}</g>`;
  }).join('');
  // 目標に到達した部位は、輪郭をぼかして光らせる（ゆっくり明滅）
  const halo = done.length ? `<g class="halo" filter="url(#halo)">${done.map(paths).join('')}</g>` : '';
  return `<g class="neutral">${paths(f.neutral)}</g>${ms}${halo}<g class="lines">${paths(f.lines)}</g>`;
}
function figureSvg() {
  const act = actual();
  const stops = (a, b) => `<stop offset="0" style="stop-color:${a}"/><stop offset="1" style="stop-color:${b}"/>`;
  const mix = (v, hi, lo) => `color-mix(in srgb, var(--g${hi}${v}) 50%, var(--g${lo}${v}))`;
  const grad = (id, a, b) => `<linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">${stops(a, b)}</linearGradient>`;
  // 色分けの段階が見分けやすいよう、陰影は元の3分の1に弱める（上下の色を中間色へ寄せる）。人体の地の色（g4）は元のまま
  const soft = (id, a, b) => grad(id, `color-mix(in srgb, ${a} 67%, ${b})`, `color-mix(in srgb, ${a} 33%, ${b})`);
  const defs = '<defs>' + [0, 1, 2, 3].map(i => soft(i, `var(--g${i}a)`, `var(--g${i}b)`)).join('') + grad(4, 'var(--g4a)', 'var(--g4b)')
    + soft(5, mix('a', 2, 1), mix('b', 2, 1)) + soft(6, mix('a', 3, 2), mix('b', 3, 2))
    + '<filter id="halo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.6"/></filter></defs>';
  // 縦を少し詰めて描く（FIG_Y）。座標そのものは 240x420 のまま
  return `<svg viewBox="34 0 344 ${Math.round(412 * FIG_Y) + 24}" role="img" aria-label="前面と背面の人体図">${defs}
    <g transform="scale(1 ${FIG_Y})">${figureSide('front', act)}</g><g transform="translate(172 0) scale(1 ${FIG_Y})">${figureSide('back', act)}</g>
    <text x="120" y="${Math.round(412 * FIG_Y) + 18}">前面</text><text x="292" y="${Math.round(412 * FIG_Y) + 18}">背面</text></svg>`;
}
