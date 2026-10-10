/* Panel 4: Session tools — dice, events, NPCs, notebook, save & resume. */
'use strict';
const pickOne = a => a[rollDie(a.length) - 1];
const Tools = {
  roll(expr, mode = 'normal', label = '') {
    const r = rollExpr(expr, mode);
    if (r.error) { toast(r.error, 'warn'); return null; }
    Store.mutate(s => { s.dice.unshift({ id: uid('r'), at: Date.now(), expr: r.expr + (mode !== 'normal' ? ' (' + (mode === 'adv' ? 'adv' : 'dis') + ')' : ''), total: r.total, detail: r.detail, label }); s.dice = s.dice.slice(0, 30); }, 'dice');
    if (App.route === 'screen' || App.route === 'tools/dice') renderView();
    toast((label ? label + ': ' : '') + r.expr + ' = ' + r.total, 'info', 2500);
    return r;
  }
};
VIEWS['tools/dice'] = {
  title: 'Dice', render(el) {
    const st = Store.state;
    el.innerHTML = `<div class="dice-wrap"><div class="parch pad"><h2 class="deco">Dice Roller</h2><p class="muted learn-only">For your own quick or secret rolls. Players roll physical dice and tell you the result; enter those in the attack helper.</p>
      <div class="dicebar big">${[4, 6, 8, 10, 12, 20, 100].map(d => `<button data-d="${d}">d${d}</button>`).join('')}</div>
      <div class="row"><label class="fld sm"><span>Number</span><input id="dn" type="number" min="1" max="100" value="1"></label><label class="fld sm"><span>Modifier</span><input id="dm" type="number" value="0"></label>
        <div class="seg" role="group" aria-label="Advantage"><button data-mode="normal" class="on">Normal</button><button data-mode="adv">Advantage</button><button data-mode="dis">Disadvantage</button></div></div>
      <div class="row"><input id="dexpr" placeholder="Or type an expression: 2d6+3, 1d20+5, 4d6…" class="wide"><button class="primary" id="droll">Roll</button></div>
      <div id="dres" class="bigresult">${st.dice[0] ? `<b>${esc(st.dice[0].total)}</b> <small>${esc(st.dice[0].expr)} · ${esc(st.dice[0].detail)}</small>` : '—'}</div>
      <p class="muted small">Advantage/Disadvantage applies to a single d20 (roll two, keep higher/lower).</p></div>
      <div class="parch pad"><div class="row between"><h3>Recent rolls</h3><button data-clr class="mini">Clear</button></div><ol class="recent scrolly">${st.dice.map(r => `<li><b>${esc(r.total)}</b> <span>${esc(r.expr)}</span> <small class="muted">${esc(r.detail)}${r.label ? ' · ' + esc(r.label) : ''} · ${new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></li>`).join('') || '<li class="muted">No rolls yet.</li>'}</ol></div></div>`;
    let mode = 'normal';
    $$('.seg button', el).forEach(b => b.onclick = () => { mode = b.dataset.mode; $$('.seg button', el).forEach(x => x.classList.toggle('on', x === b)); });
    $$('[data-d]', el).forEach(b => b.onclick = () => { const n = clamp(int0($('#dn', el).value) || 1, 1, 100), md = int0($('#dm', el).value); Tools.roll(n + 'd' + b.dataset.d + (md ? (md > 0 ? '+' : '') + md : ''), b.dataset.d === '20' && n === 1 ? mode : 'normal'); });
    const go2 = () => { const e = $('#dexpr', el).value.trim(); if (e) Tools.roll(e, /^1?d20([+-]\d+)?$/i.test(e.replace(/\s/g, '')) ? mode : 'normal'); };
    $('#droll', el).onclick = go2; $('#dexpr', el).onkeydown = e => { if (e.key === 'Enter') go2(); };
    $('[data-clr]', el).onclick = () => { Store.mutate(s => { s.dice = []; }); renderView(); };
  }
};
const EVENT_TABLES = {
  location: ['a rain-soaked crossroads with a toppled signpost', 'a crowded market on the busiest day of the week', 'a half-flooded cellar under an inn', 'a narrow mountain pass in fog', 'an abandoned watchtower full of birds', 'a ferry halfway across a fast river', 'a temple during a noisy festival', 'the edge of a dark forest at dusk', 'a ruined library with collapsing shelves', 'a noble\'s garden party', 'a mine entrance with broken carts', 'a frozen lake under a full moon', 'a smugglers\' cove at low tide', 'a road camp of travelling performers', 'a graveyard where the fog never lifts', 'a bridge guarded by bored soldiers', 'the rooftops of a crowded city', 'a goblin-picked battlefield', 'a hermit\'s overgrown cottage', 'the hold of a creaking ship'],
  scene: ['Ambush — someone attacks or springs a trap', 'Chase — someone or something is getting away', 'Negotiation — two sides want different things', 'Discovery — a clue, map or body is found', 'Rescue — someone is in immediate danger', 'Puzzle — a mechanism, riddle or lock bars the way', 'Social — a gathering where secrets slip', 'Stealth — get in or out unseen', 'Environment — weather or terrain becomes the enemy', 'Strange magic — something impossible happens', 'Rival party — another group wants the same thing', 'Plea for help — a stranger begs for aid'],
  stakes: ['a life hangs in the balance', 'an important clue could be lost forever', 'a valuable reward will go to someone else', 'the party\'s reputation in town is on the line', 'a friendly NPC will turn against them', 'a door to the next location closes for good', 'innocent bystanders will be hurt', 'the villain learns the party is coming', 'precious supplies or gear will be lost', 'a deadline gets much closer'],
  complication: ['it starts to pour with rain, or a storm rolls in', 'an innocent bystander wanders into the middle of it', 'the floor, bridge or ground starts to give way', 'a second group arrives with its own agenda', 'someone the party trusts is lying', 'a light source goes out', 'an alarm, bell or horn sounds', 'one enemy wants to surrender and talk', 'the obvious solution makes things worse', 'a valuable object is fragile and in the way', 'a creature is not what it seems', 'time runs short — they have only a few rounds']
};
VIEWS['tools/events'] = {
  title: 'Events', render(el) {
    const last = LS.get(K.ui + 'events', []) || [];
    el.innerHTML = `<div class="gen-wrap"><div class="parch pad"><h2 class="deco">Event Generator</h2><p class="muted learn-only">Use when the players go somewhere you didn't prepare, or the session needs a jolt. Change anything that doesn't fit — it's a prompt, not a rule.</p>
      <div class="btnrow"><button class="primary" data-gen>🌩 Generate event</button>${Object.keys(EVENT_TABLES).map(k => `<button data-one="${k}">Reroll ${k}</button>`).join('')}</div>
      <div id="evout" class="gencard">${last[0] ? evHTML(last[0]) : '<p class="muted">Press Generate.</p>'}</div>
      <div class="btnrow"><button data-note>📝 Add to notebook</button></div></div>
      <div class="parch pad"><h3>Earlier events</h3><ol class="scrolly recent">${last.slice(1).map(e => `<li>${evHTML(e, true)}</li>`).join('') || '<li class="muted">None yet.</li>'}</ol></div></div>`;
    let cur = last[0] || null;
    const save = (e, replace) => { const l = LS.get(K.ui + 'events', []) || []; if (replace) l[0] = e; else l.unshift(e); LS.set(K.ui + 'events', l.slice(0, 15)); };
    $('[data-gen]', el).onclick = () => { cur = { location: pickOne(EVENT_TABLES.location), scene: pickOne(EVENT_TABLES.scene), stakes: pickOne(EVENT_TABLES.stakes), complication: pickOne(EVENT_TABLES.complication) }; save(cur); renderView(); };
    $$('[data-one]', el).forEach(b => b.onclick = () => { if (!cur) return; cur[b.dataset.one] = pickOne(EVENT_TABLES[b.dataset.one]); save(cur, true); $('#evout', el).innerHTML = evHTML(cur); });
    $('[data-note]', el).onclick = () => { if (!cur) return; Store.mutate(s => { s.notes = (s.notes || '') + `\n\n## Event\nWhere: ${cur.location}\nScene: ${cur.scene}\nStakes: ${cur.stakes}\nComplication: ${cur.complication}`; }); toast('Added to the notebook'); };
  }
};
function evHTML(e, short) { return short ? `<b>${esc(e.scene.split(' — ')[0])}</b> at ${esc(e.location)}; ${esc(e.stakes)}; ${esc(e.complication)}.` : `<dl class="gen"><dt>Location</dt><dd>${esc(e.location)}</dd><dt>Scene type</dt><dd>${esc(e.scene)}</dd><dt>Stakes</dt><dd>If the party fails, ${esc(e.stakes)}.</dd><dt>Complication</dt><dd>Halfway through, ${esc(e.complication)}.</dd></dl>`; }
const NPC_TABLES = {
  first: ['Alda', 'Bram', 'Cass', 'Dorrin', 'Edda', 'Fenn', 'Garret', 'Hilde', 'Ivo', 'Jessa', 'Kell', 'Lio', 'Marta', 'Nim', 'Osric', 'Pell', 'Quill', 'Rosa', 'Sten', 'Tamsin', 'Ulla', 'Vane', 'Wren', 'Yorick', 'Zara', 'Mirela', 'Tobin', 'Esk', 'Brisa', 'Holt'],
  last: ['Ashdown', 'Barrow', 'Coldbrook', 'Dunmore', 'Emberly', 'Flint', 'Greaves', 'Hollins', 'Ironside', 'Juniper', 'Kettle', 'Lark', 'Marsh', 'Nettle', 'Oakes', 'Pike', 'Quarry', 'Rook', 'Saltmarsh', 'Thorne', 'Underhill', 'Voss', 'Whitlock', 'Yew'],
  role: ['innkeeper', 'caravan guard', 'temple acolyte', 'dockhand', 'retired soldier', 'herbalist', 'tax collector', 'street performer', 'blacksmith', 'messenger', 'noble\'s steward', 'ferry pilot', 'thief', 'scholar', 'farmer', 'mercenary captain', 'cult recruiter', 'bounty hunter', 'cartographer', 'beggar who sees everything'],
  motive: ['wants to pay off a dangerous debt', 'is protecting a younger sibling', 'wants revenge on a local bully', 'craves fame and a song about them', 'is hiding a magical secret', 'wants to leave town and start over', 'is loyal to a fault to their employer', 'is secretly spying for a rival', 'wants to find a missing friend', 'wants to prove themselves to a parent', 'needs medicine for someone sick', 'is collecting a strange set of objects'],
  trait: ['talks with their hands', 'never makes eye contact', 'laughs at their own jokes', 'speaks very formally', 'chews on a pipe or stick', 'whispers everything', 'is extremely polite, even when threatening', 'keeps counting coins', 'interrupts constantly', 'hums an old tune', 'is suspicious of magic', 'calls everyone "friend"', 'has a nervous twitch', 'tells long stories that go nowhere'],
  tactics: ['fights from range and retreats behind allies', 'rushes the biggest threat first', 'surrenders when Bloodied (at half HP or less) and offers information', 'uses hostages or bystanders as leverage', 'focuses on whoever is casting spells', 'sets traps and lures enemies in', 'calls for reinforcements at the first sign of trouble', 'duels the bravest opponent one-on-one', 'flees when the leader falls', 'uses darkness and terrain to stay hidden', 'shoves enemies prone, then strikes', 'bargains mid-fight'],
  note: ['knows a shortcut through the sewers', 'owes the party\'s patron money', 'has a pet ferret named Sir Nibbles', 'recently lost a bet and is in a foul mood', 'is the cousin of an important NPC', 'carries a map with one location circled', 'is terrified of a specific monster', 'has heard rumors about the villain', 'is secretly a decent cook', 'is wanted in a neighboring town']
};
VIEWS['tools/npcs'] = {
  title: 'NPCs & Captains', render(el) {
    const saved = LS.get(K.ui + 'npcs', []) || [];
    el.innerHTML = `<div class="gen-wrap"><div class="parch pad"><h2 class="deco">NPC &amp; Captain Generator</h2><p class="muted learn-only">Give every NPC one want and one memorable trait — that's enough to play them. "Tactics" helps when the NPC leads enemies in a fight.</p>
      <div class="btnrow"><button class="primary" data-gen>🎭 Generate NPC</button><button data-cap>⚔ Generate enemy captain</button></div>
      <div id="npcout" class="gencard">${saved[0] ? npcHTML(saved[0]) : '<p class="muted">Press Generate.</p>'}</div>
      <label class="fld"><span>Your notes on this NPC</span><textarea id="npcnote" rows="2">${esc(saved[0] ? saved[0].mynote || '' : '')}</textarea></label>
      <div class="btnrow"><button data-note>📝 Add to notebook</button></div></div>
      <div class="parch pad"><h3>Recent NPCs</h3><ol class="scrolly recent">${saved.slice(1).map(n => `<li><b>${esc(n.name)}</b>, ${esc(n.role)} — ${esc(n.motive)}; ${esc(n.trait)}.</li>`).join('') || '<li class="muted">None yet.</li>'}</ol></div></div>`;
    const gen = cap => { const n = { name: pickOne(NPC_TABLES.first) + ' ' + pickOne(NPC_TABLES.last), role: cap ? pickOne(['bandit captain', 'mercenary captain', 'cult leader', 'pirate first mate', 'goblin boss\'s lieutenant', 'corrupt guard sergeant']) : pickOne(NPC_TABLES.role), motive: pickOne(NPC_TABLES.motive), trait: pickOne(NPC_TABLES.trait), tactics: pickOne(NPC_TABLES.tactics), note: pickOne(NPC_TABLES.note), captain: !!cap }; const l = LS.get(K.ui + 'npcs', []) || []; l.unshift(n); LS.set(K.ui + 'npcs', l.slice(0, 20)); renderView(); };
    $('[data-gen]', el).onclick = () => gen(false); $('[data-cap]', el).onclick = () => gen(true);
    $('#npcnote', el).oninput = debounce(e => { const l = LS.get(K.ui + 'npcs', []) || []; if (l[0]) { l[0].mynote = e.target.value; LS.set(K.ui + 'npcs', l); } }, 300);
    $('[data-note]', el).onclick = () => { const n = (LS.get(K.ui + 'npcs', []) || [])[0]; if (!n) return; Store.mutate(s => { s.notes = (s.notes || '') + `\n\n## NPC: ${n.name} (${n.role})\nMotive: ${n.motive}\nTrait: ${n.trait}\nTactics: ${n.tactics}\nNote: ${n.note}${n.mynote ? '\nMy notes: ' + n.mynote : ''}`; }); toast('Added to the notebook'); };
  }
};
function npcHTML(n) { return `<h3>${esc(n.name)} <small>— ${esc(n.role)}</small></h3><dl class="gen"><dt>Motive</dt><dd>${esc(n.motive)}</dd><dt>Trait</dt><dd>${esc(n.trait)}</dd><dt>Tactics</dt><dd>${esc(n.tactics)}</dd><dt>Note</dt><dd>${esc(n.note)}</dd></dl>`; }
VIEWS['tools/notes'] = {
  title: 'Notebook', render(el) {
    const st = Store.state;
    el.innerHTML = `<div class="parch pad notes-wrap">${scratchBanner()}<div class="row between"><h2 class="deco">Session Notebook</h2><div><span id="nsaved" class="muted">Autosaves as you type</span> <button data-exp>⬇ Export as text</button></div></div>
      <div class="row"><label class="fld"><span>Party location</span><input id="nloc" value="${esc(st.location || '')}" placeholder="Where is the party right now?"></label></div>
      <label class="fld"><span>Recap (read this at the start of next session)</span><textarea id="nrecap" rows="3" placeholder="What happened, in a few sentences…">${esc(st.recap || '')}</textarea></label>
      <label class="fld grow"><span>Notes</span><textarea id="nnotes" placeholder="Names you invented, promises made, loot, consequences, things to follow up…">${esc(st.notes || '')}</textarea></label></div>`;
    bindScratch(el);
    const saveIt = debounce(() => { Store.mutate(s => { s.notes = $('#nnotes', el).value; s.recap = $('#nrecap', el).value; s.location = $('#nloc', el).value; }, 'notes'); const n = $('#nsaved', el); if (n) n.textContent = '✓ Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }, 400);
    ['#nnotes', '#nrecap', '#nloc'].forEach(s => $(s, el).addEventListener('input', () => { $('#nsaved', el).textContent = 'Saving…'; saveIt(); }));
    $('[data-exp]', el).onclick = () => { const s = Store.fresh(); download('dm-atlas-notes-' + slug(s.campaignName) + '-' + dateStamp() + '.txt', `${s.campaignName}\nExported ${new Date().toLocaleString()}\n\nPARTY LOCATION: ${s.location}\n\nRECAP:\n${s.recap}\n\nNOTES:\n${s.notes}\n`, 'text/plain'); };
  }
};

/* ---------- Save / resume ---------- */
function buildSave(label) {
  const st = deepClone(Store.fresh()); const c = Store.campaign();
  return { app: 'DM Atlas', format: SAVE_FORMAT, version: SAVE_VERSION, appVersion: APP_VERSION, savedAt: new Date().toISOString(), label: label || '', campaign: { id: Store.cid, title: c ? c.title : st.campaignName, importedDoc: c && !c.bundled ? c : undefined }, state: st };
}
function validateSave(d) {
  const errs = [];
  if (!d || typeof d !== 'object') return ['The file is not JSON data.'];
  if (d.app !== 'DM Atlas' || d.format !== SAVE_FORMAT) errs.push('This is not a DM Atlas campaign save (missing "app": "DM Atlas" / "format": "' + SAVE_FORMAT + '").');
  if (typeof d.version !== 'number') errs.push('The save has no version number.');
  else if (d.version > SAVE_VERSION) errs.push('This save was made by a newer version of DM Atlas (save version ' + d.version + '). This copy reads version ' + SAVE_VERSION + ' or older.');
  const s = d.state;
  if (!s || typeof s !== 'object') errs.push('The save has no campaign state.');
  else {
    if (!Array.isArray(s.party)) errs.push('The party list is missing or damaged.');
    else s.party.forEach((p, i) => { if (!p || typeof p !== 'object' || typeof p.name !== 'string') errs.push('Character #' + (i + 1) + ' is damaged.'); if (p && p.weapons && !Array.isArray(p.weapons)) errs.push('Character #' + (i + 1) + ' has damaged weapons.'); });
    if (s.combat && (typeof s.combat !== 'object' || (s.combat.combatants && !Array.isArray(s.combat.combatants)))) errs.push('The combat data is damaged.');
    if (s.log && !Array.isArray(s.log)) errs.push('The encounter log is damaged.');
  }
  return errs;
}
function saveSummaryHTML(d) {
  const s = d.state; const cb = s.combat || {};
  return `<table class="tbl sum"><tr><th>Campaign</th><td>${esc((d.campaign && d.campaign.title) || s.campaignName || '?')}</td></tr><tr><th>Saved</th><td>${esc(d.savedAt ? fmtTime(d.savedAt) : '?')}${d.label ? ' — ' + esc(d.label) : ''}</td></tr>
    <tr><th>Party</th><td>${s.party.length} character(s)${s.party.length ? ': ' + s.party.map(p => esc(p.name) + ' (HP ' + esc(p.hp === '' ? '?' : p.hp) + '/' + esc(p.maxHp === '' ? '?' : p.maxHp) + ', ' + ((p.weapons || []).length) + ' weapons)').join(', ') : ''}</td></tr>
    <tr><th>Location</th><td>${esc(s.location || '—')}</td></tr><tr><th>Recap</th><td>${esc((s.recap || '—').slice(0, 300))}</td></tr>
    <tr><th>Combat</th><td>${(cb.combatants || []).length} combatant(s)${cb.active ? ', round ' + cb.round + ', turn ' + ((cb.turn || 0) + 1) : ', not active'}</td></tr>
    <tr><th>Log &amp; notes</th><td>${(s.log || []).length} log entries · notes ${(s.notes || '').length} characters</td></tr></table>`;
}
const SaveUI = {
  async endnight() {
    const m = openModal({ title: 'End Night & Save', html: `<p>This saves a snapshot in this browser and downloads a campaign save file you can copy to your jump drive.</p>
      <label class="fld"><span>Party location</span><input id="enloc" value="${esc(Store.state.location || '')}"></label>
      <label class="fld"><span>Recap for next time</span><textarea id="enrecap" rows="4">${esc(Store.state.recap || '')}</textarea></label>
      <div class="btnrow"><button class="primary" data-ok>🌙 Save &amp; download</button><button data-only>Save in this browser only</button></div>
      <p class="muted small">Downloads go wherever your browser saves files (usually the Downloads folder). Copy the .json file to your jump drive yourself. The automatic browser save stays on this computer — it does not travel with the HTML file.</p>` });
    const doIt = dl => {
      Store.mutate(s => { s.location = $('#enloc', m.body).value; s.recap = $('#enrecap', m.body).value; s.lastSavedAt = Date.now(); s.log.unshift({ id: uid('log'), at: Date.now(), kind: 'session', text: 'Session ended and saved.' }); }, 'endnight');
      Store.addSnapshot('End of night ' + new Date().toLocaleDateString());
      if (dl) this.export(true);
      m.close(); toast('Night saved' + (dl ? ' and save file downloaded' : ''), 'good');
    };
    $('[data-ok]', m.body).onclick = () => doIt(true); $('[data-only]', m.body).onclick = () => doIt(false);
  },
  export(quiet) {
    const d = buildSave(); const c = Store.campaign();
    const name = 'dm-atlas-save-' + slug(c ? (c.shortTitle || c.title) : 'campaign') + '-' + dateStamp() + '.json';
    download(name, JSON.stringify(d, null, 2));
    if (!quiet) toast('Downloaded ' + name + ' — copy it to your jump drive', 'good', 5000);
  },
  import() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => { const f = inp.files[0]; if (f) this.importText(await readFileText(f), f.name); };
    inp.click();
  },
  async importText(text, fname) {
    let d; try { d = JSON.parse(text); } catch (e) { openModal({ title: 'Save not loaded', html: `<p><b>${esc(fname || 'The file')}</b> isn't valid JSON, so it can't be a DM Atlas save.</p><p>Nothing was changed.</p>` }); return false; }
    if (d && d.format === CAMPAIGN_FORMAT) { openModal({ title: 'This is a campaign file', html: '<p>This file is a DM Atlas <b>campaign</b> (adventure content), not a session save. Import it from the Campaigns screen.</p><div class="btnrow"><button class="primary" onclick="go(\'campaigns\')">Open Campaigns</button></div>' }); return false; }
    const errs = validateSave(d);
    if (errs.length) { openModal({ title: 'Save not loaded', html: `<p>DM Atlas checked <b>${esc(fname || 'the file')}</b> and found problems:</p><ul class="errs">${errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul><p><b>Your current data was not changed.</b></p>` }); return false; }
    let targetId = d.campaign && d.campaign.id;
    let note = '';
    if (!targetId || !Library.get(targetId)) {
      if (d.campaign && d.campaign.importedDoc && d.campaign.importedDoc.format === CAMPAIGN_FORMAT) note = `<p>The campaign “${esc(d.campaign.title)}” isn't in this browser's library yet. It's included in the save and will be added.</p>`;
      else { targetId = Store.cid; note = `<p class="warn">The save's campaign (${esc(d.campaign ? d.campaign.title : 'unknown')}) isn't in this browser's library, so it will be loaded into ${Store.campaign() ? 'the active campaign: <b>' + esc(Store.campaign().title) + '</b>' : 'the scratch table (no campaign selected)'}.</p>`; }
    }
    const cur = LS.get(K.camp(targetId), null);
    const ok = await confirmBox('Load this save?', `${saveSummaryHTML(d)}${note}<p>This <b>replaces</b> the current party, combat, log and notes for <b>${esc(targetId ? ((Library.get(targetId) || d.campaign || {}).title || targetId) : 'the scratch table')}</b>${cur ? ' (a snapshot of the current data is kept first, so you can go back via Resume)' : ''}.</p>`, 'Replace and load');
    if (!ok) return false;
    if (!Library.get(targetId) && d.campaign && d.campaign.importedDoc) { const doc = deepClone(d.campaign.importedDoc); const list = Library.imported(); list.push(doc); Library.saveImported(list); targetId = doc.id; }
    if (Store.cid !== targetId) { switchCampaign(targetId, true); }
    if (cur) Store.addSnapshot('Before loading ' + (fname || 'save'));
    const state = deepClone(d.state); /* unknown fields are kept as-is */
    Store.replace(state, 'import');
    renderChrome(); renderView(); toast('Save loaded', 'good');
    return true;
  },
  resume() {
    const snaps = Store.snapshots(); const st = Store.state;
    const m = openModal({ title: 'Resume Saved Session', wide: true, html: `<p>Your work autosaves in this browser for <b>${esc(Store.campaign() ? Store.campaign().title : 'the scratch table (no campaign)')}</b> (last change ${fmtTime(st.updatedAt)}). If you're on the same computer, just keep playing — nothing to do.</p>
      <h3>Snapshots in this browser</h3>${snaps.length ? `<table class="tbl"><tr><th>When</th><th>Label</th><th>Party</th><th></th></tr>${snaps.map((s, i) => `<tr><td>${fmtTime(s.at)}</td><td>${esc(s.label)}</td><td>${s.state.party.length} PCs${s.state.location ? ' · ' + esc(s.state.location) : ''}</td><td><button data-snap="${i}">Restore</button></td></tr>`).join('')}</table>` : '<p class="muted">No snapshots yet. End Night &amp; Save creates one.</p>'}
      <h3>From a jump drive or another computer</h3><p>Plug in the drive, click below, and pick the <code>dm-atlas-save-….json</code> file.</p><div class="btnrow"><button class="primary" data-imp>⬆ Import Campaign Save</button></div>` });
    $$('[data-snap]', m.body).forEach(b => b.onclick = async () => { const s = snaps[Number(b.dataset.snap)]; if (await confirmBox('Restore snapshot?', saveSummaryHTML({ state: s.state, savedAt: new Date(s.at).toISOString(), label: s.label, campaign: { title: s.state.campaignName } }) + '<p>The current data is snapshotted first.</p>', 'Restore')) { Store.addSnapshot('Before restoring snapshot'); Store.replace(deepClone(s.state), 'snapshot'); m.close(); renderView(); toast('Snapshot restored', 'good'); } });
    $('[data-imp]', m.body).onclick = () => { m.close(); this.import(); };
  }
};
VIEWS['tools/save'] = {
  title: 'Save & Resume', render(el) {
    const st = Store.state; const snaps = Store.snapshots();
    el.innerHTML = `<div class="parch pad scrolly save-wrap">${scratchBanner()}<h2 class="deco">Save &amp; Resume</h2>
      <div class="btngrid four"><button class="primary" data-a="endnight">🌙 End Night &amp; Save</button><button data-a="export">⬇ Export Campaign Save</button><button data-a="import">⬆ Import Campaign Save</button><button data-a="resume">↺ Resume Saved Session</button></div>
      <div class="facts"><div><span>Active campaign</span><b>${esc(Store.campaign() ? Store.campaign().title : 'No campaign (scratch table)')}</b></div><div><span>Last change</span><b>${fmtTime(st.updatedAt)}</b></div><div><span>Snapshots</span><b>${snaps.length}</b></div><div><span>Storage</span><b>${LS.ok ? 'Browser local storage' : 'Memory only — export before closing!'}</b></div></div>
      <h3>How saving works (honestly)</h3>
      <ol><li><b>Autosave:</b> every change is saved in this browser's local storage, separately for each campaign. It survives closing the tab — but it stays on <i>this</i> computer and browser profile. It does not travel with the HTML file, and clearing browsing data erases it.</li>
      <li><b>End Night &amp; Save</b> records your recap and party location, keeps a snapshot here, and downloads a save file.</li>
      <li><b>Downloads</b> go wherever your browser puts files (usually Downloads). DM Atlas can't write to a jump drive directly — copy the file there yourself, or set your browser to “Ask where to save each file” and choose the drive.</li></ol>
      <h3>The jump-drive workflow</h3>
      <ol><li>Keep <code>DM_Atlas_5_5e.html</code> and your save files together on the jump drive.</li><li>At the table: open the HTML from the drive in Chrome or Edge. If this computer has no autosave for the campaign, click <b>Import Campaign Save</b> and pick the newest save file.</li><li>At the end of the night: <b>End Night &amp; Save</b>, then copy the downloaded file onto the drive (replace or keep dated copies).</li><li>On another computer, repeat step 2.</li></ol>
      <p class="muted">Save format: <code>{"app":"DM Atlas","format":"${SAVE_FORMAT}","version":${SAVE_VERSION}, …}</code>. Imports are checked before anything is replaced; a damaged or wrong file is rejected without touching your data. Extra fields on characters (from other tools or newer versions) are preserved.</p></div>`;
    bindScratch(el);
    $$('[data-a]', el).forEach(b => b.onclick = () => SaveUI[b.dataset.a]());
  }
};
