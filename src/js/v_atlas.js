/* Structured campaign views (DnD Bot "DM Atlas export" campaigns such as Vesperine): mystery board, adventures with
   encounters, NPCs/locations with three-way visibility and reveal controls, factions, maps, read-aloud library,
   DM guide and known gaps. Used when a campaign doc has  structured: true. */
'use strict';
const TAB_LABELS = { overview: 'Overview', sessions: 'Sessions', mystery: 'Mystery', adventures: 'Adventures', npcs: 'NPCs', locations: 'Locations', factions: 'Factions', maps: 'Maps', bestiary: 'Bestiary', readaloud: 'Read-Aloud', solo: 'Solo Book', dmguide: 'DM Guide', gaps: 'Known Gaps', items: 'Items', tables: 'Tables', secrets: 'Secrets', handbook: 'Player Handbook' };
function visBadge(v, revealed) {
  if (v === 'player') return '<span class="vis vis-player" title="Safe to show players at any time">👁 Player-safe</span>';
  if (v === 'gated') return revealed ? '<span class="vis vis-revealed" title="Was hidden until a reveal; you have revealed it">✨ Revealed</span>' : '<span class="vis vis-gated" title="DM-only until you reveal it">⏳ Hidden until revealed</span>';
  return '<span class="vis vis-dm" title="Never shown to players">🔒 DM only</span>';
}
function revealCtl(key, label) {
  const on = isRevealed(key);
  return `<label class="tgl reveal ${on ? 'on' : ''}"><input type="checkbox" data-reveal="${esc(key)}" ${on ? 'checked' : ''}> <b>${on ? 'Revealed' : 'Reveal'}</b> ${label ? esc(label) : ''}</label>`;
}
function bindReveals(el) {
  $$('[data-reveal]', el).forEach(cb => cb.onchange = () => { setReveal(cb.dataset.reveal, cb.checked); toast(cb.checked ? 'Revealed — the player window now shows it.' : 'Hidden from the player window again.', 'good'); renderView(); });
}
const A = {
  npc: (c, id) => (c.npcs || []).find(n => n.id === id), loc: (c, id) => (c.locations || []).find(l => l.id === id),
  fac: (c, id) => (c.factions || []).find(f => f.id === id), adv: (c, id) => (c.adventures || []).find(a => a.id === id),
  clue: (c, id) => ((c.mystery || {}).clues || []).find(x => x.id === id), ra: (c, id) => (c.readAloud || []).find(r => r.id === id), map: (c, id) => (c.maps || []).find(m => m.id === id)
};
function link(tab, id, text, extra = {}) { return `<a href="#" class="xref" data-go="${esc(tab)}" data-id="${esc(id)}"${extra.m ? ` data-m="${esc(extra.m)}"` : ''}>${esc(text)}</a>`; }
function links(c, kind, ids) {
  const tab = { npc: 'npcs', loc: 'locations', adv: 'adventures', fac: 'factions', map: 'maps', ra: 'readaloud' }[kind];
  return (ids || []).map(id => { const r = A[kind](c, id); return r ? link(tab, id, r.name || r.title || id) : esc(id); }).join(', ') || '<span class="muted">—</span>';
}
function bindXrefs(el) {
  $$('[data-go]', el).forEach(a => a.onclick = ev => { ev.preventDefault(); const p = { tab: a.dataset.go, id: a.dataset.id }; if (a.dataset.m) { p.m = a.dataset.m; p.id = ''; p.clue = a.dataset.id; } go('guide/campaign', p); });
}
/* Generic list + detail with search. items: [{id, label, sub, group}] */
function atlasList(items, params, detail, opts = {}) {
  const q = (params.q || '').toLowerCase(); const f = params.f || '';
  const vis = items.filter(x => (!q || (x.label + ' ' + (x.sub || '') + ' ' + (x.search || '')).toLowerCase().includes(q)) && (!f || x.group === f || (x.groups || []).includes(f)));
  const cur = items.find(x => x.id === params.id) || vis[0] || items[0];
  const groups = opts.filter || [];
  return `<div class="ld"><div class="ld-list wide"><div class="ld-head">${esc(opts.head || '')}</div>
    <div class="filters"><input type="search" id="aq" placeholder="Search…" value="${esc(params.q || '')}" data-allow-refresh="1">${groups.length ? `<select id="af"><option value="">${esc(opts.all || 'All')}</option>${groups.map(g => `<option value="${esc(g[0])}" ${g[0] === f ? 'selected' : ''}>${esc(g[1])}</option>`).join('')}</select>` : ''}</div>
    <div class="slist" data-keep-scroll="al">${vis.map(x => `<button class="srow ${x === cur ? 'on' : ''}" data-aid="${esc(x.id)}" style="${x.depth ? 'padding-left:' + (10 + x.depth * 14) + 'px' : ''}"><b>${x.label}</b><span class="tags">${x.tag || ''}</span>${x.sub ? `<small>${x.sub}</small>` : ''}</button>`).join('') || '<p class="muted pad">No matches.</p>'}</div></div>
    <div class="ld-detail parch" data-keep-scroll="ad">${cur ? detail(cur.id) : ''}</div></div>`;
}
function bindAtlasList(el, params) {
  const inp = $('#aq', el); if (!inp) return;
  inp.oninput = debounce(() => go('guide/campaign', Object.assign({}, params, { q: inp.value, id: '' })), 250);
  if (params.q) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  const sel = $('#af', el); if (sel) sel.onchange = () => go('guide/campaign', Object.assign({}, params, { f: sel.value, id: '' }));
  $$('[data-aid]', el).forEach(b => b.onclick = () => go('guide/campaign', Object.assign({}, params, { id: b.dataset.aid })));
}
const dl = rows => `<dl class="atl-dl">${rows.filter(r => r[1] !== undefined && r[1] !== null && r[1] !== '' && !(Array.isArray(r[1]) && !r[1].length)).map(([k, v, badge]) => `<dt>${esc(k)} ${badge || ''}</dt><dd>${Array.isArray(v) ? `<ul>${v.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : (typeof v === 'string' && v.startsWith('\u0000') ? v.slice(1) : esc(String(v)))}</dd>`).join('')}</dl>`;
const raw = h => '\u0000' + h;   /* marks already-escaped HTML for dl() */

/* ---------- NPCs ---------- */
function atlasNpcDetail(c, id, st) {
  const n = A.npc(c, id); const v = npcView(n.id, st); const key = 'npc:' + n.id; const rev = isRevealed(key, st);
  const p = ((c.player || {}).npcs || []).find(x => x.id === n.id); const f = p ? playerFace(p, st) : null;
  const a = n.art || {}; const dmKey = dmPortrait(n, st);
  const susp = ((c.mystery || {}).suspects || []).find(s => s.npc === n.id);
  const clues = ((c.mystery || {}).clues || []).filter(x => (x.points_to_npcs || []).includes(n.id));
  const fac = A.fac(c, n.faction);
  return `<div class="npc-rich"><div class="npc-top">
    <div class="npc-arts">${dmKey ? artBox(dmKey, n.name, 'portrait', (a.spicy && !v.std ? 'Alternate (pin-up) portrait' : n.disguised ? 'True form' : 'Portrait')) : `<div class="artbox noportrait"><div class="artph">No portrait${n.portraitStatus === 'missing' ? ' in the source' : ''}</div></div>`}
      ${a.guise && a.guise.key ? artBox(a.guise.key, n.displayName, 'portrait guise', (n.disguised || (a.guise.vis === 'player' && !(a.portrait && a.portrait.key)) ? 'Cover identity' : 'Mortal guise') + (n.aliases.find(x => x.kind === 'guise') ? ': ' + esc(n.aliases.find(x => x.kind === 'guise').name) : '')) : ''}
      ${a.revealed && a.revealed.key ? artBox(a.revealed.key, n.name, 'portrait guise', 'Revealed form ' + visBadge('gated', rev)) : ''}
      ${a.alternate && a.alternate.key ? artBox(a.alternate.key, n.name, 'portrait guise', 'Alternate portrait') : ''}</div>
    <div class="npc-id"><h2 class="deco">${esc(n.name)} ${n.entry === 'dm_only' ? visBadge('dm_only') : ''}</h2>
      ${n.disguised ? `<p class="guise-line">Players know them as <b>${esc(n.displayName)}</b>. True name ${visBadge('gated', rev)}${n.glamourDc ? ` <span class="pill">Glamour DC ${esc(n.glamourDc)}</span>` : ''}</p>` : ''}
      <p class="muted">${esc(n.role || '')}${fac ? ' · ' + link('factions', fac.id, fac.name) : ''}</p>
      ${n.entry === 'player' ? `<div class="npc-ctl">
        ${n.gated ? revealCtl(key, n.disguised ? (a.portrait && a.portrait.key ? `true name & true form to players` : `true name to players`) : (n.aliases.some(x => x.visibility === 'gated') ? 'mortal guise (' + n.aliases.filter(x => x.visibility === 'gated').map(x => x.name).join(', ') + ') to players' : a.revealed && a.revealed.key ? 'revealed form (portrait) to players' : 'to players')) : ''}
        ${a.spicy ? `<label class="tgl"><input type="checkbox" data-nv="std" ${v.std ? 'checked' : ''}> Use the standard portrait on my screen (default: alternate pin-up)</label>
        <label class="tgl warnl"><input type="checkbox" data-nv="spicyPlayer" ${v.spicyPlayer ? 'checked' : ''}> Show the alternate (pin-up) portrait in the player window${a.spicy.vis === 'gated' || n.disguised ? ' once revealed' : ''}</label>` : ''}
        <label class="tgl"><input type="checkbox" data-nv="hidden" ${v.hidden ? 'checked' : ''}> Hide from the player window</label></div>
        <p class="small">Player window shows: ${f && !f.hidden ? `<b>${esc(f.name)}</b>${f.img ? ' with a portrait' : ''}${f.aliases.length ? ' (also known as ' + f.aliases.map(esc).join(', ') + ')' : ''}` : 'nothing (hidden)'}.</p>` : '<p class="callout warn small">This NPC is DM-only: never shown to players.</p>'}
    </div></div>
    <h3>What players can know ${visBadge('player')}</h3>
    ${dl([['Shown as', n.displayName], ['Public role', n.publicRole], ['Seen at', n.publicLocation ? raw(link('locations', n.publicLocation, (A.loc(c, n.publicLocation) || {}).name || n.publicLocation)) : ''], ['Description', n.publicDescription], ['Influence', n.allureDc],
         ['Public aliases', n.aliases.filter(x => x.visibility === 'player').map(x => x.name)]])}
    ${n.gated ? `<h3>Hidden until revealed ${visBadge('gated', rev)}</h3>${dl([['True name', n.disguised ? n.name : ''], ['Guise names', n.aliases.filter(x => x.visibility === 'gated').map(x => x.name)], ['True-form portrait', a.portrait && a.portrait.vis === 'gated' ? 'Shown to players once revealed' : ''], ['Revealed-form portrait', a.revealed && a.revealed.vis === 'gated' ? 'Replaces the public portrait in the player window once revealed' : '']])}
      ${(n.revealRA || []).map(r => { const x = A.ra(c, r); return x ? `<div class="ra-card"><h4>Read-aloud: ${esc(x.title)} ${visBadge('gated', rev)}</h4>${richHTML(x.html)}</div>` : ''; }).join('')}` : ''}
    <h3>DM only ${visBadge('dm_only')}</h3>
    ${dl([['Secret', n.dmSecret], ['Motivations', n.motivations], ['Tells', n.tells], ['Reveal triggers', n.revealTriggers], ['True form', n.trueForm], ['Glamour DC', n.glamourDc],
         ['Really at', n.location ? raw(link('locations', n.location, (A.loc(c, n.location) || {}).name || n.location)) : ''], ['DM-only aliases', n.aliases.filter(x => x.visibility === 'dm_only').map(x => x.name)],
         ['Stats', n.stat && n.stat.source !== 'none' ? `${n.stat.source === 'srd-5.2.1' ? 'SRD 5.2.1: ' + n.stat.ref : n.stat.source === 'bestiary' ? 'Bestiary: ' + n.stat.ref : 'Custom' + (n.stat.base ? ' (base ' + n.stat.base + ')' : '')}${n.stat.cr ? ' · CR ' + n.stat.cr + ' (' + n.stat.xp + ' XP)' : ''}${n.stat.notes ? ' — ' + n.stat.notes : ''}` : (n.stat && n.stat.notes) || ''],
         ['Appears in', n.appearsIn.length ? raw(links(c, 'adv', n.appearsIn)) : ''], ['Source', [n.source, n.sourceSection].filter(Boolean).join(' · ')], ['Notes', n.notes]])}
    ${n.stat && n.stat.statName ? `<div class="btnrow"><button class="primary" data-npcfoe="${esc(n.id)}">Add ${esc(n.name)} to the Initiative Tracker</button><span class="small muted">uses the ${esc(n.stat.statName)} stat block</span></div>` : ''}
    ${susp ? `<div class="callout"><b>Suspect in ${esc(c.mystery.title)}</b>${susp.is_killer ? ' <span class="pill bad">The killer</span>' : ''} — ${link('mystery', 'suspects', 'open the mystery board', { m: 'board' })}</div>` : ''}
    ${clues.length ? `<h4>Clues pointing to ${esc(n.name)}</h4><ul>${clues.map(x => `<li>${x.keystone ? '★ ' : ''}${esc(x.name)} <span class="muted">(${esc((A.loc(c, x.location) || {}).name || x.location)})</span></li>`).join('')}</ul>` : ''}
  </div>`;
}
function atlasNpcs(c, params, st) {
  const facs = (c.factions || []).filter(f => (c.npcs || []).some(n => n.faction === f.id)).map(f => [f.id, f.name]);
  const items = c.npcs.map(n => ({ id: n.id, label: esc(n.name), sub: esc(n.disguised ? 'as ' + n.displayName : (n.publicRole || n.role || '')), group: n.faction, search: n.displayName + ' ' + n.aliases.map(a => a.name).join(' '),
    tag: (n.gated ? (isRevealed('npc:' + n.id, st) ? '✨' : '⏳') : '') + (n.entry === 'dm_only' ? '🔒' : '') + (npcView(n.id, st).hidden ? '🙈' : '') }));
  return atlasList(items, params, id => atlasNpcDetail(c, id, st), { head: c.npcs.length + ' NPCs · ⏳ hidden until revealed · ✨ revealed', filter: facs, all: 'All factions' });
}
function bindAtlasNpcs(el, c, params) {
  bindAtlasList(el, params); bindReveals(el);
  const id = (A.npc(c, params.id) || {}).id || ($('[data-aid].on', el) || {}).dataset?.aid;
  $$('[data-nv]', el).forEach(cb => cb.onchange = async () => {
    const n = A.npc(c, id); const k = cb.dataset.nv;
    if (k === 'spicyPlayer' && cb.checked && !(await confirmBox('Show the pin-up portrait to players?', `<p>The player window will show the alternate (pin-up) portrait of <b>${esc(n.name)}</b>${n.disguised ? ' after you reveal them' : ''}. You can switch it off again at any time.</p>`, 'Show it'))) { cb.checked = false; return; }
    setNpcView(n.id, { [k]: cb.checked }); renderView();
  });
  $$('[data-npcfoe]', el).forEach(b => b.onclick = () => { const n = A.npc(c, b.dataset.npcfoe); Combat.addFoes([{ count: 1, stat: n.stat.statName, label: n.name, note: n.stat.notes || '' }]); });
}
/* ---------- Locations ---------- */
function atlasLocations(c, params, st) {
  const depth = l => { let d = 0, p = l; while (p && p.parent && d < 6) { p = A.loc(c, p.parent); d++; } return d; };
  const order = []; const kids = id => c.locations.filter(l => (l.parent || null) === id);
  const walk = (id) => kids(id).forEach(l => { order.push(l); walk(l.id); }); walk(null);
  c.locations.forEach(l => { if (!order.includes(l)) order.push(l); });
  const types = [...new Set(c.locations.map(l => l.type))].map(t => [t, placeType(t)]);
  const items = order.map(l => ({ id: l.id, label: esc(l.name), sub: esc(l.type), group: l.type, depth: params.q || params.f ? 0 : depth(l), tag: l.entry === 'dm_only' ? '🔒' : (l.clues.length ? '🔍' + l.clues.length : '') }));
  return atlasList(items, params, id => {
    const l = A.loc(c, id); const mp = A.map(c, l.map); const par = A.loc(c, l.parent);
    return `<h2 class="deco">${esc(l.name)} ${visBadge(l.entry === 'dm_only' ? 'dm_only' : 'player')}</h2><p class="muted">${esc(placeType(l.type))}${par ? ' · in ' + link('locations', par.id, par.name) : ''}${l.part ? ' · ' + esc(l.part) : ''}</p>
      <h3>What players can know ${l.entry === 'dm_only' ? visBadge('dm_only') : visBadge('player')}</h3>${dl([['Description', l.publicDescription], ['Travel from Vesperine', l.travel]])}
      <h3>DM only ${visBadge('dm_only')}</h3>${dl([['DM notes', l.dmNotes], ['NPCs here', l.npcs.length ? raw(links(c, 'npc', l.npcs)) : ''], ['Adventures', l.adventures.length ? raw(links(c, 'adv', l.adventures)) : ''], ['Source', l.sourceSection], ['Notes', l.notes]])}
      ${l.clues.length ? `<h4>Clues found here</h4><ul>${l.clues.map(x => { const k = A.clue(c, x); return k ? `<li>${k.keystone ? '★ ' : ''}${link('mystery', x, k.name, { m: 'clues' })} → ${links(c, 'npc', k.points_to_npcs)}</li>` : ''; }).join('')}</ul>` : ''}
      ${l.painted && l.painted.key ? `<h4>Painted map (no labels) ${visBadge(l.painted.vis)}</h4>${artBox(l.painted.key, l.name, 'mapimg', l.painted.vis === 'player' ? 'Shown in the player window under Places to Know' : 'DM-only: this site is hidden from players')}` : ''}
      ${l.keyedMap ? `<h4>Keyed map ${visBadge('dm_only')}</h4>${artBox(l.keyedMap, l.name + ' (keyed)', 'mapimg', 'DM/battle map: its numbers mark clue positions, so it never goes to players')}` : ''}
      ${mp && mp.ascii ? `<h4>${esc(mp.title)} ${visBadge(mp.vis)}</h4><pre class="asciimap">${esc(mp.ascii)}</pre>` : ''}
      <div class="btnrow"><button data-loc="${esc(l.name)}">Set as party location</button></div>`;
  }, { head: c.locations.length + ' locations', filter: types, all: 'All types' });
}
/* ---------- Factions & maps ---------- */
function atlasFactions(c, params) {
  return atlasList(c.factions.map(f => ({ id: f.id, label: esc(f.name), sub: esc(f.kind || ''), tag: f.vis === 'dm_only' ? '🔒' : '' })), params, id => {
    const f = A.fac(c, id);
    return `<h2 class="deco">${esc(f.name)} ${visBadge(f.vis)}</h2><p class="muted">${esc(f.kind || '')}</p><p>${esc(f.summary || '')}</p><h4>Members ${visBadge('dm_only')}</h4><p>${links(c, 'npc', f.members)}</p>`;
  }, { head: c.factions.length + ' factions' });
}
function atlasMaps(c, params) {
  return atlasList(c.maps.map(m => ({ id: m.id, label: esc(m.title), sub: esc(m.vis === 'player' ? 'Player-safe' : 'DM only'), tag: m.vis === 'player' ? '👁' : '🔒' })), params, id => {
    const m = A.map(c, id);
    return `<h2 class="deco">${esc(m.title)} ${visBadge(m.vis)}</h2>${m.painted ? `<h4>Painted player view (no labels) ${visBadge(m.paintedVis)}</h4>${artBox(m.painted, m.title, 'mapimg')}` : ''}${m.image ? `<h4>Keyed map ${visBadge('dm_only')}</h4>${artBox(m.image, m.title + ' (keyed)', 'mapimg', 'DM/battle map; never shown to players')}` : ''}${m.ascii ? `<pre class="asciimap big">${esc(m.ascii)}</pre>` : ''}${m.locations.length ? `<p><b>Locations on this map:</b> ${links(c, 'loc', m.locations)}</p>` : ''}${m.source ? `<p class="src">${esc(m.source.file)} lines ${esc(m.source.line_start)}–${esc(m.source.line_end)}</p>` : ''}`;
  }, { head: c.maps.length + ' maps' });
}
/* ---------- Mystery board ---------- */
const MYS_TABS = [['board', 'Suspects'], ['clues', 'Clues'], ['herrings', 'Red Herrings'], ['riddles', 'Riddles'], ['timeline', 'Timeline'], ['clock', '7-Night Clock'], ['solution', 'Solution & Climax'], ['endings', 'Endings']];
function clockNight(st) { return Math.min(7, Math.max(1, Number((st.clock || {}).night) || 1)); }
function atlasMystery(c, params, st) {
  const M = c.mystery; const m = params.m || 'board'; const found = st.cluesFound || {};
  const nm = id => (A.npc(c, id) || {}).name || id; let body = '';
  if (m === 'board') {
    body = `<div class="callout"><b>The victim:</b> ${esc(M.victim.public)} ${visBadge('dm_only')}<br><span class="small"><b>The truth:</b> ${esc(M.victim.dm)}</span></div>
    <div class="suspects">${M.suspects.map(s => { const cl = M.clues.filter(x => (x.points_to_npcs || []).includes(s.npc)); const n = A.npc(c, s.npc); const k = n && dmPortrait(n, st);
      return `<div class="suspect ${s.is_killer ? 'killer' : ''}">${k ? artBox(k, nm(s.npc), 'portrait') : ''}<h3>${link('npcs', s.npc, nm(s.npc))} <small class="muted">${esc(s.epithet || '')}</small>${s.is_killer ? ' <span class="pill bad">Killer</span>' : ''}</h3>
        <p class="small"><b>Claims:</b> ${esc(s.public.claimed_alibi || '')}</p><p class="small"><b>Looks guilty:</b> ${esc(s.public.looks_guilty || '')}</p>${s.public.flirt_dc ? `<p class="small"><b>Flirt:</b> ${esc(s.public.flirt_dc)}</p>` : ''}
        <details><summary>DM: secret, alibi truth, under pressure</summary><p class="small"><b>Secret:</b> ${esc(s.dm.secret || '')}</p><p class="small"><b>Alibi:</b> ${esc(s.dm.alibi_truth || '')}</p><p class="small"><b>Under pressure:</b> ${esc(s.dm.under_pressure || '')}</p></details>
        <p class="small"><a href="#" data-sus="${esc(s.npc)}">🔍 ${cl.filter(x => found[x.id]).length}/${cl.length} clues found point here</a></p></div>`; }).join('')}</div>`;
  } else if (m === 'clues') {
    const sus = params.sus || ''; const ks = params.ks === '1';
    const list = M.clues.filter(x => (!sus || (x.points_to_npcs || []).includes(sus)) && (!ks || x.keystone));
    const nf = M.clues.filter(x => found[x.id]).length; const nk = M.clues.filter(x => x.keystone && found[x.id]).length;
    body = `<div class="row between wrap"><p><b>${nf}/${M.clues.length}</b> clues found · <b>${nk}/${M.keystone_summary.count}</b> Keystones ★ <span class="muted small">(${esc(M.keystone_summary.note || '')})</span></p>
      <div class="btnrow"><select id="clsus"><option value="">Points to: anyone</option>${[...new Set(M.clues.flatMap(x => x.points_to_npcs || []))].map(id => `<option value="${esc(id)}" ${id === sus ? 'selected' : ''}>${esc(nm(id))}</option>`).join('')}</select><label class="tgl"><input type="checkbox" id="clks" ${ks ? 'checked' : ''}> Keystones only</label></div></div>
      <div class="tablewrap"><table class="tbl clues"><thead><tr><th>Found</th><th>Clue</th><th>Where found</th><th>How</th><th>Points to</th><th>From</th></tr></thead><tbody>${list.map(x => `<tr class="${found[x.id] ? 'found' : ''} ${params.clue === x.id ? 'hl' : ''}" id="clue-${esc(x.id)}"><td><input type="checkbox" data-found="${esc(x.id)}" ${found[x.id] ? 'checked' : ''} title="Mark found"></td><td>${x.keystone ? '<b title="Keystone">★</b> ' : ''}${esc(x.name)}${x.red_herring ? ' <span class="pill">red herring</span>' : ''}<div class="small muted">${esc(x.points_to || '')}</div></td><td>${link('locations', x.location, (A.loc(c, x.location) || {}).name || x.location)}</td><td class="small">${esc(x.method || '')}</td><td>${links(c, 'npc', x.points_to_npcs)}</td><td class="small">${x.adventure ? links(c, 'adv', [x.adventure]) : 'City'}</td></tr>`).join('')}</tbody></table></div>`;
  } else if (m === 'herrings') {
    body = M.red_herrings.map(h => `<div class="sec"><h3>${esc(h.name)}</h3><p><b>Truth:</b> ${esc(h.truth)}</p>${(h.clues || []).length ? `<p class="small">Clues: ${h.clues.map(id => esc((A.clue(c, id) || {}).name || id)).join('; ')}</p>` : ''}</div>`).join('');
  } else if (m === 'riddles') {
    body = M.riddles.map(r => `<div class="sec"><h3>${esc(r.title)} <small class="muted">· ${esc((A.loc(c, r.location) || {}).name || r.location || '')}</small></h3>${r.promptHtml ? `<div>${visBadge('player')}${richHTML(r.promptHtml)}</div>` : ''}<details><summary>Answer & hint ${visBadge('dm_only')}</summary><p><b>Answer:</b> ${esc(r.answer)}</p>${r.hint ? `<p><b>Hint:</b> ${esc(r.hint)}</p>` : ''}${(r.unlocks || []).length ? `<p class="small">Unlocks: ${r.unlocks.map(id => esc((A.clue(c, id) || {}).name || id)).join('; ')}</p>` : ''}</details></div>`).join('');
  } else if (m === 'timeline') {
    body = `<dl class="timeline-dl">${M.timeline.map(t => `<dt>${esc(t.when)}</dt><dd>${esc(t.event)} ${visBadge(typeof t.visibility === 'string' ? t.visibility : 'dm_only')}</dd>`).join('')}</dl>`;
  } else if (m === 'clock') {
    const n = clockNight(st);
    body = `<div class="clock-head"><button data-clock="-1" ${n <= 1 ? 'disabled' : ''}>◀ Previous night</button><div class="clock-now"><span>Night</span><b>${n}</b><span>of 7</span></div><button class="primary" data-clock="1" ${n >= 7 ? 'disabled' : ''}>Advance to Night ${Math.min(7, n + 1)} ▶</button><button class="mini" data-clock="0">Reset</button></div>
      <p class="small muted">The clock is saved with this campaign (and in session saves). Each side adventure costs one night.</p>
      <div class="clock">${M.clock.map(k => `<div class="night ${k.night === n ? 'now' : k.night < n ? 'past' : ''}"><h4>Night ${k.night}${k.night === n ? ' — tonight' : ''}</h4><p><b>The Unravelling:</b> ${esc(k.unravelling)}</p><p><b>The fey:</b> ${esc(k.fey)}</p></div>`).join('')}</div>`;
  } else if (m === 'solution') {
    const S = M.solution; const C = M.climax;
    body = `<div class="callout warn">🔒 The solution is DM-only.</div><h3>The killer: ${link('npcs', S.killer, nm(S.killer))}</h3><p>${esc(S.summary)}</p><h4>Method</h4><ol>${S.method.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      ${dl([['Motive', S.motive], ['What she wants', S.what_she_wants], ['Accusation rule', S.accusation_rule], ['Deep secret', S.deep_secret]])}
      <h3>Wrong accusations</h3><ul>${M.wrong_accusations.map(w => `<li><b>${esc(nm(w.npc))}:</b> ${esc(w.consequence)}</li>`).join('')}</ul>
      <h3>Climax: ${esc(C.title)}</h3><p>At ${link('locations', C.location, (A.loc(c, C.location) || {}).name || C.location)}. Candidates for Oathwarden:</p><ul>${C.candidates.map(x => `<li><b>${x.npc ? esc(nm(x.npc)) : esc(x.placeholder)}</b> — ${esc(x.basis)}</li>`).join('')}</ul><p><b>Allies who can arrive:</b> ${C.allies_arrive.map(esc).join('; ')}</p>`;
  } else if (m === 'endings') {
    body = M.endings.map(e => `<div class="sec"><h3>${esc(e.name)}</h3><p><b>Requires:</b> ${esc(e.requires)}</p><p>${esc(e.outcome)}</p><p class="small">${links(c, 'npc', e.npcs)} · ${links(c, 'loc', e.locations)}</p></div>`).join('') + `<h3>Fey endgame</h3><ul>${M.fey_endgame.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  }
  return `<div class="parch pad scrolly" data-keep-scroll="my"><div class="row between"><h2 class="deco">${esc(M.title)} ${visBadge('dm_only')}</h2><span class="pill">Night ${clockNight(st)} of 7</span></div>
    <div class="subtabs mys">${MYS_TABS.map(([k, t]) => `<button class="${k === m ? 'on' : ''}" data-mys="${k}">${t}</button>`).join('')}</div>${body}</div>`;
}
function bindAtlasMystery(el, c, params) {
  $$('[data-mys]', el).forEach(b => b.onclick = () => go('guide/campaign', { tab: 'mystery', m: b.dataset.mys }));
  $$('[data-sus]', el).forEach(a => a.onclick = ev => { ev.preventDefault(); go('guide/campaign', { tab: 'mystery', m: 'clues', sus: a.dataset.sus }); });
  const s = $('#clsus', el); if (s) s.onchange = () => go('guide/campaign', Object.assign({}, params, { sus: s.value }));
  const k = $('#clks', el); if (k) k.onchange = () => go('guide/campaign', Object.assign({}, params, { ks: k.checked ? '1' : '' }));
  $$('[data-found]', el).forEach(cb => cb.onchange = () => { Store.mutate(st => { st.cluesFound = Object.assign({}, st.cluesFound || {}); if (cb.checked) st.cluesFound[cb.dataset.found] = Date.now(); else delete st.cluesFound[cb.dataset.found]; }, 'clue'); renderView(); });
  $$('[data-clock]', el).forEach(b => b.onclick = () => { const d = Number(b.dataset.clock); Store.mutate(st => { const n = clockNight(st); st.clock = Object.assign({}, st.clock || {}, { night: d === 0 ? 1 : Math.min(7, Math.max(1, n + d)), at: Date.now() }); }, 'clock'); toast('Night ' + clockNight(Store.state) + ' of 7', 'good'); renderView(); });
  if (params.clue) { const r = $('#clue-' + CSS.escape(params.clue), el); if (r) r.scrollIntoView({ block: 'center' }); }
}
/* ---------- Adventures & encounters ---------- */
function encHTML(c, e, ai, ei) {
  return `<div class="enc ${e.variant_of ? 'variant' : ''} ${e.deadly ? 'deadly' : ''}"><div class="row between wrap"><b>⚔ ${esc(e.name)}</b><button class="primary" data-enc="${ai}:${ei}">Add to Initiative Tracker</button></div>
    ${e.deadly ? `<div class="deadly-banner" role="note"><b>☠ ${esc(e.label || 'Deadly: flee or bargain')}</b> <span class="small">Above the 2024 High budget. Play it as a chase, a bargain or a retreat, not a stand-up fight.</span>${(e.escape_options || []).length ? `<ul class="escapes">${e.escape_options.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>` : ''}
    <p>${e.creatures.map(x => `${x.count} × ${esc(x.name)} <span class="muted small">(CR ${esc(x.as_cr || x.cr)}${x.as_cr ? ' scaled' : ''}, ${x.xp_each} XP${x.ref.startsWith('npc:') ? ', NPC' : x.ref.startsWith('srd:') ? ', SRD 5.2.1' : ', Bestiary'})</span>`).join(' · ')}</p>
    <p class="small"><b>${e.total_xp.toLocaleString()} XP</b>${e.stated_xp ? ` (book says ${e.stated_xp.toLocaleString()}${e.stated_matches ? ' ✓' : ' ✗'})` : ''} · ${e.xp_check.map(x => `L${x.level}×${x.party_size}: <b>${esc(x.difficulty)}</b> <span class="muted">(${x.budget.low}/${x.budget.moderate}/${x.budget.high})</span>`).join(' · ')}</p>${e.notes ? `<p class="small muted">${esc(e.notes)}</p>` : ''}</div>`;
}
function atlasAdventures(c, params, st) {
  const kinds = [...new Set(c.adventures.map(a => a.kind))].map(k => [k, ({ 'side-adventure': 'Side adventures', lair: 'Lair', 'optional-lair': 'Optional lair', 'solo-entry': 'Solo entry adventures', 'city-event': 'City events', climax: 'Climax', seed: 'Adventure seeds' })[k] || k]);
  return atlasList(c.adventures.map(a => ({ id: a.id, label: esc(a.title), sub: esc(`${a.kind} · levels ${a.levels ? a.levels.min + '–' + a.levels.max : '?'} · ${(a.encounters || []).length} encounters`) + ((a.encounters || []).some(e => e.deadly) ? ' · <span class="dl-tag">☠ deadly</span>' : ''), group: a.kind, tag: isRevealed('tease:' + a.id, st) ? '👁' : '' })), params, id => {
    const ai = c.adventures.findIndex(a => a.id === id); const a = c.adventures[ai]; const solo = (c.solo && c.solo.adventures || []).findIndex(s => s.exportId === a.id);
    return `<h2 class="deco">${esc(a.title)} ${visBadge('dm_only')}</h2><p class="muted">${esc(a.section || '')} · Levels ${a.levels ? a.levels.min + '–' + a.levels.max : '?'}${a.regionName ? ' · ' + link('locations', a.region, a.regionName) : ''}${(a.factions || []).length ? ' · ' + links(c, 'fac', a.factions) : ''}</p>
      <div class="npc-ctl">${revealCtl('tease:' + a.id, 'Tease to players (title, hook, levels, region and tone only)')}${solo >= 0 ? `<button class="mini" data-solo="${solo}">Open in the Solo Book reader →</button>` : ''}</div>
      ${dl([['Hook', a.hook, visBadge('player')], ['Tone', a.tone, visBadge('player')], ['Time cost', a.time_cost], ['Situation (DM)', a.situation_dm]])}
      ${a.pitchHtml ? `<h4>Pitch ${visBadge('player')}</h4>${richHTML(a.pitchHtml)}` : ''}
      ${(a.scenes || []).length ? `<h3>Scenes</h3>${a.scenes.map(s => `<div class="scene"><b>${esc(s.name)}</b>${s.location ? ' <span class="muted small">· ' + link('locations', s.location, (A.loc(c, s.location) || {}).name || s.location) + '</span>' : ''}<p class="small">${esc(s.summary || '')}</p>${(a.encounters || []).map((e, ei) => e.scene === s.id ? encHTML(c, e, ai, ei) : '').join('')}</div>`).join('')}` : ''}
      ${(a.encounters || []).some(e => !(a.scenes || []).some(s => s.id === e.scene)) ? `<h3>Encounters</h3>${a.encounters.map((e, ei) => (a.scenes || []).some(s => s.id === e.scene) ? '' : encHTML(c, e, ai, ei)).join('')}` : ''}
      ${(a.riddles || []).length ? `<h3>Riddles</h3>${a.riddles.map(r => `<div class="sec"><b>${esc(r.title)}</b>${r.promptHtml ? richHTML(r.promptHtml) : `<p><i>${esc(r.first_line || '')}</i></p>`}<details><summary>Answer ${visBadge('dm_only')}</summary><p>${esc(r.answer || '')}</p>${r.hint ? `<p><b>Hint:</b> ${esc(r.hint)}</p>` : ''}${r.effect ? `<p>${esc(r.effect)}</p>` : ''}</details></div>`).join('')}` : ''}
      ${a.lair_actions ? (L => `<h3>Lair actions: ${esc(L.name || '')}${L.initiative ? ` <span class="muted small">(initiative ${esc(L.initiative)})</span>` : ''}</h3><ul>${(L.actions || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`)(Array.isArray(a.lair_actions) ? { actions: a.lair_actions } : a.lair_actions) : ''}
      ${(a.endings || []).length ? `<h3>Endings</h3><ul>${a.endings.map(x => `<li><b>${esc(x.name || x.id)}</b>${x.hands_off_to ? ' → ' + link('locations', x.hands_off_to, (A.loc(c, x.hands_off_to) || {}).name || x.hands_off_to) : ''}${(x.carries || []).length ? ' · carries ' + x.carries.map(k => { const cl = A.clue(c, k); return cl ? link('mystery', k, cl.name, { m: 'clues' }) : esc(k); }).join(', ') : ''}</li>`).join('')}</ul>` : ''}
      ${dl([['Resolution paths', a.resolution_paths || []], ['Rewards', (a.rewards || []).map(r => r.name + (r.type ? ' (' + r.type + ')' : ''))]])}
      <p class="small"><b>Ties:</b> ${links(c, 'npc', (a.ties || {}).npcs)} · ${links(c, 'loc', (a.ties || {}).locations)}${(a.maps || []).length ? ' · Maps: ' + links(c, 'map', a.maps) : ''}</p>`;
  }, { head: c.adventures.length + ' adventures · ' + c.adventures.reduce((n, a) => n + (a.encounters || []).length, 0) + ' encounters', filter: kinds, all: 'All kinds' });
}
function bindAtlasAdventures(el, c, params) {
  bindAtlasList(el, params); bindReveals(el);
  $$('[data-enc]', el).forEach(b => b.onclick = () => { const [ai, ei] = b.dataset.enc.split(':').map(Number); Combat.addFoes(c.adventures[ai].encounters[ei].foes); });
  $$('[data-solo]', el).forEach(b => b.onclick = () => go('guide/campaign', { tab: 'solo', adv: b.dataset.solo }));
}
/* ---------- Read-aloud library, DM guide, gaps ---------- */
function atlasReadAloud(c, params, st) {
  const kinds = [...new Set(c.readAloud.map(r => r.kind))].map(k => [k, k.replace('_', '-')]);
  return atlasList(c.readAloud.map(r => ({ id: r.id, label: esc(r.title || r.html.replace(/<[^>]+>/g, '').slice(0, 60) + '…'), sub: esc(r.kind.replace('_', '-')), group: r.kind, search: r.html.replace(/<[^>]+>/g, ' '), tag: r.vis === 'gated' ? (isRevealed(raGate(r), st) ? '✨' : '⏳') : r.vis === 'dm_only' ? '🔒' : '👁' })), params, id => {
    const r = A.ra(c, id); const gate = raGate(r);
    return `<h2 class="deco">${esc(r.title || 'Read-aloud')} ${visBadge(r.vis, isRevealed(gate))}</h2><p class="muted">${esc(r.kind.replace('_', '-'))}${r.npcs.length ? ' · ' + links(c, 'npc', r.npcs) : ''}${r.adventure ? ' · ' + links(c, 'adv', [r.adventure]) : ''}</p>
      ${r.vis === 'gated' ? `<div class="npc-ctl">${revealCtl(gate, r.npcs.length ? '(reveals ' + ((A.npc(c, r.npcs[0]) || {}).name || '') + ' to players)' : 'to players')}</div>` : ''}
      <div class="solo-page">${richHTML(r.html)}</div><p class="src">${esc(r.source)}</p>`;
  }, { head: c.readAloud.length + ' read-alouds · 👁 player-safe · ⏳ hidden until revealed · 🔒 DM only', filter: kinds, all: 'All kinds' });
}
function raGate(r) { return r.npcs && r.npcs.length ? 'npc:' + r.npcs[0] : 'ra:' + r.id; }
function atlasDmGuide(c, params) {
  return atlasList(c.dmguide.map(s => ({ id: s.id, label: esc(s.title), search: s.html.replace(/<[^>]+>/g, ' ').slice(0, 4000) })), params, id => { const s = c.dmguide.find(x => x.id === id); return `<h2 class="deco">${esc(s.title)} ${visBadge('dm_only')}</h2>${richHTML(s.html)}`; }, { head: 'dm.md — the full DM reference' });
}
function atlasGaps(c, params) {
  const sev = params.f || ''; const open = x => !/^resolved/.test(x.status || 'open');
  const st = params.st || 'open'; const g = c.gaps.filter(x => (!sev || x.severity === sev) && (st === 'all' || (st === 'open' ? open(x) : !open(x))));
  const nOpen = c.gaps.filter(open).length;
  return `<div class="parch pad scrolly" data-keep-scroll="gp"><div class="row between wrap"><h2 class="deco">Known gaps & inconsistencies ${visBadge('dm_only')}</h2><div class="row"><select id="gst"><option value="open" ${st === 'open' ? 'selected' : ''}>Open (${nOpen})</option><option value="resolved" ${st === 'resolved' ? 'selected' : ''}>Resolved (${c.gaps.length - nOpen})</option><option value="all" ${st === 'all' ? 'selected' : ''}>All (${c.gaps.length})</option></select><select id="gsev"><option value="">All severities</option>${['high', 'medium', 'low'].map(s => `<option value="${s}" ${s === sev ? 'selected' : ''}>${s} (${c.gaps.filter(x => x.severity === s && (st === 'all' || (st === 'open' ? open(x) : !open(x)))).length})</option>`).join('')}</select></div></div>
    <p class="muted">Flagged by DnD Bot's export. Open items are not settled in the books yet: decide them before they come up at the table. Resolved items show how DnD Bot fixed them.</p>
    <div class="tablewrap"><table class="tbl"><thead><tr><th>Severity</th><th>Status</th><th>Category</th><th>Detail</th><th>Where</th><th>Suggestion / resolution</th></tr></thead><tbody>${g.map(x => `<tr class="sev-${esc(x.severity)} ${open(x) ? '' : 'gap-resolved'}"><td><span class="pill sev">${esc(x.severity)}</span></td><td class="small">${esc((x.status || 'open').replace(/-/g, ' '))}</td><td>${esc(x.category)}</td><td>${esc(x.detail)}</td><td class="small">${esc(x.where || '')}</td><td class="small">${x.resolution ? '<b>Resolved:</b> ' + esc(x.resolution) : esc(x.suggestion || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nothing here.</td></tr>'}</tbody></table></div></div>`;
}
function atlasOverview(c, st) {
  const M = c.mystery; const n = clockNight(st); const P = c.player || {};
  const pend = ((P.npcs || []).filter(p => p.gate && !isRevealed(p.gate, st))).length;
  return `<div class="parch pad scrolly" data-keep-scroll="ov"><h2 class="deco">${esc(c.title)}</h2><p class="muted">${esc(c.subtitle || '')}</p>
    ${c.dmWarning ? `<div class="callout warn">${esc(c.dmWarning)}</div>` : ''}<p class="lead">${esc(c.summary || '')}</p>
    <div class="facts">${Object.entries(c.facts || {}).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
    <div class="ov-cards">
      <button class="ov-card" data-go="mystery" data-id=""><b>🕯 ${esc(M.title)}</b><span>Night ${n} of 7 · ${Object.keys(st.cluesFound || {}).length}/${M.clues.length} clues found</span></button>
      <button class="ov-card" data-go="adventures" data-id=""><b>⚔ Adventures</b><span>${c.adventures.length} adventures · ${c.counts.encounters} encounters</span></button>
      <button class="ov-card" data-go="handbook" data-id=""><b>👁 Player window</b><span>${pend} reveal${pend === 1 ? '' : 's'} still hidden</span></button>
      <button class="ov-card" data-go="gaps" data-id=""><b>⚠ Known gaps</b><span>${(o => `${o.length} open (${o.filter(g => g.severity === 'high').length} high) · ${c.gaps.length - o.length} resolved`)(c.gaps.filter(g => !/^resolved/.test(g.status || 'open')))}</span></button>
    </div>
    ${(c.objects || []).length ? `<section class="sec"><h3>Objects of note</h3><div class="obj-cards">${c.objects.map(o => artBox(o.img, o.name, '', esc(o.name) + ' ' + visBadge(o.vis))).join('')}</div></section>` : ''}
    ${(c.overview || []).map(o => `<section class="sec"><h3>${esc(o.title)} ${o.audience === 'player' ? visBadge('player') : visBadge('dm_only')}</h3>${richHTML(o.html)}</section>`).join('')}
    ${c.source ? `<p class="src">${esc(c.source.note || '')}${c.source.validator ? ` Export validator: ${c.source.validator.errors} errors, ${c.source.validator.warnings} warnings.` : ''}</p>` : ''}</div>`;
}
/* DM control panel for everything that is hidden until revealed (shown on the Player Handbook tab). */
function atlasRevealPanel(c, st) {
  const P = c.player || {}; const npcs = (P.npcs || []).filter(p => p.gate);
  return `<h3>Reveals — what the player window shows ${visBadge('gated')}</h3><p class="small">Disguised fey appear under their mortal guise until you reveal them. Revealing switches their portrait to the true form and adds the reveal read-aloud.</p>
    <div class="reveal-grid">${npcs.map(p => { const n = A.npc(c, p.id); const f = playerFace(p, st); return `<div class="reveal-row">${revealCtl(p.gate, '')}<span><b>${esc(n ? n.name : p.name)}</b> <span class="muted small">players see: ${esc(f.name)}</span></span></div>`; }).join('')}</div>
    <h4>Tease adventures to players</h4><div class="reveal-grid">${(P.teasers || []).map(t => `<div class="reveal-row">${revealCtl(t.gate, '')}<span>${esc(t.title)}</span></div>`).join('')}</div>`;
}
const ATLAS_TABS = {
  overview: { html: (c, p, st) => atlasOverview(c, st), bind: (el) => bindXrefs(el) },
  mystery: { html: atlasMystery, bind: bindAtlasMystery },
  adventures: { html: atlasAdventures, bind: bindAtlasAdventures },
  npcs: { html: atlasNpcs, bind: bindAtlasNpcs },
  locations: { html: atlasLocations, bind: (el, c, p) => { bindAtlasList(el, p); $$('[data-loc]', el).forEach(b => b.onclick = () => { Store.mutate(s => { s.location = b.dataset.loc; }); toast('Party location set: ' + b.dataset.loc); }); } },
  factions: { html: atlasFactions, bind: (el, c, p) => bindAtlasList(el, p) },
  maps: { html: atlasMaps, bind: (el, c, p) => bindAtlasList(el, p) },
  readaloud: { html: atlasReadAloud, bind: (el, c, p) => { bindAtlasList(el, p); bindReveals(el); } },
  dmguide: { html: atlasDmGuide, bind: (el, c, p) => bindAtlasList(el, p) },
  gaps: { html: atlasGaps, bind: (el, c, p) => { $('#gsev', el).onchange = e => go('guide/campaign', { tab: 'gaps', f: e.target.value, st: p.st }); $('#gst', el).onchange = e => go('guide/campaign', { tab: 'gaps', st: e.target.value, f: p.f }); } }
};
