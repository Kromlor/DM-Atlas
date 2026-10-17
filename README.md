# DM Atlas — 2024 D&D (5.5e) Dungeon Master Screen

**Live:** https://kromlor.github.io/DM-Atlas/

You can also open `index.html` directly in Chrome or Edge. It needs no install and no internet; only the official-rules links go online. All rules are D&D 2024 (5.5e) and use the SRD 5.2.1 only.

DM Atlas starts with **No campaign selected**. Pick a campaign on the Campaigns screen.

## Bundled campaigns
- **Aurelion — The Door Beneath the Castle** — `campaigns/aurelion-the-door-beneath-the-castle.dmatlas.json`. Includes 47 scenes, five NPCs, seven reveal maps, corrected checks, items and the Ember-Root Crawler stat block. **Campaign guide → Run Aurelion** provides scene navigation, clue/latch/evidence/consequence tracking, 18 player visuals and all 149 optimized pages from the four source books. Player visuals and map tiles appear only after the DM explicitly reveals them; DM book pages and handout pages containing DM instructions are never shown in that display. Current scene, notes, flags and reveal selection use the existing per-campaign saves. The Crawler can be added through the Bestiary or the D-33 encounter; its attacks and fire resistance populate the tracker. Recharge and retreat remain DM reminders.
- **Hollowmere Year One** — `campaigns/hollowmere-year-one.dmatlas.json`.
- **Vesperine & the Velvet Marches** (world: Carnelia; gateway: the Oathless Glass; main mystery: *The Black Kiss*; by DnD Bot). Campaign id `vesperine-and-the-velvet-marches`, file `campaigns/vesperine-and-the-velvet-marches.dmatlas.json`. It is built from DnD Bot's canonical **DM Atlas export** (`/workspace/dnd-world/dm-atlas-export/`) and uses the export's record ids. It includes:
  - 65 NPCs, 50 locations and 18 factions, cross-linked. There are 20 maps: ASCII maps, plus painted player-view maps with no labels, plus keyed schematic maps that are always DM-only.
  - The Black Kiss mystery board: suspects; 40 clues, each with where it is found and which suspect it points to; red herrings; riddles; the timeline; a 7-night clock the DM advances (saved per campaign); endings.
  - 19 adventures and 76 encounters. The adventures are the side adventures, the Thornwake lair, the solo entries, the Night 3 assassin, the Night 7 climax at the Hall of Vows (with lair actions and endings) and 6 adventure seeds.
  - Fights above the 2024 High budget are marked **☠ Deadly: flee or bargain** and list their ways out.
  - Each encounter has an **Add to tracker** button that uses the campaign bestiary or SRD 5.2.1 stat blocks. NPC foes resolve through their stat reference.
  - The Carnelia Bestiary (128 custom 2024 stat blocks), plus the 28 SRD 5.2.1 creatures the campaign cites.
  - A 58-entry read-aloud library and the player primer (`players.md`).
  - The DM guide (`dm.md`), plus the *Seats in the Glass* rules from the world guide.
  - The known-gaps list (DM-only; open and resolved).
  - Object portraits (the Oathless Glass).
  - The 5-adventure solo gamebook reader (37 entries, from `solo-entry-adventures.md`).
  - Progress saved under the old id `vesperine-velvet-marches` moves to the new id automatically.

All three campaigns are built into `index.html`, and their campaign JSON files can be re-imported.

## Visibility: player-safe / hidden until revealed / DM-only
Every export record (or field) is `player`, `gated` or `dm_only`. The importer precomputes a player-safe projection, and the player window reads **only** that projection plus whatever you have revealed.
- **Reveal controls.** Every gated record has a **Reveal** checkbox: on its NPC page, in the read-aloud library, and in the **Reveals** panel on the Player Handbook tab.
  - Revealing an NPC shows players their true name, their true-form or revealed-form portrait and the linked reveal read-aloud. Example: Thessaly's revealed portrait stays hidden until you reveal her.
  - For Caelum and Ilysse, revealing shows their mortal alias and its portrait.
  - Adventures can be **teased**: players see the title, hook, levels, region and tone only.
- **Disguised NPCs.** The six disguised fey and the disguised Night 3 assassin show only their public alias and cover portrait until revealed.
- **Maps.** A painted map follows its location's visibility; for example, the Thornwake Ballroom's painting is DM-only. Keyed schematic maps are never shown to players.
- **Pin-up portraits.** These are the DM-side default. They reach the player window only when you choose that for a specific NPC and confirm it. A gated pin-up also needs the reveal first.
- **Hiding NPCs.** Any NPC can be hidden from the player window.
- **DM-only content** never reaches the player window: secrets, the solution, unrevealed clues, riddle answers, the clock, endings, adventures, the bestiary, the DM maps, the gaps list and `dm.md`.

