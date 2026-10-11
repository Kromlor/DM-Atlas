/* DM Atlas end-to-end tests (headless Chrome via puppeteer-core). Run: NODE_PATH=/tmp/pt/node_modules node test/run_tests.js */
const fs = require('fs'); const path = require('path');
const H = require('./helpers'); const { sleep } = H;
const SHOTS = path.join(__dirname); const results = []; let cur = '';
function ok(cond, msg) { results.push({ group: cur, ok: !!cond, msg }); console.log((cond ? '  ✔ ' : '  ✘ ') + msg); }
function group(n) { cur = n; console.log('\n■ ' + n); }
const ev = (p, fn, ...a) => p.evaluate(fn, ...a);
async function shot(p, name) { await p.evaluate(() => { const t = document.querySelector('#toasts'); if (t) t.innerHTML = ''; }); await sleep(250); await p.screenshot({ path: path.join(SHOTS, name) }); }
async function clickSel(p, sel) { await p.waitForSelector(sel, { visible: true, timeout: 4000 }); await p.click(sel); await sleep(120); }
async function typeIn(p, sel, val) { await p.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, String(val)); await sleep(60); }
async function addFoe(p, o) { return ev(p, o => { const { Store, Combat } = window.DMAtlas; let id; Store.mutate(s => { const c = Combat.newCombatant(o); id = c.id; s.combat.combatants.push(c); }); return id; }, o); }
async function pc(p, i) { return ev(p, i => window.DMAtlas.Store.fresh().party[i], i); }
async function foe(p, id) { return ev(p, id => window.DMAtlas.Store.fresh().combat.combatants.find(c => c.id === id), id); }
/* Open attack modal from a party card weapon button (index wi on card ci). */
async function openAttack(p, ci, wi = 0) { await H.go(p, 'combat/party'); const btns = await p.$$(`.pcard:nth-child(${ci + 1}) [data-atk]`); await btns[wi].click(); await p.waitForSelector('.modal.attack', { visible: true }); await sleep(100); }
async function fillAttack(p, { target, ac, adv, dis, a, b, dmg, def }) {
  if (target) { await p.select('#af-target', target); await sleep(80); }
  if (ac !== undefined) await typeIn(p, '#af-ac', ac);
  if (adv) { await p.click('#af-adv'); await sleep(50); } if (dis) { await p.click('#af-dis'); await sleep(50); }
  if (a !== undefined) await typeIn(p, '#af-d20a', a); if (b !== undefined) await typeIn(p, '#af-d20b', b);
  if (dmg !== undefined) await typeIn(p, '#af-dmg', dmg);
  if (def) { await p.click(`input[name=af-def][value=${def}]`); await sleep(60); }
}
const txt = (p, sel) => p.$eval(sel, e => e.innerText).catch(() => '');
async function closeModals(p) { await ev(p, () => { document.querySelectorAll('.modal-wrap').forEach(w => w.remove()); }); }
async function fresh(p) { await ev(p, () => { localStorage.clear(); }); await p.reload({ waitUntil: 'load' }); await sleep(300); }

