import json,re
B='/workspace/dm-atlas/srd/'
spells=json.load(open(B+'spells_parsed.json'))
weapons=json.load(open(B+'weapons_parsed.json'))
sec=json.load(open(B+'sections_parsed.json'))
play=json.load(open(B+'playing_parsed.json'))
mons=[m for m in json.load(open(B+'monsters_parsed.json')) if m['ac'] is not None]
ABIL='Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma'
DT='Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder'
COND='Blinded|Charmed|Deafened|Frightened|Grappled|Incapacitated|Invisible|Paralyzed|Petrified|Poisoned|Prone|Restrained|Stunned|Unconscious|Exhaustion'
SAB={'Strength':'Str','Dexterity':'Dex','Constitution':'Con','Intelligence':'Int','Wisdom':'Wis','Charisma':'Cha'}
def plain(sp):
    out=[]
    for d in sp['description']:
        if isinstance(d,str): out.append(d.replace('**',''))
        else: out.append(' '.join(' '.join(r) for r in d['r']))
    return ' '.join(out)
def ordinal(n): return {1:'1st',2:'2nd',3:'3rd'}.get(n,f'{n}th')
def analyze(sp):
    t=plain(sp); tl=t.lower()
    saves=[]; [saves.append(a) for a in re.findall(rf'({ABIL}) saving throw',t) if a not in saves]
    atk=None
    if 'melee spell attack' in tl: atk='melee'
    if 'ranged spell attack' in tl: atk='ranged' if not atk else 'melee or ranged'
    dmg=[]; 
    for d,ty in re.findall(rf'(\d+d\d+(?: ?\+ ?\d+)?|\d+) ({DT}) damage',t):
        if (d,ty) not in dmg: dmg.append((d,ty))
    choice_dmg=re.search(rf'(\d+d\d+) ((?:{DT})(?:, (?:{DT}))*,? or (?:{DT})) damage',t)
    conds=[]; [conds.append(c) for c in re.findall(rf'(?:have|has|gains?|suffers?|be|is|becomes?|falls?) (?:the )?({COND}) condition',t) if c not in conds]
    area=re.search(r'(\d+)-foot(?:-radius|-tall|-wide|-long|-high)?,? (?:\d+-foot[- ]\w+ )?(Sphere|Cone|Cube|Line|Cylinder|Emanation)',t)
    heal=re.search(r'regains? (?:a number of )?Hit Points equal to ([^.;]+)',t) or re.search(r'regains? (\d+d\d+[^.;]*?) Hit Points',t)
    temp='Temporary Hit Points' in t
    half='half as much damage' in tl or 'half damage' in tl
    repeat='repeats the save' in tl
    summon=bool(sp.get('statblocks')) or 'stat block' in tl
    return dict(saves=saves,atk=atk,dmg=dmg,choice=choice_dmg.groups() if choice_dmg else None,conds=conds,area=area.groups() if area else None,heal=heal.group(1).strip() if heal else None,temp=temp,half=half,repeat=repeat,summon=summon,text=t)
MODAL={'can','must','will','would','should','may','might','could','don','didn','are','were','had','have','also'}
NOTVERB={'to','and','or','the','a','an','in','on','of','with','within','from','into','for','that','as','at','by','but','so','than','up','out','is','choose'}
def conj(v):
    if v in NOTVERB and v!='choose': return v
    if v=='choose': return 'chooses'
    if v in MODAL: return {'are':'is','were':'was','have':'has','don':'doesn'}.get(v,v)
    if re.search(r'(sh|ch|s|x|z|o)$',v): return v+'es'
    if re.search(r'[^aeiou]y$',v): return v[:-1]+'ies'
    return v+'s'
def third(s):
    s=re.sub(r'\b(You|you)(\s+)((?:[a-z]+ly\s+)?)([a-z]+)\b',lambda m:('The caster' if m.group(1)=='You' else 'the caster')+m.group(2)+m.group(3)+conj(m.group(4)),s)
    s=re.sub(r'\bYou\b','The caster',s); s=re.sub(r'\byou\b','the caster',s)
    s=s.replace('yourself','themself').replace('Yourself','Themself')
    s=re.sub(r'\bYour\b',"The caster's",s); s=re.sub(r'\byour\b',"the caster's",s)
    return s
def first_sentence(t):
    m=re.match(r'(.+?[.!?])(\s|$)',t)
    s=m.group(1) if m else t
    s=third(s)
    if len(s)>170: s=s[:167].rsplit(' ',1)[0]+'…'
    return s
