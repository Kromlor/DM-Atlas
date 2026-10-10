/* DM Atlas rules engine: pure functions for weapon bonuses, attack resolution and damage. */
'use strict';
const Rules = {
  weaponRef(idOrName) {
    if (!idOrName) return null;
    const k = slug(idOrName);
    return SRD.weapons.find(w => w.id === k || slug(w.name) === k) || null;
  },
  /* Create a weapon instance from the SRD table (autofill). */
  weaponFromRef(ref) {
    const w = this.weaponRef(ref);
    if (!w) return null;
    return { iid: uid('w'), ref: w.id, name: w.name, damage: w.damage, damageType: w.damageType, properties: w.properties, propList: w.propList.slice(), mastery: w.mastery, category: w.category, kind: w.kind, versatile: w.versatile, range: w.range, grip: 'one', ability: 'auto', profOverride: 'auto', atkExtra: 0, dmgExtra: 0, extraNote: '' };
  },
  blankWeapon() { return { iid: uid('w'), ref: '', name: 'Custom weapon', damage: '1d4', damageType: 'Bludgeoning', properties: '', propList: [], mastery: '', category: 'Simple', kind: 'Melee', versatile: null, range: null, grip: 'one', ability: 'auto', profOverride: 'auto', atkExtra: 0, dmgExtra: 0, extraNote: '' }; },
  hasProp(w, p) { return (w.propList || String(w.properties || '').split(',')).some(x => String(x).trim().toLowerCase().startsWith(p.toLowerCase())); },
  /* Full calculation, with an explanation for the UI. Missing ability info -> 0. */
  calcWeapon(pc, w) {
    const level = num(pc.level);
    const pbRaw = pbForLevel(level);
    const pb = pbRaw === null ? 0 : pbRaw;
    const strK = num(pc.str), dexK = num(pc.dex);
    const str = strK === null ? 0 : strK, dex = dexK === null ? 0 : dexK;
    const finesse = this.hasProp(w, 'Finesse');
    const ranged = String(w.kind || '').toLowerCase() === 'ranged';
    const thrown = this.hasProp(w, 'Thrown');
    let options, ability, why;
    if (finesse) {
      options = ['STR', 'DEX'];
      if (w.ability === 'str') { ability = 'STR'; why = 'Finesse: Strength chosen'; }
      else if (w.ability === 'dex') { ability = 'DEX'; why = 'Finesse: Dexterity chosen'; }
      else { ability = dex > str ? 'DEX' : 'STR'; why = 'Finesse: better of STR/DEX'; }
    } else if (ranged) { options = ['DEX']; ability = 'DEX'; why = thrown ? 'Ranged weapon (thrown) uses Dexterity' : 'Ranged weapon uses Dexterity'; }
    else { options = ['STR']; ability = 'STR'; why = thrown ? 'Melee weapon with Thrown uses Strength, even when thrown' : 'Melee weapon uses Strength'; }
    const abilMod = ability === 'STR' ? str : dex;
    const abilKnown = ability === 'STR' ? strK !== null : dexK !== null;
    let prof;
    if (w.profOverride === 'yes') prof = true; else if (w.profOverride === 'no') prof = false;
    else {
      const cat = String(w.category || '').toLowerCase();
      const specific = (pc.profWeapons || []).map(slug);
      prof = (cat === 'simple' && !!pc.profSimple) || (cat === 'martial' && !!pc.profMartial) || specific.includes(slug(w.ref || w.name)) || specific.includes(slug(w.name));
    }
    const atkAuto = abilMod + (prof ? pb : 0);
    const dmgAuto = abilMod;
    const atkExtra = int0(w.atkExtra), dmgExtra = int0(w.dmgExtra);
    const twoHanded = w.versatile && w.grip === 'two';
    const die = twoHanded ? w.versatile : w.damage;
    const notes = [];
    if (!abilKnown) notes.push((ability === 'STR' ? 'Strength' : 'Dexterity') + ' modifier not entered — counted as +0.');
    if (pbRaw === null) notes.push('Level not entered — Proficiency Bonus counted as +0.');
    return { ability, abilityOptions: options, abilMod, abilKnown, why, pb, pbKnown: pbRaw !== null, prof, atkAuto, dmgAuto, atkExtra, dmgExtra, atk: atkAuto + atkExtra, dmg: dmgAuto + dmgExtra, die, twoHanded: !!twoHanded, finesse, ranged, thrown, notes };
  },
  /* d20 selection: adv & dis cancel. */
  pickD20(adv, dis, a, b) {
    const mode = adv && !dis ? 'adv' : (dis && !adv ? 'dis' : 'normal');
    const A = num(a), B = num(b);
    if (A === null) return { mode, die: null };
    if (mode === 'normal') return { mode, die: A, cancelled: adv && dis };
    if (B === null) return { mode, die: null, needSecond: true };
    return { mode, die: mode === 'adv' ? Math.max(A, B) : Math.min(A, B) };
  },
  resolveAttack(die, bonus, ac) {
    if (die === null || die === undefined) return null;
    const total = die + bonus;
    if (die === 1) return { total, hit: false, crit: false, nat: 1, text: 'Natural 1 — automatic miss' };
    if (die === 20) return { total, hit: true, crit: true, nat: 20, text: 'Natural 20 — Critical Hit!' };
    const ACn = num(ac);
    if (ACn === null) return { total, hit: null, crit: false, text: 'Enter the target\'s AC' };
    return total >= ACn ? { total, hit: true, crit: false, text: 'Hit (' + total + ' vs AC ' + ACn + ')' } : { total, hit: false, crit: false, text: 'Miss (' + total + ' vs AC ' + ACn + ')' };
  },
  critDice(die) { /* "1d8" -> "2d8"; "2d6" -> "4d6"; flat "1" stays (no dice to double) */
    const m = String(die).match(/^(\d+)d(\d+)$/); if (!m) return die; return (Number(m[1]) * 2) + 'd' + m[2];
  },
  diceRange(expr) { const m = String(expr).match(/^(\d+)d(\d+)$/); if (!m) { const f = num(expr); return f === null ? null : [f, f]; } return [Number(m[1]), Number(m[1]) * Number(m[2])]; },
  damage(diceSum, mod, defense) {
    const base = Math.max(0, int0(diceSum) + int0(mod));
    let final = base, note = 'Normal damage';
    if (defense === 'res') { final = Math.floor(base / 2); note = 'Resistance: halved, rounded down'; }
    else if (defense === 'vul') { final = base * 2; note = 'Vulnerability: doubled'; }
    else if (defense === 'imm') { final = 0; note = 'Immunity: no damage'; }
    return { base, final, note };
  },
  concentrationDC(damage) { return Math.min(30, Math.max(10, Math.floor(int0(damage) / 2))); },
  defenseFor(target, type) {
    if (!target || !type) return 'normal';
    const t = String(type).toLowerCase();
    const has = s => String(s || '').toLowerCase().split(';')[0].split(/,|\band\b/).map(x => x.trim()).filter(Boolean).includes(t);
    if (has(target.imm)) return 'imm';
    if (has(target.res)) return 'res';
    if (has(target.vul)) return 'vul';
    return 'normal';
  },
  conditions: ['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'],
  damageTypes: ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'],
  xpBudget: { 1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500], 5: [500, 750, 1100], 6: [600, 1000, 1400], 7: [750, 1300, 1700], 8: [1000, 1700, 2100], 9: [1300, 2000, 2600], 10: [1600, 2300, 3100], 11: [1900, 2900, 4100], 12: [2200, 3700, 4700], 13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800], 16: [3800, 6100, 9800], 17: [4500, 7200, 11700], 18: [5000, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22000] }
};
/* Dice expression roller for the Session Tools dice roller (digital convenience; the attack helper uses physical rolls). */
function rollDie(sides) { const a = new Uint32Array(1); crypto.getRandomValues(a); return 1 + (a[0] % sides); }
function rollExpr(expr, mode = 'normal') {
  const clean = String(expr || '').replace(/\s+/g, '').toLowerCase();
  if (!clean || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(clean)) return { error: 'Use a format like 1d20+5, 2d6+3 or 3d8.' };
  const terms = clean.match(/[+-]?(\d*d\d+|\d+)/g);
  let total = 0; const parts = [];
  for (const t of terms) {
    const sgn = t.startsWith('-') ? -1 : 1; const body = t.replace(/^[+-]/, '');
    if (body.includes('d')) {
      let [n, s] = body.split('d'); n = Number(n || 1); s = Number(s);
      if (n > 100 || s > 1000 || s < 2) return { error: 'Too many dice or invalid die size.' };
      if (n === 1 && s === 20 && mode !== 'normal') {
        const a = rollDie(20), b = rollDie(20), pick = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
        total += sgn * pick; parts.push(`d20 [${a}, ${b}] → ${pick} (${mode === 'adv' ? 'Advantage' : 'Disadvantage'})`);
      } else {
        const rolls = []; for (let i = 0; i < n; i++) rolls.push(rollDie(s));
        const sum = rolls.reduce((x, y) => x + y, 0); total += sgn * sum; parts.push(`${sgn < 0 ? '−' : ''}${n}d${s} [${rolls.join(', ')}]`);
      }
    } else { total += sgn * Number(body); parts.push((sgn < 0 ? '−' : '+') + body); }
  }
  return { total, detail: parts.join(' '), expr: clean };
}
if (typeof module !== 'undefined') module.exports = { Rules };
