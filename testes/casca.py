# -*- coding: utf-8 -*-
u"""Teste da casca: o arquivo único construído, aberto num navegador sem janela, com um IBGE SIMULADO.

O gancho de teste (rede simulada, relatório no fim) entra só na construção feita aqui (`antes_de_iniciar`);
o dist/PNADC_Resultados.html de produção não o leva. Nada fala com a rede.

Cobre: abertura sem erro de console, primeira passada das 16 tabelas, página Resultados (Brasil, Regiões, UF),
o assistente de releases, a página Sobre, troca de UF e o cache que sobrevive entre passadas.
"""
import json
import os
import sys

# O IBGE simulado: gera, para qualquer tabela do catálogo, as respostas de /periodos e de dados no formato real.
JS_REDE = r"""
(function () {
  const FAM = {}, ESPEC = {};
  INDICADORES_CATALOGO.tabelas().forEach(t => { FAM[t.tabela] = t.familia; ESPEC[t.tabela] = t.espec; });
  const BASE = { '4099': 6, '4097': 57, '4096': 62, '12466': 38.5, '4118': 16, '9869': 3, '5933': 3200, '4090': 100000 };
  const UFS_ = FONTE.ufs();
  const REG = { '1': 'Norte', '2': 'Nordeste', '3': 'Sudeste', '4': 'Sul', '5': 'Centro-Oeste' };
  function periodos(tab) {
    const out = [];
    if (FAM[tab] === 'trimestral') { for (let a = 2012; a <= 2026; a++) for (let q = 1; q <= 4; q++) if (a < 2026 || q <= 2) out.push(a + '0' + q); }
    else { for (let a = 2012; a <= 2026; a++) for (let m = 1; m <= 12; m++) if ((a > 2012 || m >= 3) && (a < 2026 || m <= 8)) out.push(a + (m < 10 ? '0' : '') + m); }
    return out;
  }
  function locais(niveis) {
    const L = [];
    niveis.forEach(n => {
      if (n === 'N1') L.push(['N1', 'Brasil', '1', 'Brasil']);
      if (n === 'N2') Object.keys(REG).forEach(r => L.push(['N2', 'Grande Região', r, REG[r]]));
      if (n === 'N3') UFS_.forEach(u => L.push(['N3', 'Unidade da Federação', u.codigo, u.nome]));
      if (n === 'N6') UFS_.forEach(u => L.push(['N6', 'Município', u.codigo + '00205', 'Capital ' + u.sigla + ' (' + u.sigla + ')']));
      if (n === 'N7') UFS_.slice(0, 20).forEach(u => L.push(['N7', 'Região Metropolitana', u.codigo + '01', 'RM ' + u.sigla]));
    });
    return L;
  }
  function dado(tab, pers, vars) {
    const e = ESPEC[tab], tipo = BASE[e.valor] > 1000 ? 'abs' : 'taxa', lag = FAM[tab] === 'trimestral' ? [1, 4] : [3, 12];
    const todos = periodos(tab), L = locais(e.niveis);
    const doBloco = todos.filter(p => pers.indexOf(p) >= 0);
    const serie = (loc, k) => todos.map((p, i) => {
      const fase = (parseInt(loc[2], 10) % 7) + k, mult = loc[0] === 'N1' ? 1 : 1 + (parseInt(loc[2], 10) % 9) / 40;
      return BASE[e.valor] * mult * (1 + 0.1 * Math.sin(i / 5 + fase) + 0.03 * Math.cos(i / 1.7));
    });
    const arred = (x, c) => Number(x.toFixed(c));
    const casas = tipo === 'abs' ? 0 : 1;
    return vars.map((vid, pos) => {
      const campo = ['valor', 'cv', 'var_curta', 'sit_curta', 'var_ano', 'sit_ano'][pos];
      const series = L.map(loc => {
        const v = serie(loc, pos).map(x => arred(x, casas));
        const serieObj = {};
        todos.forEach((p, i) => {
          if (doBloco.indexOf(p) < 0) return;
          let x;
          const d = (a) => (i - a < 0 ? null : (tipo === 'abs' ? arred((v[i] / v[i - a] - 1) * 100, 1) : arred(v[i] - v[i - a], 1)));
          if (campo === 'valor') x = String(v[i]);
          else if (campo === 'cv') x = String(arred(loc[0] === 'N1' ? 1.2 : loc[0] === 'N2' ? 3.1 : 9.5, 1));
          else if (campo === 'var_curta') { const y = d(lag[0]); x = y === null ? '...' : String(y); }
          else if (campo === 'var_ano') { const y = d(lag[1]); x = y === null ? '...' : String(y); }
          else {
            const y = d(campo === 'sit_curta' ? lag[0] : lag[1]);
            x = y === null ? '-' : (Math.abs(y) > (loc[0] === 'N1' ? 0.3 : 1.0) ? 'Z' : 'A');
          }
          serieObj[p] = x;
        });
        return { localidade: { id: loc[2], nivel: { id: loc[0], nome: loc[1] }, nome: loc[3] }, serie: serieObj };
      });
      return { id: vid, variavel: 'variável ' + vid, unidade: '%', resultados: [{ classificacoes: [], series }] };
    });
  }
  window.__IBGE_CHAMADAS = [];
  window.__IBGE_MODO = 'ok';
  FONTE.configurar({
    io: { buscar(u) {
      window.__IBGE_CHAMADAS.push(u);
      if (window.__IBGE_MODO === 'sem_rede') return Promise.reject(new Error('Failed to fetch'));
      const partes = u.slice(SIDRA.BASE_URL.length).split('?')[0].split('/');
      const tab = partes[1];
      let corpo;
      if (partes[2] === 'periodos' && partes.length === 3) {
        corpo = periodos(tab).map((p, i, a) => ({ id: p, literals: [p], modificacao: i === a.length - 1 ? '14/08/2026' : '14/05/2026' }));
      } else {
        const faixa = partes[3].split('-'), todos = periodos(tab);
        const ini = todos.indexOf(faixa[0]), fim = todos.indexOf(faixa[faixa.length - 1]);
        corpo = dado(tab, todos.slice(ini, fim + 1), decodeURIComponent(partes[5]).split('|'));
      }
      return Promise.resolve({ status: 200, corpo: JSON.stringify(corpo), interrompida: false, erro: '' });
    } },
    kv: ARMAZEM.kvMemoria()
  });
})();
"""

