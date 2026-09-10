// Generates Unmatched deck-box / mini-box Word documents from the existing BoL3 templates.
// Strategy: clone one character's table block out of the template document, then per character
// swap colours, name text, subtitle, font sizes and embedded images.

const TPL = {
  deck: {
    url: 'templates/deck-template.docx',
    name: 'BLACKBEARD',
    fill: '006666',
    color: 'CC9900',
    faction: 'Sea Dogs',
    blockIndex: 1,
    // old rId in the template block -> which uploaded image fills it
    images: { rId8: 'back', rId9: 'front' }
  },
  mini: {
    url: 'templates/mini-template.docx',
    name: 'BLACKBEARD',
    fill: '006666',
    color: 'CC9900',
    faction: null,
    blockIndex: 1,
    images: { rId5: 'front' }
  }
};

export const TEMPLATES = TPL;

export async function loadTemplate(kind) {
  const res = await fetch(TPL[kind].url);
  if (!res.ok) throw new Error('Could not load template ' + TPL[kind].url);
  return res.arrayBuffer();
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rand8() {
  return Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase().padStart(8, '0');
}

function findTables(xml) {
  const out = [];
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>/g;
  let m;
  while ((m = re.exec(xml))) out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

function uniquify(block, counter) {
  return block
    .replace(/w14:paraId="[0-9A-F]{8}"/g, () => `w14:paraId="${rand8()}"`)
    .replace(/w14:textId="[0-9A-F]{8}"/g, () => `w14:textId="${rand8()}"`)
    .replace(/(<wp:docPr id=")\d+(")/g, (m, a, b) => a + counter.n++ + b)
    .replace(/(<pic:cNvPr id=")\d+(")/g, (m, a, b) => a + counter.n++ + b)
    .replace(/(o:spid="_x0000_s)\d+(")/g, (m, a, b) => a + counter.s++ + b);
}

// Scale font sizes on any run that carries the template name, so long names shrink to fit.
function scaleNameRuns(block, tplName, factor) {
  if (Math.abs(factor - 1) < 0.001) return block;
  return block.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => {
    if (run.indexOf('>' + tplName + '<') === -1) return run;
    return run.replace(/<w:(sz|szCs) w:val="(\d+)"\/>/g, (m, t, v) => {
      const half = Math.max(14, Math.round((Number(v) * factor) / 2) * 2);
      return `<w:${t} w:val="${half}"/>`;
    });
  });
}

// The template's Draw Pile / Discard Pile labels inherit the theme font; pin them to Times New Roman.
function pinPileFont(block) {
  return block.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => {
    if (run.indexOf('<w:sym ') > -1) return run;
    if (!/>(?:[^<]*)(?:Discard|Draw|Pile)(?:[^<]*)</.test(run)) return run;
    const font = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>';
    if (/<w:rFonts[^>]*\/>/.test(run)) return run.replace(/<w:rFonts[^>]*\/>/, font);
    if (run.indexOf('<w:rPr>') > -1) return run.replace('<w:rPr>', '<w:rPr>' + font);
    return run.replace(/(<w:r\b[^>]*>)/, '$1<w:rPr>' + font + '</w:rPr>');
  });
}

function replaceName(block, tplName, lines) {
  const body = lines
    .map((l, i) => (i ? '<w:br/>' : '') + `<w:t xml:space="preserve">${esc(l)}</w:t>`)
    .join('');
  const re = new RegExp('<w:t(?: [^>]*)?>' + tplName + '</w:t>', 'g');
  return block.replace(re, body);
}

// Removes the innermost <w:p> that holds the faction line (appears twice: Choice + Fallback).
function dropSubtitle(block, tplFaction) {
  let out = block;
  for (let guard = 0; guard < 8; guard++) {
    const at = out.indexOf('>' + tplFaction + '<');
    if (at === -1) break;
    const start = out.lastIndexOf('<w:p ', at);
    const endTag = out.indexOf('</w:p>', at);
    if (start === -1 || endTag === -1) break;
    out = out.slice(0, start) + out.slice(endTag + 6);
  }
  return out;
}

