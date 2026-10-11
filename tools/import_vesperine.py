#!/usr/bin/env python3
"""Rebuild the bundled 'Vesperine & the Velvet Marches' campaign + art from DnD Bot's DM Atlas export.

    python3 tools/import_vesperine.py [--export DIR] [--no-export-build] [--force] [--no-art] [--no-app-build]

Steps:
  1. runs DnD Bot's  dm-atlas-export/_build/build_atlas.py  and  dm-atlas-export/validate_atlas.py
     (stops on validator errors unless --force; warnings are reported)
  2. converts the export (campaign/npcs/locations/mystery/adventures/monsters/read-aloud JSON, players.md, dm.md)
     plus solo-entry-adventures.md into the DM Atlas campaign doc, keeping the export's ids and its three-way
     visibility (player / gated / dm_only). A player-safe projection is precomputed into doc.player.
  3. writes src/data/vesperine.js (bundled) and campaigns/<id>.dmatlas.json (importable; same id -> in-place update)
  4. writes the art pack campaigns/<id>.dmatlas-art.json and the folder art/<id>/v/<opaque>.webp
     (opaque file names: no true names in any served path; stale files are removed)
  5. rebuilds index.html (tools/build.py)
Re-running is idempotent: same input -> byte-identical output."""
import os, sys, re, json, io, hashlib, base64, subprocess, shutil, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vesp_md, vesp_bestiary
from vesp_md import md2html, plain

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--export', default='/workspace/dnd-world/dm-atlas-export')
ap.add_argument('--no-export-build', action='store_true'); ap.add_argument('--force', action='store_true')
ap.add_argument('--no-art', action='store_true'); ap.add_argument('--no-app-build', action='store_true')
args = ap.parse_args()
EXP = os.path.abspath(args.export); SRC = os.path.dirname(EXP)
OLD_IDS = ['vesperine-velvet-marches']
SALT = 'dm-atlas/vesperine/art/v1'
WARN = []
def warn(m): WARN.append(m)

# ---------- 1. DnD Bot's build + validator ----------
validator = dict(errors=None, warnings=None, lines=[])
if not args.no_export_build:
    r = subprocess.run([sys.executable, os.path.join(EXP, '_build', 'build_atlas.py')], cwd=SRC, capture_output=True, text=True)
    print('build_atlas.py:', (r.stdout.strip().splitlines() or ['(no output)'])[-1])
    if r.returncode: print(r.stdout, r.stderr); sys.exit('build_atlas.py failed')
r = subprocess.run([sys.executable, os.path.join(EXP, 'validate_atlas.py')], cwd=SRC, capture_output=True, text=True)
out = (r.stdout + r.stderr).strip().splitlines(); validator['lines'] = out
m = re.search(r'(\d+) error\(s\), (\d+) warning\(s\)', '\n'.join(out))
if m: validator['errors'], validator['warnings'] = int(m.group(1)), int(m.group(2))
print('validate_atlas.py:', out[-1] if out else '(no output)', '(exit %d)' % r.returncode)
for l in out:
    if l.startswith('ERROR') or l.startswith('ERR'): print('  ' + l)
if r.returncode and not args.force: print('\n'.join(out)); sys.exit('validator reported errors; fix the export or use --force')

J = lambda f: json.load(open(os.path.join(EXP, f), encoding='utf-8'))
camp = J('campaign.json'); NP = J('npcs.json')['npcs']; LJ = J('locations.json'); LOCS = LJ['locations']
MY = J('mystery.json'); ADV = J('adventures.json')['adventures']; MON = J('monsters.json'); RA = J('read-aloud.json')['read_aloud']
PLAYERS_MD = open(os.path.join(EXP, 'players.md'), encoding='utf-8').read(); DM_MD = open(os.path.join(EXP, 'dm.md'), encoding='utf-8').read()
SOLO = open(os.path.join(SRC, 'solo-entry-adventures.md'), encoding='utf-8').read()
CID = camp['id']
TERMS = camp['spoiler_terms']
def spoils(s): return [t for t in TERMS if re.search(re.escape(t), json.dumps(s, ensure_ascii=False) if not isinstance(s, str) else s, re.I)]
def safe(s, where):
    """Player-projection guard: drop any player-marked string that still contains a spoiler term."""
    if s is None: return None
    bad = spoils(s)
    if bad: warn('dropped player text at %s (spoiler term %s)' % (where, bad)); return None
    return s
