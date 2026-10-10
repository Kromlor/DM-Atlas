/* Party dashboard, character editor (modal), weapon setup. */
'use strict';
function partyGrid(n) { if (n <= 1) return [1, 1]; if (n === 2) return [2, 1]; if (n === 3) return [3, 1]; if (n === 4) return [2, 2]; if (n <= 6) return [3, 2]; if (n <= 8) return [4, 2]; return [4, Math.ceil(n / 4)]; }
function hpClass(hp, mx) { if (hp === null || !mx) return ''; const p = hp / mx; return hp === 0 ? 'zero' : p <= .25 ? 'low' : p <= .5 ? 'mid' : ''; }
function condLabel(p, c) { return c === 'Exhaustion' && int0(p.exhaustion) ? `Exhaustion ${int0(p.exhaustion)} (−${2 * int0(p.exhaustion)} d20)` : c; }
VIEWS['combat/party'] = {
  title: 'Party', render(el) {
    const st = Store.state; const P = st.party; const [cols, rows] = partyGrid(P.length);
    el.innerHTML = `<div class="party-wrap">
      <div class="toolbar">${scratchBanner(true)}<h2 class="deco">Party <small>${P.length} character${P.length === 1 ? '' : 's'}</small></h2>
        <button class="primary" data-add>＋ Add character</button><button data-addinit>⏳ Add party to Initiative</button><button data-export>⬇ Party backup</button><button data-import>⬆ Restore party backup</button><input type="file" id="partyFile" accept=".json,application/json" hidden></div>
      ${P.length ? `<div class="party-grid" style="--cols:${cols};--rows:${rows}" data-count="${P.length}">${P.map(p => partyCardHTML(p, st)).join('')}</div>` : `<div class="parch pad empty"><h3>No characters yet</h3><p>Add each player's character. You only need what you'd glance at during play: name, AC, HP, passive Perception and their weapons.</p><button class="primary" data-add>＋ Add the first character</button></div>`}
    </div>`;
    bindScratch(el);
    $$('[data-add]', el).forEach(b => b.onclick = () => editCharacter(null));
    $('[data-addinit]', el).onclick = () => Combat.addParty();
    $('[data-export]', el).onclick = () => { download('dm-atlas-party-' + slug(Store.campaign() ? Store.campaign().shortTitle || Store.campaign().title : 'party') + '-' + dateStamp() + '.json', JSON.stringify({ app: 'DM Atlas', format: 'dm-atlas-party-backup', version: 1, exportedAt: new Date().toISOString(), party: Store.fresh().party }, null, 2)); toast('Party backup downloaded'); };
    $('[data-import]', el).onclick = () => $('#partyFile').click();
    $('#partyFile').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const d = JSON.parse(await readFileText(f));
        const party = d.format === 'dm-atlas-party-backup' ? d.party : (d.format === SAVE_FORMAT && d.state ? d.state.party : null);
        if (!Array.isArray(party)) throw new Error('This file is not a DM Atlas party backup.');
        if (!(await confirmBox('Restore party backup?', `<p>This replaces the current party (${Store.state.party.length} characters) with <b>${party.length}</b> from the file: ${party.map(p => esc(p.name)).join(', ')}.</p>`, 'Replace party'))) return;
        Store.mutate(s => { s.party = party.map(normalizePC); }, 'party-import'); renderView(); toast('Party restored', 'good');
      } catch (err) { openModal({ title: 'Could not restore', html: `<p>${esc(err.message)}</p><p>Your current party was not changed.</p>` }); }
    };
    $$('.pcard', el).forEach(card => {
      const id = card.dataset.id;
      $('[data-edit]', card).onclick = () => editCharacter(id);
      $('[data-hp]', card).onclick = () => hpAdjust('pc:' + id);
      $$('[data-atk]', card).forEach(b => b.onclick = () => AttackFlow.open('pc:' + id, b.dataset.atk));
      const all = $('[data-allw]', card); if (all) all.onclick = () => allWeapons(id);
      $$('[data-ds]', card).forEach(b => b.onclick = () => { const [k, i] = b.dataset.ds.split(':'); Store.mutate(s => { const p = s.party.find(x => x.id === id); p.deathSaves = p.deathSaves || { s: 0, f: 0 }; p.deathSaves[k] = p.deathSaves[k] >= Number(i) ? Number(i) - 1 : Number(i); }); renderView(); });
      const cc = $('[data-conc]', card); if (cc) cc.onclick = () => { Store.mutate(s => { const p = s.party.find(x => x.id === id); p.concentrating = false; p.concentrationSpell = ''; }); renderView(); };
      const ins = $('[data-insp]', card); if (ins) ins.onclick = () => { Store.mutate(s => { const p = s.party.find(x => x.id === id); p.inspiration = !p.inspiration; }); renderView(); };
    });
  }
};
function partyCardHTML(p, st) {
  const hp = num(p.hp), mx = num(p.maxHp); const pct = hp !== null && mx ? clamp(hp / mx * 100, 0, 100) : 0;
  const ws = p.weapons || []; const shown = ws.slice(0, 2);
  const inCombat = st.combat.combatants.find(c => c.pcId === p.id); const isTurn = inCombat && st.combat.active && st.combat.combatants[st.combat.turn] === inCombat;
  const sub = [p.cls, p.species, p.level ? 'Level ' + p.level : ''].filter(Boolean).join(' · ');
  return `<article class="pcard ${hpClass(hp, mx)} ${isTurn ? 'turn' : ''}" data-id="${p.id}">
    <header><div class="nm"><h3>${esc(p.name)}</h3><div class="sub">${esc(sub || 'Class & level not set')}${p.player ? ' · <span class="ply">' + esc(p.player) + '</span>' : ''}</div></div>
      ${isTurn ? '<span class="pill on">Their turn</span>' : ''}<button class="mini" data-insp title="Heroic Inspiration (click to toggle)">${p.inspiration ? '★' : '☆'}</button><button class="mini" data-edit title="Edit character">✎ Edit</button></header>
    <div class="stats">
      <button class="hpbox" data-hp title="Adjust HP"><span class="lbl">HP</span><span class="big">${hp === null ? '—' : hp}<small>/${mx === null ? '—' : mx}</small></span>${int0(p.tempHp) ? `<span class="tmp">+${int0(p.tempHp)} temp</span>` : ''}<span class="bar"><i style="width:${pct}%"></i></span></button>
      <div class="stat"><span class="lbl">AC</span><span class="big">${esc(p.ac || '—')}</span></div>
      <div class="stat"><span class="lbl">Passive Perc.</span><span class="big">${esc(p.pp || '—')}</span></div>
      <div class="stat sm"><span class="lbl">Init</span><span>${p.initBonus === '' ? '—' : sign(int0(p.initBonus))}</span><span class="lbl">Spell DC / Atk</span><span>${esc(p.saveDc || '—')} / ${p.spellAtk === '' ? '—' : sign(int0(p.spellAtk))}</span></div>
    </div>
    ${hp === 0 ? `<div class="zero-hp">0 HP — Unconscious. Death saves: <span class="ds">S ${[1, 2, 3].map(i => `<button data-ds="s:${i}" class="${(p.deathSaves || {}).s >= i ? 'on' : ''}" aria-label="success ${i}">●</button>`).join('')}</span> <span class="ds f">F ${[1, 2, 3].map(i => `<button data-ds="f:${i}" class="${(p.deathSaves || {}).f >= i ? 'on' : ''}" aria-label="failure ${i}">●</button>`).join('')}</span></div>` : ''}
    <div class="conds">${p.concentrating ? `<span class="chip conc" title="Concentrating — damage prompts a Constitution save">◉ Concentrating${p.concentrationSpell ? ': ' + esc(p.concentrationSpell) : ''} <button data-conc title="End concentration" aria-label="End concentration">✕</button></span>` : ''}${(p.conditions || []).map(c => `<span class="chip cond">${esc(condLabel(p, c))}</span>`).join('')}${!p.concentrating && !(p.conditions || []).length ? '<span class="muted">No conditions</span>' : ''}</div>
    <div class="wbtns">${shown.map(w => { const r = Rules.calcWeapon(p, w); return `<button class="wbtn" data-atk="${w.iid}" title="Attack with ${esc(w.name)}"><b>⚔ ${esc(w.name)}</b><span>${sign(r.atk)} · ${esc(r.die)}${r.dmg ? sign(r.dmg) : ''} ${esc(w.damageType)}</span></button>`; }).join('')}
      ${ws.length > 2 ? `<button class="wbtn all" data-allw>All Weapons (${ws.length})</button>` : (ws.length ? `<button class="wbtn all" data-allw>All Weapons</button>` : `<span class="muted">No weapons saved — use Edit to add some.</span>`)}</div>
    ${p.notes ? `<div class="pnotes">${esc(p.notes)}</div>` : ''}
  </article>`;
}
function allWeapons(id) {
  const p = Store.fresh().party.find(x => x.id === id); if (!p) return;
  const m = openModal({ title: p.name + ' — All Weapons', wide: true, html: `<div class="wlist">${(p.weapons || []).map(w => { const r = Rules.calcWeapon(p, w); return `<div class="wrow"><div><b>${esc(w.name)}</b> <span class="muted">${esc(w.category)} ${esc(w.kind)} · ${esc(w.properties || 'no properties')} · Mastery ${esc(w.mastery || '—')}</span><div>Attack ${sign(r.atk)} · Damage ${esc(r.die)}${r.dmg ? ' ' + sign(r.dmg) : ''} ${esc(w.damageType)}${w.versatile ? ` (${r.twoHanded ? 'two-handed' : 'one-handed; ' + w.versatile + ' two-handed'})` : ''}</div></div><button class="primary" data-atk="${w.iid}">⚔ Attack with ${esc(w.name)}</button></div>`; }).join('') || '<p>No weapons yet.</p>'}</div><div class="btnrow"><button data-edit>Edit weapons</button></div>` });
  $$('[data-atk]', m.body).forEach(b => b.onclick = () => { m.close(); AttackFlow.open('pc:' + id, b.dataset.atk); });
  $('[data-edit]', m.body).onclick = () => { m.close(); editCharacter(id); };
}

