repo: unclesamb/unmatched-box-builder
branch: main

## Last sync
date: 2026-09-11T00:00:00Z
Corner-taper guides fixed so they land on the net in Word. Three separate causes, all in
`boxdoc.js`: the guide shapes were anchored inside a table cell (Word resolves posOffset
against the cell frame, shifting every guide by that cell's offset), they were
`behindDoc="1"` (drawn under the cell shading, so only stubs overhanging white paper were
visible), and the tables were in autofit with `atLeast` row heights, letting the rendered
grid drift off the nominal twips the guides are computed from.

### Updated in this project
- Guides moved to a collapsed body-level paragraph ahead of the table, `behindDoc="0"`.
- Both tables pinned to explicit page coordinates with `tblInd` zeroed.
- `tblLayout` forced to `fixed` and every `trHeight` to `hRule="exact"`.
- New per-character Guide nudge X/Y sliders (±4pt) as a calibration valve.
- README opening paragraph rewritten.

## Screen map
| Project screen | Repo files |
| --- | --- |
| index.html | index.html, support.js |
| Document generation | boxdoc.js |
| Net geometry source | templates/deck-template.docx, templates/mini-template.docx |

## Sync history
- 2026-09-10 — checked Pages build (no `.github/`; warning comes from default Jekyll build). Tool page renamed to `index.html` so Pages serves it as the site root; upstream `Unmatched Box Builder.dc.html` should be deleted. (.docx files don't appear in repo listings here but were confirmed present.)
- 2026-09-10 — first push: all files except README.md.
- 2026-09-10 — repository was empty; project files were the source of truth.