NPC = {n['id']: n for n in NP}; LOC = {l['id']: l for l in LOCS}; FAC = {f['id']: f for f in camp['factions']}
MAPS = {m['id']: m for m in camp['maps']}; MAPS.update({m['id']: m for m in LJ.get('maps', [])})
RAID = {r['id']: r for r in RA}; ADVID = {a['id']: a for a in ADV}

# ---------- visibility helpers ----------
def entry_vis(rec): v = rec.get('visibility'); return v if isinstance(v, str) else (v or {}).get('entry', 'dm_only')
def field_vis(rec, f):
    v = rec.get('visibility')
    if isinstance(v, str): return v
    fl = (v or {}).get('fields', {}); return fl.get(f, fl.get('*', 'dm_only'))

# ---------- art: opaque keys ----------
ART = {}   # source path (relative to SRC) -> opaque key
def art(path):
    if not path: return None
    path = path.replace('../', '')
    if not os.path.exists(os.path.join(SRC, path)): warn('image missing: ' + path); return None
    if path not in ART: ART[path] = 'v/' + hashlib.sha256((SALT + '|' + path).encode()).hexdigest()[:20]
    return ART[path]
def tok(kind, id): return kind[0] + hashlib.sha256((SALT + '|tok|' + kind + '|' + id).encode()).hexdigest()[:12]

# ---------- read-alouds ----------
def ra_html(text): return '<blockquote class="readaloud">' + md2html(text) + '</blockquote>'
read_aloud = []
for r in RA:
    read_aloud.append(dict(id=r['id'], kind=r['kind'], title=r.get('title') or '', vis=r['visibility'], html=ra_html(r['text']), npcs=r.get('npcs') or [],
                           adventure=r.get('adventure'), source='%s · %s (lines %s–%s)' % (r['context'].get('file'), ' > '.join(r['context'].get('heading_path') or []) or r['context'].get('heading', ''), r['context'].get('line_start'), r['context'].get('line_end'))))
REVEAL_RA = {}
for r in RA:
    if r['visibility'] == 'gated':
        for n in r.get('npcs') or []: REVEAL_RA.setdefault(n, []).append(r['id'])

# ---------- SRD names (2024, as DM Atlas spells them) ----------
def srd_app_name(n): return n.replace("'", '’') if n.lower().startswith('will-o') else n
srd_cited = [dict(name=srd_app_name(r['name']), cr=r['cr'], xp=r['xp'], usedBy=r.get('used_by') or []) for r in MON['srd_5_2_1_references']]

# ---------- bestiary (YAML + its rendering, cross-checked; then against monsters.json) ----------
cols, bestiary, problems = vesp_bestiary.build()
if problems: sys.exit('bestiary cross-check problems: %r' % problems[:10])
mj = {m['slug']: m for m in MON['monsters']}
for b in bestiary:
    m = mj.get(b['slug'])
    if not m: sys.exit('monster %s missing from monsters.json' % b['slug'])
    if (m['ac'], m['hp'], str(m['cr']), m['name']) != (b['ac'], b['hp'], b['cr'], b['name']): sys.exit('monsters.json mismatch for %s: %r' % (b['slug'], ((m['ac'], m['hp'], m['cr']), (b['ac'], b['hp'], b['cr']))))
    b['id'] = b['slug']; b['xp'] = m['xp']; b['art'] = art(m['art']); b['referencedIn'] = m.get('referenced_in') or []
if len(bestiary) != len(MON['monsters']): sys.exit('monster count mismatch')
BEAST = {b['slug']: b for b in bestiary}

# ---------- NPCs ----------
def stat_for(sr):
    """Resolve an NPC stat reference to a stat block DM Atlas can add to the tracker (never invented)."""
    src = sr.get('source'); ref = sr.get('ref'); base = sr.get('base') or ''
    if src == 'srd-5.2.1': return srd_app_name(ref)
    if src == 'bestiary': return BEAST[ref]['name']
    if src == 'custom' and base.startswith('srd:'): return srd_app_name(base[4:])
    if src == 'custom' and base.startswith('bestiary:'): return BEAST[base[9:]]['name']
    return None
