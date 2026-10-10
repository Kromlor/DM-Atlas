# DM Atlas — 2024 D&D (5.5e) Dungeon Master Screen

**Live:** https://kromlor.github.io/DM-Atlas/

You can also open `index.html` directly in Chrome or Edge. It needs no install and no internet; only the official-rules links go online. All rules are D&D 2024 (5.5e) and use the SRD 5.2.1 only.

DM Atlas starts with **No campaign selected**. Pick a campaign on the Campaigns screen.

## Bundled campaigns
- **Hollowmere Year One** — `campaigns/hollowmere-year-one.dmatlas.json`.
- **Vesperine & the Velvet Marches** (world: Carnelia; gateway: the Oathless Glass; main adventure: *The Black Kiss*; by DnD Bot) — `campaigns/vesperine-velvet-marches.dmatlas.json`. It includes:
  - 12 chapters, 40 NPCs, 20 locations, 24 tables and 14 DM secrets.
  - The Carnelia Bestiary: 128 custom 2024 stat blocks you can add to the tracker and use in the attack flow.
  - A 5-adventure solo gamebook reader with clickable "go to N" links.
  - A player guide.
  - Creature names in the text that match the SRD 5.2.1 open the SRD stat block, using the 2024 names (thug → Tough, veteran → Warrior Veteran).

Both campaigns are built into `index.html`, and both files can be re-imported.

## Vesperine art (portraits, monster art, solo-book pictures)
The images are kept out of `index.html`. Load them in either of two ways:
1. **Art pack (works anywhere, including file:// on a jump drive).** Go to Campaigns → **🖼 Import art pack** and pick `campaigns/vesperine-velvet-marches.dmatlas-art.json` (5.3 MB, 180 WebP images). The images are stored in this browser (IndexedDB). You only need to import once per browser. The campaign card shows the art status and has a Remove art button.
2. **Art folder (automatic over http/https, e.g. GitHub Pages).** If `art/vesperine-velvet-marches/<kind>/<slug>.webp` sits next to `index.html`, the images load with no import. Kinds are `portrait`, `guise`, `spicy`, `monster` and `solo`. This works on the live site. It usually works from file:// too.

Imported pack images win over the folder.

### Portrait rules
- **Disguised fey.** The eight disguised fey show their **human guise** in the player window until you tick **Revealed** on their NPC page. The true form then replaces the guise, together with the reveal read-aloud.
- **Valentin, Nocturne and Marisol.** Their alternate (pin-up) portraits are the **DM-side default**. A toggle switches your screen to the standard portrait.
- **Pin-ups in the player window.** These portraits reach the player window only when you tick "Show the alternate portrait in the player window" and confirm it.
- **Hiding NPCs.** Any NPC can be hidden from the player window.

### What the player window shows
Players see only the player guide: content compass, world overview, maps, read-alouds, session zero, names & rumors, places and faces. All of the following stay DM-only:
- Secret agendas.
- The murder solution.
- Glamours & reveals.
- Parts 7–8.
- The bestiary.
- The solo-book endings.

In the solo reader, **Group table mode** hides endings and riddle answers until you click to show them.

## Building
- Source lives in `src/` (data, content, JS, CSS, template). Rebuild with `python3 tools/build.py`, which writes `index.html`.
- Vesperine is built from the campaign source folder (`/workspace/dnd-world`):
  - `python3 tools/build_vesperine.py` creates `src/data/vesperine.js` and the campaign JSON. It uses `tools/vesp_bestiary.py`, which cross-checks every stat block against the bestiary YAML.
  - `python3 tools/build_vesperine_art.py --folder` creates the art pack and the `art/` folder (portraits 640 px, monsters 480 px, WebP). The raw PNG portraits are not committed.
- Data extraction: `tools/parse_*.py` read `srd/SRD_CC_v5.2.1.pdf`, and `tools/build_data.py` builds `src/data/srd.js`.

## Tests
Run `python3 -m http.server 8765` in this folder, then `NODE_PATH=/tmp/pt/node_modules node test/run_tests.js`.
- Results go to `test/results.json` and `test/test_output.txt`.
- Screenshots go to `test/shot-*.png`.
- The Vesperine checks are in `test/vesperine_group.js`.

## Multi-window sync
Multi-window sync (pop-out panels and the player window) is dependable only from an http(s) address, such as the live site or `python -m http.server 8000` followed by `http://localhost:8000/`. On file:// it is attempted but not guaranteed.
