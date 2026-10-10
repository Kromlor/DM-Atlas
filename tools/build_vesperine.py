#!/usr/bin/env python3
"""Build the bundled 'Vesperine & the Velvet Marches' campaign for DM Atlas from DnD Bot's source folder.
Sources (canonical): world-guide.md, solo-entry-adventures.md, bestiary/data/*.yaml (+ its rendering for derived numbers).
Outputs: src/data/vesperine.js (bundled), campaigns/vesperine-velvet-marches.dmatlas.json (importable copy).
Needs: python3-markdown, bs4, PyYAML.  Art pack: tools/build_vesperine_art.py."""
import re, json, os, sys, subprocess
import markdown
from bs4 import BeautifulSoup
sys.path.insert(0, os.path.dirname(__file__))
import vesp_bestiary
SRC = '/workspace/dnd-world'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CID = 'vesperine-velvet-marches'
WG = open(SRC + '/world-guide.md', encoding='utf-8').read()
SOLO = open(SRC + '/solo-entry-adventures.md', encoding='utf-8').read()

# ---------- markdown helpers ----------
def strip_front(md): return re.sub(r'^---\n.*?\n---\n', '', md, flags=re.S)
def md2html(md, shift=0, solo=False):
    md = re.sub(r'!\[[^\]]*\]\([^)]*\)(\{[^}]*\})?', '', md)          # images are shown by the app from the art pack
    md = re.sub(r'\{width=[^}]*\}', '', md)
    h = markdown.markdown(md, extensions=['tables', 'fenced_code', 'sane_lists', 'attr_list'])
    soup = BeautifulSoup(h, 'html.parser')
    for bq in soup.find_all('blockquote'):
        t = bq.get_text(' ', strip=True)
        first = bq.find(['p'])
        fhtml = str(first) if first else ''
        if re.match(r'^Read-aloud', t, re.I) or (first and first.find('em') and first.contents and getattr(first.contents[0], 'name', None) == 'em'):
            bq['class'] = 'readaloud'
        elif re.match(r'^(Running|Time cost|Table rule|Pitch)', t): bq['class'] = 'callout'
        else: bq['class'] = 'readaloud'
    for pre in soup.find_all('pre'): pre['class'] = 'asciimap'
    for tb in soup.find_all('table'):
        w = soup.new_tag('div'); w['class'] = 'tablewrap'; tb.wrap(w)
    if shift:
        for lv in (4, 3, 2, 1):
            for x in soup.find_all('h%d' % lv): x.name = 'h%d' % min(6, lv + shift)
    for a in soup.find_all('a'):
        if a.get('href', '').startswith('#'): a['class'] = 'turnto'
    if solo:
        for li in soup.find_all('li'):
            if re.match(r'^\s*Answer\b', li.get_text()): li['class'] = 'riddle-ans'
    return str(soup).strip()
def plain(s):
    s = re.sub(r'\*\*(.+?)\*\*', r'\1', s); s = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'\1', s)
    s = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', s)
    return re.sub(r'\s+', ' ', s).strip()

# ---------- heading tree ----------
def tree(md):
    md = strip_front(md); out = []; cur = None
    in_code = False
    for line in md.split('\n'):
        if line.startswith('```'): in_code = not in_code
        m = None if in_code else re.match(r'^(#{1,3}) (.+?)\s*(\{#([\w-]+)\})?\s*$', line)
        if m:
            cur = dict(level=len(m.group(1)), title=m.group(2).strip(), anchor=m.group(4), body=[]); out.append(cur)
        elif cur is not None: cur['body'].append(line)
        else: out.append(dict(level=0, title='', anchor=None, body=[line])); cur = out[-1]
    for n in out: n['body'] = '\n'.join(n['body']).strip()
    return out
T = tree(WG)
def find(title_rx, level=None, start=0):
    for i in range(start, len(T)):
        if re.search(title_rx, T[i]['title']) and (level is None or T[i]['level'] == level): return i
    raise KeyError(title_rx)
def subtree(i):
    """md of node i (without its heading) plus all deeper headings below it."""
    lv = T[i]['level']; parts = [T[i]['body']]; j = i + 1
    while j < len(T) and T[j]['level'] > lv:
        parts.append('#' * T[j]['level'] + ' ' + T[j]['title'] + '\n\n' + T[j]['body']); j += 1
    return '\n\n'.join(parts).strip()
def children(i):
    lv = T[i]['level']; j = i + 1; out = []
    while j < len(T) and T[j]['level'] > lv:
        if T[j]['level'] == lv + 1: out.append(j)
        j += 1
    return out
def ttl(s): return plain(s)
def clean_hr(md): return re.sub(r'^\s*---\s*$', '', md, flags=re.M).strip()

