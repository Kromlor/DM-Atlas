/* Panel 1: Guide the Game — DM screen home, campaign guide, lessons, course, adventure, roll guide, player handbook. */
'use strict';
function fmtSRD(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
const Progress = {
  get() { return LS.get(K.ui + 'progress', { lessons: {}, course: {} }) || { lessons: {}, course: {} }; },
  set(p) { LS.set(K.ui + 'progress', p); }
};
function lessonById(id) { return (window.DM_LESSONS || []).find(l => l.id === id); }

/* ---------- Home: the four-panel DM screen ---------- */
VIEWS.screen = {
  title: 'DM Screen', render(el) {
    const st = Store.state, camp = Store.campaign();
    const cb = st.combat; const cur = cb.combatants[cb.turn];
    const sess = camp && camp.sessions && camp.sessions[st.currentSession];
    const prog = Progress.get(); const nextL = (window.DM_COURSE || []).findIndex((s, i) => !prog.course[i]);
    const lastRoll = st.dice[0];
    el.innerHTML = `<div class="screen4">
    <section class="panel p1"><header><span class="pn">1</span><h2>Guide the Game</h2><button class="mini" data-pop="guide/campaign" title="Pop out this panel into a new window">↗ Pop out</button></header>
      <div class="pbody"><div class="pinfo">
        ${camp ? `<div class="kv"><span>Campaign</span><b>${esc(camp.title)}</b></div>` : `<div class="nocamp-mini"><b>No campaign selected</b> — pick one from your library or import one. <span class="btnrow"><button class="mini primary" data-nc="pick">Pick a campaign</button><button class="mini" data-nc="import">Import campaign</button><button class="mini" data-nc="blank">Start a blank campaign</button></span></div>`}
        ${sess ? `<div class="kv"><span>Current session</span><b>${esc('Session ' + sess.number + ': ' + sess.title)}</b></div><p class="muted">${esc(sess.summary || '')}</p>` : ''}
        ${st.location ? `<div class="kv"><span>Party location</span><b>${esc(st.location)}</b></div>` : ''}
        <div class="loop learn-only"><b>The core loop:</b> <span>1 Describe</span> → <span>2 Ask “What do you do?”</span> → <span>3 Resolve</span> (roll only if the outcome is uncertain)</div>
        </div><div class="btngrid">
          <button data-go="guide/campaign">🗺 Campaign guide</button>
          <button data-go="guide/lessons">📚 38 Lessons</button>
          <button data-go="guide/course">🎓 Beginner course ${nextL < 0 ? '✓' : '(' + (nextL + 1) + '/12)'}</button>
          <button data-go="guide/adventure">🏮 First adventure</button>
          <button data-go="guide/roll" class="span2">🎯 What Do I Roll?</button>
        </div>
      </div></section>
    <section class="panel p2"><header><span class="pn">2</span><h2>Rules &amp; References</h2><button class="mini" data-pop="rules/spells" title="Pop out this panel into a new window">↗ Pop out</button></header>
      <div class="pbody"><div class="pinfo">
        <input type="search" id="qspell" placeholder="Quick spell / weapon lookup…" aria-label="Quick spell or weapon lookup">
        <div id="qspellres" class="qres"></div>
        <div class="dcladder" title="Typical Difficulty Classes"><span>DC 5<small>Very easy</small></span><span>10<small>Easy</small></span><span>15<small>Medium</small></span><span>20<small>Hard</small></span><span>25<small>Very hard</small></span><span>30<small>Nearly impossible</small></span></div>
        <div class="chips">${Rules.conditions.map(c => `<button class="chip" data-cond="${c}">${c}</button>`).join('')}</div>
        </div><div class="btngrid">
          <button data-go="rules/spells">✨ Spells (${SRD.spells.length})</button><button data-go="rules/weapons">🗡 Weapons (${SRD.weapons.length})</button>
          <button data-go="rules/rulings">⚖ Quick rulings</button><button data-go="rules/glossary">📖 Rules glossary</button>
        </div>
      </div></section>
    <section class="panel p3"><header><span class="pn">3</span><h2>Run Combat</h2><button class="mini" data-pop="combat/tracker" title="Pop out this panel into a new window">↗ Pop out</button></header>
      <div class="pbody"><div class="pinfo">
        <div class="kv"><span>${cb.active ? 'Round ' + cb.round : 'No fight running'}</span><b>${cur && cb.active ? '▶ ' + esc(cur.name) + "'s turn" : (cb.combatants.length ? cb.combatants.length + ' combatants ready' : 'Add combatants in the tracker')}</b></div>
        <div class="minihp">${st.party.length ? st.party.map(p => { const hp = num(p.hp), mx = num(p.maxHp); const pct = hp !== null && mx ? clamp(hp / mx * 100, 0, 100) : 0; return `<div class="mh"><span class="nm">${esc(p.name)}</span><span class="bar"><i style="width:${pct}%" class="${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}"></i></span><span class="v">${hp === null ? '—' : hp}/${mx === null ? '—' : mx}</span><span class="ac">AC ${esc(p.ac || '—')}</span></div>`; }).join('') : '<p class="muted">No characters yet. Add your party in Run Combat → Party.</p>'}</div>
        </div><div class="btngrid">
          <button data-go="combat/party">🛡 Party dashboard</button><button data-go="combat/tracker">⏳ Initiative tracker</button>
          ${cb.active ? '<button data-next class="primary">Next turn ▶</button>' : '<button data-go="combat/tracker" class="primary">Start a fight</button>'}<button data-go="combat/log">📜 Encounter log</button>
        </div>
      </div></section>
    <section class="panel p4"><header><span class="pn">4</span><h2>Session Tools</h2><button class="mini" data-pop="tools/dice" title="Pop out this panel into a new window">↗ Pop out</button></header>
      <div class="pbody"><div class="pinfo">
        <div class="dicebar">${[4, 6, 8, 10, 12, 20, 100].map(d => `<button data-roll="1d${d}">d${d}</button>`).join('')}</div>
        <div class="lastroll">${lastRoll ? `Last roll: <b>${esc(lastRoll.total)}</b> <span class="muted">${esc(lastRoll.expr)} · ${esc(lastRoll.detail)}</span>` : '<span class="muted">Digital dice for quick secret rolls — players still roll their own physical dice.</span>'}</div>
        ${st.dice.length > 1 ? `<div class="muted small">Earlier: ${st.dice.slice(1, 6).map(r => `<b>${esc(r.total)}</b> (${esc(r.expr)})`).join(' · ')}</div>` : ''}
        ${st.recap ? `<div class="kv"><span>Recap</span></div><p class="small">${esc(st.recap.slice(0, 220))}</p>` : `<p class="muted small learn-only">Use the notebook during play for names you invent, loot and promises. End Night &amp; Save stores a recap and downloads a save file for your jump drive.</p>`}
        </div><div class="btngrid">
          <button data-go="tools/events">🌩 Event generator</button><button data-go="tools/npcs">🎭 NPC generator</button>
          <button data-go="tools/notes">📝 Notebook</button><button data-act="endnight" class="primary">🌙 End Night &amp; Save</button>
        </div>
      </div></section>
    </div>`;
    $$('[data-go]', el).forEach(b => b.onclick = () => go(b.dataset.go));
    bindNoCampaign(el);
    $$('[data-pop]', el).forEach(b => b.onclick = () => popOut(b.dataset.pop));
    $$('[data-cond]', el).forEach(b => b.onclick = () => showCondition(b.dataset.cond));
    $$('[data-roll]', el).forEach(b => b.onclick = () => { Tools.roll(b.dataset.roll, 'normal', 'Quick roll'); });
    const nx = $('[data-next]', el); if (nx) nx.onclick = () => Combat.nextTurn(1);
    $('[data-act=endnight]', el).onclick = () => SaveUI.endnight();
    const q = $('#qspell'), qr = $('#qspellres');
    q.oninput = () => {
      const v = q.value.trim().toLowerCase(); if (v.length < 2) { qr.innerHTML = ''; return; }
      const sp = SRD.spells.filter(s => s.name.toLowerCase().includes(v)).slice(0, 5).map(s => `<button data-sp="${s.id}">✨ ${esc(s.name)} <small>${s.level ? 'L' + s.level : 'Cantrip'}</small></button>`);
      const wp = SRD.weapons.filter(w => w.name.toLowerCase().includes(v)).slice(0, 3).map(w => `<button data-wp="${w.id}">🗡 ${esc(w.name)} <small>${esc(w.damage)}</small></button>`);
      qr.innerHTML = sp.concat(wp).join('') || '<span class="muted">No match</span>';
      $$('[data-sp]', qr).forEach(b => b.onclick = () => showSpellModal(b.dataset.sp));
      $$('[data-wp]', qr).forEach(b => b.onclick = () => showWeaponModal(b.dataset.wp));
    };
  }
};
function showCondition(name) {
  const g = SRD.glossary.find(x => x.term.toLowerCase().startsWith(name.toLowerCase() + ' [condition]')) || SRD.glossary.find(x => x.term.toLowerCase().startsWith(name.toLowerCase()));
  openModal({ title: name + ' (condition)', html: g ? g.text.map(t => `<p>${fmtSRD(t)}</p>`).join('') + `<p class="src">SRD 5.2.1 Rules Glossary</p>` : '<p>Not found.</p>' });
}

/* ---------- Campaign guide ---------- */
function noCampaignHTML(compact) {
  return `<div class="parch pad nocamp ${compact ? 'compact' : ''}"><div class="nocamp-ico" aria-hidden="true">🗺</div><h2 class="deco">No campaign selected</h2>
    <p class="lead">Pick one from your library or import one.</p>
    <div class="btnrow center"><button class="primary" data-nc="pick">📚 Pick a campaign</button><button class="primary" data-nc="import">⬆ Import campaign</button><button data-nc="blank">✚ Start a blank campaign</button></div>
    ${compact ? '' : `<p class="muted">Everything else works without a campaign: lessons, the beginner course, the first adventure, What Do I Roll?, the rules and references, dice and generators. Characters and fights you set up now live on a separate scratch table.</p>`}</div>`;
}
function bindNoCampaign(el) { $$('[data-nc]', el).forEach(b => b.onclick = () => { const k = b.dataset.nc; if (k === 'pick') go('campaigns'); else if (k === 'blank') startBlankCampaign(); else importCampaignChooser(); }); }
const CAMP_TABS = [['overview', 'Overview'], ['sessions', 'Sessions'], ['npcs', 'NPCs'], ['locations', 'Locations'], ['bestiary', 'Bestiary'], ['items', 'Items'], ['tables', 'Tables'], ['secrets', 'Secrets'], ['handbook', 'Player Handbook']];
function campSections(c, kind) { return (c.sections || []).filter(s => s.kind === kind); }
function richHTML(h) { return `<div class="rich">${sanitizeHTML(h)}</div>`; }
VIEWS['guide/campaign'] = {
  title: 'Campaign', render(el, params) {
    const c = Store.campaign();
    if (!c) { el.innerHTML = noCampaignHTML(); bindNoCampaign(el); return; }
    const tab = params.tab || 'overview'; const st = Store.state;
    let body = '';
    const sel = num(params.i);
    const listDetail = (items, label, renderItem, nameOf = x => x.name || x.title) => {
      if (!items.length) return `<p class="muted">This campaign has no ${label} yet.</p>`;
      const i = sel !== null && items[sel] ? sel : 0;
      return `<div class="ld"><div class="ld-list" data-keep-scroll="ldl">${items.map((x, k) => `<button class="${k === i ? 'on' : ''}" data-i="${k}">${esc(nameOf(x))}</button>`).join('')}</div><div class="ld-detail parch" data-keep-scroll="ldd">${renderItem(items[i], i)}</div></div>`;
    };
    if (tab === 'overview') {
      body = `<div class="parch pad scrolly" data-keep-scroll="ov">
        <h2 class="deco">${esc(c.title)}</h2>${c.subtitle ? `<p class="muted">${esc(c.subtitle)}</p>` : ''}
        ${c.dmWarning ? `<div class="callout warn">${esc(c.dmWarning)}</div>` : ''}
        <p class="lead">${esc(c.summary || '')}</p>
        ${c.facts ? `<div class="facts">${Object.entries(c.facts).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
        ${(c.overview || []).concat(campSections(c, 'overview')).map(o => `<section class="sec"><h3>${esc(o.title)} ${o.audience === 'player' ? '' : dmBadge()}</h3>${richHTML(o.html)}</section>`).join('')}
        ${c.source && c.source.note ? `<p class="src">${esc(c.source.note)}</p>` : ''}
      </div>`;
    } else if (tab === 'sessions') {
      const ss = (c.sessions && c.sessions.length) ? c.sessions : campSections(c, 'session').map((s, k) => ({ number: k + 1, title: s.title, html: s.html, scenes: [] }));
      body = listDetail(ss, 'sessions', (s, i) => `
        <div class="row between"><h2 class="deco">Session ${esc(s.number || i + 1)}: ${esc(s.title)}</h2>${st.currentSession === i ? '<span class="pill on">Current session</span>' : `<button data-cur="${i}">Set as current session</button>`}</div>
        ${s.summary ? `<p class="lead">${esc(s.summary)}</p>` : ''}
        ${(s.scenes || []).map((sc, k) => `<section class="scene"><h3>${esc(sc.title)}</h3>
          ${(sc.encounters || []).map((en, e) => `<div class="enc"><b>⚔ Encounter:</b> ${esc(en.enemies || '')}${en.difficulty ? ` <span class="pill">${esc(en.difficulty)}</span>` : ''}${en.foes && en.foes.length ? ` <button class="primary" data-foes="${i}:${k}:${e}">Add to Initiative Tracker</button>` : ''}${en.tactics ? `<div class="muted">${esc(en.tactics)}</div>` : ''}</div>`).join('')}
          ${richHTML(sc.html || '')}</section>`).join('')}
        ${s.html && !(s.scenes || []).length ? richHTML(s.html) : ''}`, s => 'Session ' + (s.number || '') + ': ' + s.title);
    } else if (tab === 'npcs') {
      const items = (c.npcs && c.npcs.length) ? c.npcs : campSections(c, 'npc').map(s => ({ name: s.title, html: s.html }));
      body = listDetail(items, 'NPCs', n => `<h2 class="deco">${esc(n.name)} ${dmBadge()}</h2>${n.role ? `<p class="muted">${esc(n.role)}</p>` : ''}
        <dl class="npc-dl">${[['Look', n.look], ['Voice', n.voice], ['Wants', n.wants], ['Secret', n.secret], ['Knows', n.knows]].filter(x => x[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${n.html ? richHTML(n.html) : ''}`);
    } else if (tab === 'locations') {
      const items = (c.locations && c.locations.length) ? c.locations : campSections(c, 'location').map(s => ({ name: s.title, html: s.html }));
      body = listDetail(items, 'locations', n => `<h2 class="deco">${esc(n.name)} ${dmBadge()}</h2>${richHTML(n.html || esc(n.text || ''))}<div class="btnrow"><button data-loc="${esc(n.name)}">Set as party location</button></div>`);
    } else if (tab === 'bestiary') {
      const items = (c.bestiary && c.bestiary.length) ? c.bestiary : campSections(c, 'bestiary').map(s => ({ name: s.title, html: s.html }));
      body = listDetail(items, 'creatures', (b, i) => `${b.ac !== undefined ? renderStatBlock(b) : `<h2 class="deco">${esc(b.name)}</h2>${richHTML(b.html)}`}${b.ac !== undefined ? `<div class="btnrow"><button class="primary" data-addbeast="${i}">Add to Initiative Tracker</button></div>` : ''}`);
    } else if (tab === 'items') {
      const items = (c.items && c.items.length) ? c.items : campSections(c, 'item').map(s => ({ name: s.title, html: s.html }));
      body = listDetail(items, 'items', n => `<h2 class="deco">${esc(n.name)}</h2>${n.type ? `<p class="muted">${esc(n.type)}</p>` : ''}${n.text ? `<p>${esc(n.text)}</p>` : ''}${n.html ? richHTML(n.html) : ''}`);
    } else if (tab === 'tables') {
      const items = c.tables || [];
      body = listDetail(items, 'tables', t => `<h2 class="deco">${esc(t.title)}</h2>${t.note ? `<p>${esc(t.note)}</p>` : ''}<table class="tbl"><thead><tr>${(t.columns || []).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${(t.rows || []).map(r => `<tr>${r.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>${/^d\d+/.test((t.columns || [])[0] || '') ? `<div class="btnrow"><button data-rolltable="${esc(t.columns[0])}">Roll ${esc(t.columns[0])} on this table</button><span class="rolled"></span></div>` : ''}`, t => t.title);
    } else if (tab === 'secrets') {
      const items = (c.secrets && c.secrets.length) ? c.secrets : campSections(c, 'secret').map(s => ({ title: s.title, html: s.html }));
      body = `<div class="callout warn">🔒 Secrets are for the Dungeon Master only. They never appear in the player handbook window.</div>` + listDetail(items, 'secrets', s => `<h2 class="deco">${esc(s.title)} ${dmBadge()}</h2>${richHTML(s.html)}`, s => s.title);
    } else if (tab === 'handbook') {
      const hb = c.handbook;
      body = `<div class="parch pad scrolly" data-keep-scroll="hb"><div class="row between"><h2 class="deco">${esc(hb ? hb.title : 'Player handbook')}</h2><button class="primary" data-player>👁 Show player handbook (new window)</button></div>
        <p>The player handbook window shows only player-facing material — no DM secrets, NPC secrets, sessions or bestiary. Drag it to a monitor or TV the players can see.</p>
        ${hb && hb.sections && hb.sections.length ? `<ol class="toc">${hb.sections.map(s => `<li>${esc(s.title)}</li>`).join('')}</ol>` : '<p class="muted">This campaign has no player-facing handbook. When you import an HTML or Markdown file, mark it as “Player handbook” to fill this.</p>'}</div>`;
    }
    el.innerHTML = `<div class="camp-wrap"><div class="tabs">${CAMP_TABS.map(([k, t]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${t}</button>`).join('')}</div><div class="camp-body">${body}</div></div>`;
    $$('[data-tab]', el).forEach(b => b.onclick = () => go('guide/campaign', { tab: b.dataset.tab }));
    $$('.ld-list button', el).forEach(b => b.onclick = () => go('guide/campaign', { tab, i: b.dataset.i }));
    $$('[data-cur]', el).forEach(b => b.onclick = () => { Store.mutate(s => { s.currentSession = Number(b.dataset.cur); }); renderView(); toast('Current session updated'); });
    $$('[data-loc]', el).forEach(b => b.onclick = () => { Store.mutate(s => { s.location = b.dataset.loc; }); toast('Party location set: ' + b.dataset.loc); });
    $$('[data-foes]', el).forEach(b => b.onclick = () => { const [i, k, e] = b.dataset.foes.split(':').map(Number); Combat.addFoes(c.sessions[i].scenes[k].encounters[e].foes); });
    $$('[data-addbeast]', el).forEach(b => b.onclick = () => Combat.addFoes([{ count: 1, name: c.bestiary[Number(b.dataset.addbeast)].name }]));
    $$('[data-rolltable]', el).forEach(b => b.onclick = () => { const r = rollExpr('1' + b.dataset.rolltable); b.nextElementSibling.textContent = 'Rolled ' + r.total; });
    const pb = $('[data-player]', el); if (pb) pb.onclick = openPlayerHandbook;
  }
};
function renderStatBlock(b) {
  const ab = b.abilities || [];
  const secs = (b.sections || []).map(s => `<h4>${esc(s.title)}</h4>${s.entries.map(e => `<p><b><i>${esc(e.name)}.</i></b> ${esc(e.text)}</p>`).join('')}`).join('');
  let lines = (b.lines || []).filter(l => !/^(AC|HP|Initiative) /.test(l));
  /* SRD monsters store traits/actions as lines with section headers */
  const heads = new Set(['Traits', 'Actions', 'Bonus Actions', 'Reactions', 'Legendary Actions']);
  const lineHTML = lines.map(l => heads.has(l) ? `<h4>${esc(l)}</h4>` : (/^[A-Z][^.]{1,60}\. /.test(l) && !/^(Skills|Senses|Languages|CR|Speed|Gear|Resistances|Immunities|Vulnerabilities|Saving)/.test(l) ? `<p><b><i>${esc(l.split('. ')[0])}.</i></b> ${esc(l.split('. ').slice(1).join('. '))}</p>` : `<p class="sbl">${esc(l).replace(/^(Skills|Senses|Languages|CR|Speed|Gear|Resistances|Immunities|Vulnerabilities|Saving Throws)/, '<b>$1</b>')}</p>`)).join('');
  return `<div class="statblock"><h2>${esc(b.name)}</h2><p class="meta"><i>${esc(b.meta || '')}</i></p>
    <div class="sb-top"><span><b>AC</b> ${esc(b.ac)}</span><span><b>HP</b> ${esc(b.hpText || (b.hp + (b.hpDice ? ' (' + b.hpDice + ')' : '')))}</span><span><b>Initiative</b> ${esc(b.init || '+0')}</span>${b.speed ? `<span><b>Speed</b> ${esc(b.speed)}</span>` : ''}</div>
    ${ab.length ? `<table class="abil"><tr>${ab.map(a => `<th>${esc(a[0])}</th>`).join('')}</tr><tr>${ab.map(a => `<td>${esc(a[1])} <small>(${esc(a[2])})</small></td>`).join('')}</tr><tr>${ab.map(a => `<td class="muted"><small>save ${esc(a[3])}</small></td>`).join('')}</tr></table>` : ''}
    ${lineHTML}${secs}${b.description ? `<p class="muted"><i>${esc(b.description)}</i></p>` : ''}</div>`;
}

/* ---------- Player handbook (player-safe window) ---------- */
VIEWS.handbook = {
  title: 'Player Handbook', render(el, params) {
    const c = Store.campaign(); const hb = c && c.handbook;
    if (!hb || !hb.sections || !hb.sections.length) { el.innerHTML = `<div class="parch pad"><h2>No player handbook</h2><p>The active campaign has no player-facing handbook.</p></div>`; return; }
    /* Player-safe: only handbook sections (audience player) and player-facing location blurbs are read here. */
    const secs = hb.sections.filter(s => s.audience !== 'dm');
    const cur = secs.find(s => s.id === params.s) || secs[0];
    const places = (c.locations_player || []);
    el.innerHTML = `<div class="hb"><nav class="hb-nav">${secs.map(s => `<button class="${s === cur ? 'on' : ''}" data-s="${esc(s.id)}">${esc(s.title)}</button>`).join('')}${places.length ? `<button class="${params.s === '_places' ? 'on' : ''}" data-s="_places">Places to Know</button>` : ''}</nav>
      <article class="parch pad scrolly hb-body">${params.s === '_places' ? `<h2 class="deco">Places to Know</h2>${places.map(p => `<h3>${esc(p.name)}</h3><p>${esc(p.text)}</p>`).join('')}` : `${cur === secs[0] ? `<p class="kicker">${esc(hb.kicker || '')}</p><h1 class="deco">${esc(hb.title)}</h1><p class="lead">${esc(hb.lead || '')}</p>` : ''}<h2 class="deco">${esc(cur.title)}</h2>${richHTML(cur.html)}`}</article></div>`;
    $$('[data-s]', el).forEach(b => b.onclick = () => go('handbook', { s: b.dataset.s }));
  }
};

/* ---------- Lessons ---------- */
VIEWS['guide/lessons'] = {
  title: 'Lessons', render(el, params) {
    const L = window.DM_LESSONS || []; const prog = Progress.get();
    const cur = lessonById(params.id) || L[0];
    const groups = [...new Set(L.map(l => l.group))];
    const idx = L.indexOf(cur);
    const done = Object.keys(prog.lessons).filter(k => prog.lessons[k]).length;
    el.innerHTML = `<div class="ld"><div class="ld-list" data-keep-scroll="lessons"><div class="ld-head">${L.length} lessons · ${done} read</div>${groups.map(g => `<h4>${esc(g)}</h4>${L.filter(l => l.group === g).map(l => `<button class="${l === cur ? 'on' : ''}" data-id="${l.id}">${prog.lessons[l.id] ? '✓ ' : ''}${esc(l.title)}</button>`).join('')}`).join('')}</div>
      <article class="ld-detail parch lesson" data-keep-scroll="lesson"><p class="kicker">${esc(cur.group)} · Lesson ${idx + 1} of ${L.length} · about ${cur.minutes} min</p><h2 class="deco">${esc(cur.title)}</h2>
      ${cur.body.map(p => `<p>${p}</p>`).join('')}${cur.tip ? `<div class="tipbox"><b>At the table:</b> ${cur.tip}</div>` : ''}
      <div class="btnrow"><button ${idx <= 0 ? 'disabled' : ''} data-nav="${idx - 1}">◀ Previous</button><button class="primary" data-done>${prog.lessons[cur.id] ? '✓ Read — mark unread' : 'Mark as read'}</button><button ${idx >= L.length - 1 ? 'disabled' : ''} data-nav="${idx + 1}">Next ▶</button></div></article></div>`;
    $$('[data-id]', el).forEach(b => b.onclick = () => go('guide/lessons', { id: b.dataset.id }));
    $$('[data-nav]', el).forEach(b => b.onclick = () => go('guide/lessons', { id: L[Number(b.dataset.nav)].id }));
    $('[data-done]', el).onclick = () => { const p = Progress.get(); p.lessons[cur.id] = !p.lessons[cur.id]; Progress.set(p); renderView(); };
  }
};

/* ---------- Beginner course (12 steps with practice questions) ---------- */
VIEWS['guide/course'] = {
  title: 'Beginner Course', render(el, params) {
    const C = window.DM_COURSE || []; const prog = Progress.get();
    const step = clamp(int0(params.step || (C.findIndex((s, i) => !prog.course[i]) + 1) || 1), 1, C.length) - 1;
    App.params.step = String(step + 1);
    const s = C[step]; const L = lessonById(s.lesson);
    const ans = (prog.answers || {})[step] || {};
    el.innerHTML = `<div class="ld"><div class="ld-list" data-keep-scroll="course"><div class="ld-head">12-step beginner sequence</div>${C.map((x, i) => `<button class="${i === step ? 'on' : ''}" data-step="${i + 1}"><span class="stepn ${prog.course[i] ? 'done' : ''}">${prog.course[i] ? '✓' : i + 1}</span>${esc(lessonById(x.lesson).title)}</button>`).join('')}</div>
    <article class="ld-detail parch lesson" data-keep-scroll="courseb"><p class="kicker">Step ${step + 1} of ${C.length}</p><h2 class="deco">${esc(L.title)}</h2><div class="goal"><b>Goal:</b> ${esc(s.goal)}</div>
      ${L.body.map(p => `<p>${p}</p>`).join('')}${L.tip ? `<div class="tipbox"><b>At the table:</b> ${L.tip}</div>` : ''}
      <h3>Practice</h3>
      ${s.q.map((q, qi) => `<div class="quiz" data-q="${qi}"><p class="qq"><b>${qi + 1}.</b> ${esc(q.q)}</p>${q.a.map((a, ai) => `<button class="ans ${ans[qi] === ai ? (ai === q.c ? 'right' : 'wrong') : ''}" data-a="${ai}">${esc(a)}</button>`).join('')}
        ${ans[qi] !== undefined ? `<div class="fb ${ans[qi] === q.c ? 'right' : 'wrong'}">${ans[qi] === q.c ? '✓ Correct. ' : '✗ Not quite. '}${esc(q.f[ans[qi]])}${ans[qi] !== q.c ? ' <i>Try another answer.</i>' : ''}</div>` : ''}</div>`).join('')}
      <div class="btnrow"><button ${step === 0 ? 'disabled' : ''} data-go-step="${step}">◀ Previous step</button>${prog.course[step] ? '<span class="pill on">Step complete</span>' : '<span class="muted">Answer all three correctly to complete this step.</span>'}<button ${step >= C.length - 1 ? 'disabled' : ''} data-go-step="${step + 2}" class="primary">Next step ▶</button></div></article></div>`;
    $$('[data-step]', el).forEach(b => b.onclick = () => go('guide/course', { step: b.dataset.step }));
    $$('[data-go-step]', el).forEach(b => b.onclick = () => go('guide/course', { step: b.dataset.goStep }));
    $$('.quiz', el).forEach(qd => $$('.ans', qd).forEach(b => b.onclick = () => {
      const p = Progress.get(); p.answers = p.answers || {}; p.answers[step] = p.answers[step] || {};
      p.answers[step][qd.dataset.q] = Number(b.dataset.a);
      p.course[step] = s.q.every((q, qi) => p.answers[step][qi] === q.c);
      if (p.course[step]) p.lessons[s.lesson] = true;
      Progress.set(p); renderView();
    }));
  }
};

/* ---------- Guided first adventure ---------- */
VIEWS['guide/adventure'] = {
  title: 'First Adventure', render(el, params) {
    const A = window.DM_ADVENTURE; const sc = clamp(int0(params.scene), 0, A.scenes.length);
    const S = sc > 0 ? A.scenes[sc - 1] : null;
    el.innerHTML = `<div class="ld"><div class="ld-list"><div class="ld-head">${esc(A.title)}</div><button class="${!S ? 'on' : ''}" data-sc="0">Before you start</button>${A.scenes.map((s, i) => `<button class="${sc === i + 1 ? 'on' : ''}" data-sc="${i + 1}">${esc(s.title)}</button>`).join('')}</div>
    <article class="ld-detail parch lesson" data-keep-scroll="adv">${!S ? `<h2 class="deco">${esc(A.title)}</h2><p class="lead">${esc(A.pitch)}</p><div class="goal"><b>For:</b> ${esc(A.forParty)}</div><h3>Preparation</h3><ol>${A.prep.map(p => `<li>${p}</li>`).join('')}</ol><p class="muted">Monsters used are from SRD 5.2.1. Each scene has a button to add them to the Initiative Tracker.</p><div class="btnrow"><button class="primary" data-sc="1">Begin Scene 1 ▶</button></div>` :
      `<p class="kicker">${esc(S.kind)}</p><h2 class="deco">${esc(S.title)}</h2><div class="goal"><b>What this scene teaches:</b> ${esc(S.purpose)}</div>
      <blockquote class="readaloud"><span class="ra-lbl">Read aloud</span>${esc(S.readAloud)}</blockquote>
      <h3>Run it</h3><ul>${S.run.map(r => `<li>${r}</li>`).join('')}</ul>
      ${S.monsters ? `<div class="enc"><b>⚔ Monsters:</b> ${S.monsters.map(m => `${m.count} × ${esc(m.srd)}`).join(', ')} <button class="primary" data-addmon>Add to Initiative Tracker</button> ${S.monsters.map(m => `<button data-sb="${esc(m.srd)}">${esc(m.srd)} stat block</button>`).join(' ')}</div>` : ''}
      <h3>Rolls in this scene</h3><table class="tbl">${S.rolls.map(r => `<tr><th>${esc(r[0])}</th><td>${r[1]}</td></tr>`).join('')}</table>
      <div class="tipbox"><b>If the players get stuck:</b> ${S.stuck}</div>
      <h3>Record after the scene</h3><ul>${S.record.map(r => `<li>${r}</li>`).join('')}</ul><button data-rec>Add these prompts to the notebook</button>
      <h3 class="learn-only">Related lessons</h3><div class="chips learn-only">${S.teach.map(t => { const l = lessonById(t); return l ? `<button class="chip" data-lesson="${t}">${esc(l.title)}</button>` : ''; }).join('')}</div>
      <div class="btnrow"><button data-sc="${sc - 1}">◀ Back</button>${sc < A.scenes.length ? `<button class="primary" data-sc="${sc + 1}">Next scene ▶</button>` : '<span class="pill on">Adventure complete — everyone reaches level 2</span>'}</div>`}</article></div>`;
    $$('[data-sc]', el).forEach(b => b.onclick = () => go('guide/adventure', { scene: b.dataset.sc }));
    $$('[data-lesson]', el).forEach(b => b.onclick = () => showLessonModal(b.dataset.lesson));
    $$('[data-sb]', el).forEach(b => b.onclick = () => showMonsterModal(b.dataset.sb));
    const am = $('[data-addmon]', el); if (am) am.onclick = () => Combat.addFoes(S.monsters.map(m => ({ count: m.count, name: m.srd })));
    const rc = $('[data-rec]', el); if (rc) rc.onclick = () => { const txt = '\n\n## ' + S.title + '\n' + S.record.map(r => '- ' + r.replace(/<[^>]+>/g, '') + '\n  → ').join('\n'); Store.mutate(s => { s.notes = (s.notes || '') + txt; }); toast('Added to the notebook'); };
  }
};
function showLessonModal(id) { const l = lessonById(id); if (!l) return; const m = openModal({ title: l.title, html: l.body.map(p => `<p>${p}</p>`).join('') + (l.tip ? `<div class="tipbox"><b>At the table:</b> ${l.tip}</div>` : '') + `<div class="btnrow"><button data-full>Open in Lessons</button></div>` }); $('[data-full]', m.body).onclick = () => { m.close(); go('guide/lessons', { id }); }; }

/* ---------- What Do I Roll? ---------- */
VIEWS['guide/roll'] = {
  title: 'What Do I Roll?', render(el, params) {
    const R = window.DM_ROLLGUIDE; const path = (params.path || R.start).split('.').filter(Boolean);
    const curId = path[path.length - 1]; const n = R.nodes[curId] || R.nodes[R.start];
    el.innerHTML = `<div class="roll-wrap"><div class="parch pad rollq" data-keep-scroll="rg"><h2 class="deco">What Do I Roll?</h2>
      <div class="crumbs">${path.map((id, i) => { const x = R.nodes[id]; return `<button data-path="${path.slice(0, i + 1).join('.')}">${esc(x.q ? x.q.replace(/\?.*$/, '?') : x.result)}</button>`; }).join(' › ')}</div>
      ${n.q ? `<h3 class="bigq">${esc(n.q)}</h3>${n.help ? `<p class="muted">${esc(n.help)}</p>` : ''}<div class="opts">${n.opts.map(o => `<button class="opt" data-to="${o[1]}">${esc(o[0])}</button>`).join('')}</div>`
        : `<div class="result"><h3>${esc(n.result)}</h3><p>${n.text}</p></div><div class="btnrow"><button class="primary" data-path="${R.start}">↺ Start over</button>${path.length > 1 ? `<button data-path="${path.slice(0, -1).join('.')}">◀ Back</button>` : ''}</div>`}
      <div class="tipbox learn-only">Three principles: routine actions need no roll; impossible actions stay impossible no matter the roll; and when a specific rule (an attack, a spell, Hide, Influence, grappling…) covers the situation, use it instead of a generic ability check.</div></div>
      <div class="parch pad situations scrolly"><h3>Common situations</h3><table class="tbl">${R.situations.map(s => `<tr><th>${esc(s[0])}</th><td>${s[1]}</td></tr>`).join('')}</table></div></div>`;
    $$('[data-to]', el).forEach(b => b.onclick = () => go('guide/roll', { path: path.concat(b.dataset.to).join('.') }));
    $$('[data-path]', el).forEach(b => b.onclick = () => go('guide/roll', { path: b.dataset.path }));
  }
};