/* HP quick adjust for any target (party or combatant). Damage here also prompts Concentration and the 0 HP reminder. */
function hpAdjust(key) {
  const t = Combat.target(Store.fresh(), key); if (!t) return;
  const m = openModal({ title: 'Adjust HP — ' + t.name, html: `<p>Current: <b id="hpcur">${t.hp === null ? '—' : t.hp}</b> / ${t.maxHp === null ? '—' : t.maxHp}${t.tempHp ? ` (+${t.tempHp} temporary)` : ''}</p>
    <div class="row"><input type="number" id="hpamt" min="0" placeholder="Amount" class="big-in" aria-label="Amount"><button class="danger" data-k="dmg">Damage</button><button class="good" data-k="heal">Heal</button><button data-k="temp">Set temp HP</button><button data-k="set">Set HP to</button></div>
    <p class="muted learn-only">Use the guided “Attack with…” buttons for weapon attacks. This box is for spells, traps, falls and healing. Temporary HP is lost first and doesn't stack.</p><div id="hpmsg"></div>` });
  $$('[data-k]', m.body).forEach(b => b.onclick = () => {
    const a = num($('#hpamt', m.body).value); if (a === null || a < 0) { $('#hpamt', m.body).focus(); return; }
    const k = b.dataset.k; let result = null;
    Store.mutate(st => {
      const x = Combat.target(st, key); if (!x) return false;
      if (k === 'dmg') { const r = Combat.applyDamage(x.hp, x.tempHp, a); Combat.setFields(st, key, { hp: r.hp, tempHp: r.temp }); result = { before: x.hp, r, dmg: a, x }; st.log.unshift({ id: uid('log'), at: Date.now(), round: st.combat.active ? st.combat.round : null, kind: 'hp', text: `${x.name} took ${a} damage (HP ${x.hp} → ${r.hp}${r.absorbed ? ', ' + r.absorbed + ' absorbed by temp HP' : ''}).` }); }
      else if (k === 'heal') { const nh = x.maxHp === null ? int0(x.hp) + a : Math.min(x.maxHp, int0(x.hp) + a); const patch = { hp: nh }; if (x.isPC && int0(x.hp) === 0 && nh > 0) patch.deathSaves = { s: 0, f: 0 }; Combat.setFields(st, key, patch); st.log.unshift({ id: uid('log'), at: Date.now(), round: st.combat.active ? st.combat.round : null, kind: 'hp', text: `${x.name} regained ${a} HP (HP ${x.hp} → ${nh}).` }); }
      else if (k === 'temp') Combat.setFields(st, key, { tempHp: a });
      else if (k === 'set') Combat.setFields(st, key, { hp: a });
    }, 'hp');
    renderView();
    if (result) { const msgs = afterDamageNotes(result.x, result.r, result.dmg); if (msgs) { $('#hpmsg', m.body).innerHTML = msgs; bindAfterDamage(m.body, key); return; } }
    m.close();
  });
}
function afterDamageNotes(x, r, dmg) {
  let h = '';
  if (x.concentrating && dmg > 0 && (r.hp > 0 || !x.isPC)) h += `<div class="callout conc" id="concPrompt"><b>Concentration check!</b> ${esc(x.name)} is concentrating${x.concentrationSpell ? ' on <i>' + esc(x.concentrationSpell) + '</i>' : ''}. They make a <b>Constitution saving throw, DC ${Rules.concentrationDC(dmg)}</b> (10 or half the damage, max 30). <div class="btnrow"><button data-conc="keep" class="good">Save succeeded — keep it</button><button data-conc="end" class="danger">Failed — end Concentration</button></div></div>`;
  if (x.concentrating && r.hp === 0 && x.isPC) h += `<div class="callout conc"><b>Concentration ends:</b> at 0 HP ${esc(x.name)} is Unconscious, which ends Concentration. <div class="btnrow"><button data-conc="end" class="danger">End Concentration</button></div></div>`;
  if (r.hp === 0) h += `<div class="callout zero" id="zeroPrompt"><b>${esc(x.name)} is at 0 HP.</b> ${x.isPC ? `Per the rules they have the Unconscious condition and start making Death Saving Throws at the start of their turns. ${r.overflow >= (x.maxHp || Infinity) ? `<br><b>Massive damage:</b> ${r.overflow} damage remained after reaching 0, which equals or exceeds their HP maximum (${x.maxHp}) — the Instant Death rule applies. You make the call; DM Atlas never marks anyone dead.` : 'Damage while at 0 HP causes a death save failure (two on a Critical Hit).'}` : 'Most monsters die or are defeated at 0 HP; if a melee attacker chose to knock it out, it is at 1 HP and Unconscious instead. Decide what happens — DM Atlas never removes it for you.'}
    <div class="btnrow">${x.isPC ? '<button data-zero="unc">Add Unconscious condition</button>' : '<button data-zero="def">Mark as defeated</button>'}</div></div>`;
  return h;
}
function bindAfterDamage(root, key) {
  $$('[data-conc]', root).forEach(b => b.onclick = () => {
    if (b.dataset.conc === 'end') { Store.mutate(st => { const x = Combat.target(st, key); Combat.setFields(st, key, { concentrating: false, concentrationSpell: '' }); st.log.unshift({ id: uid('log'), at: Date.now(), round: st.combat.active ? st.combat.round : null, kind: 'conc', text: `${x.name} lost Concentration.` }); }); toast('Concentration ended'); }
    else { Store.mutate(st => { const x = Combat.target(st, key); st.log.unshift({ id: uid('log'), at: Date.now(), round: st.combat.active ? st.combat.round : null, kind: 'conc', text: `${x.name} kept Concentration.` }); }); toast('Concentration kept', 'good'); }
    b.closest('.callout').innerHTML = b.dataset.conc === 'end' ? '✓ Concentration ended.' : '✓ Concentration kept.'; renderView();
  });
  $$('[data-zero]', root).forEach(b => b.onclick = () => {
    Store.mutate(st => { const x = Combat.target(st, key); const conds = (x.conditions || []).slice(); const add = b.dataset.zero === 'unc' ? 'Unconscious' : 'Defeated'; if (!conds.includes(add)) conds.push(add); Combat.setFields(st, key, { conditions: conds }); });
    b.disabled = true; b.textContent = '✓ Done'; renderView();
  });
}