# ---------- NPC field parsing ----------
def fields(md):
    out = []
    for m in re.finditer(r'^- \*\*(.+?):\*\*\s*(.*?)(?=^- \*\*|\Z)', md, re.S | re.M):
        out.append((m.group(1).strip(), m.group(2).strip()))
    return out
def sentences(text):
    return [s for s in re.split(r'(?<=[.!?])\s+(?=[A-Z"“(])', text.strip()) if s]
BAN = re.compile(r'secret|stat block|\bHP\b|Legendary|\bCR \d|\bDC \d|use the|uses the|\*[a-z]|feature of this world|Insight|Keystone|Persuasion', re.I)
def public_of(text, extra_ban=None):
    keep = [s for s in sentences(plain(text)) if not BAN.search(s) and not (extra_ban and re.search(extra_ban, s))]
    return ' '.join(keep)

NPCS = {}
def npc(slug, name, **kw):
    n = NPCS.setdefault(slug, dict(slug=slug, name=name, audience='dm', blocks=[], portrait=None, group='', role=''))
    for k, v in kw.items():
        if k == 'blocks': n['blocks'] += v
        elif v not in (None, ''): n[k] = v
    return n
PORTRAITS = set(os.path.splitext(f)[0] for f in os.listdir(SRC + '/portraits') if f.endswith('.png'))
GUISES = set(os.path.splitext(f)[0] for f in os.listdir(SRC + '/portraits/human-guise'))
SPICY = set(os.path.splitext(f)[0] for f in os.listdir(SRC + '/portraits/spicy'))
DM_LABELS = re.compile(r'secret|agenda|flirt|seduction|alibi|looks guilty|under pressure|stat|where (he|she) leads|what (he|she) wants|how (he|she) appears|tells|trigger|mirror reflection', re.I)
def blocks_from(fl, source):
    return [dict(label=k, html=md2html(v), dm=bool(DM_LABELS.search(k)), secret=bool(re.search(r'secret', k, re.I)), source=source) for k, v in fl]

# Gateway characters (Part 2)
gw_slugs = {'Lysander': 'lysander', 'Sabine': 'sabine-velour', 'Caelum': 'prince-caelum', 'Marisol': 'marisol-tidewhisper', 'Valentin': 'valentin-dusk'}
gi = find(r'^Gateway Characters$', 2)
for j in children(gi):
    m = re.match(r'\d+\. (.+?) — \*(.+)\*', T[j]['title']); name, epi = m.group(1), m.group(2)
    slug = next(v for k, v in gw_slugs.items() if k in name)
    fl = fields(T[j]['body']); d = dict(fl)
    npc(slug, name, role='Gateway character · ' + epi, group='Gateway characters', blocks=blocks_from(fl, 'Part 2 — Gateway Characters'),
        public=public_of(d['Appearance']) + ' ' + public_of(d['Personality']))
# Suspects (Part 4)
sus = {'Seraphine': 'seraphine-lark', 'Celestine': 'celestine-morrow', 'Dorian': 'dorian-hale', 'Ezren': 'ezren-vos', 'Varo': 'varo-kestrel', 'Thessaly': 'thessaly-rook'}
si = find(r'^The Suspects$', 2)
for j in children(si):
    m = re.match(r'\d+\. (.+?) — (.+)', T[j]['title']); name, role = m.group(1), m.group(2)
    slug = next(v for k, v in sus.items() if k in name)
    fl = fields(T[j]['body']); d = dict(fl)
    npc(slug, name, role='Suspect · ' + re.sub(r'\s*\(The Killer\)', '', role), dmRole=('Suspect · ' + role) if 'Killer' in role else '', group='Suspects (The Black Kiss)',
        blocks=blocks_from(fl, 'Part 4 — The Suspects'), public=public_of(d['Appearance']) + ' ' + public_of(d['Personality'], r'Underneath'))
# Victim + Ottoline
vi = find(r'^The Victim', 2)
vb = T[vi]['body']
npc('aurelian-sable', 'Lord Aurelian Sable', role='The victim · Oathwarden of Vesperine', group='The Black Kiss',
    blocks=[dict(label='The victim', html=md2html(vb), dm=False, secret=False, source='Part 4')], public=plain(vb.split('\n\n')[0]))
wi = find(r"^The Investigator's Warrant", 2)
npc('dame-ottoline-graves', 'Dame Ottoline Graves', role='Opera Council spokesperson', group='The Black Kiss',
    blocks=[dict(label='The Investigator\'s Warrant', html=md2html(T[wi]['body']), dm=False, secret=False, source='Part 4')],
    public='The Opera Council\'s spokesperson: an elderly, terrifyingly polite patron with a lorgnette.')
