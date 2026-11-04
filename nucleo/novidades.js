/* PNADC Resultados -- ALERTA de publicação nova do IBGE.
   Dono: PNADC_Resultados. Veio de SuperC/app/js/releases.js (bloco NOVIDADES, 26/10/2026), SEM a parte
   das "análises novas" da Leitura gerencial, que depende do SIGC e fica só no SuperC (lá, estende este
   objeto: ver `extras`).

   - Publicação nova: o cache ganhou um período mais recente -- trimestre civil ou trimestre móvel -- ou uma
     REVISÃO (mesmo período, data de modificação mais nova). O resumo pequeno vem de FONTE.novidades(), que
     SÓ lê o cache: nenhum alerta consulta o IBGE. Aparece no alto de Resultados e como selo discreto no
     menu (`#nav a[data-pagina="publicacoes"]`) e no cabeçalho (`#status-topo`), se o hospedeiro os tiver.
   - "Visto" por pessoa no navegador (localStorage com o login na chave, try/catch); some ao abrir Resultados.
   - Primeira vez (nada visto): grava a linha de base em silêncio e não alerta.
   - Texto de dado como nó de texto (U.el) ou escapado (U.esc). Sem `??` nem `?.`.

   Contrato com o hospedeiro: FONTE.novidades(), AMBIENTE.login(), AMBIENTE.podeGerar(). */
'use strict';

