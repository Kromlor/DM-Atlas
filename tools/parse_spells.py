import pymupdf, json, re, sys
doc=pymupdf.open('/workspace/dm-atlas/srd/SRD_CC_v5.2.1.pdf')
start=next(i for i in range(100,120) if 'Spell Descriptions' in doc[i].get_text() and 'Acid Arrow' in doc[i].get_text())
L=[]
for pno in range(start,len(doc)):
    stop=False
    for b in doc[pno].get_text('dict')['blocks']:
        for l in b.get('lines',[]):
            sp=[s for s in l['spans'] if s['text']!='']
            if not sp or l['bbox'][1]>735: continue
            ne=[s for s in sp if s['text'].strip()]
            txt=''.join(s['text'] for s in sp)
            if ne and ne[0]['size']>=17:
                if pno>start: stop=True;break
                continue
            L.append(dict(p=pno+1,x=l['bbox'][0],y=l['bbox'][1],sp=sp,ne=ne,t=txt))
        if stop: break
    if stop: break
# stable sort by column within each page
L.sort(key=lambda l:(l['p'], 0 if l['x']<300 else 1))
META=('Casting Time:','Range:','Components:','Component:','Duration:')
def f0(l): return l['ne'][0] if l['ne'] else None
def is_name(l):
    s=f0(l); 
    return s and 'GillSans-SemiBold' in s['font'] and (abs(s['size']-12)<0.3 or ('SC700' in s['font'] and s['size']>11)) and not l['t'].strip().endswith(':') and not any(l['t'].startswith(m) for m in META)
def is_sb_title(l):
    s=f0(l); return s and 'GillSans-SemiBold' in s['font'] and s['size']>14
spells=[];statblocks=[];cur=None;sb=None;mode=None
def body(): return cur['blocks']
def newpara(): 
    if cur['_buf'].strip(): cur['blocks'].append(cur['_buf'].strip())
    cur['_buf']=''
def addtext(x):
    x=x.strip()
    b=cur['_buf']
    if b.endswith('-') and len(b)>1 and b[-2].isalpha() and x[:1].islower(): cur['_buf']=b[:-1]+x
    elif b.endswith('-') and len(b)>1 and (b[-2].isdigit() or x[:1].isdigit()): cur['_buf']=b+x
    elif b: cur['_buf']=b+' '+x
    else: cur['_buf']=x
def fmt(sp):
    out=''
    for s in sp:
        tx=s['text'].replace('\t',' ')
        if tx.strip() and 'Bold' in s['font']: out+=' **'+tx.strip()+'** '
        else: out+=tx
    return out
for l in L:
    s=f0(l)
    if is_sb_title(l):
        if cur: newpara()
        sb={'title':l['t'].strip(),'lines':[],'p':l['p']}; statblocks.append(sb); mode='sb'; continue
    if is_name(l):
        if cur and cur['_st']=='name' and mode=='spell': cur['name']+=' '+l['t'].strip(); continue
        if cur: newpara(); cur['_table']=None
        cur={'name':l['t'].strip(),'_st':'name','hdr':'','meta':{},'blocks':[],'_buf':'','page':l['p'],'_lm':None,'_table':None}
        spells.append(cur); mode='spell'; continue
    if mode=='sb':
        if not s: continue
        fn=s['font']
        if fn.startswith('Optima') or fn.startswith('GillSans'):
            t=l['t'].replace('\t',' ').strip()
            prev=sb['lines'][-1] if sb['lines'] else None
            heading=(fn=='GillSans' and abs(s['size']-12)<0.3)
            starter=heading or 'SC700' in fn or (fn=='GillSans' and s['size']<7) or (fn=='Optima-Italic' and not sb['lines']) or fn=='Optima-Bold' or (fn=='Optima-BoldItalic' and (prev is None or prev[2] or prev[1].rstrip()[-1:] in '.:'))
            if starter or prev is None: sb['lines'].append([fn,t,heading])
            else:
                if prev[1].endswith('-') and prev[1][-2:-1].isalpha() and t[:1].islower(): prev[1]=prev[1][:-1]+t
                else: prev[1]+=' '+t
            continue
        else:
            mode='spell'  # back to body text of current spell
    if cur is None: continue
    t=l['t']
    if cur['_st'] in('name','hdr') and s['font'].startswith('Cambria-Italic') and not cur['meta']:
        cur['hdr']+=' '+t.strip(); cur['_st']='hdr'; continue
    if cur['_st'] in('hdr','meta'):
        m=[x for x in META if t.strip().startswith(x)]
        if m: cur['_lm']=m[0][:-1]; cur['meta'][cur['_lm'].replace('Component','Components').replace('Componentss','Components')]=t.strip()[len(m[0]):].strip(); cur['_lm']=cur['_lm'].replace('Component','Components').replace('Componentss','Components'); cur['_st']='meta'; continue
        if s['font'].startswith('GillSans') and cur['_lm']: cur['meta'][cur['_lm']]+=' '+t.strip(); continue
    cur['_st']='body'
    if s and s['font'].startswith('GillSans'):
        # table content
        sz=s['size']; semi='SemiBold' in s['font']; tx=t.replace('\t',' ').strip()
        tb=cur['_table']
        if semi and sz>10:
            newpara(); tb={'title':tx,'cols':[],'h':[],'r':[]}; cur['_table']=tb; cur['blocks'].append(tb); continue
        if tb is None:
            newpara(); tb={'title':'','cols':[],'h':[],'r':[]}; cur['_table']=tb; cur['blocks'].append(tb)
        if semi and not tb['r']:
            tb.setdefault('hl',[]).append((l['x'],l['y'],tx)); continue
        if tb.get('hl') and not tb['cols']:
            groups=[]
            for x,y,h in sorted(tb['hl']):
                if groups and x-groups[-1][0]<8: groups[-1][1].append((y,h))
                else: groups.append([x,[(y,h)]])
            tb['cols']=[g[0] for g in groups]; tb['h']=[' '.join(h for y,h in sorted(g[1])) for g in groups]
        cols=tb['cols'] or [l['x']]
        ci=max([i for i,cx in enumerate(cols) if cx<=l['x']+4] or [0])
        if ci==0 and (not tb['r'] or abs(l['x']-cols[0])<12 and (len(cols)==1 or True)):
            # new row unless this is a continuation of col0 (indented)
            if tb['r'] and len(cols)>1 and all(c=='' for c in tb['r'][-1][1:]) : tb['r'][-1][0]+=' '+tx
            else: tb['r'].append([tx]+['']*(len(cols)-1))
        else:
            if not tb['r']: tb['r'].append(['']*len(cols))
            c=tb['r'][-1][ci]
            tb['r'][-1][ci]= (c[:-1]+tx if c.endswith('-') and c[-2:-1].isalpha() and tx[:1].islower() else (c+' '+tx).strip())
        continue
    if cur['_table'] is not None: cur['_table']=None; newpara()
    first=l['sp'][0]['text']; bi=s
    if first.startswith('\t') or first.startswith('•') or ('Bold' in bi['font'] and l['t'].lstrip().startswith(bi['text'].strip()) and cur['_buf'].rstrip().endswith(('.',':')) ) or l['t'].lstrip().startswith('•'):
        newpara()
    addtext(fmt(l['sp']))