# Side adventure key NPCs (Part 5)
SIDE_SLUG = {'Big Mother Hulga Tenderbone': 'hulga-tenderbone', 'Queen Ilysse of the Hush': 'queen-ilysse', 'Mother-of-Pearl Nerissa': 'nerissa',
             'Captain Morven "Saltlick" Kray': 'morven-kray', 'Countess Morwenna Dusk': 'countess-morwenna-dusk', 'Lucan Vey': 'lucan-vey', 'Vexirra': 'vexirra'}
for k in range(1, 6):
    ai = find(r'^Side Adventure %d — ' % k, 2)
    advt = plain(re.sub(r'^Side Adventure \d — ', '', T[ai]['title']))
    ki = next(j for j in children(ai) if T[j]['title'] == 'Key NPCs')
    for m in re.finditer(r'^- \*\*(.+?)\*\*\s*—\s*(.+)$', T[ki]['body'], re.M):
        name = m.group(1).strip(); text = m.group(2).strip()
        slug = SIDE_SLUG.get(name) or re.sub(r'[^a-z0-9]+', '-', plain(name).lower()).strip('-')
        npc(slug, plain(name), role=advt, group='Side Adventure %d · %s' % (k, advt),
            blocks=[dict(label='In ' + advt, html=md2html(text), dm=False, secret=False, source='Part 5 — Side Adventure %d' % k)],
            public=NPCS.get(slug, {}).get('public') or public_of(re.sub(r', secretly .*?(?=\.)', '', re.sub(r'\s*\(CR \d+\)', '', text)), r'\bUse the\b|\bstat\b|polymorph'))
# Fey NPCs (Part 6)
fey = {'Pipwhistle': 'pipwhistle-dewlace', 'Ondine': 'ondine-mirewillow', 'Rillo': 'rillo-fennamint', 'Nocturne': 'nocturne-vesh', 'Merrow': 'merrow-ashgrave', 'Amaranth': 'amaranth'}
fi = find(r'^The Fey NPCs$', 2)
for j in children(fi):
    m = re.match(r'\d+\. (.+?) — \*(.+?)\* \((.+)\)', T[j]['title']); name, epi, kind = m.group(1), m.group(2), m.group(3)
    slug = next(v for k, v in fey.items() if k in name)
    fl = fields(T[j]['body']); d = dict(fl)
    npc(slug, name, role='Fair Folk · ' + epi + ' (' + kind + ')', group='The Fair Folk', blocks=blocks_from(fl, 'Part 6 — The Fey NPCs'),
        trueText=public_of(d['Appearance'].replace(' that holds a stolen name', ''), r'art prompt|Unravelling clock') + ' ' + public_of(d['Personality']))
# Glamours & Reveals: the eight guises
qi = find(r'^The Eight Guises', 3)
GUISE_ROWS = {}
for row in T[qi]['body'].split('\n'):
    cells = [c.strip() for c in row.strip().strip('|').split('|')]
    if len(cells) == 4 and cells[3].isdigit(): GUISE_ROWS[plain(cells[0])] = dict(alias=plain(cells[1]), cover=plain(cells[2]), dc=int(cells[3]))
guise_slug = {'Lady Nocturne Vesh': 'nocturne-vesh', 'Prince Caelum of the Dusk': 'prince-caelum', 'Ondine Mirewillow': 'ondine-mirewillow', 'Rillo Fennamint': 'rillo-fennamint',
              'Pipwhistle Dewlace': 'pipwhistle-dewlace', 'Sir Merrow Ashgrave': 'merrow-ashgrave', 'Amaranth': 'amaranth', 'Queen Ilysse of the Hush': 'queen-ilysse'}
gri = find(r'^Glamours & Reveals', 2)
for j in children(gri):
    m = re.match(r'^(.+?) as \*\*(.+)\*\*$', T[j]['title'])
    if not m: continue
    true, alias = m.group(1), m.group(2); slug = guise_slug[true]; row = GUISE_ROWS[true]
    body = clean_hr(T[j]['body'])
    ra = re.search(r'^> \*\*Read-aloud: (.+?)\.\*\*\s*(.+)$', body, re.M)
    fl = fields(body.split('\n> ')[0])
    n = npc(slug, true, blocks=[dict(label='Glamour & reveal: as ' + alias, html=md2html(body), dm=True, secret=True, source='Part 6 — Glamours & Reveals')])
    n['guise'] = dict(alias=alias, cover=row['cover'], dc=row['dc'], revealTitle=ra.group(1) if ra else '', revealHTML=md2html('> ' + ra.group(2)) if ra else '')
# portraits / public names
for slug, n in NPCS.items():
    if slug in PORTRAITS: n['portrait'] = slug
    n['hasGuise'] = slug in GUISES; n['hasSpicy'] = slug in SPICY
    if 'guise' in n:
        n['publicName'] = n['guise']['alias']; n['publicText'] = n['guise']['cover'] + '.'
        n['revealedName'] = n['name']; n['revealedText'] = (n.get('trueText') or n.get('public') or '').strip()
    else:
        n['publicName'] = n['name']; n['publicText'] = (n.get('public') or '').strip()