// Centre-crop percentages (Word srcRect units: 1/1000 of a percent) so the source region
// matches the panel's aspect ratio, with optional zoom / offset from the crop editor.
export function computeSrcRect(srcW, srcH, cx, cy, crop) {
  const zoom = Math.max(1, (crop && crop.zoom) || 1);
  const ox = (crop && crop.offsetX) || 0;
  const oy = (crop && crop.offsetY) || 0;
  const target = cx / cy;
  const source = srcW / srcH;
  let fw = 1;
  let fh = 1;
  if (source > target) fw = target / source;
  else fh = source / target;
  fw /= zoom;
  fh /= zoom;
  const slackX = (1 - fw) / 2;
  const slackY = (1 - fh) / 2;
  const cxo = slackX * Math.max(-1, Math.min(1, ox));
  const cyo = slackY * Math.max(-1, Math.min(1, oy));
  const pct = (v) => Math.max(0, Math.round(v * 100000));
  return {
    l: pct(slackX + cxo),
    r: pct(slackX - cxo),
    t: pct(slackY + cyo),
    b: pct(slackY - cyo),
    frac: { w: fw, h: fh, x: slackX + cxo, y: slackY + cyo }
  };
}

function applyImages(block, imageMap, specs) {
  return block.replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, (draw) => {
    if (draw.indexOf('<pic:pic') === -1) return draw;
    const embed = (draw.match(/r:embed="(rId\d+)"/) || [])[1];
    const slot = imageMap[embed];
    const spec = slot && specs[slot];
    if (!spec) return draw;
    const ext = draw.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/);
    let out = draw.replace(/r:embed="rId\d+"/g, `r:embed="${spec.relId}"`);
    if (ext) {
      const sr = computeSrcRect(spec.width, spec.height, Number(ext[1]), Number(ext[2]), spec.crop);
      const tag = `<a:srcRect l="${sr.l}" t="${sr.t}" r="${sr.r}" b="${sr.b}"/>`;
      out = /<a:srcRect[^>]*\/>/.test(out)
        ? out.replace(/<a:srcRect[^>]*\/>/g, tag)
        : out.replace(/<a:stretch>/g, tag + '<a:stretch>');
    }
    return out;
  });
}

// The front nameplate: a roundRect filled bg1 @75% in the template. Retint, re-alpha,
// and nudge its anchor offsets without touching the other (unfilled) name shapes.
// Front nameplate geometry, in EMU, as placed in the deck template. The preview reads
// these too, so on-screen travel matches the shape's real travel on the page.
export const PLATE_GEOMS = {
  deck: {
    panelW: 2423160, panelH: 3291840,
    w: 1934845, h: 588010,
    baseX: 243205, baseY: 2611755,
    // ~13 characters fit on the deck plate at its base size; the mini plate is narrower.
    cap: 13, radiusPt: 11, minPt: 9
  },
  mini: {
    panelW: 1431784, panelH: 2281747,
    w: 1078230, h: 428625,
    baseX: 231775, baseY: 1727835,
    cap: 7, radiusPt: 8, minPt: 6
  }
};
Object.values(PLATE_GEOMS).forEach((g) => {
  // The plate always sits horizontally centred on the panel; only the template's own
  // x position differs, so keep it for computing the shape's real travel.
  g.tplX = g.baseX;
  g.baseX = Math.round((g.panelW - g.w) / 2);
  g.centerDx = g.baseX - g.tplX;
  g.slackRight = g.panelW - g.w - g.baseX;
  g.slackLeft = g.baseX;
  g.slackDown = g.panelH - g.h - g.baseY;
  g.slackUp = g.baseY;
});
export const PLATE_GEOM = PLATE_GEOMS.deck;

