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
const T = { end: 0, total: 0, iv: 0, done: false, wl: null, press: 0, pressAt: 0, raf: 0, ctx: null, alarm: 0, alarmEnd: 0, tap: false };
const RING_LEN = 2 * Math.PI * 130, PRESS_LEN = 2 * Math.PI * 112;
const PRESS_MS = 1500; // 長押しで終了するまでの時間
const ALARM_EVERY = 1400, ALARM_MAX = 3 * 60 * 1000; // 終了音は、閉じるまでくり返す（最長3分）

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
  T.done = false; T.tap = false;
  stopAlarm();
  const t = $('#timer');
  t.hidden = false; t.classList.remove('done');
  resetPress();
  document.body.style.overflow = 'hidden';
  $('#ring-fg').style.strokeDasharray = RING_LEN;
  $('#timer-hint').textContent = '長押しで終了';
  tick();
  clearInterval(T.iv);
  T.iv = setInterval(tick, 200);
  if (!T.raf) T.raf = requestAnimationFrame(frame);
  getWakeLock();
}
// 2つの輪を、毎フレーム、実際の時刻から描く。長押しの輪が一周した時点で閉じる（輪の進みと終了がずれない）
function frame() {
  T.raf = 0;
  if ($('#timer').hidden) return;
  const now = Date.now(), left = Math.max(0, T.end - now);
  $('#ring-fg').style.strokeDashoffset = left > 0 ? RING_LEN * (1 - left / T.total) : 0;
  if (T.pressAt) {
    const p = Math.min(1, (now - T.pressAt) / PRESS_MS);
    $('#ring-press').style.strokeDashoffset = PRESS_LEN * (1 - p);
    if (p >= 1) { closeTimer(); return; }
  }
  T.raf = requestAnimationFrame(frame);
}
// 長押しの表示を最初の状態に戻す
function resetPress() {
  const pr = $('#ring-press');
  clearTimeout(T.press);
  T.pressAt = 0;
  $('#timer').classList.remove('pressing');
  pr.style.transition = 'none';
  pr.style.strokeDasharray = PRESS_LEN;
  pr.style.strokeDashoffset = PRESS_LEN;
}
function tick() {
  const left = Math.max(0, T.end - Date.now());
  const s = Math.ceil(left / 1000);
  $('#timer-num').textContent = `${Math.floor(s / 60)}:${pad(s % 60)}`;
  // 残りが減るにつれて輪が短くなる。終了後は、終了の色で一周させたままにする
  $('#ring-fg').style.strokeDashoffset = left > 0 ? RING_LEN * (1 - left / T.total) : 0;
  if (left <= 0 && !T.done) {
    T.done = true;
    $('#timer').classList.add('done');
    $('#timer-hint').textContent = 'タップで閉じる';
    startAlarm();
  }
}
// ピピピッ（スマホのスピーカーで通りやすい、高めの矩形波）
function beep() {
  const c = T.ctx;
  if (!c) return;
  try {
    if (c.state !== 'running') c.resume().catch(() => {});
    [0, 0.2, 0.4].forEach(off => {
      const o = c.createOscillator(), g = c.createGain(), at = c.currentTime + off;
      o.type = 'square'; o.frequency.value = 1760;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.3, at + 0.01);
      g.gain.setValueAtTime(0.3, at + 0.11);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
      o.connect(g); g.connect(c.destination);
      o.start(at); o.stop(at + 0.16);
    });
  } catch (_) {}
}
function startAlarm() {
  stopAlarm();
  T.alarmEnd = Date.now() + ALARM_MAX;
  beep();
  T.alarm = setInterval(() => { if (Date.now() > T.alarmEnd) stopAlarm(); else beep(); }, ALARM_EVERY);
}
function stopAlarm() { clearInterval(T.alarm); T.alarm = 0; }
async function getWakeLock() {
  try { if ('wakeLock' in navigator) T.wl = await navigator.wakeLock.request('screen'); } catch (_) { /* 静かに続ける */ }
}
function closeTimer() {
  clearInterval(T.iv);
  cancelAnimationFrame(T.raf); T.raf = 0;
  stopAlarm();
  resetPress();
  $('#timer').hidden = true;
  document.body.style.overflow = '';
  try { localStorage.removeItem('timerEnd'); } catch (_) {}
  try { if (T.wl) { T.wl.release(); T.wl = null; } } catch (_) {}
}
(function bindTimer() {
  const t = $('#timer');
  const stop = e => { e.preventDefault(); };
  ['touchmove', 'gesturestart', 'gesturechange', 'dblclick', 'contextmenu', 'click', 'wheel'].forEach(ev =>
    t.addEventListener(ev, stop, { passive: false }));
  t.addEventListener('touchstart', stop, { passive: false });
  // カウント中は約1.5秒の長押しで終了（ポケットでの誤操作を防ぐ）。終了後はタップで閉じる
  const down = e => {
    e.preventDefault();
    if (T.done) { T.tap = true; return; }
    resetPress();
    T.pressAt = Date.now();
    t.classList.add('pressing');
    if (!T.raf) T.raf = requestAnimationFrame(frame);
    T.press = setTimeout(closeTimer, PRESS_MS + 400); // 描画が止まっていても必ず閉じる
  };
  const up = e => {
    const pressing = !!T.pressAt;
    resetPress();
    if (T.done && T.tap && !pressing && e.type === 'pointerup') closeTimer();
    T.tap = false;
  };
  t.addEventListener('pointerdown', down);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => t.addEventListener(ev, up));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !t.hidden) { tick(); if (!T.raf) T.raf = requestAnimationFrame(frame); getWakeLock(); }
  });
})();
