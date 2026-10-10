# DM Atlas — 2024 D&D (5.5e) Dungeon Master Screen

Open `DM_Atlas_5_5e.html` in Chrome or Edge. It needs no install and no internet; only the official-rules links go online.

- Source: `src/` (data, content, JS, CSS, template). Rebuild with `python3 tools/build.py`.
- Data extraction: `tools/parse_*.py` read `srd/SRD_CC_v5.2.1.pdf`; `tools/build_data.py` builds `src/data/srd.js`.
- Campaign: `campaigns/hollowmere-year-one.dmatlas.json` (bundled; re-importable).
- Tests: `python3 -m http.server 8765` in this folder, then `NODE_PATH=/tmp/pt/node_modules node test/run_tests.js`. Results go to `test/results.json` and `test/test_output.txt`; screenshots go to `test/shot-*.png`.
- Multi-window sync is dependable only from an http(s) address, for example `python -m http.server 8000` and then `http://localhost:8000/DM_Atlas_5_5e.html`. On file:// it is attempted but not guaranteed.
