import pymupdf,re,json,sys
doc=pymupdf.open('/workspace/dm-atlas/srd/SRD_CC_v5.2.1.pdf')
def extract(p0,p1,minsize=11.5,maxsize=12.5):
    L=[]
    for pno in range(p0-1,p1):
        lines=[]
        for b in doc[pno].get_text('dict')['blocks']:
            for l in b.get('lines',[]):
                ne=[s for s in l['spans'] if s['text'].strip()]
                if not ne or l['bbox'][1]>735: continue
                lines.append(dict(x=l['bbox'][0],sp=l['spans'],ne=ne,t=''.join(s['text'] for s in l['spans'])))
        lines.sort(key=lambda l:0 if l['x']<300 else 1)
        L+=lines
    entries=[];cur=None;buf=''
    def flush():
        nonlocal buf
        if cur is not None and buf.strip(): cur['p'].append(re.sub(r'\s+',' ',buf.replace('\xa0',' ')).strip())
        buf=''
    for l in L:
        s=l['ne'][0]
        if 'GillSans-SemiBold' in s['font'] and minsize<=s['size']<=maxsize:
            flush(); cur={'h':l['t'].strip(),'p':[]}; entries.append(cur); continue
        if s['font'].startswith('GillSans') and s['size']>maxsize:
            flush(); cur=None; continue
        if cur is None: continue
        if not s['font'].startswith('Cambria'): continue
        first=l['sp'][0]['text']
        if first.startswith('\t') or l['t'].lstrip().startswith('•') or ('Bold' in s['font'] and buf.rstrip().endswith(('.',':'))):
            flush()
        t=''
        for sp in l['sp']:
            tx=sp['text'].replace('\t',' ')
            t+= (' **'+tx.strip()+'** ') if tx.strip() and 'Bold' in sp['font'] else tx
        t=t.strip()
        if buf.endswith('-') and buf[-2:-1].isalpha() and t[:1].islower(): buf=buf[:-1]+t
        elif buf.endswith('-') and (buf[-2:-1].isdigit() or t[:1].isdigit()): buf+=t
        else: buf=(buf+' '+t) if buf else t
    flush()
    for e in entries:
        e['p']=[re.sub(r'\*\*([^*]+?)\*\*(?=\w)',r'**\1** ',re.sub(r'\s+\*\*([.,])',r'**\1',re.sub(r'\*\*\s+','**',x.replace('** **',' ')))) for x in e['p']]
    return entries
if __name__=='__main__':
    w=extract(89,90)
    want=['Ammunition','Finesse','Heavy','Light','Loading','Range','Reach','Thrown','Two-Handed','Versatile','Cleave','Graze','Nick','Push','Sap','Slow','Topple','Vex']
    props={e['h']:e['p'] for e in w if e['h'] in want}
    print(sorted(props), file=sys.stderr)
    # glossary: find pages
    g0=next(i for i in range(170,200) if doc[i].get_text().find('Rules Glossary')>=0 and 'Glossary Conventions' in doc[i].get_text())+1
    g=extract(g0,g0+20)
    G={e['h']:e['p'] for e in g}
    print(g0,len(g),[e['h'] for e in g][:400],file=sys.stderr)
    json.dump({'weaponProps':props,'glossary':G},open('/workspace/dm-atlas/srd/sections_parsed.json','w'),indent=1,ensure_ascii=False)
