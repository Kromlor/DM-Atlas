#!/usr/bin/env python3
"""Build the single-file DM Atlas HTML from src/."""
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = lambda *p: os.path.join(ROOT, 'src', *p)
ORDER = ['data/srd.js', 'data/hollowmere.js', 'data/vesperine.js', 'content/lessons.js', 'content/course.js', 'content/adventure.js', 'content/rollguide.js',
         'js/core.js', 'js/rules.js', 'js/ui.js', 'js/art.js', 'js/v_guide.js', 'js/v_rules.js', 'js/combat.js', 'js/v_party.js', 'js/attack.js', 'js/v_tracker.js', 'js/v_tools.js', 'js/v_campaigns.js', 'js/app.js']
def main():
    tpl = open(S('template.html'), encoding='utf-8').read()
    css = open(S('css/app.css'), encoding='utf-8').read()
    parts = []
    for f in ORDER:
        js = open(S(f), encoding='utf-8').read()
        js = re.sub(r'if \(typeof module !== .undefined.\) module\.exports = .*?;\s*$', '', js, flags=re.M)
        if re.search(r'</script', js, re.I): js = re.sub(r'</(script)', r'<\\/\1', js, flags=re.I)
        parts.append('<script>/* %s */\n%s\n</script>' % (f, js))
    html = tpl.replace('/*CSS*/', css).replace('<!--SCRIPTS-->', '\n'.join(parts))
    out = os.path.join(ROOT, 'index.html')
    open(out, 'w', encoding='utf-8').write(html)
    print('wrote', out, os.path.getsize(out), 'bytes')
    # syntax check each script with node
    for f in ORDER:
        r = subprocess.run(['node', '--check', S(f)], capture_output=True, text=True)
        if r.returncode: print('SYNTAX ERROR', f, r.stderr); sys.exit(1)
    print('syntax ok')
main()