npcs = []
for n in NP:
    p = n.get('portraits') or {}
    def pa(k):
        x = p.get(k); return dict(key=art(x['path']), vis=x['visibility'], preferred=bool(x.get('preferred')), note=x.get('note')) if x else None
    sr = n.get('stat_reference') or {}
    rec = dict(id=n['id'], name=n['name'], displayName=n['display_name'], nameVis=field_vis(n, 'name'), entry=entry_vis(n),
               role=n.get('role'), publicRole=n.get('public_role'), faction=n.get('faction'), factionVis=field_vis(n, 'faction'),
               location=n.get('location'), publicLocation=n.get('public_location'), publicDescription=n.get('public_description'),
               dmSecret=n.get('dm_secret'), motivations=n.get('motivations') or [], tells=n.get('tells') or [], revealTriggers=n.get('reveal_triggers') or [],
               trueForm=n.get('true_form_description'), glamourDc=n.get('glamour_dc'), allureDc=n.get('allure_dc'),
               stat=dict(sr, statName=stat_for(sr)), appearsIn=n.get('appears_in') or [], source=n.get('source'), sourceSection=n.get('source_section'), notes=n.get('notes'),
               fey=bool(n.get('fey')), aliases=n.get('aliases') or [], portraitStatus=n.get('portrait_status'),
               art=dict(portrait=pa('default'), guise=pa('human_guise') or pa('guise'), spicy=pa('spicy_alt'), revealed=pa('revealed'), alternate=pa('alternate'), solo=[dict(key=art(s['path']), vis=s['visibility']) for s in p.get('solo_art') or []]),
               revealRA=REVEAL_RA.get(n['id'], []))
    rec['gated'] = rec['nameVis'] == 'gated' or any(a['visibility'] == 'gated' for a in rec['aliases']) or any((rec['art'][k] or {}).get('vis') == 'gated' for k in ('portrait', 'guise', 'spicy', 'revealed', 'alternate')) or bool(rec['revealRA'])
    rec['disguised'] = rec['nameVis'] == 'gated'
    npcs.append(rec)

# ---------- player projection (only player-safe + gated-behind-a-reveal) ----------
def loc_public_name(lid):
    l = LOC.get(lid); return l['name'] if l and entry_vis(l) == 'player' and field_vis(l, 'name') == 'player' else None
pl_npcs = []
for r, n in zip(npcs, NP):
    if r['entry'] != 'player': continue
    where = 'npcs.json#' + r['id']; F = lambda f: field_vis(n, f) == 'player'
    show_name = r['name'] if r['nameVis'] == 'player' else r['displayName']
    pa_, ga_, sa_ = r['art']['portrait'], r['art']['guise'], r['art']['spicy']
    pub_alias = [a['name'] for a in r['aliases'] if a['visibility'] == 'player' and a['name'] != show_name]
    gated_alias = [a['name'] for a in r['aliases'] if a['visibility'] == 'gated']
    # portrait players see before any reveal: disguised -> human guise; others -> standard portrait
    if r['disguised']: img = ga_['key'] if ga_ and ga_['vis'] == 'player' else None
    else: img = pa_['key'] if pa_ and pa_['vis'] == 'player' else None
    rev = None
    if r['gated']:
        rev = dict(name=r['name'] if r['nameVis'] == 'gated' else None, aliases=gated_alias,
                   img=(pa_['key'] if r['disguised'] and pa_ else (r['art']['revealed']['key'] if r['art']['revealed'] and r['art']['revealed']['vis'] == 'gated' else None)),
                   altImg=(ga_['key'] if (not r['disguised']) and gated_alias and ga_ else None),
                   ra=[dict(title=RAID[i].get('title') or 'Reveal', html=ra_html(RAID[i]['text'])) for i in r['revealRA']])
    spicy = None
    if sa_: spicy = dict(key=sa_['key'], gated=sa_['vis'] == 'gated' or r['disguised'])
    fac = FAC.get(r['faction']) if F('faction') else None
    group = 'Gateway characters' if (r['publicRole'] or '').startswith('Gateway') else (fac['name'] if fac and fac.get('visibility') == 'player' and fac['id'] != 'independent' else 'Independent & unaffiliated')
    pl_npcs.append(dict(t=tok('face', r['id']), id=r['id'], group=group, name=safe(show_name, where + '.display_name'), role=safe(r['publicRole'], where + '.public_role') if F('public_role') else None,
                        text=safe(r['publicDescription'], where + '.public_description') if F('public_description') else None,
                        place=safe(loc_public_name(r['publicLocation']), where + '.public_location') if F('public_location') and r['publicLocation'] else None,
                        allure=safe(r['allureDc'], where + '.allure_dc') if F('allure_dc') else None, aliases=[a for a in pub_alias if safe(a, where + '.alias')],
                        img=img, gate=('npc:' + r['id']) if rev else None, rev=rev, spicy=spicy))
