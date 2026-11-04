/* PNADC Resultados -- PDF DIRETO (fase 5): gera o arquivo .pdf no navegador, sem janela de impressão e sem biblioteca.
   Dono: PNADC_Resultados.

   Visual (acompanha o estilo da página): faixa verde no topo com a marca e o título do documento, rodapé com a fonte
   e "Página n de N", títulos em verde, texto JUSTIFICADO, tabelas de verdade (cabeçalho verde, linhas zebradas,
   números à direita, linhas que quebram de página repetem o cabeçalho) e "Fonte" em corpo menor.

   Dois tipos de página, que se misturam no mesmo documento:
   - IMAGEM: um canvas vira JPEG (DCTDecode), ajustado à área útil. Com `moldura: false` ocupa a página inteira.
   - TEXTO: blocos { t, texto } com t = h1 | h2 | h3 | p | li | q | fonte, ou { t: 'tabela', cab: [...], linhas: [[...]] }.
     Fonte Helvetica padrão do PDF (texto selecionável), acentuação em WinAnsi; o que não existe nela vira "?".

   `PDFREL.criar({ titulo, autor, assunto, rodape, moldura, paginas })` devolve um Blob application/pdf.
   Sem `??` nem `?.`. */
'use strict';

const PDFREL = (() => {
  const A4 = [595.28, 841.89];                 // pontos (1/72 pol)
  const MARGEM = 54, TOPO = 82, RODAPE = 56, FAIXA = 40;
  const VERDE = '#0f5132', VERDE_CLARO = '#e7f4ed', TEXTO = '#1f2933', CINZA = '#587068', LINHA = '#dfe9e3', ZEBRA = '#f5f9f7';
  // ---------------------------------------------------------------- bytes
  function ascii(s) { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }
  function juntar(partes) {
    let n = 0; partes.forEach(p => { n += p.length; });
    const out = new Uint8Array(n); let o = 0;
    partes.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  }
  function jpegDe(canvas, qualidade) {
    const u = canvas.toDataURL('image/jpeg', qualidade || 0.92);
    const bin = atob(u.slice(u.indexOf(',') + 1)), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function hexUtf16(s) {
    let h = 'FEFF';
    for (let i = 0; i < s.length; i++) h += ('0000' + s.charCodeAt(i).toString(16)).slice(-4).toUpperCase();
    return '<' + h + '>';
  }
  const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(x => x.toFixed(3)).join(' '); };
  // ---------------------------------------------------------------- texto em WinAnsi
  const WIN = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E,
    '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F };
  const SUBST = { '−': '-', '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '×': 'x', '⚠': '!', '★': '*', '▲': '^', '▼': 'v', '●': '*', '○': 'o', ' ': ' ', ' ': ' ' };
  function winBytes(s) {
    const out = [];
    for (const ch of String(s)) {
      const t = SUBST[ch] !== undefined ? SUBST[ch] : ch;
      for (const x of t) {
        const k = x.codePointAt(0);
        if (Object.prototype.hasOwnProperty.call(WIN, x)) out.push(WIN[x]);
        else if (k >= 32 && k < 127) out.push(k);
        else if (k >= 160 && k < 256) out.push(k);
        else if (k === 9 || k === 10) out.push(32);
        else out.push(63);
      }
    }
    return out;
  }
  function escapar(bytes) {
    let s = '';
    bytes.forEach(b => { s += (b === 40 || b === 41 || b === 92) ? '\\' + String.fromCharCode(b) : String.fromCharCode(b); });
    return s;
  }
  // ---------------------------------------------------------------- medida (Arial tem as métricas da Helvetica)
  let medidor = null;
  function larguraDe(texto, tam, negrito) {
    if (!medidor) medidor = document.createElement('canvas').getContext('2d');
    medidor.font = `${negrito ? 'bold ' : ''}${tam}px Arial, Helvetica, sans-serif`;
    return medidor.measureText(texto).width;
  }
  function quebrar(texto, tam, negrito, largura) {
    const linhas = [];
    String(texto).split('\n').forEach(par => {
      let l = '';
      par.split(/\s+/).forEach(w => {
        if (!w) return;
        const t = l ? l + ' ' + w : w;
        if (larguraDe(t, tam, negrito) > largura && l) { linhas.push(l); l = w; } else l = t;
      });
      linhas.push(l);
    });
    return linhas;
  }
  const ESTILO = {
    h1: { tam: 19, neg: true, antes: 4, depois: 9, entre: 1.25, cor: VERDE }, h2: { tam: 14.5, neg: true, antes: 14, depois: 6, entre: 1.25, cor: VERDE },
    h3: { tam: 12, neg: true, antes: 9, depois: 4, entre: 1.25, cor: TEXTO }, p: { tam: 10.5, neg: false, antes: 0, depois: 7, entre: 1.45, cor: TEXTO, justo: true },
    li: { tam: 10.5, neg: false, antes: 0, depois: 3.5, entre: 1.45, cor: TEXTO, justo: true, recuo: 14 }, q: { tam: 10.5, neg: false, antes: 4, depois: 9, entre: 1.45, cor: CINZA, justo: true, recuo: 14 },
    fonte: { tam: 8, neg: false, antes: 8, depois: 3, entre: 1.35, cor: CINZA, justo: false } };
  const ehNumero = t => /^[\s(+\-−–R$]*\d/.test(t) || /^[–-]$/.test(t.trim());
  // ---------------------------------------------------------------- paginação de texto -> operações de desenho
  /* ops: { k:'t', x, y, tam, neg, texto, cor, tw } | { k:'r', x, y, w, h, cor } | { k:'l', x1, y1, x2, y2, cor, larg }; y de cima para baixo */
  function paginarTexto(blocos, comMoldura) {
    const L = A4[0] - 2 * MARGEM, topo = comMoldura === false ? MARGEM : TOPO, base = A4[1] - (comMoldura === false ? MARGEM : RODAPE);
    const paginas = [{ ops: [] }];
    let pg = paginas[0], y = topo;
    const nova = () => { pg = { ops: [] }; paginas.push(pg); y = topo; };

    function tabela(b) {
      const tam = 9, pad = 5, lh = tam * 1.32, cab = b.cab || [], linhas = b.linhas || [], n = cab.length;
      if (!n) return;
      const nat = cab.map((c, i) => Math.max(larguraDe(String(c), tam, true), ...linhas.map(r => larguraDe(String(r[i] === undefined ? '' : r[i]), tam, false))) + 2 * pad + 2);
      let w = nat.slice();
      const soma = w.reduce((a, c) => a + c, 0);
      if (soma <= L) w[0] += L - soma;
      else {
        const w0 = Math.min(nat[0], Math.max(110, L * 0.3)), resto = L - w0, so = nat.slice(1).reduce((a, c) => a + c, 0) || 1;
        w = [w0].concat(nat.slice(1).map(x => x * resto / so));
      }
      const alin = cab.map((c, i) => (i > 0 && linhas.some(r => ehNumero(String(r[i] === undefined ? '' : r[i]))) ? 'd' : 'e'));
      const celulas = (r, neg) => r.map((c, i) => quebrar(String(c === undefined ? '' : c), tam, neg, w[i] - 2 * pad));
      const alturaDe = cs => Math.max.apply(null, cs.map(c => c.length)) * lh + 2 * pad - 2;
      const desenhaLinha = (cs, h, fundo, neg, cor) => {
        if (fundo) pg.ops.push({ k: 'r', x: MARGEM, y, w: L, h, cor: fundo });
        let x = MARGEM;
        cs.forEach((linhasC, i) => {
          linhasC.forEach((t, k) => {
            const tw = larguraDe(t, tam, neg), tx = alin[i] === 'd' ? x + w[i] - pad - tw : x + pad;
            pg.ops.push({ k: 't', x: tx, y: y + pad + tam * 0.92 + k * lh - 1, tam, neg, texto: t, cor });
          });
          x += w[i];
        });
        pg.ops.push({ k: 'l', x1: MARGEM, y1: y + h, x2: MARGEM + L, y2: y + h, cor: LINHA, larg: 0.6 });
        y += h;
      };
      const cabecalho = () => { const cs = celulas(cab, true), h = alturaDe(cs); desenhaLinha(cs, h, VERDE, true, '#ffffff'); };
      y += paginas.length === 1 && y === topo ? 0 : 6;
      const h0 = alturaDe(celulas(cab, true)), h1 = linhas.length ? alturaDe(celulas(linhas[0], false)) : 0;
      if (y + h0 + h1 > base) nova();
      cabecalho();
      linhas.forEach((r, k) => {
        const cs = celulas(r, false), h = alturaDe(cs);
        if (y + h > base) { nova(); cabecalho(); }
        desenhaLinha(cs, h, k % 2 ? ZEBRA : null, k === 0 && b.destacar0 === true, TEXTO);
      });
      y += 10;
    }

    blocos.forEach(b => {
      if (b.t === 'tabela') { tabela(b); return; }
      const e = ESTILO[b.t] || ESTILO.p, recuo = e.recuo || 0, h = e.tam * e.entre;
      const linhas = quebrar(b.texto, e.tam, e.neg, L - recuo);
      y += y === topo ? 0 : e.antes;
      if (y + h * Math.min(2, linhas.length) > base) nova();
      linhas.forEach((ln, k) => {
        if (y + h > base) nova();
        const ult = k === linhas.length - 1;
        let tw = 0;
        if (e.justo && !ult) { const esp = (ln.match(/ /g) || []).length; if (esp) tw = Math.max(0, (L - recuo - larguraDe(ln, e.tam, e.neg)) / esp); }
        if (b.t === 'li' && k === 0) pg.ops.push({ k: 't', x: MARGEM + 2, y: y + e.tam, tam: e.tam, neg: true, texto: '•', cor: VERDE });
        if (b.t === 'q') pg.ops.push({ k: 'r', x: MARGEM + 2, y: y - 1, w: 2.5, h: h, cor: '#9be7bd' });
        pg.ops.push({ k: 't', x: MARGEM + recuo, y: y + e.tam, tam: e.tam, neg: e.neg, texto: ln, cor: e.cor, tw });
        y += h;
      });
      if (b.t === 'h1') { pg.ops.push({ k: 'l', x1: MARGEM, y1: y + 1, x2: MARGEM + 56, y2: y + 1, cor: '#1b8a5a', larg: 2.2 }); }
      y += e.depois;
    });
    return paginas.filter(p => p.ops.length);
  }
  // ---------------------------------------------------------------- moldura da página (faixa, marca, rodapé)
  function moldura(pw, ph, n, total, o, logoNome) {
    const ops = [];
    ops.push({ k: 'r', x: 0, y: 0, w: pw, h: FAIXA, cor: VERDE });
    ops.push({ k: 'r', x: 0, y: FAIXA, w: pw, h: 2.5, cor: '#1b8a5a' });
    if (logoNome) ops.push({ k: 'logo', x: 24, y: 7, w: 26 });
    ops.push({ k: 't', x: logoNome ? 58 : 24, y: 24.5, tam: 12.5, neg: true, texto: 'PNADC Resultados', cor: '#ffffff' });
    const tit = String(o.titulo || '').slice(0, 70);
    if (tit) ops.push({ k: 't', x: pw - 24 - larguraDe(tit, 9, false), y: 24, tam: 9, neg: false, texto: tit, cor: '#cfeadb' });
    ops.push({ k: 'l', x1: 24, y1: ph - 38, x2: pw - 24, y2: ph - 38, cor: LINHA, larg: 0.8 });
    ops.push({ k: 't', x: 24, y: ph - 24, tam: 7.5, neg: false, texto: String(o.rodape || 'Fonte: IBGE, PNAD Contínua (SIDRA).').slice(0, 120), cor: CINZA });
    const pag = `Página ${n} de ${total}`;
    ops.push({ k: 't', x: pw - 24 - larguraDe(pag, 8, true), y: ph - 24, tam: 8, neg: true, texto: pag, cor: VERDE });
    return ops;
  }
  function opsParaStream(ops, ph) {
    let c = '';
    ops.forEach(o => {
      if (o.k === 'r') c += `${rgb(o.cor)} rg ${o.x.toFixed(2)} ${(ph - o.y - o.h).toFixed(2)} ${o.w.toFixed(2)} ${o.h.toFixed(2)} re f\n`;
      else if (o.k === 'l') c += `${rgb(o.cor)} RG ${o.larg} w ${o.x1.toFixed(2)} ${(ph - o.y1).toFixed(2)} m ${o.x2.toFixed(2)} ${(ph - o.y2).toFixed(2)} l S\n`;
      else if (o.k === 'logo') c += `q ${o.w} 0 0 ${o.w} ${o.x} ${(ph - o.y - o.w).toFixed(2)} cm /Lg Do Q\n`;
      else if (o.k === 't') c += `BT /${o.neg ? 'F2' : 'F1'} ${o.tam} Tf ${rgb(o.cor || TEXTO)} rg ${(o.tw || 0).toFixed(3)} Tw 1 0 0 1 ${o.x.toFixed(2)} ${(ph - o.y).toFixed(2)} Tm (${escapar(winBytes(o.texto))}) Tj ET\n`;
    });
    return c;
  }
  function canvasDoLogo() {
    if (typeof MOLDURA === 'undefined' || !MOLDURA.desenharLogo) return null;
    const cv = document.createElement('canvas'); cv.width = cv.height = 120;
    const c = cv.getContext('2d'); c.fillStyle = VERDE; c.fillRect(0, 0, 120, 120); MOLDURA.desenharLogo(c, 6, 6, 108);
    return cv;
  }
  // ---------------------------------------------------------------- o documento
  function criar(opc) {
    const comMoldura = opc.moldura !== false;
    const objs = [];
    const novo = corpo => { objs.push(corpo); return objs.length; };
    const reservar = () => { objs.push(null); return objs.length; };
    const def = (n, corpo) => { objs[n - 1] = corpo; };
    const txt = s => ascii(s);
    const catalogo = reservar(), paginasRaiz = reservar();
    const fHel = novo(txt('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
    const fNeg = novo(txt('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
    let logoObj = 0;
    const cvLogo = comMoldura ? canvasDoLogo() : null;
    if (cvLogo) { const j = jpegDe(cvLogo, 0.95); logoObj = novo(juntar([txt(`<< /Type /XObject /Subtype /Image /Width 120 /Height 120 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.length} >>\nstream\n`), j, txt('\nendstream')])); }
    // ---- 1) descreve as páginas (o texto é paginado aqui; o total é preciso para "Página n de N")
    const desc = [];
    (opc.paginas || []).forEach(p => {
      if (p.tipo === 'imagem') desc.push({ tipo: 'imagem', canvas: p.canvas, qualidade: p.qualidade });
      else paginarTexto(p.blocos || [], comMoldura).forEach(pg => desc.push({ tipo: 'texto', ops: pg.ops }));
    });
    const filhos = [];
    desc.forEach((d, idx) => {
      const n = idx + 1, total = desc.length;
      if (d.tipo === 'imagem') {
        const cv = d.canvas, w = cv.width, h = cv.height, jpg = jpegDe(cv, d.qualidade);
        const deitada = w >= h, pw = deitada ? A4[1] : A4[0], ph = deitada ? A4[0] : A4[1];
        const ax = comMoldura ? 28 : 0, ay0 = comMoldura ? FAIXA + 14 : 0, ay1 = comMoldura ? ph - 46 : ph;
        const aw = pw - 2 * ax, ah = ay1 - ay0, esc = Math.min(aw / w, ah / h), dw = w * esc, dh = h * esc, x = (pw - dw) / 2, ytopo = ay0 + (ah - dh) / 2;
        const img = novo(juntar([txt(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`), jpg, txt('\nendstream')]));
        let c = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${(ph - ytopo - dh).toFixed(2)} cm /Im0 Do Q\n`;
        if (comMoldura) c += opsParaStream(moldura(pw, ph, n, total, opc, logoObj), ph);
        const cb = ascii(c);
        const cont = novo(juntar([txt(`<< /Length ${cb.length} >>\nstream\n`), cb, txt('\nendstream')]));
        const rec = `/XObject << /Im0 ${img} 0 R${logoObj ? ` /Lg ${logoObj} 0 R` : ''} >> /Font << /F1 ${fHel} 0 R /F2 ${fNeg} 0 R >>`;
        filhos.push(novo(txt(`<< /Type /Page /Parent ${paginasRaiz} 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] /Resources << ${rec} >> /Contents ${cont} 0 R >>`)));
      } else {
        const pw = A4[0], ph = A4[1];
        let ops = d.ops;
        if (comMoldura) ops = moldura(pw, ph, n, total, opc, logoObj).concat(ops);
        const cb = ascii(opsParaStream(ops, ph));
        const cont = novo(juntar([txt(`<< /Length ${cb.length} >>\nstream\n`), cb, txt('\nendstream')]));
        const rec = `/Font << /F1 ${fHel} 0 R /F2 ${fNeg} 0 R >>${logoObj ? ` /XObject << /Lg ${logoObj} 0 R >>` : ''}`;
        filhos.push(novo(txt(`<< /Type /Page /Parent ${paginasRaiz} 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << ${rec} >> /Contents ${cont} 0 R >>`)));
      }
    });
    const d = new Date();
    const data = `D:${d.getFullYear()}${('0' + (d.getMonth() + 1)).slice(-2)}${('0' + d.getDate()).slice(-2)}${('0' + d.getHours()).slice(-2)}${('0' + d.getMinutes()).slice(-2)}${('0' + d.getSeconds()).slice(-2)}`;
    const info = novo(txt(`<< /Title ${hexUtf16(opc.titulo || 'PNADC Resultados')} /Author ${hexUtf16(opc.autor || 'PNADC Resultados')} /Subject ${hexUtf16(opc.assunto || 'Números da PNAD Contínua, do IBGE')} /Producer ${hexUtf16('PNADC Resultados')} /CreationDate (${data}) >>`));
    def(catalogo, txt(`<< /Type /Catalog /Pages ${paginasRaiz} 0 R >>`));
    def(paginasRaiz, txt(`<< /Type /Pages /Kids [${filhos.map(n => n + ' 0 R').join(' ')}] /Count ${filhos.length} >>`));
    // ---- serializa com a tabela de referências cruzadas
    const partes = [ascii('%PDF-1.4\n%âãÏÓ\n')];
    let pos = partes[0].length;
    const offs = [];
    objs.forEach((corpo, i) => {
      offs.push(pos);
      const p = juntar([txt(`${i + 1} 0 obj\n`), corpo, txt('\nendobj\n')]);
      partes.push(p); pos += p.length;
    });
    let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offs.forEach(o => { xref += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
    xref += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogo} 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
    partes.push(txt(xref));
    return new Blob([juntar(partes)], { type: 'application/pdf' });
  }
  function baixar(blob, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  return { criar, baixar, paginarTexto, winBytes, A4 };
})();