if cur: newpara()
def clean(x): return re.sub(r'\s+',' ',x.replace('\xa0',' ')).replace('** **',' ').replace('•','• ').replace('•  ','• ').strip()
out=[]
for s in spells:
    hdr=re.sub(r'\s+',' ',s['hdr']).strip()
    m=re.match(r'Level (\d) (\w+) \((.*)\)$',hdr); m2=re.match(r'(\w+) Cantrip \((.*)\)$',hdr)
    if m: lvl,school,cls=int(m.group(1)),m.group(2),m.group(3)
    elif m2: lvl,school,cls=0,m2.group(1),m2.group(2)
    else: print('BADHDR',s['name'],hdr,file=sys.stderr); continue
    desc=[];higher=''
    for b in s['blocks']:
        if isinstance(b,str):
            c=clean(b); c=re.sub(r'\*\*\s+','**',c); c=re.sub(r'\s+\*\*([.,])','**\\1',c); c=re.sub(r'\*\*([^*]+?)\*\*(?=\w)',r'**\1** ',c); c=re.sub(r'(\w)\*\*(?=\w)',r'\1 **',c)
            plain=c.replace('**','')
            if plain.startswith('Using a Higher-Level Spell Slot.') or plain.startswith('Cantrip Upgrade.'): higher=re.sub(r'^(Using a Higher-Level Spell Slot\.|Cantrip Upgrade\.)\s*',r'\1 ',plain)
            else: desc.append(c)
        else:
            desc.append({'title':clean(b['title']),'h':[clean(x) for x in b['h']],'r':[[clean(x) for x in r] for r in b['r']]})
    meta={k:clean(v) for k,v in s['meta'].items()}
    ct=meta.get('Casting Time',''); dur=meta.get('Duration','')
    out.append(dict(name=clean(s['name']),level=lvl,school=school,classes=[c.strip() for c in cls.split(',')],castingTime=ct,range=meta.get('Range',''),components=meta.get('Components',''),duration=dur,concentration=dur.startswith('Concentration'),ritual='Ritual' in ct,description=desc,higher=higher,page=s['page']))
# statblocks attach
for sbk in statblocks:
    t=sbk['title']; owner=None
    for o in out:
        if any(isinstance(d,str) and t.lower() in d.replace('**','').lower() for d in o['description']): owner=o;break
    lines=[]
    for fn,tx,hd in sbk['lines']:
        lines.append(clean(tx))
    # merge ability tokens
    joined=' '.join(lines)
    ab=re.findall(r'(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)\s+([+−-]\d+)\s+([+−-]\d+)',joined)
    rest=[x for x in lines if not re.match(r'^(Str|Dex|Con|Int|Wis|Cha|MOD|[+−-]\d+)\b',x)]
    blk={'statblock':t,'abilities':ab,'lines':rest}
    print('SB',t,'->',owner and owner['name'],len(ab),file=sys.stderr)
    if owner: owner.setdefault('statblocks',[]).append(blk)
json.dump(out,open('/workspace/dm-atlas/srd/spells_parsed.json','w'),indent=1,ensure_ascii=False)
print(len(out),sum(1 for x in out if x['level']==0),file=sys.stderr)
