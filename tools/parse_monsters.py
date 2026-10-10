import pymupdf,re,json,sys
doc=pymupdf.open('/workspace/dm-atlas/srd/SRD_CC_v5.2.1.pdf')
WANT=set(sys.argv[1:]) if len(sys.argv)>1 else None
L=[]
for pno in range(250,len(doc)):
    lines=[]
    for b in doc[pno].get_text('dict')['blocks']:
        for l in b.get('lines',[]):
            ne=[s for s in l['spans'] if s['text'].strip()]
            if not ne or l['bbox'][1]>735: continue
            lines.append(dict(p=pno+1,x=l['bbox'][0],sp=l['spans'],ne=ne,t=''.join(s['text'] for s in l['spans']).replace('\t',' ').strip()))
    lines.sort(key=lambda l:0 if l['x']<300 else 1)
    L+=lines
blocks=[];cur=None
for l in L:
    s=l['ne'][0]; fn=s['font']
    if 'GillSans-SemiBold' in fn and s['size']>13.5 and s['size']<16:
        cur={'name':l['t'],'page':l['p'],'lines':[]}; blocks.append(cur); continue
    if cur is None: continue
    if not (fn.startswith('Optima') or fn.startswith('GillSans')): cur=None; continue
    if 'GillSans-SemiBold' in fn and s['size']>=16: cur=None; continue
    prev=cur['lines'][-1] if cur['lines'] else None
    heading=(fn=='GillSans' and abs(s['size']-12)<0.4)
    starter=heading or 'SC700' in fn or (fn=='GillSans' and s['size']<7) or (fn=='Optima-Italic' and not cur['lines']) or fn=='Optima-Bold' or (fn=='Optima-BoldItalic' and (prev is None or prev[1] or prev[0].rstrip()[-1:] in '.:'))
    t=l['t']
    if starter or prev is None: cur['lines'].append([t,heading])
    else:
        if prev[0].endswith('-') and prev[0][-2:-1].isalpha() and t[:1].islower(): prev[0]=prev[0][:-1]+t
        else: prev[0]+=' '+t
out=[]
for b in blocks:
    if WANT and b['name'] not in WANT: continue
    lines=[re.sub(r'\s+',' ',x[0].replace('\xa0',' ')) for x in b['lines']]
    joined=' '.join(lines)
    ab=re.findall(r'(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)\s+([+−-]\d+)\s+([+−-]\d+)',joined)
    rest=[x for x in lines if not re.match(r'^(Str|Dex|Con|Int|Wis|Cha|MOD|[+−-]\d+)\b',x)]
    def grab(pfx):
        for x in rest:
            if x.startswith(pfx+' '): return x[len(pfx)+1:]
        return ''
    acl=grab('AC'); m=re.match(r'(\d+)',acl); 
    ini=re.search(r'Initiative ([+−-]\d+)',joined)
    hp=re.match(r'(\d+)',grab('HP') or '0')
    out.append(dict(name=b['name'],page=b['page'],meta=rest[0] if rest else '',ac=int(m.group(1)) if m else None,acText=acl.split(' Initiative')[0],init=(ini.group(1).replace('−','-') if ini else '+0'),hp=int(hp.group(1)) if hp else None,hpText=grab('HP'),abilities=ab,lines=rest[1:]))
print(len(blocks),len(out),file=sys.stderr)
json.dump(out,open('/workspace/dm-atlas/srd/monsters_parsed.json','w'),indent=1,ensure_ascii=False)