pl_npcs = [p for p in pl_npcs if p['name']]
pl_locs = []
for l in LOCS:
    if entry_vis(l) != 'player': continue
    where = 'locations.json#' + l['id']; F = lambda f: field_vis(l, f) == 'player'
    mp = MAPS.get(l.get('map')) if l.get('map') else None
    pl_locs.append(dict(t=tok('loc', l['id']), name=safe(l['name'], where + '.name'), type=l['type'] if F('type') else None,
                        parent=loc_public_name(l.get('parent')) if F('parent') else None, text=safe(l.get('public_description'), where + '.public_description') if F('public_description') else None,
                        travel=safe(l.get('travel_from_vesperine'), where + '.travel') if F('travel_from_vesperine') else None,
                        map=mp['title'] if mp and mp.get('visibility') == 'player' else None,
                        painted=(art(l['painted_image']['path']) if l.get('painted_image') and l['painted_image'].get('visibility') == 'player' else None)))
pl_locs = [p for p in pl_locs if p['name']]
objects = [dict(id=o['slug'], name=o['name'], vis=o.get('visibility', 'dm_only'), img=art(o['path']), prompt=o.get('prompt_number')) for o in camp.get('object_portraits') or []]
pl_objects = [dict(t=tok('obj', o['id']), name=o['name'], img=o['img']) for o in objects if o['vis'] == 'player' and o['img'] and safe(o['name'], 'object ' + o['id'])]
pl_factions = [dict(name=f['name'], kind=f.get('kind'), summary=safe(f.get('summary'), 'faction ' + f['id'])) for f in camp['factions'] if f.get('visibility') == 'player' and safe(f['name'], 'faction ' + f['id'])]
pl_maps = [dict(title=m['title'], ascii=m.get('ascii') or '') for m in camp['maps'] if m.get('visibility') == 'player' and safe(m.get('ascii') or '', 'map ' + m['id']) is not None]
pl_timeline = [dict(when=t['when'], event=safe(t['event'], 'timeline')) for t in MY['timeline'] if (t.get('visibility') if isinstance(t.get('visibility'), str) else 'dm_only') == 'player']
pl_timeline = [t for t in pl_timeline if t['event']]
pl_ra = []
for r in RA:
    if r['visibility'] == 'player' and safe(r['text'], 'read-aloud.json#' + r['id']):
        pl_ra.append(dict(t=tok('ra', r['id']), kind=r['kind'], title=r.get('title') or '', html=ra_html(r['text'])))
    elif r['visibility'] == 'gated':
        gate = ('npc:' + r['npcs'][0]) if r.get('npcs') else ('ra:' + r['id'])
        pl_ra.append(dict(t=tok('ra', r['id']), kind=r['kind'], title=r.get('title') or 'Reveal', html=ra_html(r['text']), gate=gate))
pl_teasers = []
for a in ADV:
    F = lambda f: field_vis(a, f) == 'player'; where = 'adventures.json#' + a['id']
    pl_teasers.append(dict(t=tok('adv', a['id']), gate='tease:' + a['id'], title=safe(a['title'], where + '.title') if F('title') else None,
                           hook=safe(a.get('hook'), where + '.hook') if F('hook') else None, tone=safe(a.get('tone'), where + '.tone') if F('tone') else None,
                           levels=('%s–%s' % (a['levels']['min'], a['levels']['max'])) if F('levels') and a.get('levels') else None,
                           region=loc_public_name(a.get('region')) if F('region') else None))
pl_teasers = [t for t in pl_teasers if t['title']]

# players.md -> primer sections; images become face tokens resolved by the app (player-safe portrait rules apply)
PATH2NPC = {}
for r in npcs:
    for k, v in (NPC[r['id']].get('portraits') or {}).items():
        if isinstance(v, dict) and v.get('path'): PATH2NPC[v['path']] = r['id']
TOKBY = {p['id']: p['t'] for p in pl_npcs}; PRIMER_ART = []
def primer_img(alt, path):
    nid = PATH2NPC.get(path.replace('../', ''))
    if nid and nid in TOKBY: return '\n\n[[face:%s]]\n\n' % TOKBY[nid]
    pth = path.replace('../', '')
    if pth.startswith('maps/') and pth.endswith('-painted.jpg') and safe(alt, 'players.md image alt') and art(pth):
        t_ = tok('pimg', pth); PRIMER_ART.append(dict(t=t_, img=art(pth), alt=alt)); return '\n\n[[art:%s]]\n\n' % t_
    warn('players.md image not mapped to an NPC: ' + path); return ''
