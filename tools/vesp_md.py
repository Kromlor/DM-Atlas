"""Markdown helpers and the solo-book parser for the Vesperine importer (tools/import_vesperine.py)."""
import re
import markdown
from bs4 import BeautifulSoup

def strip_front(md): return re.sub(r'^---\n.*?\n---\n', '', md, flags=re.S)
def md2html(md, shift=0, solo=False, keep_images=None):
    """Markdown -> HTML in DM Atlas' safe subset. Images are removed (the app shows art from the pack/folder),
    unless keep_images(alt, path) returns a replacement text token."""
    if keep_images:
        md = re.sub(r'!\[([^\]]*)\]\(([^)]*)\)(\{[^}]*\})?', lambda m: keep_images(m.group(1), m.group(2)), md)
    md = re.sub(r'!\[[^\]]*\]\([^)]*\)(\{[^}]*\})?', '', md)
    md = re.sub(r'\{width=[^}]*\}', '', md)
    h = markdown.markdown(md, extensions=['tables', 'fenced_code', 'sane_lists', 'attr_list'])
    soup = BeautifulSoup(h, 'html.parser')
    for bq in soup.find_all('blockquote'):
        t = bq.get_text(' ', strip=True)
        if re.match(r'^(Running|Time cost|Table rule|Pitch|Rules|Sidebar)', t): bq['class'] = 'callout'
        else: bq['class'] = 'readaloud'
    for pre in soup.find_all('pre'): pre['class'] = 'asciimap'
    for tb in soup.find_all('table'):
        w = soup.new_tag('div'); w['class'] = 'tablewrap'; tb.wrap(w)
    if shift:
        for lv in (4, 3, 2, 1):
            for x in soup.find_all('h%d' % lv): x.name = 'h%d' % min(6, lv + shift)
    for a in soup.find_all('a'):
        href = a.get('href', '')
        if href.startswith('#'): a['class'] = 'turnto'
        elif not re.match(r'^https?://', href): a.unwrap()
    if solo:
        for li in soup.find_all('li'):
            if re.match(r'^\s*Answer\b', li.get_text()): li['class'] = 'riddle-ans'
    return str(soup).strip()
def plain(s):
    s = re.sub(r'\*\*(.+?)\*\*', r'\1', s); s = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'\1', s)
    s = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', s)
    return re.sub(r'\s+', ' ', s).strip()
def clean_hr(md): return re.sub(r'^\s*---\s*$', '', md, flags=re.M).strip()
def tree(md):
    md = strip_front(md); out = []; cur = None; in_code = False
    for line in md.split('\n'):
        if line.startswith('```'): in_code = not in_code
        m = None if in_code else re.match(r'^(#{1,3}) (.+?)\s*(\{#([\w-]+)\})?\s*$', line)
        if m: cur = dict(level=len(m.group(1)), title=m.group(2).strip(), anchor=m.group(4), body=[]); out.append(cur)
        elif cur is not None: cur['body'].append(line)
        else: out.append(dict(level=0, title='', anchor=None, body=[line])); cur = out[-1]
    for n in out: n['body'] = '\n'.join(n['body']).strip()
    return out
def split_h2(md, shift=0, keep_images=None):
    """Split a markdown document at '## ' headings -> (lead_html, [ {title, html} ])."""
    parts = re.split(r'^## +(.+?)\s*$', md, flags=re.M)
    lead = re.sub(r'^# .*$', '', parts[0], count=1, flags=re.M).strip()
    secs = [dict(title=plain(parts[i]), html=md2html(parts[i + 1], shift=shift, keep_images=keep_images)) for i in range(1, len(parts), 2)]
    return md2html(lead, keep_images=keep_images), secs

def solo_book(SOLO, art):
    """Parse solo-entry-adventures.md into the DM Atlas solo reader structure. art(path) -> opaque art key."""
    ST = tree(SOLO); adv = []; intro = []; i = 0; used = set()
    def img(path):
        used.add(path); return art(path)
    while i < len(ST):
        n = ST[i]
        m = re.match(r'^Adventure (\d) — \*(.+?)\* \((.+)\)$', n['title'])
        if n['level'] == 1 and m:
            a = dict(id=None, num=int(m.group(1)), title=m.group(2), gateway=m.group(3), sections=[], entries=[], img=None)
            im = re.search(r'!\[[^\]]*\]\((solo-img/[\w-]+\.jpg)\)', n['body']); a['img'] = img(im.group(1)) if im else None
            a['pitch'] = md2html(n['body'], solo=True)
            j = i + 1
            while j < len(ST) and ST[j]['level'] > 1:
                s = ST[j]
                if s['level'] == 3 and s['anchor']:
                    num = re.match(r'^(\d+a?)\. (.+)$', s['title'])
                    im = re.search(r'!\[([^\]]*)\]\((solo-img/[\w-]+\.jpg)\)', s['body'])
                    a['entries'].append(dict(anchor=s['anchor'], num=num.group(1), title=plain(num.group(2)), html=md2html(clean_hr(s['body']), solo=True),
                                             img=img(im.group(2)) if im else None, imgAlt=plain(im.group(1)) if im else ''))
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
    anchors = {e['anchor'] for a in adv for e in a['entries']}
    missing = sorted(set(re.findall(r'\]\(#([\w-]+)\)', SOLO)) - anchors)
    book = dict(title=fm.group(1) if fm else 'Through the Oathless Glass', subtitle=(fm.group(2) if fm else '').replace('D&D 5e', 'D&D 2024 rules'), intro=intro, adventures=adv,
                note='Solo gamebooks run with the 2024 rules (SRD 5.2.1). Endings and riddle answers are DM-only when you run this for a group (use Group table mode).')
    return book, missing, used
