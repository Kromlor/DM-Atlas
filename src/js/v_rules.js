/* Panel 2: Rules & References — spells, cantrips, weapons, glossary, rulings, monsters, sources. */
'use strict';
const SPELL_CLASSES = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard'];
const SCHOOLS = [...new Set(SRD.spells.map(s => s.school))].sort();
function levelLabel(s) { return s.level === 0 ? s.school + ' Cantrip' : 'Level ' + s.level + ' ' + s.school; }
function srdLinks(page) { return `<div class="srclinks"><a href="${SRD.source.url}" target="_blank" rel="noopener">Official SRD 5.2.1 page</a> · <a href="${SRD.source.pdf}${page ? '#page=' + page : ''}" target="_blank" rel="noopener">SRD PDF${page ? ' (p. ' + page + ')' : ''}</a> · <a href="${SRD.source.license}" target="_blank" rel="noopener">CC-BY-4.0</a></div>`; }
function spellCardHTML(s) {
  const desc = s.description.map(d => typeof d === 'string' ? `<p>${fmtSRD(d)}</p>` : `<table class="tbl"><caption>${esc(d.title || '')}</caption><thead><tr>${d.h.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${d.r.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('');
  const sbs = (s.statblocks || []).map(b => `<div class="statblock"><h2>${esc(b.statblock)}</h2>${b.abilities ? `<table class="abil"><tr>${b.abilities.map(a => `<th>${esc(a[0])}</th>`).join('')}</tr><tr>${b.abilities.map(a => `<td>${esc(a[1])} <small>(${esc(a[2])})</small></td>`).join('')}</tr></table>` : ''}${(b.lines || []).map(l => /^(Traits|Actions|Bonus Actions|Reactions)$/.test(l) ? `<h4>${esc(l)}</h4>` : `<p class="sbl">${fmtSRD(l)}</p>`).join('')}</div>`).join('');
  const hi = s.higher ? s.higher.replace(/^(Using a Higher-Level Spell Slot|Cantrip Upgrade)\.\s*/, '') : '';
  const hiLbl = s.higher ? (s.higher.startsWith('Cantrip') ? 'Cantrip Upgrade' : 'Using a Higher-Level Spell Slot') : '';
  return `<div class="spellcard"><div class="row between"><h2 class="deco">${esc(s.name)}</h2><div>${s.concentration ? '<span class="badge conc" title="Concentration">◉ Concentration</span>' : ''}${s.ritual ? '<span class="badge rit">Ritual</span>' : ''}</div></div>
    <p class="meta"><i>${esc(levelLabel(s))}</i> · ${esc(s.classes.join(', '))}</p>
    <div class="statgrid"><div><span>Casting Time</span><b>${esc(s.castingTime)}</b></div><div><span>Range</span><b>${esc(s.range)}</b></div><div><span>Components</span><b>${esc(s.components)}</b></div><div><span>Duration</span><b>${esc(s.duration)}</b></div></div>
    <div class="summary"><h4>Quick summary</h4><p>${esc(s.summary)}</p></div>
    <div class="guide"><h4>How to resolve it (DM guidance)</h4><ul>${s.guidance.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>
    <details class="fulltext" open><summary>Full spell text (SRD 5.2.1)</summary>${desc}${sbs}${s.higher ? `<p class="higher"><b><i>${hiLbl}.</i></b> ${fmtSRD(hi)}</p>` : ''}</details>
    <p class="src">Source: SRD 5.2.1, page ${s.page}. Summary and guidance are DM Atlas notes; the full text is the rule.</p>${srdLinks(s.page)}</div>`;
}
function showSpellModal(id) { const s = SRD.spells.find(x => x.id === id); if (s) openModal({ title: s.name, html: spellCardHTML(s), wide: true }); }
function spellFilterUI(params, lockCantrip) {
  return `<div class="filters"><input type="search" id="sq" placeholder="Search ${lockCantrip ? 'cantrips' : 'spells'} by name or text…" value="${esc(params.q || '')}" aria-label="Search">
   ${lockCantrip ? '' : `<select id="slv" aria-label="Level"><option value="">All levels</option><option value="0">Cantrips</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => `<option value="${l}" ${params.lv === String(l) ? 'selected' : ''}>Level ${l}</option>`).join('')}</select>`}
   <select id="scl" aria-label="Class"><option value="">All classes</option>${SPELL_CLASSES.map(c => `<option ${params.cl === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
   <select id="ssc" aria-label="School"><option value="">All schools</option>${SCHOOLS.map(c => `<option ${params.sc === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
   <select id="sco" aria-label="Concentration"><option value="">Concentration: any</option><option value="y" ${params.co === 'y' ? 'selected' : ''}>Concentration only</option><option value="n" ${params.co === 'n' ? 'selected' : ''}>No Concentration</option></select>
   <label class="chk"><input type="checkbox" id="sri" ${params.ri === 'y' ? 'checked' : ''}> Ritual</label></div>`;
}
function renderSpells(el, params, lockCantrip) {
  if (lockCantrip && params.lv === undefined) params.lv = '0';
  if (params.lv === '0' && !lockCantrip && false) { }
  el.innerHTML = `<div class="ld spells"><div class="ld-list wide"><div class="ld-head" id="scount"></div>${spellFilterUI(params, lockCantrip)}<div id="slist" class="slist" data-keep-scroll="slist"></div></div><div class="ld-detail parch" id="sdetail" data-keep-scroll="sdet"></div></div>`;
  const state = Object.assign({}, params);
  const apply = () => {
    const q = (state.q || '').toLowerCase();
    const list = SRD.spells.filter(s => (lockCantrip ? s.level === 0 : (state.lv === undefined || state.lv === '' || s.level === Number(state.lv))) &&
      (!state.cl || s.classes.includes(state.cl)) && (!state.sc || s.school === state.sc) && (!state.co || (state.co === 'y') === s.concentration) && (state.ri !== 'y' || s.ritual) &&
      (!q || s.name.toLowerCase().includes(q) || (q.length > 3 && s.description.some(d => typeof d === 'string' && d.toLowerCase().includes(q)))));
    list.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const total = lockCantrip ? SRD.spells.filter(s => s.level === 0).length : SRD.spells.length;
    $('#scount', el).textContent = `${list.length} of ${total} ${lockCantrip ? 'cantrips' : 'spells'} (SRD 5.2.1)`;
    let lastLv = -1;
    $('#slist', el).innerHTML = list.map(s => { const h = s.level !== lastLv && !lockCantrip ? `<h4>${s.level === 0 ? 'Cantrips' : 'Level ' + s.level}</h4>` : ''; lastLv = s.level; return h + `<button class="srow ${s.id === state.id ? 'on' : ''}" data-id="${s.id}"><b>${esc(s.name)}</b><span class="tags">${s.concentration ? '<i title="Concentration">◉</i>' : ''}${s.ritual ? '<i title="Ritual">R</i>' : ''}</span><small>${esc(s.school)} · ${esc(s.castingTime)}</small></button>`; }).join('') || '<p class="muted pad">No spells match these filters.</p>';
    const cur = SRD.spells.find(s => s.id === state.id) || list[0];
    $('#sdetail', el).innerHTML = cur ? spellCardHTML(cur) : '<p class="pad">Choose a spell.</p>';
    $$('.srow', el).forEach(b => b.onclick = () => { state.id = b.dataset.id; $$('.srow', el).forEach(x => x.classList.toggle('on', x === b)); $('#sdetail', el).innerHTML = spellCardHTML(SRD.spells.find(s => s.id === state.id)); $('#sdetail', el).scrollTop = 0; history.replaceState(null, '', routeHash(App.route, Object.assign({}, App.params, { id: state.id }))); App.params.id = state.id; });
  };
  $('#sq', el).oninput = debounce(e => { state.q = $('#sq', el).value; apply(); }, 120);
  const bind = (sel, key, fn = x => x.value) => { const x = $(sel, el); if (x) x.onchange = () => { state[key] = fn(x); apply(); }; };
  bind('#slv', 'lv'); bind('#scl', 'cl'); bind('#ssc', 'sc'); bind('#sco', 'co'); bind('#sri', 'ri', x => x.checked ? 'y' : '');
  apply();
}
VIEWS['rules/spells'] = { title: 'Spells', render: (el, p) => renderSpells(el, Object.assign({}, p), false) };
VIEWS['rules/cantrips'] = { title: 'Cantrips', render: (el, p) => renderSpells(el, Object.assign({}, p), true) };

/* ---------- weapons ---------- */
function weaponCardHTML(w) {
  const props = w.propList.map(p => { const key = p.split(' ')[0].replace(/\(.*/, ''); return `<li><b>${esc(p)}.</b> ${fmtSRD((SRD.weaponProps[key] || [''])[0])}</li>`; }).join('');
  const melee = w.kind === 'Melee'; const fin = w.propList.some(p => p.startsWith('Finesse')); const thrown = w.propList.some(p => p.startsWith('Thrown'));
  const abil = fin ? 'Strength or Dexterity (the player chooses — usually the higher)' : melee ? 'Strength' + (thrown ? ' (also when thrown — it is a melee weapon)' : '') : 'Dexterity';
  return `<div class="spellcard"><h2 class="deco">${esc(w.name)}</h2><p class="meta"><i>${esc(w.category)} ${esc(w.kind)} Weapon</i></p>
    <div class="statgrid"><div><span>Damage</span><b>${esc(w.damage)} ${esc(w.damageType)}</b></div><div><span>Properties</span><b>${esc(w.properties || '—')}</b></div><div><span>Mastery</span><b>${esc(w.mastery)}</b></div><div><span>Weight · Cost</span><b>${esc(w.weight)} · ${esc(w.cost)}</b></div></div>
    <div class="guide"><h4>How to resolve an attack</h4><ol>
      <li>Attack roll: d20 + <b>${abil}</b> modifier + Proficiency Bonus if the character is proficient with ${w.category} weapons.</li>
      <li>Meet or beat the target's AC to hit. A natural 20 always hits and is a Critical Hit; a natural 1 always misses.</li>
      <li>Damage: roll ${esc(w.damage)}${w.versatile ? ` (or ${esc(w.versatile)} when used with two hands)` : ''} + the same ability modifier. On a Critical Hit roll the damage dice twice, add the modifier once.</li>
      ${w.range ? `<li>Range ${esc(w.range)} ft.: attacks beyond the first number have Disadvantage; beyond the second they are impossible. Ranged attacks also have Disadvantage when an enemy who can see the attacker is within 5 feet.</li>` : ''}
      <li>Weapon Mastery (${esc(w.mastery)}): only characters with the Weapon Mastery feature for this weapon use it.</li>
      <li>Check ${esc(w.damageType)} Resistance, Vulnerability or Immunity on the target before subtracting HP.</li></ol></div>
    <h4>Properties</h4><ul class="props">${props || '<li>No properties.</li>'}</ul>
    <h4>Mastery: ${esc(w.mastery)}</h4><p>${fmtSRD((SRD.weaponProps[w.mastery] || [''])[0])}</p>
    <p class="src">Source: SRD 5.2.1 Weapons table.</p>${srdLinks()}</div>`;
}
function showWeaponModal(id) { const w = SRD.weapons.find(x => x.id === id); if (w) openModal({ title: w.name, html: weaponCardHTML(w), wide: true }); }
VIEWS['rules/weapons'] = {
  title: 'Weapons', render(el, params) {
    const st = Object.assign({}, params);
    el.innerHTML = `<div class="ld"><div class="ld-list wide"><div class="ld-head">${SRD.weapons.length} weapons (SRD 5.2.1)</div><div class="filters"><input type="search" id="wq" placeholder="Search weapons…" value="${esc(st.q || '')}"><select id="wcat"><option value="">All</option><option>Simple Melee</option><option>Simple Ranged</option><option>Martial Melee</option><option>Martial Ranged</option></select></div><div id="wlist" class="slist" data-keep-scroll="wl"></div></div><div class="ld-detail parch" id="wdet" data-keep-scroll="wd"></div></div>`;
    const apply = () => {
      const q = (st.q || '').toLowerCase();
      const list = SRD.weapons.filter(w => (!q || w.name.toLowerCase().includes(q) || w.properties.toLowerCase().includes(q) || w.mastery.toLowerCase().includes(q)) && (!st.cat || w.category + ' ' + w.kind === st.cat));
      let last = '';
      $('#wlist', el).innerHTML = list.map(w => { const g = w.category + ' ' + w.kind; const h = g !== last ? `<h4>${g} Weapons</h4>` : ''; last = g; return h + `<button class="srow ${w.id === st.id ? 'on' : ''}" data-id="${w.id}"><b>${esc(w.name)}</b><span class="tags">${esc(w.damage)}</span><small>${esc(w.damageType)} · ${esc(w.mastery)}</small></button>`; }).join('');
      const cur = SRD.weapons.find(w => w.id === st.id) || list[0];
      $('#wdet', el).innerHTML = cur ? weaponCardHTML(cur) : '';
      $$('.srow', el).forEach(b => b.onclick = () => { st.id = b.dataset.id; apply(); App.params.id = st.id; history.replaceState(null, '', routeHash(App.route, App.params)); });
    };
    $('#wq', el).oninput = () => { st.q = $('#wq', el).value; apply(); };
    $('#wcat', el).onchange = () => { st.cat = $('#wcat', el).value; apply(); };
    apply();
  }
};

/* ---------- glossary ---------- */
VIEWS['rules/glossary'] = {
  title: 'Rules Glossary', render(el, params) {
    const all = SRD.glossary.map(g => Object.assign({ src: 'Rules Glossary' }, g)).concat(SRD.playing.map(g => Object.assign({ src: 'Playing the Game' }, g)));
    el.innerHTML = `<div class="ld"><div class="ld-list wide"><div class="ld-head">${all.length} SRD 5.2.1 rules entries</div><div class="filters"><input type="search" id="gq" placeholder="Search rules (e.g. grappling, cover, exhaustion)…" value="${esc(params.q || '')}"><select id="gk"><option value="">All</option><option value="condition">Conditions</option><option value="core">Rules</option></select></div><div id="glist" class="slist" data-keep-scroll="gl"></div></div><div class="ld-detail parch" id="gdet" data-keep-scroll="gd"></div></div>`;
    let curTerm = params.q ? (all.find(g => g.term.toLowerCase().startsWith(params.q.toLowerCase())) || {}).term : null;
    const apply = () => {
      const q = $('#gq', el).value.toLowerCase(); const k = $('#gk', el).value;
      const list = all.filter(g => (!k || (k === 'condition' ? g.kind === 'condition' : g.kind !== 'condition')) && (!q || g.term.toLowerCase().includes(q) || g.text.join(' ').toLowerCase().includes(q)));
      list.sort((a, b) => (q && a.term.toLowerCase().includes(q) ? 0 : 1) - (q && b.term.toLowerCase().includes(q) ? 0 : 1));
      $('#glist', el).innerHTML = list.map(g => `<button class="srow ${g.term === curTerm ? 'on' : ''}" data-t="${esc(g.term)}"><b>${esc(g.term)}</b><small>${esc(g.src)}</small></button>`).join('') || '<p class="muted pad">No entries.</p>';
      const cur = all.find(g => g.term === curTerm) || list[0];
      $('#gdet', el).innerHTML = cur ? `<h2 class="deco">${esc(cur.term)}</h2>${cur.text.map(t => `<p>${fmtSRD(t)}</p>`).join('')}<p class="src">SRD 5.2.1 — ${esc(cur.src)}</p>${srdLinks()}` : '';
      $$('.srow', el).forEach(b => b.onclick = () => { curTerm = b.dataset.t; apply(); });
    };
    $('#gq', el).oninput = apply; $('#gk', el).onchange = apply; apply();
  }
};

/* ---------- quick rulings (DM Atlas summaries of SRD 5.2.1 rules) ---------- */
const RULINGS = [
  ['Combat start', 'Initiative & Surprise', 'Everyone rolls Initiative: a Dexterity check. A combatant that is <b>surprised</b> has Disadvantage on that roll (2024 rule) — they still act in order. Ties: you decide among tied monsters, the players decide among tied characters, and you decide between a monster and a character.', 'Initiative'],
  ['Combat start', 'Who rolls for monsters', 'Roll once for a group of identical monsters so they share an Initiative count, or roll for each if you prefer. Enter every result in the Initiative Tracker.', 'Initiative'],
  ['Turns', 'On a turn', 'Move up to its Speed (split before and after actions), take one action, at most one Bonus Action if something grants one, and one free object interaction. One Reaction per round, regained at the start of its turn.', 'Your Turn'],
  ['Turns', 'Opportunity Attack', 'When a creature you can see leaves your reach using its action, Bonus Action, Reaction or movement, you can use your Reaction to make one melee attack against it. Disengage, teleporting, or being moved without using movement avoids it.', 'Opportunity Attacks'],
  ['Turns', 'Ready', 'Choose a trigger and a response (an action, or moving). When the trigger happens, the response uses the creature\'s Reaction. A readied spell needs Concentration until it\'s released.', 'Ready [Action]'],
  ['Attacks', 'Hit or miss', 'd20 + attack bonus. Equal to or higher than AC hits. Natural 20: hit and Critical Hit. Natural 1: miss.', 'Rolling 20 or 1'],
  ['Attacks', 'Critical Hit damage', 'Roll the attack\'s damage dice twice and add them together, then add modifiers once. Extra dice (like Sneak Attack) are doubled too.', 'Critical Hits'],
  ['Attacks', 'Advantage & Disadvantage', 'Roll two d20s: Advantage takes the higher, Disadvantage the lower. If both apply, they cancel and you roll one d20 — no matter how many sources of each.', 'Advantage/Disadvantage'],
  ['Attacks', 'Ranged attacks up close', 'A ranged attack roll has Disadvantage if a hostile creature that can see the attacker and isn\'t Incapacitated is within 5 feet. Attacks beyond normal range (up to long range) also have Disadvantage.', 'Ranged Attacks in Close Combat'],
  ['Attacks', 'Cover', 'Half Cover: +2 AC and Dexterity saves. Three-Quarters Cover: +5. Total Cover: can\'t be targeted directly by attacks or spells.', 'Cover'],
  ['Attacks', 'Two light weapons', 'After attacking with a Light weapon as part of the Attack action, a creature can make one extra attack as a Bonus Action with a different Light weapon; don\'t add the ability modifier to that extra attack\'s damage unless it\'s negative. The Nick mastery lets the extra attack happen as part of the Attack action instead.', 'Light'],
  ['Attacks', 'Grapple & Shove', 'Part of an Unarmed Strike. The target (no more than one size larger, within reach) makes a Strength or Dexterity save (its choice) against DC 8 + the attacker\'s Strength modifier + Proficiency Bonus. Grapple: it gains the Grappled condition (needs a free hand). Shove: push 5 feet or knock Prone. Escaping a grapple: an action, Strength (Athletics) or Dexterity (Acrobatics) check against the same DC.', 'Unarmed Strike'],
  ['Damage', 'Resistance, Vulnerability, Immunity', 'Resistance halves damage of that type (round down). Vulnerability doubles it. Immunity means no damage. Apply each only once, even with multiple sources.', 'Resistance and Vulnerability'],
  ['Damage', 'Concentration save', 'When a concentrating creature takes damage, it makes a Constitution save: DC 10 or half the damage taken (round down), whichever is higher, to a maximum of DC 30. Concentration also ends if it has the Incapacitated condition or dies.', 'Concentration'],
  ['Damage', 'Temporary Hit Points', 'A buffer lost first. They don\'t stack — keep the higher amount. Healing doesn\'t restore them.', 'Temporary Hit Points'],
  ['0 HP', 'Character drops to 0 HP', 'The character has the Unconscious condition and starts making Death Saving Throws on its turns. If damage reduces it to 0 and leftover damage is equal to or more than its Hit Point maximum, it dies instantly.', 'Dropping to 0 Hit Points'],
  ['0 HP', 'Death Saving Throws', 'At the start of each of its turns: d20 with no modifiers. 10+ success, 9 or lower failure. Three successes: Stable. Three failures: dead. Natural 1 counts as two failures; natural 20 regains 1 HP. Taking damage at 0 HP is one failure (a Critical Hit is two).', 'Death Saving Throws'],
  ['0 HP', 'Stabilizing', 'A creature can take the Help action to stabilize a dying creature with a DC 10 Wisdom (Medicine) check. Any healing restores consciousness.', 'Stabilizing a Character'],
  ['0 HP', 'Monsters at 0 HP', 'Most monsters simply die at 0 HP (you decide for important NPCs). When an attacker would reduce a creature to 0 HP with a melee attack, it can instead leave it at 1 HP with the Unconscious condition; it starts a Short Rest and stays Unconscious until it regains HP or someone succeeds on a DC 10 Wisdom (Medicine) check as an action.', 'Knocking Out a Creature'],
  ['Checks', 'Typical DCs', 'Very easy 5 · Easy 10 · Medium 15 · Hard 20 · Very hard 25 · Nearly impossible 30.', 'Ability Check'],
  ['Checks', 'Help', 'Assist an ability check (the helper must have proficiency in the relevant skill or tool) or assist an attack against an enemy within 5 feet of the helper: the ally\'s next roll has Advantage.', 'Help [Action]'],
  ['Checks', 'Hide', 'Dexterity (Stealth) DC 15 while Heavily Obscured or behind Three-Quarters or Total Cover and out of enemies\' line of sight. On a success the creature has the Invisible condition; note the total — it\'s the DC to find it with Wisdom (Perception).', 'Hide [Action]'],
  ['Checks', 'Influence', 'Ask the target to do something. Willing: no check. Unwilling: no check. Hesitant: Charisma (Deception, Intimidation, Performance or Persuasion) or Wisdom (Animal Handling for a Beast or Monstrosity), DC 15 or the monster\'s Intelligence score, whichever is higher.', 'Influence [Action]'],
  ['Checks', 'Heroic Inspiration', 'A character with Heroic Inspiration can spend it to reroll any one die immediately after rolling it, and must use the new roll. A character can\'t have more than one.', 'Heroic Inspiration'],
  ['Conditions', 'Exhaustion (2024)', 'Cumulative levels 1–6. Each level: d20 Tests take −2 × level, and Speed drops by 5 × level feet. Level 6: the creature dies. A Long Rest removes 1 level.', 'Exhaustion [Condition]'],
  ['Exploration', 'Falling', '1d6 Bludgeoning damage per 10 feet fallen (maximum 20d6), and the creature lands Prone unless it avoids all the damage.', 'Falling [Hazard]'],
  ['Exploration', 'Jumping', 'Long Jump: feet up to the Strength score with a 10-foot running start, half that standing. High Jump: 3 + Strength modifier feet with a running start, half that standing.', null],
  ['Exploration', 'Difficult Terrain', 'Every foot of movement costs 1 extra foot.', 'Difficult Terrain'],
  ['Rests', 'Short and Long Rest', 'Short Rest: 1 hour; spend Hit Point Dice to heal. Long Rest: 8 hours; regain all HP and all spent Hit Point Dice, reduce Exhaustion by 1.', 'Long Rest'],
  ['Magic', 'One spell slot per turn', 'A creature can expend only one spell slot per turn to cast a spell. Cantrips and spells cast without a slot are not limited by this.', null]
];
VIEWS['rules/rulings'] = {
  title: 'Quick Rulings', render(el) {
    const groups = [...new Set(RULINGS.map(r => r[0]))];
    el.innerHTML = `<div class="parch pad scrolly" data-keep-scroll="rul"><div class="row between"><h2 class="deco">Quick Rulings — 2024 rules</h2><input type="search" id="rq" placeholder="Filter rulings…"></div>
      <p class="muted">Short DM Atlas summaries of SRD 5.2.1 rules. Click “Full rule” for the exact SRD text.</p>
      <div class="rulings">${groups.map(g => `<section data-g><h3>${esc(g)}</h3><div class="rgrid">${RULINGS.filter(r => r[0] === g).map(r => `<div class="ruling" data-txt="${esc((r[1] + ' ' + r[2]).toLowerCase().replace(/<[^>]+>/g, ''))}"><h4>${esc(r[1])}</h4><p>${r[2]}</p>${r[3] ? `<button class="mini" data-full="${esc(r[3])}">Full rule</button>` : ''}</div>`).join('')}</div></section>`).join('')}</div></div>`;
    $$('[data-full]', el).forEach(b => b.onclick = () => {
      const t = b.dataset.full; const g = SRD.glossary.concat(SRD.playing).find(x => x.term === t) || SRD.glossary.find(x => x.term.startsWith(t));
      const wp = SRD.weaponProps[t];
      openModal({ title: t, html: g ? g.text.map(x => `<p>${fmtSRD(x)}</p>`).join('') + '<p class="src">SRD 5.2.1</p>' : wp ? wp.map(x => `<p>${fmtSRD(x)}</p>`).join('') + '<p class="src">SRD 5.2.1 — Weapon properties</p>' : '<p>Not found.</p>' });
    });
    $('#rq', el).oninput = () => { const q = $('#rq', el).value.toLowerCase(); $$('.ruling', el).forEach(r => r.hidden = q && !r.dataset.txt.includes(q)); $$('[data-g]', el).forEach(s => s.hidden = !$$('.ruling', s).some(r => !r.hidden)); };
  }
};

/* ---------- SRD monsters ---------- */
function crOf(m) { const l = (m.lines || []).find(x => x.startsWith('CR ')); return l ? l.split(' ')[1] : '?'; }
function showMonsterModal(name) { const m = SRD.monsters.find(x => x.name.toLowerCase() === name.toLowerCase()); if (!m) return; const md = openModal({ title: m.name, html: renderStatBlock(m) + `<div class="btnrow"><button class="primary" data-add>Add to Initiative Tracker</button></div><p class="src">SRD 5.2.1, page ${m.page}</p>`, wide: true }); $('[data-add]', md.body).onclick = () => Combat.addFoes([{ count: 1, name: m.name }]); }
VIEWS['rules/monsters'] = {
  title: 'SRD Monsters', render(el, params) {
    const st = Object.assign({}, params);
    el.innerHTML = `<div class="ld"><div class="ld-list wide"><div class="ld-head">${SRD.monsters.length} SRD 5.2.1 stat blocks (read-only)</div><div class="filters"><input type="search" id="mq" placeholder="Search monsters…" value="${esc(st.q || '')}"></div><div id="mlist" class="slist" data-keep-scroll="ml"></div></div><div class="ld-detail parch" id="mdet" data-keep-scroll="md"></div></div>`;
    const apply = () => {
      const q = (st.q || '').toLowerCase();
      const list = SRD.monsters.filter(m => !q || m.name.toLowerCase().includes(q) || m.meta.toLowerCase().includes(q));
      $('#mlist', el).innerHTML = list.map(m => `<button class="srow ${m.id === st.id ? 'on' : ''}" data-id="${m.id}"><b>${esc(m.name)}</b><span class="tags">CR ${esc(crOf(m))}</span><small>${esc(m.meta)}</small></button>`).join('');
      const cur = SRD.monsters.find(m => m.id === st.id) || list[0];
      $('#mdet', el).innerHTML = cur ? renderStatBlock(cur) + `<div class="btnrow"><button class="primary" data-add="${cur.name}">Add to Initiative Tracker</button></div><p class="src">SRD 5.2.1, page ${cur.page}. Stat blocks are a read-only reference; DM Atlas does not include an editable monster-sheet system.</p>${srdLinks(cur.page)}` : '';
      $$('.srow', el).forEach(b => b.onclick = () => { st.id = b.dataset.id; apply(); });
      const a = $('[data-add]', el); if (a) a.onclick = () => Combat.addFoes([{ count: 1, name: a.dataset.add }]);
    };
    $('#mq', el).oninput = () => { st.q = $('#mq', el).value; apply(); }; apply();
  }
};
VIEWS['rules/credits'] = {
  title: 'Sources & License', render(el) {
    const c = SRD.spells.filter(s => s.level === 0).length;
    el.innerHTML = `<div class="parch pad scrolly"><h2 class="deco">Sources &amp; License</h2>
    <h3>Attribution</h3><blockquote class="attrib">${esc(SRD.source.attribution)}</blockquote>
    <p><a href="${SRD.source.url}" target="_blank" rel="noopener">Official SRD page (D&amp;D Beyond)</a> · <a href="${SRD.source.pdf}" target="_blank" rel="noopener">SRD 5.2.1 PDF</a> · <a href="${SRD.source.license}" target="_blank" rel="noopener">Creative Commons Attribution 4.0 (CC-BY-4.0) license</a></p>
    <h3>What's included</h3><ul><li><b>${SRD.spells.length} spells</b>, including <b>${c} cantrips</b> — every spell in SRD 5.2.1, extracted from the official PDF.</li><li><b>${SRD.weapons.length} weapons</b> from the SRD 5.2.1 Weapons table, with properties and mastery.</li><li>${SRD.glossary.length + SRD.playing.length} rules glossary and “Playing the Game” entries, including all 15 conditions.</li><li>${SRD.monsters.length} monster stat blocks (read-only reference).</li></ul>
    <h3>What DM Atlas adds</h3><p>Spell “quick summaries” and “DM guidance” are generated notes written by DM Atlas to help you resolve the spell; the full SRD text shown on each card is the actual rule. Lessons, the beginner course, the first adventure, “What Do I Roll?” and the quick rulings are original DM Atlas writing based on the 2024 rules (SRD 5.2.1). Only the 2024 rules are used; no 2014 material is mixed in.</p>
    <h3>Not included</h3><p>DM Atlas does not include an editable monster-sheet system, an automated spell-effect engine, or D&amp;D Beyond character import. Dungeons &amp; Dragons is a trademark of Wizards of the Coast. DM Atlas is unofficial and not endorsed by Wizards of the Coast.</p></div>`;
  }
};