# Ilysse true text from her side-adventure description
if not NPCS['queen-ilysse'].get('trueText'):
    NPCS['queen-ilysse']['revealedText'] = public_of(re.search(r'Queen Ilysse of the Hush\*\* — (.+)', WG).group(1))
# Prince Caelum true text from gateway appearance
NPCS['prince-caelum']['revealedText'] = NPCS['prince-caelum']['public']
assert set(PORTRAITS) <= set(NPCS), set(PORTRAITS) - set(NPCS)
assert GUISES == {k for k, v in NPCS.items() if 'guise' in v}, GUISES

# ---------- locations ----------
gz = find(r'^Location Gazetteer$', 2)
PLAYER_CUT = ['A secret door behind the mirror wall connects to the **Dressing Gallery**, where Madame Rook fits masks.', "The mirror wall's great central pane is the **Oathless Glass** (Part 2).",
              'His study holds a locked writing desk (riddle-lock), a portrait gallery with one portrait painted over, and his bedchamber, where a hidden cache holds his private journal.',
              'The back workroom holds glue pots, gold leaf — and, hidden in a hatbox, a wedding mask made for a bride forty years ago.', 'His order ledger is written in scent-code (riddle).',
              'The **Vault of Broken Vows** below stores torn-out, annulled pages — and one page that was deliberately removed decades ago.',
              "Captain Hale's office has a locked strongbox containing a Syndicate purse.", ' — which is empty']
locations, locations_player = [], []
for m in re.finditer(r'^\*\*(.+?)\.\*\* (.+)$', T[gz]['body'], re.M):
    name, text = m.group(1), m.group(2)
    locations.append(dict(name=name, html=md2html(text), audience='dm'))
    pt = text
    for cut in PLAYER_CUT: pt = pt.replace(cut, '')
    locations_player.append(dict(name=name, text=plain(pt)))
for k, title in [(r'^The Hub City', 'Districts of Vesperine')]:
    i = find(k, 2)
    for m in re.finditer(r'^\d+\. \*\*(.+?)\*\* — (.+)$', T[i]['body'], re.M):
        locations.append(dict(name=m.group(1), html=md2html(m.group(2)), audience='dm', kind='District of Vesperine'))
        locations_player.append(dict(name=m.group(1), text=plain(m.group(2))))

# ---------- tables ----------
def md_tables(md):
    out = []; cur = []
    for line in md.split('\n') + ['']:
        if line.strip().startswith('|'): cur.append(line)
        elif cur: out.append(cur); cur = []
    res = []
    for t in out:
        rows = [[plain(c) for c in r.strip().strip('|').split('|')] for r in t if not re.match(r'^\|[\s|:-]+\|$', r.strip())]
        res.append(rows)
    return res
def table_from(title_rx, level, title, note='', idx=0, audience='dm'):
    i = find(title_rx, level); rows = md_tables(T[i]['body'])[idx]
    return dict(title=title, note=note, columns=rows[0], rows=rows[1:], audience=audience)
tables = [
    table_from(r'^Rules for Travelers', 2, 'Reflection Drift (d6)', 'At each dawn, each traveler rolls a d6; on a 1, roll here.'),
    table_from(r'^Which Gateway Character', 2, 'Which Gateway Character? (d8)', 'Solo: roll once. Group: roll once for the party, or each player rolls for a split-party opening.'),
    table_from(r'^The Clock: Seven Nights', 2, 'The Unravelling — Seven Nights', 'Each night without an Oathwarden, roll on or choose from this table.'),
    table_from(r'^The Clue Trail', 2, 'The Clue Trail (Keystones ★)', 'Any three Keystone clues make a solid accusation of the killer.'),
    table_from(r'^The Eight Guises', 3, 'The Eight Guises (Quick Reference)', 'DM only: the fey hiding in human guises.'),
    table_from(r'^The Five Stages', 3, 'Enthrallment — The Five Stages'),
    table_from(r'^Counter-Charms', 3, 'Counter-Charms & Protections'),
    table_from(r'^The Fey in the Endgame', 2, 'The Fey in the Endgame'),
    table_from(r'^Fey Encounter & Temptation', 2, 'Fey Encounter & Temptation (d12)', 'Roll once per night in gardens and canals, or when travelling at dusk.'),
    table_from(r'^The Allure Track', 2, 'The Allure Track'),
    table_from(r'^The Oracle', 3, 'The Oracle (d20)', 'Decide how likely the answer is, then roll a d20.'),
    table_from(r'^Plot Twist Table', 3, 'Plot Twist (d8)'),
    dict(title='NPC Reaction (d6)', note="For when an NPC's mood isn't obvious.", columns=['d6', 'Reaction'], rows=[[a, b] for a, b in (x.split(' ', 1) for x in plain(T[find(r'^NPC Reaction', 3)]['body']).split(' · '))], audience='dm'),
    table_from(r'^Companion NPCs', 3, 'Companion NPCs (solo play)'),
    table_from(r'^Scaling for 3', 2, 'Scaling for 3–5 Players'),
    table_from(r'^The Velvet Marches: Surrounding', 2, 'The Velvet Marches — Regions'),
]
ri = find(r'^Appendix C', 1)
rum = re.findall(r'^\d+\. (.+)$', T[ri]['body'], re.M)
tables.append(dict(title='Vesperine Rumors (d8)', note='DM version, with the truth of each rumor.', columns=['d8', 'Rumor', 'Truth'],
                   rows=[[str(k + 1), plain(re.sub(r'\s*\*\(.+?\)\*\s*$', '', r)), plain((re.search(r'\*\((.+?)\)\*\s*$', r) or [None, ''])[1])] for k, r in enumerate(rum)], audience='dm'))
