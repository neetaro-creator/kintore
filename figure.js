'use strict';
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
function figureSvg(side) {
  const f = FIG[side], act = actual();
  const defs = '<defs>' + [0, 1, 2, 3, 4].map(i => `<linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--g${i}a)"/><stop offset="1" style="stop-color:var(--g${i}b)"/></linearGradient>`).join('') + '</defs>';
  const neutral = `<g class="neutral">${paths(f.neutral)}</g>`;
  const ms = Object.entries(f.muscles).map(([name, list]) => {
    const lv = L.level(act[name], S.cfg.target[name]);
    return `<g data-m="${name}" class="${S.muscle === name ? 'sel' : ''}" style="fill:url(#g${lv})">${paths(list)}</g>`;
  }).join('');
  const lines = `<g class="lines">${paths(f.lines)}</g>`;
  return `<svg viewBox="0 0 240 420" role="img" aria-label="${side === 'front' ? '前面' : '背面'}の人体図">${defs}${neutral}${ms}${lines}</svg>`;
}
