'use strict';
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
  try { localStorage.setItem('kintore-dragged', '1'); } catch (e) { /* 保存できなくても動く */ }
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
  const name = DR.list.dataset.list;
  const arr = reorderTarget(name);
  const from = DR.from, to = DR.to;
  DR.items.forEach(el => { el.style.transform = ''; el.style.transition = ''; el.classList.remove('dragging'); });
  DR.moved = true;
  setTimeout(() => { DR.moved = false; }, 350);
  if (arr && from !== to) { arr.splice(to, 0, arr.splice(from, 1)[0]); reorderSave(name); }
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
