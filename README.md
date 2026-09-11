# Unmatched box builder

A browser tool that generates print-ready Word doc templates for custom Unmatched deck
boxes and mini boxes. Drop in scans of the card back and character art, set the name
and colors, and it produces a .docx using the Tom Teaches templates.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The tool: character list, art drop zones, colour and nameplate controls, and a live preview of both nets. |
| `boxdoc.js` | Document generation — clones a character's table out of a template and swaps colours, names, nameplate and images. Also palette sampling and contrast/print checks. |
| `templates/deck-template.docx` | Deck box net. Never edited; cloned from. |
| `templates/mini-template.docx` | Mini box net. Never edited; cloned from. |
| `templates/mini-large-template.docx` | Extra-large mini box net. Never edited; cloned from. |
| `support.js` | Runtime for the HTML file. |
| `CLAUDE.md` | Working notes: how generation works and every decision that has been settled. |

## Running it

Open `index.html` in a browser. No build step, no dependencies to
install — JSZip loads from a CDN.

## How generation works

The generator never lays out a net from scratch. It opens the relevant template,
clones the `<w:tbl>` block for one character, and rewrites only what changes: the box
fill, the font colour, the name text, the sidekick line, the front nameplate, and the
embedded images with per-placement crops. All cell widths, row heights and border
codes come straight from the source document, so the printed net matches the original
exactly.

Two adjustments are made on top of the template:

- The deck net's bottom row is grown to match the depth of the top flap (which gains
  the page margin above it), with a dashed fold across its outer edge.
- Upside-down panels use a true 180° rotation instead of the template's Flip Vertical,
  which mirrored the glyphs, and those name boxes are re-centred in their cells.

## Mini box sizes

Some minis don't fit the standard box, so each character is set to **Standard** or
**Large**. The large net is a different template, not a scaled one: seven columns
instead of nine, a spine with two taped tabs rather than a zig-zag fold, a 2.50 × 3.30 in
card panel, and both the art and the nameplate turned 90° so the whole thing fits on one
page. A note explaining the spine is printed under each large net.

Because the two mini nets come from different templates, a mixed roster downloads three
documents: deck boxes, standard mini boxes, and large mini boxes.

`CLAUDE.md` has the full list of settled decisions and the verification recipe.

## Printing

Letter, landscape, at 100% — no "fit to page". Dotted lines are cuts, solid lines are
folds, and an X marks a piece to discard.
