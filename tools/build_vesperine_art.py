#!/usr/bin/env python3
"""Build the Vesperine art pack: downscaled WebP copies of the NPC portraits, human guises, alternate
(pin-up) portraits, monster art and solo-book images, base64-encoded in one importable JSON file.
Usage: python3 tools/build_vesperine_art.py [--folder]   (--folder also writes art/<campaign>/<kind>/<slug>.webp)"""
import os, sys, io, json, base64, hashlib
from PIL import Image
SRC = '/workspace/dnd-world'; ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CID = 'vesperine-velvet-marches'
SETS = [('portrait', SRC + '/portraits', '.png', 640, 74), ('guise', SRC + '/portraits/human-guise', '.png', 640, 74),
        ('spicy', SRC + '/portraits/spicy', '.png', 640, 74), ('monster', SRC + '/bestiary/art', '.jpg', 480, 70), ('solo', SRC + '/solo-img', '.jpg', 640, 72)]
def main():
    folder = '--folder' in sys.argv
    images = {}; total = 0; counts = {}
    for kind, d, ext, width, q in SETS:
        for f in sorted(os.listdir(d)):
            if not f.endswith(ext): continue
            im = Image.open(os.path.join(d, f)).convert('RGB')
            h = round(im.height * width / im.width)
            im = im.resize((width, h), Image.LANCZOS)
            buf = io.BytesIO(); im.save(buf, 'WEBP', quality=q, method=6); b = buf.getvalue()
            key = kind + '/' + os.path.splitext(f)[0]
            images[key] = 'data:image/webp;base64,' + base64.b64encode(b).decode()
            total += len(b); counts[kind] = counts.get(kind, 0) + 1
            if folder:
                p = os.path.join(ROOT, 'art', CID, key + '.webp'); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').write(b)
    pack = dict(app='DM Atlas', format='dm-atlas-art', version=1, campaignId=CID, title='Vesperine & the Velvet Marches — art pack',
                note='Downscaled WebP copies (portraits 640px wide, monster art 480px) of the campaign art by DnD Bot. Import it in DM Atlas: Campaigns → Import art pack. Images are stored in this browser (IndexedDB).',
                counts=counts, images=images)
    pack['sha1'] = hashlib.sha1(json.dumps(images, sort_keys=True).encode()).hexdigest()
    out = os.path.join(ROOT, 'campaigns', CID + '.dmatlas-art.json')
    open(out, 'w').write(json.dumps(pack, separators=(',', ':')))
    print(counts, 'raw webp bytes', total, 'pack bytes', os.path.getsize(out))
main()