JS_ROTEIRO = r"""
(function () {
  const erros = [], R = { passos: {} };
  window.addEventListener('error', e => erros.push('erro: ' + e.message));
  window.addEventListener('unhandledrejection', e => erros.push('promessa: ' + (e.reason && e.reason.message || e.reason)));
  const ce = console.error; console.error = function () { erros.push('console.error: ' + Array.prototype.join.call(arguments, ' ')); ce.apply(console, arguments); };
  const txt = () => document.getElementById('conteudo').innerText;
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const prog = nome => { document.title += ' | ' + nome; console.log('PROG ' + nome); };
  const marca = (nome, extra) => { prog(nome); R.passos[nome] = Object.assign({ texto: txt().length, hash: location.hash }, extra || {}); };
  espera(1000).then(() => {
    R.menu_inicio_estendido = !document.body.classList.contains('menu-recolhido');
    marca('abertura', { tabelas: FONTE._armazem() ? 1 : 0 });
    return espera(14000);                                  // a passada das 16 tabelas + o redesenho de 5 em 5 s
  }).then(() => { prog('apos espera'); return FONTE._armazem().estado(); }).then(est => {
    const tabs = Object.keys(est).filter(k => k !== '*');
    R.tabelas_ok = tabs.filter(k => est[k].ok && est[k].n_valores > 0).length;
    R.tabelas_total = tabs.length;
    R.rede_ok = est['*'] && est['*'].ok;
    R.diag = { emCurso: SIDRA.emCurso(), atualizando: !!(PUBLICACOES.dados() && PUBLICACOES.dados().atualizando), temD: !!PUBLICACOES.dados(), hash: location.hash, agora: Date.now() };
    R.chamadas = window.__IBGE_CHAMADAS.length;
    R.resultados = txt();
    R.n_cartoes = document.querySelectorAll('#conteudo .mo-cartao').length;
    R.n_canvas = document.querySelectorAll('#conteudo canvas').length;
    R.n_erros_tela = document.querySelectorAll('#conteudo .aviso.erro').length;
    R.tem_uf_ro = /Rondônia/.test(txt());
    R.faixa = (document.getElementById('nav-status') || { innerText: '' }).innerText;
    R.menu_recolheu = document.body.classList.contains('menu-recolhido');
    R.menu = Array.from(document.querySelectorAll('#nav a[data-pagina]')).map(a => a.textContent.trim() + (a.classList.contains('ativo') ? '*' : ''));
    marca('resultados');
    // as outras seções
    const seccoes = {};
    // texto estranho na tela ("null", "undefined", "NaN", "[object ...]") em QUALQUER página visitada
    const suspeito = h => {
      const t = txt(), m = /(^|[\s(\[:,])(null|undefined|NaN)([\s)\],.:;]|$)|\[object [A-Za-z]+\]/.exec(t);
      const j = /\bCCS\b|comunicação da UE|\bSIGC\b|IBGE interno/.exec(t);
      if (j) (R.suspeitos = R.suspeitos || []).push(h + ' -> jargão: ' + j[0]);
      if (m) (R.suspeitos = R.suspeitos || []).push(h + ' -> ...' + t.slice(Math.max(0, m.index - 40), m.index + 50).replace(/\s+/g, ' ') + '...');
    };
    const ir = (h) => { prog(h); location.hash = h; return espera(600).then(() => { suspeito(h); }); };

    async function visual() {
      const V = {};
      R.visual = V;
      for (let p = 1; p <= 10; p++) await ir('#/publicacoes?sec=release&passo=' + p);
      for (const sec of ['brasil', 'regioes', 'uf', 'capitais', 'comparar']) await ir('#/publicacoes?sec=' + sec);
      // ---- a tela da UF: cabeçalho, seções, cartões, minigráficos
      await ir('#/publicacoes?sec=uf&ind=desocupacao'); await espera(300);
      V.hero = !!document.querySelector('.topo .cab-acoes button') && !document.querySelector('.mo-hero');
      V.subtitulo = (document.getElementById('cab-pagina') || { textContent: '' }).textContent;
      V.hero_botoes = Array.from(document.querySelectorAll('.cab-acoes button')).map(b => b.textContent.trim());
      V.secoes = Array.from(document.querySelectorAll('.mo-secao')).map(a => a.textContent.trim());
      V.kpis = document.querySelectorAll('#conteudo .kpi').length;
      V.sparks = document.querySelectorAll('#conteudo .mo-spark').length;
      V.cartoes = document.querySelectorAll('#conteudo .mo-cartao').length;
      V.btn_cheia = document.querySelectorAll('#conteudo .mo-btn[title^="Abrir em tela cheia"]').length;
      V.btn_jpg = document.querySelectorAll('#conteudo .mo-btn[title^="Baixar como imagem"]').length;
      // ---- alternar entre modos (nível x variação)
      const cart = Array.from(document.querySelectorAll('#conteudo .mo-cartao')).find(c => c.querySelector('canvas') && c.querySelector('.mo-seg'));
      const dados = c => JSON.stringify(Chart.getChart(c.querySelector('canvas')).data.datasets[0].data.slice(-4));
      const antes = dados(cart), bs = cart.querySelectorAll('.mo-seg button');
      bs[1].click(); await espera(200);
      const depois = dados(cart);
      bs[0].click(); await espera(200);
      V.modo = { diferente: antes !== depois, voltou: dados(cart) === antes, rotulos: Array.from(bs).map(b => b.textContent) };
      // ---- tela cheia e Esc
      cart.querySelector('.mo-btn[title^="Abrir em tela cheia"]').click(); await espera(400);
      const tela = document.querySelector('.mo-tela'), cvT = tela && tela.querySelector('canvas');
      V.cheia = { aberta: !!tela, canvas: !!cvT, altura: cvT ? Math.round(cvT.getBoundingClientRect().height) : 0, seg: tela ? tela.querySelectorAll('.mo-seg').length : 0 };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await espera(200);
      V.cheia.fechou = !document.querySelector('.mo-tela');
      // ---- JPG de um gráfico e de uma tabela
      const blobs = [], orig = URL.createObjectURL;
      URL.createObjectURL = b => { blobs.push(b); return orig.call(URL, b); };
      cart.querySelector('.mo-btn[title^="Baixar como imagem"]').click(); await espera(2500);
      const tab = Array.from(document.querySelectorAll('#conteudo .mo-cartao')).find(c => c.querySelector('table.tabela'));
      tab.querySelector('.mo-btn[title^="Baixar como imagem"]').click(); await espera(2500);
      URL.createObjectURL = orig;
      V.jpg = blobs.map(b => ({ tipo: b.type, bytes: b.size }));
      // ---- ranking: alternância quantidade/percentual só onde faz sentido
      await ir('#/publicacoes?sec=uf&ind=ocupados'); await espera(300);
      const rk = Array.from(document.querySelectorAll('#conteudo .mo-cartao')).find(c => /Ranking das UFs/.test(c.innerText) && c.querySelector('canvas'));
      V.ranking = { modos: rk ? Array.from(rk.querySelectorAll('.mo-seg button')).map(b => b.textContent) : [] };
      if (rk) { const g = () => JSON.stringify(Chart.getChart(rk.querySelector('canvas')).data.datasets[0].data.slice(0, 3)); const a0 = g(); rk.querySelectorAll('.mo-seg button')[1].click(); await espera(250); V.ranking.mudou = a0 !== g(); rk.querySelectorAll('.mo-seg button')[0].click(); await espera(150); }
      // ---- capital e região metropolitana
      await ir('#/publicacoes?sec=capitais'); await espera(300);
      V.capitais = { cartoes: document.querySelectorAll('#conteudo .mo-cartao').length, canvases: document.querySelectorAll('#conteudo canvas').length, kpis: document.querySelectorAll('#conteudo .kpi').length,
        tem: /capital/i.test(txt()), linhas: document.querySelectorAll('#conteudo table.tabela tbody tr').length };
      // ---- comparar dois períodos
      await ir('#/publicacoes?sec=comparar'); await espera(300);
      const sels = document.querySelectorAll('.mo-comp select');
      V.comparar = { selects: sels.length, linhas: document.querySelectorAll('#conteudo table.tabela tbody tr').length, canvases: document.querySelectorAll('#conteudo canvas').length };
      if (sels.length === 3) { sels[1].selectedIndex = 3; sels[1].dispatchEvent(new Event('change')); await espera(500); }
      V.comparar.hash = location.hash; V.comparar.apos = document.querySelectorAll('#conteudo table.tabela tbody tr').length;
      V.comparar.leitura = /sem teste publicado|situação publicada/.test(txt());
      const segC = document.querySelector('#conteudo .mo-seg');
      if (segC) { segC.querySelectorAll('button')[1].click(); await espera(250); V.comparar.abs = !!document.querySelector('#conteudo canvas'); }

      // ---- pré-visualização do release: tabela de verdade (não "| a | b |"), "Fonte" menor, sem jargão
      await ir('#/publicacoes?sec=release&passo=10'); await espera(300);
      const NL = String.fromCharCode(10);
      const md = RELEASES._mdHtml(['## Título', '| A | B |', '|---|---|', '| 1 | 2 |', '', 'Fonte: IBGE.'].join(NL));
      V.release_tabela = { tabelas: (md.match(/<table class="rel-tab">/g) || []).length, fonte_md: /<p class="fonte">Fonte: IBGE\.<\/p>/.test(md), cru: /\|\s*Indicador\s*\|/.test(txt()) || /\|---/.test(txt()),
        fonte: !!document.querySelector('#conteudo p.fonte'), revisao: /quem publica confirmou que tem a atribuição para divulgar/.test(txt()) };
      // ---- PDF com cabeçalho, rodapé, texto justificado e tabela
      const blocos = [{ t: 'h1', texto: 'Indicadores de Rondônia, 2º tri/2026' }, { t: 'p', texto: 'Texto justificado '.repeat(80) },
        { t: 'tabela', cab: ['Indicador', 'Rondônia', 'CV', 'Situação'], linhas: [['Taxa de desocupação', '2,6%', '10,5%', 'estável'], ['Taxa de informalidade', '42,0%', '3,0%', 'diminuiu'], ['Rendimento médio real habitual', 'R$ 3.799', '5,6%', 'estável']] },
        { t: 'fonte', texto: 'Fonte: IBGE, PNAD Contínua trimestral.' }];
      const pdf = PDFREL.criar({ titulo: 'Teste de PDF', rodape: 'Fonte: IBGE', paginas: [{ tipo: 'texto', blocos }] });
      const pt = new TextDecoder('latin1').decode(new Uint8Array(await pdf.arrayBuffer()));
      V.pdf_texto = { pagina: /P\u00e1gina 1 de 1/.test(pt), tw: /[1-9]\d*(\.\d+)? Tw/.test(pt), faixa: /PNADC Resultados/.test(pt), tabela_cab: /\(Indicador\)/.test(pt) && /\(R\$ 3\.799\)/.test(pt), logo: /\/Lg \d+ 0 R/.test(pt), sem_about: !/about:blank/.test(pt) };
      // ---- slider de período
      await ir('#/publicacoes?sec=uf&ind=desocupacao'); await espera(300);
      const cs = Array.from(document.querySelectorAll('#conteudo .mo-cartao')).find(c => c.querySelector('.mo-faixa'));
      const nPts = c => Chart.getChart(c.querySelector('canvas')).data.labels.length;
      const total = nPts(cs), ins = cs.querySelectorAll('.mo-faixa-trilho input');
      ins[0].value = 20; ins[0].dispatchEvent(new Event('input')); await espera(250);
      V.slider = { total, reduzido: nPts(cs), sub: cs.querySelector('.mo-tit small').textContent };
      cs.querySelector('.mo-faixa-topo button').click(); await espera(250);
      V.slider.volta = nPts(cs) === total;
      // ---- publicação passada: as séries são cortadas naquele trimestre
      const sp = document.getElementById('seletor-publicacao');
      const alvo = sp.options.length > 3 ? sp.options[3].value : '';
      sp.value = alvo; sp.dispatchEvent(new Event('change')); await espera(900);
      const cs2 = Array.from(document.querySelectorAll('#conteudo .mo-cartao')).find(c => c.querySelector('.mo-faixa'));
      const labs = Chart.getChart(cs2.querySelector('canvas')).data.labels;
      V.publicacao = { alvo, opcoes: sp.options.length, ultimo: labs[labs.length - 1], esperado: `${+alvo.slice(4)}T${alvo.slice(2, 4)}`, selo: Array.from(document.querySelectorAll('.mo-selo')).map(x => x.textContent).join('|') };
      sp.value = ''; sp.dispatchEvent(new Event('change')); await espera(900);
      // ---- UF "Nenhuma": Brasil + ranking sem destaque; capitais de todas; comparar; apresentação
      const su = document.getElementById('seletor-uf');
      su.value = ''; su.dispatchEvent(new Event('change')); await espera(3500);
      V.semUf = { aviso: /Escolha uma UF em "UF em destaque"/.test(txt()), sem_termo: !/Nenhuma/.test(txt() + document.querySelector('.topo .marca').innerText + ' ' + document.getElementById('cab-acoes').innerText), selo: Array.from(document.querySelectorAll('.mo-selo')).map(x => x.textContent).join('|'), cartoes: document.querySelectorAll('#conteudo .mo-cartao').length, canvas: document.querySelectorAll('#conteudo canvas').length };
      for (const sec of ['regioes', 'capitais', 'comparar', 'brasil']) { await ir('#/publicacoes?sec=' + sec); await espera(300); V.semUf[sec] = { cartoes: document.querySelectorAll('#conteudo .mo-cartao').length, erro: document.querySelectorAll('#conteudo .aviso.erro').length }; }
      V.semUf.slides = APRESENTACAO.slidesDe(PUBLICACOES.dados()).length;
      su.value = '11'; su.dispatchEvent(new Event('change')); await espera(3500);
      // ---- barra lateral: status embaixo, dica ao passar o mouse
      const lk = document.querySelector('#nav a[data-pagina="comparar"]');
      lk.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); await espera(100);
      const tip = document.getElementById('tip-nav');
      V.barra = { status: /Última conferência com o IBGE/.test((document.getElementById('nav-status') || { innerText: '' }).innerText), dica: !!tip && tip.style.display === 'block' && /Comparações/.test(tip.textContent), aria: lk.getAttribute('aria-label') };
      lk.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));

      // ---- alternativas de redação: toda combinação passa pela conferência (nenhum bloqueio), a escolha muda o texto e a padrão é a de sempre
      const RMo = RELEASE_MODELOS, Dd = PUBLICACOES.dados();
      V.alt = { territorios: {} };
      for (const terr of ['uf', 'regiao', 'brasil', 'capital']) {
        const E0 = RMo.normalizar(Object.assign(RMo.padrao('2026-12-31'), { territorio: terr, midia: 'site', tamanho: 'padrao' }));
        const F0 = RMo.montarFatos(Dd, E0);
        if (!F0.lide) { V.alt.territorios[terr] = { sem_lide: true }; continue; }
        const A = RMo.alternativas(F0);
        const rel = { n_titulo: A.titulo.length, n_fina: A.linhaFina.length, n_lide: A.lide.length, combos: 0, falhas: [], igual_padrao: false, mudou: false, vazios: 0 };
        const gera = alt => { const E = RMo.normalizar(Object.assign({}, E0, { extras: Object.assign({}, E0.extras, { alt }) })); const F = RMo.montarFatos(Dd, E); return { F, doc: RMo.redigir(F) }; };
        const padrao = gera({ titulo: '', linhaFina: '', lide: '' });
        rel.igual_padrao = padrao.doc.texto === gera({ titulo: A.titulo[0].id, linhaFina: A.linhaFina[0].id, lide: A.lide[0].id }).doc.texto;
        const marc = { numeros: true, revisao: true, aspasReais: true, alt: true };
        for (const a of A.titulo) for (const b of A.linhaFina) for (const c of A.lide) {
          const g = gera({ titulo: a.id, linhaFina: b.id, lide: c.id });
          rel.combos++;
          if (!g.doc.texto || /undefined|null|NaN/.test(g.doc.texto)) rel.vazios++;
          const ruins = RMo.conferir(g.doc.texto, g.F, g.doc, marc).filter(x => !x.ok && x.bloqueia).map(x => x.id + ':' + a.id + '/' + b.id + '/' + c.id);
          rel.falhas.push(...ruins);
          if (g.doc.texto !== padrao.doc.texto) rel.mudou = true;
        }
        rel.falhas = rel.falhas.slice(0, 6);
        V.alt.territorios[terr] = rel;
      }
      const lg = RMo.legibilidade('Esta frase é curta. Outra frase também é curta e fácil de ler. A terceira fecha o texto.', { midia: 'x' });
      V.alt.leitura = { flesch: lg.flesch, nivel: lg.nivel, frases: lg.frases };

      // ---- Word (.docx) e OpenDocument (.odt): ZIP íntegro (CRC), XML bem formado, conteúdo e imagens; os arquivos vão ao Python para validação externa
      {
        const E1 = RMo.normalizar(Object.assign(RMo.padrao('2026-12-31'), { territorio: 'uf', midia: 'site', tamanho: 'completo', visuais: { linha: true, barras: true, halteres: true, tabela: true, grade: false } }));
        const F1 = RMo.montarFatos(Dd, E1), d1 = RMo.redigir(F1);
        const o1 = await RELEASES._montarDoc(F1, d1, d1.texto);
        const b64 = async bl => { const u = new Uint8Array(await bl.arrayBuffer()); let s2 = ''; for (let i = 0; i < u.length; i += 8192) s2 += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s2); };
        const analisa = async (bl, partes) => {
          const u = new Uint8Array(await bl.arrayBuffer()), es = DOCSREL.ler(u), nomes = es.map(x => x.nome), xmls = {};
          let malFormado = [];
          for (const e of es) if (/\.(xml|rels)$/.test(e.nome)) { const doc2 = new DOMParser().parseFromString(new TextDecoder().decode(e.dados), 'application/xml'); if (doc2.getElementsByTagName('parsererror').length) malFormado.push(e.nome); xmls[e.nome] = new TextDecoder().decode(e.dados); }
          return { n: es.length, primeiro: nomes[0], crc_ok: es.every(x => x.crcOk), mal_formado: malFormado, tem: partes.every(p => nomes.indexOf(p) >= 0), xmls };
        };
        const wd = await analisa(DOCSREL.docx(o1), ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/footer1.xml']);
        const od = await analisa(DOCSREL.odt(o1), ['mimetype', 'content.xml', 'styles.xml', 'meta.xml', 'META-INF/manifest.xml']);
        const cnt = (str, re) => (str.match(re) || []).length;
        V.docs = { titulo: o1.titulo, n_imagens: o1.imagens.length, n_tabelas: o1.blocos.filter(b => b.t === 'tabela').length, n_titulos: o1.blocos.filter(b => /^h\d$/.test(b.t)).length,
          docx: { n: wd.n, crc_ok: wd.crc_ok, mal_formado: wd.mal_formado, tem: wd.tem, tbl: cnt(wd.xmls['word/document.xml'], /<w:tbl>/g), img: cnt(wd.xmls['word/document.xml'], /<wp:inline/g), h1: cnt(wd.xmls['word/document.xml'], /w:val="Ttulo1"/g), tem_titulo: wd.xmls['word/document.xml'].indexOf(DOCSREL._esc(o1.titulo)) >= 0 },
          odt: { n: od.n, primeiro: od.primeiro, crc_ok: od.crc_ok, mal_formado: od.mal_formado, tem: od.tem, tbl: cnt(od.xmls['content.xml'], /<table:table /g), img: cnt(od.xmls['content.xml'], /<draw:frame /g), h1: cnt(od.xmls['content.xml'], /text:outline-level="1"/g), tem_titulo: od.xmls['content.xml'].indexOf(DOCSREL._esc(o1.titulo)) >= 0 } };
        R.arquivos_docs = { docx: await b64(DOCSREL.docx(o1)), odt: await b64(DOCSREL.odt(o1)) };
        // texto perigoso vira TEXTO: "<b>" não pode virar marcação
        const ox = { titulo: 'T <b>x</b> & "y"', blocos: [{ t: 'h1', texto: 'A <i>b</i> & c' }, { t: 'p', texto: 'linha 1\nlinha 2 ]]> </w:t>' }, { t: 'tabela', cab: ['a', 'b'], linhas: [['<x>', '&']] }], imagens: [] };
        const ex = {}; for (const [k, bl] of [['docx', DOCSREL.docx(ox)], ['odt', DOCSREL.odt(ox)]]) { const a2 = await analisa(bl, []); ex[k] = { mal: a2.mal_formado, cru: /<b>x<\/b>|<i>b<\/i>/.test(Object.values(a2.xmls).join('')) }; }
        V.docs.escape = ex;
      }

      // ---- "Entenda a PNADC": figuras, conceitos, fontes oficiais com link e nada de texto estranho
      await ir('#/entenda'); await espera(400);
      { const c = document.getElementById('conteudo'), tx = c.innerText;
        V.entenda = { cartoes: c.querySelectorAll('.mo-cartao').length, figuras: c.querySelectorAll('.ent-fig, .ent-rot, .ent-tempo, .ent-fluxo').length,
          conceitos: ['força de trabalho', 'desalentadas', 'Desocupadas', 'Subocupadas por insuficiência de horas', 'Força de trabalho potencial', 'rotação 1-2(5)', 'Taxa composta de subutilização', 'Fontes e referências'].filter(x => tx.indexOf(x) >= 0).length,
          links: Array.from(c.querySelectorAll('.ent-fontes a')).map(a => a.getAttribute('href')), refs: c.querySelectorAll('.ent-ref').length,
          exemplo: /Com os números mais recentes do Brasil/.test(tx), sem_sorteio: !/sorte/i.test(tx), icones: new Set(Array.from(document.querySelectorAll('#nav a[data-pagina] .ico svg')).map(x => x.innerHTML)).size, menu: Array.from(document.querySelectorAll('#nav a[data-pagina]')).map(a => a.textContent.trim() + (a.classList.contains('ativo') ? '*' : '')) }; }

      // ---- Comparar: várias variáveis no mesmo gráfico (um eixo, dois eixos ou índice base 100, conforme as unidades)
      {
        const multi = async v => {
          await ir('#/publicacoes?sec=comparar&ter=br&v=' + v); await espera(500);
          const c = Array.from(document.querySelectorAll('#conteudo .mo-cartao')).find(x => x.querySelector('.mo-sup .chip'));
          const cv = c && c.querySelector('canvas'), ch = cv && Chart.getChart(cv);
          if (!ch) return { sem_grafico: true };
          const dados0 = ch.data.datasets.map(d => d.data.find(x => x !== null && x !== undefined));
          return { n: ch.data.datasets.length, eixos: Object.keys(ch.scales).filter(k => k !== 'x').sort().join(','), y1: ch.data.datasets.map(d => d.yAxisID || 'y').join(','),
            modo: (c.querySelector('.mo-seg button.on') || { textContent: '' }).textContent, primeiros: dados0.map(x => Math.round(x * 10) / 10), ativos: c.querySelectorAll('.mo-sup .chip.ativo').length,
            msg: /dois eixos não bastam/.test(c.innerText) };
        };
        V.multi = { taxas: await multi('desocupacao,informalidade'), duas: await multi('desocupacao,informalidade,rendimento'), tres: await multi('desocupacao,rendimento,ocupados') };
        // clicar numa variável muda o endereço (e o gráfico); a seleção fica no link
        const c2 = Array.from(document.querySelectorAll('#conteudo .mo-cartao')).find(x => x.querySelector('.mo-sup .chip'));
        const antes = location.hash; const alvo = Array.from(c2.querySelectorAll('.mo-sup .chip')).find(x => !x.classList.contains('ativo'));
        if (alvo) { alvo.click(); await espera(500); }
        V.multi.clique = { mudou: location.hash !== antes, tem: /v=[^&]*,/.test(location.hash) };
      }

      // ---- bandeiras: 28 miniaturas embutidas, reconhecidas por código, sigla ou nome, e usadas ao lado do nome (abas, seletor e tabela do ranking)
      await ir('#/publicacoes?sec=uf&ind=desocupacao'); await espera(500);
      { const c = document.getElementById('conteudo');
        V.bandeiras = { total: BANDEIRAS.FONTES.length, urls: new Set(BANDEIRAS.FONTES.map(f => BANDEIRAS.url(f.codigo))).size, por_nome: BANDEIRAS.codigo('Rondônia'), por_sigla: BANDEIRAS.codigo('RO'), por_rotulo: BANDEIRAS.codigo('Rondônia (RO)'),
          por_n3: BANDEIRAS.codigo('N3|11'), brasil: BANDEIRAS.codigo('Brasil'), desconhecido: BANDEIRAS.codigo('Região Norte') === '' && BANDEIRAS.img('Atlântida') === null,
          abas: c.querySelectorAll('.mo-secoes .mo-flag').length, cabecalho: !!document.getElementById('bandeira-uf'), tabela: c.querySelectorAll('table.tabela .mo-flag').length,
          sem_rede: Array.from(document.querySelectorAll('.mo-flag')).every(i => /^(blob:|data:image\/png;base64,)/.test(i.getAttribute('src'))) }; }
      // grades de cartões equilibradas: nenhuma linha com mais de um cartão a mais que outra
      for (const sec of ['brasil', 'uf', 'capitais']) { await ir('#/publicacoes?sec=' + sec); await espera(500);
        V.bandeiras['grade_' + sec] = Array.from(document.querySelectorAll('#conteudo .grade.g4')).map(g => { const linhas = {}; Array.from(g.children).forEach(k => { const t = Math.round(k.getBoundingClientRect().top); linhas[t] = (linhas[t] || 0) + 1; }); const q = Object.values(linhas); return { n: g.children.length, linhas: q.join('+'), ok: q.length > 0 && Math.max.apply(null, q) - Math.min.apply(null, q) <= 1 }; }); }
      // ---- NENHUM rótulo sobre outro nem fora da imagem: todos os mapas e gráficos de linha dos slides
      await ir('#/publicacoes?sec=uf'); await espera(300);
      const D = PUBLICACOES.dados(), sl = APRESENTACAO.slidesDe(D), sobrep = [];
      let vistos = 0;
      sl.forEach((s, i) => {
        const cv = APRESENTACAO.canvasDe(s);
        if (!cv._rotulos) return;
        vistos++;
        const r = cv._rotulos;
        r.forEach((a, x) => {
          if (a.x < 0 || a.y < 0 || a.x + a.w > cv.width || a.y + a.h > cv.height) sobrep.push(`${i}: rótulo ${x} fora da imagem`);
          for (let y = x + 1; y < r.length; y++) { const b = r[y]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) sobrep.push(`${i}: rótulos ${x} e ${y} se sobrepõem`); }
        });
      });
      V.slides = sl.length;
      V.rotulos = { imagens: vistos, sobreposicoes: sobrep };
      const ys = RELEASES._desenhar.espalhar([100, 101, 102, 103, 300, 301, 560], 24, 90, 580);
      V.espalhar = { ys, folga: Math.min.apply(null, ys.slice(1).map((y, i) => y - ys[i])) };
      // ---- apresentação (botão do cabeçalho), teclado e PDF
      const bApr = Array.from(document.querySelectorAll('.cab-acoes button')).find(b => /Apresentar/.test(b.textContent));
      if (bApr) { bApr.click(); await espera(800); }
      V.apresentacao = { aberta: !!document.querySelector('.ap-tela'), pontos: document.querySelectorAll('.ap-ponto').length };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await espera(200);
      V.apresentacao.cont = (document.querySelector('.ap-cont') || { textContent: '' }).textContent;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await espera(200);
      V.apresentacao.fechou = !document.querySelector('.ap-tela');
      const pdfs = [], o2 = URL.createObjectURL;
      URL.createObjectURL = b => { pdfs.push(b); return o2.call(URL, b); };
      APRESENTACAO.baixarPdf(D, null); await espera(5000); URL.createObjectURL = o2;
      const pb = pdfs.find(b => b.type === 'application/pdf');
      if (pb) { const t = new TextDecoder('latin1').decode(new Uint8Array(await pb.arrayBuffer())); V.pdf = { bytes: pb.size, cabeca: t.slice(0, 5), paginas: (t.match(/\/Type \/Page /g) || []).length, eof: /%%EOF\s*$/.test(t) }; }
      else V.pdf = null;
    }
    return ir('#/publicacoes?sec=brasil').then(() => { seccoes.brasil = txt().length; return ir('#/publicacoes?sec=regioes'); })
      .then(() => { seccoes.regioes = txt().length; seccoes.regioes_norte = /Norte/.test(txt()); return ir('#/publicacoes?sec=uf&ind=informalidade'); })
      .then(() => { seccoes.informalidade = /nformalidade/.test(txt()); R.seccoes = seccoes; return ir('#/publicacoes?sec=release&passo=1'); })
      .then(() => {
        R.release = { raiz: !!document.querySelector('.rel-raiz'), texto: txt().length, ativo: Array.from(document.querySelectorAll('#nav a.ativo')).map(a => a.dataset.pagina) };
        return ir('#/publicacoes?sec=release&passo=10');
      }).then(() => {
        R.release10 = { raiz: !!document.querySelector('.rel-raiz'), texto: txt().slice(0, 400), botoes: Array.from(document.querySelectorAll('#conteudo button')).map(b => b.textContent.trim()).filter(Boolean).slice(0, 30) };
        return visual().then(() => ir('#/sobre'));
      }).then(() => {
        R.sobre = txt();
        R.contato = !!document.querySelector('#conteudo a[href^="mailto:renatoprado.lima@gmail.com"]');
        R.contato_rodape = !!document.querySelector('#nav-rodape a[href^="mailto:renatoprado.lima@gmail.com"]');
        return ir('#/publicacoes?sec=uf');
      }).then(() => {
        // troca de UF: capitais da UF nova são baixadas na passada seguinte
        const sel = document.getElementById('seletor-uf');
        sel.value = '12'; sel.dispatchEvent(new Event('change'));
        return espera(14000);
      }).then(() => FONTE._armazem().lerSerie('6468')).then(s => {
        R.apos_trocar_uf = { uf: FONTE.uf().codigo, titulo: txt().slice(0, 200), tem_acre: /Acre/.test(txt()),
          capital_acre: s.linhas.some(l => l[1] === 'N6' && l[2] === '1200205'), capital_ro: s.linhas.some(l => l[1] === 'N6' && l[2] === '1100205'),
          chamadas: window.__IBGE_CHAMADAS.length };
        // sem rede: nada é apagado e a tela segue
        window.__IBGE_MODO = 'sem_rede';
        return FONTE._armazem().estado();
      }).then(() => { R.erros = erros; });
  }).catch(e => { R.FALHA_GERAL = String(e && e.stack || e); R.erros = erros; })
        .then(() => { const pre = document.createElement('pre'); pre.id = '__res'; pre.textContent = '<<<' + JSON.stringify(R) + '>>>'; document.body.append(pre); });
})();
"""


