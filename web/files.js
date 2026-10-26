/* Orion file engine (no libraries): builds .docx .pptx .xlsx .txt .csv .html etc, and reads .docx .pptx .xlsx text. */
(function (G) {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const X = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  /* ---------- zip writer (stored) ---------- */
  const T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })();
  const crc = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 };
  function zip(files) {
    const parts = [], cen = []; let off = 0;
    const u16 = v => [v & 255, v >> 8 & 255], u32 = v => [v & 255, v >> 8 & 255, v >> 16 & 255, v >>> 24 & 255];
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, c = crc(data);
      const lh = Uint8Array.from([0x50, 0x4b, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0]);
      parts.push(lh, name, data);
      cen.push(Uint8Array.from([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(off)]), name);
      off += lh.length + name.length + data.length;
    }
    const cs = cen.reduce((a, b) => a + b.length, 0);
    const end = Uint8Array.from([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cs), ...u32(off), 0, 0]);
    const all = [...parts, ...cen, end], out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0;
    for (const a of all) { out.set(a, p); p += a.length } return out;
  }
  /* ---------- zip reader ---------- */
  async function inflate(data) { const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(data); w.close(); return new Uint8Array(await new Response(ds.readable).arrayBuffer()) }
  async function unzip(buf) {
    const b = new Uint8Array(buf), v = new DataView(b.buffer, b.byteOffset, b.byteLength); let e = b.length - 22;
    while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('not a zip');
    const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const out = {};
    for (let i = 0; i < n; i++) {
      const m = v.getUint16(p + 10, true), cs = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      const ln = v.getUint16(lo + 26, true), lx = v.getUint16(lo + 28, true), ds = lo + 30 + ln + lx, raw = b.subarray(ds, ds + cs);
      out[name] = m === 0 ? raw : m === 8 ? await inflate(raw) : null;
    } return out;
  }
  const txt = (z, n) => z[n] ? dec.decode(z[n]) : '';
  const strip = x => x.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  /* ---------- readers ---------- */
  async function readDocx(buf) { const z = await unzip(buf); return txt(z, 'word/document.xml').replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n').replace(/<\/w:tc>/g, ' | ').split('\n').map(strip).join('\n').replace(/\n{3,}/g, '\n\n').trim() }
  async function readPptx(buf) { const z = await unzip(buf); const names = Object.keys(z).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => a.match(/\d+/)[0] - b.match(/\d+/)[0]);
    return names.map((n, i) => `--- Slide ${i + 1} ---\n` + txt(z, n).replace(/<\/a:p>/g, '\n').split('\n').map(strip).filter(Boolean).join('\n')).join('\n\n') }
  async function readXlsx(buf) {
    const z = await unzip(buf); const ss = [...txt(z, 'xl/sharedStrings.xml').matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map(m => strip(m[1]));
    const names = Object.keys(z).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort(); let out = [];
    names.forEach((n, i) => { out.push(`--- Sheet ${i + 1} ---`); for (const r of txt(z, n).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      out.push([...r[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(c => { const t = (c[1].match(/t="(\w+)"/) || [])[1], v = (c[2] || '').match(/<v>([\s\S]*?)<\/v>/), is = (c[2] || '').match(/<is>([\s\S]*?)<\/is>/);
        return is ? strip(is[1]) : v ? (t === 's' ? ss[+v[1]] : strip(v[1])) : '' }).join('\t')) } }); return out.join('\n') }
  /* ---------- inline **bold** for docx ---------- */
  const runs = (s, extra = '') => String(s == null ? '' : s).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(t => { const b = /^\*\*[^*]+\*\*$/.test(t); const x = b ? t.slice(2, -2) : t;
    return `<w:r><w:rPr>${b ? '<w:b/>' : ''}${extra}</w:rPr><w:t xml:space="preserve">${X(x)}</w:t></w:r>` }).join('');
  const CT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  /* ---------- DOCX ---------- */
  function docx(sp) {
    const body = []; const P = (st, inner, num) => `<w:p><w:pPr>${st ? `<w:pStyle w:val="${st}"/>` : ''}${num ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${num}"/></w:numPr>` : ''}</w:pPr>${inner}</w:p>`;
    if (sp.title) body.push(P('Title', runs(sp.title)));
    let olId = 2;
    for (const b of sp.blocks || []) {
      if (b.h) body.push(P('Heading' + Math.min(3, Math.max(1, b.h)), runs(b.text)));
      else if (b.ul) b.ul.forEach(t => body.push(P('ListParagraph', runs(t), 1)));
      else if (b.ol) { olId++; b.ol.forEach(t => body.push(P('ListParagraph', runs(t), olId))) }
      else if (b.table) { const rows = b.table, n = Math.max(...rows.map(r => r.length), 1);
        body.push(`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${'<w:gridCol/>'.repeat(n)}</w:tblGrid>` +
          rows.map((r, i) => `<w:tr>${Array.from({ length: n }, (_, j) => `<w:tc><w:tcPr>${i === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="E8EEF8"/>' : ''}</w:tcPr><w:p>${runs(r[j] == null ? '' : r[j], i === 0 ? '<w:b/>' : '')}</w:p></w:tc>`).join('')}</w:tr>`).join('') + '</w:tbl><w:p/>') }
      else if (b.pagebreak) body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      else body.push(P('', runs(b.p != null ? b.p : b.text)));
    }
    const nums = (id, fmt, txt) => `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${txt}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>`;
    let numbering = nums(0, 'bullet', '•') + nums(1, 'decimal', '%1.'); let nm = '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>';
    for (let i = 2; i <= olId; i++) nm += `<w:num w:numId="${i}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`;
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const sty = (id, name, sz, bold, col, before, after) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="${after}"/></w:pPr><w:rPr>${bold ? '<w:b/>' : ''}<w:color w:val="${col}"/><w:sz w:val="${sz}"/></w:rPr></w:style>`;
    return zip([
      { name: '[Content_Types].xml', data: CT + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>' },
      { name: '_rels/.rels', data: CT + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/_rels/document.xml.rels', data: CT + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>' },
      { name: 'word/document.xml', data: CT + `<w:document ${W}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1300" w:right="1300" w:bottom="1300" w:left="1300" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>` },
      { name: 'word/numbering.xml', data: CT + `<w:numbering ${W}>${numbering}${nm}</w:numbering>` },
      { name: 'word/styles.xml', data: CT + `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${sty('Title', 'Title', 52, 1, '1F3864', 0, 240)}${sty('Heading1', 'heading 1', 34, 1, '1F3864', 320, 120)}${sty('Heading2', 'heading 2', 28, 1, '2F5597', 240, 100)}${sty('Heading3', 'heading 3', 24, 1, '2F5597', 200, 80)}<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>` }]);
  }
  /* ---------- XLSX ---------- */
  const colName = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26 } return s };
  function xlsx(sp) {
    const sheets = (sp.sheets && sp.sheets.length ? sp.sheets : [{ name: 'Sheet1', rows: sp.rows || [[]] }]);
    const files = [];
    sheets.forEach((sh, si) => {
      const rows = sh.rows || [], widths = []; rows.forEach(r => r.forEach((v, j) => { widths[j] = Math.min(60, Math.max(widths[j] || 8, String(v == null ? '' : v).length + 2)) }));
      const cols = widths.length ? '<cols>' + widths.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>' : '';
      const data = rows.map((r, i) => `<row r="${i + 1}">` + r.map((v, j) => { const ref = colName(j) + (i + 1), st = i === 0 && sh.header !== false ? ' s="1"' : '';
        if (v === null || v === undefined || v === '') return '';
        if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
        if (typeof v === 'string' && v[0] === '=') return `<c r="${ref}"${st}><f>${X(v.slice(1))}</f></c>`;
        if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return `<c r="${ref}"${st}><v>${v.trim()}</v></c>`;
        return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${X(v)}</t></is></c>` }).join('') + '</row>').join('');
      files.push({ name: `xl/worksheets/sheet${si + 1}.xml`, data: CT + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${sh.header !== false ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ''}</sheetView></sheetViews>${cols}<sheetData>${data}</sheetData></worksheet>` });
    });
    const nm = i => X((sheets[i].name || 'Sheet' + (i + 1)).replace(/[\\\/?*\[\]:]/g, '').slice(0, 31) || 'Sheet' + (i + 1));
    return zip([
      { name: '[Content_Types].xml', data: CT + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>' },
      { name: '_rels/.rels', data: CT + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: CT + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((_, i) => `<sheet name="${nm(i)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: CT + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: CT + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F5597"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>' },
      ...files]);
  }
  /* ---------- PPTX ---------- */
  function pptx(sp) {
    const slides = sp.slides && sp.slides.length ? sp.slides : [{ title: sp.title || 'Presentation' }];
    const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
    const E = 12700, W = 12192000, H = 6858000;
    const tb = (id, name, x, y, w, h, paras, fill) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>'}</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" rIns="91440" anchor="${paras.anchor || 't'}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paras.xml}</p:txBody></p:sp>`;
    const para = (t, sz, bold, col, o = {}) => `<a:p><a:pPr${o.bullet ? ' marL="342900" indent="-342900"' : ''} algn="${o.algn || 'l'}">${o.bullet ? '<a:buFont typeface="Arial"/><a:buChar char="•"/>' : '<a:buNone/>'}<a:spcBef><a:spcPts val="${o.sp || 0}"/></a:spcBef></a:pPr><a:r><a:rPr lang="en-US" sz="${sz}" b="${bold ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${col}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${X(t)}</a:t></a:r></a:p>`;
    const sl = slides.map((s, i) => {
      let shapes;
      if (i === 0 && !(s.bullets && s.bullets.length)) {
        const tp = { xml: para(s.title || '', 4400, 1, 'FFFFFF', { algn: 'l' }), anchor: 'b' }, sp2 = { xml: para(s.subtitle || '', 2000, 0, 'C9D6F2', { algn: 'l' }), anchor: 't' };
        shapes = tb(2, 'Title', 800000, 2000000, W - 1600000, 1700000, tp) + tb(3, 'Subtitle', 800000, 3800000, W - 1600000, 1000000, sp2);
        return { bg: '1F3864', xml: shapes };
      }
      const n = (s.bullets || []).length, sz = n > 7 ? 1800 : n > 5 ? 2000 : 2400;
      const bullets = (s.bullets || []).map(b => para(b, sz, 0, '262626', { bullet: 1, sp: 900 })).join('') || para('', sz, 0, '262626');
      shapes = tb(2, 'Bar', 0, 0, 180000, H, { xml: '<a:p><a:endParaRPr lang="en-US"/></a:p>' }, '2F5597') + tb(3, 'Title', 600000, 380000, W - 1200000, 1000000, { xml: para(s.title || '', 3200, 1, '1F3864'), anchor: 'ctr' }) + tb(4, 'Body', 600000, 1550000, W - 1200000, H - 2100000, { xml: bullets });
      return { bg: 'FFFFFF', xml: shapes };
    });
    const slideXml = sl.map(s => CT + `<p:sld ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${s.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${s.xml}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
    const rel = (id, type, t) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${t}"/>`, RS = x => CT + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${x}</Relationships>`;
    const theme = CT + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Orion"><a:themeElements><a:clrScheme name="Orion"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F3864"/></a:dk2><a:lt2><a:srgbClr val="E8EEF8"/></a:lt2><a:accent1><a:srgbClr val="2F5597"/></a:accent1><a:accent2><a:srgbClr val="66A5FF"/></a:accent2><a:accent3><a:srgbClr val="FF7A1A"/></a:accent3><a:accent4><a:srgbClr val="6FD08C"/></a:accent4><a:accent5><a:srgbClr val="A98BFF"/></a:accent5><a:accent6><a:srgbClr val="FFD166"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Orion"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Orion"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';
    const emptyTree = '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>';
    return zip([
      { name: '[Content_Types].xml', data: CT + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' + slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('') + '</Types>' },
      { name: '_rels/.rels', data: RS(rel('rId1', 'officeDocument', 'ppt/presentation.xml')) },
      { name: 'ppt/presentation.xml', data: CT + `<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` },
      { name: 'ppt/_rels/presentation.xml.rels', data: RS(rel('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml') + slides.map((_, i) => rel('rId' + (i + 2), 'slide', `slides/slide${i + 1}.xml`)).join('') + rel('rId' + (slides.length + 2), 'theme', 'theme/theme1.xml')) },
      { name: 'ppt/slideMasters/slideMaster1.xml', data: CT + `<p:sldMaster ${NS}>${emptyTree}<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>` },
      { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: RS(rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml') + rel('rId2', 'theme', '../theme/theme1.xml')) },
      { name: 'ppt/slideLayouts/slideLayout1.xml', data: CT + `<p:sldLayout ${NS} type="blank" preserve="1">${emptyTree}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` },
      { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: RS(rel('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml')) },
      { name: 'ppt/theme/theme1.xml', data: theme },
      ...slideXml.map((x, i) => ({ name: `ppt/slides/slide${i + 1}.xml`, data: x })),
      ...slides.map((_, i) => ({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: RS(rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')) }))]);
  }
  /* ---------- generic builder ---------- */
  const MIME = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', html: 'text/html', json: 'application/json', svg: 'image/svg+xml' };
  const csvEsc = v => { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v };
  function build(sp) {
    const type = String(sp.type || 'txt').toLowerCase().replace(/^\./, ''); let name = String(sp.filename || sp.title || 'Orion file').replace(/[\\\/:*?"<>|]/g, '').trim() || 'Orion file';
    name = name.replace(new RegExp('\\.' + type + '$', 'i'), ''); let data, mime = MIME[type] || 'text/plain';
    if (type === 'docx') data = docx(sp); else if (type === 'pptx') data = pptx(sp); else if (type === 'xlsx') data = xlsx(sp);
    else if (type === 'csv' && !sp.text) data = '﻿' + (sp.rows || (sp.sheets && sp.sheets[0] && sp.sheets[0].rows) || []).map(r => r.map(csvEsc).join(',')).join('\r\n');
    else data = sp.text != null ? String(sp.text) : (sp.blocks || []).map(b => b.h ? '#'.repeat(b.h) + ' ' + b.text : b.ul ? b.ul.map(x => '- ' + x).join('\n') : b.ol ? b.ol.map((x, i) => (i + 1) + '. ' + x).join('\n') : b.table ? b.table.map(r => r.join(' | ')).join('\n') : (b.p || b.text || '')).join('\n\n');
    return { blob: new Blob([data], { type: mime }), name: name + '.' + type, type, size: data.length, spec: sp };
  }
  G.OrionFiles = { build, unzip, readDocx, readPptx, readXlsx, zip };
})(typeof window !== 'undefined' ? window : globalThis);
