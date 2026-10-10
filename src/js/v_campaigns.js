/* Campaign library: picker, JSON campaign import, HTML/Markdown import, export, template. */
'use strict';
function switchCampaign(id, quiet) {
  id = id || null;
  if (id && !Library.get(id)) return false;
  Meta.set({ activeCampaignId: id });
  Store.load(id);
  if (!quiet) { renderChrome(); renderView(); toast(id ? 'Now running: ' + Library.get(id).title : 'No campaign selected — using the scratch table', 'good'); }
  return true;
}
const CAMPAIGN_TEMPLATE = {
  app: 'DM Atlas', format: 'dm-atlas-campaign', version: 1, id: 'my-campaign', title: 'My Campaign', shortTitle: 'My Campaign', system: 'D&D 2024 rules (5.5e)',
  summary: 'One or two sentences about what this campaign is about.',
  facts: { Levels: '1–5', Sessions: '6', Players: '4' },
  overview: [{ title: 'The Big Secret', audience: 'dm', html: '<p>What is really going on. Only the DM sees this.</p>' }],
  sessions: [{ number: 1, title: 'The First Night', summary: 'What happens this session.', scenes: [{ title: 'Opening Scene', readAloud: ['Boxed text you read to the players.'], encounters: [{ enemies: '3 Goblin Warriors', difficulty: 'Low', tactics: 'They flee when two fall.', foes: [{ count: 3, name: 'Goblin Warrior' }] }], html: '<p>Notes for running the scene.</p>' }] }],
  npcs: [{ name: 'Mara the Innkeeper', role: 'Innkeeper', look: 'Flour on her apron.', voice: 'Loud, cheerful.', wants: 'Her missing brother back.', secret: 'She owes the thieves money.', knows: 'Where the old mine entrance is.' }],
  locations: [{ name: 'The Lantern Inn', html: '<p>A warm inn at the crossroads.</p>' }],
  bestiary: [{ name: 'Mine Rat', meta: 'Small Beast, Unaligned', ac: 12, hp: 7, hpDice: '2d6', init: '+2', speed: '30 ft.', abilities: [['STR', '7', '−2', '−2'], ['DEX', '15', '+2', '+2'], ['CON', '11', '+0', '+0'], ['INT', '2', '−4', '−4'], ['WIS', '10', '+0', '+0'], ['CHA', '4', '−3', '−3']], lines: ['Senses Darkvision 30 ft.; Passive Perception 10', 'CR 1/8 (XP 25; PB +2)'], res: '', vul: '', imm: '', sections: [{ title: 'Actions', entries: [{ name: 'Bite', text: 'Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Piercing damage.' }] }] }],
  items: [{ name: 'Lucky Coin', type: 'Wondrous item, common', text: 'Once per day, reroll a d20 Test.' }],
  tables: [{ title: 'Rumors', columns: ['d4', 'Rumor'], rows: [['1', 'A rumor.'], ['2', 'Another rumor.'], ['3', 'A third rumor.'], ['4', 'A false rumor.']] }],
  secrets: [{ title: 'Who the villain is', html: '<p>DM only.</p>' }],
  handbook: { title: 'Player Handbook', lead: 'What the players should know.', sections: [{ id: 'welcome', title: 'Welcome', audience: 'player', html: '<p>Player-facing text only. No secrets here.</p>' }] }
};
/* Validate and clean an imported DM Atlas campaign JSON. All HTML is sanitized. */
function validateCampaignDoc(d) {
  const errs = [];
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { errs: ['The file is not a JSON object.'] };
  if (d.format !== CAMPAIGN_FORMAT) errs.push(d.format === SAVE_FORMAT ? 'This is a session save, not a campaign. Use Save / Resume → Import Campaign Save.' : 'Missing "format": "' + CAMPAIGN_FORMAT + '". Download the template to see the expected shape.');
  if (typeof d.title !== 'string' || !d.title.trim()) errs.push('The campaign needs a "title".');
  if (typeof d.version === 'number' && d.version > 1) errs.push('This campaign file is a newer format (version ' + d.version + ').');
  ['sessions', 'npcs', 'locations', 'bestiary', 'items', 'tables', 'secrets', 'overview', 'sections'].forEach(k => { if (d[k] !== undefined && !Array.isArray(d[k])) errs.push('"' + k + '" must be a list.'); });
  if (errs.length) return { errs };
  const doc = deepClone(d);
  const clean = o => { if (Array.isArray(o)) o.forEach(clean); else if (o && typeof o === 'object') Object.keys(o).forEach(k => { if (k === 'html' && typeof o[k] === 'string') o[k] = sanitizeHTML(o[k]); else clean(o[k]); }); };
  clean(doc);
  doc.app = 'DM Atlas'; doc.version = 1; delete doc.bundled;
  return { errs: [], doc };
}
/* ---------- Markdown → HTML (small, safe subset; output is sanitized afterwards) ---------- */
function mdToHTML(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n'); const out = []; let list = null, para = [], quote = [], table = [];
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/__(.+?)__/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  const flush = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } if (list) { out.push(`<${list.t}>${list.items.map(i => '<li>' + inline(i) + '</li>').join('')}</${list.t}>`); list = null; } if (quote.length) { out.push('<blockquote class="readaloud">' + inline(quote.join(' ')) + '</blockquote>'); quote = []; } if (table.length) { const rows = table.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(r => r.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim())); out.push('<table><thead><tr>' + rows[0].map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + rows.slice(1).map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>'); table = []; } };
  for (const l of lines) {
    let m;
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { flush(); out.push(`<h${m[1].length}>${inline(m[2].replace(/\s+#+\s*$/, ''))}</h${m[1].length}>`); }
    else if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(l)) { flush(); out.push('<hr>'); }
    else if ((m = l.match(/^\s*[-*+]\s+(.*)$/))) { if (para.length || quote.length || table.length || (list && list.t !== 'ul')) flush(); list = list || { t: 'ul', items: [] }; list.items.push(m[1]); }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { if (para.length || quote.length || table.length || (list && list.t !== 'ol')) flush(); list = list || { t: 'ol', items: [] }; list.items.push(m[1]); }
    else if ((m = l.match(/^>\s?(.*)$/))) { if (para.length || list || table.length) flush(); quote.push(m[1]); }
    else if (/^\s*\|.*\|\s*$/.test(l)) { if (para.length || list || quote.length) flush(); table.push(l); }
    else if (!l.trim()) flush();
    else { if (list || quote.length || table.length) flush(); para.push(l.trim()); }
  }
  flush(); return out.join('\n');
}
/* ---------- split HTML into sections by headings ---------- */
const KIND_RX = [['session', /\b(session|chapter|episode|act|part|adventure)\s*[\divxlc]+\b|^(session|chapter)\b/i], ['npc', /\b(npcs?|cast|characters|people|who'?s who|personalities)\b/i], ['location', /\b(locations?|places?|maps?|geography|grounds|regions?|settings?)\b/i], ['bestiary', /\b(bestiary|monsters?|creatures?|foes|enemies|stat blocks?)\b/i], ['item', /\b(items?|treasure|loot|magic items?|rewards?|equipment)\b/i], ['secret', /\b(secrets?|the truth|behind the scenes|what'?s really|hidden story)\b/i]];
function classifySection(title) { for (const [k, rx] of KIND_RX) if (rx.test(title)) return k; return 'overview'; }
function cleanTitle(t) { return String(t || '').replace(/\s+/g, ' ').replace(/^([IVXLC]+|\d+)[.)]\s+/, '').trim(); }
function splitByHeadings(html, fallbackTitle) {
  const doc = new DOMParser().parseFromString('<!doctype html><body>' + html + '</body>', 'text/html');
  const counts = [1, 2, 3, 4].map(n => doc.body.querySelectorAll('h' + n).length);
  let level = counts.findIndex(c => c >= 2) + 1; if (level <= 0) level = counts.findIndex(c => c >= 1) + 1;
  const h1 = doc.body.querySelector('h1'); const title = cleanTitle(h1 ? h1.textContent : '') || fallbackTitle;
  if (level <= 0) return { title, level: 0, sections: [{ title: title, html: doc.body.innerHTML.trim() }] };
  const sel = 'h' + level; const sections = []; let cur = { title: 'Introduction', nodes: [] };
  const walk = parent => { Array.from(parent.childNodes).forEach(n => {
    if (n.nodeType === 1 && n.matches(sel)) { if (cur.nodes.length || cur.title !== 'Introduction') sections.push(cur); cur = { title: cleanTitle(n.textContent), nodes: [] }; return; }
    if (n.nodeType === 1 && level > 1 && /^H[1-6]$/.test(n.tagName) && Number(n.tagName[1]) < level) return; /* skip the document title */
    if (n.nodeType === 1 && n.querySelector(sel)) { walk(n); return; }
    if (n.nodeType === 3 && !n.textContent.trim()) return;
    cur.nodes.push(n.cloneNode(true));
  }); };
  walk(doc.body); sections.push(cur);
  const toHTML = nodes => { const d = document.createElement('div'); nodes.forEach(x => d.appendChild(x)); return d.innerHTML.trim(); };
  return { title, level, sections: sections.map(s => ({ title: s.title, html: toHTML(s.nodes) })).filter(s => s.html || s.title !== 'Introduction') };
}
function subSplit(html) { const r = splitByHeadings(html, ''); return r.level && r.sections.length > 1 ? r.sections.filter(s => s.title !== 'Introduction' || s.html.replace(/<[^>]+>/g, '').trim()) : null; }
/* Turn parsed documents into (or merge into) a campaign doc. */
function buildCampaignFromDocs(docs, base) {
  const c = base ? deepClone(base) : { app: 'DM Atlas', format: CAMPAIGN_FORMAT, version: 1, title: docs[0].title, shortTitle: docs[0].title.slice(0, 40), system: 'D&D 2024 rules (5.5e)', summary: '', overview: [], sessions: [], npcs: [], locations: [], bestiary: [], items: [], tables: [], secrets: [], sections: [], handbook: null, source: { files: [] } };
  ['overview', 'sessions', 'npcs', 'locations', 'bestiary', 'items', 'tables', 'secrets', 'sections'].forEach(k => c[k] = c[k] || []);
  c.source = c.source || { files: [] }; c.source.files = (c.source.files || []).concat(docs.map(d => d.fileName));
  docs.forEach(d => {
    if (d.audience === 'player') {
      c.handbook = c.handbook && c.handbook.sections ? c.handbook : { title: d.title, lead: '', audience: 'player', sections: [] };
      d.sections.forEach((s, i) => { if (s.include) c.handbook.sections.push({ id: slug(s.title) + '-' + (c.handbook.sections.length + 1), title: s.title, audience: 'player', html: s.html }); });
      return;
    }
    d.sections.forEach(s => {
      if (!s.include) return;
      const sub = ['npc', 'location', 'item', 'bestiary'].includes(s.kind) ? subSplit(s.html) : null;
      const intro = sub && sub[0].title === 'Introduction' ? sub.shift() : null;
      if (s.kind === 'session') c.sessions.push({ number: c.sessions.length + 1, title: s.title.replace(/^session\s*\d+\s*[:.\-–—]?\s*/i, ''), summary: '', scenes: [], html: s.html, audience: 'dm' });
      else if (s.kind === 'npc') (sub || [s]).forEach(x => c.npcs.push({ name: x.title, html: x.html, audience: 'dm' }));
      else if (s.kind === 'location') (sub || [s]).forEach(x => c.locations.push({ name: x.title, html: x.html, audience: 'dm' }));
      else if (s.kind === 'item') (sub || [s]).forEach(x => c.items.push({ name: x.title, html: x.html, audience: 'dm' }));
      else if (s.kind === 'bestiary') (sub || [s]).forEach(x => c.bestiary.push({ name: x.title, html: x.html, audience: 'dm' }));
      else if (s.kind === 'secret') c.secrets.push({ title: s.title, html: s.html, audience: 'dm' });
      else c.overview.push({ title: s.title, html: s.html, audience: 'dm' });
      if (intro && intro.html) c.overview.push({ title: s.title, html: intro.html, audience: 'dm' });
    });
    if (!c.summary) { const paras = d.sections.filter(s => s.include).flatMap(s => (s.html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []).map(x => x.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())); const good = paras.find(x => x.length >= 60) || paras[0] || ''; c.summary = good.length > 260 ? good.slice(0, 257).replace(/\s+\S*$/, '') + '…' : good; }
  });
  return c;
}
async function parseImportFile(file) {
  const text = await readFileText(file); const name = file.name; const isMD = /\.(md|markdown|txt)$/i.test(name);
  let rawTitle = '';
  if (!isMD) { const t = text.match(/<title[^>]*>([^<]*)<\/title>/i); if (t) rawTitle = t[1].trim(); }
  const html = sanitizeHTML(isMD ? mdToHTML(text) : (text.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [null, text])[1]);
  const sp = splitByHeadings(html, rawTitle || name.replace(/\.[^.]+$/, ''));
  const guessPlayer = /handbook|player|student|guide for players/i.test(name + ' ' + sp.title) && !/\bdm\b|dungeon master|gm guide/i.test(name + ' ' + sp.title);
  return { fileName: name, title: sp.title, audience: guessPlayer ? 'player' : 'dm', sections: sp.sections.map(s => ({ title: s.title, html: s.html, kind: classifySection(s.title), include: true })), stripped: (text.match(/<script\b/gi) || []).length + (text.match(/\son[a-z]+\s*=/gi) || []).length };
}
function importPreview(docs) {
  const imported = Library.imported();
  const m = openModal({ title: 'Import campaign content — preview', wide: true, html: `
    <p>DM Atlas split ${docs.length === 1 ? 'the file' : 'these files'} by headings. Check each section's type, untick anything you don't want, and choose who may see each file. Scripts, event handlers, styles, images and embedded objects were removed.</p>
    <div class="row"><label class="fld"><span>Import into</span><select id="imtarget"><option value="new">A new campaign</option>${imported.map(c => `<option value="${esc(c.id)}">Add to: ${esc(c.title)}</option>`).join('')}</select></label><label class="fld grow"><span>New campaign title</span><input id="imtitle" value="${esc(docs.find(d => d.audience === 'dm') ? docs.find(d => d.audience === 'dm').title : docs[0].title)}"></label></div>
    ${docs.map((d, di) => `<fieldset class="imdoc"><legend>${esc(d.fileName)} — “${esc(d.title)}” · ${d.sections.length} sections${d.stripped ? ` · <span class="warn">${d.stripped} script/event-handler item(s) stripped</span>` : ''}</legend>
      <label class="fld sm"><span>This file is</span><select data-aud="${di}"><option value="dm" ${d.audience === 'dm' ? 'selected' : ''}>DM guide (DM only)</option><option value="player" ${d.audience === 'player' ? 'selected' : ''}>Player handbook (players may see)</option></select></label>
      <table class="tbl imtbl"><tr><th>Use</th><th>Section</th><th>Type</th><th>Preview</th></tr>${d.sections.map((s, si) => `<tr><td><input type="checkbox" data-inc="${di}:${si}" checked aria-label="include"></td><td><b>${esc(s.title)}</b></td><td><select data-kind="${di}:${si}" ${d.audience === 'player' ? 'disabled' : ''}>${['overview', 'session', 'npc', 'location', 'bestiary', 'item', 'secret'].map(k => `<option value="${k}" ${s.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></td><td class="muted small">${esc(s.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110))}…</td></tr>`).join('')}</table></fieldset>`).join('')}
    <div class="btnrow sticky"><button class="primary" data-ok>Import</button><button data-cancel>Cancel</button><label class="chk"><input type="checkbox" id="imswitch" checked> Switch to this campaign after import</label></div>` });
  $$('[data-aud]', m.body).forEach(s => s.onchange = () => { docs[s.dataset.aud].audience = s.value; $$(`[data-kind^="${s.dataset.aud}:"]`, m.body).forEach(x => x.disabled = s.value === 'player'); });
  $$('[data-inc]', m.body).forEach(c => c.onchange = () => { const [a, b] = c.dataset.inc.split(':'); docs[a].sections[b].include = c.checked; });
  $$('[data-kind]', m.body).forEach(c => c.onchange = () => { const [a, b] = c.dataset.kind.split(':'); docs[a].sections[b].kind = c.value; });
  $('#imtarget', m.body).onchange = e => { $('#imtitle', m.body).disabled = e.target.value !== 'new'; };
  $('[data-cancel]', m.body).onclick = () => m.close();
  $('[data-ok]', m.body).onclick = () => {
    const target = $('#imtarget', m.body).value;
    let doc;
    if (target === 'new') { doc = buildCampaignFromDocs(docs, null); doc.title = $('#imtitle', m.body).value.trim() || doc.title; doc.shortTitle = doc.title.slice(0, 40); doc.id = slug(doc.title); doc = Library.add(doc); }
    else { doc = buildCampaignFromDocs(docs, Library.get(target)); doc.id = target; Library.update(doc); }
    if (!doc) { toast('Could not save the campaign (browser storage may be full)', 'bad'); return; }
    Sync.post({ t: 'library' });
    m.close();
    if ($('#imswitch', m.body).checked) switchCampaign(doc.id); else renderView();
    toast(`Imported “${doc.title}”: ${doc.sessions.length} sessions, ${doc.npcs.length} NPCs, ${doc.locations.length} locations${doc.handbook ? ', player handbook ' + doc.handbook.sections.length + ' sections' : ''}`, 'good', 6000);
  };
  return m;
}
VIEWS.campaigns = {
  title: 'Campaigns', render(el) {
    const all = Library.all(); const act = Store.cid;
    el.innerHTML = `<div class="camps scrolly" data-keep-scroll="camps"><div class="row between"><h2 class="deco">Choose your campaign</h2><div class="btnrow"><button class="primary" data-imjson>⬆ Import campaign (.json)</button><button class="primary" data-imhtml>⬆ Import HTML / Markdown</button><button data-imart>🖼 Import art pack</button><button data-tpl>⬇ Download campaign template</button></div></div>
      <p class="muted">Each campaign keeps its own party, combat, notes and saves. Switching never mixes them.</p>
      <div class="campgrid">${(() => { const s = LS.get(K.camp(null), null); return `<article class="campcard parch none ${!act ? 'active' : ''}"><h3 class="deco">No campaign</h3><p class="muted small">Empty scratch table</p><p>Run without a campaign: lessons, rules, references and tools all work. Characters and fights you add are kept on a separate scratch table that never mixes with a campaign.</p><p class="small">${s && s.party.length ? 'Scratch table: ' + s.party.length + ' characters' : 'Scratch table is empty'}</p><div class="btnrow">${!act ? '<span class="pill on">▶ Selected now</span>' : '<button data-none>Use no campaign</button>'}<button data-blank>✚ Start a blank campaign</button></div></article>`; })()}${all.map(c => { const s = LS.get(K.camp(c.id), null); return `<article class="campcard parch ${c.id === act ? 'active' : ''}"><h3 class="deco">${esc(c.title)}</h3><p class="muted small">${c.bundled ? 'Bundled with DM Atlas' : 'Imported ' + (c.importedAt ? new Date(c.importedAt).toLocaleDateString() : '')}${c.system ? ' · ' + esc(c.system) : ''}</p>
        <p>${esc((c.summary || '').slice(0, 260))}</p>
        <div class="facts small">${['sessions', 'npcs', 'locations', 'bestiary'].map(k => `<div><span>${k}</span><b>${(c[k] || []).length}</b></div>`).join('')}<div><span>handbook</span><b>${c.handbook && c.handbook.sections ? c.handbook.sections.length : 0}</b></div></div>
        ${c.art ? `<p class="small artstat" data-artc="${esc(c.id)}">🖼 Art: checking…</p>` : ''}
        <p class="small">${s ? `Your progress: ${s.party.length} characters · last played ${fmtTime(s.updatedAt)}` : 'Not started yet'}</p>
        <div class="btnrow">${c.id === act ? '<span class="pill on">▶ Running now</span><button data-open>Open guide</button>' : `<button class="primary" data-run="${esc(c.id)}">Run this campaign</button>`}<button data-exp="${esc(c.id)}">⬇ Export</button>${c.handbook ? `<button data-hb="${esc(c.id)}">👁 Player handbook</button>` : ''}${c.bundled ? '' : `<button class="danger" data-rm="${esc(c.id)}">Remove</button>`}</div></article>`; }).join('')}</div>
      <details class="parch pad"><summary><b>How campaign import works</b></summary>
        <ul><li><b>DM Atlas campaign JSON</b> (<code>"format": "dm-atlas-campaign"</code>): full structure — sessions with scenes and encounters, NPCs, locations, bestiary stat blocks, items, tables, secrets and an optional player handbook. Download the template to start one.</li>
        <li><b>HTML or Markdown</b> (.html, .htm, .md): DM Atlas splits the document by its headings and guesses each section's type from its title (Session…, Cast/NPCs, Places, Bestiary, Items, Secrets). You review and adjust before anything is saved. All scripts, event handlers, styles, forms, images and embedded content are removed.</li>
        <li>Mark a file as <b>Player handbook</b> to make it available in the “Show player handbook” window. Everything else is treated as DM-only.</li>
        <li><b>Art packs</b> (<code>.dmatlas-art.json</code>, <code>"format": "dm-atlas-art"</code>): portraits and monster art for a campaign, kept out of the main HTML. Import once; the images are stored in this browser (IndexedDB) and work from a file on a jump drive. When DM Atlas is served over http(s) (for example GitHub Pages), it also finds images automatically in an <code>art/&lt;campaign-id&gt;/</code> folder next to the HTML.</li>
        <li>Imported campaigns are stored in this browser. Use Export to keep a copy on your jump drive.</li></ul></details></div>`;
    $$('[data-run]', el).forEach(b => b.onclick = () => switchCampaign(b.dataset.run));
    const nb = $('[data-none]', el); if (nb) nb.onclick = () => switchCampaign(null);
    $('[data-blank]', el).onclick = startBlankCampaign;
    const op = $('[data-open]', el); if (op) op.onclick = () => go('guide/campaign');
    $$('[data-exp]', el).forEach(b => b.onclick = () => { const c = deepClone(Library.get(b.dataset.exp)); delete c.bundled; download(slug(c.id) + '.dmatlas.json', JSON.stringify(c, null, 2)); });
    $$('[data-hb]', el).forEach(b => b.onclick = () => { if (b.dataset.hb !== Store.cid) switchCampaign(b.dataset.hb); openPlayerHandbook(); });
    $$('[data-rm]', el).forEach(b => b.onclick = async () => { const c = Library.get(b.dataset.rm); if (await confirmBox('Remove ' + esc(c.title) + '?', '<p>This deletes the imported campaign <b>and its saved party, combat and notes</b> from this browser. Export it first if you want to keep it.</p>', 'Remove', true)) { Library.remove(c.id); Sync.post({ t: 'library' }); if (Store.cid === c.id) switchCampaign(null, true); renderChrome(); renderView(); } });
    $('[data-tpl]', el).onclick = () => download('dm-atlas-campaign-template.dmatlas.json', JSON.stringify(CAMPAIGN_TEMPLATE, null, 2));
    $('[data-imjson]', el).onclick = () => pickFiles('.json,application/json', false, async files => importCampaignJSON(await readFileText(files[0]), files[0].name));
    $('[data-imhtml]', el).onclick = () => pickFiles('.html,.htm,.md,.markdown,.txt,text/html,text/markdown', true, async files => importDocs(files));
    $('[data-imart]', el).onclick = pickArtPack;
    $$('[data-artc]', el).forEach(async p => {
      const c = Library.get(p.dataset.artc); const n = await ArtStore.count(c.id);
      const f = !n && location.protocol.startsWith('http') && await ArtStore.folderAvailable(c);
      p.innerHTML = n ? `🖼 Art: ${n} images stored in this browser <button class="mini" data-artclear="${esc(c.id)}">Remove art</button>` : f ? `🖼 Art: loaded from the <code>${esc(ArtStore.folder(c))}</code> folder` : `🖼 Art not loaded — <button class="mini" data-artpick>Import art pack</button> <span class="muted">(${esc((c.art.pack || '').split('/').pop())})</span>`;
      const pk = $('[data-artpick]', p); if (pk) pk.onclick = pickArtPack;
      const cl = $('[data-artclear]', p); if (cl) cl.onclick = async () => { if (await confirmBox('Remove stored art?', '<p>This removes the imported images for this campaign from this browser. Your campaign progress is not touched. You can import the art pack again at any time.</p>', 'Remove art', true)) { await ArtStore.clear(c.id); Sync.post({ t: 'art', cid: c.id }); renderView(); } };
    });
  }
};
function importCampaignChooser() {
  const m = openModal({ title: 'Import a campaign', html: `<p>What kind of file do you have?</p><div class="btnrow"><button class="primary" data-k="json">DM Atlas campaign (.json)</button><button class="primary" data-k="doc">HTML or Markdown document</button></div><p class="muted small">Need a starting point? <button class="mini" data-k="tpl">Download the campaign template</button></p>` });
  $$('[data-k]', m.body).forEach(b => b.onclick = () => { const k = b.dataset.k; if (k === 'tpl') { download('dm-atlas-campaign-template.dmatlas.json', JSON.stringify(CAMPAIGN_TEMPLATE, null, 2)); return; } m.close(); if (k === 'json') pickFiles('.json,application/json', false, async files => importCampaignJSON(await readFileText(files[0]), files[0].name)); else pickFiles('.html,.htm,.md,.markdown,.txt,text/html,text/markdown', true, async files => importDocs(files)); });
}
function startBlankCampaign() {
  const m = openModal({ title: 'Start a blank campaign', html: `<label class="fld"><span>Campaign name</span><input id="bcname" placeholder="e.g. The Shattered Coast"></label><label class="fld"><span>One-line summary (optional)</span><input id="bcsum"></label><p class="muted small">It starts with an empty party and notes. You can add sessions and NPC notes later by importing a campaign file into it, or just use the notebook.</p><div class="btnrow"><button class="primary" data-ok>Create and run it</button><button data-cancel>Cancel</button></div>` });
  $('[data-cancel]', m.body).onclick = () => m.close();
  $('[data-ok]', m.body).onclick = () => {
    const title = $('#bcname', m.body).value.trim(); if (!title) { $('#bcname', m.body).focus(); return; }
    const doc = Library.add({ app: 'DM Atlas', format: CAMPAIGN_FORMAT, version: 1, id: slug(title), title, shortTitle: title.slice(0, 40), system: 'D&D 2024 rules (5.5e)', summary: $('#bcsum', m.body).value.trim(), overview: [], sessions: [], npcs: [], locations: [], bestiary: [], items: [], tables: [], secrets: [], handbook: null, createdBlank: true });
    if (!doc) { toast('Could not save the campaign (browser storage may be full)', 'bad'); return; }
    Sync.post({ t: 'library' }); m.close(); switchCampaign(doc.id);
  };
}
function pickFiles(accept, multiple, cb) { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple; i.onchange = () => { if (i.files.length) cb(Array.from(i.files)); }; i.click(); }
async function importDocs(files) { try { const docs = []; for (const f of files) docs.push(await parseImportFile(f)); return importPreview(docs); } catch (e) { openModal({ title: 'Import failed', html: `<p>${esc(e.message)}</p><p>Nothing was changed.</p>` }); } }
async function importCampaignJSON(text, fname) {
  let d; try { d = JSON.parse(text); } catch (e) { openModal({ title: 'Not imported', html: `<p>${esc(fname)} is not valid JSON. Nothing was changed.</p>` }); return null; }
  if (d && d.format === ART_FORMAT) return importArtPack(d, fname);
  const { errs, doc } = validateCampaignDoc(d);
  if (errs.length) { openModal({ title: 'Not imported', html: `<ul class="errs">${errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul><p>Nothing was changed.</p>` }); return null; }
  const exists = Library.get(doc.id);
  const ok = await confirmBox('Import “' + esc(doc.title) + '”?', `<table class="tbl sum">${['sessions', 'npcs', 'locations', 'bestiary', 'items', 'tables', 'secrets'].map(k => `<tr><th>${k}</th><td>${(doc[k] || []).length}</td></tr>`).join('')}<tr><th>Player handbook</th><td>${doc.handbook && doc.handbook.sections ? doc.handbook.sections.length + ' sections' : 'none'}</td></tr></table>${exists ? `<p>A campaign with the id “${esc(doc.id)}” already exists${exists.bundled ? ' (bundled)' : ''}; this one will be added as a separate copy.</p>` : ''}<p>HTML inside the file has been sanitized.</p>`, 'Import');
  if (!ok) return null;
  const saved = Library.add(doc); if (!saved) return null;
  Sync.post({ t: 'library' }); switchCampaign(saved.id); return saved;
}