cols, bestiary, problems = vesp_bestiary.build()
assert not problems, problems
for c in cols['collections']:
    tables.append(dict(title='Bestiary situations: %s (d6)' % c['name'], note=c['region'], columns=['d6', 'Situation'], rows=[[str(k + 1), s] for k, s in enumerate(c['situations'])], audience='dm'))

# ---------- sessions (chapters) ----------
def scenes_of(i, skip=()):
    out = []
    lead = clean_hr(T[i]['body'])
    if lead: out.append(dict(title='Introduction', html=md2html(lead, shift=1), encounters=[]))
    for j in children(i):
        if any(re.search(s, T[j]['title']) for s in skip): continue
        out.append(dict(title=ttl(T[j]['title']), html=md2html(clean_hr(subtree(j)), shift=1), encounters=[]))
    return out
sessions = []
def chapter(title, summary, scenes, part):
    sessions.append(dict(id='ch%d' % (len(sessions) + 1), number=len(sessions) + 1, title=title, summary=summary, scenes=scenes, audience='dm', part=part))
p2 = find(r'^Part 2 ', 1)
pro = scenes_of(p2, skip=[r'^Gateway Characters$'])
gwi = find(r'^Gateway Characters$', 2)
pro.insert(3, dict(title='Gateway Characters', html=md2html(T[gwi]['body'] + '\n\nThe five gateway characters (Lysander, Sabine Velour, Prince Caelum, Marisol Tidewhisper and Sir Valentin Dusk) are in the **NPCs** tab, each with a portrait, flirt angle and secret agenda.'), encounters=[]))
chapter('Prologue — Through the Oathless Glass', 'Optional opening: the party is pulled out of its own world through the Oathless Glass.', pro, 'Part 2')
p4 = find(r'^Part 4 ', 1)
bk = scenes_of(p4, skip=[r'^The Suspects$'])
sus_i = find(r'^The Suspects$', 2)
bk.insert(4, dict(title='The Suspects', html=md2html(clean_hr(T[sus_i]['body']) + '\n\n' + '\n'.join('- **%s**' % ttl(T[j]['title']) for j in children(sus_i)) + '\n\nFull suspect profiles (appearance, flirt angle, secret, alibi, what they reveal under pressure) are in the **NPCs** tab.'), encounters=[]))
chapter('The Black Kiss — The Central Mystery', 'The murder of Oathwarden Aurelian Sable at the Velvet Opera, the seven-night clock, the suspects, the clue trail and the riddles.', bk, 'Part 4')
p5 = find(r'^Part 5 ', 1)
p5lead = clean_hr(T[p5]['body'])
for k in range(1, 6):
    ai = find(r'^Side Adventure %d — ' % k, 2)
    body = T[ai]['body']
    sc = [dict(title='About this adventure', html=md2html(clean_hr(body) + ('\n\n' + p5lead if k == 1 else ''), shift=1), encounters=[])]
    for j in children(ai): sc.append(dict(title=ttl(T[j]['title']), html=md2html(clean_hr(subtree(j)), shift=1), encounters=[]))
    chapter(plain(T[ai]['title']), plain(body.split('\n')[0]), sc, 'Part 5')
