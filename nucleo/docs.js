/* PNADC Resultados -- DOCUMENTOS EDITÁVEIS: Word (.docx) e OpenDocument (.odt), feitos aqui mesmo, sem biblioteca e sem rede.
   Um .docx e um .odt são arquivos ZIP com XML dentro; o ZIP é gravado sem compressão (método "armazenado"), que todo leitor aceita.
   Entrada (a mesma do PDF direto): { titulo, assunto, rodape, blocos: [{ t: 'h1'|'h2'|'h3'|'p'|'li'|'q'|'fonte'|'tabela', texto, cab, linhas }],
   imagens: [{ bytes: Uint8Array (PNG ou JPEG), largura, altura, titulo, alt }] }. Saída: Blob.
   Só texto de dado como TEXTO em XML escapado: nada de HTML. JavaScript sem `??` nem `?.`. */
const DOCSREL = (() => {
  // ------------------------------------------------------------------ ZIP (armazenado)
  let TABELA_CRC = null;
  function crc32(b) {
    if (!TABELA_CRC) { TABELA_CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); TABELA_CRC[n] = c >>> 0; } }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = TABELA_CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const utf8 = s => new TextEncoder().encode(s);
  /* entradas: [{ nome, dados: Uint8Array | string }]; a primeira fica primeiro (o .odt exige "mimetype" na frente) */
  function zip(entradas) {
    const agora = new Date(), hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1),
      data = ((Math.max(1980, agora.getFullYear()) - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
    const locais = [], centrais = []; let pos = 0;
    for (const e of entradas) {
      const nome = utf8(e.nome), dados = typeof e.dados === 'string' ? utf8(e.dados) : e.dados, crc = crc32(dados);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, hora, true); lh.setUint16(12, data, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, dados.length, true); lh.setUint32(22, dados.length, true); lh.setUint16(26, nome.length, true); lh.setUint16(28, 0, true);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, hora, true); ch.setUint16(14, data, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, dados.length, true); ch.setUint32(24, dados.length, true); ch.setUint16(28, nome.length, true);
      ch.setUint32(42, pos, true);
      locais.push(new Uint8Array(lh.buffer), nome, dados); centrais.push(new Uint8Array(ch.buffer), nome);
      pos += 30 + nome.length + dados.length;
    }
    const tamCentral = centrais.reduce((a, p) => a + p.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, entradas.length, true); fim.setUint16(10, entradas.length, true); fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true);
    return juntar(locais.concat(centrais, [new Uint8Array(fim.buffer)]));
  }
  function juntar(pedacos) {
    const total = pedacos.reduce((a, p) => a + p.length, 0), saida = new Uint8Array(total); let o = 0;
    for (const p of pedacos) { saida.set(p, o); o += p.length; }
    return saida;
  }
  /* leitura de volta (testes e conferência): [{ nome, dados, crcOk }] */
  function ler(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), saida = [];
    let fim = -1;
    for (let i = bytes.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
    if (fim < 0) throw new Error('não é um ZIP');
    const n = dv.getUint16(fim + 10, true); let p = dv.getUint32(fim + 16, true);
    for (let k = 0; k < n; k++) {
      const tam = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true), crc = dv.getUint32(p + 16, true);
      const nome = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nl));
      const lnl = dv.getUint16(off + 26, true), lel = dv.getUint16(off + 28, true), ini = off + 30 + lnl + lel;
      const dados = bytes.subarray(ini, ini + tam);
      saida.push({ nome, dados, crcOk: crc32(dados) === crc });
      p += 46 + nl + el + cl;
    }
    return saida;
  }

  // ------------------------------------------------------------------ utilidades de XML
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const VERDE = '0F5132', ESCURO = '102A43', CINZA = '607D8B';
  function dimensoes(im, maxL, maxA) {
    const l = im.largura || 1200, a = im.altura || 800; let w = maxL, h = maxL * a / l;
    if (h > maxA) { h = maxA; w = maxA * l / a; }
    return { w, h };
  }
  const extDe = im => (im.bytes && im.bytes[0] === 0xFF && im.bytes[1] === 0xD8 ? 'jpeg' : 'png');
  const dataIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  // ------------------------------------------------------------------ WORD (.docx)
  const NS_W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const wRuns = (texto, rpr) => String(texto === null || texto === undefined ? '' : texto).split('\n').map((l, i) => (i ? '<w:r><w:br/></w:r>' : '') + `<w:r>${rpr ? '<w:rPr>' + rpr + '</w:rPr>' : ''}<w:t xml:space="preserve">${esc(l)}</w:t></w:r>`).join('');
  const wP = (estilo, texto, ppr, rpr) => `<w:p><w:pPr>${estilo ? `<w:pStyle w:val="${estilo}"/>` : ''}${ppr || ''}</w:pPr>${wRuns(texto, rpr)}</w:p>`;
  function wTabela(b) {
    const cols = Math.max(1, (b.cab || []).length), total = 9638, primeira = cols >= 3 ? Math.floor(total * 0.34) : Math.floor(total / cols);
    const larg = i => (i === 0 ? primeira : Math.floor((total - primeira) / Math.max(1, cols - 1)));
    const cel = (t, i, cab) => `<w:tc><w:tcPr><w:tcW w:w="${larg(i)}" w:type="dxa"/>${cab ? `<w:shd w:val="clear" w:color="auto" w:fill="${VERDE}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>`
      + wP('CelulaTabela', t, i ? '<w:jc w:val="right"/>' : '', cab ? `<w:b/><w:color w:val="FFFFFF"/>` : '') + '</w:tc>';
    const linhas = [`<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${(b.cab || []).map((t, i) => cel(t, i, true)).join('')}</w:tr>`]
      .concat((b.linhas || []).map(l => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${l.map((t, i) => cel(t, i, false)).join('')}</w:tr>`));
    return `<w:tbl><w:tblPr><w:tblStyle w:val="TabelaPNADC"/><w:tblW w:w="${total}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>`
      + `<w:tblGrid>${Array.from({ length: cols }, (_, i) => `<w:gridCol w:w="${larg(i)}"/>`).join('')}</w:tblGrid>${linhas.join('')}</w:tbl><w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>`;
  }
  function wImagem(im, n, rid) {
    const d = dimensoes(im, 17, 22), cx = Math.round(d.w * 360000), cy = Math.round(d.h * 360000);
    const grafico = `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Imagem ${n}" descr="${esc(im.alt || im.titulo || '')}"/>`
      + `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>`
      + `<pic:nvPicPr><pic:cNvPr id="${n}" name="imagem${n}.${extDe(im) === 'jpeg' ? 'jpg' : 'png'}" descr="${esc(im.alt || '')}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
      + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
    return `<w:p><w:pPr><w:pStyle w:val="Imagem"/><w:keepNext/></w:pPr><w:r>${grafico}</w:r></w:p>` + (im.titulo ? wP('Legenda', im.titulo) : '');
  }
  const W_ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS_W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:color w:val="1F2933"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="pt-BR" w:eastAsia="pt-BR" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="both"/></w:pPr></w:style>
<w:style w:type="character" w:default="1" w:styleId="Fontepargpadro"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>
<w:style w:type="table" w:default="1" w:styleId="Tabelanormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
<w:style w:type="paragraph" w:styleId="Ttulo1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="${VERDE}"/></w:pBdr><w:spacing w:before="0" w:after="200" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="${VERDE}"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Ttulo2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="300" w:after="80"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="${VERDE}"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Ttulo3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/><w:jc w:val="left"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="${ESCURO}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="PargrafodaLista"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Citao"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="9BE7BD"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F5F9F7"/><w:ind w:left="360" w:right="360"/></w:pPr><w:rPr><w:i/><w:color w:val="35524A"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Fonte"><w:name w:val="Fonte"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="120" w:after="60"/><w:jc w:val="left"/></w:pPr><w:rPr><w:color w:val="${CINZA}"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Legenda"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="200"/><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="${CINZA}"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Imagem"><w:name w:val="Imagem"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="200" w:after="60" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="CelulaTabela"><w:name w:val="Celula de tabela"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Rodap"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="D3DEE6"/></w:pBdr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="${CINZA}"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TabelaPNADC"><w:name w:val="Tabela PNADC"/><w:basedOn w:val="Tabelanormal"/><w:uiPriority w:val="59"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="C9D9D0"/><w:left w:val="single" w:sz="4" w:space="0" w:color="C9D9D0"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="C9D9D0"/><w:right w:val="single" w:sz="4" w:space="0" w:color="C9D9D0"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="DDE8E1"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="DDE8E1"/></w:tblBorders><w:tblCellMar><w:top w:w="30" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="30" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;
  const W_NUMERACAO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${NS_W}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:color w:val="${VERDE}"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

  function docx(o) {
    const imgs = o.imagens || [], corpo = [];
    for (const b of o.blocos || []) {
      if (b.t === 'h1') corpo.push(wP('Ttulo1', b.texto));
      else if (b.t === 'h2') corpo.push(wP('Ttulo2', b.texto));
      else if (b.t === 'h3') corpo.push(wP('Ttulo3', b.texto));
      else if (b.t === 'li') corpo.push(wP('PargrafodaLista', b.texto, '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'));
      else if (b.t === 'q') corpo.push(wP('Citao', b.texto));
      else if (b.t === 'fonte') corpo.push(wP('Fonte', b.texto));
      else if (b.t === 'tabela') corpo.push(wTabela(b));
      else corpo.push(wP('', b.texto));
    }
    imgs.forEach((im, i) => corpo.push(wImagem(im, i + 1, 'rIdImg' + (i + 1))));
    const sect = '<w:sectPr><w:footerReference w:type="default" r:id="rIdRodape"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>';
    const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS_W}><w:body>${corpo.join('')}${sect}</w:body></w:document>`;
    const campo = (instr, v) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${v}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
    const rodape = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${NS_W}><w:p><w:pPr><w:pStyle w:val="Rodap"/></w:pPr>${wRuns((o.rodape || '') + '   ·   Página ')}${campo('PAGE', '1')}${wRuns(' de ')}${campo('NUMPAGES', '1')}</w:p></w:ftr>`;
    const rels = ['<Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
      '<Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
      '<Relationship Id="rIdRodape" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>']
      .concat(imgs.map((im, i) => `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/imagem${i + 1}.${extDe(im) === 'jpeg' ? 'jpg' : 'png'}"/>`));
    const tipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>`
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      + '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
    const raiz = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
    const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(o.titulo)}</dc:title><dc:subject>${esc(o.assunto || '')}</dc:subject><dc:creator>PNADC Resultados</dc:creator><dc:language>pt-BR</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${dataIso()}</dcterms:created></cp:coreProperties>`;
    const app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>PNADC Resultados</Application></Properties>';
    const entradas = [{ nome: '[Content_Types].xml', dados: tipos }, { nome: '_rels/.rels', dados: raiz }, { nome: 'word/document.xml', dados: documento }, { nome: 'word/styles.xml', dados: W_ESTILOS },
      { nome: 'word/numbering.xml', dados: W_NUMERACAO }, { nome: 'word/footer1.xml', dados: rodape },
      { nome: 'word/_rels/document.xml.rels', dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>` },
      { nome: 'docProps/core.xml', dados: core }, { nome: 'docProps/app.xml', dados: app }]
      .concat(imgs.map((im, i) => ({ nome: `word/media/imagem${i + 1}.${extDe(im) === 'jpeg' ? 'jpg' : 'png'}`, dados: im.bytes })));
    return new Blob([zip(entradas)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // ------------------------------------------------------------------ OPENDOCUMENT (.odt)
  const NS_O = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"';
  const oTexto = t => String(t === null || t === undefined ? '' : t).split('\n').map(esc).join('<text:line-break/>').replace(/ {2,}/g, m => ` <text:s text:c="${m.length - 1}"/>`);
  const oP = (estilo, t) => `<text:p text:style-name="${estilo}">${oTexto(t)}</text:p>`;
  const O_ESTILOS = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${NS_O} office:version="1.2"><office:font-face-decls><style:font-face style:name="Calibri" svg:font-family="Calibri"/></office:font-face-decls>
<office:styles>
<style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0.21cm" fo:line-height="115%"/><style:text-properties style:font-name="Calibri" fo:font-size="11pt" fo:color="#1f2933" fo:language="pt" fo:country="BR"/></style:default-style>
<style:style style:name="Standard" style:family="paragraph" style:class="text"/>
<style:style style:name="Corpo" style:display-name="Corpo" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="justify"/></style:style>
<style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Corpo" style:default-outline-level="1"><style:paragraph-properties fo:text-align="start" fo:margin-bottom="0.35cm" fo:keep-with-next="always" fo:padding-bottom="0.1cm" fo:border-bottom="0.07cm solid #${VERDE}"/><style:text-properties fo:font-size="20pt" fo:font-weight="bold" fo:color="#${VERDE}"/></style:style>
<style:style style:name="Heading_20_2" style:display-name="Heading 2" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Corpo" style:default-outline-level="2"><style:paragraph-properties fo:text-align="start" fo:margin-top="0.5cm" fo:margin-bottom="0.15cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="14pt" fo:font-weight="bold" fo:color="#${VERDE}"/></style:style>
<style:style style:name="Heading_20_3" style:display-name="Heading 3" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Corpo" style:default-outline-level="3"><style:paragraph-properties fo:text-align="start" fo:margin-top="0.35cm" fo:margin-bottom="0.1cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="12pt" fo:font-weight="bold" fo:color="#${ESCURO}"/></style:style>
<style:style style:name="Item" style:display-name="Item" style:family="paragraph" style:parent-style-name="Corpo"><style:paragraph-properties fo:margin-bottom="0.1cm"/></style:style>
<style:style style:name="Citacao" style:display-name="Citacao" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="justify" fo:margin-left="0.6cm" fo:margin-right="0.6cm" fo:padding="0.15cm" fo:background-color="#f5f9f7" fo:border-left="0.1cm solid #9be7bd"/><style:text-properties fo:font-style="italic" fo:color="#35524a"/></style:style>
<style:style style:name="Fonte" style:display-name="Fonte" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="start" fo:margin-top="0.2cm"/><style:text-properties fo:font-size="8.5pt" fo:color="#${CINZA.toLowerCase()}"/></style:style>
<style:style style:name="Legenda" style:display-name="Legenda" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="center" fo:margin-bottom="0.35cm"/><style:text-properties fo:font-size="8.5pt" fo:color="#${CINZA.toLowerCase()}"/></style:style>
<style:style style:name="Imagem" style:display-name="Imagem" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="center" fo:margin-top="0.35cm" fo:margin-bottom="0.1cm" fo:keep-with-next="always"/></style:style>
<style:style style:name="CelulaTxt" style:display-name="CelulaTxt" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="start" fo:margin-top="0.05cm" fo:margin-bottom="0.05cm"/><style:text-properties fo:font-size="9.5pt"/></style:style>
<style:style style:name="CelulaNum" style:display-name="CelulaNum" style:family="paragraph" style:parent-style-name="CelulaTxt"><style:paragraph-properties fo:text-align="end"/></style:style>
<style:style style:name="CelulaCab" style:display-name="CelulaCab" style:family="paragraph" style:parent-style-name="CelulaTxt"><style:text-properties fo:font-weight="bold" fo:color="#ffffff"/></style:style>
<style:style style:name="CelulaCabNum" style:display-name="CelulaCabNum" style:family="paragraph" style:parent-style-name="CelulaCab"><style:paragraph-properties fo:text-align="end"/></style:style>
<style:style style:name="Rodape" style:display-name="Rodape" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-size="8pt" fo:color="#${CINZA.toLowerCase()}"/></style:style>
<text:list-style style:name="Marcadores"><text:list-level-style-bullet text:level="1" text:bullet-char="•"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="1.27cm" fo:text-indent="-0.635cm" fo:margin-left="1.27cm"/></style:list-level-properties><style:text-properties fo:color="#${VERDE}"/></text:list-level-style-bullet></text:list-style>
</office:styles>
<office:automatic-styles><style:page-layout style:name="Pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin-top="2cm" fo:margin-bottom="1.5cm" fo:margin-left="2cm" fo:margin-right="2cm"/><style:footer-style><style:header-footer-properties fo:min-height="0.6cm" fo:margin-top="0.3cm"/></style:footer-style></style:page-layout></office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="Pm1"><style:footer><text:p text:style-name="Rodape">__RODAPE__ · Página <text:page-number text:select-page="current">1</text:page-number> de <text:page-count>1</text:page-count></text:p></style:footer></style:master-page></office:master-styles>
</office:document-styles>`;
  function odt(o) {
    const imgs = o.imagens || [], corpo = []; let lista = [];
    const fechaLista = () => { if (lista.length) { corpo.push(`<text:list text:style-name="Marcadores">${lista.map(t => `<text:list-item><text:p text:style-name="Item">${oTexto(t)}</text:p></text:list-item>`).join('')}</text:list>`); lista = []; } };
    let nTab = 0; const autos = [];
    for (const b of o.blocos || []) {
      if (b.t === 'li') { lista.push(b.texto); continue; }
      fechaLista();
      if (b.t === 'h1' || b.t === 'h2' || b.t === 'h3') corpo.push(`<text:h text:style-name="Heading_20_${b.t.charAt(1)}" text:outline-level="${b.t.charAt(1)}">${oTexto(b.texto)}</text:h>`);
      else if (b.t === 'q') corpo.push(oP('Citacao', b.texto));
      else if (b.t === 'fonte') corpo.push(oP('Fonte', b.texto));
      else if (b.t === 'tabela') {
        nTab++; const cols = Math.max(1, (b.cab || []).length), total = 17, primeira = cols >= 3 ? total * 0.34 : total / cols, resto = cols > 1 ? (total - primeira) / (cols - 1) : 0;
        autos.push(`<style:style style:name="Tab${nTab}" style:family="table"><style:table-properties style:width="17cm" table:align="margins" fo:margin-top="0.2cm" fo:margin-bottom="0.3cm"/></style:style>`);
        autos.push(`<style:style style:name="Tab${nTab}.A" style:family="table-column"><style:table-column-properties style:column-width="${primeira.toFixed(2)}cm"/></style:style>`);
        autos.push(`<style:style style:name="Tab${nTab}.B" style:family="table-column"><style:table-column-properties style:column-width="${resto.toFixed(2)}cm"/></style:style>`);
        const cel = (t, i, cab) => `<table:table-cell table:style-name="${cab ? 'CelCab' : 'CelCorpo'}" office:value-type="string"><text:p text:style-name="${cab ? (i ? 'CelulaCabNum' : 'CelulaCab') : (i ? 'CelulaNum' : 'CelulaTxt')}">${oTexto(t)}</text:p></table:table-cell>`;
        corpo.push(`<table:table table:name="Tabela${nTab}" table:style-name="Tab${nTab}"><table:table-column table:style-name="Tab${nTab}.A"/>${cols > 1 ? `<table:table-column table:style-name="Tab${nTab}.B" table:number-columns-repeated="${cols - 1}"/>` : ''}`
          + `<table:table-header-rows><table:table-row>${(b.cab || []).map((t, i) => cel(t, i, true)).join('')}</table:table-row></table:table-header-rows>`
          + (b.linhas || []).map(l => `<table:table-row>${l.map((t, i) => cel(t, i, false)).join('')}</table:table-row>`).join('') + '</table:table>');
      } else corpo.push(oP('Corpo', b.texto));
    }
    fechaLista();
    imgs.forEach((im, i) => {
      const d = dimensoes(im, 17, 22), ext = extDe(im) === 'jpeg' ? 'jpg' : 'png', alt = esc(im.alt || im.titulo || '');
      corpo.push(`<text:p text:style-name="Imagem"><draw:frame draw:style-name="QuadroImg" draw:name="Imagem${i + 1}" text:anchor-type="as-char" svg:width="${d.w.toFixed(2)}cm" svg:height="${d.h.toFixed(2)}cm" draw:z-index="${i}"><draw:image xlink:href="Pictures/imagem${i + 1}.${ext}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/><svg:title>${alt}</svg:title><svg:desc>${alt}</svg:desc></draw:frame></text:p>`);
      if (im.titulo) corpo.push(oP('Legenda', im.titulo));
    });
    const conteudo = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-content ${NS_O} office:version="1.2"><office:font-face-decls><style:font-face style:name="Calibri" svg:font-family="Calibri"/></office:font-face-decls><office:automatic-styles>`
      + '<style:style style:name="CelCab" style:family="table-cell"><style:table-cell-properties fo:background-color="#' + VERDE + '" fo:padding="0.1cm" fo:border="0.02cm solid #c9d9d0" style:vertical-align="middle"/></style:style>'
      + '<style:style style:name="CelCorpo" style:family="table-cell"><style:table-cell-properties fo:padding="0.1cm" fo:border="0.02cm solid #dde8e1" style:vertical-align="middle"/></style:style>'
      + '<style:style style:name="QuadroImg" style:family="graphic"><style:graphic-properties style:wrap="none" style:vertical-pos="top" style:vertical-rel="baseline" style:horizontal-pos="center" style:horizontal-rel="paragraph"/></style:style>'
      + autos.join('') + `</office:automatic-styles><office:body><office:text>${corpo.join('')}</office:text></office:body></office:document-content>`;
    const estilos = O_ESTILOS.replace('__RODAPE__', esc(o.rodape || ''));
    const meta = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-meta ${NS_O} office:version="1.2"><office:meta><dc:title>${esc(o.titulo)}</dc:title><dc:subject>${esc(o.assunto || '')}</dc:subject><meta:initial-creator>PNADC Resultados</meta:initial-creator><meta:generator>PNADC Resultados</meta:generator><dc:language>pt-BR</dc:language><meta:creation-date>${dataIso()}</meta:creation-date></office:meta></office:document-meta>`;
    const manifesto = '<?xml version="1.0" encoding="UTF-8"?>\n<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>'
      + '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>'
      + imgs.map((im, i) => `<manifest:file-entry manifest:full-path="Pictures/imagem${i + 1}.${extDe(im) === 'jpeg' ? 'jpg' : 'png'}" manifest:media-type="image/${extDe(im)}"/>`).join('') + '</manifest:manifest>';
    const entradas = [{ nome: 'mimetype', dados: 'application/vnd.oasis.opendocument.text' }, { nome: 'content.xml', dados: conteudo }, { nome: 'styles.xml', dados: estilos }, { nome: 'meta.xml', dados: meta },
      { nome: 'META-INF/manifest.xml', dados: manifesto }].concat(imgs.map((im, i) => ({ nome: `Pictures/imagem${i + 1}.${extDe(im) === 'jpeg' ? 'jpg' : 'png'}`, dados: im.bytes })));
    return new Blob([zip(entradas)], { type: 'application/vnd.oasis.opendocument.text' });
  }

  return { docx, odt, zip, ler, crc32, _esc: esc };
})();
