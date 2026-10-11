/* DM Atlas core: utilities, storage, cross-window sync. */
'use strict';
const APP_VERSION = '1.0.0';
const SAVE_FORMAT = 'dm-atlas-campaign-save';
const SAVE_VERSION = 1;
const CAMPAIGN_FORMAT = 'dm-atlas-campaign';
const WIN_ID = Math.random().toString(36).slice(2, 10);
const SRD = window.DM_SRD;

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function uid(p = 'id') { return p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
function num(v) { if (v === '' || v === null || v === undefined) return null; const n = Number(String(v).replace('−', '-').replace('+', '')); return Number.isFinite(n) ? n : null; }
function int0(v) { const n = num(v); return n === null ? 0 : Math.trunc(n); }
function sign(n) { n = Number(n) || 0; return (n >= 0 ? '+' : '−') + Math.abs(n); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function slug(s) { return String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'; }
function pbForLevel(level) { const l = num(level); if (l === null || l < 1) return null; if (l <= 4) return 2; if (l <= 8) return 3; if (l <= 12) return 4; if (l <= 16) return 5; return 6; }
function fmtTime(ts) { try { return new Date(ts).toLocaleString(); } catch (e) { return String(ts); } }
function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function readFileText(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(file); }); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function dateStamp() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

/* ---------- storage ---------- */
const LS = {
  ok: (() => { try { const k = '__dma_test'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } })(),
  mem: {},
  get(k, d = null) { try { const v = this.ok ? localStorage.getItem(k) : this.mem[k]; return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { const s = JSON.stringify(v); try { if (this.ok) localStorage.setItem(k, s); else this.mem[k] = s; return true; } catch (e) { toast('Could not save to browser storage: ' + e.message, 'bad'); return false; } },
  del(k) { try { if (this.ok) localStorage.removeItem(k); else delete this.mem[k]; } catch (e) { } }
};
/* With no campaign selected, work goes to a separate scratch workspace that never mixes with a campaign. */
const NO_CAMP = '__none__';
const K = { meta: 'dmatlas.meta', library: 'dmatlas.library', camp: id => 'dmatlas.camp.' + (id || NO_CAMP), snaps: id => 'dmatlas.snaps.' + (id || NO_CAMP), ui: 'dmatlas.ui.' };

/* ---------- campaign library ---------- */
const Library = {
  _c: null,
  bundled() { return (window.DM_BUNDLED_CAMPAIGNS || []).map(c => Object.assign({ bundled: true }, c)); },
  imported() { return LS.get(K.library, []) || []; },
  /* A stored copy whose id matches a bundled campaign is an in-place update of it ("override"); the newer one wins,
     so a later app release with newer bundled data takes over again automatically. */
  all() {
    if (this._c) return this._c;
    const imp = this.imported(); const byId = {}; imp.forEach(c => { byId[c.id] = c; });
    const list = this.bundled().map(b => { const o = byId[b.id]; if (!o) return b; delete byId[b.id]; return String(o.generated || '') >= String(b.generated || '') ? Object.assign({}, o, { bundled: true, overridesBundled: true, bundledGenerated: b.generated || '' }) : Object.assign({}, b, { staleOverride: o.generated || 'older' }); });
    return (this._c = list.concat(imp.filter(c => byId[c.id])));
  },
  get(id) { if (!id) return null; return this.all().find(c => c.id === id) || null; },
  saveImported(list) { this._c = null; const ok = LS.set(K.library, list); this._c = null; return ok; },
  add(doc) {
    const list = this.imported();
    let id = doc.id || slug(doc.title);
    const taken = new Set(this.all().map(c => c.id));
    if (taken.has(id)) { let i = 2; while (taken.has(id + '-' + i)) i++; id = id + '-' + i; }
    doc.id = id; doc.importedAt = Date.now();
    list.push(doc);
    return this.saveImported(list) ? doc : null;
  },
  /* In-place update by id: replaces the stored copy (or stores an override of a bundled campaign). The DM's
     per-campaign state lives under the same id and is untouched. */
  upsert(doc) {
    const list = this.imported().filter(c => c.id !== doc.id); doc.importedAt = Date.now(); delete doc.bundled; delete doc.overridesBundled; delete doc.bundledGenerated; delete doc.staleOverride;
    list.push(doc); return this.saveImported(list) ? doc : null;
  },
  /* Drop an imported update of a bundled campaign (keeps the DM's progress). */
  revert(id) { return this.saveImported(this.imported().filter(c => c.id !== id)); },
  update(doc) { const list = this.imported(); const i = list.findIndex(c => c.id === doc.id); if (i < 0) return false; list[i] = doc; return this.saveImported(list); },
  remove(id) { this.saveImported(this.imported().filter(c => c.id !== id)); LS.del(K.camp(id)); LS.del(K.snaps(id)); },
  /* Bundled campaigns that changed id keep the DM's saved progress (state, snapshots, active choice). */
  migrateIds() {
    this.bundled().forEach(c => (c.previousIds || []).forEach(old => {
      if (!LS.get(K.camp(c.id), null) && LS.get(K.camp(old), null)) { const st = LS.get(K.camp(old), null); st.campaignId = c.id; LS.set(K.camp(c.id), st); LS.del(K.camp(old)); const sn = LS.get(K.snaps(old), null); if (sn) { LS.set(K.snaps(c.id), sn); LS.del(K.snaps(old)); } }
      const m = LS.get(K.meta, null); if (m && m.activeCampaignId === old) { m.activeCampaignId = c.id; LS.set(K.meta, m); }
    }));
  }
};
window.addEventListener('storage', e => { if (e.key === K.library) Library._c = null; });

/* ---------- meta (per browser) ---------- */
const Meta = {
  get() { return Object.assign({ activeCampaignId: null, mode: 'learn' }, LS.get(K.meta, {})); },
  set(patch, broadcast = true) { const m = Object.assign(this.get(), patch); LS.set(K.meta, m); if (broadcast) Sync.post({ t: 'meta' }); return m; }
};

/* ---------- campaign state ---------- */
function blankState(campaign) {
  return {
    schema: 1, campaignId: campaign ? campaign.id : null, campaignName: campaign ? campaign.title : 'No campaign (scratch table)',
    location: '', recap: '', currentSession: 0,
    party: [], combat: { combatants: [], round: 1, turn: 0, active: false },
    log: [], appliedAttacks: [], notes: '', dice: [], rev: 0, updatedAt: Date.now()
  };
}
const Store = {
  cid: null, state: null,
  campaign() { return Library.get(this.cid); },
  load(cid) {
    this.cid = cid && Library.get(cid) ? cid : null; cid = this.cid;
    const c = Library.get(cid);
    const s = LS.get(K.camp(cid), null);
    this.state = normalizeState(s || blankState(c), c);
    return this.state;
  },
  fresh() { const s = LS.get(K.camp(this.cid), null); if (s) this.state = normalizeState(s, this.campaign()); return this.state; },
  /* All writes go through mutate(): reload latest from storage first so windows don't overwrite each other. */
  mutate(fn, reason = 'change') {
    this.fresh();
    const r = fn(this.state);
    if (r === false) return false;
    this.state.rev = (this.state.rev || 0) + 1;
    this.state.updatedAt = Date.now();
    LS.set(K.camp(this.cid), this.state);
    Sync.post({ t: 'state', cid: this.cid || NO_CAMP, rev: this.state.rev, reason });
    return r === undefined ? true : r;
  },
  replace(newState, reason = 'replace') {
    newState.rev = Math.max(newState.rev || 0, (this.fresh() && this.state.rev) || 0) + 1;
    newState.updatedAt = Date.now();
    this.state = normalizeState(newState, this.campaign());
    LS.set(K.camp(this.cid), this.state);
    Sync.post({ t: 'state', cid: this.cid || NO_CAMP, rev: this.state.rev, reason });
  },
  snapshots() { return LS.get(K.snaps(this.cid), []) || []; },
  addSnapshot(label) {
    const list = this.snapshots();
    list.unshift({ id: uid('snap'), label, at: Date.now(), state: deepClone(this.fresh()) });
    while (list.length > 12) list.pop();
    LS.set(K.snaps(this.cid), list);
    return list[0];
  }
};
function normalizeState(s, campaign) {
  const b = blankState(campaign);
  const out = Object.assign({}, b, s);
  out.party = Array.isArray(s.party) ? s.party.map(normalizePC) : [];
  out.combat = Object.assign({}, b.combat, s.combat || {});
  out.combat.combatants = Array.isArray(out.combat.combatants) ? out.combat.combatants : [];
  out.log = Array.isArray(s.log) ? s.log : [];
  out.appliedAttacks = Array.isArray(s.appliedAttacks) ? s.appliedAttacks : [];
  out.dice = Array.isArray(s.dice) ? s.dice : [];
  if (campaign) { out.campaignId = campaign.id; out.campaignName = campaign.title; } else { out.campaignId = null; out.campaignName = b.campaignName; }
  return out;
}
function normalizePC(p) {
  /* Keep unknown fields (spread first), then fill defaults for known ones. */
  const d = { id: uid('pc'), name: 'New character', player: '', cls: '', species: '', level: '', ac: '', hp: '', maxHp: '', pp: '', saveDc: '', spellAtk: '', initBonus: '', str: '', dex: '', profSimple: false, profMartial: false, profWeapons: [], conditions: [], concentrating: false, concentrationSpell: '', notes: '', weapons: [], inspiration: false, deathSaves: { s: 0, f: 0 } };
  const o = Object.assign({}, d, p);
  if (!Array.isArray(o.conditions)) o.conditions = String(o.conditions || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!Array.isArray(o.weapons)) o.weapons = [];
  if (!Array.isArray(o.profWeapons)) o.profWeapons = [];
  return o;
}

/* ---------- cross-window sync ---------- */
const Sync = {
  bc: null, listeners: [], lastSeen: {},
  init() {
    try { this.bc = new BroadcastChannel('dm-atlas-sync'); this.bc.onmessage = e => this.receive(e.data, 'bc'); } catch (e) { this.bc = null; }
    window.addEventListener('storage', e => {
      if (!e.key) return;
      if (e.key.startsWith('dmatlas.camp.')) this.receive({ t: 'state', cid: e.key.slice(13), from: 'storage' }, 'storage');
      else if (e.key === K.meta) this.receive({ t: 'meta', from: 'storage' }, 'storage');
      else if (e.key === K.library) this.receive({ t: 'library', from: 'storage' }, 'storage');
    });
  },
  post(msg) { msg.from = WIN_ID; msg.at = Date.now(); try { this.bc && this.bc.postMessage(msg); } catch (e) { } },
  receive(msg, via) {
    if (!msg || msg.from === WIN_ID) return;
    this.lastMessage = { via, at: Date.now(), t: msg.t };
    this.counts = this.counts || { bc: 0, storage: 0 }; this.counts[via] = (this.counts[via] || 0) + 1;
    this.listeners.forEach(fn => { try { fn(msg, via); } catch (e) { console.error(e); } });
  },
  on(fn) { this.listeners.push(fn); }
};

/* ---------- toast ---------- */
function toast(msg, kind = 'info', ms = 3200) {
  let host = $('#toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.setAttribute('role', 'status'); t.textContent = msg;
  host.appendChild(t); while (host.children.length > 3) host.firstChild.remove(); setTimeout(() => t.classList.add('out'), ms); setTimeout(() => t.remove(), ms + 400);
}

/* ---------- HTML sanitizer (for imported campaign content) ---------- */
const SAFE_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'u', 'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'br', 'hr', 'span', 'div', 'small', 'sup', 'sub', 'code', 'pre', 'dl', 'dt', 'dd', 'section', 'article', 'a', 'caption', 'mark', 's', 'figure', 'figcaption']);
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'link', 'meta', 'base', 'svg', 'math', 'noscript', 'template', 'frame', 'frameset', 'applet', 'audio', 'video', 'canvas', 'img', 'picture', 'source', 'title', 'head', 'nav']);
const SAFE_CLASSES = new Set(['readaloud', 'encounter', 'encounter-h', 'points', 'levelup', 'callout', 'knows', 'dm-warning', 'role', 'sub', 'letter', 'card', 'grid', 'icon', 'tagline', 'pill', 'steps', 'step', 'seal', 'sig', 'place', 'path', 'house', 'ember', 'tide', 'thorn', 'dusk', 'inc', 'lvl', 'spelltab', 'spellgroup', 'tablewrap', 'timeline', 'npc', 'asciimap', 'turnto', 'riddle-ans', 'hidden-ans', 'secret']);
function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString('<!doctype html><body>' + String(html || '') + '</body>', 'text/html');
  const walk = node => {
    Array.from(node.childNodes).forEach(ch => {
      if (ch.nodeType === 8) { ch.remove(); return; }
      if (ch.nodeType !== 1) return;
      const tag = ch.tagName.toLowerCase();
      if (DROP_TAGS.has(tag)) { ch.remove(); return; }
      walk(ch);
      if (!SAFE_TAGS.has(tag)) { while (ch.firstChild) ch.parentNode.insertBefore(ch.firstChild, ch); ch.remove(); return; }
      const keep = {};
      Array.from(ch.attributes).forEach(a => {
        const n = a.name.toLowerCase(), v = a.value;
        if (n === 'class') { const cl = v.split(/\s+/).filter(c => SAFE_CLASSES.has(c)); if (cl.length) keep['class'] = cl.join(' '); }
        else if ((n === 'colspan' || n === 'rowspan') && /^\d{1,2}$/.test(v)) keep[n] = v;
        else if (n === 'href' && tag === 'a' && /^(https?:\/\/|#)/i.test(v.trim())) keep.href = v.trim();
      });
      Array.from(ch.attributes).forEach(a => ch.removeAttribute(a.name));
      Object.entries(keep).forEach(([k, v]) => ch.setAttribute(k, v));
      if (tag === 'a' && keep.href && /^https?:/i.test(keep.href)) { ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer'); }
    });
  };
  walk(doc.body);
  return doc.body.innerHTML.trim();
}
