/* Campaign art: images live in IndexedDB (imported from a .dmatlas-art.json pack) or in a folder next to the HTML
   (art/<campaign-id>/<kind>/<slug>.webp). Nothing is embedded in the HTML itself. */
'use strict';
const ART_FORMAT = 'dm-atlas-art';
const ArtStore = {
  _db: null, urls: {}, folderOK: {},
  open() {
    if (this._db) return this._db;
    this._db = new Promise(res => {
      if (!window.indexedDB) return res(null);
      let r; try { r = indexedDB.open('dmatlas-art', 1); } catch (e) { return res(null); }
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('img')) r.result.createObjectStore('img'); };
      r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
    });
    return this._db;
  },
  async tx(mode, fn) {
    const db = await this.open(); if (!db) return null;
    return new Promise(res => { try { const t = db.transaction('img', mode); const s = t.objectStore('img'); let out = null; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = t.onabort = () => res(null); } catch (e) { res(null); } });
  },
  range(cid) { return IDBKeyRange.bound(cid + '|', cid + '|\uffff'); },
  get(cid, key) { return this.tx('readonly', s => s.get(cid + '|' + key)); },
  count(cid) { return this.tx('readonly', s => s.count(this.range(cid))).then(n => n || 0); },
  async clear(cid) { await this.tx('readwrite', s => s.delete(this.range(cid))); this.reset(cid); },
  reset(cid) { Object.keys(this.urls).forEach(k => { if (!cid || k.startsWith(cid + '|')) { if (this.urls[k] && this.urls[k].startsWith('blob:')) URL.revokeObjectURL(this.urls[k]); delete this.urls[k]; } }); if (cid) delete this.folderOK[cid]; else this.folderOK = {}; },
  async putMany(cid, entries) {
    const db = await this.open(); if (!db) throw new Error('This browser does not allow IndexedDB storage here.');
    return new Promise((res, rej) => { const t = db.transaction('img', 'readwrite'); const s = t.objectStore('img'); entries.forEach(([k, blob]) => s.put(blob, cid + '|' + k)); t.oncomplete = () => res(entries.length); t.onerror = t.onabort = () => rej(t.error || new Error('Could not store the images (browser storage may be full).')); });
  },
  folder(c) { return (c.art && c.art.folder) || ('art/' + c.id + '/'); },
  probe(src) { return new Promise(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = src; }); },
  /* One probe per campaign decides whether the art folder exists, so a missing folder costs one failed request, not hundreds. */
  async folderAvailable(c) {
    if (this.folderOK[c.id] === undefined) this.folderOK[c.id] = this.probe(this.folder(c) + (c.art && c.art.probe || 'portrait/' + ((c.npcs || []).find(n => n.portrait) || {}).portrait) + '.webp');
    return this.folderOK[c.id];
  },
  async url(c, key) {
    if (!c || !key) return null;
    const k = c.id + '|' + key;
    if (this.urls[k] !== undefined) return this.urls[k];
    const blob = await this.get(c.id, key);
    if (blob) return (this.urls[k] = URL.createObjectURL(blob));
    return (this.urls[k] = (await this.folderAvailable(c)) ? this.folder(c) + key + '.webp' : null);
  },
  /* Fill every <img data-art> under root. Images that are missing show the placeholder next to them. */
  hydrate(root, c) {
    c = c || Store.campaign(); if (!c) return;
    $$('img[data-art]', root).forEach(async img => {
      const u = await this.url(c, img.dataset.art);
      if (!img.isConnected) return;
      const box = img.closest('.artbox');
      if (u) { img.onerror = () => box && box.classList.add('noart'); img.src = u; box && box.classList.remove('noart'); } else if (box) box.classList.add('noart');
    });
  }
};
function artBox(key, alt, cls = '', caption = '') {
  if (!key) return '';
  return `<figure class="artbox noart ${cls}"><img data-art="${esc(key)}" alt="${esc(alt)}"><div class="artph">🖼 <span>Art not loaded.<br><small>Import the art pack on the Campaigns screen.</small></span></div>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
}
function b64ToBlob(dataURL) {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(dataURL); if (!m) throw new Error('bad image data');
  const bin = atob(m[2]); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: m[1] });
}
function validateArtPack(d) {
  const errs = [];
  if (!d || d.app !== 'DM Atlas' || d.format !== ART_FORMAT) errs.push('This is not a DM Atlas art pack (expected "format": "' + ART_FORMAT + '").');
  else {
    if (!d.campaignId) errs.push('The art pack does not say which campaign it belongs to.');
    if (!d.images || typeof d.images !== 'object') errs.push('The art pack has no images.');
    else Object.entries(d.images).forEach(([k, v]) => { if (!/^[a-z]+\/[a-z0-9-]+$/.test(k) || !/^data:image\/(webp|jpeg|png);base64,/.test(String(v))) errs.push('Bad image entry: ' + k); });
  }
  return errs.slice(0, 8);
}
async function importArtPack(text, fname) {
  let d; try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { openModal({ title: 'Art not imported', html: `<p>${esc(fname || 'The file')} is not valid JSON. Nothing was changed.</p>` }); return 0; }
  const errs = validateArtPack(d);
  if (errs.length) { openModal({ title: 'Art not imported', html: `<ul class="errs">${errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul><p>Nothing was changed.</p>` }); return 0; }
  const c = Library.get(d.campaignId);
  try {
    const entries = Object.entries(d.images).map(([k, v]) => [k, b64ToBlob(v)]);
    await ArtStore.clear(d.campaignId);   /* re-importing a regenerated pack replaces the old images (idempotent) */
    const n = await ArtStore.putMany(d.campaignId, entries);
    ArtStore.reset(d.campaignId);
    Sync.post({ t: 'art', cid: d.campaignId });
    toast(`Art pack imported: ${n} images for “${c ? c.title : d.campaignId}”. They are stored in this browser.`, 'good', 6000);
    renderView();
    return n;
  } catch (e) { openModal({ title: 'Art not imported', html: `<p>${esc(e.message)}</p>` }); return 0; }
}
function pickArtPack() { pickFiles('.json,application/json', false, async files => importArtPack(await readFileText(files[0]), files[0].name)); }

/* ---------- NPC portraits: guise / reveal / alternate (pin-up) rules ---------- */
function npcView(slugId, st) { st = st || Store.state; return (st && st.npcView && st.npcView[slugId]) || {}; }
function setNpcView(slugId, patch) { Store.mutate(s => { s.npcView = Object.assign({}, s.npcView || {}); s.npcView[slugId] = Object.assign({}, s.npcView[slugId] || {}, patch); }, 'npc-view'); }
/* The player window only ever asks for the human guise (until revealed), the standard true form, or an alternate the DM explicitly chose to share. */
function npcArtKey(n, mode, st) {
  const v = npcView(n.slug, st); const guise = n.guise === true || !!(n.guise && n.guise.alias);
  if (mode === 'player') {
    if (guise && !v.revealed) return 'guise/' + n.slug;
    if (v.spicyPlayer && (n.hasSpicy || n.spicy)) return 'spicy/' + n.slug;
    return n.portrait ? 'portrait/' + n.slug : null;
  }
  if ((n.hasSpicy || n.spicy) && !v.std) return 'spicy/' + n.slug;
  return n.portrait ? 'portrait/' + n.slug : null;
}

/* ---------- reveals (three-way visibility: player / gated until revealed / DM only) ---------- */
function isRevealed(key, st) {
  st = st || Store.state; if (!key || !st) return false;
  if (st.reveals && st.reveals[key]) return true;
  return key.startsWith('npc:') && !!npcView(key.slice(4), st).revealed;   /* older saves kept the NPC reveal in npcView */
}
function setReveal(key, on) {
  Store.mutate(s => { s.reveals = Object.assign({}, s.reveals || {}); if (on) s.reveals[key] = true; else delete s.reveals[key]; if (key.startsWith('npc:') && s.npcView && s.npcView[key.slice(4)]) { s.npcView = Object.assign({}, s.npcView); s.npcView[key.slice(4)] = Object.assign({}, s.npcView[key.slice(4)], { revealed: !!on }); } }, 'reveal');
}
/* What the player window shows for one NPC of a structured campaign (doc.player.npcs entry). */
function playerFace(p, st) {
  const v = npcView(p.id, st); const rev = p.gate && isRevealed(p.gate, st) ? p.rev : null;
  let img = p.img; let name = p.name; const aliases = (p.aliases || []).slice();
  if (rev) { if (rev.name) { aliases.unshift(p.name); name = rev.name; } if (rev.img) img = rev.img; (rev.aliases || []).forEach(a => aliases.push(a)); }
  if (p.spicy && v.spicyPlayer && (!p.spicy.gated || rev)) img = p.spicy.key;
  return { name, img, aliases: aliases.filter(a => a !== name), altImg: rev && rev.altImg, ra: rev ? rev.ra : [], revealed: !!rev, hidden: !!v.hidden };
}
/* DM-side portrait for a structured NPC record: the preferred alternate unless the DM switched to standard. */
function dmPortrait(n, st) {
  const v = npcView(n.id, st); const a = n.art || {};
  if (a.spicy && a.spicy.key && !v.std) return a.spicy.key;
  return (a.portrait && a.portrait.key) || (a.guise && a.guise.key) || null;
}

/* ---------- SRD 5.2.1 creature references inside campaign text ---------- */
function srdMonsterByName(name) { const lc = x => String(x).toLowerCase().replace(/’/g, "'"); const n = lc(name); return SRD.monsters.find(m => lc(m.name) === n) || null; }
function linkSRD(root, c) {
  if (!c || !c.srdRefs) return;
  $$('.rich em, .rich i', root).forEach(e => {
    const key = e.textContent.trim().toLowerCase().replace(/’/g, "'");
    const target = c.srdRefs[key]; const m = target && srdMonsterByName(target);
    if (!m) return;
    const b = document.createElement('button'); b.className = 'srdref'; b.type = 'button';
    b.title = 'SRD 5.2.1 stat block: ' + m.name + (m.name.toLowerCase() !== key.replace(/s$/, '') ? ' (2024 name)' : '');
    b.textContent = e.textContent; b.dataset.srd = m.id;
    b.onclick = () => showSRDMonster(m, e.textContent);
    e.replaceWith(b);
  });
}
function showSRDMonster(m, asWritten) {
  const md = openModal({ title: m.name + ' — SRD 5.2.1', wide: true, html: `${asWritten && asWritten.toLowerCase().replace(/s$/, '') !== m.name.toLowerCase() ? `<p class="muted">The campaign text says “${esc(asWritten)}”; the 2024 SRD 5.2.1 stat block is <b>${esc(m.name)}</b>.</p>` : ''}${renderStatBlock(m)}<div class="btnrow"><button class="primary" data-add>Add to Initiative Tracker</button><button data-open>Open in SRD Monsters</button></div>` });
  $('[data-add]', md.body).onclick = () => { Combat.addFoes([{ count: 1, name: m.name }]); };
  $('[data-open]', md.body).onclick = () => { md.close(); go('rules/monsters', { id: m.id }); };
}