lead, psecs = vesp_md.split_h2(PLAYERS_MD, keep_images=primer_img)
for s in psecs:
    if spoils(s['html']): sys.exit('players.md section %s contains spoiler terms %s' % (s['title'], spoils(s['html'])))
handbook = dict(title='Vesperine & the Velvet Marches — Player Primer', kicker='Player Primer', lead=plain(re.sub(r'<[^>]+>', ' ', lead)),
                facesTitle='Faces You May Meet', sections=[dict(id='p' + str(i + 1), title=s['title'], audience='player', html=s['html']) for i, s in enumerate(psecs)])
# p['id'] stays in the data (state lookups) but is never written into the player window DOM

# ---------- DM-side structures ----------
def paint(l):
    pi = l.get('painted_image')
    return dict(key=art(pi['path']), vis=pi.get('visibility', 'dm_only') if entry_vis(l) == 'player' else 'dm_only') if pi and pi.get('path') else None
def loc_name(i): return (LOC.get(i) or {}).get('name', i)
def npc_name(i): return (NPC.get(i) or {}).get('name', i)
locations = [dict(id=l['id'], name=l['name'], type=l['type'], part=l.get('part'), parent=l.get('parent'), entry=entry_vis(l), publicDescription=l.get('public_description'),
                  dmNotes=l.get('dm_notes'), npcs=l.get('npcs') or [], clues=l.get('clues') or [], adventures=l.get('adventures') or [], map=l.get('map'), painted=paint(l), keyedMap=art((MAPS.get(l.get('map')) or {}).get('image')) if l.get('map') else None,
                  travel=l.get('travel_from_vesperine'), sourceSection=l.get('source_section'), notes=l.get('notes'), text=l.get('public_description') or '') for l in LOCS]
factions = [dict(id=f['id'], name=f['name'], kind=f.get('kind'), vis=f.get('visibility'), summary=f.get('summary'), members=[n['id'] for n in NP if n.get('faction') == f['id']]) for f in camp['factions']]
maps = [dict(id=m['id'], title=m['title'], kind=m.get('kind'), vis=m.get('visibility'), ascii=m.get('ascii') or '', source=m.get('source'),
             image=art(m.get('image')), painted=art((m.get('painted_image') or {}).get('path') if isinstance(m.get('painted_image'), dict) else m.get('painted_image')),
             paintedVis=('player' if any((paint(l) or {}).get('vis') == 'player' for l in LOCS if (l.get('painted_image') or {}).get('map') == m['id']) else 'dm_only'),
             locations=[l['id'] for l in LOCS if l.get('map') == m['id']]) for m in MAPS.values()]
def enc_foes(e):
    foes = []
    for c in e['creatures']:
        kind, ref = c['ref'].split(':', 1)
        if kind == 'srd': foes.append(dict(count=c['count'], stat=srd_app_name(ref), label=srd_app_name(ref)))
        elif kind == 'bestiary': foes.append(dict(count=c['count'], stat=BEAST[ref]['name'], label=BEAST[ref]['name']))
        else:
            n = next(x for x in npcs if x['id'] == ref)
            foes.append(dict(count=c['count'], stat=n['stat'].get('statName'), label=n['name'], note=n['stat'].get('notes') or ''))
    return foes
adventures = []
for a in ADV:
    a2 = json.loads(json.dumps(a)); vis = a2.pop('visibility')
    for e in a2.get('encounters', []): e['foes'] = enc_foes(e)
    for rd in a2.get('riddles', []):
        if rd.get('read_aloud_id') in RAID: rd['promptHtml'] = ra_html(RAID[rd['read_aloud_id']]['text'])
    if a2.get('pitch_read_aloud_id') in RAID: a2['pitchHtml'] = ra_html(RAID[a2['pitch_read_aloud_id']]['text'])
    a2['regionName'] = loc_name(a2.get('region')) if a2.get('region') else ''
    a2['vis'] = vis; adventures.append(a2)
mystery = json.loads(json.dumps(MY))
for rd in mystery['riddles']:
    if rd.get('read_aloud_id') in RAID: rd['promptHtml'] = ra_html(RAID[rd['read_aloud_id']]['text'])
solo, missing, used = vesp_md.solo_book(SOLO, art)
if missing: sys.exit('solo book: unresolved turn-to anchors %s' % missing)
for sa in solo['adventures']:
    sa['exportId'] = next((a['id'] for a in ADV if a.get('kind', '').startswith('solo') and a.get('number') == sa['num']), None)