p6 = find(r'^Part 6 ', 1)
fey_sc = scenes_of(p6, skip=[r'^The Fey NPCs$', r'^Glamours & Reveals'])
hgw = find(r'^How Glamours Work$', 3)
fey_sc.insert(3, dict(title='Glamours & Reveals — How Glamours Work', html=md2html(clean_hr(T[gri]['body']) + '\n\n' + clean_hr(T[hgw]['body']) + '\n\nThe eight guises, their tells and reveal triggers are in the **Secrets** tab; each disguised fey also has a **Reveal** toggle in the **NPCs** tab.'), encounters=[]))
chapter('The Fair Folk — Tempters, Tricksters & Thorns', 'The fey courts, the Enthrallment track, the Thornwake ballroom and the fey endgame.', fey_sc, 'Part 6')
for rx, title, summ in [(r'^Part 7 ', 'Branching Structure & Endings', 'The web of threads, wrong accusations, the Seventh Bell and Endings A–D.'),
                        (r'^Part 8 ', 'Running Intrigue & Seduction', 'The Allure track, the Flirt Gambit and the Fade to Black table rule.'),
                        (r'^Part 9 ', 'Solo Play & Group Scaling', 'Oracle, plot twists, companions, solo scaling and scaling for 3–5 players.')]:
    i = find(rx, 1); chapter(title, summ, scenes_of(i), rx.strip('^ '))
app_sc = []
for rx in [r'^Appendix A', r'^Appendix B', r'^Appendix C']:
    i = find(rx, 1); app_sc.append(dict(title=ttl(T[i]['title']), html=md2html(clean_hr(T[i]['body'])), encounters=[]))
chapter('Appendices — Opening Scene, Session Zero, Names & Rumors', 'Player-facing extras (also in the player guide window; the rumor truths stay here).', app_sc, 'Appendices')

# ---------- secrets ----------
secrets = []
tr = find(r'^The Truth \(GM Eyes Only\)', 2)
secrets.append(dict(title='The Truth — who killed Aurelian Sable', html=md2html(T[tr]['body'])))
secrets.append(dict(title='The Clue Trail & Red Herrings', html=md2html(T[find(r'^The Clue Trail', 2)]['body'] + '\n\n### Red Herrings\n\n' + T[find(r'^Red Herrings', 2)]['body'])))
secrets.append(dict(title='Riddle answers — The Black Kiss', html=md2html(T[find(r'^The Riddles of the Black Kiss', 2)]['body'])))
secrets.append(dict(title='Nocturne and the murder (late reveal)', html=md2html(re.search(r'(\*\*How it ties to the murder\.\*\*.+?)\n\n', WG, re.S).group(1))))
secrets.append(dict(title='Glamours & Reveals — the eight guises', html=md2html(T[qi]['body'] + '\n\n' + clean_hr(T[hgw]['body']))))
for j in children(gri):
    if ' as **' in T[j]['title']: secrets.append(dict(title='Guise: ' + plain(T[j]['title']), html=md2html(clean_hr(T[j]['body']))))
secrets.append(dict(title='Branching & Endings (Part 7)', html=md2html(clean_hr(subtree(find(r'^Part 7 ', 1))), shift=1)))

# ---------- overview ----------
compass = re.search(r'^(\*\*Content compass:\*\*.+)$', WG, re.M).group(1)
quote = re.search(r'^> (\*"In Vesperine.+)$', WG, re.M).group(1)
levels = re.search(r'^(\*\*Recommended levels:\*\*.+)$', WG, re.M).group(1)
system = re.search(r'^\*\*System:\*\* (.+)$', WG, re.M).group(1)
p1 = find(r'^Part 1 ', 1)
overview = [dict(id='compass', title='Content compass', audience='player', html=md2html('> ' + quote + '\n\n' + compass + '\n\n' + levels))]
overview.append(dict(id='rules', title='Rules: D&D 2024 (5.5e) · SRD 5.2.1', audience='dm', html=md2html(
    'The world guide\'s header says *"D&D 5e compatible"* and names SRD creatures (' + plain(system) + '). DM Atlas runs this campaign with the **2024 rules (SRD 5.2.1) only**. '
    'Creature names in the text are linked to DM Atlas\'s SRD 5.2.1 stat blocks where the names match, using the 2024 names: *thug* → **Tough**, *veteran* → **Warrior Veteran**, *kobold* → **Kobold Warrior**. '
    'There is no SRD 5.2.1 stat block for *pixie*, *winged kobold* or *giant moth*; the guide\'s own notes for those (e.g. giant moths use Giant Bat or Giant Wasp stats) still apply. '
    'The 128 creatures in the **Bestiary** tab are the Carnelia Bestiary\'s own 2024-rules stat blocks.')))
for j in children(p1): overview.append(dict(id='p1-%d' % j, title=ttl(T[j]['title']), audience='player', html=md2html(clean_hr(subtree(j)))))
for rx in [r'^Map of the Velvet Marches', r'^Map of Vesperine']:
    i = find(rx, 2); overview.append(dict(id='map-%d' % i, title=ttl(T[i]['title']), audience='player', html=md2html(T[i]['body'])))
