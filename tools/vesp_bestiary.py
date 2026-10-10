"""Carnelia bestiary -> DM Atlas stat blocks.
Canonical data: bestiary/data/c1..c7*.yaml + collections.yaml. Derived numbers (HP, attack bonuses, DCs,
skills, saves, damage averages) are taken from the bestiary's own rendering of that YAML
(carnelia-bestiary.md) and cross-checked against the YAML for every creature."""
import yaml, glob, re, os, json
SRC = '/workspace/dnd-world/bestiary'
ABN = ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha']
def mod(s): return (s - 10) // 2
def plain(s):
    s = re.sub(r'\*\*\*(.+?)\*\*\*', r'\1', s); s = re.sub(r'\*\*(.+?)\*\*', r'\1', s); s = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'\1', s)
    s = s.replace('\\*', '*')
    return re.sub(r'\s+', ' ', s).strip()
def avg_dice(expr):
    m = re.fullmatch(r'(\d+)d(\d+)', expr.strip()); n, d = int(m.group(1)), int(m.group(2)); return n, n * (d + 1) / 2
def load():
    cols = yaml.safe_load(open(SRC + '/data/collections.yaml'))
    mons = []
    for c in cols['collections']:
        for m in yaml.safe_load(open(SRC + '/data/' + c['file'])):
            m['_col'] = c; mons.append(m)
    return cols, mons
def md_blocks():
    md = open(SRC + '/carnelia-bestiary.md', encoding='utf-8').read()
    out = {}
    for mm in re.finditer(r'^## ([^\n]+?) \{#m-([a-z0-9-]+)\}\n(.*?)(?=^## |^# |\Z)', md, re.S | re.M):
        out[mm.group(1).strip()] = (mm.group(2), mm.group(3))
    return out
def parse_block(name, body):
    lines = body.split('\n')
    i = next(k for k, l in enumerate(lines) if l.startswith('**AC**'))
    meta = lines[i - 2].strip().strip('*') if lines[i - 2].strip() else lines[i - 1].strip().strip('*')
    ac_m = re.match(r'\*\*AC\*\* (\d+)(.*?) · \*\*Initiative\*\* ([+−-]\d+) \((\d+)\)', lines[i])
    hp_m = re.match(r'\*\*HP\*\* (\d+) \((.+?)\)', lines[i + 1].strip())
    sp_m = re.match(r'\*\*Speed\*\* (.+)', lines[i + 2].strip())
    sb = dict(ac=int(ac_m.group(1)), acText=(ac_m.group(1) + ac_m.group(2)).strip(), init=ac_m.group(3), initScore=int(ac_m.group(4)),
              hp=int(hp_m.group(1)), hpText=hp_m.group(1) + ' (' + hp_m.group(2) + ')', hpDice=hp_m.group(2), speed=sp_m.group(1).strip(), meta=meta)
    # ability table
    abil = {}
    for l in lines[i + 3:i + 10]:
        for mm in re.finditer(r'\*\*(Str|Dex|Con|Int|Wis|Cha)\*\* \| (\d+) \| ([+−-]\d+) \| ([+−-]\d+)', l):
            abil[mm.group(1)] = [mm.group(1).upper(), mm.group(2), mm.group(3), mm.group(4)]
    sb['abilities'] = [abil[a] for a in ABN]
    j = next(k for k in range(i + 3, len(lines)) if lines[k].startswith('**') and not lines[k].startswith('| '))
    sb['lines'] = []
    while j < len(lines) and lines[j].strip() and not re.match(r'^\*\*[A-Z ]+\*\*$', lines[j].strip()):
        sb['lines'].append(plain(lines[j])); j += 1
    sections = []; cur = None
    end = next((k for k in range(j, len(lines)) if lines[k].startswith('**Tactics.**')), len(lines))
    for l in lines[j:end]:
        s = l.strip()
        if not s: continue
        h = re.match(r'^\*\*([A-Z ]+)\*\*$', s)
        if h: cur = dict(title=h.group(1).title(), entries=[]); sections.append(cur); continue
        e = re.match(r'^\*\*\*(.+?)\.\*\*\* (.*)$', s)
        if e: cur['entries'].append(dict(name=plain(e.group(1)), text=plain(e.group(2)))); continue
        if s.startswith('- '):
            cur['entries'][-1]['text'] += ' ' + plain(s[2:]) + ';'; continue
        cur['entries'].append(dict(name='', text=plain(s)))
    for sec in sections:
        for e in sec['entries']: e['text'] = re.sub(r';$', '', e['text']).replace(': ;', ':')
    sb['sections'] = sections
    return sb
def hook_text(h):
    # a few hooks contain ': ' and YAML reads them as one-key maps; restore the original sentence
    if isinstance(h, dict): k, v = next(iter(h.items())); return (str(k) + ': ' + str(v)).strip()
    return str(h).strip()
def build(check=True):
    cols, mons = load(); blocks = md_blocks(); out = []; problems = []
    for m in mons:
        slug, body = blocks[m['name']]
        sb = parse_block(m['name'], body)
        # cross-checks against the canonical YAML
        n, a = avg_dice(m['hd']); con = mod(m['abil'][2])
        exp_hp = int(a + n * con)
        if sb['ac'] != m['ac']: problems.append((m['name'], 'AC', sb['ac'], m['ac']))
        if sb['hpDice'].split(' ')[0] != m['hd']: problems.append((m['name'], 'HD', sb['hpDice'], m['hd']))
        if sb['hp'] != exp_hp: problems.append((m['name'], 'HP', sb['hp'], exp_hp))
        if [int(x[1]) for x in sb['abilities']] != m['abil']: problems.append((m['name'], 'abil'))
        if not any(l.startswith('CR ' + str(m['cr']) + ' ') for l in sb['lines']): problems.append((m['name'], 'CR', m['cr']))
        names = [e['name'] for s in sb['sections'] for e in s['entries'] if e['name']]
        for sec in ('traits', 'actions', 'bonus', 'reactions'):
            for x in m.get(sec) or []:
                if x['n'] not in names: problems.append((m['name'], 'missing ' + sec, x['n']))
        for x in (m.get('legendary') or {}).get('list', []):
            if x['n'] not in names: problems.append((m['name'], 'missing legendary', x['n']))
        if not os.path.exists(SRC + '/art/' + slug + '.jpg'): problems.append((m['name'], 'art missing', slug))
        c = m['_col']
        sb.update(id='carnelia-' + slug, slug=slug, name=m['name'], audience='dm', cr=str(m['cr']), type=m['type'], size=m['size'],
                  collection=c['num'], collectionName=c['name'], region=c['region'], art='monster/' + slug,
                  lore=m['lore'].strip(), where=m['where'].strip(), tactics=m['tactics'].strip(), hooks=[hook_text(h) for h in m['hooks']],
                  round=m.get('round') or [], res=m.get('res', ''), vul=m.get('vuln', ''), imm=m.get('imm', ''), source='Carnelia Bestiary')
        out.append(sb)
    return cols, out, problems
if __name__ == '__main__':
    cols, out, problems = build()
    print(len(out), 'monsters;', len(problems), 'problems')
    for p in problems[:40]: print(p)
    print(json.dumps(out[0], indent=1, ensure_ascii=False)[:2500])
    big = [m for m in out if m['name'] == 'Herald of the Dusk Court'][0]; print(json.dumps(big['sections'], ensure_ascii=False)[:1800])