// Offsets are -1..1 of the available slack in that direction, so the plate can never
// cross the fold line onto a neighbouring panel.
export function plateShift(plate, kind) {
  const g = PLATE_GEOMS[kind] || PLATE_GEOMS.deck;
  const ox = Math.max(-1, Math.min(1, (plate && plate.offsetX) || 0));
  const oy = Math.max(-1, Math.min(1, (plate && plate.offsetY) || 0));
  return {
    dx: g.centerDx + Math.round(ox >= 0 ? ox * g.slackRight : ox * g.slackLeft),
    dy: Math.round(oy >= 0 ? oy * g.slackDown : oy * g.slackUp)
  };
}

// The plate holds the name on ONE line, shrinking to fit; ~13 characters fit on the
// deck plate at 18pt, ~7 on the narrower mini plate.
export function platePt(fontSize, nameLen, kind) {
  const base = fontSize || 18;
  const g = PLATE_GEOMS[kind] || PLATE_GEOMS.deck;
  // Auto-shrink has a floor, but never overrides a smaller size set by hand.
  return Math.max(Math.min(g.minPt, base), Math.round(base * Math.min(1, g.cap / Math.max(1, nameLen))));
}

function applyPlate(block, plate, kind) {
  if (!plate) return block;
  const hex = (plate.tint === 'black' ? '000000' : 'FFFFFF');
  const alpha = Math.round(Math.max(0, Math.min(1, plate.opacity)) * 100000);
  const dy = plateShift(plate, kind).dy;
  // Scope every change to the one anchored shape that actually carries a fill.
  return block.replace(/<wp:anchor[\s\S]*?<\/wp:anchor>/g, (anchor) => {
    if (anchor.indexOf('<a:solidFill>') === -1) return anchor;
    let a = anchor
      .replace(
        /<a:solidFill><a:schemeClr val="bg1">\s*<a:alpha val="\d+"\/>\s*<\/a:schemeClr><\/a:solidFill>/g,
        `<a:solidFill><a:srgbClr val="${hex}"><a:alpha val="${alpha}"/></a:srgbClr></a:solidFill>`
      )
      .replace(
        /<a:solidFill><a:srgbClr val="[0-9A-Fa-f]{6}"><a:alpha val="\d+"\/><\/a:srgbClr><\/a:solidFill>/g,
        `<a:solidFill><a:srgbClr val="${hex}"><a:alpha val="${alpha}"/></a:srgbClr></a:solidFill>`
      )
      .replace(/<v:fill[^>]*\/>/g,
        `<v:fill color="#${hex.toLowerCase()}" opacity="${Math.round((alpha / 100000) * 65536)}f"/>`);
    // Centred on the cell rather than nudged from the template's own x offset.
    a = a.replace(/<wp:positionH([^>]*)>[\s\S]*?<\/wp:positionH>/,
      '<wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>');
    if (dy) a = a.replace(/(<wp:positionV[^>]*><wp:posOffset>)(-?\d+)(<\/wp:posOffset>)/,
      (m, p, v, s) => p + (Number(v) + dy) + s);
    const ink = plate.tint === 'black' ? 'FFFFFF' : '000000';
    // Name lines collapse to a single line on the plate.
    a = a.replace(/<\/w:t><w:br\/><w:t xml:space="preserve">/g, ' ');
    const nameText = (plate.nameText || '').trim();
    const basePt = kind === 'mini' ? (plate.miniFontSize || 12) : (plate.fontSize || 18);
    const namePt = platePt(basePt, Math.max(1, nameText.length), kind);
    const nameHalf = Math.round(namePt * 2);
    const subHalf = Math.round(Math.max(6, namePt - 3) * 2);
    // The template's plate runs carry no <w:color> at all, so the ink has to be inserted;
    // the sidekick line sits 3pt under the name.
    // Size by run identity, not by the run's current value, so an earlier rewrite
    // of the panel name sizes cannot leave the plate stranded.
    a = a.replace(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g, (run) => {
      const t = [...run.matchAll(/<w:t[^>]*>([^<]*)</g)].map((m) => m[1]).join('');
      if (!t.trim()) return run;
      const half = t.trim() === nameText ? nameHalf : subHalf;
      let out = run
        .replace(/<w:sz w:val="\d+"\/>/g, `<w:sz w:val="${half}"/>`)
        .replace(/<w:szCs w:val="\d+"\/>/g, `<w:szCs w:val="${half}"/>`);
      if (out.indexOf('<w:sz ') === -1) {
        const tag = `<w:sz w:val="${half}"/><w:szCs w:val="${half}"/>`;
        out = out.indexOf('<w:rPr>') > -1
          ? out.replace('<w:rPr>', '<w:rPr>' + tag)
          : out.replace(/(<w:r(?:\s[^>]*)?>)/, '$1<w:rPr>' + tag + '</w:rPr>');
      }
      return out;
    });
    a = a.replace(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g, (run, inner) => {
      if (run.indexOf('<w:t') === -1) return run;
      if (/<w:color w:val="[0-9A-Fa-f]{6}"\/>/.test(run)) {
        return run.replace(/<w:color w:val="[0-9A-Fa-f]{6}"\/>/g, `<w:color w:val="${ink}"/>`);
      }
      if (run.indexOf('<w:rPr>') > -1) {
        return run.replace('<w:rPr>', `<w:rPr><w:color w:val="${ink}"/>`);
      }
      return run.replace(/(<w:r(?:\s[^>]*)?>)/, `$1<w:rPr><w:color w:val="${ink}"/></w:rPr>`);
    });
    return a;
  });
}

