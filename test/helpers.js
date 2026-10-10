const puppeteer = require('puppeteer-core');
const BASE = process.env.DMA_BASE || 'http://127.0.0.1:8765/DM_Atlas_5_5e.html';
const FILE = 'file:///workspace/dm-atlas/DM_Atlas_5_5e.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function launch() { return puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 60000, args: ['--no-sandbox', '--allow-file-access-from-files'] }); }
async function page(browser, url = BASE, vp = { width: 1366, height: 768 }) {
  const p = await browser.newPage(); await p.setViewport(vp);
  p._errors = []; p.on('pageerror', e => p._errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') p._errors.push('console: ' + m.text()); });
  p.on('dialog', d => d.dismiss());
  await p.goto(url, { waitUntil: 'load' }); await sleep(200); return p;
}
const PCS = [
  { name: 'Brann Ironfoot', player: 'Alex', cls: 'Fighter', species: 'Dwarf', level: 3, ac: 18, hp: 31, maxHp: 31, pp: 13, initBonus: 1, str: 3, dex: 1, profSimple: true, profMartial: true, weapons: ['longsword', 'handaxe', 'light-crossbow'] },
  { name: 'Lyra Swiftwind', player: 'Sam', cls: 'Rogue', species: 'Elf', level: 3, ac: 15, hp: 21, maxHp: 21, pp: 15, initBonus: 4, str: 0, dex: 4, profSimple: true, profMartial: false, profWeapons: ['Rapier', 'Shortsword'], weapons: ['rapier', 'shortbow', 'dagger'] },
  { name: 'Theo Ambervale', player: 'Jordan', cls: 'Wizard', species: 'Human', level: 3, ac: 12, hp: 16, maxHp: 16, pp: 11, initBonus: 2, str: -1, dex: 2, saveDc: 13, spellAtk: 5, profSimple: true, weapons: ['quarterstaff', 'dagger'], concentrating: true, concentrationSpell: 'Web' },
  { name: 'Sister Mira', player: 'Casey', cls: 'Cleric', species: 'Halfling', level: 3, ac: 16, hp: 24, maxHp: 24, pp: 14, initBonus: 0, str: 1, dex: 0, saveDc: 13, spellAtk: 5, profSimple: true, weapons: ['mace', 'light-crossbow'], conditions: ['Poisoned'] },
  { name: 'Kael Duskmantle', player: 'Riley', cls: 'Ranger', species: 'Half-Orc', level: 3, ac: 15, hp: 28, maxHp: 28, pp: 15, initBonus: 3, str: 1, dex: 3, profSimple: true, profMartial: true, weapons: ['longbow', 'shortsword', 'scimitar'] },
  { name: 'Wren Thistledown', player: 'Morgan', cls: 'Bard', species: 'Gnome', level: 3, ac: 14, hp: 20, maxHp: 20, pp: 12, initBonus: 2, str: -1, dex: 2, saveDc: 13, spellAtk: 5, profSimple: true, profWeapons: ['Rapier'], weapons: ['rapier', 'dagger'] }
];
async function seedParty(p, n) {
  await p.evaluate((pcs) => {
    const { Store, Rules } = window.DMAtlas;
    Store.mutate(s => { s.party = pcs.map(x => normalizePC(Object.assign({}, x, { weapons: x.weapons.map(w => Rules.weaponFromRef(w)) }))); s.combat = { combatants: [], round: 1, turn: 0, active: false }; s.log = []; s.appliedAttacks = []; });
  }, PCS.slice(0, n));
}
async function go(p, r, _x) { await p.evaluate(r => { if (location.hash === '#/' + r) onRoute(); else location.hash = '#/' + r; }, r); await sleep(250); }
module.exports = { launch, page, seedParty, go, sleep, BASE, FILE, PCS };
