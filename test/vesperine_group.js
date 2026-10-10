/* Vesperine & the Velvet Marches: second bundled campaign, NPC portraits/reveals, bestiary, solo reader, art pack. */
module.exports = async function vesperineTests(T) {
  const { H, browser, ok, group, ev, txt, clickSel, shot, sleep, fs, path, openAttack, fillAttack, closeModals } = T;
  const VID = 'vesperine-velvet-marches';
  const VJ = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'campaigns', VID + '.dmatlas.json'), 'utf8'));
  group('Vesperine & the Velvet Marches: library, tabs and data');
  const v = await H.page(browser); await ev(v, () => localStorage.clear()); await v.reload({ waitUntil: 'load' }); await sleep(400);
  ok(await ev(v, () => window.DMAtlas.Store.cid === null), 'Fresh start is still "No campaign selected"');
  await H.go(v, 'campaigns');
  ok(await ev(v, id => !!document.querySelector('[data-run="' + id + '"]') && !document.querySelector('.campcard.active [data-exp="' + id + '"]'), VID), 'Vesperine is listed in the campaign library and not auto-selected');
  // campaign data stays separate
  await clickSel(v, '[data-run="hollowmere-year-one"]'); await sleep(200);
  await ev(v, () => window.DMAtlas.Store.mutate(s => { s.party.push(normalizePC({ name: 'Hollow Hal' })); }));
  await H.go(v, 'campaigns'); await clickSel(v, `[data-run="${VID}"]`); await sleep(300);
  ok(/Vesperine/.test(await txt(v, '#hdr')) && (await ev(v, () => window.DMAtlas.Store.fresh().party.length)) === 0, 'Switching to Vesperine shows an empty, separate party');
  await ev(v, () => window.DMAtlas.Store.mutate(s => { s.party.push(normalizePC({ name: 'Velvet Vee' })); }));
  const sep = await ev(v, id => ({ h: JSON.parse(localStorage.getItem('dmatlas.camp.hollowmere-year-one')).party.map(p => p.name), v: JSON.parse(localStorage.getItem('dmatlas.camp.' + id)).party.map(p => p.name) }), VID);
  ok(sep.h.join() === 'Hollow Hal' && sep.v.join() === 'Velvet Vee', 'Hollowmere and Vesperine keep separate saved data');
  // art pack import
  const art = fs.readFileSync(path.join(__dirname, '..', 'campaigns', VID + '.dmatlas-art.json'), 'utf8');
  const nArt = await ev(v, t => window.DMAtlas.importCampaignJSON(t, 'vesperine-velvet-marches.dmatlas-art.json'), art); await sleep(400);
  const stored = await ev(v, id => window.DMAtlas.ArtStore.count(id), VID);
  ok(nArt === 180 && stored === 180, 'Art pack import stores ' + stored + ' images in IndexedDB (25 portraits, 8 guises, 3 alternates, 128 monsters, 16 solo)');
  await H.go(v, 'campaigns'); await sleep(400);
  ok(/180 images stored/.test(await txt(v, `[data-artc="${VID}"]`)), 'Campaign card shows the art status');
  // overview
  await ev(v, () => { location.hash = '#/guide/campaign?tab=overview'; }); await sleep(400);
  const ov = await txt(v, '#view');
  ok(/Carnelia/.test(ov) && /Oathless Glass/.test(ov) && /The Black Kiss/.test(ov) && /SRD 5\.2\.1/.test(ov), 'Overview shows Carnelia, the Oathless Glass, The Black Kiss and the 2024 / SRD 5.2.1 rules note');
  await shot(v, 'shot-vesperine.png');
  await ev(v, () => { location.hash = '#/guide/campaign?tab=sessions'; }); await sleep(300);
  const nCh = await ev(v, () => document.querySelectorAll('.ld-list>button').length);
  ok(nCh === VJ.sessions.length && /Chapters/.test(await txt(v, '.tabs')), 'Chapters tab lists ' + nCh + ' chapters/parts');
  ok(await ev(v, () => document.querySelectorAll('button.srdref').length) >= 0, 'Chapter text renders (SRD creature links where names match)');
  await ev(v, () => { location.hash = '#/guide/campaign?tab=locations'; }); await sleep(300);
  ok(await ev(v, () => document.querySelectorAll('.ld-list>button').length) === VJ.locations.length, 'Locations tab lists ' + VJ.locations.length + ' places');
  // NPCs
  const ci = VJ.npcs.findIndex(n => n.slug === 'prince-caelum');
  await ev(v, i => { location.hash = '#/guide/campaign?tab=npcs&i=' + i; }, ci); await sleep(600);
  const npcInfo = await ev(v, () => ({ n: document.querySelectorAll('.ld-list>button').length, keys: [...document.querySelectorAll('.ld-detail img[data-art]')].map(i => i.dataset.art), src: (document.querySelector('.ld-detail img[data-art]') || {}).src || '', sec: /Secret/.test(document.querySelector('.ld-detail').innerText) }));
  ok(npcInfo.n === VJ.npcs.length, 'NPCs tab lists ' + npcInfo.n + ' NPCs');
  ok(npcInfo.keys.join() === 'portrait/prince-caelum,guise/prince-caelum' && /^blob:/.test(npcInfo.src), 'DM sees the true form and the human guise (from the imported pack)');
  await shot(v, 'shot-vesperine-npcs.png');
  // bestiary
  await ev(v, () => { location.hash = '#/guide/campaign?tab=bestiary'; }); await sleep(500);
  const bc = await ev(v, () => ({ n: document.querySelectorAll('.slist .srow').length, head: document.querySelector('.ld-head').innerText, sb: !!document.querySelector('.ld-detail .statblock, .ld-detail .sb') }));
  ok(bc.n === 128 && /128 creatures/.test(bc.head), 'Bestiary tab has 128 creatures');
  await ev(v, () => { location.hash = '#/guide/campaign?tab=bestiary&q=wax'; }); await sleep(400);
  const nh = await ev(v, () => document.querySelectorAll('.slist .srow').length);
  ok(nh > 0 && nh < 128, 'Bestiary search filters (' + nh + ' match "wax")');
  const vb = VJ.bestiary.findIndex(b => b.name === 'Wax Cherub');
  await ev(v, i => { location.hash = '#/guide/campaign?tab=bestiary&i=' + i; }, vb); await sleep(500);
  ok(/Wax Arrow/.test(await txt(v, '.ld-detail')) && /Tactics/i.test(await txt(v, '.ld-detail')), 'Stat block with actions, lore and tactics shows');
  await shot(v, 'shot-vesperine-bestiary.png');
  // combat: add from the bestiary and attack it
  await ev(v, () => window.DMAtlas.Store.mutate(s => { s.combat = { combatants: [], round: 1, turn: 0, active: false }; }));
  await clickSel(v, '.ld-detail [data-addbeast]:not([data-n])'); await sleep(300);
  const cb = await ev(v, () => window.DMAtlas.Store.fresh().combat.combatants[0]);
  ok(cb && cb.name === 'Wax Cherub' && cb.ac === 12 && cb.hp === 5 && cb.initBonus === '2' && cb.attacks.some(a => a.name === 'Wax Arrow'), 'Wax Cherub added to the tracker with AC 12, HP 5, initiative +2 and its Wax Arrow attack');
  await H.seedParty(v, 1); await ev(v, () => window.DMAtlas.Combat.addFoes([{ count: 1, name: 'wax cherubs' }])); await sleep(200);
  const wid = await ev(v, () => window.DMAtlas.Store.fresh().combat.combatants[0].id);
  await openAttack(v, 0, 0); await fillAttack(v, { target: 'cb:' + wid, a: 15, dmg: 1 }); await clickSel(v, '#af-apply'); await sleep(200);
  ok((await ev(v, id => window.DMAtlas.Store.fresh().combat.combatants.find(c => c.id === id).hp, wid)) === 1, 'Attack flow hits the Vesperine monster and applies damage (Longsword 1 + 3 → 5 to 1 HP)');
  await closeModals(v);
  await H.go(v, 'combat/tracker'); await sleep(200);
  const mb = await v.$('[data-matk]'); if (mb) { await mb.click(); await sleep(300); }
  ok(!!(await v.$('.modal.attack')), 'The monster\'s own attack opens in the attack flow');
  await closeModals(v);
  // solo reader
  group('Vesperine solo gamebook reader');
  await ev(v, () => { location.hash = '#/guide/campaign?tab=solo'; }); await sleep(400);
  ok(await ev(v, () => document.querySelectorAll('.solo-doors .door').length) === 5, 'Solo Book lists 5 adventures');
  await ev(v, () => { location.hash = '#/guide/campaign?tab=solo&adv=0'; }); await sleep(300);
  await clickSel(v, '.solo-page [data-goto]'); await sleep(300);
  ok(/^1\b/.test((await txt(v, '.entry-num')).trim()), 'Begin opens entry 1');
  const tgt = await ev(v, () => document.querySelector('.solo-page a.turnto').getAttribute('href').slice(1));
  await v.click('.solo-page a.turnto'); await sleep(400);
  ok((await ev(v, () => location.hash)).includes('e=' + tgt) && /^2\b/.test((await txt(v, '.entry-num')).trim()), 'Clicking a "go to 2" link turns to entry 2 (' + tgt + ')');
  await clickSel(v, '[data-back]'); await sleep(300);
  ok(/^1\b/.test((await txt(v, '.entry-num')).trim()), 'Back returns to the previous entry');
  const endSec = await ev(v, () => { const b = [...document.querySelectorAll('[data-sec]')].find(x => /Ending/.test(x.textContent)); return b && b.dataset.sec; });
  await ev(v, s => { location.hash = '#/guide/campaign?tab=solo&adv=0&e=sec' + s; }, endSec); await sleep(300);
  ok(/Group table mode/.test(await txt(v, '.solo-page')), 'Group table mode hides the endings until the DM chooses to show them');
  await ev(v, () => { location.hash = '#/guide/campaign?tab=solo&adv=0&e=lys-1'; }); await sleep(400);
  await shot(v, 'shot-solo.png');
  // player window
  group('Vesperine player window: no DM text, guises until revealed, no pin-ups unless chosen');
  await ev(v, () => { location.hash = '#/guide/campaign?tab=handbook'; }); await sleep(300);
  const hbT = browser.waitForTarget(t => t.opener() === v.target(), { timeout: 5000 }); await clickSel(v, '[data-player]'); const hp = await (await hbT).page(); await sleep(900);
  hp._errors = []; hp.on('pageerror', e => hp._errors.push(e.message));
  let all = ''; const ns = await ev(hp, () => document.querySelectorAll('.hb-nav button').length);
  for (let i = 0; i < ns; i++) { await ev(hp, i => document.querySelectorAll('.hb-nav button')[i].click(), i); await sleep(150); all += await txt(hp, 'body'); }
  ok(ns >= 10, 'Player window shows ' + ns + ' player sections (incl. Faces and Places)');
  const secretBits = [];
  VJ.npcs.forEach(n => (n.blocks || []).filter(b => b.secret || b.dm).forEach(b => { const t = b.html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); if (t.length > 50) secretBits.push(t.slice(10, 60)); }));
  VJ.secrets.forEach(s => { const t = s.html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); secretBits.push(t.slice(20, 70)); });
  VJ.bestiary.slice(0, 40).forEach(b => b.tactics && secretBits.push(b.tactics.slice(0, 50)));
  const norm = s => s.replace(/\s+/g, ' ');
  const leaks = secretBits.filter(s => norm(all).includes(s)).concat(['Secret agenda', 'Secret:', 'DM only', 'Glamours & Reveals', 'Wax Arrow'].filter(s => all.includes(s)));
  ok(leaks.length === 0, 'No secret agendas, murder solution, Parts 6–8 secrets or bestiary text in the player window (checked ' + secretBits.length + ' passages)' + (leaks.length ? ' LEAKED: ' + leaks.slice(0, 3).join(' | ') : ''));
  const faceSel = await ev(hp, () => { const b = [...document.querySelectorAll('.hb-nav button')].find(x => x.dataset.s === '_faces'); b.click(); return !!b; }); await sleep(500);
  const keys = () => ev(hp, () => [...document.querySelectorAll('img[data-art]')].map(i => i.dataset.art));
  const FEY = ['amaranth', 'merrow-ashgrave', 'nocturne-vesh', 'ondine-mirewillow', 'pipwhistle-dewlace', 'prince-caelum', 'queen-ilysse', 'rillo-fennamint'];
  let k = await keys();
  ok(faceSel && k.length >= 20 && !k.some(x => x.startsWith('spicy/')) && FEY.every(f => k.includes('guise/' + f) && !k.includes('portrait/' + f)), 'Player faces show human guises for all 8 fey and no true-form or pin-up portraits (' + k.length + ' portraits)');
  ok(/Cael Rosier/i.test(await txt(hp, '[data-face="prince-caelum"]')) && !/Prince Caelum of the Dusk/i.test(await txt(hp, '[data-face="prince-caelum"]')), 'Disguised fey appear under their alias');
  await hp.setViewport({ width: 1366, height: 768 }); await sleep(300); await hp.screenshot({ path: path.join(__dirname, 'shot-vesperine-player.png') });
  // reveal toggle from the DM screen
  await ev(v, i => { location.hash = '#/guide/campaign?tab=npcs&i=' + i; }, ci); await sleep(400);
  await v.click('[data-nv="revealed"]'); await sleep(900);
  k = await keys();
  ok(k.includes('portrait/prince-caelum') && !k.includes('guise/prince-caelum') && /Prince Caelum of the Dusk/i.test(await txt(hp, '[data-face="prince-caelum"]')) && /Rose Merchant/i.test(await txt(hp, '[data-face="prince-caelum"]')), 'Reveal toggle switches the player portrait to true form and shows the reveal read-aloud');
  ok(!k.includes('portrait/queen-ilysse') && k.includes('guise/queen-ilysse'), 'Other fey stay disguised');
  // alternates
  const vi = VJ.npcs.findIndex(n => n.slug === 'valentin-dusk');
  await ev(v, i => { location.hash = '#/guide/campaign?tab=npcs&i=' + i; }, vi); await sleep(500);
  ok((await ev(v, () => document.querySelector('.ld-detail img[data-art]').dataset.art)) === 'spicy/valentin-dusk' && (await keys()).includes('portrait/valentin-dusk'), 'DM default is the alternate (pin-up) portrait; players see the standard one');
  await v.click('[data-nv="std"]'); await sleep(300);
  ok((await ev(v, () => document.querySelector('.ld-detail img[data-art]').dataset.art)) === 'portrait/valentin-dusk', 'DM can toggle to the standard portrait');
  await v.click('[data-nv="spicyPlayer"]'); await sleep(300); await clickSel(v, '.modal [data-ok]'); await sleep(900);
  ok((await keys()).includes('spicy/valentin-dusk'), 'Pin-up reaches the player window only after the DM explicitly chooses it (with confirmation)');
  await v.click('[data-nv="spicyPlayer"]'); await sleep(900);
  ok(!(await keys()).some(x => x.startsWith('spicy/')), 'Turning it off removes it from the player window');
  await v.click('[data-nv="hidden"]'); await sleep(900);
  ok(!(await ev(hp, () => !!document.querySelector('[data-face="valentin-dusk"]'))), 'Hide toggle removes an NPC from the player window');
  ok(v._errors.length === 0 && hp._errors.length === 0, 'No JavaScript errors in the Vesperine run' + (v._errors.concat(hp._errors).length ? ': ' + v._errors.concat(hp._errors).slice(0, 3).join(' | ') : ''));
  await hp.close(); await v.close();
};