def summary(sp,a):
    parts=[]
    area=f" in a {a['area'][0]}-ft {a['area'][1]}" if a['area'] else ''
    if a['atk']:
        p=f"{a['atk'].capitalize()} spell attack"
        if a['dmg']: p+=f"; on a hit {a['dmg'][0][0]} {a['dmg'][0][1]} damage"
        parts.append(p+'.')
    if a['saves']:
        p=f"{' or '.join(a['saves'])} save{area}"
        if a['dmg'] and not a['atk']:
            p+=f": {a['dmg'][0][0]} {a['dmg'][0][1]} on a failure" + (", half on a success" if a['half'] else '')
        elif a['choice'] and not a['atk']:
            p+=f": {a['choice'][0]} damage ({a['choice'][1]})" + (", half on a success" if a['half'] else '')
        if a['conds']: p+=('; ' if (a['dmg'] or a['choice']) else ': ')+'can impose '+', '.join(a['conds'])
        parts.append(p+'.')
    elif a['conds'] and not a['atk']:
        parts.append('Involves the '+', '.join(a['conds'])+' condition'+('s' if len(a['conds'])>1 else '')+'.')
    if a['heal']: parts.append(f"Restores Hit Points ({third(a['heal'][:70])}).")
    elif a['temp']: parts.append('Grants Temporary Hit Points.')
    if a['summon']: parts.append('Brings a creature into play that uses a stat block.' if sp.get('statblocks') else 'Involves a creature stat block.')
    if not a['atk'] and not a['saves'] and a['dmg']: parts.append(f"Deals {a['dmg'][0][0]} {a['dmg'][0][1]} damage (no attack roll or save named).")
    lead=first_sentence(a['text'])
    if not parts: return lead
    return lead+' '+' '.join(parts)
def guidance(sp,a):
    g=[]
    lvl=sp['level']
    if lvl==0: g.append("Cantrip: no spell slot is spent, so the caster can use it every turn.")
    else: g.append(f"Spend a level {lvl}+ spell slot ({sp['castingTime'].split(' or ')[0]}).")
    if sp['ritual']: g.append("Ritual tag: the caster can instead cast it as a Ritual, which takes 10 minutes longer and uses no spell slot (and so can't be upcast).")
    comp=sp['components']
    if 'M (' in comp:
        if re.search(r'worth [\d,]+\+ GP',comp): g.append("The Material component has a gold cost: confirm the caster actually has it"+(" — this casting consumes it." if 'consume' in comp else "."))
        else: g.append("Material component: a component pouch or spellcasting focus covers it.")
    if comp.startswith('V') : g.append("Verbal component: the caster must be able to speak (it fails in magical silence, and it ends a hidden caster's hiding).")
    g.append(f"Check range: {sp['range']}.")
    if a['atk']:
        g.append(f"Resolve with a {a['atk']} spell attack: the player rolls d20 + spell attack bonus against the target's AC. A natural 20 is a Critical Hit (roll the damage dice twice); a natural 1 misses.")
    if a['saves']:
        g.append(f"Each target rolls a {' or '.join(a['saves'])} saving throw against the caster's spell save DC. Roll for monsters yourself; players roll their own saves.")
        if a['half']: g.append("On a successful save the target still takes half the damage (round down).")
    if a['dmg'] or a['choice']:
        ty=sorted(set(t for d,t in a['dmg'])) if a['dmg'] else [a['choice'][1]]
        g.append("Damage type: "+', '.join(ty)+". Check the target for Resistance (halve), Vulnerability (double) or Immunity (none) before subtracting HP.")
    if a['conds']:
        g.append("Track the "+', '.join(a['conds'])+" condition on the target in Run Combat"+(", and remind the target to repeat the save when the text says so." if a['repeat'] else ", and note when the spell says it ends."))
    if a['heal']: g.append("Healing: the player rolls; add the result to current HP, never above the Hit Point maximum. Healing a creature at 0 HP brings it back to consciousness.")
    if a['temp']: g.append("Temporary Hit Points don't stack: a creature keeps the higher amount, and they are lost first when damage is taken.")
    if sp.get('statblocks'): g.append("Add the summoned creature as a combatant. Per the spell, it usually shares the caster's Initiative and acts right after them.")
    if sp['concentration']:
        g.append("Concentration: mark the caster as Concentrating. If they take damage, they make a Constitution save (DC 10 or half the damage, whichever is higher, max 30). Casting another Concentration spell ends this one.")
    dur=sp['duration']
    if dur not in ('Instantaneous',) and not sp['concentration']: g.append(f"Duration {dur}: write it down so the effect doesn't get forgotten.")
    if sp['higher']:
        g.append("Scaling: "+("damage grows at character levels 5, 11 and 17." if lvl==0 and 'levels 5' in sp['higher'] else "read 'Using a Higher-Level Spell Slot' if the caster spends a bigger slot." if lvl>0 else "see Cantrip Upgrade."))
    if not a['atk'] and not a['saves'] and not a['dmg'] and not a['heal']:
        g.append("No attack roll or save is named: the effect simply happens as written. If a creature tries to resist or work around it, decide whether a specific rule in the text applies before calling for an ability check.")
    return g
