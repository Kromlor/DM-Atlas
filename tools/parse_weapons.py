import re,json
L=open('/workspace/dm-atlas/srd/srd_layout.txt').read().split('\n')
i=next(k for k,l in enumerate(L) if l.strip()=='Simple Melee Weapons')
cat=None;out=[]
for l in L[i:i+80]:
    s=l.strip()
    if not s: continue
    if 'System Reference Document' in s: break
    m=re.match(r'(Simple|Martial) (Melee|Ranged) Weapons$',s)
    if m: cat=m.groups(); continue
    m=re.match(r'^(.+?)\s+(\d+d\d+|1) (\w+)\s{2,}(.+?)\s{2,}(\w+)\s{2,}([\d/]+ lb\.|—)\s+(\d+ [CSGP]P)$',s)
    if m:
        out.append(dict(name=m.group(1).strip(),category=cat[0],kind=cat[1],damage=m.group(2),damageType=m.group(3),properties=m.group(4).strip(),mastery=m.group(5),weight=m.group(6),cost=m.group(7)))
    else:
        # continuation of properties
        out[-1]['properties']+=' '+s
for w in out:
    w['properties']=re.sub(r',\s*$','',w['properties'].replace(',  ',', '))
    w['properties']='' if w['properties']=='—' else w['properties']
    pl=[p.strip() for p in re.split(r',\s*(?![^()]*\))',w['properties']) if p.strip()]
    w['propList']=pl
    v=re.search(r'Versatile \((\d+d\d+)\)',w['properties']); w['versatile']=v.group(1) if v else None
    r=re.search(r'Range (\d+)/(\d+)',w['properties']); w['range']=[int(r.group(1)),int(r.group(2))] if r else None
print(len(out)); 
json.dump(out,open('/workspace/dm-atlas/srd/weapons_parsed.json','w'),indent=1,ensure_ascii=False)
for w in out: print(w['name'],'|',w['category'],w['kind'],'|',w['damage'],w['damageType'],'|',w['propList'],'|',w['mastery'],w['weight'],w['cost'])
