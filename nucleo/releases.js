/* PNADC Resultados -- ASSISTENTE de releases (10 passos, GUIA_JORNALISMO_RELEASES.md §10), a prévia ao vivo,
   as imagens (canvas) e as exportações. Dono: PNADC_Resultados. Veio de SuperC/app/js/releases.js
   (26/10/2026), sem o bloco NOVIDADES, que agora é `novidades.js`. O motor de texto é `releases_modelos.js`.
   Contrato com o hospedeiro: AMBIENTE.login(), AMBIENTE.podeGerar(), AMBIENTE.motivoSemPermissao() (opcional),
   AMBIENTE.toast(), AMBIENTE.renderizar(). Sem `??` nem `?.`. */
'use strict';

// =====================================================================================================
const RELEASES = (() => {
  const RM = RELEASE_MODELOS;
  const login = () => AMBIENTE.login() || 'visitante';
  const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  /* Quem decide é o hospedeiro: no SuperC, a sessão e o catálogo de funções; no arquivo autônomo, sempre sim. */
  function pode() { return !!AMBIENTE.podeGerar(); }
  const K_ATUAL = () => `superc.release.atual.${login()}`, K_RASC = () => `superc.release.rascunhos.${login()}`;
  const lerLS = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v === null ? padrao : v; } catch (e) { return padrao; } };
  const gravarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  let ST = null;   // { E, texto, base, marcados, visuaisManuais, rascunhoId, dono }
  function estado(D) {
    if (ST && ST.dono === login()) return ST;
    const salvo = lerLS(K_ATUAL(), null);
    ST = salvo && salvo.E ? salvo : { E: RM.padrao(hojeIso()), texto: null, base: null, marcados: {}, visuaisManuais: false, rascunhoId: null };
    ST.dono = login();
    ST.E = RM.normalizar(ST.E);
    if (!D.uf.codigo && ST.E.territorio === 'uf') ST.E.territorio = 'brasil';   // sem UF em destaque, o release começa pelo Brasil
    if (!ST.E.indicadores) { const o = RM.ordemSugerida(D, ST.E).filter(x => !x.it.indisponivel); ST.E.indicadores = o.slice(0, 5).map(x => x.id); }
    if (!ST.E.visuais) ST.E.visuais = RM.sugerirVisuais(ST.E);
    return ST;
  }
  const salvarAtual = () => gravarLS(K_ATUAL(), ST);

  const PASSOS = [
    { n: 1, id: 'territorio', rot: 'Território' }, { n: 2, id: 'periodo', rot: 'Período' }, { n: 3, id: 'indicadores', rot: 'Indicadores' },
    { n: 4, id: 'publico', rot: 'Público' }, { n: 5, id: 'midia', rot: 'Mídia' }, { n: 6, id: 'estilo', rot: 'Estilo' }, { n: 7, id: 'tamanho', rot: 'Tamanho' },
    { n: 8, id: 'visuais', rot: 'Elementos visuais' }, { n: 9, id: 'extras', rot: 'Extras' }, { n: 10, id: 'saida', rot: 'Conferência e saída' }];

  // ------------------------------------------------------------------ geração (com cache por escolhas)
  let CACHE = { chave: null, F: null, doc: null };
  function gerar(D) {
    const k = JSON.stringify(ST.E) + '|' + ((D.consultas && Object.keys(D.consultas).length) || 0);
    if (CACHE.chave === k && CACHE.D === D) return CACHE;
    const F = RM.montarFatos(D, ST.E), doc = RM.redigir(F);
    // texto gerado novo (escolhas mudaram ou o cache foi renovado): as conferências MANUAIS
    // valiam para o texto anterior e voltam a ser pedidas
    if (!CACHE.doc || CACHE.doc.texto !== doc.texto || CACHE.chave !== k) ST.marcados = {};
    CACHE = { chave: k, D, F, doc };
    return CACHE;
  }
  const textoAtual = doc => (ST.texto !== null && ST.texto !== undefined ? ST.texto : doc.texto);

  // ------------------------------------------------------------------ mini markdown -> HTML (tudo escapado)
  /* tabela em linhas "| a | b |" (Markdown), em QUALQUER ponto do texto: o primeiro grupo de linhas é o cabeçalho */
  function tabelaHtml(ls, inline) {
    const cel = l => l.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim());
    const sep = l => /^[\s|:-]+$/.test(l) && /-/.test(l);
    const cab = cel(ls[0]), corpo = ls.slice(1).filter(l => !sep(l)).map(cel);
    return '<table class="rel-tab"><thead><tr>' + cab.map((c, i) => `<th${i ? ' class="n"' : ''}>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
      corpo.map(r => '<tr>' + r.map((c, i) => `<td${i ? ' class="n"' : ''}>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
  }
  const paragrafoHtml = (linhas, inline) => {
    const t = linhas.join(' ');
    return `<p${/^Fontes?:/i.test(t) ? ' class="fonte"' : ''}>${linhas.map(inline).join('<br>')}</p>`;
  };
  function mdHtml(md) {
    const inline = s => U.esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,;])/g, '$1<i>$2</i>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    const out = [];
    String(md).split(/\n\s*\n/).forEach(bloco => {
      let html = '', lista = [], par = [], tab = [];
      const fechaLista = () => { if (lista.length) { html += '<ul>' + lista.map(x => `<li>${inline(x)}</li>`).join('') + '</ul>'; lista = []; } };
      const fechaPar = () => { if (par.length) { html += paragrafoHtml(par, inline); par = []; } };
      const fechaTab = () => { if (tab.length) { html += tabelaHtml(tab, inline); tab = []; } };
      bloco.split('\n').forEach(l => {
        let m;
        if (/^\s*\|/.test(l)) { fechaPar(); fechaLista(); tab.push(l); return; }
        fechaTab();
        if ((m = /^(#{1,3})\s+(.*)$/.exec(l))) { fechaPar(); fechaLista(); const h = m[1].length === 1 ? 'h1' : m[1].length === 2 ? 'h2' : 'h3'; html += `<${h}>${inline(m[2])}</${h}>`; }
        else if (/^- /.test(l)) { fechaPar(); lista.push(l.slice(2)); }
        else if (/^>\s?/.test(l)) { fechaPar(); fechaLista(); html += `<blockquote>${inline(l.replace(/^>\s?/, ''))}</blockquote>`; }
        else { fechaLista(); par.push(l); }
      });
      fechaTab(); fechaPar(); fechaLista();
      out.push(html);
    });
    return out.join('\n');
  }
  function planoHtml(t) {
    const inline = x => U.esc(x);
    return String(t).split(/\n\s*\n/).map(bloco => {
      let html = '', par = [], tab = [];
      const fechaPar = () => { if (par.length) { html += paragrafoHtml(par, inline); par = []; } };
      const fechaTab = () => { if (tab.length) { html += tabelaHtml(tab, inline); tab = []; } };
      bloco.split('\n').forEach(l => { if (/^\s*\|/.test(l)) { fechaPar(); tab.push(l); } else { fechaTab(); par.push(l); } });
      fechaTab(); fechaPar();
      return html;
    }).join('\n');
  }
  const textoParaPlano = (t, doc) => (doc.formato === 'md' ? RM.planoDeMd(t) : t);

  // ------------------------------------------------------------------ IMAGENS (canvas)
  const FONTE = '"Segoe UI", Arial, sans-serif';
  const COR_INST = '#1b5e20';
  function corEstado(estado, sentido) {
    if (estado === 'aumentou' || estado === 'diminuiu') { const j = (sentido || 0) * (estado === 'aumentou' ? 1 : -1); return j > 0 ? U.COR.bom : j < 0 ? U.COR.ruim : U.COR.estrutura; }
    if (estado === 'estavel') return U.COR.neutro3;
    return MOLDURA.COR.estavel;
  }
  const SIMB = { aumentou: '▲', diminuiu: '▼', estavel: '●' };
  /* `quebrar` limitado a `max` linhas; o que não cabe termina em reticências */
  function linhasCabem(ctx, txt, largura, max) {
    const ls = quebrar(ctx, txt, largura);
    if (ls.length <= max) return ls;
    const out = ls.slice(0, max);
    let ult = out[max - 1] + '…';
    while (ult.length > 1 && ctx.measureText(ult).width > largura) ult = ult.slice(0, -2) + '…';
    out[max - 1] = ult;
    return out;
  }
  function quebrar(ctx, txt, largura) {
    const out = []; for (const par of String(txt).split('\n')) { let l = ''; for (const w of par.split(' ')) { const t = l ? l + ' ' + w : w; if (ctx.measureText(t).width > largura && l) { out.push(l); l = w; } else l = t; } out.push(l); } return out;
  }
  function moldura(spec, W, H) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    c.fillStyle = COR_INST; c.fillRect(0, 0, W, 8);
    c.fillStyle = '#102a43'; c.font = `700 ${Math.round(W / 34)}px ${FONTE}`; c.textBaseline = 'top';
    let y = 26;
    for (const l of quebrar(c, spec.titulo || '', W - 60).slice(0, 2)) { c.fillText(l, 30, y); y += Math.round(W / 26); }
    c.fillStyle = '#486581'; c.font = `${Math.round(W / 60)}px ${FONTE}`;
    for (const l of quebrar(c, spec.subtitulo || '', W - 60).slice(0, 2)) { c.fillText(l, 30, y); y += Math.round(W / 46); }
    c.fillStyle = '#607d8b'; c.font = `${Math.round(W / 70)}px ${FONTE}`;
    const rod = quebrar(c, spec.fonte || '', W - 60);
    rod.forEach((l, i) => c.fillText(l, 30, H - 14 - (rod.length - i) * Math.round(W / 58)));
    return { cv, c, topo: y + 12, base: H - 24 - rod.length * Math.round(W / 58) };
  }
  /* RÓTULOS SEM SOBREPOSIÇÃO (regra: nenhum rótulo pode cobrir outro, em lugar nenhum).
     `espalhar` recebe as posições verticais desejadas e devolve posições com pelo menos `d` entre os centros, dentro de
     [topo, base], mantendo a ordem. Precisa de espaço: n × d <= base - topo. */
  function espalhar(ys, d, topo, base) {
    const n = ys.length;
    if (!n) return [];
    const ord = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i), p = ord.map(o => o.y);
    for (let it = 0; it < 300; it++) {
      let mexeu = false;
      for (let k = 1; k < n; k++) { const f = d - (p[k] - p[k - 1]); if (f > 0.01) { p[k - 1] -= f / 2; p[k] += f / 2; mexeu = true; } }
      if (p[0] < topo) { p[0] = topo; mexeu = true; }
      if (p[n - 1] > base) { p[n - 1] = base; mexeu = true; }
      if (!mexeu) break;
    }
    for (let k = 1; k < n; k++) if (p[k] < p[k - 1] + d) p[k] = p[k - 1] + d;
    for (let k = n - 2; k >= 0; k--) if (p[k] > p[k + 1] - d) p[k] = p[k + 1] - d;
    const out = [];
    ord.forEach((o, k) => { out[o.i] = p[k]; });
    return out;
  }
  const cruza = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  /* Posição de todos os rótulos do MAPA das UFs. Cada UF tenta o rótulo DENTRO, no maior tamanho de letra que cabe no
     maior círculo que a UF comporta (os círculos de UFs diferentes não se tocam, então os rótulos de dentro nunca se
     sobrepõem); as que não cabem (DF, SE, AL, RJ, ES, RN, PB, PE...) vão para uma coluna à direita, distribuída por
     `espalhar`, com um traço até a UF. `medir(texto, tamanho, peso)` mede em px. Devolve { sc, ox, oy, itens, ok }. */
  function layoutMapa(spec, area, medir, fmt) {
    const M = MAPA_UF, COL = 250;
    const sc = Math.min((area.w - COL) / M.w, area.h / M.h), ox = area.x, oy = area.y + (area.h - M.h * sc) / 2;
    const dentro = [], fora = [];
    spec.casas.forEach(k => {
      const g = M.ufs[k.sigla];
      if (!g) return;
      const px = ox + g.x * sc, py = oy + g.y * sc, R = g.r * sc;
      const val = k.valor === null || k.valor === undefined ? '–' : fmt(k.valor), sim = SIMB[k.estado] || '–';
      let caixa = null;
      for (let fs = 32; fs >= 14 && !caixa; fs--) {
        const f2 = Math.round(fs * 0.8), w = Math.max(medir(k.sigla, fs, 800), medir(`${val} ${sim}`, f2, 600)), h = fs * 1.12 + f2 * 1.25;
        if (Math.hypot(w / 2, h / 2) <= R * 0.93) caixa = { fs, f2, w, h };
      }
      const it = { sigla: k.sigla, k, val, sim, px, py, R };
      if (caixa) dentro.push(Object.assign(it, { dentro: true, fs: caixa.fs, f2: caixa.f2, rect: { x: px - caixa.w / 2, y: py - caixa.h / 2, w: caixa.w, h: caixa.h } }));
      else fora.push(it);
    });
    const FS = 19, H = 28, xCol = ox + M.w * sc + 34;
    fora.forEach(it => { it.w = 22 + medir(`${it.sigla}  ${it.val} ${it.sim}`, FS, 700); });
    const ys = espalhar(fora.map(it => it.py), H + 4, oy + H / 2, oy + M.h * sc - H / 2);
    fora.forEach((it, i) => { it.dentro = false; it.fs = FS; it.ly = ys[i]; it.rect = { x: xCol, y: ys[i] - H / 2, w: it.w, h: H }; });
    const itens = dentro.concat(fora);
    let ok = true;
    for (let i = 0; i < itens.length; i++) for (let j = i + 1; j < itens.length; j++) if (cruza(itens[i].rect, itens[j].rect)) ok = false;
    return { sc, ox, oy, itens, ok, xCol };
  }
  function desenharLinha(spec) {
    const W = 1200, H = 675, m = moldura(spec, W, H), c = m.c;
    const x0 = 80, x1 = W - 250, y0 = m.topo + 10, y1 = m.base - 34;
    const todos = [].concat.apply([], spec.series.map(s => s.dados)).filter(v => v !== null && v !== undefined);
    const vmax = Math.max.apply(null, todos) * 1.1 || 1;   // escala de 0 ao máximo + 10% (§8.2)
    const X = i => x0 + (x1 - x0) * (spec.labels.length > 1 ? i / (spec.labels.length - 1) : 0.5), Y = v => y1 - (y1 - y0) * v / vmax;
    c.strokeStyle = '#e4e7eb'; c.lineWidth = 1; c.fillStyle = '#607d8b'; c.font = `15px ${FONTE}`; c.textBaseline = 'middle'; c.textAlign = 'right';
    for (let k = 0; k <= 4; k++) { const v = vmax * k / 4; c.beginPath(); c.moveTo(x0, Y(v)); c.lineTo(x1, Y(v)); c.stroke(); c.fillText(RM.fmtVis(spec.ind, v), x0 - 8, Y(v)); }
    c.textAlign = 'center'; c.textBaseline = 'top';
    const passo = Math.max(1, Math.ceil(spec.labels.length / 10));
    const ultL = spec.labels.length - 1;
    // o último rótulo sempre aparece; o regular que ficaria colado nele sai
    spec.labels.forEach((l, i) => { if (i === ultL || (i % passo === 0 && ultL - i >= passo * 0.8)) c.fillText(l, X(i), y1 + 8); });
    const rot = [];
    spec.series.slice().reverse().forEach(s => {
      const cor = s.destaque ? U.COR.estrutura : s.tracejado ? '#37474f' : MOLDURA.COR.demais;
      c.strokeStyle = cor; c.lineWidth = s.destaque ? 4 : 2.5;
      c.setLineDash(s.tracejado ? [8, 6] : []); c.beginPath(); let ini = false;
      s.dados.forEach((v, i) => { if (v === null || v === undefined) { ini = false; return; } if (!ini) { c.moveTo(X(i), Y(v)); ini = true; } else c.lineTo(X(i), Y(v)); });
      c.stroke(); c.setLineDash([]);
      let j = s.dados.length - 1; while (j >= 0 && (s.dados[j] === null || s.dados[j] === undefined)) j--;
      if (j >= 0) {
        c.fillStyle = cor; c.beginPath(); c.arc(X(j), Y(s.dados[j]), s.destaque ? 6 : 4, 0, 7); c.fill();
        rot.push({ x: X(j), y: Y(s.dados[j]), cor, destaque: !!s.destaque, texto: `${s.rotulo} ${RM.fmtVis(spec.ind, s.dados[j])}` });
      }
    });
    // rótulo direto no fim de cada linha (sem legenda, §8.2), SEM sobreposição: o texto encolhe até caber na margem e
    // os que ficariam um sobre o outro são afastados na vertical, com um traço curto ligando ao ponto
    let fs = 16;
    const livre = W - 14 - (x1 + 18);
    const larguraMax = () => Math.max.apply(null, rot.map(r => { c.font = `${r.destaque ? 700 : 400} ${fs}px ${FONTE}`; return c.measureText(r.texto).width; }).concat([0]));
    while (fs > 11 && larguraMax() > livre) fs--;
    const ys = espalhar(rot.map(r => r.y), Math.round(fs * 1.5), y0 - 4, y1 + 4);
    c.textAlign = 'left'; c.textBaseline = 'middle';
    rot.forEach((r, k) => {
      if (Math.abs(ys[k] - r.y) > 2) { c.strokeStyle = r.cor; c.lineWidth = 1.2; c.beginPath(); c.moveTo(r.x + 8, r.y); c.lineTo(r.x + 15, ys[k]); c.stroke(); }
      c.fillStyle = r.cor; c.font = `${r.destaque ? 700 : 400} ${fs}px ${FONTE}`; c.fillText(r.texto, r.x + 18, ys[k]);
    });
    // posição de cada rótulo, para o teste de sobreposição (nenhum rótulo cobre outro nem sai da imagem)
    m.cv._rotulos = rot.map((r, k) => { c.font = `${r.destaque ? 700 : 400} ${fs}px ${FONTE}`; return { x: r.x + 18, y: ys[k] - fs * 0.6, w: c.measureText(r.texto).width, h: fs * 1.2 }; });
    return m.cv;
  }
  function desenharBarras(spec) {
    const n = spec.itens.length, W = 1200, H = Math.max(675, 200 + n * 34), m = moldura(spec, W, H), c = m.c;
    const x0 = 250, x1 = W - 170, y0 = m.topo + 22, y1 = m.base - 34, h = (y1 - y0) / n;
    const vmax = Math.max.apply(null, spec.itens.map(i => i.valor).concat(spec.referencia ? [spec.referencia.valor] : [])) * 1.05;
    const X = v => x0 + (x1 - x0) * v / vmax;
    if (spec.referencia) {
      const x = X(spec.referencia.valor); c.strokeStyle = '#37474f'; c.lineWidth = 2; c.setLineDash([7, 5]); c.beginPath(); c.moveTo(x, y0 - 4); c.lineTo(x, y1); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#37474f'; c.font = `700 15px ${FONTE}`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(`Brasil ${RM.fmtVis(spec.ind, spec.referencia.valor)}`, x, y0 - 6);
    }
    spec.itens.forEach((it, i) => {
      const y = y0 + i * h;
      c.fillStyle = it.destaque ? U.COR.estrutura : MOLDURA.COR.demais; c.fillRect(x0, y + h * 0.18, X(it.valor) - x0, h * 0.64);
      c.font = `${it.destaque ? 700 : 400} 16px ${FONTE}`; c.fillStyle = '#243b53'; c.textAlign = 'right'; c.textBaseline = 'middle';
      c.fillText(`${it.nome || it.rotulo}`, x0 - 10, y + h / 2);
      c.textAlign = 'left'; c.fillText(RM.fmtVis(spec.ind, it.valor), X(it.valor) + 8, y + h / 2);
      const s = SIMB[it.estado]; if (s) { const w = c.measureText(RM.fmtVis(spec.ind, it.valor)).width; c.fillStyle = corEstado(it.estado, spec.ind.sentido); c.fillText(s, X(it.valor) + 16 + w, y + h / 2); }
    });

    c.textAlign = 'left'; c.textBaseline = 'top'; c.font = `14px ${FONTE}`; c.fillStyle = '#486581';
    c.fillText('▲ aumentou · ▼ recuou (significativa no teste do IBGE) · ● estável — verde/vermelho: sentido favorável/desfavorável', 30, m.base - 26);
    return m.cv;
  }
  function desenharGradeAntiga(spec) {
    const W = 1200, H = 1150, m = moldura(spec, W, H), c = m.c;
    const cols = 7, rows = 8, gx = 16, top = m.topo + 6, alt = m.base - 70 - top;
    const lado = Math.min((W - 60 - gx * (cols - 1)) / cols, (alt - gx * (rows - 1)) / rows);
    const ox = (W - (lado * cols + gx * (cols - 1))) / 2;
    for (const k of spec.casas) {
      const x = ox + k.x * (lado + gx), y = top + k.y * (lado + gx);
      const cor = corEstado(k.estado, spec.sentido);
      c.fillStyle = k.estado === 'estavel' || k.estado === 'sem' ? '#eceff1' : cor; c.fillRect(x, y, lado, lado);
      if (k.destaque) { c.strokeStyle = '#102a43'; c.lineWidth = 6; c.strokeRect(x + 3, y + 3, lado - 6, lado - 6); }
      const claro = !(k.estado === 'estavel' || k.estado === 'sem');
      c.fillStyle = claro ? '#fff' : '#243b53'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 ${Math.round(lado / 3.6)}px ${FONTE}`; c.fillText(k.sigla, x + lado / 2, y + lado * 0.3);
      c.font = `${k.destaque ? 800 : 600} ${Math.round(lado / 5)}px ${FONTE}`; c.fillText(k.valor === null || k.valor === undefined ? '–' : RM.fmtVis(spec.ind, k.valor).replace('%', ''), x + lado / 2, y + lado * 0.6);
      c.font = `${Math.round(lado / 6)}px ${FONTE}`; c.fillStyle = claro ? '#fff' : U.COR.neutro3; c.fillText(SIMB[k.estado] || '–', x + lado / 2, y + lado * 0.84);
    }
    c.textAlign = 'left'; c.textBaseline = 'top'; c.font = `15px ${FONTE}`;
    let lx = 30; const ly = m.base - 52;
    for (const [rot, cor, fundo] of [['▲/▼ significativa, sentido favorável', '#fff', U.COR.bom], ['▲/▼ significativa, sentido desfavorável', '#fff', U.COR.ruim], ['● estável (não significativa)', '#243b53', '#eceff1'], ['– sem comparação', '#243b53', '#eceff1']]) {
      c.fillStyle = fundo; c.fillRect(lx, ly, 22, 22); c.fillStyle = '#243b53'; c.fillText(rot, lx + 28, ly + 2); lx += c.measureText(rot).width + 60;
    }
    c.fillStyle = '#486581'; c.fillText('Uma casa igual para cada UF; a posição aproxima a geografia, sem afirmar vizinhança. Casa com borda grossa: a UF em destaque.', 30, ly + 30);
    return m.cv;
  }
  /* O MAPA das 27 UFs com os limites reais (MAPA_UF, malha do IBGE simplificada). Cor = situação publicada da variação;
     contorno grosso escuro = a UF em destaque; rótulos sem sobreposição (ver layoutMapa). */
  function desenharGrade(spec) {
    if (typeof MAPA_UF === 'undefined') return desenharGradeAntiga(spec);
    const W = 1200, H = 1180, m = moldura(spec, W, H), c = m.c;
    const area = { x: 30, y: m.topo + 6, w: W - 60, h: m.base - 84 - (m.topo + 6) };
    const medir = (t, fs, peso) => { c.font = `${peso} ${fs}px ${FONTE}`; return c.measureText(t).width; };
    const L = layoutMapa(spec, area, medir, v => RM.fmtVis(spec.ind, v).replace('%', ''));
    const pintar = (k, g) => {
      const p = new Path2D(g.d), est = k.estado === 'estavel' || k.estado === 'sem';
      c.save(); c.translate(L.ox, L.oy); c.scale(L.sc, L.sc);
      c.fillStyle = est ? '#e3e8eb' : corEstado(k.estado, spec.sentido); c.fill(p);
      c.lineJoin = 'round'; c.lineWidth = 1.7 / L.sc; c.strokeStyle = '#fff'; c.stroke(p);
      c.restore();
      return p;
    };
    spec.casas.forEach(k => { const g = MAPA_UF.ufs[k.sigla]; if (g && !k.destaque) pintar(k, g); });
    spec.casas.forEach(k => {   // a UF em destaque por cima, com contorno grosso
      const g = MAPA_UF.ufs[k.sigla];
      if (!g || !k.destaque) return;
      const p = pintar(k, g);
      c.save(); c.translate(L.ox, L.oy); c.scale(L.sc, L.sc); c.lineJoin = 'round'; c.lineWidth = 5 / L.sc; c.strokeStyle = '#102a43'; c.stroke(p); c.restore();
    });
    // traços até as UFs cujo rótulo ficou na coluna da direita
    L.itens.filter(it => !it.dentro).forEach(it => {
      c.strokeStyle = 'rgba(16,42,67,.55)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(it.px, it.py); c.lineTo(L.xCol - 8, it.ly); c.lineTo(L.xCol - 2, it.ly); c.stroke();
      c.fillStyle = '#102a43'; c.beginPath(); c.arc(it.px, it.py, 3.2, 0, 7); c.fill();
    });
    L.itens.forEach(it => {
      const est = it.k.estado === 'estavel' || it.k.estado === 'sem';
      c.textBaseline = 'alphabetic';
      if (it.dentro) {
        const claro = !est;
        c.textAlign = 'center'; c.fillStyle = claro ? '#fff' : '#243b53';
        c.font = `800 ${it.fs}px ${FONTE}`; c.fillText(it.sigla, it.px, it.rect.y + it.fs * 0.98);
        c.font = `${it.k.destaque ? 800 : 600} ${it.f2}px ${FONTE}`; c.fillText(`${it.val} ${it.sim}`, it.px, it.rect.y + it.fs * 1.12 + it.f2 * 1.0);
      } else {
        const r = it.rect;
        c.fillStyle = est ? '#e3e8eb' : corEstado(it.k.estado, spec.sentido); c.fillRect(r.x, r.y + 5, 16, r.h - 10);
        if (it.k.destaque) { c.strokeStyle = '#102a43'; c.lineWidth = 2.5; c.strokeRect(r.x, r.y + 5, 16, r.h - 10); }
        c.textAlign = 'left'; c.fillStyle = '#243b53'; c.font = `${it.k.destaque ? 800 : 700} ${it.fs}px ${FONTE}`;
        c.fillText(`${it.sigla}  ${it.val} ${it.sim}`, r.x + 22, r.y + r.h / 2 + it.fs * 0.34);
      }
    });
    c.textAlign = 'left'; c.textBaseline = 'top'; c.font = `15px ${FONTE}`;
    let lx = 30; const ly = m.base - 52;
    for (const [rot, fundo] of [['▲/▼ significativa, sentido favorável', U.COR.bom], ['▲/▼ significativa, sentido desfavorável', U.COR.ruim], ['● estável (não significativa)', '#e3e8eb'], ['– sem comparação', '#e3e8eb']]) {
      c.fillStyle = fundo; c.fillRect(lx, ly, 22, 22); c.fillStyle = '#243b53'; c.fillText(rot, lx + 28, ly + 2); lx += c.measureText(rot).width + 60;
    }
    c.fillStyle = '#486581'; c.fillText('Limites estaduais do IBGE (malha simplificada: serve para mostrar, não para medir). Contorno grosso: a UF em destaque.', 30, ly + 30);
    m.cv._rotulos = L.itens.map(it => it.rect);
    return m.cv;
  }
  /* "Antes e agora" (halteres): uma linha por taxa, todas na MESMA escala de 0 a 100 (a posição é honesta), com o valor dos dois
     períodos e a variação publicada ao lado. Círculo vazio = período anterior; cheio = atual (ficam um dentro do outro quando a
     taxa não mudou). A cor só aparece quando o IBGE publica variação significativa; "estável" é o azul-ardósia. */
  function desenharHalteres(spec) {
    const n = spec.linhas.length, W = 1200, rowH = 68, H = Math.max(480, 250 + n * rowH), m = moldura(spec, W, H), c = m.c;
    const xr = 30, xl = 340, x0 = 380, x1 = 770, xv = 800, xc = 985, wc = 185;
    const maxv = Math.max.apply(null, [].concat.apply([], spec.linhas.map(l => [l.de, l.para])));
    const passo = maxv > 50 ? 20 : maxv > 25 ? 10 : maxv > 12 ? 5 : 2;
    const vmax = Math.max(passo * 2, Math.ceil(maxv * 1.08 / passo) * passo);
    const X = v => x0 + (x1 - x0) * v / vmax;
    const f1 = v => RM.fmtVis({ tipo: 'taxa', casas: 1 }, v);
    const yLeg = m.topo, yEixo = m.topo + 34, y0 = m.topo + 52, y1 = m.base - 34, h = Math.min(rowH, (y1 - y0) / n);
    // legenda e títulos de coluna
    c.textBaseline = 'middle'; c.font = `600 15px ${FONTE}`; c.textAlign = 'left'; c.fillStyle = '#243b53';
    c.lineWidth = 3; c.strokeStyle = MOLDURA.COR.estavel; c.fillStyle = '#fff'; c.beginPath(); c.arc(xr + 8, yLeg + 10, 8, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#243b53'; c.fillText(spec.perDe, xr + 24, yLeg + 10);
    const wDe = c.measureText(spec.perDe).width;
    c.fillStyle = MOLDURA.COR.estavel; c.beginPath(); c.arc(xr + 24 + wDe + 40, yLeg + 10, 8, 0, 7); c.fill();
    c.fillStyle = '#243b53'; c.fillText(spec.perPara, xr + 24 + wDe + 56, yLeg + 10);
    c.font = `700 13px ${FONTE}`; c.fillStyle = '#486581'; c.textAlign = 'left';
    c.fillText('ANTES → AGORA', xv, yEixo); c.fillText('VARIAÇÃO EM UM ANO', xc, yEixo);
    // linhas, faixa alternada e grade
    spec.linhas.forEach((l, i) => { if (i % 2 === 0) { c.fillStyle = '#f4f8fb'; c.fillRect(xr - 10, y0 + i * h, W - 2 * xr + 20, h); } });
    c.textAlign = 'center'; c.font = `13px ${FONTE}`;
    for (let v = 0; v <= vmax + 0.001; v += passo) {
      c.strokeStyle = '#d9e3ea'; c.lineWidth = 1; c.beginPath(); c.moveTo(X(v), y0); c.lineTo(X(v), y0 + n * h); c.stroke();
      c.fillStyle = '#6b8798'; c.fillText(`${v}%`, X(v), yEixo);
    }
    spec.linhas.forEach((l, i) => {
      const y = y0 + i * h + h / 2, cor = corEstado(l.estado, l.sentido), est = l.estado === 'estavel' || l.estado === 'sem' || l.estado === 'sig0', tom = est ? MOLDURA.COR.estavel : cor;
      // rótulo (até duas linhas, nunca cortado)
      c.font = `700 16px ${FONTE}`; c.fillStyle = '#102a43'; c.textAlign = 'left'; c.textBaseline = 'middle';
      const ls = quebrar(c, l.rotulo, xl - xr).slice(0, 2);
      ls.forEach((t, k) => c.fillText(t, xr, y + (k - (ls.length - 1) / 2) * 19));
      // trilho, haste e marcas
      c.strokeStyle = '#d3dee6'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(X(0), y); c.lineTo(X(vmax), y); c.stroke();
      if (Math.abs(X(l.para) - X(l.de)) > 4) { c.strokeStyle = tom; c.lineWidth = 6; c.beginPath(); c.moveTo(X(l.de), y); c.lineTo(X(l.para), y); c.stroke(); }
      c.lineCap = 'butt';
      c.fillStyle = '#fff'; c.strokeStyle = tom; c.lineWidth = 3.5; c.beginPath(); c.arc(X(l.de), y, 10, 0, 7); c.fill(); c.stroke();
      c.fillStyle = tom; c.beginPath(); c.arc(X(l.para), y, 6.5, 0, 7); c.fill();
      // valores
      c.textAlign = 'left'; c.font = `500 16px ${FONTE}`; c.fillStyle = '#486581';
      const sDe = f1(l.de); c.fillText(sDe, xv, y);
      const wd = c.measureText(sDe + '  →  ').width; c.fillText('→', xv + c.measureText(sDe + '  ').width, y);
      c.font = `800 17px ${FONTE}`; c.fillStyle = '#102a43'; c.fillText(f1(l.para), xv + wd, y);
      // variação publicada
      const sinal = d => (d > 0 ? '+' : d < 0 ? '−' : '');
      const d = l.va === undefined || l.va === null || isNaN(l.va) ? l.para - l.de : l.va, dTxt = `${sinal(d)}${RM.fmtVis({ tipo: 'taxa', casas: 1 }, Math.abs(d)).replace('%', '')} p.p.`;
      const rot = l.estado === 'estavel' ? `estável  ${dTxt}` : l.estado === 'sem' ? 'sem comparação' : l.estado === 'sig0' ? 'significativa' : `${l.estado === 'aumentou' ? '▲' : '▼'}  ${dTxt}`;
      c.fillStyle = est ? '#e5ecf1' : cor;
      const r = 14, ch = 30, cy = y - ch / 2;
      c.beginPath(); c.moveTo(xc + r, cy); c.arcTo(xc + wc, cy, xc + wc, cy + ch, r); c.arcTo(xc + wc, cy + ch, xc, cy + ch, r); c.arcTo(xc, cy + ch, xc, cy, r); c.arcTo(xc, cy, xc + wc, cy, r); c.fill();
      c.textAlign = 'center'; c.font = `700 15px ${FONTE}`; c.fillStyle = est ? '#486581' : '#fff'; c.fillText(rot, xc + wc / 2, y + 1);
    });
    // chave de cores
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = `13px ${FONTE}`;
    let lx = xr; const ly = m.base - 12;
    for (const [rot, fundo] of [['significativa, favorável', U.COR.bom], ['significativa, desfavorável', U.COR.ruim], ['estável / sem comparação', MOLDURA.COR.estavel]]) {
      c.fillStyle = fundo; c.beginPath(); c.arc(lx + 7, ly, 6, 0, 7); c.fill(); c.fillStyle = '#486581'; c.fillText(rot, lx + 20, ly); lx += c.measureText(rot).width + 54;
    }
    return m.cv;
  }
  function desenharTabela(spec) {
    const n = spec.linhas.length, W = 1200, H = 230 + (n + 1) * 44, m = moldura(spec, W, H), c = m.c;
    const cols = spec.colunas.length, x0 = 30, larg = W - 60, w0 = 330, wr = (larg - w0) / (cols - 1);
    const xs = i => (i === 0 ? x0 : x0 + w0 + (i - 1) * wr);
    let y = m.topo + 4;
    c.fillStyle = COR_INST; c.fillRect(x0, y, larg, 40);
    c.fillStyle = '#fff'; c.font = `700 15px ${FONTE}`; c.textBaseline = 'middle';
    spec.colunas.forEach((t, i) => { c.textAlign = i ? 'right' : 'left'; c.fillText(t, i ? xs(i) + wr - 10 : xs(i) + 10, y + 20); });
    y += 40;
    spec.linhas.forEach((l, k) => {
      c.fillStyle = k % 2 ? '#f6f9f3' : '#fff'; c.fillRect(x0, y, larg, 42);
      c.fillStyle = '#243b53'; c.font = `${k === 0 ? 700 : 400} 15px ${FONTE}`;
      l.forEach((t, i) => { c.textAlign = i ? 'right' : 'left'; c.fillText(String(t), i ? xs(i) + wr - 10 : xs(i) + 10, y + 21); });
      y += 42;
    });
    return m.cv;
  }
  function desenhar(spec) {
    if (spec.tipo === 'linha') return desenharLinha(spec);
    if (spec.tipo === 'barras') return desenharBarras(spec);
    if (spec.tipo === 'grade') return desenharGrade(spec);
    if (spec.tipo === 'halteres') return desenharHalteres(spec);
    return desenharTabela(spec);
  }
  /* uma tela do carrossel (1080×1080 ou 1080×1350) */
  function desenharTela(t, i, total, fmt, ind) {
    const W = 1080, H = fmt === '1080x1080' ? 1080 : 1350;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.fillStyle = COR_INST; c.fillRect(0, 0, W, 120);
    c.fillStyle = '#fff'; c.font = `700 40px ${FONTE}`; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText('PNAD Contínua – IBGE', 60, 60); c.textAlign = 'right'; c.font = `32px ${FONTE}`; c.fillText(`${i + 1}/${total}`, W - 60, 60);
    const L = W - 120, base = H - 110;            // largura útil e limite acima do rodapé (vale em 1080×1080)
    c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = '#102a43'; c.font = `800 64px ${FONTE}`;
    let y = 190; for (const l of linhasCabem(c, t.titulo, L, 3)) { c.fillText(l, 60, y); y += 78; }
    if (t.grande) {
      // o número grande encolhe até caber ("102,5 milhões", "R$ 3.799"): nunca sai da tela
      let px = 220; c.font = `900 ${px}px ${FONTE}`;
      while (px > 80 && c.measureText(t.grande).width > L) { px -= 10; c.font = `900 ${px}px ${FONTE}`; }
      c.fillStyle = U.COR.estrutura; c.fillText(t.grande, 60, y + 30); y += Math.round(px * 1.36);
    }
    if (t.grafico) {
      const its = t.grafico.itens, n = its.length, top = y + 20, alt = Math.max(120, Math.min(base - 130 - top, n * 110)), hh = alt / n;
      const vmax = Math.max.apply(null, its.map(b => b.valor)) * 1.1;
      if (n <= 6) {
        its.forEach((b, k) => {
          const yy = top + k * hh, fs = Math.min(36, Math.round(hh * 0.36));
          c.fillStyle = b.destaque ? U.COR.estrutura : MOLDURA.COR.demais; c.fillRect(60, yy + hh * 0.42, (W - 300) * b.valor / vmax, hh * 0.48);
          c.fillStyle = '#243b53'; c.font = `${b.destaque ? 800 : 500} ${fs}px ${FONTE}`; c.fillText(b.rotulo, 60, yy);
          c.fillText(RM.fmtVis(ind, b.valor), 80 + (W - 300) * b.valor / vmax, yy + hh * 0.42);
        });
      } else {
        // muitas barras (27 UFs): rótulo numa coluna à esquerda, na altura da barra, com fonte do tamanho da linha
        const fs = Math.max(14, Math.min(34, Math.round(hh * 0.7))), x0 = 170, larg = W - x0 - 200;
        c.textBaseline = 'middle';
        its.forEach((b, k) => {
          const yc = top + k * hh + hh / 2;
          c.fillStyle = b.destaque ? U.COR.estrutura : MOLDURA.COR.demais; c.fillRect(x0, yc - hh * 0.32, larg * b.valor / vmax, hh * 0.64);
          c.fillStyle = '#243b53'; c.font = `${b.destaque ? 800 : 500} ${fs}px ${FONTE}`;
          c.textAlign = 'right'; c.fillText(b.rotulo, x0 - 14, yc); c.textAlign = 'left'; c.fillText(RM.fmtVis(ind, b.valor), x0 + larg * b.valor / vmax + 10, yc);
        });
        c.textBaseline = 'top';
      }
      y = top + alt + 20;
    }
    if (t.texto) {
      c.fillStyle = '#334e68'; c.font = `500 44px ${FONTE}`;
      const max = Math.max(1, Math.floor((base - y) / 58));
      for (const l of linhasCabem(c, t.texto, L, max)) { c.fillText(l, 60, y); y += 58; }
    }
    c.fillStyle = '#607d8b'; c.font = `30px ${FONTE}`; c.textBaseline = 'bottom';
    c.fillText(linhasCabem(c, t.rodape, L, 1)[0], 60, H - 50);   // fonte em TODA tela (§11.6)
    return cv;
  }

  // ------------------------------------------------------------------ exportação
  function baixarBlob(blob, nome) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  const baixarTexto = (txt, nome, tipo) => baixarBlob(new Blob([txt], { type: (tipo || 'text/plain') + ';charset=utf-8' }), nome);
  function copiar(txt) {
    const ok = () => AMBIENTE.toast('Texto copiado.', 'ok');
    const reserva = () => { const ta = document.createElement('textarea'); ta.value = txt; document.body.append(ta); ta.select(); try { document.execCommand('copy'); ok(); } finally { ta.remove(); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, reserva); else reserva();
  }
  const nomeBase = F => `release_pnadc_${(F.terr.sigla || F.terr.id || 'br').toLowerCase()}_${F.per}_${ST.E.midia}`;
  function htmlDocumento(F, doc, txt, imagens) {
    const corpo = doc.formato === 'md' ? mdHtml(txt) : planoHtml(txt);
    const figs = imagens.map(im => `<figure><img src="${im.url}" alt="${U.esc(im.alt)}"><figcaption>${U.esc(im.titulo)} — ${U.esc(im.fonte || '')}</figcaption></figure>`).join('\n');
    const marca = (typeof MOLDURA !== 'undefined' && MOLDURA.logo) ? MOLDURA.logo(38).outerHTML : '';
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${U.esc(doc.titulo || 'Release PNAD Contínua')}</title>
<style>
:root { color-scheme: light; --verde: #0f5132; --verde2: #1b8a5a; --cinza: #587068; --borda: #dfe9e3; }
* { box-sizing: border-box; } html { background: #eef5f1; }
body { margin: 0; font: 11pt/1.6 "Segoe UI", Arial, sans-serif; color: #1f2933; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.topo { background: linear-gradient(120deg, #0b3d2b 0%, #146c43 60%, #1b8a5a 100%); color: #fff; padding: 16px 28px; display: flex; align-items: center; gap: 12px; }
.topo b { font-size: 14pt; letter-spacing: -.2px; } .topo small { display: block; opacity: .85; font-size: 9pt; }
.pagina { max-width: 800px; margin: 22px auto 40px; background: #fff; border: 1px solid var(--borda); border-radius: 16px; padding: 26px 34px 30px; box-shadow: 0 10px 30px rgba(16,42,35,.08); }
h1 { font-size: 21pt; line-height: 1.2; color: var(--verde); margin: 0 0 8px; letter-spacing: -.3px; } h1::after { content: ''; display: block; width: 56px; height: 3px; background: var(--verde2); border-radius: 2px; margin-top: 9px; }
h2 { font-size: 14pt; color: var(--verde); margin: 22px 0 4px; } h3 { font-size: 12pt; margin: 16px 0 4px; }
p { margin: 7px 0; text-align: justify; hyphens: auto; } p.fonte { font-size: 8.5pt; color: var(--cinza); text-align: left; margin-top: 10px; }
ul { margin: 6px 0 6px 20px; padding: 0; text-align: justify; } li { margin: 3px 0; }
blockquote { border-left: 4px solid #9be7bd; margin: 12px 0; padding: 4px 14px; background: #f5f9f7; color: #35524a; text-align: justify; }
figure { margin: 18px 0; break-inside: avoid; } figure img { width: 100%; border: 1px solid var(--borda); border-radius: 10px; } figcaption { font-size: 8.5pt; color: var(--cinza); margin-top: 4px; }
table.rel-tab { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 9.5pt; margin: 12px 0; border: 1px solid var(--borda); border-radius: 10px; overflow: hidden; font-variant-numeric: tabular-nums; }
.rel-tab th { background: var(--verde); color: #fff; padding: 7px 9px; text-align: left; font-weight: 700; } .rel-tab td { padding: 6px 9px; border-bottom: 1px solid #eef3f0; }
.rel-tab th.n, .rel-tab td.n { text-align: right; } .rel-tab tbody tr:nth-child(even) td { background: #f7faf8; } .rel-tab tbody tr:last-child td { border-bottom: 0; }
.rodape { margin-top: 26px; padding-top: 10px; border-top: 1px solid var(--borda); font-size: 8.5pt; color: var(--cinza); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
@page { size: A4 portrait; margin: 14mm; }
@media print { html { background: #fff; } .pagina { border: 0; box-shadow: none; margin: 0; padding: 0; max-width: none; border-radius: 0; } .topo { border-radius: 6px; margin-bottom: 14px; } }
</style></head><body>
<header class="topo">${marca}<div><b>PNADC Resultados</b><small>Números da PNAD Contínua, do IBGE</small></div></header>
<main class="pagina">
${corpo}
${figs}
<div class="rodape"><span>Fonte: IBGE, PNAD Contínua (SIDRA).</span><span>Gerado em ${new Date().toLocaleDateString('pt-BR')} por ${U.esc(AMBIENTE.produto || 'PNADC Resultados')}</span></div>
</main></body></html>`;
  }
  function imagensDe(doc) {
    const out = [];
    for (const v of doc.visuais || []) { try { out.push({ id: v.id, titulo: v.titulo, fonte: v.fonte, alt: v.alt, url: desenhar(v).toDataURL('image/png') }); } catch (e) { console.error(e); } }
    return out;
  }
  function csvNumeros(F) {
    const q = s => `"${String(s === null || s === undefined ? '' : s).replace(/"/g, '""')}"`;
    const cab = ['indicador', 'territorio', 'periodo', 'valor', 'cv', 'precisao', 'variacao_ano', 'situacao_ano', 'variacao_periodo_anterior', 'situacao_periodo_anterior', 'tabela_sidra', 'divulgacao', 'consulta_em'];
    const ls = F.itens.map(it => [it.ind.rotulo, F.terr.nome, F.per, it.v, it.cv, RM.precisao(it.cv).classe, it.va, it.sa || '-', it.vc, it.sc || '-', it.tab, F.div.data, F.consulta]);
    return '﻿' + [cab].concat(ls).map(l => l.map(q).join(';')).join('\r\n');
  }

  // ------------------------------------------------------------------ controles
  const ir = passo => { location.hash = `#/publicacoes?sec=release&passo=${passo}`; };
  let redesenharPrevia = () => {}, redesenharTudo = () => {};
  function mudar(fn, completo) {
    const antes = JSON.stringify([ST.E.territorio, ST.E.familia, ST.E.midia, ST.E.serie]);
    fn(ST.E);
    ST.E = RM.normalizar(ST.E);
    if (!ST.visuaisManuais && antes !== JSON.stringify([ST.E.territorio, ST.E.familia, ST.E.midia, ST.E.serie])) ST.E.visuais = RM.sugerirVisuais(ST.E);
    salvarAtual();
    if (completo) redesenharTudo(); else redesenharPrevia();
  }
  const radio = (nome, opcoes, atual, aoMudar) => U.el('div', { class: 'rel-opcoes', role: 'radiogroup' }, ...opcoes.map(o => U.el('label', {
    class: 'rel-opcao' + (o.id === atual ? ' ativa' : '') + (o.desabilitado ? ' desabilitada' : ''),
    style: { display: 'block', padding: '7px 9px', margin: '0 0 6px', border: '1px solid var(--borda)', borderRadius: '7px', cursor: o.desabilitado ? 'not-allowed' : 'pointer', background: o.id === atual ? 'var(--azul-claro)' : '#fff', opacity: o.desabilitado ? 0.55 : 1 } },
    U.el('input', { type: 'radio', name: nome, value: o.id, checked: o.id === atual, disabled: !!o.desabilitado, onchange: () => aoMudar(o.id), style: { marginRight: '6px' } }),
    U.el('b', {}, o.rot), o.desc ? U.el('div', { class: 'mini-info', style: { marginLeft: '22px' } }, o.desc) : null,
    o.desabilitado ? U.el('div', { class: 'mini-info', style: { marginLeft: '22px', color: 'var(--vermelho)' } }, o.desabilitado) : null)));
  const campo = (rot, el, ajuda) => U.el('label', { style: { display: 'block', margin: '0 0 8px' } }, U.el('div', { style: { fontWeight: 600, fontSize: '12.5px', marginBottom: '2px' } }, rot), el, ajuda ? U.el('div', { class: 'mini-info' }, ajuda) : null);
  const caixaMarcar = (rot, valor, aoMudar, ajuda) => U.el('label', { style: { display: 'block', margin: '0 0 6px' } }, U.el('input', { type: 'checkbox', checked: !!valor, onchange: e => aoMudar(e.target.checked), style: { marginRight: '6px' } }), rot, ajuda ? U.el('div', { class: 'mini-info', style: { marginLeft: '22px' } }, ajuda) : null);
  const entrada = (valor, aoMudar, attrs) => U.el('input', Object.assign({ value: valor || '', class: 'rel-campo', style: { width: '100%', padding: '5px 7px', border: '1px solid var(--borda)', borderRadius: '6px', boxSizing: 'border-box' }, oninput: e => aoMudar(e.target.value) }, attrs || {}));

  // ------------------------------------------------------------------ os passos
  function passoTerritorio(D, F) {
    const ts = RM.territorios(D, ST.E.ufsEscopo);
    const ops = ts.map(t => ({ id: t.id, rot: t.id === 'ufs' ? 'Comparar UFs' : t.id === 'brasil' ? 'Brasil' : t.id === 'regiao' ? `Grande Região (${t.regNome})` : t.id === 'uf' ? `UF (${t.nome})` : `Capital${t.nome ? ' (' + t.nome + ')' : ''}`,
      desc: { brasil: 'Trimestre móvel (mensal) ou trimestre civil; no trimestral, o texto conta em quantas UFs a variação foi significativa.', regiao: 'Só trimestre civil; referência = Brasil.', uf: 'Só trimestre civil; referências = Brasil e Grande Região; habilita ranking entre as UFs e o cartograma.', capital: 'Só trimestre civil e só desocupação e rendimento (o que o IBGE divulga para o município da capital).', ufs: 'O texto vira comparação: em quantas UFs a variação foi significativa, maiores e menores, e a UF da instalação.' }[t.id],
      desabilitado: t.indisponivel || null }));
    const corpo = [radio('rel-terr', ops, ST.E.territorio, v => mudar(E => { E.territorio = v; }, true))];
    if (ST.E.territorio === 'ufs') corpo.push(campo('Quais UFs', U.seg([{ valor: 'regiao', rotulo: `UFs da Região ${F.regNome || ''}` }, { valor: 'todas', rotulo: 'Todas as 27' }], ST.E.ufsEscopo, v => mudar(E => { E.ufsEscopo = v; }, true))));
    return corpo;
  }
  function passoPeriodo(D, F) {
    const P = RM.periodos, corpo = [];
    const familias = [{ id: 'trimestral', rot: 'Trimestre civil (trimestral)', desc: 'Brasil, Grandes Regiões, UFs e capitais. Divulgação quatro vezes por ano.' },
      { id: 'movel', rot: 'Trimestre móvel (mensal)', desc: 'Só o Brasil. Compara com o trimestre móvel de três meses antes (sem sobreposição) e com o mesmo do ano anterior.', desabilitado: ST.E.territorio !== 'brasil' ? 'O trimestre móvel não existe para UF, Grande Região nem capital.' : null }];
    corpo.push(radio('rel-fam', familias, ST.E.familia, v => mudar(E => { E.familia = v; E.periodo = null; }, true)));
    const pers = RM.periodosDisponiveis(D, ST.E).slice(0, 12);
    const sel = U.el('select', { onchange: e => mudar(E => { E.periodo = e.target.value; }, true), style: { padding: '4px' } }, ...pers.map((p, i) => U.el('option', { value: p, selected: p === F.per }, P.perLongo(p, ST.E.familia) + (i === 0 ? ' (o mais recente)' : ''))));
    corpo.push(campo('Período de referência', sel, ST.E.familia === 'trimestral' && ['uf', 'ufs', 'brasil'].indexOf(ST.E.territorio) >= 0
      ? `Só aparecem os trimestres com pelo menos ${RM.UFS_MIN} UFs no cache: das outras UFs ${AMBIENTE.produto || 'o programa'} guarda os últimos trimestres, e ranking, "comparar UFs" e cartograma precisam delas.` : null));
    corpo.push(caixaMarcar(`Comparar com o ${ST.E.familia === 'trimestral' ? 'trimestre anterior' : 'trimestre móvel de três meses antes'}`, ST.E.comparar.anterior, v => mudar(E => { E.comparar.anterior = v; }), 'Com o 1º trimestre na conta, o texto acrescenta a ressalva sazonal.'));
    corpo.push(caixaMarcar('Comparar com o mesmo trimestre do ano anterior', ST.E.comparar.ano, v => mudar(E => { E.comparar.ano = v; }), 'A comparação anual é a mais segura para falar de tendência.'));
    corpo.push(campo('Série histórica', U.el('select', { onchange: e => mudar(E => { E.serie = e.target.value; }, true), style: { padding: '4px' } },
      ...[['nao', 'Sem série'], ['desde2012', 'Desde o início da série'], ['n5', 'Últimos cinco anos'], ['n2', 'Últimos dois anos']].map(([v, r]) => U.el('option', { value: v, selected: ST.E.serie === v }, r))),
    '"Menor/maior da série" só aparece com a série inteira; com janela curta, o texto diz só o intervalo.'));
    const div = F.div || {};
    corpo.push(U.el('div', { class: div.data ? 'aviso' : 'aviso erro', style: { margin: '8px 0' } },
      div.data ? `Divulgação oficial de ${F.per ? P.perLongo(F.per, ST.E.familia) : '—'}: ${U.fmtData(div.data)} (${div.origem}). ` : 'Data de divulgação oficial desconhecida no cache: informe abaixo, a partir do calendário de divulgação do IBGE. ',
      'A PNAD Contínua é conjuntural: não há embargo, e o release não pode sair antes dessa data.'));
    corpo.push(campo('Data de publicação do release', entrada(ST.E.extras.dataPublicacao, v => mudar(E => { E.extras.dataPublicacao = v; }), { type: 'date' })));
    corpo.push(campo('Data de divulgação oficial (só se precisar corrigir)', entrada(ST.E.extras.divulgacaoManual, v => mudar(E => { E.extras.divulgacaoManual = v; }), { type: 'date' }), 'Deixe vazio para usar a data do período na API do IBGE.'));
    return corpo;
  }
  function passoIndicadores(D, F) {
    const sug = RM.ordemSugerida(D, ST.E);
    const sel = ST.E.indicadores || [];
    const linha = (x, i, marcado) => {
      const it = x.it, ind = it.ind, prec = RM.precisao(it.cv);
      const sit = (d, cod) => (typeof PUBLICACOES !== 'undefined' ? PUBLICACOES.situacao(ind, d, cod) : { rot: cod || '—', cor: '#999' });
      const sa = sit(it.va, it.sa), sc = sit(it.vc, it.sc);
      return U.el('div', { style: { display: 'flex', gap: '6px', alignItems: 'flex-start', padding: '6px 4px', borderBottom: '1px solid var(--borda)', opacity: it.indisponivel ? 0.5 : 1 } },
        U.el('input', { type: 'checkbox', checked: marcado, disabled: !!it.indisponivel, onchange: e => mudar(E => { E.indicadores = e.target.checked ? sel.concat([ind.id]) : sel.filter(y => y !== ind.id); }, true) }),
        U.el('div', { style: { flex: 1 } }, U.el('b', {}, (marcado ? `${i + 1}. ` : '') + ind.rotulo),
          it.indisponivel ? U.el('div', { class: 'mini-info' }, it.indisponivel)
            : U.el('div', { class: 'mini-info' }, `${RM.fmtVis(ind, it.v)} · em um ano: `, U.el('span', { style: { color: sa.cor, fontWeight: 700 } }, sa.rot),
              ` · período anterior: `, U.el('span', { style: { color: sc.cor, fontWeight: 700 } }, sc.rot), ` · CV ${it.cv === null || it.cv === undefined ? '–' : U.fmtNum(it.cv, 1) + '%'} (${prec.classe})`,
              it.cv > RM.CV_LIDE_MAX ? U.el('span', { style: { color: U.COR.ruim, fontWeight: 700 } }, ' · não vira manchete nem lide') : null)),
        marcado ? U.el('div', { style: { display: 'flex', gap: '2px' } },
          U.el('button', { class: 'btn pequeno', title: 'subir', disabled: i === 0, onclick: () => mudar(E => { const a = E.indicadores.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; E.indicadores = a; }, true) }, '▲'),
          U.el('button', { class: 'btn pequeno', title: 'descer', disabled: i === sel.length - 1, onclick: () => mudar(E => { const a = E.indicadores.slice(); [a[i + 1], a[i]] = [a[i], a[i + 1]]; E.indicadores = a; }, true) }, '▼')) : null);
    };
    const corpo = [U.el('p', { class: 'mini-info', style: { marginTop: 0 } }, 'Marque os indicadores; a ORDEM define o destaque (o 1º com precisão suficiente vira manchete e lide). A ordem sugerida vem da significância publicada, do tamanho da variação e da precisão (CV).')];
    sel.forEach((id, i) => { const x = sug.find(s => s.id === id); if (x) corpo.push(linha(x, i, true)); });
    corpo.push(U.el('div', { class: 'mini-info', style: { margin: '8px 0 2px', fontWeight: 700 } }, 'Não incluídos'));
    sug.filter(x => sel.indexOf(x.id) < 0).forEach(x => corpo.push(linha(x, -1, false)));
    corpo.push(U.el('button', { class: 'btn pequeno', style: { marginTop: '8px' }, onclick: () => mudar(E => { E.indicadores = RM.ordemSugerida(D, E).filter(x => !x.it.indisponivel).slice(0, 5).map(x => x.id); }, true) }, 'Restaurar a ordem sugerida'));
    return corpo;
  }
  const passoPublico = () => [radio('rel-pub', RM.PUBLICOS, ST.E.publico, v => mudar(E => { E.publico = v; }, true))];
  const passoMidia = () => [radio('rel-mid', RM.MIDIAS, ST.E.midia, v => mudar(E => { E.midia = v; }, true))];
  function passoEstilo(D, F) {
    const out = [radio('rel-est', RM.ESTILOS, ST.E.estilo, v => mudar(E => { E.estilo = v; if (v === 'didatico') E.extras.entenda = true; }, true))];
    const jornal = ST.E.midia === 'site' || ST.E.midia === 'impresso';
    const A = jornal && F && F.lide ? RM.alternativas(F) : null;
    out.push(U.el('div', { style: { fontWeight: 700, fontSize: '14px', margin: '16px 0 2px' } }, 'Alternativas de redação'));
    if (!A) {
      out.push(U.el('div', { class: 'mini-info' }, 'Manchete, linha fina e abertura alternativas aparecem para Site e Jornal (passo 5), com um indicador de destaque válido.'));
      return out;
    }
    out.push(U.el('div', { class: 'mini-info', style: { marginBottom: '4px' } }, 'Escolha a redação de cada parte; a prévia muda na hora. Todas usam só números publicados, o mesmo critério de significância e passam pela mesma conferência (passo 10).'));
    const sel = ST.E.extras.alt || {};
    const grupo = (chave, rotulo, lista) => {
      if (lista.length < 2) return;
      const atual = (lista.find(a => a.id === sel[chave]) || lista[0]).id;
      out.push(U.el('div', { style: { fontWeight: 600, fontSize: '12.5px', margin: '12px 0 4px' } }, rotulo),
        radio('rel-alt-' + chave, lista.map(a => ({ id: a.id, rot: a.rot, desc: `${a.texto}  ·  ${a.nota}` })), atual, v => mudar(E => { E.extras.alt[chave] = v; }, true)));
    };
    grupo('titulo', 'Manchete', A.titulo);
    grupo('linhaFina', 'Linha fina', A.linhaFina);
    grupo('lide', 'Abertura (lide)', A.lide);
    return out;
  }
  function passoTamanho(D, F, doc) {
    const md = RM.midia(ST.E.midia), m = doc.metricas || {};
    let corpo;
    if (md.tamanhos[0] === 'fixo') corpo = [U.el('p', {}, `${md.rot}: o tamanho é o limite da plataforma (${ST.E.midia === 'x' ? '280 caracteres, o link conta 23' : ST.E.midia === 'linkedin' ? 'até 3.000 caracteres' : 'cabe numa tela de celular, 400 a 700 caracteres'}).`)];
    else if (md.id === 'instagram') corpo = [U.seg(md.tamanhos.map(n => ({ valor: n, rotulo: `${n} telas` })), +ST.E.telas, v => mudar(E => { E.telas = v; }, true)), U.el('p', { class: 'mini-info' }, 'Legenda até 2.200 caracteres, com o fato nos primeiros 125 (o que aparece antes do "mais").')];
    else if (typeof md.tamanhos[0] === 'number') corpo = [U.seg(md.tamanhos.map(n => ({ valor: n, rotulo: `${n} s` })), +ST.E.segundos, v => mudar(E => { E.segundos = v; }, true)),
      U.el('p', { class: 'mini-info' }, `Locução a 130-150 palavras por minuto: ${ST.E.segundos} s ≈ ${Math.round(ST.E.segundos * 130 / 60)} a ${Math.round(ST.E.segundos * 150 / 60)} palavras faladas (contadas depois de passar os números para extenso).`)];
    else corpo = [radio('rel-tam', md.tamanhos.map(t => ({ id: t, rot: RM.TAMANHOS[t].rot, desc: `${U.fmtInt(RM.TAMANHOS[t].faixa[0])} a ${U.fmtInt(RM.TAMANHOS[t].faixa[1])} caracteres` + (t === 'curta' ? ' · título, lide e fonte' : t === 'padrao' ? ' · linha fina, sublide, destaques, 3 a 5 indicadores, nota e contato' : ' · intertítulos, série, ranking, tabela, "Entenda" e nota estendida') })), ST.E.tamanho, v => mudar(E => { E.tamanho = v; }, true)),
      U.el('p', { class: 'mini-info' }, 'O texto é montado completo e cortado de baixo para cima até caber; nota metodológica, fonte e contato nunca são cortados, e número nenhum perde a frase de significância.')];
    corpo.push(metricasEl(doc));
    return corpo;
  }
  function metricasEl(doc) {
    const m = RM.metricas(textoAtual(doc), ST.E, doc);
    const partes = [`${U.fmtInt(m.caracteres)} caracteres`, `${U.fmtInt(m.palavras)} palavras`];
    if (ST.E.midia === 'radio' || ST.E.midia === 'tv') partes.push(`${m.palavrasFaladas} palavras faladas · ~${m.locucaoSeg} s de locução`);
    else partes.push(`leitura ~${m.leituraMin < 1 ? Math.max(1, Math.round(m.leituraMin * 60)) + ' s' : U.fmtNum(m.leituraMin, 1) + ' min'}`);
    if (ST.E.midia === 'x') partes.push(`${m.caracteresX} no X (link = 23)`);
    return U.el('div', { class: 'mini-info rel-metricas', style: { margin: '6px 0' } }, U.el('b', {}, 'Medida agora: '), partes.join(' · '));
  }
  function passoVisuais(D, F, doc) {
    const V = ST.E.visuais || {};
    const marca = (k, rot, ajuda) => caixaMarcar(rot, V[k], v => { ST.visuaisManuais = true; mudar(E => { E.visuais = Object.assign({}, E.visuais, { [k]: v }); }, true); }, ajuda);
    const corpo = [
      U.el('p', { class: 'mini-info', style: { marginTop: 0 } }, 'Sugestão pela combinação território × período (§12.7). Toda imagem leva título com a conclusão, fonte e data dentro dela, e texto alternativo.'),
      marca('linha', 'Gráfico de linha (série)', 'O território em azul forte, a região em cinza, o Brasil tracejado; eixo de 0 ao máximo + 10%.'),
      marca('barras', 'Barras horizontais (as 27 UFs)', 'Só no trimestral; a UF em destaque, linha tracejada do Brasil, ▲▼● pela situação publicada.'),
      marca('halteres', 'Halteres (dois períodos)', 'As taxas do território, ano anterior × agora; "estável" na mesma cor quando não é significativa.'),
      marca('tabela', 'Tabela', 'Território, região e Brasil, com CV e a situação publicada.'),
      marca('grade', 'Mapa das UFs (limites reais)', 'Os limites das 27 UFs, com sigla e valor; a cor é a situação da variação publicada; UF em destaque com contorno grosso.'),
    ];
    if (ST.E.midia === 'instagram') corpo.push(campo('Formato das telas do carrossel', U.seg([{ valor: '1080x1080', rotulo: '1080 × 1080' }, { valor: '1080x1350', rotulo: '1080 × 1350' }], ST.E.formatoImg, v => mudar(E => { E.formatoImg = v; }, true))));
    if (ST.E.midia === 'radio') corpo.push(U.el('div', { class: 'aviso' }, 'Rádio não leva imagem.'));
    if (ST.E.midia === 'tv') corpo.push(U.el('div', { class: 'aviso' }, 'Na TV a arte é o GC (até três números), já no roteiro.'));
    return corpo;
  }
  function passoExtras(D, F) {
    const x = ST.E.extras;
    return [
      caixaMarcar('Reservar espaço para a fala de um porta-voz', x.portaVoz.incluir, v => mudar(E => { E.extras.portaVoz.incluir = v; }), 'O gerador NUNCA escreve citação: deixa um espaço reservado, e a exportação fica bloqueada até ele ser preenchido com declaração real (dita ou aprovada pela pessoa) ou removido.'),
      x.portaVoz.incluir ? U.el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } }, campo('Nome', entrada(x.portaVoz.nome, v => mudar(E => { E.extras.portaVoz.nome = v; }))), campo('Cargo', entrada(x.portaVoz.cargo, v => mudar(E => { E.extras.portaVoz.cargo = v; })))) : null,
      U.el('div', { style: { fontWeight: 700, margin: '10px 0 4px' } }, 'Contato de imprensa'),
      U.el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' } },
        campo('Setor', entrada(x.contato.setor, v => mudar(E => { E.extras.contato.setor = v; }), { placeholder: 'Assessoria de comunicação' })),
        campo('Telefone', entrada(x.contato.telefone, v => mudar(E => { E.extras.contato.telefone = v; }), { type: 'tel' })),
        campo('E-mail', entrada(x.contato.email, v => mudar(E => { E.extras.contato.email = v; }), { type: 'email' }))),
      campo('Cidade do release', entrada(x.cidade, v => mudar(E => { E.extras.cidade = v; }), { placeholder: F.capNome || 'cidade' }), 'Abre o lide ("Porto Velho, 26 de outubro de 2026 –"). Vazio = a capital da UF.'),
      campo('Link da divulgação', entrada(x.link, v => mudar(E => { E.extras.link = v; }), { type: 'url', placeholder: F.tabelas && F.tabelas[0] ? `https://sidra.ibge.gov.br/tabela/${F.tabelas[0]}` : 'https://' }), 'Vazio = a tabela do SIDRA do indicador principal.'),
      campo('Nota metodológica', U.el('select', { onchange: e => mudar(E => { E.extras.nota = e.target.value; }), style: { padding: '4px' } },
        ...[['auto', 'Automática (mínima no padrão, estendida no completo)'], ['minima', 'Mínima (texto fixo)'], ['estendida', 'Estendida (CV, rotação, significância)'], ['link', 'Só o link']].map(([v, r]) => U.el('option', { value: v, selected: x.nota === v }, r)))),
      caixaMarcar('Caixa "Entenda o indicador"', x.entenda, v => mudar(E => { E.extras.entenda = v; })),
      caixaMarcar('Destaques em tópicos', x.destaques, v => mudar(E => { E.extras.destaques = v; })),
    ];
  }

  // ------------------------------------------------------------------ resumo e prévia
  function resumoEl(F) {
    const E = ST.E, P = RM.periodos, rot = (lista, id) => (lista.find(x => x.id === id) || {}).rot || id;
    const md = RM.midia(E.midia);
    const tam = md.tamanhos[0] === 'fixo' ? 'limite da plataforma' : E.midia === 'instagram' ? `${E.telas} telas` : typeof md.tamanhos[0] === 'number' ? `${E.segundos} s` : RM.TAMANHOS[E.tamanho].rot;
    const vis = Object.keys(E.visuais || {}).filter(k => E.visuais[k]).map(k => ({ linha: 'linha', barras: 'barras', halteres: 'halteres', tabela: 'tabela', grade: 'cartograma' })[k]);
    const itens = [['Território', F.terr ? F.terr.nome : '—', 1], ['Período', F.per ? P.perLongo(F.per, E.familia) : '—', 2],
      ['Compara com', [E.comparar.anterior ? 'período anterior' : null, E.comparar.ano ? 'ano anterior' : null].filter(Boolean).join(' e ') || 'nada', 2],
      ['Indicadores', (F.itens || []).map(i => i.ind.curto).join(', ') || '—', 3], ['Público', rot(RM.PUBLICOS, E.publico), 4], ['Mídia', md.rot, 5],
      ['Estilo', rot(RM.ESTILOS, E.estilo), 6], ['Tamanho', tam, 7], ['Visuais', vis.join(', ') || 'nenhum', 8]];
    return U.el('div', { class: 'chips', style: { margin: '0 0 8px' } }, ...itens.map(([r, v, n]) => U.el('a', { class: 'chip', href: `#/publicacoes?sec=release&passo=${n}`, title: 'voltar a este passo' }, U.el('b', {}, r + ': '), v)));
  }
  function previaEl(F, doc) {
    const box = U.el('div', { class: 'rel-previa' });
    const txt = textoAtual(doc);
    if (F.bloqueios.length) box.append(U.el('div', { class: 'aviso erro' }, U.el('b', {}, 'Bloqueado: '), F.bloqueios.join(' ')));
    if (F.avisos.length) box.append(U.el('div', { class: 'aviso' }, U.el('b', {}, 'Avisos: '), U.el('ul', { style: { margin: '2px 0 0 18px', padding: 0 } }, ...F.avisos.map(a => U.el('li', {}, a)))));
    const papel = U.el('div', { style: { background: '#fff', border: '1px solid var(--borda)', borderRadius: '8px', padding: '14px 18px', lineHeight: 1.5, fontSize: '14px', maxHeight: '70vh', overflow: 'auto' } });
    papel.innerHTML = doc.formato === 'md' ? mdHtml(txt) : planoHtml(txt);   // mdHtml/planoHtml escapam todo o texto
    box.append(U.el('div', { class: 'mini-info', style: { margin: '6px 0 4px' } }, `RASCUNHO gerado pelo ${AMBIENTE.produto || 'programa'} a partir das estimativas publicadas — a publicação é de quem tem a atribuição para divulgar.`), papel);
    if (doc.telas) {
      const g = U.el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '8px', marginTop: '10px' } });
      doc.telas.forEach((t, i) => { const cv = desenharTela(t, i, doc.telas.length, ST.E.formatoImg, F.lide.ind); cv.style.width = '100%'; cv.style.border = '1px solid var(--borda)'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', t.alt); cv.title = t.alt; g.append(cv); });
      box.append(U.el('div', { style: { fontWeight: 700, marginTop: '10px' } }, 'Telas do carrossel'), g);
    }
    for (const v of doc.visuais || []) {
      try {
        const cv = desenhar(v); cv.style.width = '100%'; cv.style.border = '1px solid var(--borda)'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', v.alt);
        box.append(U.el('div', { style: { marginTop: '10px' } }, cv, U.el('details', {}, U.el('summary', { class: 'mini-info' }, 'Texto alternativo'), U.el('div', { class: 'mini-info' }, v.alt))));
      } catch (e) { console.error(e); }
    }
    return box;
  }

  // ------------------------------------------------------------------ passo 10: edição, conferência, exportação
  function passoSaida(D, F, doc, lado) {
    const corpo = [];
    const mudouBase = ST.texto !== null && ST.base !== null && ST.base !== doc.texto;
    if (mudouBase) corpo.push(U.el('div', { class: 'aviso' }, 'As escolhas mudaram depois da sua edição. ',
      U.el('button', { class: 'btn pequeno', onclick: () => { ST.texto = null; ST.base = null; ST.marcados = {}; salvarAtual(); redesenharTudo(); } }, 'Regerar o texto (descarta a edição)'), ' ',
      U.el('button', { class: 'btn pequeno', onclick: () => { ST.base = doc.texto; salvarAtual(); redesenharTudo(); } }, 'Manter a minha edição')));
    const ta = U.el('textarea', { class: 'rel-editor', spellcheck: 'true', style: { width: '100%', minHeight: '340px', boxSizing: 'border-box', font: '13px/1.45 Consolas, "Segoe UI", monospace', padding: '8px', border: '1px solid var(--borda)', borderRadius: '6px' } });
    ta.value = textoAtual(doc);
    const conf = U.el('div', { class: 'rel-conferencia' }), exp = U.el('div', { class: 'rel-exportar' }), met = U.el('div');
    const atualizar = () => { U.trocarFilhos(met, metricasEl(doc)); desenharConferencia(F, doc, conf, exp); if (lado) U.trocarFilhos(lado, previaEl(F, doc)); };
    const deb = U.debounce ? U.debounce(atualizar, 350) : atualizar;
    // texto mudou: as conferências MANUAIS valem para o texto final, então voltam a ser pedidas
    ta.addEventListener('input', () => { ST.texto = ta.value; if (ST.base === null) ST.base = doc.texto; ST.marcados = {}; salvarAtual(); deb(); });
    corpo.push(U.el('div', { style: { fontWeight: 700, margin: '0 0 4px' } }, `Texto (${doc.formato === 'md' ? 'Markdown leve: # título, ## intertítulo, - tópico, **negrito**' : 'texto simples'}) — edite à vontade; a conferência roda sobre o que está aqui.`), ta, met,
      U.el('div', { style: { margin: '4px 0 10px' } }, U.el('button', { class: 'btn pequeno', onclick: () => { ST.texto = null; ST.base = null; ST.marcados = {}; salvarAtual(); redesenharTudo(); } }, 'Voltar ao texto gerado')),
      U.el('div', { style: { fontWeight: 700, margin: '8px 0 4px' } }, 'Conferência antes de exportar'), conf, exp);
    setTimeout(atualizar, 0);
    return corpo;
  }
  function desenharConferencia(F, doc, conf, exp) {
    const txt = textoAtual(doc);
    const lista = RM.conferir(txt, F, doc, ST.marcados);
    const bloq = F.bloqueios.map(b => ({ ok: false, bloqueia: true, texto: b, id: 'f' }));
    const MANUAL = { manualNumeros: 'numeros', manualRevisao: 'revisao', manualAlt: 'alt', aspas: 'aspasReais' };
    const itens = bloq.concat(lista).map(c => {
      const man = MANUAL[c.id] && (c.id !== 'aspas' || /["“”«»]/.test(txt));
      const marca = c.ok ? '✔' : c.bloqueia ? '✖' : '!';
      const cor = c.ok ? U.COR.bom : c.bloqueia ? U.COR.ruim : U.COR.atencaoForte;
      return U.el('div', { style: { display: 'flex', gap: '6px', alignItems: 'flex-start', margin: '3px 0' } },
        man ? U.el('input', { type: 'checkbox', checked: !!ST.marcados[MANUAL[c.id]], onchange: e => { ST.marcados[MANUAL[c.id]] = e.target.checked; salvarAtual(); desenharConferencia(F, doc, conf, exp); }, title: 'marque depois de conferir' })
          : U.el('span', { style: { color: cor, fontWeight: 800, width: '14px', display: 'inline-block' } }, marca),
        U.el('div', {}, U.el('span', { style: { color: c.ok ? 'inherit' : cor, fontWeight: c.ok ? 400 : 700 } }, c.texto), c.detalhe ? U.el('div', { class: 'mini-info' }, c.detalhe) : null));
    });
    U.trocarFilhos(conf, ...itens);
    const libera = !F.bloqueios.length && RM.podeExportar(lista);
    U.trocarFilhos(exp, botoesExportar(F, doc, libera));
  }
  /* texto do release (Markdown leve ou plano) -> blocos para o PDF direto (PDFREL): títulos, parágrafos, tópicos,
     citações, TABELAS (linhas "| a | b |" em qualquer ponto) e a linha de "Fonte" em corpo menor */
  function blocosPdf(txt, doc) {
    const out = [], md = doc.formato === 'md';
    const limpa = s => String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
    const cel = l => l.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => limpa(c.trim()));
    const sep = l => /^[\s|:-]+$/.test(l) && /-/.test(l);
    let par = [], tab = [];
    const fecha = () => { if (par.length) { const t = limpa(par.join(md ? ' ' : '\n')); out.push({ t: /^Fontes?:/i.test(t) ? 'fonte' : 'p', texto: t }); par = []; } };
    const fechaTab = () => { if (tab.length) { out.push({ t: 'tabela', cab: cel(tab[0]), linhas: tab.slice(1).filter(l => !sep(l)).map(cel) }); tab = []; } };
    String(txt).split('\n').forEach(l => {
      let m;
      if (/^\s*\|/.test(l)) { fecha(); tab.push(l); return; }
      fechaTab();
      if (!l.trim()) { fecha(); return; }
      if (md && (m = /^(#{1,3})\s+(.*)$/.exec(l))) { fecha(); out.push({ t: 'h' + m[1].length, texto: limpa(m[2]) }); }
      else if (md && /^- /.test(l)) { fecha(); out.push({ t: 'li', texto: limpa(l.slice(2)) }); }
      else if (md && /^>\s?/.test(l)) { fecha(); out.push({ t: 'q', texto: limpa(l.replace(/^>\s?/, '')) }); }
      else par.push(l.trim());
    });
    fechaTab(); fecha();
    return out;
  }
  function baixarPdfRelease(F, doc, txt, base) {
    const paginas = [{ tipo: 'texto', blocos: blocosPdf(txt, doc) }];
    for (const v of doc.visuais || []) { try { paginas.push({ tipo: 'imagem', canvas: desenhar(v) }); } catch (e) { console.error(e); } }
    baixarBlob(PDFREL.criar({ titulo: doc.titulo || 'Release PNAD Contínua', assunto: 'Release da PNAD Contínua (IBGE)', paginas,
      rodape: `Fonte: IBGE, PNAD Contínua (SIDRA). Gerado em ${new Date().toLocaleDateString('pt-BR')} por ${AMBIENTE.produto || 'PNADC Resultados'}.` }), base + '.pdf');
  }
  /* Word (.docx) e OpenDocument (.odt): o mesmo conteúdo do PDF direto (títulos, texto, tópicos, tabelas) e as imagens no fim */
  function montarDocEditavel(F, doc, txt) {
    const lista = (doc.visuais || []).map(v => { try { return { v, cv: desenhar(v) }; } catch (e) { console.error(e); return null; } }).filter(Boolean);
    const lerImg = it => new Promise(res => it.cv.toBlob(bl => bl.arrayBuffer().then(ab => res({ bytes: new Uint8Array(ab), largura: it.cv.width, altura: it.cv.height, titulo: it.v.titulo, alt: it.v.alt })), 'image/png'));
    return Promise.all(lista.map(lerImg)).then(imagens => ({ titulo: doc.titulo || 'Release PNAD Contínua', assunto: 'Release da PNAD Contínua (IBGE)', blocos: blocosPdf(txt, doc), imagens,
      rodape: `Fonte: IBGE, PNAD Contínua (SIDRA). Gerado em ${new Date().toLocaleDateString('pt-BR')} por ${AMBIENTE.produto || 'PNADC Resultados'}` }));
  }
  function baixarDocEditavel(F, doc, txt, base, formato) {
    return montarDocEditavel(F, doc, txt).then(o => baixarBlob(formato === 'odt' ? DOCSREL.odt(o) : DOCSREL.docx(o), base + (formato === 'odt' ? '.odt' : '.docx')));
  }
  function botoesExportar(F, doc, libera) {
    const txt = textoAtual(doc), plano = textoParaPlano(txt, doc), base = nomeBase(F);
    const b = (rot, fn, titulo) => U.el('button', { class: 'btn pequeno', disabled: !libera, title: libera ? (titulo || '') : 'Resolva os itens marcados com ✖ e marque as conferências manuais', onclick: () => { try { fn(); } catch (e) { console.error(e); AMBIENTE.toast('Não consegui exportar: ' + e.message, 'erro', 6000); } } }, rot);
    const botoes = [
      b('Copiar texto', () => copiar(plano)),
      b('Baixar .txt', () => baixarTexto(plano, base + '.txt')),
      b('Baixar .md', () => baixarTexto(doc.formato === 'md' ? txt : plano, base + '.md', 'text/markdown')),
      b('Baixar HTML', () => baixarTexto(htmlDocumento(F, doc, txt, imagensDe(doc)), base + '.html', 'text/html')),
      typeof DOCSREL !== 'undefined' ? b('Baixar Word (.docx)', () => baixarDocEditavel(F, doc, txt, base, 'docx'), 'Documento do Word editável: títulos, texto, tabelas e as imagens no fim') : null,
      typeof DOCSREL !== 'undefined' ? b('Baixar OpenDocument (.odt)', () => baixarDocEditavel(F, doc, txt, base, 'odt'), 'Documento do LibreOffice / OpenOffice editável') : null,
      typeof PDFREL !== 'undefined' ? b('Baixar PDF', () => baixarPdfRelease(F, doc, txt, base), 'PDF pronto, sem a janela de impressão: texto justificado e selecionável, tabelas e as imagens no fim') : null,
      b('CSV dos números', () => baixarTexto(csvNumeros(F), base + '_numeros.csv', 'text/csv')),
    ].filter(Boolean);
    for (const v of doc.visuais || []) {
      const rot = v.tipo === 'grade' ? 'mapa' : v.tipo;
      botoes.push(b(`PNG: ${rot}`, () => desenhar(v).toBlob(bl => baixarBlob(bl, `${base}_${v.id}.png`)), v.alt));
      botoes.push(b(`JPG: ${rot}`, () => desenhar(v).toBlob(bl => baixarBlob(bl, `${base}_${v.id}.jpg`), 'image/jpeg', 0.92), v.alt));
    }
    if (doc.telas) botoes.push(b(`PNG: ${doc.telas.length} telas do carrossel`, () => doc.telas.forEach((t, i) => setTimeout(() => desenharTela(t, i, doc.telas.length, ST.E.formatoImg, F.lide.ind).toBlob(bl => baixarBlob(bl, `${base}_tela${i + 1}.png`)), i * 400))));
    if (doc.visuais && doc.visuais.length || doc.telas) botoes.push(b('Textos alternativos (.txt)', () => baixarTexto((doc.visuais || []).map(v => `${v.titulo}\n${v.alt}`).concat((doc.telas || []).map((t, i) => `Tela ${i + 1}: ${t.alt}`)).join('\n\n'), base + '_texto_alternativo.txt')));
    return U.el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '10px 0 0' } }, ...botoes,
      libera ? null : U.el('div', { class: 'mini-info', style: { width: '100%', color: U.COR.ruim } }, 'A exportação libera quando nenhum item bloqueia (✖) e as conferências manuais estão marcadas.'));
  }

  // ------------------------------------------------------------------ rascunhos
  function rascunhosEl() {
    const lista = lerLS(K_RASC(), []);
    const nome = U.el('input', { placeholder: 'nome do rascunho', style: { padding: '4px 6px', border: '1px solid var(--borda)', borderRadius: '6px', minWidth: '200px' } });
    const salvar = U.el('button', { class: 'btn pequeno primario', onclick: () => {
      const l = lerLS(K_RASC(), []), agora = new Date().toISOString();
      const id = ST.rascunhoId && l.some(r => r.id === ST.rascunhoId) ? ST.rascunhoId : 'r' + Date.now().toString(36);
      const reg = { id, nome: (nome.value || '').trim() || (CACHE.doc && CACHE.doc.titulo) || 'Rascunho', alterado: agora, E: ST.E, texto: ST.texto, base: ST.base, marcados: ST.marcados, visuaisManuais: ST.visuaisManuais };
      const i = l.findIndex(r => r.id === id); if (i >= 0) { reg.criado = l[i].criado; l[i] = reg; } else { reg.criado = agora; l.unshift(reg); }
      if (!gravarLS(K_RASC(), l.slice(0, 30))) { AMBIENTE.toast('Não consegui guardar o rascunho neste navegador (armazenamento indisponível).', 'erro', 6000); return; }
      ST.rascunhoId = id; salvarAtual(); AMBIENTE.toast('Rascunho guardado neste navegador.', 'ok'); redesenharTudo();
    } }, ST.rascunhoId ? 'Salvar rascunho' : 'Salvar como rascunho');
    const novo = U.el('button', { class: 'btn pequeno', onclick: () => { if (!confirm('Começar um release novo? As escolhas atuais não salvas como rascunho serão perdidas.')) return; ST = null; try { localStorage.removeItem(K_ATUAL()); } catch (e) { /* ok */ } ir(1); setTimeout(() => AMBIENTE.renderizar(), 0); } }, 'Novo release');
    const det = U.el('details', { style: { marginLeft: '6px' } }, U.el('summary', { class: 'btn pequeno', style: { display: 'inline-flex' } }, `Rascunhos (${lista.length})`),
      U.el('div', { class: 'cartao', style: { position: 'absolute', zIndex: 50, minWidth: '320px', maxHeight: '320px', overflow: 'auto', marginTop: '4px' } },
        lista.length ? lista.map(r => U.el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--borda)' } },
          U.el('div', { style: { flex: 1 } }, U.el('b', {}, r.nome), U.el('div', { class: 'mini-info' }, `alterado em ${U.fmtDataHora(String(r.alterado).replace('T', ' '))}`)),
          U.el('button', { class: 'btn pequeno', onclick: () => { ST = { E: RM.normalizar(r.E), texto: r.texto === undefined ? null : r.texto, base: r.base === undefined ? null : r.base, marcados: r.marcados || {}, visuaisManuais: !!r.visuaisManuais, rascunhoId: r.id, dono: login() }; salvarAtual(); ir(10); AMBIENTE.renderizar(); } }, 'Abrir'),
          U.el('button', { class: 'btn pequeno perigo', onclick: () => { if (!confirm(`Excluir o rascunho "${r.nome}"?`)) return; gravarLS(K_RASC(), lerLS(K_RASC(), []).filter(x => x.id !== r.id)); if (ST.rascunhoId === r.id) ST.rascunhoId = null; redesenharTudo(); } }, 'Excluir')))
          : U.el('div', { class: 'mini-info' }, 'Nenhum rascunho guardado neste navegador.')));
    return U.el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', position: 'relative' } }, nome, salvar, det, novo);
  }

  // ------------------------------------------------------------------ página
  function render(cont, D, query) {
    if (!pode()) {
      cont.append(U.el('div', { class: 'aviso' }, AMBIENTE.motivoSemPermissao ? AMBIENTE.motivoSemPermissao() : 'Gerar releases não está disponível aqui.'));
      return;
    }
    estado(D);
    const raiz = U.el('div', { class: 'rel-raiz' });
    cont.append(raiz);
    const passo = Math.min(10, Math.max(1, +((query && query.get('passo')) || 1) || 1));
    redesenharTudo = () => {
      const { F, doc } = gerar(D);
      const stepper = U.el('div', { class: 'chips', style: { margin: '0 0 10px' } }, ...PASSOS.map(p => U.el('a', { class: 'chip' + (p.n === passo ? ' ativo' : ''), href: `#/publicacoes?sec=release&passo=${p.n}`, 'aria-current': p.n === passo ? 'step' : null }, `${p.n}. ${p.rot}`)));
      const P = PASSOS[passo - 1];
      const lado = U.el('div');
      const fns = { territorio: passoTerritorio, periodo: passoPeriodo, indicadores: passoIndicadores, publico: passoPublico, midia: passoMidia, estilo: passoEstilo, tamanho: passoTamanho, visuais: passoVisuais, extras: passoExtras };
      const corpoPasso = P.id === 'saida' ? passoSaida(D, F, doc, lado) : fns[P.id](D, F, doc);
      const nav = U.el('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '12px', gap: '6px' } },
        U.el('button', { class: 'btn', disabled: passo <= 1, onclick: () => ir(passo - 1) }, '◀ Voltar'),
        passo < 10 ? U.el('button', { class: 'btn primario', onclick: () => ir(passo + 1) }, `Avançar: ${PASSOS[passo].rot} ▶`) : U.el('span'));
      const esq = U.cartao(`Passo ${passo} de 10 — ${P.rot}`, [U.el('div', {}, ...corpoPasso.filter(Boolean)), nav]);
      redesenharPrevia = () => {
        const g = gerar(D);
        if (P.id === 'saida') { redesenharTudo(); return; }
        U.trocarFilhos(lado, previaEl(g.F, g.doc));
        U.trocarFilhos(resumoBox, resumoEl(g.F));
        const m = raiz.querySelector('.rel-metricas'); if (m) m.replaceWith(metricasEl(g.doc));
      };
      const resumoBox = U.el('div', {}, resumoEl(F));
      if (P.id !== 'saida') U.trocarFilhos(lado, previaEl(F, doc));
      const dir = U.cartao(P.id === 'saida' ? 'Prévia do texto final' : 'Prévia ao vivo', [resumoBox, lado]);
      U.trocarFilhos(raiz,
        U.el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '0 0 8px' } },
          U.el('div', { class: 'mini-info' }, 'Gerador de releases: texto determinístico a partir das estimativas publicadas pelo IBGE, seguindo regras de redação jornalística (número só da fonte, "estável" só quando o IBGE publica, causa só se atribuída). Nunca usa dado da coleta.'),
          rascunhosEl()),
        stepper,
        U.el('div', { class: 'grade rel-grade', style: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 6fr)', alignItems: 'start' } }, esq, dir));
      if (window.matchMedia && window.matchMedia('(max-width: 1000px)').matches) raiz.querySelector('.rel-grade').style.gridTemplateColumns = 'minmax(0, 1fr)';
    };
    try { redesenharTudo(); } catch (e) { console.error(e); raiz.append(U.el('div', { class: 'aviso erro' }, 'Não consegui montar o gerador de releases: ' + e.message)); }
  }
  return { render, pode, _mdHtml: mdHtml, _montarDoc: montarDocEditavel, _desenhar: { desenhar, desenharTela, layoutMapa, espalhar },
    // bancada (teste_releases.py): o estado e a geração com cache, sem tela
    _teste: { estado: D => estado(D), gerar: D => gerar(D), get ST() { return ST; } } };
})();
