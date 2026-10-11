'use strict';
/* ========== インターバルの時間選択 ========== */
const W_MIN = 15, W_MAX = 600, W_STEP = 15, W_H = 44;
const PRESETS = [60, 90, 120, 150, 180];
const mmss = n => `${Math.floor(n / 60)}:${pad(n % 60)}`;
function timerSheet(def) {
  const vals = [];
  for (let v = W_MIN; v <= W_MAX; v += W_STEP) vals.push(v);
  S.timerPick = def;
  const presets = PRESETS.concat(PRESETS.includes(def) ? [] : [def]).sort((a, b) => a - b);
  sheet(`<h2>インターバル</h2>
    <div class="chips" id="presets" style="margin:0 0 6px">${presets.map(v => `<button class="chip" data-act="timerPreset" data-v="${v}">${mmss(v)}${v === def ? '<span class="sub" style="margin-left:4px;font-size:11px">基準</span>' : ''}</button>`).join('')}</div>
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