/* ---------- character editor ---------- */
function editCharacter(id) {
  const st = Store.fresh();
  const orig = id ? st.party.find(p => p.id === id) : normalizePC({});
  if (!orig) return;
  const draft = deepClone(orig);
  const isNew = !id;
  const field = (k, label, type = 'text', extra = '') => `<label class="fld"><span>${label}</span><input data-f="${k}" type="${type}" value="${esc(draft[k] == null ? '' : draft[k])}" ${extra}></label>`;
  const m = openModal({ title: isNew ? 'New character' : 'Edit ' + orig.name, wide: true, cls: 'editor', html: `
    <div class="edgrid">
      <fieldset><legend>Who</legend>${field('name', 'Character name')}${field('player', 'Player name')}${field('cls', 'Class')}${field('species', 'Species')}${field('level', 'Level', 'number', 'min="1" max="20"')}</fieldset>
      <fieldset><legend>Defense &amp; HP</legend>${field('ac', 'Armor Class', 'number')}${field('hp', 'Current HP', 'number')}${field('maxHp', 'Max HP', 'number')}${field('tempHp', 'Temp HP', 'number', 'min="0"')}${field('pp', 'Passive Perception', 'number')}${field('initBonus', 'Initiative bonus', 'number')}</fieldset>
      <fieldset><legend>Magic &amp; abilities</legend>${field('saveDc', 'Spell save DC', 'number')}${field('spellAtk', 'Spell attack bonus', 'number')}${field('str', 'STR modifier', 'number')}${field('dex', 'DEX modifier', 'number')}
        <p class="muted small">Enter modifiers (e.g. +3), not scores. Leave blank if unknown — it counts as +0.</p></fieldset>
      <fieldset><legend>Proficiency</legend><label class="chk"><input type="checkbox" data-f="profSimple" ${draft.profSimple ? 'checked' : ''}> Simple weapons</label><label class="chk"><input type="checkbox" data-f="profMartial" ${draft.profMartial ? 'checked' : ''}> Martial weapons</label>
        <label class="fld"><span>Specific weapons (comma separated)</span><input data-f="profWeapons" value="${esc((draft.profWeapons || []).join(', '))}" placeholder="e.g. Longsword, Rapier"></label>
        <p class="muted small" id="pbnote"></p></fieldset>
      <fieldset class="span2"><legend>Conditions &amp; Concentration</legend><div class="chips">${Rules.conditions.map(c => `<label class="chip ${draft.conditions.includes(c) ? 'on' : ''}"><input type="checkbox" data-cond="${c}" ${draft.conditions.includes(c) ? 'checked' : ''}> ${c}</label>`).join('')}</div>
        <div class="row"><label class="fld sm"><span>Exhaustion level</span><input data-f="exhaustion" type="number" min="0" max="6" value="${esc(draft.exhaustion || 0)}"></label><label class="chk"><input type="checkbox" data-f="concentrating" ${draft.concentrating ? 'checked' : ''}> Concentrating</label><label class="fld"><span>on spell</span><input data-f="concentrationSpell" value="${esc(draft.concentrationSpell || '')}" list="spellnames"></label><label class="chk"><input type="checkbox" data-f="inspiration" ${draft.inspiration ? 'checked' : ''}> Heroic Inspiration</label></div>
        <datalist id="spellnames">${SRD.spells.filter(s => s.concentration).map(s => `<option value="${esc(s.name)}">`).join('')}</datalist></fieldset>
      <fieldset class="span2"><legend>Weapons</legend><div class="row"><select id="addw" aria-label="Add weapon from SRD"><option value="">Add a weapon from the SRD list…</option>${['Simple Melee', 'Simple Ranged', 'Martial Melee', 'Martial Ranged'].map(g => `<optgroup label="${g}">${SRD.weapons.filter(w => w.category + ' ' + w.kind === g).map(w => `<option value="${w.id}">${esc(w.name)} (${esc(w.damage)} ${esc(w.damageType)})</option>`).join('')}</optgroup>`).join('')}</select><button data-custom>＋ Custom weapon</button></div><div id="wedit"></div>
        <p class="muted small learn-only">The first two weapons appear as buttons on the party card. Auto bonuses come from the SRD weapon, the character's STR/DEX modifiers, level and proficiencies. Put magic bonuses or special features in “Extra” — they're kept separate from the automatic numbers.</p></fieldset>
      <fieldset class="span2"><legend>Notes</legend><textarea data-f="notes" rows="3">${esc(draft.notes || '')}</textarea></fieldset>
    </div>
    <div class="btnrow sticky"><button class="primary" data-save>${isNew ? 'Add character' : 'Save changes'}</button><button data-cancel>Cancel</button>${isNew ? '' : '<button class="danger right" data-remove>Remove character</button>'}</div>` });
  m.keep = true;
  const body = m.body;
  const readDraft = () => {
    $$('[data-f]', body).forEach(i => { const k = i.dataset.f; if (i.type === 'checkbox') draft[k] = i.checked; else if (k === 'profWeapons') draft[k] = i.value.split(',').map(x => x.trim()).filter(Boolean); else if (k === 'exhaustion') draft[k] = clamp(int0(i.value), 0, 6); else draft[k] = i.value; });
    draft.conditions = $$('[data-cond]', body).filter(i => i.checked).map(i => i.dataset.cond);
    if (int0(draft.exhaustion) > 0 && !draft.conditions.includes('Exhaustion')) draft.conditions.push('Exhaustion');
  };
  const pbNote = () => { const pb = pbForLevel(draft.level); $('#pbnote', body).textContent = pb === null ? 'Level not set — Proficiency Bonus counts as +0.' : `Level ${draft.level} → Proficiency Bonus +${pb}.`; };
  const renderWeapons = () => {
    readDraft(); pbNote();
    $('#wedit', body).innerHTML = (draft.weapons || []).map((w, i) => { const r = Rules.calcWeapon(draft, w); return `<div class="wed" data-i="${i}">
      <div class="wed-hd"><b>${i < 2 ? '★ ' : ''}${esc(w.name)}</b><span class="muted">${esc(w.category)} ${esc(w.kind)} · ${esc(w.damage)}${w.versatile ? ' (' + esc(w.versatile) + ' two-handed)' : ''} ${esc(w.damageType)} · ${esc(w.properties || 'no properties')} · Mastery: ${esc(w.mastery || '—')}</span>
        <span class="wbtnrow">${i > 0 ? '<button class="mini" data-up title="Move up">▲</button>' : ''}<button class="mini danger" data-del title="Remove weapon">✕</button></span></div>
      ${w.ref ? '' : `<div class="row"><label class="fld"><span>Name</span><input data-w="name" value="${esc(w.name)}"></label><label class="fld sm"><span>Damage dice</span><input data-w="damage" value="${esc(w.damage)}"></label><label class="fld sm"><span>Type</span><select data-w="damageType">${Rules.damageTypes.map(t => `<option ${t === w.damageType ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="fld sm"><span>Category</span><select data-w="category"><option ${w.category === 'Simple' ? 'selected' : ''}>Simple</option><option ${w.category === 'Martial' ? 'selected' : ''}>Martial</option></select></label><label class="fld sm"><span>Kind</span><select data-w="kind"><option ${w.kind === 'Melee' ? 'selected' : ''}>Melee</option><option ${w.kind === 'Ranged' ? 'selected' : ''}>Ranged</option></select></label><label class="fld"><span>Properties</span><input data-w="properties" value="${esc(w.properties)}" placeholder="e.g. Finesse, Light"></label></div>`}
      <div class="row">
        ${w.versatile ? `<label class="fld sm"><span>Grip</span><select data-w="grip"><option value="one" ${w.grip !== 'two' ? 'selected' : ''}>One hand (${esc(w.damage)})</option><option value="two" ${w.grip === 'two' ? 'selected' : ''}>Two hands (${esc(w.versatile)})</option></select></label>` : ''}
        ${r.finesse ? `<label class="fld sm"><span>Finesse ability</span><select data-w="ability"><option value="auto" ${w.ability === 'auto' ? 'selected' : ''}>Better of STR/DEX</option><option value="str" ${w.ability === 'str' ? 'selected' : ''}>STR</option><option value="dex" ${w.ability === 'dex' ? 'selected' : ''}>DEX</option></select></label>` : ''}
        <label class="fld sm"><span>Proficient?</span><select data-w="profOverride"><option value="auto" ${w.profOverride === 'auto' ? 'selected' : ''}>Auto (${r.prof && w.profOverride === 'auto' ? 'yes' : w.profOverride === 'auto' ? 'no' : '…'})</option><option value="yes" ${w.profOverride === 'yes' ? 'selected' : ''}>Yes</option><option value="no" ${w.profOverride === 'no' ? 'selected' : ''}>No</option></select></label>
        <label class="fld xs"><span>Extra attack</span><input type="number" data-w="atkExtra" value="${esc(w.atkExtra || 0)}"></label><label class="fld xs"><span>Extra damage</span><input type="number" data-w="dmgExtra" value="${esc(w.dmgExtra || 0)}"></label><label class="fld"><span>Extra note (e.g. +1 weapon)</span><input data-w="extraNote" value="${esc(w.extraNote || '')}"></label></div>
      <div class="calc" data-calc><b>Attack ${sign(r.atk)}</b> = ${r.ability} ${sign(r.abilMod)}${r.prof ? ` + PB ${sign(r.pb)}` : ' (not proficient, no PB)'}${r.atkExtra ? ` + extra ${sign(r.atkExtra)}` : ''} · <b>Damage ${esc(r.die)}${r.dmg ? ' ' + sign(r.dmg) : ''}</b> = ${r.ability} ${sign(r.abilMod)}${r.dmgExtra ? ` + extra ${sign(r.dmgExtra)}` : ''} <span class="muted">· ${esc(r.why)}${r.notes.length ? ' · ' + esc(r.notes.join(' ')) : ''}</span></div></div>`; }).join('') || '<p class="muted">No weapons yet.</p>';
    $$('.wed', body).forEach(row => {
      const i = Number(row.dataset.i);
      $$('[data-w]', row).forEach(inp => inp.onchange = () => { const k = inp.dataset.w; draft.weapons[i][k] = (k === 'atkExtra' || k === 'dmgExtra') ? int0(inp.value) : inp.value; if (k === 'properties') draft.weapons[i].propList = inp.value.split(',').map(x => x.trim()).filter(Boolean); renderWeapons(); });
      $('[data-del]', row).onclick = () => { draft.weapons.splice(i, 1); renderWeapons(); };
      const up = $('[data-up]', row); if (up) up.onclick = () => { const w = draft.weapons.splice(i, 1)[0]; draft.weapons.splice(i - 1, 0, w); renderWeapons(); };
    });
  };
  $('#addw', body).onchange = e => { const w = Rules.weaponFromRef(e.target.value); if (w) { draft.weapons.push(w); e.target.value = ''; renderWeapons(); } };
  $('[data-custom]', body).onclick = () => { draft.weapons.push(Rules.blankWeapon()); renderWeapons(); };
  $$('[data-f="str"],[data-f="dex"],[data-f="level"],[data-f="profSimple"],[data-f="profMartial"],[data-f="profWeapons"]', body).forEach(i => i.addEventListener('change', renderWeapons));
  $$('[data-cond]', body).forEach(i => i.onchange = () => i.parentNode.classList.toggle('on', i.checked));
  renderWeapons();
  $('[data-cancel]', body).onclick = () => m.close();
  $('[data-save]', body).onclick = () => {
    readDraft();
    if (!String(draft.name).trim()) { toast('Give the character a name', 'warn'); $('[data-f=name]', body).focus(); return; }
    if (isNew) Store.mutate(s => { s.party.push(normalizePC(draft)); }, 'pc-add');
    else Store.mutate(s => {
      const p = s.party.find(x => x.id === id); if (!p) { s.party.push(normalizePC(draft)); return; }
      /* Only write fields the DM changed here, so HP changed meanwhile in another window isn't overwritten. */
      const same = (a, b) => (a !== null && typeof a === 'object') || (b !== null && typeof b === 'object') ? JSON.stringify(a) === JSON.stringify(b) : String(a == null ? '' : a) === String(b == null ? '' : b);
      Object.keys(draft).forEach(k => { if (!same(draft[k], orig[k])) p[k] = draft[k]; });
      const c = s.combat.combatants.find(x => x.pcId === id); if (c) c.name = p.name;
    }, 'pc-edit');
    m.close(); renderView(); toast(isNew ? 'Character added' : 'Character saved', 'good');
  };
  const rm = $('[data-remove]', body); if (rm) rm.onclick = async () => { if (await confirmBox('Remove ' + esc(orig.name) + '?', '<p>This removes the character and unlinks them from the Initiative Tracker. Export a party backup first if you might want them later.</p>', 'Remove', true)) { Store.mutate(s => { s.party = s.party.filter(p => p.id !== id); s.combat.combatants = s.combat.combatants.filter(c => c.pcId !== id); }, 'pc-remove'); m.close(); renderView(); } };
}
