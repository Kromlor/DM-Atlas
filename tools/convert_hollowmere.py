import re,json
from bs4 import BeautifulSoup, NavigableString, Comment
D='/workspace/dm-atlas/campaigns/hollowmere-year-one/'
ALLOWED={'h1','h2','h3','h4','h5','h6','p','ul','ol','li','b','strong','i','em','u','blockquote','table','thead','tbody','tr','th','td','br','hr','span','div','small','sup','sub','code','pre','a','article','section','dl','dt','dd'}
DROP={'script','style','iframe','object','embed','form','input','button','select','textarea','link','meta','svg','noscript','template','nav','header','footer','img','video','audio','canvas'}
CLASSMAP={'ra':'readaloud','enc':'encounter','enc-h':'encounter-h','pts':'points','lvl-up':'levelup','callout':'callout','knows':'knows','spoiler':'dm-warning','role':'role','sub':'sub','letter':'letter','secret':'callout','card':'card','grid':'grid','crestbig':'icon','ico':'icon','value':'tagline','pill':'pill','steps':'steps','step':'step','seal':'seal','sig':'sig','place':'place','path':'path','house':'house','ember':'ember','tide':'tide','thorn':'thorn','dusk':'dusk','inc':'inc','lvl':'lvl','spelltab':'spelltab','spellgroup':'spellgroup','tablewrap':'tablewrap','secretcard':'card','tl':'timeline','npc':'npc'}
def clean(node):
    soup=BeautifulSoup(str(node),'html.parser')
    for c in soup.find_all(string=lambda t:isinstance(t,Comment)): c.extract()
    for t in soup.find_all(list(DROP)): t.decompose()
    for t in soup.find_all(True):
        if t.name not in ALLOWED: t.unwrap(); continue
        cls=[CLASSMAP[c] for c in (t.get('class') or []) if c in CLASSMAP]
        attrs={}
        if cls: attrs['class']=' '.join(cls)
        if t.name in('td','th'):
            for a in ('colspan','rowspan'):
                if t.get(a,'').isdigit(): attrs[a]=t[a]
        if t.name=='a':
            t.unwrap(); continue
        t.attrs=attrs
    # readaloud label span
    for bq in soup.find_all('blockquote'):
        sp=bq.find('span')
        if sp and sp.get_text(strip=True).lower()=='read aloud': sp.decompose()
    h=str(soup)
    h=re.sub(r'\s*\n\s*','\n',h).strip()
    return h
def txt(n): return re.sub(r'\s+',' ',n.get_text(' ',strip=True)).replace(' ,',',').replace(' .','.') if n else ''
def ttxt(n): 
    s=n.get_text('',strip=False) if n else ''
    return re.sub(r'\s+',' ',s).strip()
dm=BeautifulSoup(open(D+'Hollowmere_DM_Guide.html').read(),'html.parser')
hb=BeautifulSoup(open(D+'Hollowmere_Student_Handbook.html').read(),'html.parser')
hero=dm.find(class_='hero')
facts={ttxt(s.b):ttxt(s).replace(ttxt(s.b),'',1).strip() for s in hero.find(class_='facts').find_all('span')}
def section(id): return dm.find('section',id=id)
def h2title(sec):
    h=sec.find('h2'); n=h.find(class_='num'); num=ttxt(n) if n else ''
    t=ttxt(h); return num, t[len(num):].strip() if num and t.startswith(num) else t
camp=dict(app='DM Atlas',format='dm-atlas-campaign',version=1,id='hollowmere-year-one',
  title='Hollowmere Academy — Year One: The Portrait in the East Wing',shortTitle='Hollowmere Year One',
  subtitle=ttxt(hero.find(class_='kicker')),system='D&D 2024 rules (5.5e)',facts=facts,summary=ttxt(hero.find(class_='lead')),
  source=dict(files=['Hollowmere_DM_Guide.html','Hollowmere_Student_Handbook.html'],note=ttxt(dm.find('footer'))),
  dmWarning=ttxt(dm.find(class_='spoiler')),
  overview=[],sessions=[],npcs=[],locations=[],bestiary=[],items=[],tables=[],secrets=[],handbook={})
# overview sections
for sid,aud in [('secret','dm'),('rules','dm'),('scaling','dm')]:
    sec=section(sid); num,title=h2title(sec)
    body=BeautifulSoup(str(sec),'html.parser').section
    body.find('h2').decompose()
    camp['overview'].append(dict(id=sid,title=title,audience='dm',html=clean(body.decode_contents())))