In the solo reader, **Group table mode** hides endings and riddle answers until you click to show them.

## Vesperine art (portraits, monster art, solo-book pictures)
Every served or bundled image has an **opaque file name** (`v/<20 hex chars>`, a salted hash). No true name appears in a file name, path, `src`, `alt` or `title`. In the player window, the alt text is the name the players know. The images are kept out of `index.html`. Load them in either of two ways:
1. **Art pack (works anywhere, including file://).** Go to Campaigns → **🖼 Import art pack** and pick `campaigns/vesperine-and-the-velvet-marches.dmatlas-art.json` (11.9 MB, 252 WebP images). The images are stored in this browser (IndexedDB). Re-importing replaces them.
2. **Art folder (automatic over http/https, e.g. GitHub Pages).** The images load from `art/vesperine-and-the-velvet-marches/v/<hash>.webp` with no import needed.

Imported pack images win over the folder.

## Refreshing when DnD Bot updates the export
1. Run `python3 tools/import_vesperine.py`. It does the following:
   - Runs the export's `_build/build_atlas.py` and `validate_atlas.py`, and prints their errors and warnings. It stops on validator errors unless you pass `--force`.
   - Rebuilds `src/data/vesperine.js`, the campaign JSON, the art pack and `art/…/v/`, removing stale art.
   - Rebuilds `index.html`.
   Options: `--export DIR`, `--no-export-build` (skip build_atlas.py), `--no-art`, `--no-app-build`. Same input gives byte-identical output.
2. Run the tests (see below), then commit and push. GitHub Pages redeploys on its own.
3. **For a DM who already uses the app** (on the live site, or with an older `index.html`):
   - Go to Campaigns → **Import campaign (.json)** and pick the new `vesperine-and-the-velvet-marches.dmatlas.json`.
   - Because the id matches, the preview shows **added / changed / removed** counts per collection. Choose **Update in place**.
   - Records are replaced by id. Your per-campaign state is kept: party, combat, notes, reveal toggles, the night clock, clues found, and hidden NPCs and portrait choices.
   - Re-import the art pack if the art changed.
   - A newer bundled version wins over an older imported copy automatically. **Revert to bundled version** drops an imported copy.

## Building
- Source lives in `src/` (data, content, JS, CSS, template). Rebuild with `python3 tools/build.py`, which writes `index.html`.
- Vesperine: `tools/import_vesperine.py` (see above). It uses `tools/vesp_md.py` (markdown → safe HTML, solo book) and `tools/vesp_bestiary.py` (cross-checks stat blocks). Raw PNG portraits are not committed.
- Data extraction: `tools/parse_*.py` read `srd/SRD_CC_v5.2.1.pdf`, and `tools/build_data.py` builds `src/data/srd.js`.

## Tests
Run `python3 -m http.server 8765` in this folder, then `NODE_PATH=/tmp/pt/node_modules node test/run_tests.js`.
- Results go to `test/results.json` and `test/test_output.txt`.
- Screenshots go to `test/shot-*.png`.
- The Vesperine checks are in `test/vesperine_group.js`.

## Multi-window sync
Multi-window sync (pop-out panels and the player window) is dependable only from an http(s) address, such as the live site or `python -m http.server 8000` followed by `http://localhost:8000/`. On file:// it is attempted but not guaranteed.

## Rebuilding Aurelion

Run `python3 tools/import_aurelion.py`, then `python3 tools/build.py`.
The importer reads `campaigns/aurelion-the-door-beneath-the-castle/source.json`; art is under `art/aurelion-the-door-beneath-the-castle/`. Keep that folder beside `index.html` for offline images. Other campaigns and their saves are not replaced. Use the original PDFs at 100% / Actual Size for precise physical map/token printing; these images are optimized for screen use.

Aurelion's additional DOM checks run with `node test/aurelion_dom.mjs` after installing `happy-dom`, or set `HAPPY_DOM_MODULE` to its module path. They cover all three campaign entries, preservation of existing saves, 47 scene views, 149 image paths, corrected Crawler attacks, campaign export data, and player reveal restrictions. These are DOM checks, not a visual browser-layout test.