const NOVIDADES = (() => {
  const RM = RELEASE_MODELOS;
  const login = () => AMBIENTE.login() || 'visitante';
  const chave = tipo => `superc.novidades.${tipo}.${login()}`;
  function ler(tipo) { try { const v = JSON.parse(localStorage.getItem(chave(tipo)) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  function gravar(tipo, v) { try { localStorage.setItem(chave(tipo), JSON.stringify(v)); } catch (e) { /* sem armazenamento: o alerta volta a aparecer */ } }
  const ST = { res: null, carregando: null, buscadoEm: 0, visita: null };
  /* funções extras do hospedeiro, chamadas ao fim de `aplicarSelos` (o SuperC põe aqui o selo da Leitura) */
  const extras = [];
  /* caixas e preparos extras do bloco da tela inicial do hospedeiro: { caixa: () => Node|null, preparar: (preencher) => void } */
  const inicioExtras = [];

  // ------------------------------------------------------------------ publicação nova
  function carregar(forcar) {
    if (ST.carregando) return ST.carregando;
    if (!forcar && ST.res && Date.now() - ST.buscadoEm < 10 * 60 * 1000) return Promise.resolve(ST.res);
    // lê SÓ o cache; nunca agenda consulta ao IBGE
    ST.carregando = Promise.resolve().then(() => FONTE.novidades())
      .then(j => { if (j && j.ok) { ST.res = j; ST.buscadoEm = Date.now(); } return ST.res; })
      .catch(() => ST.res).then(r => { ST.carregando = null; return r; });
    return ST.carregando;
  }
  /* a página Resultados já tem o cache inteiro: o resumo sai dele, sem pedido */
  function atualizarDe(D) { if (D && D.indicadores) { ST.res = RM.resumoDeD(D); ST.buscadoEm = Date.now(); aplicarSelos(); } }
  /* Primeira vez (nada visto) ou tabela que o visto não tem: grava a LINHA DE
     BASE em silêncio e não alerta -- só há publicação "nova" contra algo já visto. */
  function diffPub() {
    if (!ST.res) return null;
    const visto = ler('pub'), d = RM.diffPublicacao(ST.res, visto);
    if (d && d.semBase && d.semBase.length) {
      const atual = RM.assinaturaDe(ST.res), tabs = Object.assign({}, (visto && visto.tabelas) || {});
      for (const t of d.semBase) if (atual[t]) tabs[t] = atual[t];
      gravar('pub', { tabelas: tabs, em: (visto && visto.em) || new Date().toISOString() });
    }
    return d;
  }
  function marcarPubVista() { if (ST.res) gravar('pub', { tabelas: RM.assinaturaDe(ST.res), em: new Date().toISOString() }); }

  const corSit = (ind, d) => (typeof PUBLICACOES !== 'undefined' && PUBLICACOES.situacao ? PUBLICACOES.situacao(ind, d, 'Z').cor : U.COR.estrutura);
  const fmtDelta = x => (x.tipo === 'taxa' ? `${x.va > 0 ? '+' : '−'}${U.fmtNum(Math.abs(x.va), 1)} p.p.` : `${x.va > 0 ? '+' : '−'}${U.fmtNum(Math.abs(x.va), 1)}%`);
  function linhaNovo(g, res) {
    const onde = g.fam === 'trimestral' ? ((res.uf && res.uf.nome) || 'na UF') : 'Brasil';
    const dest = g.destaques;
    return U.el('div', { style: { margin: '2px 0' } },
      U.el('b', {}, `Nova publicação do IBGE: ${g.fam === 'trimestral' ? g.rotulo : g.rotulo + ' (trimestre móvel, Brasil)'}`),
      g.divulgacao ? ` (divulgada em ${U.fmtData(g.divulgacao)})` : '', '. ',
      dest.length ? U.el('span', {}, `${onde}, com variação significativa: `,
        ...dest.map((x, i) => U.el('span', {}, i ? '; ' : '', `${x.curto} `, U.el('b', { style: { color: corSit(x, x.va) } }, fmtDelta(x)),
          x.comp === 'ano' ? ' em um ano' : (g.fam === 'trimestral' ? ' frente ao trimestre anterior' : ' frente a três meses antes'))), '.')
        : U.el('span', { class: 'mini-info' }, `${onde}: nenhum indicador com variação significativa no teste do IBGE.`));
  }
  const podeGerar = () => typeof RELEASES !== 'undefined' && RELEASES.pode();
  function caixaPublicacao(dp, res, comLinks) {
    if (!dp || !dp.algo) return null;
    const cx = U.el('div', { class: 'aviso', style: { borderLeftColor: U.COR.estrutura } });
    for (const g of dp.novos) cx.append(linhaNovo(g, res));
    if (dp.revisoes.length) {
      const pers = Array.from(new Set(dp.revisoes.map(r => r.periodo)));
      cx.append(U.el('div', { style: { margin: '2px 0' } }, U.el('b', {}, 'Revisão do IBGE: '),
        `${dp.revisoes.length} tabela(s) com o mesmo período (${pers.join(', ')}) e data de modificação mais nova (${U.fmtData(dp.revisoes.map(r => r.modificacao).sort().pop())}) — os números podem ter mudado.`));
    }
    if (comLinks) cx.append(U.el('div', { style: { marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      U.el('a', { href: '#/publicacoes?sec=uf' }, 'Ver em Resultados da PNADC →'),
      podeGerar() ? U.el('a', { href: '#/publicacoes?sec=release&passo=1' }, 'Gerar release →') : null));
    return cx;
  }
  /* Resultados: o que era novo NA CHEGADA fica à vista durante a visita; o
     "visto" é gravado logo (o alerta some do menu, do cabeçalho e do Início). */
  function blocoResultados(D) {
    atualizarDe(D);
    if (!ST.visita) ST.visita = diffPub();
    else { const d = diffPub(); if (d && d.algo) ST.visita = d; }
    marcarPubVista();
    aplicarSelos();
    return caixaPublicacao(ST.visita, ST.res, false) ? U.el('div', { style: { margin: '0 0 10px' } }, caixaPublicacao(ST.visita, ST.res, false),
      podeGerar() ? U.el('div', { class: 'mini-info', style: { marginTop: '4px' } }, U.el('a', { href: '#/publicacoes?sec=release&passo=1' }, 'Gerar um release com esta publicação →')) : null) : null;
  }
  const sairResultados = () => { ST.visita = null; };

  /* bloco para a tela inicial do hospedeiro, se ele tiver uma: preenche sozinho (a tela não espera) */
  function blocoInicio() {
    const caixa = U.el('div', { class: 'novidades-inicio' });
    const preencher = () => {
      if (!caixa.isConnected && caixa.parentNode === null && caixa.__usado) return;
      caixa.__usado = true;
      U.trocarFilhos(caixa, caixaPublicacao(diffPub(), ST.res || {}, true), ...inicioExtras.map(x => x.caixa()));
      caixa.hidden = !caixa.childNodes.length;
    };
    preencher();
    carregar().then(preencher);
    inicioExtras.forEach(x => { if (x.preparar) x.preparar(preencher); });
    return caixa;
  }
  /* Selo discreto no item de menu e uma linha no cabeçalho. */
  function aplicarSelos() {
    try {
      if (!ST.res && !ST.carregando) { carregar().then(r => { if (r) aplicarSelos(); }); }
      const dp = diffPub(), pub = !!(dp && dp.algo);
      const a = document.querySelector('#nav a[data-pagina="publicacoes"]');
      if (a) {
        const velho = a.querySelector('.selo-novidade'); if (velho) velho.remove();
        if (pub) a.append(U.el('span', { class: 'selo-novidade', title: 'Nova publicação do IBGE', 'aria-label': 'Nova publicação do IBGE',
          style: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: U.COR.estrutura, marginLeft: '6px', flex: '0 0 auto', boxShadow: '0 0 0 2px #fff' } }));
      }
      const st = document.getElementById('status-topo');
      if (st) {
        const v = st.querySelector('.novidade-topo'); if (v) v.remove();
        if (pub) {
          const g = dp.novos[0];
          st.append(U.el('span', { class: 'novidade-topo' }, ' · ', U.el('a', { href: '#/publicacoes?sec=uf', title: 'Abrir Resultados da PNADC' },
            g ? `nova publicação do IBGE (${g.fam === 'trimestral' ? g.curto : g.curto + ', móvel'})` : 'revisão do IBGE')));
        }
      }
      extras.forEach(fn => { try { fn(); } catch (e) { /* um extra nunca derruba o aviso */ } });
    } catch (e) { /* selo nunca derruba o cabeçalho */ }
  }
  /* o que uma extensão do hospedeiro precisa do núcleo: o "visto" por pessoa (mesmas chaves) e o estado */
  const ponte = { ler, gravar, login, estado: ST };
  return { carregar, atualizarDe, blocoResultados, sairResultados, blocoInicio, aplicarSelos, extras, inicioExtras, ponte, _estado: ST };
})();