# secret story timeline + secrets
sec=section('secret')
camp['secrets'].append(dict(title='The Secret Story',html=clean(sec.find(class_='secretcard').decode_contents())))
tl=sec.find(class_='tl')
if tl:
    camp['secrets'].append(dict(title='Reveal timeline',html=clean(tl.decode_contents())))
# NPCs
for c in section('cast').select('.card.npc'):
    d=dict(name=ttxt(c.find('h3')),role=ttxt(c.find(class_='role')),audience='dm')
    for p in c.find_all('p'):
        b=p.find('b')
        if b:
            k=ttxt(b).rstrip(':').lower(); v=ttxt(p)[len(ttxt(b)):].strip()
            d[k]=v
    camp['npcs'].append(d)
    if d.get('secret') and d['secret'] not in ('—','None. She\'s exactly who she seems to be.'):
        camp['secrets'].append(dict(title=f"{d['name']}'s secret",html='<p>'+d['secret']+'</p>'))
# locations
for c in section('places').select('.card'):
    camp['locations'].append(dict(name=ttxt(c.find('h3')),html=clean(''.join(str(p) for p in c.find_all('p'))),audience='dm'))
# sessions
for i in range(1,6):
    sec=section(f's{i}'); num,title=h2title(sec)
    sub=sec.find('p',class_='sub')
    s=dict(id=f's{i}',number=i,title=title,summary=ttxt(sub),scenes=[],audience='dm',intro='')
    cur=None; intro=[]
    for el in sec.children:
        if isinstance(el,NavigableString): continue
        if el.name=='h2' or el is sub: continue
        if el.name=='h4':
            cur=dict(title=ttxt(el),parts=[]); s['scenes'].append(cur); continue
        (cur['parts'] if cur else intro).append(el)
    s['intro']=clean(''.join(str(x) for x in intro))
    for sc in s['scenes']:
        parts=sc.pop('parts')
        sc['readAloud']=[ttxt(p).replace('Read aloud','',1).strip() for p in parts if p.name=='blockquote']
        encs=[]
        for p in parts:
            if p.name=='div' and 'enc' in (p.get('class') or []):
                e={}
                for q in p.find_all('p'):
                    b=q.find('b'); 
                    if b: e[ttxt(b).rstrip(':').lower()]=ttxt(q)[len(ttxt(b)):].strip()
                foes=[]
                for m in re.finditer(r'(\d+)\s*×\s*([^,]+)',e.get('enemies','')):
                    foes.append(dict(count=int(m.group(1)),name=m.group(2).strip()))
                e['foes']=foes; encs.append(e)
        sc['encounters']=encs
        sc['html']=clean(''.join(str(x) for x in parts))
    camp['sessions'].append(s)
# bestiary
def parse_sb(a):
    m=dict(id=a.get('id','').replace('m-',''),name=ttxt(a.find('h4')),meta=ttxt(a.find(class_='meta')),audience='dm')
    top=ttxt(a.find(class_='sb-top'))
    m['ac']=int(re.search(r'AC (\d+)',top).group(1)); ini=re.search(r'Initiative ([+−-]\d+)',top); m['init']=ini.group(1).replace('−','-') if ini else '+0'
    hp=re.search(r'HP (\d+) \(([^)]*)\)',top); m['hp']=int(hp.group(1)); m['hpDice']=hp.group(2)
    m['speed']=re.search(r'Speed (.+)$',top).group(1)
    m['abilities']=[[ttxt(r.find('b'))]+[ttxt(x) for x in r.find_all('span')] for r in a.find(class_='abil').find_all('div',recursive=False) if 'hd' not in (r.get('class') or [])]
    m['lines']=[ttxt(p) for p in a.find(class_='sb-lines').find_all('p')]
    for ln in m['lines']:
        for k in ('Vulnerabilities','Resistances','Immunities'):
            if ln.startswith(k+' '): m[{'Vulnerabilities':'vul','Resistances':'res','Immunities':'imm'}[k]]=ln[len(k)+1:]
    secs=[];cur=None
    for el in a.find_all(['h5','p']):
        if el.name=='h5': cur=dict(title=ttxt(el),entries=[]); secs.append(cur)
        elif cur is not None and 'sb-desc' not in (el.get('class') or []) and el.parent.name=='article':
            b=el.find('b'); nm=ttxt(b).rstrip('.') if b else ''
            cur['entries'].append(dict(name=nm,text=ttxt(el)[len(ttxt(b)):].strip() if b else ttxt(el)))
    m['sections']=secs
    m['description']=ttxt(a.find(class_='sb-desc'))
    return m
