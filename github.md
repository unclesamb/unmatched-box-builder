repo: unclesamb/unmatched-box-builder
branch: main

## Last sync
date: 2026-09-11T00:00:00Z
Extra-large mini box support. Characters now carry a Standard/Large mini size, and the
large net is cloned from a third template (the Witcher file's page 3) rather than scaled:
seven columns, a two-tab spine, art and nameplate rotated 90°, theme-linked colours
normalised before the swaps, and a printed note under each net.

### Updated in this project
- New `templates/mini-large-template.docx` and `TPL.miniLarge` (7×3 grid, own tapers).
- Rotated nameplate geometry: `PLATE_GEOMS.miniLarge` is stated post-rotation and swaps
  the centring and travel axes; own text-size slider.
- `normalizeTheme` / `mergeSplitName` so the theme-linked template accepts colour and
  name swaps.
- Note under each large net as a page-anchored text box (in flow it wrapped beside the
  floated table and pushed the net off the page).
- Standard/Large toggle per character; mixed rosters download three documents.

## Screen map
| Project screen | Repo files |
| --- | --- |
| index.html | index.html, support.js |
| Document generation | boxdoc.js |
| Net geometry source | templates/deck-template.docx, templates/mini-template.docx, templates/mini-large-template.docx |

## Sync history
- 2026-09-11 — corner-taper guides fixed in Word (cell-anchored posOffset, `behindDoc`, autofit grid); guide nudge sliders added.
- 2026-09-10 — checked Pages build (no `.github/`; warning comes from default Jekyll build). Tool page renamed to `index.html` so Pages serves it as the site root; upstream `Unmatched Box Builder.dc.html` should be deleted. (.docx files don't appear in repo listings here but were confirmed present.)
- 2026-09-10 — first push: all files except README.md.
- 2026-09-10 — repository was empty; project files were the source of truth.