dm_lead, dm_secs = vesp_md.split_h2(DM_MD)
dmguide = [dict(id='dm' + str(i + 1), title=s['title'], html=s['html']) for i, s in enumerate(dm_secs)]
WG = open(os.path.join(SRC, 'world-guide.md'), encoding='utf-8').read()
m_ = re.search(r'^### Seats in the Glass\n(.*?)(?=^#{1,3} )', WG, re.M | re.S)
if m_: dmguide.append(dict(id='dm-seats', title='Seats in the Glass (rules)', html='<p class="small muted">From the world guide, Part 2 (not in dm.md).</p>' + md2html(m_.group(1))))
else: warn('world-guide.md: "Seats in the Glass" section not found')

def budget_table():
    rows = ''.join('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (lv, *[format(x, ',') for x in v]) for lv, v in camp['xp_budget_per_character'].items())
    return '<div class="tablewrap"><table><thead><tr><th>Level</th><th>Low</th><th>Moderate</th><th>High</th></tr></thead><tbody>' + rows + '</tbody></table></div><p>' + camp.get('xp_budget_note', '') + '</p>'
def parts_html(parts):
    return '<ul>' + ''.join('<li><b>%s</b>%s</li>' % (p['title'], ('<ul>' + ''.join('<li>%s</li>' % c['title'] for c in p.get('chapters', [])) + '</ul>') if p.get('chapters') else '') for p in parts) + '</ul>'
from html import escape as H
overview = [
    dict(title='Content compass', audience='player', html='<p>' + H(camp['content_compass']) + '</p><ul>' + ''.join('<li>%s</li>' % H(x) for x in camp['table_rules']) + '</ul>'),
    dict(title='Rules: D&D 2024 · SRD 5.2.1', audience='dm', html='<p>' + H(camp['rules_baseline']) + '</p><h4>2024 XP budget per character</h4>' + budget_table()),
    dict(title='Book structure: world guide', audience='dm', html=parts_html(camp['parts'])),
    dict(title='Book structure: ' + camp['companion_book']['title'], audience='dm', html=parts_html(camp['companion_book']['parts'])),
]
srdRefs = {'vampire spawn': 'Vampire Spawn', 'thugs': 'Tough', 'thug': 'Tough', 'tough': 'Tough', 'spy': 'Spy', 'veteran': 'Warrior Veteran', 'warrior veteran': 'Warrior Veteran', 'bandit captain': 'Bandit Captain', 'ogre': 'Ogre', 'ogres': 'Ogre',
           'mage': 'Mage', 'bandits': 'Bandit', 'bandit': 'Bandit', 'green hag': 'Green Hag', 'swarm of insects': 'Swarm of Insects', 'giant wasp': 'Giant Wasp', 'giant wasps': 'Giant Wasp', 'gladiator': 'Gladiator',
           'vampire': 'Vampire', 'animated armor': 'Animated Armor', 'shambling mound': 'Shambling Mound', 'kobolds': 'Kobold Warrior', 'kobold warrior': 'Kobold Warrior', 'young copper dragon': 'Young Copper Dragon',
           'sprite': 'Sprite', 'dryad': 'Dryad', 'satyr': 'Satyr', 'knight': 'Knight', 'noble': 'Noble', "will-o'-wisp": 'Will-o’-Wisp', "will-o'-wisps": 'Will-o’-Wisp', 'giant bat': 'Giant Bat', 'scout': 'Scout'}
CO = camp['counts']
doc = dict(app='DM Atlas', format='dm-atlas-campaign', version=1, id=CID, previousIds=OLD_IDS, generated=camp.get('generated'), structured=True,
           title=camp['title'], shortTitle=camp['title'], subtitle='%s · World: %s · Gateway: %s · Main adventure: %s' % (camp['subtitle'], camp['world'], camp['gateway'], camp['central_mystery']),
           system='D&D 2024 rules (5.5e) · SRD 5.2.1', author=camp.get('author'),
           facts={'World': camp['world'], 'Gateway': camp['gateway'], 'Main adventure': camp['central_mystery'], 'Levels': '%d–%d (solo entries 1–3)' % (camp['levels']['min'], camp['levels']['max']),
                  'Rules': 'D&D 2024 (5.5e) · SRD 5.2.1', 'NPCs': str(len(npcs)), 'Locations': str(len(locations)), 'Clues': '%d (%d Keystones)' % (len(MY['clues']), MY['keystone_summary']['count']), 'Bestiary': '%d stat blocks' % len(bestiary)},
           summary=MY['victim']['public'],
           source=dict(note='Vesperine & the Velvet Marches, its solo companion Through the Oathless Glass and the Carnelia Bestiary were written for Riley Renwick by DnD Bot. Imported from DnD Bot\'s DM Atlas export (generated %s). Dungeons & Dragons is a trademark of Wizards of the Coast; this campaign is unofficial.' % camp.get('generated'),
                       validator=dict(errors=validator['errors'], warnings=validator['warnings'])),
           dmWarning='🔒 For the Dungeon Master only. The player window shows only player-safe material plus whatever you reveal (disguised fey stay in their mortal guise until you reveal them).',
           tabs=['overview', 'mystery', 'adventures', 'npcs', 'locations', 'factions', 'maps', 'bestiary', 'readaloud', 'solo', 'dmguide', 'gaps', 'handbook'],
           overview=overview, sessions=[], npcs=npcs, locations=locations, factions=factions, maps=maps, mystery=mystery, adventures=adventures,
           readAloud=read_aloud, bestiary=bestiary, srdCited=srd_cited,
           bestiaryInfo=dict(title=cols['title'], subtitle=cols['subtitle'], edition=cols['edition'], collections=[dict(num=c['num'], name=c['name'], region=c['region'], color=c['color'], intro=c['intro'].strip()) for c in cols['collections']]),
           items=[], tables=[], secrets=[], gaps=camp['known_gaps'], dmguide=dmguide, handbook=handbook, solo=solo, srdRefs=srdRefs,
           objects=objects, player=dict(npcs=pl_npcs, objects=pl_objects, primerArt=PRIMER_ART, locations=pl_locs, factions=pl_factions, maps=pl_maps, timeline=pl_timeline, readAloud=pl_ra, teasers=pl_teasers),
           art=dict(pack='campaigns/%s.dmatlas-art.json' % CID, folder='art/%s/' % CID, probe=next(p['img'] for p in pl_npcs if p['img'])),
           counts=dict(npcs=len(npcs), locations=len(locations), factions=len(factions), maps=len(maps), adventures=len(adventures), encounters=sum(len(a.get('encounters', [])) for a in adventures),
                       clues=len(MY['clues']), monsters=len(bestiary), srdCited=len(srd_cited), readAloud=len(read_aloud), gaps=len(camp['known_gaps']), soloEntries=sum(len(a['entries']) for a in solo['adventures'])),
           partyHint='Solo or 3–5 players, levels 3–8 (solo entry adventures: levels 1–3)')
for k, v in CO.items():
    if k in ('npcs', 'locations', 'adventures', 'monsters', 'clues') and doc['counts'].get(k) != v: sys.exit('count mismatch %s: %s vs export %s' % (k, doc['counts'].get(k), v))

# true names of disguised fey must not appear in any art key / player projection
DISG = [n for n in npcs if n['disguised']]
FORBID = set(TERMS)
STOP = {'lady', 'sir', 'the', 'of', 'smiling', 'madame', 'master', 'brother', 'notary', 'prince', 'queen', 'last', 'kiss'}
for n in npcs:
    pub = ' '.join([n['displayName']] + [a['name'] for a in n['aliases'] if a['visibility'] == 'player']).lower()
    if n['disguised']:
        FORBID |= {n['name'], n['id']} | {w for w in re.findall(r"[A-Za-z][\w'-]+", n['name']) if w.lower() not in STOP and w.lower() not in pub}
    FORBID |= {a['name'] for a in n['aliases'] if a['visibility'] != 'player'}
keys_blob = json.dumps(list(ART.values()))
for t in FORBID:
    if t.lower() in keys_blob.lower(): sys.exit('art key leaks ' + t)
keep = []
for t_ in doc['player']['teasers']:
    hit = [t for t in FORBID if re.search(r'\b' + re.escape(t) + r'\b', json.dumps([t_['title'], t_['hook'], t_['tone']], ensure_ascii=False), re.I)]
    if hit: warn('adventure teaser %r cannot be teased (names %s); left DM-only' % (t_['title'], hit))
    else: keep.append(t_)
doc['player']['teasers'] = pl_teasers = keep
pl_blob = json.dumps({k: v for k, v in doc['player'].items()}, ensure_ascii=False)
def strip_gated(o):
    if isinstance(o, dict): return {k: strip_gated(v) for k, v in o.items() if k not in ('rev', 'gate', 'spicy', 'id') and not (k == 'html' and o.get('gate'))}
    if isinstance(o, list): return [strip_gated(x) for x in o if not (isinstance(x, dict) and x.get('gate') and 'kind' in x)]
    return o
ungated = json.dumps(strip_gated(doc['player']), ensure_ascii=False) + json.dumps(handbook, ensure_ascii=False)
leaks = [t for t in FORBID if re.search(r'\b' + re.escape(t) + r'\b', ungated, re.I)]
if leaks: sys.exit('player-safe projection leaks: %s' % leaks)

# ---------- 3. write campaign ----------
js = json.dumps(doc, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(ROOT, 'src/data/vesperine.js'), 'w', encoding='utf-8').write('/* generated by tools/import_vesperine.py — do not edit */\n(window.DM_BUNDLED_CAMPAIGNS = window.DM_BUNDLED_CAMPAIGNS || []).push(' + js + ');\n')
open(os.path.join(ROOT, 'campaigns', CID + '.dmatlas.json'), 'w', encoding='utf-8').write(json.dumps(doc, ensure_ascii=False, indent=1))
for old in OLD_IDS:
    for f in (old + '.dmatlas.json', old + '.dmatlas-art.json'):
        p = os.path.join(ROOT, 'campaigns', f)
        if os.path.exists(p): os.remove(p); print('removed old', f)
    if os.path.isdir(os.path.join(ROOT, 'art', old)): shutil.rmtree(os.path.join(ROOT, 'art', old)); print('removed old art/' + old)

# ---------- 4. art pack + folder ----------
if not args.no_art:
    from PIL import Image
    folder = os.path.join(ROOT, 'art', CID); want = set()
    images = {}; total = 0
    for path, key in sorted(ART.items(), key=lambda x: x[1]):
        width, q = (480, 70) if path.startswith('bestiary/') else (1280, 78) if path.startswith('maps/') else (640, 74)
        im = Image.open(os.path.join(SRC, path)).convert('RGB'); width = min(width, im.width)
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, 'WEBP', quality=q, method=6); b = buf.getvalue()
        images[key] = 'data:image/webp;base64,' + base64.b64encode(b).decode(); total += len(b)
        p = os.path.join(folder, key + '.webp'); want.add(os.path.abspath(p)); os.makedirs(os.path.dirname(p), exist_ok=True)
        if not os.path.exists(p) or open(p, 'rb').read() != b: open(p, 'wb').write(b)
    for dp, dn, fn in os.walk(folder):
        for f in fn:
            if os.path.abspath(os.path.join(dp, f)) not in want: os.remove(os.path.join(dp, f)); print('removed stale art', f)
    pack = dict(app='DM Atlas', format='dm-atlas-art', version=1, campaignId=CID, generated=camp.get('generated'), title=camp['title'] + ' — art pack',
                note='Downscaled WebP copies (portraits/solo art 640px wide, monster art 480px, maps up to 1280px) with opaque file names. Import in DM Atlas: Campaigns → Import art pack. Stored in this browser (IndexedDB); re-importing replaces the previous images.',
                count=len(images), images=images)
    pack['sha1'] = hashlib.sha1(json.dumps(images, sort_keys=True).encode()).hexdigest()
    open(os.path.join(ROOT, 'campaigns', CID + '.dmatlas-art.json'), 'w').write(json.dumps(pack, separators=(',', ':')))
    print('art: %d images, %.1f MB webp, pack %.1f MB' % (len(images), total / 1e6, os.path.getsize(os.path.join(ROOT, 'campaigns', CID + '.dmatlas-art.json')) / 1e6))

# ---------- 5. app ----------
if not args.no_app_build:
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'build.py')], capture_output=True, text=True); print(r.stdout.strip())
    if r.returncode: print(r.stderr); sys.exit('app build failed')
print('campaign %s: %s' % (CID, json.dumps(doc['counts'])))
print('player projection: %d NPCs (%d with a reveal), %d locations, %d factions, %d maps, %d timeline events, %d read-alouds (%d gated), %d adventure teasers'
      % (len(pl_npcs), sum(1 for p in pl_npcs if p['gate']), len(pl_locs), len(pl_factions), len(pl_maps), len(pl_timeline), len(pl_ra), sum(1 for r in pl_ra if r.get('gate')), len(pl_teasers)))
print('validator: %s error(s), %s warning(s)' % (validator['errors'], validator['warnings']))
for w in WARN: print('WARN ' + w)
print('campaign doc %.0f KB' % (len(js) / 1024))
json.dump(sorted(FORBID), open(os.path.join(ROOT, 'test', 'vesperine_forbidden.json'), 'w'), indent=0)   # used by the leak tests
