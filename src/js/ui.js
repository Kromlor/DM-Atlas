/* DM Atlas UI shell: router, header, navigation, modals, pop-outs, search. */
'use strict';
const PANELS = [
  { id: 'guide', n: 1, title: 'Guide the Game', icon: '📜', tabs: [['guide/campaign', 'Campaign'], ['guide/lessons', 'Lessons'], ['guide/course', 'Beginner Course'], ['guide/adventure', 'First Adventure'], ['guide/roll', 'What Do I Roll?']] },
  { id: 'rules', n: 2, title: 'Rules & References', icon: '📖', tabs: [['rules/spells', 'Spells'], ['rules/cantrips', 'Cantrips'], ['rules/weapons', 'Weapons'], ['rules/glossary', 'Rules Glossary'], ['rules/rulings', 'Quick Rulings'], ['rules/monsters', 'SRD Monsters'], ['rules/credits', 'Sources & License']] },
  { id: 'combat', n: 3, title: 'Run Combat', icon: '⚔️', tabs: [['combat/party', 'Party'], ['combat/tracker', 'Initiative Tracker'], ['combat/log', 'Encounter Log']] },
  { id: 'tools', n: 4, title: 'Session Tools', icon: '🎲', tabs: [['tools/dice', 'Dice'], ['tools/events', 'Events'], ['tools/npcs', 'NPCs & Captains'], ['tools/notes', 'Notebook'], ['tools/save', 'Save & Resume']] }
];
const VIEWS = {}; /* route -> {title, render(el, params), panel} */
const App = { route: 'screen', params: {}, popout: false, player: false, pendingRender: false, renderTimer: null };
function parseHash() {
  let h = location.hash.replace(/^#\/?/, '');
  const [path, q] = h.split('?');
  const params = {}; (q || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
  return { path: path || 'screen', params };
}
function routeHash(path, params = {}) { const q = Object.entries(params).filter(([k, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&'); return '#/' + path + (q ? '?' + q : ''); }
function go(path, params = {}) { const keep = {}; if (App.popout) keep.popout = '1'; if (App.player) keep.player = '1'; location.hash = routeHash(path, Object.assign(keep, params)); }
function panelOf(path) { const p = PANELS.find(p => path.startsWith(p.id + '/')); return p || null; }

/* ---------- header & nav ---------- */
function renderChrome() {
  const camp = Store.campaign();
  const meta = Meta.get();
  document.body.classList.toggle('popout', App.popout);
  document.body.classList.toggle('player', App.player);
  document.body.classList.toggle('mode-table', meta.mode === 'table');
  document.body.classList.toggle('mode-learn', meta.mode !== 'table');
  const hdr = $('#hdr');
  if (App.player) {
    hdr.innerHTML = `<div class="brand"><span class="crest">❦</span><span class="title">${esc(camp && camp.handbook && camp.handbook.title || 'Player Handbook')}</span></div><div class="hdr-note">Player view — no DM secrets are shown in this window.</div>`;
    $('#nav').innerHTML = ''; return;
  }
  hdr.innerHTML = `
  <div class="brand"><span class="crest" aria-hidden="true">✠</span><span class="title">DM Atlas</span><span class="ed">2024 · SRD 5.2.1</span></div>
  <button class="camp-pill" id="campPill" title="Choose which campaign you are running"><span class="lbl">Campaign</span><span class="nm">${esc(camp ? (camp.shortTitle || camp.title) : 'No campaign selected')}</span><span class="chev">▾</span></button>
  <div class="search"><input id="gsearch" type="search" placeholder="Search spells, weapons, rules, monsters, NPCs…" aria-label="Search everything" autocomplete="off"><div id="gresults" class="gresults" hidden></div></div>
  <button id="btnMenu" class="mobile-only" aria-label="Menu" aria-expanded="false">☰</button>
  <div class="hdr-btns">
    <div class="seg" role="group" aria-label="Learning or table mode"><button data-mode="learn" class="${meta.mode !== 'table' ? 'on' : ''}" title="Show teaching tips and explanations">Learning</button><button data-mode="table" class="${meta.mode === 'table' ? 'on' : ''}" title="Compact view for running the game">Table</button></div>
    <button id="btnFull" title="Full Screen (F11 also works)">⛶ <span class="l">Full Screen</span><span class="s">Full Screen</span></button>
    <button id="btnMon" title="Monitor Setup: open extra windows for other monitors">🖥 <span class="l">Monitor Setup</span><span class="s">Monitors</span></button>
    <button id="btnPop" title="Pop Out This View: open what you see in a new window">↗ <span class="l">Pop Out This View</span><span class="s">Pop Out</span></button>
    <div class="menu"><button id="btnSave" aria-haspopup="true" title="Save / Resume">💾 <span class="l">Save / Resume</span><span class="s">Save</span> ▾</button>
      <div class="menu-list" id="saveMenu" hidden>
        <button data-act="endnight">🌙 End Night &amp; Save</button>
        <button data-act="export">⬇ Export Campaign Save</button>
        <button data-act="import">⬆ Import Campaign Save</button>
        <button data-act="resume">↺ Resume Saved Session</button>
      </div></div>
  </div>`;
  $('#campPill').onclick = () => go('campaigns');
  $('#btnMenu').onclick = () => { const o = hdr.classList.toggle('open'); $('#btnMenu').setAttribute('aria-expanded', o); };
  $$('.seg button', hdr).forEach(b => b.onclick = () => { Meta.set({ mode: b.dataset.mode }); renderChrome(); renderView(); });
  $('#btnFull').onclick = toggleFullscreen;
  $('#btnMon').onclick = openMonitorSetup;
  $('#btnPop').onclick = () => popOut(App.route, App.params);
  $('#btnSave').onclick = e => { e.stopPropagation(); const m = $('#saveMenu'); m.hidden = !m.hidden; };
  $$('#saveMenu button').forEach(b => b.onclick = () => { $('#saveMenu').hidden = true; SaveUI[b.dataset.act](); });
  bindSearch();
  renderNav();
}
function renderNav() {
  const nav = $('#nav'); const cur = App.route; const panel = panelOf(cur);
  nav.innerHTML = `<div class="panels">
    <button class="ptab ${cur === 'screen' ? 'on' : ''}" data-go="screen"><span class="pi">✠</span><span>DM Screen</span></button>
    ${PANELS.map(p => `<button class="ptab ${panel && panel.id === p.id ? 'on' : ''}" data-go="${p.tabs[0][0]}"><span class="pn">${p.n}</span><span>${esc(p.title)}</span></button>`).join('')}
    <button class="ptab ${cur === 'campaigns' ? 'on' : ''}" data-go="campaigns"><span class="pi">🗺</span><span>Campaigns</span></button>
  </div>
  ${panel ? `<div class="subtabs" role="tablist">${panel.tabs.map(([r, t]) => `<button role="tab" class="stab ${cur === r ? 'on' : ''}" data-go="${r}">${esc(t)}</button>`).join('')}</div>` : ''}`;
  $$('[data-go]', nav).forEach(b => b.onclick = () => go(b.dataset.go));
}
function toggleFullscreen() {
  if (!document.fullscreenElement) (document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen() : Promise.reject()).catch(() => toast('Full screen was blocked — press F11 instead.', 'warn'));
  else document.exitFullscreen();
}

/* ---------- views ---------- */
function renderView() {
  const v = VIEWS[App.route] || VIEWS.screen;
  const host = $('#view');
  host.className = 'view view-' + App.route.replace('/', '-');
  const scrolls = {}; $$('[data-keep-scroll]', host).forEach(e => scrolls[e.dataset.keepScroll] = e.scrollTop);
  host.innerHTML = '';
  try { v.render(host, App.params); } catch (e) { console.error(e); host.innerHTML = `<div class="parch pad"><h2>Something went wrong</h2><p>${esc(e.message)}</p></div>`; }
  $$('[data-keep-scroll]', host).forEach(e => { if (scrolls[e.dataset.keepScroll]) e.scrollTop = scrolls[e.dataset.keepScroll]; });
  document.title = (v.title || 'DM Atlas') + ' — DM Atlas';
  App.pendingRender = false;
}
/* Re-render when data changes in another window, without clobbering what the user is typing. */
function softRefresh() {
  const host = $('#view');
  const ae = document.activeElement;
  if (ae && host.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && !ae.dataset.allowRefresh) { App.pendingRender = true; return; }
  renderView();
}
document.addEventListener('focusout', () => { setTimeout(() => { if (App.pendingRender) softRefresh(); }, 50); });

function onRoute() {
  const { path, params } = parseHash();
  App.popout = params.popout === '1';
  App.player = params.player === '1';
  if (App.player) { App.route = 'handbook'; }
  else App.route = VIEWS[path] ? path : 'screen';
  App.params = params;
  closeAllModals(true);
  renderChrome(); renderView();
}

/* ---------- modals ---------- */
let modalStack = [];
function openModal({ title, html = '', wide = false, cls = '', onClose = null, dmOnly = false }) {
  const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-hd"><h2>${esc(title)}</h2><button class="x" aria-label="Close">✕</button></div><div class="modal-bd">${html}</div></div>`;
  document.body.appendChild(wrap);
  const m = { wrap, el: $('.modal', wrap), body: $('.modal-bd', wrap), onClose, close: () => closeModal(m) };
  $('.x', wrap).onclick = () => closeModal(m);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) closeModal(m); });
  modalStack.push(m);
  setTimeout(() => { const f = $('input:not([type=hidden]),select,textarea,button.primary', m.body); if (f) f.focus(); }, 30);
  return m;
}
function closeModal(m) { if (!m || !m.wrap.isConnected) return; m.wrap.remove(); modalStack = modalStack.filter(x => x !== m); if (m.onClose) m.onClose(); }
function closeAllModals(keepFlows = false) { modalStack.slice().forEach(m => { if (!(keepFlows && m.keep)) closeModal(m); }); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalStack.length) closeModal(modalStack[modalStack.length - 1]); });
document.addEventListener('click', e => { const m = $('#saveMenu'); if (m && !m.hidden && !e.target.closest('.menu')) m.hidden = true; });
function confirmBox(title, html, okLabel = 'Confirm', danger = false) {
  return new Promise(res => {
    const m = openModal({ title, html: `<div class="confirm-body">${html}</div><div class="btnrow"><button class="${danger ? 'danger' : 'primary'}" data-ok>${esc(okLabel)}</button><button data-cancel>Cancel</button></div>`, onClose: () => res(false) });
    $('[data-ok]', m.body).onclick = () => { m.onClose = null; closeModal(m); res(true); };
    $('[data-cancel]', m.body).onclick = () => closeModal(m);
  });
}

/* ---------- pop-outs & monitor setup ---------- */
function popOut(path, params = {}, name) {
  const p = Object.assign({}, params, { popout: '1' }); delete p.player;
  const url = location.href.split('#')[0] + routeHash(path, p);
  const w = window.open(url, name || ('dmatlas-' + path.replace('/', '-') + '-' + Date.now().toString(36)), 'popup=yes,width=1100,height=800');
  if (!w) { popupBlockedHelp(url); return null; }
  return w;
}
function openPlayerHandbook() {
  const url = location.href.split('#')[0] + routeHash('handbook', { player: '1', popout: '1' });
  const w = window.open(url, 'dmatlas-player-handbook', 'popup=yes,width=1100,height=850');
  if (!w) popupBlockedHelp(url);
}
function popupBlockedHelp(url) {
  openModal({ title: 'The browser blocked the new window', html: `<p>Your browser stopped DM Atlas from opening a pop-up window. To allow it:</p>
  <ol><li><b>Chrome / Edge:</b> click the pop-up blocked icon at the right end of the address bar, choose <i>Always allow pop-ups</i> for this page, then click the button again.</li>
  <li>Or copy this address into a new window yourself:</li></ol>
  <p><input class="wide" readonly value="${esc(url)}" onclick="this.select()"></p>
  <p class="muted">Tip: once a window is open, drag it to another monitor and press F11 (or use Full Screen) there.</p>` });
}
function openMonitorSetup() {
  const isFile = location.protocol === 'file:';
  const bc = typeof BroadcastChannel !== 'undefined';
  const m = openModal({
    title: 'Monitor Setup', wide: true, html: `
  <div class="mon-grid">
    <div class="mon"><div class="mon-ico">🖥</div><h3>Monitor 1 — DM Screen</h3><p>Keep this window as your main screen (all four panels).</p></div>
    <div class="mon"><div class="mon-ico">📖</div><h3>Monitor 2 — References</h3><p>Spells, weapons, rules glossary.</p><button data-pop="rules/spells">Open References window</button></div>
    <div class="mon"><div class="mon-ico">⚔️</div><h3>Monitor 3 — Combat &amp; Party</h3><p>Initiative tracker and party cards.</p><button data-pop="combat/tracker">Open Combat window</button> <button data-pop="combat/party">Open Party window</button></div>
  </div>
  <h3>More windows you can pop out</h3>
  <div class="btnrow wrap">
    <button data-pop="screen">Full DM Screen</button><button data-pop="guide/lessons">Lessons</button><button data-pop="rules/rulings">Rulings</button><button data-pop="rules/spells">Spell helper</button><button data-pop="tools/events">Events</button><button data-pop="tools/npcs">NPCs</button><button data-pop="tools/dice">Dice</button><button data-pop="tools/notes">Notes</button><button data-pop="combat/log">Encounter log</button><button data-player>Player handbook (for players)</button>
  </div>
  <h3>How to arrange them</h3>
  <ol><li>Click a button above. A new browser window opens.</li><li>Drag that window onto another monitor by its title bar (DM Atlas can't place windows for you).</li><li>Press <b>F11</b> in that window (or its Full Screen button) to fill the monitor.</li><li>Each window navigates on its own. Use “Pop Out This View” in the header to open whatever you're looking at.</li></ol>
  <h3>Do the windows stay in sync?</h3>
  <p>Party records, combat (HP, initiative, turns), notes and the encounter log are shared between windows <b>of the same browser opened from the same web address</b>, using BroadcastChannel and storage events${bc ? '' : ' (BroadcastChannel is not available in this browser; storage events are used instead)'}.</p>
  <div class="callout ${isFile ? 'warn' : ''}"><b>${isFile ? 'You opened DM Atlas from a file (file://).' : 'You are on ' + esc(location.origin) + '.'}</b> ${isFile ? 'Chrome and Edge may treat every file:// page as its own private origin, so <b>sync between windows is not guaranteed</b> when running from a file. DM Atlas still tries, and in many setups it works, but don\'t rely on it.' : 'Sync between windows should work here.'}
  Whenever DM Atlas is opened from a file (a <code>file://</code> address), sync between windows is not guaranteed. For dependable multi-window sync, serve the folder from a simple local web server and open <code>http://localhost…</code>. For example, in the folder that holds the HTML file run <code>python -m http.server 8000</code> and open <code>http://localhost:8000/DM_Atlas_5_5e.html</code>. Otherwise, use a single window and switch views with the panel tabs.</div>
  <p class="muted">Sync status: ${bc ? 'BroadcastChannel available' : 'BroadcastChannel unavailable'} · storage ${LS.ok ? 'available' : 'unavailable (changes are kept in memory only)'} · this window id ${WIN_ID}${Sync.lastMessage ? ' · last update from another window ' + fmtTime(Sync.lastMessage.at) + ' via ' + Sync.lastMessage.via : ''}</p>` });
  $$('[data-pop]', m.body).forEach(b => b.onclick = () => popOut(b.dataset.pop));
  $('[data-player]', m.body).onclick = openPlayerHandbook;
}

/* ---------- global search ---------- */
function searchIndex() {
  if (App._idx) return App._idx;
  const idx = [];
  SRD.spells.forEach(s => idx.push({ k: 'Spell', t: s.name, d: (s.level ? 'Level ' + s.level : 'Cantrip') + ' ' + s.school, go: ['rules/spells', { id: s.id }] }));
  SRD.weapons.forEach(w => idx.push({ k: 'Weapon', t: w.name, d: w.damage + ' ' + w.damageType, go: ['rules/weapons', { id: w.id }] }));
  SRD.glossary.concat(SRD.playing).forEach(g => idx.push({ k: g.kind === 'condition' ? 'Condition' : 'Rule', t: g.term, d: g.text[0].slice(0, 80), go: ['rules/glossary', { q: g.term.replace(/ \[.*\]/, '') }] }));
  SRD.monsters.forEach(m => idx.push({ k: 'Monster', t: m.name, d: m.meta, go: ['rules/monsters', { id: m.id }] }));
  (window.DM_LESSONS || []).forEach(l => idx.push({ k: 'Lesson', t: l.title, d: l.group, go: ['guide/lessons', { id: l.id }] }));
  App._idx = idx; return idx;
}
function campaignIndex() {
  const c = Store.campaign(); if (!c) return [];
  const out = [];
  (c.npcs || []).forEach((n, i) => out.push({ k: 'NPC', t: n.name, d: n.role || '', go: ['guide/campaign', { tab: 'npcs', i }] }));
  (c.locations || []).forEach((n, i) => out.push({ k: 'Place', t: n.name, d: 'Location', go: ['guide/campaign', { tab: 'locations', i }] }));
  (c.sessions || []).forEach((s, i) => out.push({ k: 'Session', t: s.title, d: s.summary || '', go: ['guide/campaign', { tab: 'sessions', i }] }));
  (c.bestiary || []).forEach((b, i) => out.push({ k: 'Creature', t: b.name, d: b.meta || '', go: ['guide/campaign', { tab: 'bestiary', i }] }));
  return out;
}
function bindSearch() {
  const inp = $('#gsearch'), box = $('#gresults'); if (!inp) return;
  const run = () => {
    const q = inp.value.trim().toLowerCase();
    if (q.length < 2) { box.hidden = true; return; }
    const all = campaignIndex().concat(searchIndex());
    const res = all.filter(r => r.t.toLowerCase().includes(q)).sort((a, b) => (a.t.toLowerCase().startsWith(q) ? 0 : 1) - (b.t.toLowerCase().startsWith(q) ? 0 : 1)).slice(0, 14);
    box.innerHTML = res.length ? res.map((r, i) => `<button data-i="${i}"><span class="rk">${esc(r.k)}</span><b>${esc(r.t)}</b><span class="rd">${esc(r.d)}</span></button>`).join('') : '<div class="none">No matches</div>';
    box.hidden = false;
    $$('button', box).forEach(b => b.onclick = () => { const r = res[b.dataset.i]; box.hidden = true; inp.value = ''; go(r.go[0], r.go[1]); });
  };
  inp.addEventListener('input', run);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = $('button', box); if (b) b.click(); } if (e.key === 'Escape') box.hidden = true; });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) box.hidden = true; });
}
/* Small helper for learning-mode tips */
/* Shown on party/combat/notes screens when no campaign is active. */
function scratchBanner(compact) {
  if (Store.cid) return '';
  if (compact) return `<span class="scratch-pill" title="No campaign selected: characters, combat and notes here are kept on a separate scratch table that never mixes with any campaign.">No campaign — scratch table <button class="mini" data-scr="pick">Pick a campaign</button></span>`;
  return `<div class="callout warn scratch-banner"><b>No campaign selected — scratch table.</b> Characters, combat and notes here are kept in a separate scratch area in this browser and never mix with any campaign. <button class="mini" data-scr="pick">Pick a campaign</button> <button class="mini" data-scr="blank">Start a blank campaign</button></div>`;
}
function bindScratch(el) { $$('[data-scr]', el).forEach(b => b.onclick = () => b.dataset.scr === 'pick' ? go('campaigns') : startBlankCampaign()); }
function tip(html) { return `<div class="tipbox learn-only"><b>Learning tip:</b> ${html}</div>`; }
function dmBadge() { return '<span class="dm-badge" title="Dungeon Master only — never shown in the player handbook window">🔒 DM only</span>'; }