GANCHO = ('try {' + JS_REDE + '} catch (e) { document.title = "REDE: " + e.stack; }\n'
          'try {' + JS_ROTEIRO + '} catch (e) { document.title = "ROTEIRO: " + e.stack; }')


def validar_documentos(ctx, arq, rotulo):
    """Validação por fora do navegador: ZIP do Python, XML do Python, python-docx (se houver) e LibreOffice (se houver) convertendo para PDF."""
    import base64, glob, shutil, subprocess, tempfile, zipfile
    from xml.dom import minidom
    pasta = tempfile.mkdtemp(prefix='pnadc_docs_')
    try:
        caminhos = {}
        for k, b64 in arq.items():
            caminhos[k] = os.path.join(pasta, 'release.' + k)
            with open(caminhos[k], 'wb') as f:
                f.write(base64.b64decode(b64))
        ctx.confere(set(caminhos) == {'docx', 'odt'}, rotulo + ': arquivos .docx e .odt gerados')
        for k, c in caminhos.items():
            z = zipfile.ZipFile(c)
            ctx.confere(z.testzip() is None, rotulo + ': %s passa no teste do ZIP do Python' % k)
            ruins = []
            for n in z.namelist():
                if n.endswith('.xml') or n.endswith('.rels'):
                    try:
                        minidom.parseString(z.read(n))
                    except Exception as e:
                        ruins.append('%s: %s' % (n, e))
            ctx.confere(not ruins, rotulo + ': %s com XML bem formado para o Python (%s)' % (k, ruins[:2]))
        try:
            import docx as pydocx
        except ImportError:
            print(u'AVISO  SKIP python-docx não instalado: .docx não aberto por biblioteca externa')
        else:
            d = pydocx.Document(caminhos['docx'])
            ctx.confere(len(d.paragraphs) > 10 and len(d.tables) >= 1 and len(d.inline_shapes) >= 2 and any(p.style.name.startswith('heading') or p.style.name.startswith('Heading') for p in d.paragraphs),
                        rotulo + ': python-docx abre o .docx (parágrafos %d, tabelas %d, imagens %d)' % (len(d.paragraphs), len(d.tables), len(d.inline_shapes)))
        soffice = shutil.which('soffice') or next(iter(glob.glob(r'C:\Program Files\LibreOffice\program\soffice.exe')), None)
        if not soffice:
            print(u'AVISO  SKIP LibreOffice não encontrado: .docx/.odt não convertidos em PDF')
        else:
            for k, c in caminhos.items():
                saida = os.path.join(pasta, 'pdf_' + k)
                try:
                    subprocess.run([soffice, '--headless', '--norestore', '-env:UserInstallation=' + pathlib_uri(os.path.join(pasta, 'perfil_' + k)), '--convert-to', 'pdf', '--outdir', saida, c], capture_output=True, timeout=240)
                except Exception as e:
                    print(u'AVISO  LibreOffice falhou em %s: %s' % (k, e))
                pdf = os.path.join(saida, 'release.pdf')
                ok = os.path.exists(pdf) and os.path.getsize(pdf) > 5000
                paginas = open(pdf, 'rb').read().count(b'/Type /Page') - open(pdf, 'rb').read().count(b'/Type /Pages') if ok else 0
                ctx.confere(ok and paginas >= 2, rotulo + ': LibreOffice abre o .%s e converte em PDF (%s páginas)' % (k, paginas))
    finally:
        shutil.rmtree(pasta, ignore_errors=True)


