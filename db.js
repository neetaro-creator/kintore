'use strict';
/* IndexedDB の読み書き。データは小さいので、起動時に全部読み、変更のたびに該当分だけ書く。
   exercises: 種目（キーは id） / days: 日の記録（キーは date） / kv: メニューの並び（'menus'）と設定（'settings'） */
const Store = (() => {
  const NAME = 'kintore', VER = 1;
  let db = null;
  const done = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  const txDone = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); });

  function open() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(NAME, VER);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore('exercises', { keyPath: 'id' });
        d.createObjectStore('days', { keyPath: 'date' });
        d.createObjectStore('kv');
      };
      req.onsuccess = () => { db = req.result; res(); };
      req.onerror = () => rej(req.error);
    });
  }
  async function loadAll() {
    const tx = db.transaction(['exercises', 'days', 'kv']);
    const [exs, days, menus, settings] = await Promise.all([
      done(tx.objectStore('exercises').getAll()),
      done(tx.objectStore('days').getAll()),
      done(tx.objectStore('kv').get('menus')),
      done(tx.objectStore('kv').get('settings')),
    ]);
    return {
      exercises: Object.fromEntries(exs.map(e => [e.id, e])),
      days: Object.fromEntries(days.map(d => [d.date, d])),
      menus: menus || [],
      settings: settings || null,
    };
  }
  function put(store, value, key) {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    return txDone(tx);
  }
  function delDay(date) {
    const tx = db.transaction('days', 'readwrite');
    tx.objectStore('days').delete(date);
    return txDone(tx);
  }
  // 復元: 全部を1つのトランザクションで入れ替える（途中で失敗したら元のまま）
  function replaceAll(state) {
    const tx = db.transaction(['exercises', 'days', 'kv'], 'readwrite');
    const ex = tx.objectStore('exercises'), days = tx.objectStore('days'), kv = tx.objectStore('kv');
    ex.clear(); days.clear(); kv.clear();
    Object.values(state.exercises).forEach(e => ex.put(e));
    Object.values(state.days).forEach(d => days.put(d));
    kv.put(state.menus, 'menus');
    kv.put(state.settings, 'settings');
    return txDone(tx);
  }
  return {
    open, loadAll, delDay, replaceAll,
    putExercise: e => put('exercises', e),
    putDay: d => put('days', d),
    putMenus: m => put('kv', m, 'menus'),
    putSettings: s => put('kv', s, 'settings'),
  };
})();
