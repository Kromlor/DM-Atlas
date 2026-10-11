/* Combat model helpers: targets, linked HP, initiative, adding foes. */
'use strict';
const Combat = {
  /* A target key is 'pc:<id>' or 'cb:<id>'. Linked combatants resolve to their party member so HP stays in one place. */
  keyFor(c) { return c.pcId ? 'pc:' + c.pcId : 'cb:' + c.id; },
  target(st, key) {
    if (!key) return null;
    const [t, id] = key.split(':');
    if (t === 'pc') { const p = st.party.find(x => x.id === id); if (!p) return null; return { key, isPC: true, name: p.name, ac: p.ac, hp: num(p.hp), maxHp: num(p.maxHp), tempHp: int0(p.tempHp), conditions: p.conditions || [], concentrating: !!p.concentrating, concentrationSpell: p.concentrationSpell || '', res: p.res || '', vul: p.vul || '', imm: p.imm || '', ref: p }; }
    const c = st.combat.combatants.find(x => x.id === id); if (!c) return null;
    if (c.pcId) return this.target(st, 'pc:' + c.pcId);
    return { key, isPC: false, name: c.name, ac: c.ac, hp: num(c.hp), maxHp: num(c.maxHp), tempHp: int0(c.tempHp), conditions: c.conditions || [], concentrating: !!c.concentrating, concentrationSpell: c.concentrationSpell || '', res: c.res || '', vul: c.vul || '', imm: c.imm || '', ref: c };
  },
  targets(st) {
    const out = []; const seen = new Set();
    st.combat.combatants.forEach(c => { const k = this.keyFor(c); if (seen.has(k)) return; seen.add(k); const t = this.target(st, k); if (t) out.push({ key: k, label: t.name + (t.isPC ? ' (party)' : '') + ' — AC ' + (t.ac || '?') + ', HP ' + (t.hp === null ? '?' : t.hp), group: 'In the Initiative Tracker' }); });
    st.party.forEach(p => { const k = 'pc:' + p.id; if (seen.has(k)) return; out.push({ key: k, label: p.name + ' (party) — AC ' + (p.ac || '?') + ', HP ' + (p.hp === '' ? '?' : p.hp), group: 'Party (not in combat)' }); });
    return out;
  },
  /* Write HP / fields to the right record inside a mutate() callback. */
  setFields(st, key, patch) {
    const [t, id] = key.split(':');
    if (t === 'pc') { const p = st.party.find(x => x.id === id); if (p) Object.assign(p, patch); return !!p; }
    const c = st.combat.combatants.find(x => x.id === id); if (!c) return false;
    if (c.pcId) return this.setFields(st, 'pc:' + c.pcId, patch);
    Object.assign(c, patch); return true;
  },
  applyDamage(hp, temp, dmg) {
    hp = int0(hp); temp = int0(temp); dmg = Math.max(0, int0(dmg));
    const absorbed = Math.min(temp, dmg); const rest = dmg - absorbed;
    const newHp = Math.max(0, hp - rest); const overflow = Math.max(0, rest - hp);
    return { hp: newHp, temp: temp - absorbed, absorbed, overflow };
  },
  parseAttacks(lines) {
    const out = [];
    (lines || []).forEach(l => {
      const m = l.match(/^([^.]{1,60})\. (Melee or Ranged|Melee|Ranged) Attack Roll: ([+−-]\d+)[^]*?Hit: \d+ \((\d+d\d+)(?: ?([+−-]) ?(\d+))?\) ([A-Za-z]+) damage/);
      if (m) out.push({ name: m[1].replace(/ \(.*\)$/, ''), kind: m[2], atk: num(m[3].replace('−', '-')), damage: m[4], dmgMod: m[5] ? (m[5] === '+' ? 1 : -1) * Number(m[6]) : 0, damageType: m[7] });
    });
    return out;
  },
  findCreature(name) {
    const c = Store.campaign(); const n = String(name).toLowerCase().replace(/’/g, "'").trim(); const lc = x => String(x).toLowerCase().replace(/’/g, "'");
    const sing = n.replace(/ies$/, 'y').replace(/s$/, '');
    const b = c && (c.bestiary || []).find(x => x.ac !== undefined && [n, sing].includes(lc(x.name)));
    if (b) return { name: b.name, ac: b.ac, hp: b.hp, init: b.init, res: b.res || '', vul: b.vul || '', imm: b.imm || '', attacks: this.parseAttacks((b.sections || []).flatMap(s => s.entries.map(e => e.name + '. ' + e.text))), src: 'campaign' };
    const alias = c && c.srdRefs && (c.srdRefs[n] || c.srdRefs[sing]);
    const m = SRD.monsters.find(x => [n, sing, lc(alias || '')].includes(lc(x.name)));
    if (m) return { name: m.name, ac: m.ac, hp: m.hp, init: m.init, res: m.res, vul: m.vul, imm: m.imm, attacks: this.parseAttacks(m.lines), src: 'srd' };
    return null;
  },
  newCombatant(o) { return Object.assign({ id: uid('cb'), name: 'Combatant', kind: 'monster', pcId: null, ac: '', hp: '', maxHp: '', tempHp: 0, init: '', initBonus: '', conditions: [], concentrating: false, reminders: '', res: '', vul: '', imm: '', attacks: [], surprised: false, group: '' }, o); },
  addFoes(foes) {
    const added = []; const missing = [];
    Store.mutate(st => {
      foes.forEach(f => {
        /* f = { count, name } or { count, stat, label, note }: stat = the stat block to use, label = what to call it (e.g. an NPC using an SRD block). */
        const cr = f.stat !== null && (f.stat || f.name) ? this.findCreature(f.stat || f.name) : null;
        const base = f.label || (cr ? cr.name : f.name);
        const n = Math.max(1, int0(f.count) || 1);
        const existing = st.combat.combatants.filter(c => c.group === base).length;
        for (let i = 0; i < n; i++) {
          const label = base + (n > 1 || existing ? ' ' + (existing + i + 1) : '');
          const extra = { reminders: [f.label && cr && f.label !== cr.name ? 'Uses the ' + cr.name + ' stat block (' + (cr.src === 'srd' ? 'SRD 5.2.1' : 'campaign bestiary') + ').' : '', f.note || ''].filter(Boolean).join(' ') };
          const c = this.newCombatant(Object.assign(cr ? { name: label, group: base, ac: cr.ac, hp: cr.hp, maxHp: cr.hp, initBonus: String(cr.init || '').replace('−', '-').replace('+', ''), res: cr.res, vul: cr.vul, imm: cr.imm, attacks: cr.attacks } : { name: label, group: base }, extra));
          st.combat.combatants.push(c); added.push(label);
        }
        if (!cr) missing.push(base);
      });
    }, 'add-foes');
    toast('Added to the Initiative Tracker: ' + added.join(', ') + (missing.length ? '. Fill in AC/HP for: ' + missing.join(', ') : ''), missing.length ? 'warn' : 'good', 4500);
    if (!App.route.startsWith('combat/tracker')) { if (App.route === 'screen') renderView(); } else renderView();
  },
  addParty() {
    let n = 0;
    Store.mutate(st => { st.party.forEach(p => { if (!st.combat.combatants.some(c => c.pcId === p.id)) { st.combat.combatants.push(this.newCombatant({ name: p.name, kind: 'pc', pcId: p.id, initBonus: p.initBonus })); n++; } }); }, 'add-party');
    toast(n ? n + ' party member(s) added, linked to their party cards' : 'The whole party is already in the tracker', n ? 'good' : 'info');
  },
  sort() {
    Store.mutate(st => {
      const cur = st.combat.combatants[st.combat.turn];
      st.combat.combatants = st.combat.combatants.map((c, i) => [c, i]).sort((a, b) => { const x = num(a[0].init), y = num(b[0].init); if (x === null && y === null) return a[1] - b[1]; if (x === null) return 1; if (y === null) return -1; return y - x || a[1] - b[1]; }).map(x => x[0]);
      if (cur) st.combat.turn = Math.max(0, st.combat.combatants.indexOf(cur));
      if (st.combat.turn < 0 || st.combat.turn >= st.combat.combatants.length) st.combat.turn = 0;
    }, 'sort');
  },
  nextTurn(dir) {
    let msg = null;
    Store.mutate(st => {
      const cb = st.combat; const n = cb.combatants.length; if (!n) return false;
      if (!cb.active) { cb.active = true; cb.turn = 0; cb.round = Math.max(1, cb.round || 1); }
      else if (dir > 0) { cb.turn++; if (cb.turn >= n) { cb.turn = 0; cb.round++; } }
      else { cb.turn--; if (cb.turn < 0) { if (cb.round > 1) { cb.round--; cb.turn = n - 1; } else cb.turn = 0; } }
      const t = this.target(st, this.keyFor(cb.combatants[cb.turn]));
      if (t && t.hp === 0) msg = t.isPC ? `${t.name} starts the turn at 0 HP — they roll a Death Saving Throw (d20, no modifiers; 10+ succeeds).` : `${t.name} is at 0 HP. Decide what happens — DM Atlas never removes creatures for you.`;
      else if (t && t.concentrating) msg = `${t.name} is concentrating${t.concentrationSpell ? ' on ' + t.concentrationSpell : ''}.`;
    }, 'turn');
    if (msg) toast(msg, 'warn', 6000);
    renderView();
  }
};
