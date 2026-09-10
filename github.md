repo: unclesamb/unmatched-box-builder
branch: main

## Last sync
date: 2026-09-10T18:22:00Z
Checked the repo for a Pages build workflow: there is no `.github/` directory, so the
deprecated Node 20 warning comes from GitHub Pages' default Jekyll build, not from this
repo. Nothing to update here; switching Pages to "GitHub Actions" as its source with an
up-to-date static-deploy workflow would silence it.

Renamed the tool page to `index.html` so Pages serves it as the site root. Upstream still
has it as `Unmatched Box Builder.dc.html` — delete that file when uploading `index.html`.
(Note: .docx files do not appear in repo file listings here because they are not readable
as text or assets; they were confirmed present directly.)

### Updated in this project
- Deck bottom row grown to 767 twips with a dashed fold across its outer edge.
- Front nameplate now generated on the mini net too, with its own text-size slider.
- Nameplate always centred on its cell; upside-down name boxes re-centred after rotation.
- Box colour defaults to the dominant colour in the card back's outer ring.

## Screen map
| Project screen | Repo files |
| --- | --- |
| index.html | index.html, support.js |
| Document generation | boxdoc.js |
| Net geometry source | templates/deck-template.docx, templates/mini-template.docx |

## Sync history
- 2026-09-10 — first push: all files except README.md.
- 2026-09-10 — repository was empty; project files were the source of truth.