SL=[]
def slug(n): return re.sub(r'[^a-z0-9]+','-',n.lower().replace('’','')).strip('-')
for sp in spells:
    a=analyze(sp)
    tags=[]
    if a['atk']: tags.append('Attack')
    if a['saves']: tags+= [SAB[s]+' save' for s in a['saves']]
    if a['dmg'] or a['choice']: tags.append('Damage')
    if a['heal']: tags.append('Healing')
    if a['conds']: tags.append('Condition')
    if sp.get('statblocks'): tags.append('Summon')
    o=dict(id=slug(sp['name']),name=sp['name'],level=sp['level'],school=sp['school'],classes=sp['classes'],castingTime=sp['castingTime'],range=sp['range'],components=sp['components'],duration=sp['duration'],concentration=sp['concentration'],ritual=sp['ritual'],description=sp['description'],higher=sp['higher'],page=sp['page'],summary=summary(sp,a),guidance=guidance(sp,a),tags=tags)
    if sp.get('statblocks'): o['statblocks']=sp['statblocks']
    SL.append(o)
for w in weapons: w['id']=slug(w['name'])
GL=sec['glossary']
cond_keys=[k for k in GL if k.endswith('[Condition]')]
gloss_keys=['Ability Check','Advantage','Disadvantage','Attack [Action]','Bonus Action','Reaction','Action','Bloodied','Concentration','Cover','Critical Hit','D20 Test','Dash [Action]','Disengage [Action]','Dodge [Action]','Death Saving Throw','Difficult Terrain','Grappling','Help [Action]','Heroic Inspiration','Hide [Action]','Immunity','Influence [Action]','Initiative','Knocking Out a Creature','Long Rest','Magic [Action]','Opportunity Attacks','Passive Perception','Ready [Action]','Resistance','Vulnerability','Ritual','Search [Action]','Short Rest','Study [Action]','Surprise','Temporary Hit Points','Unarmed Strike','Utilize [Action]','Friendly [Attitude]','Indifferent [Attitude]','Hostile [Attitude]','Proficiency','Saving Throw','Spell Attack','Stable','Dead','Falling [Hazard]','Improvised Weapons','Speed','Weapon Attack']
gloss=[{'term':k,'text':GL[k],'kind':'condition' if k in cond_keys else 'rule'} for k in cond_keys+[g for g in gloss_keys if g in GL]]
missing=[g for g in gloss_keys if g not in GL]
play_keys=['Rolling 20 or 1','Advantage/Disadvantage','Combat Step by Step','Initiative','Your Turn','Opportunity Attacks','Damage Rolls','Critical Hits','Resistance and Vulnerability','Order of Application','Immunity','Healing','Dropping to 0 Hit Points','Instant Death','Falling Unconscious','Death Saving Throws','Stabilizing a Character','Temporary Hit Points','Hiding','Cover','Ranged Attacks in Close Combat']
playing=[{'term':k,'text':play[k],'kind':'core'} for k in play_keys if k in play]
MON=[]
for m in mons:
    j=' '.join(m['lines'])
    def g(p):
        mm=re.search(p+r' ([^;]+?)(?= (?:Immunities|Resistances|Vulnerabilities|Senses|Gear|Languages|Skills|CR)\b|$)',j); return mm.group(1) if mm else ''
    MON.append(dict(id=slug(m['name']),name=m['name'],meta=m['meta'],ac=m['ac'],init=m['init'],hp=m['hp'],hpText=m['hpText'],abilities=m['abilities'],lines=m['lines'],page=m['page'],res=g('Resistances'),vul=g('Vulnerabilities'),imm=g('Immunities')))
data=dict(source=dict(name='System Reference Document 5.2.1',short='SRD 5.2.1',url='https://www.dndbeyond.com/srd',pdf='https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf',license='https://creativecommons.org/licenses/by/4.0/legalcode',
 attribution='This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.'),
 spells=SL,weapons=weapons,weaponProps=sec['weaponProps'],glossary=gloss,playing=playing,monsters=MON)
open('/workspace/dm-atlas/src/data/srd.js','w').write('window.DM_SRD='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
print('spells',len(SL),'cantrips',sum(1 for s in SL if s['level']==0),'weapons',len(weapons),'gloss',len(gloss),'missing',missing,'playing',len(playing),'monsters',len(MON))
for n in ['Fireball','Magic Missile','Cure Wounds','Hold Person','Light','Detect Magic','Shield','Bless','Fire Bolt','Sleep']:
    s=[x for x in SL if x['name']==n][0]; print('---',n,'|',s['summary']); print('   ','\n    '.join(s['guidance']))