// The bottom flap needs the same depth as the top flap, which gets the top row plus the
// page margin above it. There is no margin below, so the bottom row is simply grown by
// that much and its outer edge carries the dashed fold all the way across.
const BOTTOM_ROW_TWIPS = 767; // 432 (row as drawn) + 335 (the page-anchor gap at the top)
function growBottomRow(block) {
  const all = block.match(/<w:tr\b[\s\S]*?<\/w:tr>/g);
  if (!all || !all.length) return block;
  const last = all[all.length - 1];
  let row = last.replace(/<w:trHeight[^>]*>/, '<w:trHeight w:val="' + BOTTOM_ROW_TWIPS + '"/>');
  row = row.replace(/<w:tc>([\s\S]*?)<\/w:tc>/g, (tc, inner) => {
    const fold = '<w:bottom w:val="dashed" w:sz="4" w:space="0" w:color="auto"/>';
    if (!/<w:tcBorders>/.test(inner)) {
      return '<w:tc>' + inner.replace('<w:tcPr>', '<w:tcPr><w:tcBorders>' + fold + '</w:tcBorders>') + '</w:tc>';
    }
    return '<w:tc>' + inner.replace(/<w:tcBorders>([\s\S]*?)<\/w:tcBorders>/, (m, b) =>
      '<w:tcBorders>' + (/<w:bottom\b[^>]*>/.test(b) ? b.replace(/<w:bottom\b[^>]*>/, fold) : b + fold) + '</w:tcBorders>'
    ) + '</w:tc>';
  });
  return block.replace(last, row);
}

// Rotating a panel 180° turns its text box about the box centre, which is not the cell
// centre — the template's own offsets put it slightly off. Centre those boxes in the cell.
function centerRotatedNames(block) {
  return block.replace(/<wp:anchor[\s\S]*?<\/wp:anchor>/g, (anchor) => {
    if (anchor.indexOf('rot="10800000"') === -1) return anchor;
    return anchor.replace(
      /<wp:positionH([^>]*)>[\s\S]*?<\/wp:positionH>/,
      '<wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>'
    );
  });
}

// The deck table's outer left/right edges print as stray full-height rules; clear them.
// (The mini net keeps its side cuts.)
function clearOuterEdges(block) {
  return block.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (row) => {
    const cells = row.match(/<w:tc>[\s\S]*?<\/w:tc>/g);
    if (!cells || !cells.length) return row;
    const blank = (cell, side) => {
      const tag = `<w:${side} w:val="nil" w:sz="0" w:space="0" w:color="auto"/>`;
      if (!/<w:tcBorders>/.test(cell)) {
        return cell.replace('<w:tcPr>', '<w:tcPr><w:tcBorders>' + tag + '</w:tcBorders>');
      }
      const re = new RegExp('<w:' + side + '[^>]*/>');
      return re.test(cell)
        ? cell.replace(re, tag)
        : cell.replace('<w:tcBorders>', '<w:tcBorders>' + tag);
    };
    let out = row.replace(cells[0], blank(cells[0], 'left'));
    const last = cells[cells.length - 1];
    return out.replace(last, blank(last, 'right'));
  });
}