def pathlib_uri(p):
    import pathlib
    return pathlib.Path(p).as_uri()


def teste_entregue(ctx):
    """Fase 4: o MESMO roteiro, sobre o arquivo que o SuperC entrega no botão (SuperC/app/PNADC_Resultados.html)."""
    import json as _json
    ori = _json.load(open(ctx.ORIGEM, encoding='utf-8'))
    arq = os.path.join(ctx.SUPERC, *ori['distribuicao']['arquivo_superc'].split('/'))
    if not os.path.exists(arq):
        print(u'AVISO  arquivo entregue ausente (%s): rode scripts/sincronizar.py --empurrar' % arq)
        return None
    sys.path.insert(0, ctx.AQUI + '/../scripts')
    import construir
    sys.path.pop(0)
    html = construir.injetar_antes_de_iniciar(open(arq, encoding='utf-8', newline='').read(), GANCHO)
    return teste_casca(ctx, html, 'entregue')


def teste_casca(ctx, html=None, rotulo='casca'):
    if html is None:
        sys.path.insert(0, ctx.AQUI + '/../scripts')
        import construir
        sys.path.pop(0)
        html = construir.construir(antes_de_iniciar=GANCHO)
    dom = ctx.rodar_no_edge(html, timeout=300, virtual_ms=400000)
    if dom is None:
        ctx.confere(False, rotulo + ': nenhum navegador')
        return
    import html as H
    i, j = dom.find('&lt;&lt;&lt;'), dom.rfind('&gt;&gt;&gt;')
    if i < 0 or j < i:
        ctx.confere(False, (rotulo + ': o roteiro não terminou (DOM de %d bytes)') % len(dom))
        return
    r = json.loads(H.unescape(dom[i + 12:j]))
    if 'FALHA_GERAL' in r:
        ctx.confere(False, rotulo + ': ' + r['FALHA_GERAL'])
    ctx.confere(not r.get('erros'), (rotulo + ': nenhum erro de console/exceção (%s)') % '; '.join(r.get('erros') or [])[:600])
    ctx.confere(r.get('tabelas_total') == 16 and r.get('tabelas_ok') == 16,
                (rotulo + ': as 16 tabelas baixadas pela passada (%s de %s)') % (r.get('tabelas_ok'), r.get('tabelas_total')))
    ctx.confere(r.get('rede_ok') is True, rotulo + ': passada completa marca a rede como ok')
    ctx.confere(r.get('tem_uf_ro') and r.get('n_cartoes', 0) >= 3, (rotulo + ': Resultados mostra a UF (Rondônia) e cartões (%s)') % r.get('n_cartoes'))
    ctx.confere(r.get('n_canvas', 0) >= 1, (rotulo + ': há gráfico (canvas) na página (%s)') % r.get('n_canvas'))
    ctx.confere(r.get('n_erros_tela') == 0, rotulo + ': nenhum aviso de erro na tela de Resultados')
    ctx.confere('Última conferência com o IBGE' in (r.get('faixa') or ''), (rotulo + ': faixa de estado diz quando conferiu (%r)') % (r.get('faixa'),))
    ctx.confere(r.get('menu') == ['Resultados*', 'Comparações', 'Gerar release', 'Entenda a PNADC', 'Sobre'], (rotulo + ': menu e item ativo (%r)') % (r.get('menu'),))
    s = r.get('seccoes') or {}
    ctx.confere(s.get('brasil', 0) > 500 and s.get('regioes', 0) > 500 and s.get('regioes_norte') and s.get('informalidade'),
                (rotulo + ': seções Brasil, Regiões e indicador escolhido desenham (%r)') % (s,))
    rel = r.get('release') or {}
    ctx.confere(rel.get('raiz') and rel.get('ativo') == ['release'], (rotulo + ': o assistente de releases abre e o menu marca "Gerar release" (%r)') % (rel,))
    rel10 = r.get('release10') or {}
    ctx.confere(rel10.get('raiz'), (rotulo + ': o passo 10 do assistente desenha (%r)') % (rel10,))
    ctx.confere('Versão do núcleo' in (r.get('sobre') or '') and 'Armazenamento' in (r.get('sobre') or ''), rotulo + ': página Sobre')

    v = r.get('visual') or {}
    ctx.confere(v.get('hero') and 'significância' not in (v.get('subtitulo') or '') and v.get('subtitulo') and 'PNAD' not in v.get('subtitulo'),
                (rotulo + ': cabeçalho único (barra verde) com o lugar onde você está, sem repetir o nome do programa (%r)') % (v.get('subtitulo'),))
    ctx.confere(all(x in (v.get('hero_botoes') or []) for x in ('Apresentar', 'PDF', 'Atualizar com o IBGE')) and (v.get('hero_botoes') or []).count('Gerar release') == 0,
                (rotulo + ': botões do cabeçalho, sem "Gerar release" repetido (%r)') % (v.get('hero_botoes'),))
    ctx.confere('Capital e RM' in (v.get('secoes') or []) and 'Comparações' not in (v.get('secoes') or []), (rotulo + ': seções novas (%r)') % (v.get('secoes'),))
    ctx.confere(v.get('kpis', 0) >= 8 and v.get('sparks', 0) >= 8, (rotulo + ': cartões-resumo com minigráfico (%s/%s)') % (v.get('kpis'), v.get('sparks')))
    ctx.confere(v.get('btn_cheia', 0) >= 3 and v.get('btn_jpg', 0) >= 3, (rotulo + ': todo gráfico e tabela tem tela cheia e JPG (%s/%s)') % (v.get('btn_cheia'), v.get('btn_jpg')))
    m = v.get('modo') or {}
    ctx.confere(m.get('diferente') and m.get('voltou') and len(m.get('rotulos') or []) == 2, (rotulo + ': alternar nível × variação muda os dados e volta (%r)') % (m,))
    c = v.get('cheia') or {}
    ctx.confere(c.get('aberta') and c.get('canvas') and c.get('altura', 0) > 300 and c.get('fechou'), (rotulo + ': tela cheia abre com o gráfico grande e Esc fecha (%r)') % (c,))
    j = v.get('jpg') or []
    ctx.confere(len(j) >= 2 and all(x['tipo'] == 'image/jpeg' and x['bytes'] > 5000 for x in j), (rotulo + ': JPG de gráfico e de tabela (%r)') % (j,))
    rk = v.get('ranking') or {}
    ctx.confere(len(rk.get('modos') or []) == 2 and rk.get('mudou'), (rotulo + ': ranking de contagem alterna quantidade × %% do Brasil (%r)') % (rk,))
    cp = v.get('capitais') or {}
    ctx.confere(cp.get('cartoes', 0) >= 3 and cp.get('canvases', 0) >= 1 and cp.get('tem') and cp.get('kpis', 0) >= 2 and cp.get('linhas', 0) >= 3, (rotulo + ': seção Capital e RM (%r)') % (cp,))
    cm = v.get('comparar') or {}
    ctx.confere(cm.get('selects') == 3 and cm.get('linhas') == 8 and cm.get('apos') == 8 and 'a=' in (cm.get('hash') or '') and cm.get('leitura') and cm.get('abs'),
                (rotulo + ': Comparações (controles, 8 indicadores, troca de período, modo p.p.) (%r)') % (cm,))
    ro = v.get('rotulos') or {}
    ctx.confere(ro.get('imagens', 0) >= 10 and not ro.get('sobreposicoes'), (rotulo + ': NENHUM rótulo sobre outro nem fora da imagem em %s mapas/gráficos (%s)') % (ro.get('imagens'), (ro.get('sobreposicoes') or [])[:5]))
    ctx.confere((v.get('espalhar') or {}).get('folga', 0) >= 24, (rotulo + ': espalhar mantém o espaço mínimo entre rótulos (%r)') % (v.get('espalhar'),))
    ap = v.get('apresentacao') or {}
    ctx.confere(ap.get('aberta') and ap.get('pontos', 0) >= 15 and (ap.get('cont') or '').startswith('2 /') and ap.get('fechou'), (rotulo + ': apresentação abre, navega e fecha (%r)') % (ap,))
    pf = v.get('pdf') or {}
    ctx.confere(pf.get('cabeca') == '%PDF-' and pf.get('eof') and pf.get('paginas') == v.get('slides') and pf.get('bytes', 0) > 50000, (rotulo + ': PDF do relatório, uma página por slide (%r, slides=%s)') % (pf, v.get('slides')))

    v2 = r.get('visual') or {}
    rt = v2.get('release_tabela') or {}
    ctx.confere(rt.get('tabelas', 0) == 1 and rt.get('fonte_md') and not rt.get('cru') and rt.get('revisao'), (rotulo + ': prévia do release com tabela de verdade, "Fonte" menor e sem jargão (%r)') % (rt,))
    pt = v2.get('pdf_texto') or {}
    ctx.confere(all(pt.get(k) for k in ('pagina', 'tw', 'faixa', 'tabela_cab', 'logo', 'sem_about')), (rotulo + ': PDF com cabeçalho, rodapé "Página n de N", texto justificado, tabela e logo (%r)') % (pt,))
    sl = v2.get('slider') or {}
    ctx.confere(sl.get('total', 0) > 20 and sl.get('reduzido', 0) < sl.get('total', 0) and sl.get('volta') and ' a ' in (sl.get('sub') or ''), (rotulo + ': slider de período reduz o gráfico e "Período inteiro" volta (%r)') % (sl,))
    pb = v2.get('publicacao') or {}
    ctx.confere(pb.get('opcoes', 0) >= 4 and pb.get('ultimo') == pb.get('esperado'), (rotulo + ': publicação passada corta as séries naquele trimestre (%r)') % (pb,))
    su2 = v2.get('semUf') or {}
    ctx.confere(su2.get('aviso') and su2.get('sem_termo') and 'UF em destaque' not in (su2.get('selo') or '') and su2.get('cartoes', 0) >= 3 and su2.get('canvas', 0) >= 1 and su2.get('slides', 0) >= 10
                and all((su2.get(k) or {}).get('cartoes', 0) >= 2 and (su2.get(k) or {}).get('erro') == 0 for k in ('regioes', 'capitais', 'comparar', 'brasil')),
                (rotulo + ': UF "Nenhuma" funciona em todas as seções e na apresentação (%r)') % (su2,))
    br = v2.get('barra') or {}
    ctx.confere(br.get('status') and br.get('dica') and br.get('aria'), (rotulo + ': barra lateral com status embaixo e dica ao passar o mouse (%r)') % (br,))
    ctx.confere(r.get('menu_inicio_estendido') and r.get('menu_recolheu'), rotulo + ': a barra lateral abre estendida e se recolhe sozinha depois de 10 s')

    al = (v2.get('alt') or {}).get('territorios') or {}
    for terr, rr in al.items():
        if rr.get('sem_lide'):
            continue
        ctx.confere(rr['n_titulo'] >= 2 and rr['n_lide'] >= 2 and rr['combos'] >= 4 and rr['igual_padrao'] and rr['mudou'] and not rr['falhas'] and not rr['vazios'],
                    (rotulo + ': alternativas de redação (%s) passam pela conferência, mudam o texto e a padrão é a de sempre (%r)') % (terr, rr))
    ctx.confere(len(al) == 4 and any(not r.get('sem_lide') for r in al.values()), rotulo + ': alternativas testadas nos quatro recortes (%r)' % (list(al),))
    lt = (v2.get('alt') or {}).get('leitura') or {}
    ctx.confere(lt.get('frases') == 3 and (lt.get('flesch') or 0) > 60, (rotulo + ': índice de leitura de um texto simples (%r)') % (lt,))

    dc = v2.get('docs') or {}
    for k in ('docx', 'odt'):
        x = dc.get(k) or {}
        ctx.confere(x.get('crc_ok') and not x.get('mal_formado') and x.get('tem') and x.get('n', 0) >= 5 and x.get('tbl', 0) >= dc.get('n_tabelas', 99) >= 1 and x.get('img') == dc.get('n_imagens') and dc.get('n_imagens', 0) >= 2
                    and x.get('h1', 0) >= 1 and x.get('tem_titulo'), (rotulo + ': %s íntegro (CRC), XML bem formado, título, tabelas e imagens (%r)') % (k, x))
    ctx.confere((dc.get('odt') or {}).get('primeiro') == 'mimetype', rotulo + ': .odt começa por "mimetype"')
    ctx.confere(all(not (dc.get('escape') or {}).get(k, {}).get('mal') and not (dc.get('escape') or {}).get(k, {}).get('cru') for k in ('docx', 'odt')) and len(dc.get('escape') or {}) == 2,
                (rotulo + ': texto com < > & vira texto, não marcação (%r)') % (dc.get('escape'),))
    validar_documentos(ctx, r.get('arquivos_docs') or {}, rotulo)

    en = v2.get('entenda') or {}
    ctx.confere(en.get('cartoes', 0) >= 9 and en.get('figuras', 0) >= 4 and en.get('conceitos') == 8 and en.get('refs', 0) >= 30 and en.get('exemplo') and en.get('sem_sorteio'),
                (rotulo + ': página "Entenda a PNADC" com cartões, figuras, conceitos e referências (%r)') % ({k: v for k, v in en.items() if k not in ('links', 'menu')},))
    ctx.confere(len(en.get('links') or []) >= 9 and all(l.startswith('https://') or l.startswith('http://www.ilo.org/') for l in en['links']) and all('ibge.gov.br' in l or 'ilo.org' in l for l in en['links']),
                (rotulo + ': fontes oficiais com link (IBGE e OIT) (%r)') % (en.get('links'),))
    ctx.confere(en.get('icones') == 5, (rotulo + ': cada item do menu tem um ícone diferente (%r distintos de 5)') % (en.get('icones'),))
    ctx.confere(en.get('menu') == ['Resultados', 'Comparações', 'Gerar release', 'Entenda a PNADC*', 'Sobre'], (rotulo + ': "Entenda a PNADC" fica acima de "Sobre" no menu (%r)') % (en.get('menu'),))

    mu = v2.get('multi') or {}
    tx, du, tr = mu.get('taxas') or {}, mu.get('duas') or {}, mu.get('tres') or {}
    ctx.confere(tx.get('n') == 2 and tx.get('eixos') == 'y' and tx.get('y1') == 'y,y', (rotulo + ': duas taxas no mesmo gráfico usam um eixo só (%r)') % (tx,))
    ctx.confere(du.get('n') == 3 and du.get('eixos') == 'y,y1' and du.get('y1') == 'y,y,y1', (rotulo + ': taxas + rendimento usam dois eixos, um por unidade (%r)') % (du,))
    ctx.confere(tr.get('n') == 3 and 'Índice' in (tr.get('modo') or '') and all(abs((x or 0) - 100) < 0.2 for x in tr.get('primeiros') or [0]) and len(tr.get('primeiros') or []) == 3,
                (rotulo + ': três unidades abrem em Índice (base 100) e todas as linhas começam em 100 (%r)') % (tr,))
    ctx.confere((mu.get('clique') or {}).get('mudou') and (mu.get('clique') or {}).get('tem'), (rotulo + ': clicar numa variável muda a seleção no endereço (%r)') % (mu.get('clique'),))
    bd = (v2.get('bandeiras') or {})
    ctx.confere(bd.get('total') == 28 and bd.get('urls') == 28 and bd.get('por_nome') == '11' and bd.get('por_sigla') == '11' and bd.get('por_rotulo') == '11' and bd.get('por_n3') == '11' and bd.get('brasil') == 'BR' and bd.get('desconhecido'),
                (rotulo + ': 28 bandeiras distintas, reconhecidas por código, sigla ou nome (%r)') % ({k: v for k, v in bd.items() if not k.startswith('grade_')},))
    ctx.confere(bd.get('abas', 0) >= 2 and bd.get('cabecalho') and bd.get('tabela', 0) >= 27 and bd.get('sem_rede'), (rotulo + ': bandeira nas abas Brasil e UF, ao lado do seletor e na tabela do ranking, todas embutidas (%r)') % ({k: bd.get(k) for k in ('abas', 'cabecalho', 'tabela', 'sem_rede')},))
    ctx.confere(all(g['ok'] for k in ('grade_brasil', 'grade_uf', 'grade_capitais') for g in bd.get(k, [])) and bd.get('grade_uf'), (rotulo + ': cartões-resumo equilibrados por linha (%r)') % ({k: v for k, v in bd.items() if k.startswith('grade_')},))
    ctx.confere(not r.get('suspeitos'), (rotulo + ': nenhuma tela mostra null/undefined/NaN/[object] (%s)') % (r.get('suspeitos') or [])[:4])
    ctx.confere(r.get('contato') and r.get('contato_rodape'), rotulo + ': e-mail de contato em Sobre e no rodapé do menu')
    t = r.get('apos_trocar_uf') or {}
    ctx.confere(t.get('uf') == '12' and t.get('tem_acre'), (rotulo + ': trocar a UF mostra a nova (%r)') % (t.get('titulo'),))
    ctx.confere(t.get('capital_acre') and not t.get('capital_ro'),
                (rotulo + ': trocar a UF baixa a capital nova e tira só as capitais da antiga (acre=%s, ro=%s)') % (t.get('capital_acre'), t.get('capital_ro')))
    return r
