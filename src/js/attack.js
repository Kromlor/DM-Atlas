/* Guided 12-step weapon attack: physical dice entered by the DM, preview, confirmed apply, log. */
'use strict';
const AttackFlow = {
  open(attackerKey, weaponId) {
    const st = Store.fresh();
    const atk = this.attacker(st, attackerKey, weaponId);
    if (!atk) { toast('That weapon or attacker no longer exists', 'warn'); return; }
    const af = { id: uid('atk'), attackerKey, weaponId, target: '', ac: '', adv: false, dis: false, d20a: '', d20b: '', dmg: '', def: 'auto', snap: null, applied: false, reviewNeeded: false, logged: false, grip: atk.w ? atk.w.grip : null };
    const m = openModal({ title: 'Attack with ' + atk.label, wide: true, cls: 'attack', html: this.html(st, atk, af) });
    m.keep = true; m.af = af;
    this.bind(m, af);
    this.update(m, af);
    const off = () => { m.closed = true; };
    m.onClose = off;
    AttackFlow.current = m;
    return m;
  },
  /* Attacker can be a party member weapon or a combatant's parsed stat-block attack. */
  attacker(st, key, wid) {
    const [t, id] = key.split(':');
    if (t === 'pc') {
      const p = st.party.find(x => x.id === id); if (!p) return null;
      const w = (p.weapons || []).find(x => x.iid === wid); if (!w) return null;
      const r = Rules.calcWeapon(p, w);
      return { name: p.name, label: w.name, w, p, r, atkBonus: r.atk, dmgMod: r.dmg, die: r.die, type: w.damageType, isPC: true };
    }
    const c = st.combat.combatants.find(x => x.id === id); if (!c) return null;
    const a = (c.attacks || [])[int0(wid)]; if (!a) return null;
    return { name: c.name, label: a.name + ' (' + c.name + ')', atkBonus: int0(a.atk), dmgMod: int0(a.dmgMod), die: a.damage, type: a.damageType, monster: a, isPC: false };
  },
  html(st, atk, af) {
    const tg = Combat.targets(st).filter(t => !(atk.isPC && t.key === af.attackerKey));
    const groups = [...new Set(tg.map(t => t.group))];
    const w = atk.w, r = atk.r;
    return `<div class="af">
    <section class="afs" data-s="1"><h4><span class="sn">1</span> Choose the target</h4>
      <select id="af-target" aria-label="Target"><option value="">— Choose a target —</option>${groups.map(g => `<optgroup label="${g}">${tg.filter(t => t.group === g).map(t => `<option value="${t.key}">${esc(t.label)}</option>`).join('')}</optgroup>`).join('')}</select>
      ${tg.length ? '' : '<p class="muted">No targets yet. Add monsters in the Initiative Tracker or characters in the Party.</p>'}</section>
    <section class="afs" data-s="2"><h4><span class="sn">2</span> Weapon &amp; bonuses</h4>
      ${w ? `<p><b>${esc(w.name)}</b> — ${esc(w.category)} ${esc(w.kind)} · ${esc(w.properties || 'no properties')} · Mastery: <b>${esc(w.mastery || '—')}</b></p>
      ${w.versatile ? `<label class="fld sm"><span>Grip</span><select id="af-grip"><option value="one" ${w.grip !== 'two' ? 'selected' : ''}>One hand (${esc(w.damage)})</option><option value="two" ${w.grip === 'two' ? 'selected' : ''}>Two hands (${esc(w.versatile)})</option></select></label>` : ''}
      <p id="af-bonus"></p>${w.mastery ? `<p class="muted small">Weapon Mastery (${esc(w.mastery)}) applies only if ${esc(atk.name)} has the Weapon Mastery feature for this weapon: ${fmtSRD((SRD.weaponProps[w.mastery] || [''])[0])}</p>` : ''}`
      : `<p><b>${esc(atk.monster.name)}</b> — ${esc(atk.monster.kind)} attack from the stat block: ${sign(atk.atkBonus)} to hit, ${esc(atk.die)}${atk.dmgMod ? ' ' + sign(atk.dmgMod) : ''} ${esc(atk.type)}.</p><p id="af-bonus"></p>`}</section>
    <section class="afs" data-s="3"><h4><span class="sn">3</span> Target's Armor Class</h4><label class="fld sm"><span>AC</span><input id="af-ac" type="number" min="0" max="40"></label><span class="muted" id="af-acnote">Filled in from the target when known — edit for cover (+2 half, +5 three-quarters).</span></section>
    <section class="afs" data-s="4"><h4><span class="sn">4</span> Advantage or Disadvantage?</h4><label class="chk"><input type="checkbox" id="af-adv"> Advantage</label><label class="chk"><input type="checkbox" id="af-dis"> Disadvantage</label><span id="af-mode" class="muted"></span></section>
    <section class="afs" data-s="5"><h4><span class="sn">5</span> Enter the physical d20 roll</h4><div class="row"><label class="fld xs"><span id="af-d20a-l">d20</span><input id="af-d20a" type="number" min="1" max="20" inputmode="numeric"></label><label class="fld xs" id="af-d20b-w"><span>second d20</span><input id="af-d20b" type="number" min="1" max="20" inputmode="numeric"></label><span id="af-d20note" class="muted"></span></div></section>
    <section class="afs" data-s="6"><h4><span class="sn">6</span> Hit or miss?</h4><div id="af-hit" class="bigresult">—</div><div class="btnrow" id="af-missrow" hidden><button id="af-logmiss">Record the miss in the encounter log</button></div></section>
    <section class="afs" data-s="7"><h4><span class="sn">7</span> Roll the damage dice</h4><div id="af-dice" class="bigresult">—</div></section>
    <section class="afs" data-s="8"><h4><span class="sn">8</span> Enter the damage dice total</h4><div class="row"><label class="fld xs"><span>Dice total</span><input id="af-dmg" type="number" min="0" inputmode="numeric"></label><span id="af-dmgcalc"></span></div></section>
    <section class="afs" data-s="9"><h4><span class="sn">9</span> Resistance, Vulnerability or Immunity</h4><div class="row radios">${[['normal', 'Normal'], ['res', 'Resistance (half, round down)'], ['vul', 'Vulnerability (double)'], ['imm', 'Immunity (none)']].map(([v, l]) => `<label class="chk"><input type="radio" name="af-def" value="${v}"> ${l}</label>`).join('')}</div><span id="af-defnote" class="muted"></span></section>
    <section class="afs" data-s="10"><h4><span class="sn">10</span> Preview the HP change</h4><div id="af-preview" class="preview">—</div><div id="af-stale" class="callout warn" hidden></div></section>
    <section class="afs" data-s="11"><h4><span class="sn">11</span> Confirm</h4><div class="btnrow"><button class="primary big" id="af-apply" disabled>Apply damage</button><button id="af-cancel">Close without applying</button></div><div id="af-after"></div></section>
    <section class="afs" data-s="12"><h4><span class="sn">12</span> Encounter log</h4><div id="af-log" class="muted">The result is recorded automatically when you apply damage (or record a miss).</div></section>
    </div>`;
  },
  bind(m, af) {
    const b = m.body; const u = () => this.update(m, af);
    $('#af-target', b).onchange = e => {
      af.target = e.target.value; const st = Store.fresh(); const t = Combat.target(st, af.target);
      af.ac = t && t.ac !== '' && t.ac !== undefined ? String(t.ac) : ''; $('#af-ac', b).value = af.ac;
      af.def = 'auto'; af.snap = t ? { hp: t.hp, temp: t.tempHp } : null; af.reviewNeeded = false; u();
    };
    $('#af-ac', b).oninput = e => { af.ac = e.target.value; u(); };
    $('#af-adv', b).onchange = e => { af.adv = e.target.checked; u(); };
    $('#af-dis', b).onchange = e => { af.dis = e.target.checked; u(); };
    $('#af-d20a', b).oninput = e => { af.d20a = e.target.value; u(); };
    $('#af-d20b', b).oninput = e => { af.d20b = e.target.value; u(); };
    $('#af-dmg', b).oninput = e => { af.dmg = e.target.value; u(); };
    $$('input[name=af-def]', b).forEach(r => r.onchange = () => { af.def = r.value; u(); });
    const g = $('#af-grip', b); if (g) g.onchange = () => { af.grip = g.value; Store.mutate(st => { const p = st.party.find(x => 'pc:' + x.id === af.attackerKey); const w = p && p.weapons.find(x => x.iid === af.weaponId); if (w) w.grip = g.value; }, 'grip'); u(); };
    $('#af-cancel', b).onclick = () => m.close();
    $('#af-apply', b).onclick = () => this.apply(m, af);
    $('#af-logmiss', b).onclick = () => this.logMiss(m, af);
  },
  compute(af) {
    const st = Store.state; const atk = this.attacker(st, af.attackerKey, af.weaponId);
    if (!atk) return { gone: true };
    const t = af.target ? Combat.target(st, af.target) : null;
    const v = n => { const x = num(n); return x !== null && x >= 1 && x <= 20 && Number.isInteger(x) ? x : null; };
    const pick = Rules.pickD20(af.adv, af.dis, v(af.d20a), v(af.d20b));
    const res = pick.die !== null ? Rules.resolveAttack(pick.die, atk.atkBonus, af.ac) : null;
    const dice = res && res.hit ? (res.crit ? Rules.critDice(atk.die) : atk.die) : null;
    const autoDef = t ? Rules.defenseFor(t, atk.type) : 'normal';
    const def = af.def === 'auto' ? autoDef : af.def;
    const dsum = num(af.dmg);
    const dmg = dice && dsum !== null && dsum >= 0 ? Rules.damage(dsum, atk.dmgMod, def) : null;
    const after = dmg && t ? Combat.applyDamage(t.hp, t.tempHp, dmg.final) : null;
    return { atk, t, pick, res, dice, autoDef, def, dsum, dmg, after };
  },
  update(m, af) {
    if (m.closed) return;
    const b = m.body; const c = this.compute(af);
    if (c.gone) { b.innerHTML = '<p>This attacker or weapon was removed in another window.</p>'; return; }
    const { atk, t, pick, res, dice, dmg, after } = c;
    const set = (sel, h) => { const e = $(sel, b); if (e) e.innerHTML = h; };
    const step = (n, on) => { const s = $(`.afs[data-s="${n}"]`, b); s.classList.toggle('locked', !on); $$('input,select,button', s).forEach(x => { if (x.id !== 'af-cancel') x.disabled = !on || (af.applied && n < 11); }); };
    /* step 2 */
    if (atk.r) { const r = atk.r; set('#af-bonus', `Attack bonus <b>${sign(atk.atkBonus)}</b> = ${r.ability} ${sign(r.abilMod)}${r.prof ? ' + Proficiency ' + sign(r.pb) : ' (not proficient — no Proficiency Bonus)'}${r.atkExtra ? ' + extra ' + sign(r.atkExtra) : ''}. Damage <b>${esc(atk.die)}${atk.dmgMod ? ' ' + sign(atk.dmgMod) : ''}</b> ${esc(atk.type)}. <span class="muted">${esc(r.why)}${r.notes.length ? ' · ' + esc(r.notes.join(' ')) : ''}</span>`); }
    else set('#af-bonus', `Attack bonus <b>${sign(atk.atkBonus)}</b>; damage modifier <b>${sign(atk.dmgMod)}</b>. <span class="muted">If the stat block adds extra damage (for example “plus 5 (2d4) Fire”), or a rider like a grapple, resolve that separately with Adjust HP.</span>`);
    step(1, true); step(2, true);
    const hasT = !!t; step(3, hasT); step(4, hasT); step(5, hasT);
    set('#af-acnote', t ? (t.ac !== '' && t.ac != null ? `${esc(t.name)}'s AC is ${esc(t.ac)}. Edit for cover (+2 half, +5 three-quarters).` : `AC unknown for ${esc(t.name)} — ask or enter it.`) : 'Choose a target first.');
    set('#af-mode', pick.mode === 'adv' ? 'Roll two d20s and keep the higher.' : pick.mode === 'dis' ? 'Roll two d20s and keep the lower.' : (af.adv && af.dis ? 'Advantage and Disadvantage cancel out — roll one d20.' : 'Roll one d20.'));
    const two = pick.mode !== 'normal'; $('#af-d20b-w', b).hidden = !two; set('#af-d20a-l', two ? 'first d20' : 'd20');
    const badD = [af.d20a, af.d20b].some((x, i) => x !== '' && (i === 0 || two) && (num(x) === null || num(x) < 1 || num(x) > 20 || !Number.isInteger(num(x))));
    set('#af-d20note', badD ? '<span class="bad">A d20 roll must be a whole number from 1 to 20.</span>' : (two && pick.die !== null ? `Using ${pick.die} (${pick.mode === 'adv' ? 'higher' : 'lower'}).` : ''));
    /* step 6 */
    step(6, !!res);
    if (res) set('#af-hit', `<span class="${res.hit ? (res.crit ? 'crit' : 'hit') : 'miss'}">${res.crit ? '★ CRITICAL HIT' : res.hit ? '✔ HIT' : (res.hit === false ? '✘ MISS' : '?')}</span> <small>d20 ${pick.die} ${sign(atk.atkBonus)} = <b>${res.total}</b> vs AC ${esc(af.ac || '?')} — ${esc(res.text)}</small>`);
    else set('#af-hit', '—');
    $('#af-missrow', b).hidden = !(res && res.hit === false) || af.logged;
    /* steps 7-9 */
    const hit = res && res.hit === true;
    step(7, hit); step(8, hit); step(9, hit);
    if (hit) { const rg = Rules.diceRange(dice); set('#af-dice', `Roll <b>${esc(dice)}</b>${res.crit ? ` <small>(Critical Hit: the weapon's ${esc(atk.die)} is doubled; modifier added once)</small>` : ''} <small>${rg ? '— total between ' + rg[0] + ' and ' + rg[1] : ''}</small>`); }
    else set('#af-dice', res && res.hit === false ? 'No damage on a miss.' : '—');
    if (hit && c.dsum !== null) { const rg = Rules.diceRange(dice); const warn = rg && (c.dsum < rg[0] || c.dsum > rg[1]) ? ` <span class="warn">That's outside ${rg[0]}–${rg[1]} for ${esc(dice)} — fine if extra dice (like Sneak Attack) were added, otherwise check the roll.</span>` : ''; set('#af-dmgcalc', `${c.dsum} ${sign(atk.dmgMod)} = <b>${dmg ? dmg.base : '?'}</b> ${esc(atk.type)} damage${warn}`); }
    else set('#af-dmgcalc', '');
    $$('input[name=af-def]', b).forEach(r => r.checked = r.value === c.def);
    set('#af-defnote', t ? (c.autoDef !== 'normal' ? `${esc(t.name)} has ${c.autoDef === 'res' ? 'Resistance' : c.autoDef === 'vul' ? 'Vulnerability' : 'Immunity'} to ${esc(atk.type)} (from its stat block).` : `No ${esc(atk.type)} Resistance, Vulnerability or Immunity is recorded for ${esc(t.name)}.`) + (dmg ? ' ' + esc(dmg.note) + '.' : '') : '');
    /* step 10 preview + stale check */
    const ready = !!(dmg && t && after);
    if (af.applied && af.result) { step(10, true); set('#af-preview', `<b>${esc(af.result.name)}</b>: HP <b>${af.result.before}</b> → <b class="${af.result.after === 0 ? 'bad' : ''}">${af.result.after}</b> <small>(−${af.result.dmg} applied)</small>`); $('#af-stale', b).hidden = true; const ap = $('#af-apply', b); ap.textContent = '✓ Applied'; ap.disabled = true; step(11, false); $('#af-cancel', b).disabled = false; $('#af-cancel', b).textContent = 'Close'; step(12, true); return; }
    step(10, ready);
    const stale = ready && af.snap && (af.snap.hp !== t.hp || af.snap.temp !== t.tempHp);
    if (stale) af.reviewNeeded = true;
    if (ready) {
      set('#af-preview', `<b>${esc(t.name)}</b>: HP <b>${t.hp === null ? '?' : t.hp}</b> → <b class="${after.hp === 0 ? 'bad' : ''}">${after.hp}</b> <small>(−${dmg.final}${after.absorbed ? `; ${after.absorbed} absorbed by temp HP` : ''}${t.maxHp ? ' of ' + t.maxHp + ' max' : ''})</small>
        ${t.concentrating && dmg.final > 0 ? `<div class="warn">◉ ${esc(t.name)} is concentrating — they will need a Constitution save, DC ${Rules.concentrationDC(dmg.final)}.</div>` : ''}${after.hp === 0 ? `<div class="warn">This drops ${esc(t.name)} to 0 HP. You'll get a reminder of what happens next.</div>` : ''}${t.hp === null ? '<div class="warn">Target HP is unknown — enter it on the card or tracker first.</div>' : ''}`);
    } else set('#af-preview', '—');
    const st = $('#af-stale', b);
    if (af.reviewNeeded && !af.applied) { st.hidden = false; st.innerHTML = `<b>HP changed in another window.</b> ${esc(t ? t.name : 'The target')}'s HP was ${af.snap ? af.snap.hp : '?'}${af.snap && af.snap.temp ? ' (+' + af.snap.temp + ' temp)' : ''} when you started; it is now ${t ? t.hp : '?'}${t && t.tempHp ? ' (+' + t.tempHp + ' temp)' : ''}. Review the preview above, then confirm again.`; }
    else st.hidden = true;
    /* step 11 */
    const dup = (Store.state.appliedAttacks || []).includes(af.id);
    step(11, ready && t.hp !== null && !af.applied && !dup);
    const ap = $('#af-apply', b);
    ap.textContent = af.applied || dup ? '✓ Applied' : af.reviewNeeded ? `I've reviewed the new HP — apply ${dmg ? dmg.final : ''} damage` : `Apply ${dmg ? dmg.final : ''} damage to ${t ? t.name : 'target'}`;
    if (af.applied || dup) ap.disabled = true;
    $('#af-cancel', b).disabled = false;
    step(12, true);
  },
  apply(m, af) {
    const st0 = Store.fresh();
    if ((st0.appliedAttacks || []).includes(af.id) || af.applied) { toast('This attack was already applied', 'warn'); af.applied = true; this.update(m, af); return; }
    const c = this.compute(af); if (!c.dmg || !c.t || !c.after) return;
    /* Fresh review required if HP changed since the DM last looked at the preview. */
    if (af.snap && (af.snap.hp !== c.t.hp || af.snap.temp !== c.t.tempHp)) { af.reviewNeeded = true; af.snap = { hp: c.t.hp, temp: c.t.tempHp }; af.confirmedStale = false; this.update(m, af); const s = $('#af-stale', m.body); s.hidden = false; s.innerHTML = `<b>HP changed in another window.</b> ${esc(c.t.name)} now has ${c.t.hp} HP. The preview above has been recalculated — check it, then press the button again to apply.`; return; }
    let rec = null;
    const ok = Store.mutate(st => {
      if (st.appliedAttacks.includes(af.id)) return false;
      const t = Combat.target(st, af.target); if (!t) return false;
      if (t.hp !== af.snap.hp || t.tempHp !== af.snap.temp) return false;
      const r = Combat.applyDamage(t.hp, t.tempHp, c.dmg.final);
      Combat.setFields(st, af.target, { hp: r.hp, tempHp: r.temp });
      st.appliedAttacks.push(af.id); if (st.appliedAttacks.length > 500) st.appliedAttacks.splice(0, st.appliedAttacks.length - 500);
      rec = { id: uid('log'), attackId: af.id, at: Date.now(), round: st.combat.active ? st.combat.round : null, kind: 'attack', attacker: c.atk.name, weapon: c.atk.w ? c.atk.w.name : c.atk.monster.name, target: t.name, d20: c.pick.die, rolls: [af.d20a, c.pick.mode !== 'normal' ? af.d20b : null].filter(x => x !== null && x !== ''), mode: c.pick.mode, total: c.res.total, ac: af.ac, outcome: c.res.crit ? 'critical hit' : 'hit', dice: c.dice, diceSum: c.dsum, mod: c.atk.dmgMod, defense: c.def, damage: c.dmg.final, damageType: c.atk.type, hpBefore: t.hp, hpAfter: r.hp,
        text: `${c.atk.name} → ${t.name} with ${c.atk.w ? c.atk.w.name : c.atk.monster.name}: d20 ${c.pick.die}${c.pick.mode !== 'normal' ? ' (' + (c.pick.mode === 'adv' ? 'Advantage' : 'Disadvantage') + ')' : ''} ${sign(c.atk.atkBonus)} = ${c.res.total} vs AC ${af.ac} — ${c.res.crit ? 'CRITICAL HIT' : 'hit'}. ${c.dice} = ${c.dsum} ${sign(c.atk.dmgMod)} = ${c.dmg.base}${c.def !== 'normal' ? ' → ' + c.dmg.final + ' (' + c.dmg.note + ')' : ''} ${c.atk.type}. HP ${t.hp} → ${r.hp}.` };
      st.log.unshift(rec);
      rec._r = r; rec._t = t;
    }, 'attack');
    if (!ok) { af.reviewNeeded = true; const t = Combat.target(Store.fresh(), af.target); af.snap = t ? { hp: t.hp, temp: t.tempHp } : null; this.update(m, af); return; }
    const t = rec._t, r = rec._r;
    af.applied = true; af.logged = true; af.result = { name: t.name, before: t.hp, after: r.hp, dmg: c.dmg.final };
    this.update(m, af); delete rec._t; delete rec._r;
    $('#af-log', m.body).innerHTML = '✓ Recorded: ' + esc(rec.text);
    const notes = afterDamageNotes(t, r, c.dmg.final);
    $('#af-after', m.body).innerHTML = `<div class="callout good">✓ ${c.dmg.final} damage applied. ${esc(t.name)} is now at ${r.hp} HP.</div>` + notes;
    bindAfterDamage($('#af-after', m.body), af.target);
    renderViewSoon();
  },
  logMiss(m, af) {
    const c = this.compute(af); if (!c.res || af.logged) return;
    Store.mutate(st => { st.log.unshift({ id: uid('log'), attackId: af.id, at: Date.now(), round: st.combat.active ? st.combat.round : null, kind: 'attack', attacker: c.atk.name, target: c.t ? c.t.name : '?', outcome: 'miss', d20: c.pick.die, total: c.res.total, ac: af.ac, text: `${c.atk.name} → ${c.t ? c.t.name : '?'} with ${c.atk.w ? c.atk.w.name : c.atk.monster.name}: d20 ${c.pick.die}${c.pick.mode !== 'normal' ? ' (' + (c.pick.mode === 'adv' ? 'Advantage' : 'Disadvantage') + ')' : ''} ${sign(c.atk.atkBonus)} = ${c.res.total} vs AC ${af.ac} — ${c.res.nat === 1 ? 'natural 1, ' : ''}miss.` }); }, 'miss');
    af.logged = true; $('#af-log', m.body).textContent = '✓ Miss recorded in the encounter log.'; this.update(m, af); renderViewSoon();
  },
  /* Called when another window changes the state. */
  onRemote() { modalStack.filter(m => m.af).forEach(m => this.update(m, m.af)); }
};
function renderViewSoon() { clearTimeout(App.renderTimer); App.renderTimer = setTimeout(softRefresh, 30); }