for a in section('bestiary').find_all('article',class_='sb'): camp['bestiary'].append(parse_sb(a))
# items
for c in section('items').select('.grid .card'):
    camp['items'].append(dict(name=ttxt(c.find('h3')),type=ttxt(c.find(class_='role')),text=ttxt(c.find('p')),audience='dm'))
def table(t):
    rows=[[ttxt(c) for c in r.find_all(['td','th'])] for r in t.find_all('tr')]
    return rows
it=section('items')
lf=it.find('table')
camp['tables'].append(dict(title='Lost & Found Table (Session 5)',note=ttxt(it.find('p',class_='sub')),columns=table(lf)[0],rows=table(lf)[1:],roll='d10',audience='dm'))
hp=section('rules').find('table')
camp['tables'].append(dict(title='House Point Guide',note='',columns=['Deed','Points'],rows=table(hp),audience='dm'))
sc=section('scaling').find('table')
camp['tables'].append(dict(title='Scaling for Your Table',note='',columns=table(sc)[0],rows=table(sc)[1:],audience='dm'))
camp['tables'].append(dict(title='Icebreaker Questions (Session 1)',note='Roll a d6 or let the player pick.',columns=['d6','Question'],rows=[[str(i+1),q] for i,q in enumerate(["What did you pack that you're secretly nervous about?","What magic happened to you before you got your letter?","Which house do you hope for, and which do you dread?","Who did you leave behind?","What's the first thing you want to learn?","What's your worst habit?"])],roll='d6',audience='dm'))
camp['tables'].append(dict(title='Potion Mishaps (Session 2)',note='On a failed Potions check, roll a d6.',columns=['d6','Mishap'],rows=[[str(i+1),q] for i,q in enumerate(["Hair turns green for a day","Hiccuping bubbles","Voice goes squeaky","Cauldron grows legs and walks off","The potion smells like socks","It explodes in glitter"])],roll='d6',audience='dm'))
# handbook
hhero=hb.find(class_='hero')
hbk=dict(title=ttxt(hhero.find('h1')),kicker=ttxt(hhero.find(class_='kicker')),lead=ttxt(hhero.find(class_='lead')),audience='player',sections=[],footer=ttxt(hb.find('footer')))
for sec in hb.find_all('section'):
    num,title=h2title(sec)
    body=BeautifulSoup(str(sec),'html.parser').section
    body.find('h2').decompose()
    # map has absolutely-positioned labels; convert to list
    for mp in body.find_all(class_='map'):
        labels=[ttxt(x) for x in mp.find_all(True) if x.string and x.string.strip()]
        new=body.new_tag('p'); new.string='Map labels: '+', '.join(dict.fromkeys(labels)); mp.replace_with(new)
    # place/house/path cards: keep icon as text
    hbk['sections'].append(dict(id=sec.get('id'),title=title,html=clean(body.decode_contents())))
camp['handbook']=hbk
camp['partyHint']='3–6 players (balanced for 4), levels 1–3'
camp['locations_player']=[]
# player-facing location blurbs from handbook "school" section cards
for c in hb.select('#school .card.place'):
    nm=c.find(['h3','h4','b','strong'])
    camp['locations_player'].append(dict(name=ttxt(nm) if nm else '',text=ttxt(c.find('p')) if c.find('p') else ttxt(c)))
json.dump(camp,open('/workspace/dm-atlas/campaigns/hollowmere-year-one.dmatlas.json','w'),indent=1,ensure_ascii=False)
open('/workspace/dm-atlas/src/data/hollowmere.js','w').write('window.DM_BUNDLED_CAMPAIGNS=['+json.dumps(camp,ensure_ascii=False,separators=(',',':'))+'];\n')
print('sessions',[ (s['title'],len(s['scenes']),sum(len(x['encounters']) for x in s['scenes'])) for s in camp['sessions']])
print('npcs',len(camp['npcs']),'locs',len(camp['locations']),'beasts',[(b['name'],b['ac'],b['hp'],b['init']) for b in camp['bestiary']],'items',len(camp['items']),'secrets',len(camp['secrets']),'hb',[s['title'] for s in hbk['sections']])
print(camp['locations_player'][:2])