(async () => {
  const browser = await H.launch();
  const ROUTES = ['screen', 'guide/campaign', 'guide/lessons', 'guide/course', 'guide/adventure', 'guide/roll', 'rules/spells', 'rules/cantrips', 'rules/weapons', 'rules/glossary', 'rules/rulings', 'rules/monsters', 'rules/credits', 'combat/party', 'combat/tracker', 'combat/log', 'tools/dice', 'tools/events', 'tools/npcs', 'tools/notes', 'tools/save', 'campaigns'];
  let p = await H.page(browser);
  await fresh(p);
  try {
    group('Load, JS syntax and navigation (http://localhost)');
    ok(p._errors.length === 0, 'No JavaScript errors on load (' + p._errors.join('; ') + ')');
    const counts = await ev(p, () => ({ spells: DM_SRD.spells.length, cantrips: DM_SRD.spells.filter(s => s.level === 0).length, weapons: DM_SRD.weapons.length, lessons: DM_LESSONS.length, course: DM_COURSE.length, courseQ: DM_COURSE.every(s => s.q.length >= 2 && s.q.every(q => q.f.length === q.a.length)), scenes: DM_ADVENTURE.scenes.length, attribution: DM_SRD.source.attribution }));
    ok(counts.spells === 339, 'SRD spells: ' + counts.spells); ok(counts.cantrips === 27, 'SRD cantrips: ' + counts.cantrips); ok(counts.weapons === 38, 'SRD weapons: ' + counts.weapons);
    ok(counts.lessons === 38, 'Mini-lessons: ' + counts.lessons); ok(counts.course === 12 && counts.courseQ, '12-step course with feedback for every answer'); ok(counts.scenes === 5, 'Guided adventure scenes: ' + counts.scenes);
    ok(/System Reference Document 5\.2\.1/.test(counts.attribution) && /creativecommons\.org\/licenses\/by\/4\.0/.test(counts.attribution), 'Exact SRD 5.2.1 CC-BY-4.0 attribution present');
    for (const r of ROUTES) { await H.go(p, r); const t = await txt(p, '#view'); ok(t.length > 40 && !/Something went wrong/.test(t), `Route #/${r} renders (${t.slice(0, 40).replace(/\n/g, ' ')}…)`); }
    ok(p._errors.length === 0, 'No JavaScript errors after visiting every section');
    group('First run: no campaign until the DM picks one');
    await fresh(p);
    const first = await ev(p, () => { const s = window.DMAtlas.Store.fresh(); return { cid: window.DMAtlas.Store.cid, party: s.party.length, cb: s.combat.combatants.length, log: s.log.length, notes: s.notes, recap: s.recap, meta: window.DMAtlas.Meta.get().activeCampaignId }; });
    ok(first.cid === null && first.meta === null, 'Fresh load: no campaign is active');
    ok(first.party === 0 && first.cb === 0 && first.log === 0 && !first.notes && !first.recap, 'Fresh load: empty party, no combatants, empty notes/recap/log');
    ok(/No campaign selected/.test(await txt(p, '#campPill')), 'Header campaign selector says “No campaign selected”');
    await H.go(p, 'screen'); ok(/No campaign selected/.test(await txt(p, '.p1')) && /No characters yet/.test(await txt(p, '.p3')), 'DM Screen shows the empty state (no campaign, no party)');
    await shot(p, 'shot-main.png');
    await H.go(p, 'guide/campaign'); const emptyTxt = await txt(p, '#view');
    ok(/No campaign selected/.test(emptyTxt) && /pick one from your library or import one/i.test(emptyTxt) && /Pick a campaign/.test(emptyTxt) && /Import campaign/.test(emptyTxt) && /Start a blank campaign/.test(emptyTxt), 'Guide the Game campaign area: friendly empty state with Pick / Import / Start blank buttons');
    await shot(p, 'shot-empty.png');
    for (const r of ['guide/lessons', 'guide/course', 'guide/adventure', 'guide/roll', 'rules/spells', 'rules/weapons', 'rules/glossary', 'rules/monsters', 'tools/dice', 'tools/events', 'tools/npcs', 'tools/notes', 'tools/save', 'combat/party', 'combat/tracker', 'campaigns']) { await H.go(p, r); const t = await txt(p, '#view'); ok(t.length > 40 && !/Something went wrong/.test(t), 'Works with no campaign: #/' + r); }
    await H.go(p, 'combat/party'); ok(/scratch table/i.test(await txt(p, '#view')), 'Party screen explains the separate scratch table');
    await ev(p, () => window.DMAtlas.Store.mutate(s => { s.party.push(normalizePC({ name: 'Scratch Sam' })); s.notes = 'scratch note'; }));
    await H.go(p, 'campaigns'); ok(/No campaign/.test(await txt(p, '.campcard.none')) && /Selected now/.test(await txt(p, '.campcard.none')), 'Picker has an explicit “No campaign” option, selected');
    await clickSel(p, '[data-run="hollowmere-year-one"]'); await sleep(200);
    let hs = await ev(p, () => ({ cid: window.DMAtlas.Store.cid, party: window.DMAtlas.Store.fresh().party.map(x => x.name), notes: window.DMAtlas.Store.fresh().notes }));
    ok(hs.cid === 'hollowmere-year-one' && /Hollowmere/.test(await txt(p, '#campPill')), 'Picking Hollowmere activates it (header updated)');
    ok(hs.party.length === 0 && !hs.notes, 'Scratch characters/notes do not leak into Hollowmere');
    await ev(p, () => window.DMAtlas.Store.mutate(s => { s.party.push(normalizePC({ name: 'Hollow Hal' })); }));
    await H.go(p, 'guide/campaign'); ok(/Sky-Ferry|Secret Story|Hollowmere/.test(await txt(p, '#view')), 'Guide the Game shows Hollowmere content');
    await p.reload({ waitUntil: 'load' }); await sleep(300);
    ok((await ev(p, () => window.DMAtlas.Store.cid)) === 'hollowmere-year-one' && /Hollowmere/.test(await txt(p, '#campPill')), 'Reload keeps Hollowmere selected');
    await H.go(p, 'campaigns'); await clickSel(p, '[data-none]'); await sleep(200);
    hs = await ev(p, () => ({ cid: window.DMAtlas.Store.cid, party: window.DMAtlas.Store.fresh().party.map(x => x.name) }));
    ok(hs.cid === null && /No campaign selected/.test(await txt(p, '#campPill')) && hs.party.join() === 'Scratch Sam', 'Switching back to “No campaign” restores the empty state (scratch table only)');
    await p.reload({ waitUntil: 'load' }); await sleep(300);
    ok((await ev(p, () => window.DMAtlas.Store.cid)) === null && /No campaign selected/.test(await txt(p, '#campPill')), 'Reload keeps “No campaign” selected');
    await ev(p, () => window.DMAtlas.switchCampaign('hollowmere-year-one', true)); ok((await ev(p, () => window.DMAtlas.Store.fresh().party.map(x => x.name).join())) === 'Hollow Hal', 'Hollowmere kept its own saved party through the switches');
    await ev(p, () => window.DMAtlas.switchCampaign(null, true));
    // blank campaign
    await H.go(p, 'guide/campaign'); await clickSel(p, '[data-nc="blank"]'); await typeIn(p, '#bcname', 'Shattered Coast'); await clickSel(p, '.modal [data-ok]'); await sleep(200);
    ok((await ev(p, () => window.DMAtlas.Store.cid)) === 'shattered-coast' && (await ev(p, () => window.DMAtlas.Store.fresh().party.length)) === 0 && /Shattered Coast/.test(await txt(p, '#campPill')), 'Start a blank campaign creates and activates an empty campaign');
    // legacy upgrade: old data with no stored choice keeps Hollowmere
    await ev(p, () => { localStorage.clear(); localStorage.setItem('dmatlas.camp.hollowmere-year-one', JSON.stringify({ party: [{ name: 'Legacy Lin' }] })); }); await p.reload({ waitUntil: 'load' }); await sleep(300);
    ok((await ev(p, () => window.DMAtlas.Store.cid)) === 'hollowmere-year-one' && (await ev(p, () => window.DMAtlas.Store.fresh().party[0].name)) === 'Legacy Lin', 'Existing saved Hollowmere progress from older versions still loads as active');
    await fresh(p);
    const ctrls = await ev(p, () => ['#gsearch', '#btnFull', '#btnMon', '#btnPop', '#btnSave', '[data-mode=learn]', '[data-mode=table]'].every(s => document.querySelector(s)));
    ok(ctrls, 'Header has search, Full Screen, Monitor Setup, Pop Out, Save/Resume and Learning/Table toggle');
    await H.go(p, 'screen'); ok(await ev(p, () => document.querySelectorAll('.screen4 .panel').length === 4), 'DM Screen shows the four panels');
    await clickSel(p, '[data-mode=table]'); ok(await ev(p, () => document.body.classList.contains('mode-table') && getComputedStyle(document.querySelector('.learn-only')).display === 'none'), 'Table mode hides learning tips'); await clickSel(p, '[data-mode=learn]');
    await typeIn(p, '#gsearch', 'firebal'); ok(/Fireball/.test(await txt(p, '#gresults')), 'Global search finds Fireball');
    await clickSel(p, '#gresults button'); ok(/Fireball/.test(await txt(p, '#sdetail')), 'Search result opens the spell card');

    group('Spell & weapon reference');
    await H.go(p, 'rules/spells'); await p.select('#slv', '3'); await sleep(80); let c = await txt(p, '#scount'); ok(/^42 of 339/.test(c), 'Level filter: ' + c);
    await p.select('#slv', ''); await p.select('#scl', 'Paladin'); await p.select('#sco', 'y'); await sleep(80); c = await txt(p, '#scount'); const allPalConc = await ev(p, () => { const ids = [...document.querySelectorAll('.srow')].map(b => b.dataset.id); return ids.length > 0 && ids.every(id => { const s = DM_SRD.spells.find(x => x.id === id); return s.classes.includes('Paladin') && s.concentration; }); });
    ok(allPalConc, 'Class + Concentration filters: ' + c);
    await H.go(p, 'rules/spells', {}); await ev(p, () => location.hash = '#/rules/spells?id=fireball'); await sleep(250);
    const card = await txt(p, '#sdetail'); ok(/Quick summary/i.test(card) && /DM guidance/i.test(card) && /8d6/.test(card) && /Using a Higher-Level Spell Slot/i.test(card) && /Official SRD 5\.2\.1 page/i.test(card), 'Spell card: summary, DM guidance, full text, scaling, official links');
    await shot(p, 'shot-spells.png');
    await H.go(p, 'rules/cantrips'); c = await txt(p, '#scount'); ok(/^27 of 27/.test(c), 'Cantrip list: ' + c);
    await ev(p, () => location.hash = '#/rules/weapons?id=longsword'); await sleep(250); const wc = await txt(p, '#wdet'); ok(/1d8 Slashing/.test(wc) && /Versatile/.test(wc) && /Sap/.test(wc) && /How to resolve an attack/i.test(wc) && /3 lb/.test(wc) && /15 GP/.test(wc), 'Weapon card: damage, properties, mastery, weight, cost, resolution');

    group('Lessons, course, adventure, What Do I Roll?');
    await H.go(p, 'guide/lessons'); ok(await ev(p, () => document.querySelectorAll('.ld-list [data-id]').length === 38), '38 lessons listed'); await shot(p, 'shot-lessons.png');
    await H.go(p, 'guide/course'); const q0 = await ev(p, () => DM_COURSE[0].q.map(q => q.c));
    const wrongIdx = q0[0] === 0 ? 1 : 0; await clickSel(p, `.quiz[data-q="0"] .ans[data-a="${wrongIdx}"]`); ok(/Not quite/.test(await txt(p, '.quiz[data-q="0"] .fb')), 'Wrong practice answer shows explanatory feedback');
    for (let i = 0; i < q0.length; i++) await clickSel(p, `.quiz[data-q="${i}"] .ans[data-a="${q0[i]}"]`);
    ok(/Step complete/.test(await txt(p, '.ld-detail')), 'Answering all correctly completes the step');
    await H.go(p, 'guide/adventure'); await clickSel(p, '[data-sc="3"]'); ok(/Goblin/.test(await txt(p, '.ld-detail')), 'Adventure scene 3 renders with monsters');
    await H.go(p, 'guide/roll'); await clickSel(p, '.opt[data-to="r_auto"]'); ok(/No roll/.test(await txt(p, '.result')), 'Roll guide: routine action → no roll');
    await clickSel(p, '[data-path="q1"]'); await clickSel(p, '.opt[data-to="q2"]'); await clickSel(p, '.opt[data-to="r_impossible"]'); ok(/impossible|can't|cannot/i.test(await txt(p, '.result')), 'Roll guide: impossible action → no roll can make it possible');

    group('Weapon autofill and bonus math');
    const W = await ev(p, () => {
      const R = window.DMAtlas.Rules; const pc = o => normalizePC(o); const w = (id, x = {}) => Object.assign(R.weaponFromRef(id), x);
      const out = {};
      const ls = w('longsword'); out.autofill = [ls.damage, ls.damageType, ls.properties, ls.mastery, ls.versatile];
      let r = R.calcWeapon(pc({}), w('longsword')); out.zero = [r.atk, r.dmg, r.pb];
      r = R.calcWeapon(pc({ level: 5, str: 3, profMartial: true }), w('longsword')); out.prof = [r.atk, r.dmg, r.pb, r.prof];
      r = R.calcWeapon(pc({ level: 5, str: 3, profSimple: true }), w('longsword')); out.noprof = [r.atk, r.prof];
      r = R.calcWeapon(pc({ level: 1, str: 1, dex: 4, profWeapons: ['Rapier'] }), w('rapier')); out.finesse = [r.ability, r.atk, r.dmg];
      r = R.calcWeapon(pc({ level: 1, str: 1, dex: 4, profWeapons: ['Rapier'] }), w('rapier', { ability: 'str' })); out.finesseChoice = [r.ability, r.atk, r.dmg];
      r = R.calcWeapon(pc({ level: 1, str: 1, dex: 4, profSimple: true }), w('handaxe')); out.thrown = [r.ability, r.atk];
      r = R.calcWeapon(pc({ level: 1, str: 1, dex: 4, profSimple: true }), w('dagger')); out.dagger = [r.ability, r.atk];
      r = R.calcWeapon(pc({ level: 1, str: 3, dex: 2, profSimple: true }), w('shortbow')); out.ranged = [r.ability, r.atk];
      r = R.calcWeapon(pc({ level: 1, str: 3, profMartial: true }), w('longsword', { grip: 'two' })); out.versatile = r.die;
      r = R.calcWeapon(pc({ level: 9, str: 4, profMartial: true }), w('longsword', { atkExtra: 1, dmgExtra: 1 })); out.override = [r.atkAuto, r.atk, r.dmgAuto, r.dmg];
      r = R.calcWeapon(pc({ level: 3, str: 2, profMartial: true }), w('longsword', { profOverride: 'no' })); out.forceNo = r.atk;
      out.pb = [1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(pbForLevel);
      return out;
    });
    ok(JSON.stringify(W.autofill) === JSON.stringify(['1d8', 'Slashing', 'Versatile (1d10)', 'Sap', '1d10']), 'Selecting Longsword autofills 1d8 Slashing, Versatile (1d10), mastery Sap');
    ok(W.zero[0] === 0 && W.zero[1] === 0 && W.zero[2] === 0, 'Missing ability/level info → attack +0, damage +0');
    ok(W.prof.join() === '6,3,3,true', 'Level 5, STR +3, martial proficiency → +6 to hit, +3 damage (PB not added to damage)');
    ok(W.noprof.join() === '3,false', 'Not proficient → no Proficiency Bonus (+3)');
    ok(W.finesse.join() === 'DEX,6,4', 'Finesse uses the better of STR/DEX (DEX +4 → +6/+4)');
    ok(W.finesseChoice.join() === 'STR,3,1', 'Finesse ability can be chosen (STR → +3/+1)');
    ok(W.thrown.join() === 'STR,3', 'Thrown melee weapon (Handaxe) uses STR even when DEX is higher');
    ok(W.dagger.join() === 'DEX,6', 'Thrown + Finesse (Dagger) may use DEX');
    ok(W.ranged.join() === 'DEX,4', 'Ranged weapon uses DEX');
    ok(W.versatile === '1d10', 'Versatile two-handed grip uses the larger die');
    ok(W.override.join() === '8,9,4,5', 'Manual magic bonus kept separate from automatic bonus');
    ok(W.forceNo === 2, 'Proficiency override “No” removes PB');
    ok(W.pb.join() === '2,2,3,3,4,4,5,5,6,6', 'Proficiency Bonus by level 1-4:+2 … 17-20:+6');

    group('Party dashboard and popup editing');
    await H.seedParty(p, 4); await H.go(p, 'combat/party');
    await clickSel(p, '.pcard:nth-child(1) [data-edit]');
    const fields = await ev(p, () => ['name', 'player', 'cls', 'species', 'level', 'ac', 'hp', 'maxHp', 'pp', 'saveDc', 'spellAtk', 'initBonus', 'str', 'dex', 'profSimple', 'profMartial', 'concentrating', 'notes'].filter(k => !document.querySelector(`.modal [data-f="${k}"]`)));
    ok(fields.length === 0, 'Edit modal has every spec field' + (fields.length ? ' (missing ' + fields + ')' : ''));
    ok(await ev(p, () => document.querySelectorAll('.modal [data-cond]').length === 15), 'Edit modal lists the 15 conditions');
    await typeIn(p, '.modal [data-f="ac"]', '19'); await p.select('#addw', 'warhammer'); await sleep(150);
    const calcTxt = await ev(p, () => [...document.querySelectorAll('.wed')].pop().innerText); ok(/Attack \+5/.test(calcTxt) && /1d8 \+3/.test(calcTxt), 'Adding a Warhammer autofills and shows auto bonus (+5, 1d8 +3)');
    await ev(p, () => document.querySelector('#wedit').closest('fieldset').scrollIntoView({ block: 'start' })); await shot(p, 'shot-weapon.png');
    await clickSel(p, '.modal [data-save]'); const p0 = await pc(p, 0);
    ok(String(p0.ac) === '19' && p0.weapons.some(w => w.name === 'Warhammer'), 'Saving the modal updates the character');
    ok(await ev(p, () => document.querySelectorAll('.pcard:nth-child(1) [data-atk]').length === 2 && /All Weapons \(4\)/.test(document.querySelector('.pcard:nth-child(1) [data-allw]').innerText)), 'Card shows two weapon buttons plus “All Weapons (4)”');
    await clickSel(p, '.pcard:nth-child(1) [data-allw]'); ok(await ev(p, () => document.querySelectorAll('.modal .wrow').length === 4), 'All Weapons popup lists every weapon'); await closeModals(p);

    group('Guided attacks: hit/miss/crit/advantage');
    await fresh(p); await H.seedParty(p, 4);
    const gob = await addFoe(p, { name: 'Goblin Warrior', ac: 15, hp: 10, maxHp: 10 });
    const skel = await addFoe(p, { name: 'Skeleton', ac: 14, hp: 13, maxHp: 13, vul: 'Bludgeoning', imm: 'Poison' });
    const resF = await addFoe(p, { name: 'Stone Guard', ac: 12, hp: 40, maxHp: 40, res: 'Slashing' });
    const immF = await addFoe(p, { name: 'Iron Golem Toy', ac: 12, hp: 40, maxHp: 40, imm: 'Slashing' });
    // Brann: longsword +5 (STR 3, PB 2), dmg 1d8+3
    await openAttack(p, 0, 0); await fillAttack(p, { target: 'cb:' + gob, a: 12 });
    ok(/HIT/.test(await txt(p, '#af-hit')) && /= 17/.test(await txt(p, '#af-hit')), 'd20 12 + 5 = 17 vs AC 15 → HIT');
    ok(await ev(p, () => document.querySelector('#af-ac').value === '15'), 'Target AC autofilled from combatant (15)');
    await typeIn(p, '#af-d20a', 9); ok(/MISS/.test(await txt(p, '#af-hit')), '9 + 5 = 14 vs AC 15 → MISS');
    await typeIn(p, '#af-d20a', 10); ok(/HIT/.test(await txt(p, '#af-hit')), 'Meeting AC exactly (15) hits');
    await typeIn(p, '#af-ac', 2); await typeIn(p, '#af-d20a', 1); ok(/MISS/.test(await txt(p, '#af-hit')) && /Natural 1/.test(await txt(p, '#af-hit')), 'Natural 1 misses even vs AC 2');
    await typeIn(p, '#af-ac', 99); await typeIn(p, '#af-d20a', 20); ok(/CRITICAL/.test(await txt(p, '#af-hit')), 'Natural 20 crits even vs AC 99');
    ok(/2d8/.test(await txt(p, '#af-dice')), 'Critical Hit doubles the damage dice (1d8 → 2d8)');
    await typeIn(p, '#af-dmg', 9); ok(/9 \+3 = 12/.test(await txt(p, '#af-dmgcalc')), 'Crit damage adds the modifier once (9 + 3 = 12)');
    await closeModals(p);
    await openAttack(p, 0, 0); await fillAttack(p, { target: 'cb:' + gob, adv: true, dis: true });
    ok(await ev(p, () => document.querySelector('#af-d20b-w').hidden) && /cancel/.test(await txt(p, '#af-mode')), 'Advantage + Disadvantage cancel → one d20');
    await p.click('#af-dis'); await sleep(60); await fillAttack(p, { a: 3, b: 15 }); ok(/d20 15/.test(await txt(p, '#af-hit')) && /HIT/.test(await txt(p, '#af-hit')), 'Advantage keeps the higher d20 (3, 15 → 15)');
    await p.click('#af-adv'); await p.click('#af-dis'); await sleep(60); ok(/d20 3/.test(await txt(p, '#af-hit')) && /MISS/.test(await txt(p, '#af-hit')), 'Disadvantage keeps the lower d20 (3, 15 → 3)');
    await closeModals(p);

    group('Damage: resistance, vulnerability, immunity, preview, apply, duplicates');
    await openAttack(p, 0, 0); await fillAttack(p, { target: 'cb:' + resF, a: 15, dmg: 7 });
    ok(await ev(p, () => document.querySelector('input[name=af-def][value=res]').checked), 'Resistance auto-selected from stat block');
    ok(/40<\/b> → <b[^>]*>35/.test(await p.$eval('#af-preview', e => e.innerHTML)) || /40 → 35/.test(await txt(p, '#af-preview')), 'Resistance halves rounded down: (7+3)=10 → 5; preview 40 → 35');
    ok((await foe(p, resF)).hp === 40, 'Preview does not change HP before confirmation');
    await closeModals(p);
    // Sister Mira mace (bludgeoning) vs Skeleton (vulnerable)
    await openAttack(p, 3, 0); await fillAttack(p, { target: 'cb:' + skel, a: 15, dmg: 4 });
    ok(await ev(p, () => document.querySelector('input[name=af-def][value=vul]').checked) && /13 → 3|→ 3/.test(await txt(p, '#af-preview')), 'Vulnerability doubles: (4+1)=5 → 10; Skeleton 13 → 3');
    await closeModals(p);
    await openAttack(p, 0, 0); await fillAttack(p, { target: 'cb:' + immF, a: 15, dmg: 7 });
    ok(await ev(p, () => document.querySelector('input[name=af-def][value=imm]').checked) && /40 → 40|−0/.test(await txt(p, '#af-preview')), 'Immunity prevents damage (40 → 40)');
    await closeModals(p);
    await openAttack(p, 0, 0); await fillAttack(p, { target: 'cb:' + gob, a: 15, dmg: 4 });
    ok(/10 → 3/.test(await txt(p, '#af-preview')), 'Preview: Goblin 10 → 3 (4 + 3 = 7)');
    await ev(p, () => document.querySelector('.afs[data-s="5"]').scrollIntoView({ block: 'start' })); await shot(p, 'shot-attack.png');
    await clickSel(p, '#af-apply');
    let g = await foe(p, gob); ok(g.hp === 3, 'Damage applied only after clicking Apply (HP 3)');
    let logs = await ev(p, () => window.DMAtlas.Store.fresh().log); ok(logs.length === 1 && /Goblin Warrior/.test(logs[0].text) && /HP 10 → 3/.test(logs[0].text), 'Attack recorded in the encounter log');
    ok(await ev(p, () => document.querySelector('#af-apply').disabled), 'Apply button disabled after applying');
    await ev(p, () => { const m = modalStack.find(x => x.af); window.DMAtlas.AttackFlow.apply(m, Object.assign({}, m.af, { applied: false })); });
    await sleep(150); g = await foe(p, gob); logs = await ev(p, () => window.DMAtlas.Store.fresh().log);
    ok(g.hp === 3 && logs.length === 1, 'Re-applying the same attack is blocked (no double damage)');
    ok(/10 → 3/.test(await txt(p, '#af-preview')) && /applied/.test(await txt(p, '#af-preview')), 'After applying, the preview shows the applied result (10 → 3), not a new one');
    await closeModals(p);
    // miss log
    await openAttack(p, 0, 0); await fillAttack(p, { target: 'cb:' + gob, a: 2 }); await clickSel(p, '#af-logmiss');
    logs = await ev(p, () => window.DMAtlas.Store.fresh().log); ok(/miss/.test(logs[0].text), 'A miss can be recorded in the log'); await closeModals(p);

    group('Concentration prompt and 0 HP reminder');
    // Brann attacks Theo (concentrating, HP 16)
    await openAttack(p, 0, 0); await fillAttack(p, { target: 'pc:' + (await pc(p, 2)).id, a: 15, dmg: 4 });
    ok(/Constitution save, DC 10/.test(await txt(p, '#af-preview')), 'Preview warns of the Concentration save (7 damage → DC 10)');
    await clickSel(p, '#af-apply'); let after = await txt(p, '#af-after'); ok(/Concentration check/.test(after) && /DC 10/.test(after), 'After damage: Concentration save prompt, DC 10');
    await closeModals(p);
    ok(await ev(p, () => { const R = window.DMAtlas.Rules; return R.concentrationDC(7) === 10 && R.concentrationDC(22) === 11 && R.concentrationDC(45) === 22 && R.concentrationDC(100) === 30; }), 'Concentration DC = max(10, half damage), capped at 30 (7→10, 22→11, 45→22, 100→30)');
    await openAttack(p, 0, 0); await fillAttack(p, { target: 'cb:' + gob, a: 15, dmg: 8 }); await clickSel(p, '#af-apply');
    after = await txt(p, '#af-after'); g = await foe(p, gob);
    ok(/0 HP/.test(after) && g.hp === 0, '0 HP reminder shown for the monster');
    ok(await ev(p, id => { const s = window.DMAtlas.Store.fresh(); const c = s.combat.combatants.find(x => x.id === id); return !!c && !(c.conditions || []).length; }, gob), 'Monster at 0 HP is not removed or marked dead automatically');
    await closeModals(p);
    // PC to 0 HP
    const lyra = await pc(p, 1); await ev(p, id => window.DMAtlas.Store.mutate(s => { s.party.find(x => x.id === id).hp = 5; }), lyra.id);
    await openAttack(p, 0, 0); await fillAttack(p, { target: 'pc:' + lyra.id, a: 15, dmg: 8 }); await clickSel(p, '#af-apply');
    after = await txt(p, '#af-after'); const lyra2 = await pc(p, 1);
    ok(/Death Saving Throws/.test(after) && lyra2.hp === 0 && !(lyra2.conditions || []).includes('Dead'), 'PC at 0 HP: death-save reminder, never auto-killed');
    await closeModals(p);

    group('Initiative tracker and linked party/combat HP');
    await H.go(p, 'combat/tracker'); await clickSel(p, '[data-party]'); await H.go(p, 'combat/tracker');
    const linked = await ev(p, () => window.DMAtlas.Store.fresh().combat.combatants.filter(c => c.pcId).length); ok(linked === 4, 'Party added to tracker as linked combatants (4)');
    await ev(p, () => window.DMAtlas.Store.mutate(s => { s.combat.combatants.forEach((c, i) => c.init = 20 - i * 2); s.combat.combatants[0].init = 3; }));
    await clickSel(p, '[data-sort]'); const order = await ev(p, () => window.DMAtlas.Store.fresh().combat.combatants.map(c => Number(c.init)));
    ok(order.every((v, i) => i === 0 || order[i - 1] >= v), 'Sort by Initiative orders highest first');
    await clickSel(p, '[data-start]'); await clickSel(p, '[data-next]'); let cb = await ev(p, () => window.DMAtlas.Store.fresh().combat); ok(cb.active && cb.turn === 1 && cb.round === 1, 'Start combat + Next turn advances the turn');
    for (let i = 0; i < cb.combatants.length - 1; i++) { await clickSel(p, '[data-next]'); } cb = await ev(p, () => window.DMAtlas.Store.fresh().combat); ok(cb.round === 2 && cb.turn === 0, 'Wrapping past the last combatant starts round 2');
    await clickSel(p, '[data-prev]'); cb = await ev(p, () => window.DMAtlas.Store.fresh().combat); ok(cb.round === 1 && cb.turn === cb.combatants.length - 1, 'Previous turn goes back');
    // Linked HP: damage Brann via the tracker row
    const brann = await pc(p, 0); const rowSel = await ev(p, id => { const c = window.DMAtlas.Store.fresh().combat.combatants.find(x => x.pcId === id); return `tr[data-id="${c.id}"] [data-hp]`; }, brann.id);
    await clickSel(p, rowSel); await typeIn(p, '#hpamt', 6); await clickSel(p, '.modal [data-k="dmg"]'); await closeModals(p);
    ok((await pc(p, 0)).hp === 25, 'Damage in the tracker updates the linked party card (31 → 25)');
    await H.go(p, 'combat/party'); ok(/25/.test(await txt(p, '.pcard:nth-child(1) .hpbox')), 'Party card shows the tracker change');
    await clickSel(p, '.pcard:nth-child(1) [data-hp]'); await typeIn(p, '#hpamt', 4); await clickSel(p, '.modal [data-k="heal"]'); await closeModals(p);
    await H.go(p, 'combat/tracker'); ok(await ev(p, s => document.querySelector(s).innerText.startsWith('29'), rowSel), 'Healing on the party card shows in the tracker (29)');
    await shot(p, 'shot-combat.png');

    group('Two windows: BroadcastChannel sync and stale-HP re-review (http)');
    const p2 = await H.page(browser); await H.go(p2, 'combat/party');
    await ev(p, () => window.DMAtlas.Store.mutate(s => { s.party.push(normalizePC({ name: 'Synced Sally', hp: 9, maxHp: 9 })); }));
    await p2.bringToFront(); await sleep(500); ok(/Synced Sally/.test(await txt(p2, '#view')), 'New character appears in the second window without reload');
    ok(await ev(p2, () => window.DMAtlas.Sync.counts && window.DMAtlas.Sync.counts.bc > 0), 'Second window received the change over BroadcastChannel');
    await p.bringToFront(); const g2 = await addFoe(p, { name: 'Bandit', ac: 12, hp: 11, maxHp: 11 });
    await openAttack(p, 0, 0); await fillAttack(p, { target: 'cb:' + g2, a: 15, dmg: 2 }); ok(/11 → 6/.test(await txt(p, '#af-preview')), 'Window A previews Bandit 11 → 6');
    await ev(p2, id => window.DMAtlas.Store.mutate(s => { s.combat.combatants.find(c => c.id === id).hp = 8; }), g2); await p.bringToFront(); await sleep(500);
    ok(await ev(p, () => !document.querySelector('#af-stale').hidden) && /HP changed in another window/.test(await txt(p, '#af-stale')), 'Window A warns that HP changed in window B');
    ok(/8 → 3/.test(await txt(p, '#af-preview')), 'Preview recalculated from the new HP (8 → 3)');
    await p.click('#af-apply'); await sleep(200);
    let b2 = await foe(p, g2); ok(b2.hp === 8, 'First Apply after a remote change does not apply — fresh review required');
    await p.click('#af-apply'); await sleep(200); b2 = await foe(p, g2); ok(b2.hp === 3, 'Second Apply (after review) applies to the new HP (8 → 3)');
    await p2.bringToFront(); await sleep(400); await H.go(p2, 'combat/tracker'); ok(await ev(p2, id => document.querySelector(`tr[data-id="${id}"] [data-hp]`).innerText.startsWith('3'), g2), 'Window B shows the applied damage');
    await p.bringToFront(); await closeModals(p);
    // edit in popup while HP changed elsewhere: edit modal must not overwrite HP
    await H.go(p, 'combat/party'); await clickSel(p, '.pcard:nth-child(3) [data-edit]');
    const theoId = (await pc(p, 2)).id; await ev(p2, id => window.DMAtlas.Store.mutate(s => { s.party.find(x => x.id === id).hp = 2; }), theoId); await p.bringToFront(); await sleep(300);
    await typeIn(p, '.modal [data-f="notes"]', 'Owes the guild 10 gp'); await clickSel(p, '.modal [data-save]');
    const theo = await pc(p, 2); ok(theo.hp === 2 && theo.notes === 'Owes the guild 10 gp', 'Saving the edit modal keeps HP changed meanwhile in another window');
    await p2.close();

    group('Pop-out windows');
    await H.go(p, 'rules/weapons');
    const popT = browser.waitForTarget(t => t.opener() === p.target(), { timeout: 5000 });
    await clickSel(p, '#btnPop'); const pt = await popT; const pp = await pt.page(); await sleep(600);
    ok(/#\/rules\/weapons\?popout=1/.test(pp.url()), 'Pop Out opens the same route in a new window: ' + pp.url().split('#')[1]);
    ok(await ev(pp, () => document.body.classList.contains('popout') && /38 weapons/.test(document.querySelector('#view').innerText)), 'Pop-out window renders compact chrome and the view');
    await pp.close(); await p.bringToFront();
    for (const r of ['rules/spells', 'combat/tracker', 'combat/party', 'guide/lessons', 'rules/rulings', 'tools/events', 'tools/npcs', 'tools/dice', 'tools/notes', 'screen']) {
      const q = await H.page(browser, H.BASE + '#/' + r + '?popout=1'); const t = await txt(q, '#view'); ok(t.length > 40 && q._errors.length === 0, 'Pop-out route #/' + r + ' works'); await q.close(); await p.bringToFront();
    }
    await clickSel(p, '#btnMon'); ok(/file:\/\//.test(await txt(p, '.modal')) && /not guaranteed/.test(await txt(p, '.modal')), 'Monitor Setup explains the file:// sync limitation'); await closeModals(p);
    await ev(p, () => { window._open = window.open; window.open = () => null; }); await clickSel(p, '#btnPop');
    ok(/blocked/.test(await txt(p, '.modal')), 'Blocked pop-up shows help'); await closeModals(p); await ev(p, () => { window.open = window._open; });

    group('Campaign save: export, import, validation');
    const dl = '/tmp/dma-dl'; fs.rmSync(dl, { recursive: true, force: true }); fs.mkdirSync(dl, { recursive: true });
    const cdp = await p.target().createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
    await ev(p, () => window.DMAtlas.Store.mutate(s => { s.party[0].customFromOtherTool = { foo: 1 }; s.location = 'The Inkwell'; s.recap = 'They found the paint handprint.'; s.futureField = 'keep me'; }));
    await clickSel(p, '#btnSave'); await clickSel(p, '#saveMenu [data-act="export"]'); await sleep(1200);
    const files = fs.readdirSync(dl).filter(f => f.endsWith('.json')); ok(files.length === 1, 'Export Campaign Save downloads a file: ' + files[0]);
    const saveText = fs.readFileSync(path.join(dl, files[0]), 'utf8'); const save = JSON.parse(saveText);
    ok(save.app === 'DM Atlas' && save.format === 'dm-atlas-campaign-save' && save.version === 1, 'Save has {"app":"DM Atlas","format":"dm-atlas-campaign-save","version":1}');
    ok(save.state.party.length === 5 && save.state.party[0].weapons.length >= 2 && save.state.combat.combatants.length > 0 && save.state.log.length > 0 && save.state.recap && save.state.location, 'Save includes party, weapons, combat, log, location and recap');
    // change data, then import
    await ev(p, () => window.DMAtlas.Store.mutate(s => { s.party = [normalizePC({ name: 'Temp' })]; s.location = 'Elsewhere'; }));
    let imp = ev(p, t => window.DMAtlas.SaveUI.importText(t, 'save.json'), saveText); await sleep(300);
    ok(/Replace and load/.test(await txt(p, '.modal')) && /Brann Ironfoot/.test(await txt(p, '.modal')), 'Import shows a summary and asks for confirmation');
    await p.click('.modal [data-ok]'); await imp; await sleep(200);
    let st = await ev(p, () => window.DMAtlas.Store.fresh());
    ok(st.party.length === 5 && st.location === 'The Inkwell', 'Confirmed import restores the saved party and location');
    ok(st.party[0].customFromOtherTool && st.party[0].customFromOtherTool.foo === 1 && st.futureField === 'keep me', 'Unknown extra fields are preserved');
    const before = JSON.stringify(st.party);
    for (const [label, bad] of [['broken JSON', '{"app": "DM Atlas", '], ['wrong format', JSON.stringify({ app: 'Other', format: 'x', version: 1, state: { party: [] } })], ['party not a list', JSON.stringify({ app: 'DM Atlas', format: 'dm-atlas-campaign-save', version: 1, state: { party: 'oops' } })], ['newer version', JSON.stringify(Object.assign({}, save, { version: 99 }))], ['damaged character', JSON.stringify(Object.assign({}, save, { state: Object.assign({}, save.state, { party: [null] }) }))]]) {
      const r = await ev(p, t => window.DMAtlas.SaveUI.importText(t, 'bad.json'), bad); await sleep(100);
      const msg = await txt(p, '.modal'); st = await ev(p, () => window.DMAtlas.Store.fresh());
      ok(r === false && /not loaded|not changed/i.test(msg) && JSON.stringify(st.party) === before, 'Invalid save rejected without changing data: ' + label); await closeModals(p);
    }
    // cancel import keeps data
    imp = ev(p, t => window.DMAtlas.SaveUI.importText(t, 'save.json'), saveText.replace('The Inkwell', 'Somewhere')); await sleep(300); await p.click('.modal [data-cancel]'); await imp;
    ok((await ev(p, () => window.DMAtlas.Store.fresh().location)) === 'The Inkwell', 'Cancelling an import changes nothing');
    await clickSel(p, '#btnSave'); await clickSel(p, '#saveMenu [data-act="endnight"]'); await typeIn(p, '#enrecap', 'Ended at the East Wing door.'); await clickSel(p, '.modal [data-ok]'); await sleep(800);
    ok((await ev(p, () => window.DMAtlas.Store.snapshots().length)) >= 1 && fs.readdirSync(dl).filter(f => f.endsWith('.json')).length >= 1, 'End Night & Save stores a snapshot and downloads a save');
    await clickSel(p, '#btnSave'); await clickSel(p, '#saveMenu [data-act="resume"]'); ok(/Snapshots in this browser/.test(await txt(p, '.modal')) && /End of night/.test(await txt(p, '.modal')), 'Resume lists snapshots'); await closeModals(p);

    group('Layout: party cards fit with no page scroll, text ≥ 14px');
    for (const [w, h] of [[1366, 768], [1920, 1080]]) for (const n of [4, 6]) {
      await p.setViewport({ width: w, height: h }); await H.seedParty(p, n); await H.go(p, 'combat/party'); await sleep(200);
      const m = await ev(p, () => {
        const se = document.scrollingElement; const cards = [...document.querySelectorAll('.pcard')];
        const xs = new Set(cards.map(c => Math.round(c.getBoundingClientRect().left))); const ys = new Set(cards.map(c => Math.round(c.getBoundingClientRect().top)));
        const clipped = cards.filter(c => c.scrollHeight > c.clientHeight + 1).length;
        const bottom = Math.max(...cards.map(c => c.getBoundingClientRect().bottom));
        let minFont = 99, minEl = '';
        document.querySelectorAll('#view *, #hdr *, #nav *').forEach(e => { if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const r = e.getBoundingClientRect(); if (!r.width || !r.height) return; const f = parseFloat(getComputedStyle(e).fontSize); if (f < minFont) { minFont = f; minEl = e.className || e.tagName; } });
        return { pageScroll: se.scrollHeight > window.innerHeight || se.scrollWidth > window.innerWidth, cols: xs.size, rows: ys.size, clipped, fits: bottom <= window.innerHeight, minFont, minEl };
      });
      const exp = n === 4 ? [2, 2] : [3, 2];
      ok(!m.pageScroll && m.fits && m.cols === exp[0] && m.rows === exp[1] && m.clipped === 0, `${n} characters at ${w}×${h}: ${m.cols}×${m.rows} grid, no page scroll, no clipped cards`);
      ok(m.minFont >= 14, `${n} characters at ${w}×${h}: smallest text ${m.minFont}px (${m.minEl})`);
      if (w === 1366 && n === 4) await shot(p, 'shot-party4.png');
      if (w === 1366 && n === 6) await shot(p, 'shot-party6.png');
    }
    await p.setViewport({ width: 1366, height: 768 }); await H.seedParty(p, 4);
    await H.go(p, 'screen');
    const mainFit = await ev(p, () => document.scrollingElement.scrollHeight <= innerHeight); ok(mainFit, 'DM Screen fits 1366×768 without page scroll');
    await p.setViewport({ width: 390, height: 844, isMobile: true }); await H.go(p, 'combat/party'); await sleep(200);
    ok(await ev(p, () => getComputedStyle(document.querySelector('#btnMenu')).display !== 'none' && document.querySelector('.party-grid') && getComputedStyle(document.querySelector('.party-grid')).gridTemplateColumns.split(' ').length === 1), 'Mobile layout: menu button and single-column panels');
    await p.setViewport({ width: 1366, height: 768 });

    group('Campaign library: import JSON, HTML, Markdown; switching');
    await ev(p, () => window.DMAtlas.switchCampaign('hollowmere-year-one', true)); await H.seedParty(p, 4);
    const hollowParty = await ev(p, () => window.DMAtlas.Store.fresh().party.length);
    await H.go(p, 'campaigns'); ok(/Hollowmere/.test(await txt(p, '.campgrid')) && /Running now/.test(await txt(p, '.campcard.active')), 'Picker lists the bundled Hollowmere campaign as active');
    const tpl = await ev(p, () => JSON.stringify(window.DMAtlas.CAMPAIGN_TEMPLATE));
    let cj = ev(p, t => window.DMAtlas.importCampaignJSON(t, 'template.json').then(d => d && d.id), tpl); await sleep(300); await p.click('.modal [data-ok]'); const tid = await cj; await sleep(300);
    ok(tid && /My Campaign/.test(await txt(p, '#hdr')), 'Template JSON imports and becomes the active campaign (header updated)');
    ok((await ev(p, () => window.DMAtlas.Store.fresh().party.length)) === 0, 'New campaign starts with its own empty party (saves are per campaign)');
    await H.go(p, 'guide/campaign'); await ev(p, () => location.hash = '#/guide/campaign?tab=sessions'); await sleep(200); ok(/The First Night/.test(await txt(p, '#view')), 'Imported campaign sessions show in Guide the Game');
    const badC = await ev(p, () => window.DMAtlas.importCampaignJSON('{"format":"nope"}', 'bad.json')); ok(badC === null && /Not imported/.test(await txt(p, '.modal')), 'Invalid campaign JSON rejected'); await closeModals(p);
    // HTML import of both Hollowmere files
    const readF = f => fs.readFileSync(path.join(__dirname, '..', 'campaigns', 'hollowmere-year-one', f), 'utf8');
    await ev(p, async (a, b) => { const fa = new File([a], 'Hollowmere_DM_Guide.html', { type: 'text/html' }); const fb = new File([b], 'Hollowmere_Student_Handbook.html', { type: 'text/html' }); await window.DMAtlas.importDocs([fa, fb]); }, readF('Hollowmere_DM_Guide.html'), readF('Hollowmere_Student_Handbook.html'));
    await sleep(300); const prev = await txt(p, '.modal');
    ok(/Session 1/.test(prev) && /DM guide/.test(prev) && await ev(p, () => document.querySelector('.modal [data-aud="1"]').value === 'player'), 'HTML import preview: sections listed, handbook detected as player-facing');
    await typeIn(p, '#imtitle', 'Hollowmere (imported from HTML)'); await clickSel(p, '.modal [data-ok]'); await sleep(400);
    const hc = await ev(p, () => { const c = window.DMAtlas.Store.campaign(); return { title: c.title, sessions: c.sessions.length, npcs: c.npcs.length, locations: c.locations.length, items: c.items.length, secrets: c.secrets.length, bestiary: c.bestiary.length, hb: c.handbook && c.handbook.sections.length, json: JSON.stringify(c) }; });
    ok(hc.title === 'Hollowmere (imported from HTML)' && hc.sessions === 5 && hc.npcs === 11 && hc.locations === 8 && hc.hb >= 10, `Imported both HTML files: ${hc.sessions} sessions, ${hc.npcs} NPCs, ${hc.locations} locations, ${hc.items} items, ${hc.secrets} secrets, handbook ${hc.hb} sections`);
    ok(!/<script|\son[a-z]+=|javascript:/i.test(hc.json), 'Imported HTML contains no scripts, event handlers or javascript: links');
    // malicious + markdown
    await ev(p, async (a, b) => { await window.DMAtlas.importDocs([new File([a], 'evil_adventure.html'), new File([b], 'sample_campaign.md')]); }, fs.readFileSync(path.join(__dirname, 'fixtures/evil_adventure.html'), 'utf8'), fs.readFileSync(path.join(__dirname, 'fixtures/sample_campaign.md'), 'utf8'));
    await sleep(300); ok(/stripped/.test(await txt(p, '.modal')), 'Preview reports stripped scripts/event handlers'); await clickSel(p, '.modal [data-ok]'); await sleep(400);
    const ev2 = await ev(p, () => { const c = window.DMAtlas.Store.campaign(); return { json: JSON.stringify(c), sessions: c.sessions.map(s => s.title), npcs: c.npcs.map(n => n.name), pwned: window.__pwned }; });
    ok(!ev2.pwned && !/<script|onerror|onload|onclick|javascript:|<iframe|<svg|<form|<img/i.test(ev2.json), 'Malicious HTML sanitized: no script ran, no handlers/iframes/forms kept');
    ok(ev2.sessions.length === 4 && ev2.npcs.includes('Mother Ysolde') && ev2.npcs.includes('Pim the Pickpocket'), 'HTML + Markdown split by headings into sessions and NPCs: ' + ev2.sessions.join(' / '));
    await ev(p, () => { location.hash = '#/guide/campaign?tab=sessions'; }); await sleep(300); ok(!(await ev(p, () => window.__pwned)), 'Rendering imported content runs no scripts');
    const hjson = fs.readFileSync(path.join(__dirname, '..', 'campaigns', 'hollowmere-year-one.dmatlas.json'), 'utf8');
    cj = ev(p, t => window.DMAtlas.importCampaignJSON(t, 'hollowmere-year-one.dmatlas.json').then(d => d && { id: d.id, s: d.sessions.length, n: d.npcs.length, b: d.bestiary.length, hb: d.handbook.sections.length }), hjson); await sleep(300);
    ok(/\+0 added · ~0 changed · −0 removed/.test(await txt(p, '.modal .diff-total')), 'Re-importing the unchanged bundled file (same id) previews +0 added · ~0 changed · −0 removed');
    await p.click('.modal [data-k="update"]'); const hj = await cj; await sleep(200);
    ok(hj && hj.s === 5 && hj.n === 11 && hj.b === 7 && hj.hb === 10, 'Exported campaigns/hollowmere-year-one.dmatlas.json re-imports as a DM Atlas campaign (5 sessions, 11 NPCs, 7 creatures, 10 handbook sections)');
    // switching (updating in place made Hollowmere active; step away first)
    await ev(p, id => window.DMAtlas.switchCampaign(id), tid); await sleep(200);
    await H.go(p, 'campaigns'); await clickSel(p, '[data-run="hollowmere-year-one"]'); await sleep(200);
    ok(/Hollowmere Year One/.test(await txt(p, '#hdr')) && (await ev(p, () => window.DMAtlas.Store.fresh().party.length)) === hollowParty, 'Switching back to Hollowmere restores its own party');
    await shot(p, 'shot-campaigns.png');

    group('Player handbook window never shows DM secrets');
    await H.go(p, 'guide/campaign'); await ev(p, () => location.hash = '#/guide/campaign?tab=handbook'); await sleep(200);
    const hbT = browser.waitForTarget(t => t.opener() === p.target(), { timeout: 5000 }); await clickSel(p, '[data-player]'); const hbp = await (await hbT).page(); await hbp.bringToFront(); await sleep(700);
    let allText = ''; const nsec = await ev(hbp, () => document.querySelectorAll('.hb-nav button').length);
    for (let i = 0; i < nsec; i++) { await ev(hbp, i => document.querySelectorAll('.hb-nav button')[i].click(), i); await sleep(120); allText += await txt(hbp, 'body'); }
    ok(nsec >= 10 && /Hollowmere Student Handbook/.test(allText), 'Player handbook window shows ' + nsec + ' player sections');
    const leaks = ['Cordelia', 'Edwin Ashby', 'painted him', 'Mordecai', 'DM only', 'Secrets', 'Bestiary'].filter(s => allText.includes(s));
    ok(leaks.length === 0, 'No DM secrets, sessions or bestiary in the player window' + (leaks.length ? ' (leaked: ' + leaks + ')' : ''));
    ok(await ev(hbp, () => !document.querySelector('#nav .ptab') && !document.querySelector('#gsearch')), 'Player window has no DM navigation or search');
    await ev(hbp, () => document.querySelectorAll('.hb-nav button')[2].click()); await sleep(150); await hbp.setViewport({ width: 1366, height: 768 }); await sleep(150);
    await hbp.screenshot({ path: path.join(SHOTS, 'shot-handbook.png') }); await hbp.close();
    ok(p._errors.length === 0, 'No JavaScript errors during the http test run' + (p._errors.length ? ': ' + p._errors.slice(0, 3).join(' | ') : ''));

    await require('./vesperine_group')({ H, browser, ok, group, ev, txt, clickSel, shot, sleep, fs, path, openAttack, fillAttack, closeModals });

    group('file:// (opened straight from disk)');
    const f1 = await H.page(browser, H.FILE); await ev(f1, () => localStorage.clear()); await f1.reload({ waitUntil: 'load' }); await sleep(300);
    for (const r of ['screen', 'rules/spells', 'combat/party', 'tools/save', 'campaigns']) { await H.go(f1, r); ok((await txt(f1, '#view')).length > 40, 'file:// route #/' + r + ' renders'); }
    await H.seedParty(f1, 4); await H.go(f1, 'combat/party'); ok(await ev(f1, () => document.querySelectorAll('.pcard').length === 4), 'file:// party dashboard works with local storage');
    await openAttack(f1, 0, 0); await fillAttack(f1, { target: 'pc:' + (await pc(f1, 1)).id, a: 20, dmg: 5 }); ok(/CRITICAL/.test(await txt(f1, '#af-hit')), 'file:// attack flow works'); await closeModals(f1);
    const f2 = await H.page(browser, H.FILE + '#/combat/party'); await f1.bringToFront(); await ev(f1, () => window.DMAtlas.Store.mutate(s => { s.party.push(normalizePC({ name: 'File Sync Fred' })); })); await sleep(600);
    await f2.bringToFront(); await sleep(300); const fsync = /File Sync Fred/.test(await txt(f2, '#view'));
    console.log('  ℹ file:// cross-window sync in this headless Chrome: ' + (fsync ? 'worked' : 'did not work') + ' (not promised; documented in Monitor Setup)');
    results.push({ group: cur, ok: true, info: true, msg: 'file:// cross-window sync observed: ' + (fsync ? 'worked here (not guaranteed)' : 'did not work here (expected; documented)') });
    ok(f1._errors.length === 0 && f2._errors.length === 0, 'No JavaScript errors on file://' + (f1._errors.concat(f2._errors).length ? ': ' + f1._errors.concat(f2._errors).join(' | ') : ''));
    await f1.close(); await f2.close();
  } catch (e) { ok(false, 'Test run crashed: ' + e.stack); }
  await browser.close();
  const pass = results.filter(r => r.ok).length, fail = results.filter(r => !r.ok);
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ when: new Date().toISOString(), pass, fail: fail.length, results }, null, 2));
  console.log(`\n${pass} passed, ${fail.length} failed`); fail.forEach(f => console.log('FAIL [' + f.group + '] ' + f.msg));
  process.exit(fail.length ? 1 : 0);
})();