function mimeExt(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/gif') return 'gif';
  return 'jpeg';
}

/**
 * characters: [{ nameLines:[], subtitle, boxColor, fontColor, sizeNudge,
 *                front:{blob,width,height,crop}, back:{blob,width,height,crop} }]
 */
export async function buildDoc(kind, templateBuf, characters, JSZip, opts) {
  const upright = (opts && opts.upright) || 'rotate';
  const tpl = TPL[kind];
  const zip = await JSZip.loadAsync(templateBuf);
  const xml = await zip.file('word/document.xml').async('string');
  const tables = findTables(xml);
  if (tables.length < 4) throw new Error('Unexpected template structure');

  const source = tables[tpl.blockIndex].text;
  const pre = xml.slice(0, tables[0].start);
  const sep = xml.slice(tables[0].end, tables[1].start);
  const post = xml.slice(tables[tables.length - 1].end);

  Object.keys(zip.files).forEach((f) => {
    if (f.startsWith('word/media/')) zip.remove(f);
  });

  let rels = await zip.file('word/_rels/document.xml.rels').async('string');
  rels = rels.replace(/<Relationship [^>]*\/relationships\/image"[^>]*\/>/g, '');

  const counter = { n: 900, s: 3000 };
  const exts = new Set();
  const blocks = [];

  for (let i = 0; i < characters.length; i++) {
    const c = characters[i];
    const specs = {};
    for (const slot of new Set(Object.values(tpl.images))) {
      const img = c[slot] || c.front;
      if (!img || !img.blob) throw new Error(`Missing ${slot} image for character ${i + 1}`);
      const ext = mimeExt(img.blob.type);
      exts.add(ext);
      const relId = `rIdG${i}${slot === 'front' ? 'F' : 'B'}`;
      const target = `media/gen${i}${slot}.${ext}`;
      zip.file('word/' + target, img.blob);
      rels = rels.replace(
        '</Relationships>',
        `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/></Relationships>`
      );
      specs[slot] = { relId, width: img.width, height: img.height, crop: img.crop };
    }

    const lines = (c.nameLines || []).map((l) => l.trim()).filter(Boolean);
    const longest = lines.reduce((a, l) => Math.max(a, l.length), 1);
    const fit = Math.min(1, tpl.name.length / longest);
    const factor = fit * (c.sizeNudge || 1);

    let b = uniquify(source, counter);
    b = b.replace(new RegExp(`w:fill="${tpl.fill}"`, 'g'), `w:fill="${c.boxColor.replace('#', '').toUpperCase()}"`);
    b = b.replace(
      new RegExp(`w:color w:val="${tpl.color}"`, 'g'),
      `w:color w:val="${c.fontColor.replace('#', '').toUpperCase()}"`
    );
    // The plate is sized independently, so keep it out of the panel auto-shrink.
    const plateAnchor = (b.match(/<wp:anchor[\s\S]*?<\/wp:anchor>/g) || [])
      .find((x) => x.indexOf('<a:solidFill>') > -1);
    const TOKEN = '\u0001PLATE\u0001';
    if (plateAnchor) b = b.replace(plateAnchor, TOKEN);
    b = scaleNameRuns(b, tpl.name, factor);
    if (plateAnchor) b = b.replace(TOKEN, plateAnchor);
    if (tpl.faction) {
      if (c.subtitle && c.subtitle.trim()) {
        b = b.replace(new RegExp('>' + tpl.faction + '<', 'g'), '>' + esc(c.subtitle.trim()) + '<');
      } else {
        b = dropSubtitle(b, tpl.faction);
      }
    }
    b = replaceName(b, tpl.name, lines.length ? lines : ['UNNAMED']);
    if (upright === 'rotate') {
      // The template turns two panels upside down with Flip Vertical, which mirrors the
      // glyphs. A true 180° shape rotation reads correctly when the net is turned.
      b = b.replace(/<a:xfrm flipV="1">/g, '<a:xfrm rot="10800000">').replace(/;flip:y;/g, ';rotation:180;');
      b = centerRotatedNames(b);
    }
    b = pinPileFont(b);
    // Both nets carry the same roundRect nameplate on the front panel; the mini one
    // has no sidekick run in the template, so it just gets the name.
    b = applyPlate(b, Object.assign({}, c.plate, { nameText: lines.join(' ') }), kind);
    if (kind === 'deck') b = growBottomRow(b);
    if (kind === 'deck') b = clearOuterEdges(b);
    b = applyImages(b, tpl.images, specs);
    blocks.push(b);
  }

  zip.file('word/_rels/document.xml.rels', rels);
  // The net sits low on the page; a narrower bottom margin keeps the grown bottom row
  // from tipping the table onto a second page.
  const doc = (pre + blocks.join(sep) + post)
    .replace(/(<w:pgMar[^>]*\sw:bottom=")\d+(")/g, '$1' + 360 + '$2');
  zip.file('word/document.xml', doc);

  let ct = await zip.file('[Content_Types].xml').async('string');
  for (const e of exts) {
    if (ct.indexOf(`Extension="${e}"`) === -1) {
      const type = e === 'png' ? 'image/png' : e === 'gif' ? 'image/gif' : 'image/jpeg';
      ct = ct.replace('<Default Extension="rels"', `<Default Extension="${e}" ContentType="${type}"/><Default Extension="rels"`);
    }
  }
  zip.file('[Content_Types].xml', ct);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

// ---- palette sampling ---------------------------------------------------

export function samplePalette(imageData, count = 8) {
  const buckets = new Map();
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    let e = buckets.get(key);
    if (!e) buckets.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
    e.n++; e.r += r; e.g += g; e.b += b;
  }
  const list = [...buckets.values()]
    .map((e) => ({ n: e.n, r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n) }))
    .sort((a, b) => b.n - a.n);
  const picked = [];
  for (const c of list) {
    if (picked.length >= count) break;
    if (picked.some((p) => Math.abs(p.r - c.r) + Math.abs(p.g - c.g) + Math.abs(p.b - c.b) < 60)) continue;
    picked.push(c);
  }
  return picked.map((c) => '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase());
}

// The box colour should disappear into the card's own border, so sample the dominant
// colour of an outer ring of the card back rather than the whole image.
export function edgeColor(imageData, ringFrac = 0.1) {
  const w = imageData.width, h = imageData.height, d = imageData.data;
  const band = Math.max(1, Math.round(Math.min(w, h) * ringFrac));
  const buckets = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= band && y >= band && x < w - band && y < h - band) continue;
      const i = (y * w + x) * 4;
      if (d[i + 3] < 200) continue;
      const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      let e = buckets.get(key);
      if (!e) buckets.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
      e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2];
    }
  }
  let top = null;
  buckets.forEach((e) => { if (!top || e.n > top.n) top = e; });
  if (!top) return null;
  return '#' + [top.r, top.g, top.b]
    .map((v) => Math.round(v / top.n).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function relLuminance(hex) {
  const v = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => {
    const s = parseInt(v.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a, b) {
  const la = relLuminance(a), lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Rough check for colours that misbehave in CMYK print: very saturated near-primaries
// and very light values that vanish on paper.
export function printNote(hex) {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  if (max > 245 && sat > 0.8) return 'Very saturated — may shift in CMYK print';
  if (relLuminance(hex) > 0.85) return 'Very light — little ink on paper';
  if (relLuminance(hex) < 0.02) return 'Near black — heavy ink coverage';
  return null;
}
