# Unmatched deck/mini box builder — state

## Files
- `index.html` — the tool (UI + preview). Logic class holds the net maps. Named `index.html` (not `.dc.html`) so GitHub Pages serves it as the site root; edit it with plain string edits rather than the component tools.
- `boxdoc.js` — .docx generation, palette sampling, contrast/print checks.
- `templates/deck-template.docx`, `templates/mini-template.docx` — copies of the BoL3 originals. Never edited; the generator clones one character's `<w:tbl>` block out of them, so all cell geometry is byte-identical to the source.

## How generation works
`buildDoc(kind, templateBuf, characters, JSZip, {upright})` clones table index 1 (BLACKBEARD) per character and swaps: box fill `006666`, font colour `CC9900`, name text (template name `BLACKBEARD`), sidekick line (`Sea Dogs`; blank removes the paragraph), embedded images with per-placement `srcRect` crops.

Order inside the loop matters: fill/colour → plate anchor extracted to a token so `scaleNameRuns` skips it → sidekick → `replaceName` → `pinPileFont` → `applyPlate` → `clearOuterEdges` → `applyImages`.

## Settled decisions
- Names: Arial, auto-shrink relative to BLACKBEARD (10 chars) times a per-character nudge. Two lines via `<w:br/>`.
- Pile labels: Times New Roman, fixed 20pt, Wingdings arrows left (Discard) / right (Draw) — `pinPileFont` skips `<w:sym>` runs.
- Front nameplate (deck only): roundRect, white or black at adjustable opacity (75% default), position as a fraction of real slack so it can't cross a fold. Text is black on white / white on black, fixed 18pt default, independent of panel sizing, name forced onto ONE line and shrunk to fit (`platePt`, ~13 chars at 18pt). Sidekick line is 3pt smaller, not uppercased.
- Upside-down panels: deck r2c5 + r4c3, mini r0c6 + r2c2. Template used Flip Vertical (mirrors glyphs); generator converts to true 180° rotation. `uprightMethod` prop switches back to `flip`. Rotating about the box centre left those name boxes off-centre, so `centerRotatedNames` rewrites their `positionH` to `<wp:align>center</wp:align>`.
- Mini box reuses the deck FRONT image, with its own crop; mini colours always match the deck.
- Outer left/right table edges are blanked (`clearOuterEdges`) — they printed as stray full-height rules.
- Preview is white paper, black lines: dashed = cut, solid = fold, no line = continuous, X = discard piece. Border codes come from the template with TableGrid inheritance applied (a cell with no `tcBorders` override inherits SOLID).
- Nameplate runs on BOTH nets (the mini template has the same roundRect on its front panel, with no sidekick run). Geometry per kind in `PLATE_GEOMS` (`cap` = characters that fit at base size, `minPt` = shrink floor, `radiusPt`). Two sliders: deck text size (10-28, default 18) and mini text size (6-20, default 12). No x slider — the plate is always centred on the cell via `positionH` align; only y moves, as a fraction of real slack.
- Deck bottom row is grown from 432 to 767 twips (432 + the 335 twip top page margin) so the bottom flap matches the top flap's depth, with a dashed fold across its outer edge. Bottom page margin dropped to 360 so it can't tip onto page 2. No extra row is added.
- Corner tapers: the real cuts trim each tab back on a diagonal from a fold vertex out to a point on the tab's outer edge; the sliver between that diagonal and the template cut line is discarded. `TAPERS` in `boxdoc.js` lists 16 for the deck and 10 for the mini as `[colVertex, rowVertex, farLine, axis, sign, scaled?]` — grid-line indices, so a taper can span more than one cell (the mini's long corner chamfers do). `taperLines()` gives net-twip endpoints; sideways travel is clamped to the cell it crosses. Slider "Corner taper" (0-0.6 in, default 0.3, 0 = off).
- Each taper REPLACES one straight cell edge, so `taperEdges()` returns both the preview segment keys (dropped in `buildLines`) and the cell borders `blankTaperEdges` sets to `nil` — both sides, since TableGrid redraws anything a cell doesn't override.
- Deck top tabs continue into the 335-twip top page margin, so their tapers carry the `scaled` flag: the drawn inset is `marginScale = 432/767`, which puts them at the same angle as the bottom tabs.
- `applyTapers` writes dashed `prstGeom="line"` shapes into a collapsed body-level paragraph placed immediately BEFORE the table, positioned against the page. They must NOT be anchored inside a cell: Word and most converters then resolve `posOffset` against the cell's own frame, shifting every guide by the host cell's offset. They must also be `behindDoc="0"` — behind the document they render under the cell shading and only the stubs overhanging white paper are visible. `floatTable` normalises BOTH kinds to an explicit `tblpX` against the page (`horzAnchor="page"`) and zeroes `tblInd`: the deck template shipped `tblpXSpec="center"` (Word recomputes and rounds that itself) and the mini a `-275` `tblInd` Word applies on top of `tblpX` — either one leaves the grid a point or two off from `originX`, which showed as tapers starting just inside the next cell. Deck pins at x 396 / y 335, mini at x 445 / y 720, the same visual positions the templates had.
- `pinGrid` forces `<w:tblLayout w:type="fixed"/>` and `hRule="exact"` on every `trHeight`. The templates shipped neither: without them Word is in autofit (free to recompute column widths from cell content) and rows default to `atLeast` (free to grow), so the rendered grid drifts off the nominal twips the guides are computed from.
- Last resort for residual drift: per-character `guideNudge {x, y}` in points (sliders "Guide nudge X/Y", ±4pt / 0.25pt steps) offsets every guide shape. Should sit at 0; if a Word build needs it, the real grid and `NETS` disagree.
- `clearOuterEdges` is deck-only; the mini net keeps its solid left/right side cuts.
- Box colour defaults to `edgeColor` of the card back — the dominant colour in the outer 10% ring — so the panel blends into the card's border. Text colour then comes from `bestFont` against that. A front-art upload only re-picks the text colour; `autoPair` is used only when no back art is loaded.

## Known-good verification recipe
Run `buildDoc` in `run_script`, then assert on `word/document.xml`: plate anchor is the one containing `<a:solidFill>`; check its run sizes/colours, `<w:br/>` count 0, other anchors keep the character font colour, and `DOMParser` reports no parse error.

## Open / untested
- No real card scans have been run through it yet; auto-crop centring and the auto colour pair are unproven against actual artwork.
- The mini net's four unfilled cells (r0c5, r1c0, r1c8, r2c5) are genuinely blank in the template — not a bug.