fp = find(r'^Floor Plan', 2); overview.append(dict(id='floorplan', title=ttl(T[fp]['title']), audience='dm', html=md2html(T[fp]['body'])))

# ---------- player handbook ----------
def hsec(id, title, html): return dict(id=id, title=title, audience='player', html=html)
pull = find(r'^Read-Aloud: Pulled Through the Glass', 2)
handbook = dict(title='Vesperine — Player Guide', kicker='A D&D 2024 campaign in Carnelia', audience='player',
                lead='Everything the players may see: the content compass, the world of Carnelia, the City of Masks, maps, the opening scene, the session-zero checklist, names and rumors, and the faces you will meet.',
                sections=[hsec('compass', 'Content Compass', overview[0]['html'])]
                + [hsec('w-%d' % k, o['title'], o['html']) for k, o in enumerate(overview) if o['audience'] == 'player' and o['id'] != 'compass']
                + [hsec('pulled', 'Pulled Through the Glass (read-aloud)', md2html(re.sub(r'^\*\(Read the first.+?\)\*\n', '', T[pull]['body'], flags=re.M))),
                   hsec('opening', 'Opening Scene', md2html(T[find(r'^Appendix A', 1)]['body'])),
                   hsec('session0', 'Session Zero Checklist', md2html(T[find(r'^Appendix B', 1)]['body'])),
                   hsec('names', 'Names & Rumors', md2html(re.sub(r'\s*\*\((?:True|False)[^)]*\)\*', '', T[ri]['body'])))])
npcs_player = [dict(slug=n['slug'], name=n['publicName'], text=n['publicText'], group=n['group'], portrait=n['portrait'], guise='guise' in n,
                    revealedName=n.get('revealedName', ''), revealedText=n.get('revealedText', ''), revealTitle=n.get('guise', {}).get('revealTitle', ''),
                    revealHTML=n.get('guise', {}).get('revealHTML', ''), spicy=n['hasSpicy']) for n in NPCS.values() if n['publicText']]

# ---------- solo book ----------
ST = tree(SOLO)
def solo_book():
    adv = []; intro = []
    i = 0
    while i < len(ST):
        n = ST[i]
        m = re.match(r'^Adventure (\d) — \*(.+?)\* \((.+)\)$', n['title'])
        if n['level'] == 1 and m:
            a = dict(id=None, num=int(m.group(1)), title=m.group(2), gateway=m.group(3), sections=[], entries=[], img=None)
            im = re.search(r'!\[[^\]]*\]\(solo-img/([\w-]+)\.jpg\)', n['body']); a['img'] = 'solo/' + im.group(1) if im else None
            a['pitch'] = md2html(n['body'], solo=True)
            j = i + 1
            while j < len(ST) and ST[j]['level'] > 1:
                s = ST[j]
                if s['level'] == 3 and s['anchor']:
                    num = re.match(r'^(\d+a?)\. (.+)$', s['title'])
                    im = re.search(r'!\[([^\]]*)\]\(solo-img/([\w-]+)\.jpg\)', s['body'])
                    a['entries'].append(dict(anchor=s['anchor'], num=num.group(1), title=plain(num.group(2)), html=md2html(clean_hr(s['body']), solo=True),
                                             img=('solo/' + im.group(2)) if im else None, imgAlt=im.group(1) if im else ''))
                    a['id'] = s['anchor'].split('-')[0]
                elif s['level'] == 2:
                    t = plain(s['title']); dm = t in ('Endings', 'Rewards & Consequences')
                    a['sections'].append(dict(title=t, html=md2html(clean_hr(s['body']), shift=1, solo=True), dm=dm, after=bool(a['entries'])))
                j += 1
            adv.append(a); i = j; continue
        if n['level'] >= 1: intro.append(dict(title=plain(n['title']), html=md2html(clean_hr(n['body']), shift=1 if n['level'] == 2 else 0, solo=True), level=n['level']))
        elif n['body'].strip(): intro.append(dict(title='', html=md2html(n['body']), level=0))
        i += 1
    fm = re.search(r'^title: "(.+?)"\nsubtitle: "(.+?)"', SOLO, re.M)
    return dict(title=fm.group(1), subtitle=fm.group(2).replace('D&D 5e', 'D&D 2024 rules'), intro=intro, adventures=adv,
                note='Written as "D&D 5e" gamebooks; DM Atlas runs them with the 2024 rules (SRD 5.2.1). Endings and riddle answers are DM-only when you run this for a group (use Group table mode).')
solo = solo_book()
anchors = {e['anchor'] for a in solo['adventures'] for e in a['entries']}
missing = sorted(set(re.findall(r'\]\(#([\w-]+)\)', SOLO)) - anchors)
assert not missing, missing

