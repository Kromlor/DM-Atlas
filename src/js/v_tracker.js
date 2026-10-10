/* Initiative tracker and encounter log. */
'use strict';
VIEWS['combat/tracker'] = {
  title: 'Initiative Tracker', render(el) {
    const st = Store.state; const cb = st.combat;
    const rows = cb.combatants.map((c, i) => {
      const t = Combat.target(st, Combat.keyFor(c)) || {};
      const cur = cb.active && i === cb.turn;
      const hp = t.hp, mx = t.maxHp;
      const conds = t.conditions || [];
      return `<tr class="${cur ? 'cur' : ''} ${hp === 0 ? 'down' : ''} ${c.pcId ? 'pc' : ''}" data-id="${c.id}">
        <td class="turnm">${cur ? '▶' : ''}</td>
        <td><input class="init" data-k="init" type="number" value="${esc(c.init)}" aria-label="Initiative for ${esc(c.name)}" placeholder="${c.initBonus !== '' && c.initBonus != null ? 'd20' + sign(int0(c.initBonus)) : '—'}"></td>
        <td class="nm"><b>${esc(t.name || c.name)}</b>${c.pcId ? ' <span class="pill" title="Linked to the party card: HP, AC and conditions are shared">🔗 party</span>' : ''}${c.surprised ? ' <span class="pill warn">surprised</span>' : ''}${t.res || t.vul || t.imm ? `<div class="rvi">${t.res ? 'Res: ' + esc(t.res) + ' ' : ''}${t.vul ? 'Vul: ' + esc(t.vul) + ' ' : ''}${t.imm ? 'Imm: ' + esc(t.imm) : ''}</div>` : ''}</td>
        <td>${c.pcId ? `<b>${esc(t.ac || '—')}</b>` : `<input data-k="ac" type="number" value="${esc(c.ac)}" aria-label="AC" class="xs">`}</td>
        <td class="hpc"><div class="row nowrap"><button class="hpbtn ${hpClass(hp, mx)}" data-hp>${hp === null || hp === undefined ? '—' : hp}<small>/${mx === null || mx === undefined ? '—' : mx}</small>${t.tempHp ? `<em>+${t.tempHp}</em>` : ''}</button>${c.pcId ? '' : `<input data-k="maxHp" type="number" value="${esc(c.maxHp)}" aria-label="Max HP" class="xs" title="Max HP">`}</div></td>
        <td class="cc"><div class="chips">${conds.map(x => `<span class="chip cond">${esc(x)} <button data-rmcond="${esc(x)}" aria-label="remove ${esc(x)}">✕</button></span>`).join('')}<select data-addcond aria-label="Add condition"><option value="">＋</option>${Rules.conditions.concat(['Defeated']).filter(x => !conds.includes(x)).map(x => `<option>${x}</option>`).join('')}</select></div></td>
        <td><label class="chk conc-t" title="Concentration"><input type="checkbox" data-conc ${t.concentrating ? 'checked' : ''}> ◉</label></td>
        <td><input data-k="reminders" value="${esc(c.reminders || '')}" placeholder="Reminders…" aria-label="Reminders"></td>
        <td class="acts">${(c.attacks || []).map((a, k) => `<button class="mini" data-matk="${k}" title="Guided attack: ${sign(a.atk)}, ${esc(a.damage)}${a.dmgMod ? sign(a.dmgMod) : ''} ${esc(a.damageType)}">⚔ ${esc(a.name)}</button>`).join('')}${c.pcId ? (() => { const p = st.party.find(x => x.id === c.pcId); return p ? (p.weapons || []).slice(0, 2).map(w => `<button class="mini" data-patk="${w.iid}">⚔ ${esc(w.name)}</button>`).join('') : ''; })() : ''}<button class="mini" data-sur title="Toggle surprised (Disadvantage on Initiative)">😲</button><button class="mini danger" data-rm title="Remove from tracker">✕</button></td></tr>`;
    }).join('');
    el.innerHTML = `<div class="tracker-wrap">${scratchBanner()}
    <div class="toolbar"><h2 class="deco">${cb.active ? 'Round ' + cb.round : 'Initiative'}</h2>
      ${cb.active ? `<button data-prev>◀ Previous</button><button class="primary" data-next>Next turn ▶</button><button data-end>End combat</button>` : `<button class="primary" data-start ${cb.combatants.length ? '' : 'disabled'}>⚔ Start combat</button>`}
      <button data-sort>⇅ Sort by Initiative</button><button data-rollmon title="Rolls d20 + bonus for monsters with no Initiative yet; identical monsters share one roll; surprised ones roll with Disadvantage">🎲 Roll for monsters</button>
      <span class="sep"></span><button data-party>＋ Party</button><button data-add>＋ Combatant</button><button data-srd>＋ SRD monster</button><button data-clear class="danger">Clear</button></div>
    <div class="callout learn-only small">Players roll their own Initiative (d20 + Initiative bonus) and tell you the total. A <b>surprised</b> combatant rolls with Disadvantage. Ties: you order tied monsters, players order tied characters, you decide monster-vs-character ties. Party rows are linked to the party cards — damage in either place updates both.</div>
    <div class="tablewrap" data-keep-scroll="trk"><table class="tracker"><thead><tr><th></th><th>Init</th><th>Name</th><th>AC</th><th>HP</th><th>Conditions</th><th title="Concentration">Conc.</th><th>Reminders</th><th>Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="9" class="empty">No combatants yet. Add the party, a combatant, an SRD monster, or use “Add to Initiative Tracker” from a campaign encounter.</td></tr>`}</tbody></table></div></div>`;
    bindScratch(el);
    const on = (sel, fn) => { const x = $(sel, el); if (x) x.onclick = fn; };
    on('[data-next]', () => Combat.nextTurn(1)); on('[data-prev]', () => Combat.nextTurn(-1));
    on('[data-start]', () => { Combat.sort(); Store.mutate(s => { s.combat.active = true; s.combat.round = 1; s.combat.turn = 0; s.log.unshift({ id: uid('log'), at: Date.now(), round: 1, kind: 'combat', text: 'Combat started: ' + s.combat.combatants.map(c => c.name + (c.init !== '' ? ' (' + c.init + ')' : '')).join(', ') }); }, 'start'); renderView(); });
    on('[data-end]', async () => { if (await confirmBox('End combat?', '<p>The combatants stay in the list (remove them with ✕ or Clear). Round and turn reset.</p>', 'End combat')) { Store.mutate(s => { s.log.unshift({ id: uid('log'), at: Date.now(), round: s.combat.round, kind: 'combat', text: 'Combat ended after ' + s.combat.round + ' round(s).' }); s.combat.active = false; s.combat.round = 1; s.combat.turn = 0; }, 'end'); renderView(); } });
    on('[data-sort]', () => { Combat.sort(); renderView(); });
    on('[data-party]', () => { Combat.addParty(); renderView(); });
    on('[data-add]', addCombatantModal);
    on('[data-srd]', () => { const m = openModal({ title: 'Add an SRD monster', html: `<input type="search" id="srdm" placeholder="Search SRD monsters…" class="wide"><div id="srdml" class="qres tall"></div>` }); const f = () => { const q = $('#srdm', m.body).value.toLowerCase(); $('#srdml', m.body).innerHTML = SRD.monsters.filter(x => x.name.toLowerCase().includes(q)).slice(0, 40).map(x => `<div class="row between"><span><b>${esc(x.name)}</b> <small>AC ${x.ac} · HP ${x.hp} · CR ${esc(crOf(x))}</small></span><span><input type="number" min="1" max="20" value="1" class="xs" aria-label="count"><button data-n="${esc(x.name)}">Add</button></span></div>`).join(''); $$('[data-n]', m.body).forEach(b => b.onclick = () => Combat.addFoes([{ name: b.dataset.n, count: int0(b.previousElementSibling.value) || 1 }])); }; $('#srdm', m.body).oninput = f; f(); });
    on('[data-clear]', async () => { if (await confirmBox('Clear the tracker?', '<p>Removes all combatants (party cards are not affected).</p>', 'Clear', true)) { Store.mutate(s => { s.combat = { combatants: [], round: 1, turn: 0, active: false }; }, 'clear'); renderView(); } });
    on('[data-rollmon]', () => {
      const rolled = [];
      Store.mutate(s => { const groups = {}; s.combat.combatants.forEach(c => { if (c.pcId || (c.init !== '' && c.init !== null)) return; const g = c.group || c.name; if (!(g in groups)) { const r = rollExpr('1d20' + (int0(c.initBonus) >= 0 ? '+' : '') + int0(c.initBonus), c.surprised ? 'dis' : 'normal'); groups[g] = r.total; rolled.push(g + ': ' + r.total + (c.surprised ? ' (Disadvantage)' : '')); } c.init = groups[g]; }); }, 'roll-init');
      toast(rolled.length ? 'Initiative — ' + rolled.join(', ') : 'Every monster already has Initiative', 'info', 5000); renderView();
    });
    $$('tbody tr[data-id]', el).forEach(tr => {
      const id = tr.dataset.id; const c = st.combat.combatants.find(x => x.id === id); const key = Combat.keyFor(c);
      $$('input[data-k]', tr).forEach(i => i.onchange = () => { const k = i.dataset.k; Store.mutate(s => { const x = s.combat.combatants.find(y => y.id === id); if (!x) return false; x[k] = i.value; if (k === 'maxHp' && (x.hp === '' || x.hp === null)) x.hp = i.value; }, 'cb-edit'); if (k !== 'reminders') renderViewSoon(); });
      $('[data-hp]', tr).onclick = () => hpAdjust(key);
      $('[data-addcond]', tr).onchange = e => { const v = e.target.value; if (!v) return; Store.mutate(s => { const t = Combat.target(s, key); Combat.setFields(s, key, { conditions: (t.conditions || []).concat(v) }); }); renderView(); };
      $$('[data-rmcond]', tr).forEach(b => b.onclick = () => { Store.mutate(s => { const t = Combat.target(s, key); Combat.setFields(s, key, { conditions: (t.conditions || []).filter(x => x !== b.dataset.rmcond) }); }); renderView(); });
      $('[data-conc]', tr).onchange = e => { Store.mutate(s => Combat.setFields(s, key, { concentrating: e.target.checked })); renderView(); };
      $('[data-rm]', tr).onclick = () => { Store.mutate(s => { const i = s.combat.combatants.findIndex(x => x.id === id); if (i < 0) return false; s.combat.combatants.splice(i, 1); if (s.combat.turn > i) s.combat.turn--; if (s.combat.turn >= s.combat.combatants.length) s.combat.turn = 0; }, 'cb-rm'); renderView(); };
      $('[data-sur]', tr).onclick = () => { Store.mutate(s => { const x = s.combat.combatants.find(y => y.id === id); x.surprised = !x.surprised; }); renderView(); };
      $$('[data-matk]', tr).forEach(b => b.onclick = () => AttackFlow.open('cb:' + id, b.dataset.matk));
      $$('[data-patk]', tr).forEach(b => b.onclick = () => AttackFlow.open('pc:' + c.pcId, b.dataset.patk));
    });
  }
};
function addCombatantModal() {
  const m = openModal({ title: 'Add a combatant', html: `<div class="edgrid one"><label class="fld"><span>Name</span><input id="cn" placeholder="e.g. Bandit Captain"></label><div class="row"><label class="fld sm"><span>AC</span><input id="cac" type="number"></label><label class="fld sm"><span>Max HP</span><input id="chp" type="number"></label><label class="fld sm"><span>Initiative (rolled)</span><input id="cin" type="number"></label><label class="fld sm"><span>Init bonus</span><input id="cib" type="number"></label><label class="fld sm"><span>How many</span><input id="ccount" type="number" value="1" min="1" max="20"></label></div>
    <div class="row"><label class="fld"><span>Resistances</span><input id="cres" placeholder="e.g. Fire, Cold"></label><label class="fld"><span>Vulnerabilities</span><input id="cvul"></label><label class="fld"><span>Immunities</span><input id="cimm"></label></div>
    <p class="muted small">Tip: SRD monsters and campaign bestiary creatures fill these in automatically — use “＋ SRD monster” or the campaign's encounter buttons.</p></div><div class="btnrow"><button class="primary" data-ok>Add</button></div>` });
  $('[data-ok]', m.body).onclick = () => {
    const name = $('#cn', m.body).value.trim(); if (!name) { $('#cn', m.body).focus(); return; }
    const n = clamp(int0($('#ccount', m.body).value) || 1, 1, 20);
    Store.mutate(s => { for (let i = 0; i < n; i++) s.combat.combatants.push(Combat.newCombatant({ name: n > 1 ? name + ' ' + (i + 1) : name, group: name, ac: $('#cac', m.body).value, hp: $('#chp', m.body).value, maxHp: $('#chp', m.body).value, init: $('#cin', m.body).value, initBonus: $('#cib', m.body).value, res: $('#cres', m.body).value, vul: $('#cvul', m.body).value, imm: $('#cimm', m.body).value })); }, 'cb-add');
    m.close(); renderView();
  };
}
VIEWS['combat/log'] = {
  title: 'Encounter Log', render(el) {
    const st = Store.state;
    el.innerHTML = `<div class="parch pad log-wrap"><div class="row between"><h2 class="deco">Encounter Log <small>${st.log.length} entries</small></h2><div><input type="search" id="lq" placeholder="Filter…"><button data-exp>⬇ Export as text</button><button data-clr class="danger">Clear log</button></div></div>
    <ol class="log scrolly" data-keep-scroll="log">${st.log.map(l => `<li class="lg ${esc(l.kind || '')} ${l.outcome === 'miss' ? 'miss' : ''} ${l.outcome === 'critical hit' ? 'crit' : ''}"><span class="when">${l.round ? 'Round ' + l.round + ' · ' : ''}${new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> ${esc(l.text)}</li>`).join('') || '<li class="muted">Nothing recorded yet. Attacks, damage, healing and Concentration results appear here.</li>'}</ol></div>`;
    $('#lq', el).oninput = e => { const q = e.target.value.toLowerCase(); $$('.lg', el).forEach(li => li.hidden = q && !li.textContent.toLowerCase().includes(q)); };
    $('[data-exp]', el).onclick = () => download('dm-atlas-log-' + dateStamp() + '.txt', st.log.slice().reverse().map(l => `[${fmtTime(l.at)}]${l.round ? ' R' + l.round : ''} ${l.text}`).join('\n'), 'text/plain');
    $('[data-clr]', el).onclick = async () => { if (await confirmBox('Clear the encounter log?', '<p>This cannot be undone (an End Night &amp; Save snapshot keeps a copy).</p>', 'Clear', true)) { Store.mutate(s => { s.log = []; }); renderView(); } };
  }
};