# ---------- SRD 5.2.1 references (2024 names) ----------
srdRefs = {'vampire spawn': 'Vampire Spawn', 'thugs': 'Tough', 'thug': 'Tough', 'spy': 'Spy', 'veteran': 'Warrior Veteran', 'bandit captain': 'Bandit Captain', 'ogre': 'Ogre', 'ogres': 'Ogre',
           'mage': 'Mage', 'bandits': 'Bandit', 'bandit': 'Bandit', 'green hag': 'Green Hag', 'swarm of insects': 'Swarm of Insects', 'giant wasp': 'Giant Wasp', 'gladiator': 'Gladiator',
           'vampire': 'Vampire', 'animated armor': 'Animated Armor', 'shambling mound': 'Shambling Mound', 'kobolds': 'Kobold Warrior', 'young copper dragon': 'Young Copper Dragon',
           'sprite': 'Sprite', 'dryad': 'Dryad', 'satyr': 'Satyr', 'knight': 'Knight', 'noble': 'Noble', "will-o'-wisp": 'Will-o’-Wisp', 'will-o\'-wisps': 'Will-o’-Wisp', 'giant bat': 'Giant Bat', 'scout': 'Scout'}

doc = dict(app='DM Atlas', format='dm-atlas-campaign', version=1, id=CID, title='Vesperine & the Velvet Marches', shortTitle='Vesperine & the Velvet Marches',
           subtitle='A Campaign World Guide of Masks, Murder, and Misbehavior · World: Carnelia · Gateway: the Oathless Glass · Main adventure: The Black Kiss',
           system='D&D 2024 rules (5.5e)', sessionLabel='Chapter',
           facts={'World': 'Carnelia', 'Gateway': 'The Oathless Glass', 'Main adventure': 'The Black Kiss', 'Levels': '3–8 (solo entries 1–3)', 'Players': 'Solo or 3–5 (default 4)',
                  'Rules': 'D&D 2024 (5.5e) · SRD 5.2.1', 'Bestiary': '%d custom 2024 stat blocks' % len(bestiary)},
           summary=plain(T[find(r'^The Premise$', 2)]['body'].split('\n\n')[1]),
           source=dict(files=['world-guide.md', 'solo-entry-adventures.md', 'bestiary/data/c1–c7 *.yaml', 'bestiary/data/collections.yaml', 'portraits/'],
                       note='Vesperine & the Velvet Marches, its solo companion book Through the Oathless Glass and the Carnelia Bestiary were written for Riley Renwick by DnD Bot. Converted for DM Atlas with the 2024 rules (SRD 5.2.1). Dungeons & Dragons is a trademark of Wizards of the Coast; this campaign is unofficial.',
                       validation='Carnelia Bestiary validation report: 128 creatures checked, 0 stat-block failures, all encounter tables within 2024 XP budgets.'),
           dmWarning='🔒 For the Dungeon Master only. This guide holds the killer\'s identity, every NPC secret, the fey guises and all endings. The player window shows only the player guide and the faces your players have met (fey stay in human guise until you reveal them).',
           overview=overview, sessions=sessions, npcs=list(NPCS.values()), locations=locations, locations_player=locations_player, bestiary=bestiary,
           bestiaryInfo=dict(title=cols['title'], subtitle=cols['subtitle'], edition=cols['edition'], collections=[dict(num=c['num'], name=c['name'], region=c['region'], color=c['color'], intro=c['intro'].strip()) for c in cols['collections']]),
           items=[], tables=tables, secrets=secrets, handbook=handbook, npcs_player=npcs_player, solo=solo, srdRefs=srdRefs,
           srdNoMatch=['pixie', 'winged kobolds', 'giant moths'], art=dict(pack='campaigns/vesperine-velvet-marches.dmatlas-art.json', folder='art/' + CID + '/'),
           partyHint='Solo or 3–5 players, levels 3–8 (solo entry adventures: levels 1–3)')
os.makedirs(ROOT + '/src/data', exist_ok=True)
js = json.dumps(doc, ensure_ascii=False, separators=(',', ':'))
open(ROOT + '/src/data/vesperine.js', 'w', encoding='utf-8').write('(window.DM_BUNDLED_CAMPAIGNS = window.DM_BUNDLED_CAMPAIGNS || []).push(' + js + ');\n')
open(ROOT + '/campaigns/' + CID + '.dmatlas.json', 'w', encoding='utf-8').write(json.dumps(doc, ensure_ascii=False, indent=1))
print('sessions', len(sessions), 'npcs', len(NPCS), 'portraits', len([n for n in NPCS.values() if n['portrait']]), 'locations', len(locations), 'tables', len(tables), 'secrets', len(secrets),
      'bestiary', len(bestiary), 'solo adventures', len(solo['adventures']), 'entries', sum(len(a['entries']) for a in solo['adventures']), 'handbook', len(handbook['sections']), 'bytes', len(js))
