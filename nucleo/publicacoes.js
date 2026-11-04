/* SuperC -- PUBLICAÇÕES DA PNAD CONTÍNUA (26/10/2026).

   Pedido do usuário: mostrar os números que o IBGE DIVULGA da PNADc -- Brasil,
   Grandes Regiões e a UF da instalação --, com tabelas, gráficos e texto no
   estilo da Leitura gerencial; e deixar tudo pronto para quando os dados
   novos saírem (o servidor descobre sozinho o último período publicado).

   O insumo é `FONTE.carregar()` (nucleo/montar.js, ou /api/publicacoes no SuperC): o cache
   local das tabelas do SIDRA. A tela nunca fala com o IBGE; quem fala é a FONTE, por
   EVENTO (abrir esta página com o cache vencido, ou o botão "Atualizar com o
   IBGE"), no máximo uma vez a cada 12 h por tabela.
   Dono: PNADC_Resultados (veio de SuperC/app/js/publicacoes.js, 26/10/2026). Contrato com o
   hospedeiro: FONTE.carregar({forcar}), AMBIENTE.toast()/renderizar() e, opcional, AMBIENTE.acoesExtras() (botões ao lado
   de "Atualizar com o IBGE"); a rota é #/publicacoes.

   Regras desta página:
   - A COR de uma variação vem da SITUAÇÃO que o IBGE publica (teste de
     significância): estável = cinza; significativa = verde quando vai no
     sentido desejável do indicador, vermelho quando vai contra, azul quando o
     indicador não tem sentido desejável (participação). Nenhum corte próprio.
   - O CV é sempre mostrado, com a classe de PRECISÃO da escala do IBGE (até
     5% ótima, 5-15% boa, 15-30% razoável, 30-50% pouco precisa, acima de 50%
     imprecisa). O aviso aparece de "razoável" para baixo -- é a escala do
     IBGE, nenhum corte desta página. Não confundir com as letras da situação.
   - Situação publicada: Z = significativa (o sentido é o sinal), A = estável,
     '-' = sem comparação. "Aumentou"/"recuou" só com Z; com A, "ficou estável".
     Nível de confiança da PNADC: 95%.
   - Comparar ÁREAS (UF × Brasil, UF × UF) não tem teste publicado: a página
     usa o intervalo aproximado estimativa ± 1,96 × CV e diz que é aproximação.
   - Texto montado como nó de texto (U.el) -- nome de lugar vindo da API nunca
     vira HTML; nas células `html` tudo passa por U.esc.
   - Sem `??` nem `?.`: a conferência de sintaxe do projeto (esprima) não os lê. */
'use strict';

const PUBLICACOES = (() => {
  let D = null, carregando = null, erro = null, espera = null, velho = true;
  /* Escala de precisão do IBGE pelo CV (o servidor manda a mesma, em
     `precisao_cv`; esta é a reserva para cache antigo). */
  const ESCALA_CV = [{ ate: 5, classe: 'ótima' }, { ate: 15, classe: 'boa' }, { ate: 30, classe: 'razoável' },
    { ate: 50, classe: 'pouco precisa' }, { ate: null, classe: 'imprecisa' }];
  function precisao(cv) {
    if (vazio(cv)) return null;
    const esc = (D && D.precisao_cv) || ESCALA_CV;
    const k = esc.findIndex(e => e.ate === null || e.ate === undefined || cv <= e.ate);
    const i = k < 0 ? esc.length - 1 : k;
    return { classe: esc[i].classe, aviso: i >= 2, cor: i >= 3 ? U.COR.ruim : i === 2 ? U.COR.atencaoForte : null };
  }
  const Z95 = 1.96;
  const SECOES = [
    { id: 'brasil', rot: 'Brasil', ico: 'mapa' },
    { id: 'regioes', rot: 'Grandes Regiões', ico: 'rank' },
    { id: 'uf', rot: 'UF', ico: 'pin' },
    { id: 'capitais', rot: 'Capital e RM', ico: 'capital' },
    { id: 'comparar', rot: 'Comparar períodos', ico: 'comparar' },
  ];
  /* O que uma variação SIGNIFICATIVA quer dizer, por indicador (só é dito
     quando o IBGE publica a variação como significativa). */
  const IMPLICA = {
    desocupacao: { sobe: 'mais pessoas procurando trabalho sem encontrar', desce: 'menos pessoas procurando trabalho sem encontrar' },
    ocupacao: { sobe: 'uma parcela maior da população em idade de trabalhar está ocupada', desce: 'uma parcela menor da população em idade de trabalhar está ocupada' },
    participacao: { sobe: 'mais gente na força de trabalho (trabalhando ou procurando)', desce: 'menos gente na força de trabalho (trabalhando ou procurando)' },
    informalidade: { sobe: 'uma parcela maior dos ocupados sem vínculo formal', desce: 'uma parcela menor dos ocupados sem vínculo formal' },
    subutilizacao: { sobe: 'mais força de trabalho sem uso pleno (desocupada, subocupada ou potencial)', desce: 'menos força de trabalho sem uso pleno' },
    desalento: { sobe: 'mais gente que desistiu de procurar trabalho', desce: 'menos gente que desistiu de procurar trabalho' },
    rendimento: { sobe: 'ganho real do rendimento habitual (já descontada a inflação)', desce: 'perda real do rendimento habitual (já descontada a inflação)' },
    ocupados: { sobe: 'mais pessoas trabalhando', desce: 'menos pessoas trabalhando' },
  };

  /* Nome com artigo, para a frase ("a desocupação", "o rendimento médio real"). */
  const COM_ARTIGO = { desocupacao: 'a desocupação', ocupacao: 'o nível da ocupação', participacao: 'a participação na força de trabalho',
    informalidade: 'a informalidade', subutilizacao: 'a subutilização', desalento: 'o desalento',
    rendimento: 'o rendimento médio real', ocupados: 'o número de pessoas ocupadas' };
  const comArtigo = ind => COM_ARTIGO[ind.id] || ('o indicador ' + ind.curto);

  // ------------------------------------------------------------------ dados
  const naPagina = () => (location.hash || '').startsWith('#/publicacoes');
  function carregar(metodo) {
    if (carregando) return carregando;
    const post = metodo === 'POST';
    // FONTE (do hospedeiro) devolve o mesmo JSON de sempre; `forcar` = o botão "Atualizar com o IBGE"
    carregando = Promise.resolve().then(() => FONTE.carregar({ forcar: post }))
      .then(j => { D = j; erro = null; velho = false; })
      .catch(e => { erro = e.message; })
      .then(() => { carregando = null; acompanhar(); });
    return carregando;
  }
  /* Enquanto o SERVIDOR consulta o IBGE, a tela pergunta ao servidor LOCAL a
     cada 5 s (nunca ao IBGE) e para assim que ele termina. */
  function acompanhar() {
    clearTimeout(espera);
    // no gerador de releases o redesenho apagaria o que está sendo digitado: lá o cache é
    // renovado em silêncio e entra no próximo passo
    const naRelease = () => /[?&]sec=release/.test(location.hash || '');
    if (D && D.atualizando) espera = setTimeout(() => {
      if (!naPagina()) return;
      carregar().then(() => {
        if (!naPagina()) return;
        if (!naRelease()) { AMBIENTE.renderizar(); return; }
        // no gerador só a LINHA DE ESTADO é refeita (o assistente fica como está); sem isto ela ficava
        // em "consultando o IBGE" para sempre depois da primeira consulta (achado no teste, 26/10/2026)
        const velha = AMBIENTE.mostrarStatus ? document.getElementById('conteudo') : document.querySelector('#conteudo .mini-info');
        if (velha && D && !D.atualizando) {
          if (AMBIENTE.mostrarStatus) AMBIENTE.mostrarStatus(faixaEstado()); else velha.replaceWith(faixaEstado());
          AMBIENTE.toast('Dados do IBGE atualizados. O gerador usa o que acabou de chegar a partir do próximo passo.', 'ok', 6000);
        }
      });
    }, 5000);
  }
  const indDe = id => D.indicadores.find(i => i.id === id) || D.indicadores[0];
  /* PUBLICAÇÃO EM ANÁLISE: por padrão a última; `D.referencia` (AAAAQQ, do seletor do cabeçalho) leva a página a um
     trimestre passado. As séries são cortadas nesse ponto (para o trimestre móvel, o móvel que termina no mês final do
     trimestre), então todo cartão, tabela e texto fala "daquela publicação", sem mexer no resto do código. */
  const _cortes = new WeakMap();
  function alvoRef(fam) {
    const r = D && D.referencia;
    if (!r) return null;
    return fam === 'trimestral' ? r : `${r.slice(0, 4)}${String(+r.slice(4) * 3).padStart(2, '0')}`;
  }
  function cortarRef(s, fam) {
    const alvo = alvoRef(fam);
    if (!s || !alvo || !s.per.length || s.per[s.per.length - 1] <= alvo) return s;
    const m = _cortes.get(s);
    if (m && m.alvo === alvo) return m.s;
    let n = s.per.length;
    while (n > 0 && s.per[n - 1] > alvo) n--;
    const c = {};
    Object.keys(s).forEach(k => { c[k] = Array.isArray(s[k]) ? s[k].slice(0, n) : s[k]; });
    c.esp = (s.esp || []).filter(e => e[1] < n);
    _cortes.set(s, { alvo, s: c });
    return c;
  }
  function serie(ind, fam, nivel, loc) {
    const f = D.series[ind.id] && D.series[ind.id][fam];
    return cortarRef((f && f[nivel + '|' + loc]) || null, fam);
  }
  function ultimoIdx(s) { if (!s) return -1; for (let i = s.per.length - 1; i >= 0; i--) if (s.v[i] !== null && s.v[i] !== undefined) return i; return -1; }
  const idxDe = (s, p) => (s ? s.per.indexOf(p) : -1);
  function ponto(s, i) {
    if (!s || i < 0) return null;
    return { per: s.per[i], v: s.v[i], cv: s.cv[i], vc: s.vc[i], sc: s.sc[i], va: s.va[i], sa: s.sa[i] };
  }
  const nomeLocal = (nivel, loc) => D.locais[nivel + '|' + loc] || (nivel === 'N1' ? 'Brasil' : loc);
  const consulta = tab => (D.consultas || {})[tab] || null;

  // ------------------------------------------------------------------ formatação
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function rotPer(p, fam, curto) {
    p = String(p || ''); if (!/^\d{6}$/.test(p)) return p;
    const ano = +p.slice(0, 4), n = +p.slice(4);
    if (fam === 'trimestral') return curto ? `${n}T${String(ano).slice(2)}` : `${n}º tri ${ano}`;
    if (curto) return `${MESES[n - 1]}/${String(ano).slice(2)}`;
    return [0, 1, 2].map(k => MESES[(n - 3 + k + 12) % 12]).join('-') + ' ' + ano;
  }
  const rotPerLongo = (p, fam) => (fam === 'trimestral' ? 'o ' + rotPer(p, fam) : 'o trimestre móvel ' + rotPer(p, fam));
  function perAnterior(p, fam) {
    p = String(p); const ano = +p.slice(0, 4), n = +p.slice(4);
    if (fam === 'trimestral') return n > 1 ? `${ano}${String(n - 1).padStart(2, '0')}` : `${ano - 1}04`;
    const m = n - 3; return m >= 1 ? `${ano}${String(m).padStart(2, '0')}` : `${ano - 1}${String(m + 12).padStart(2, '0')}`;
  }
  const perAno = p => `${+String(p).slice(0, 4) - 1}${String(p).slice(4)}`;
  const vazio = v => v === null || v === undefined || Number.isNaN(v);
  function fmtV(ind, v) {
    if (vazio(v)) return '–';
    if (ind.tipo === 'rendimento') return 'R$ ' + U.fmtInt(v);
    if (ind.tipo === 'contagem') return U.fmtInt(v) + ' mil';
    return U.fmtNum(v, ind.casas) + '%';
  }
  const unidVar = ind => (ind.unidade_var === 'p.p.' ? ' p.p.' : '%');
  const fmtAbs = (ind, d) => U.fmtNum(Math.abs(d), 1) + unidVar(ind);
  function fmtD(ind, d) { if (vazio(d)) return '–'; return (d > 0 ? '+' : d < 0 ? '−' : '') + fmtAbs(ind, d); }
  const fmtCv = cv => (vazio(cv) ? '–' : `${U.fmtNum(cv, 1)}% (${precisao(cv).classe})`);
  const cvTexto = cv => (vazio(cv) ? 'CV não publicado' : `CV ${U.fmtNum(cv, 1)}%, precisão ${precisao(cv).classe}`);
  function celCv(cv) {
    const p = precisao(cv); if (!p) return '–';
    return p.aviso ? `<span style="color:${p.cor};font-weight:700" title="precisão ${U.esc(p.classe)} na escala do IBGE">${U.esc(fmtCv(cv))} ⚠</span>` : U.esc(fmtCv(cv));
  }

  /* SITUAÇÃO publicada -> estado, cor e juízo. */
  function situacao(ind, d, cod) {
    if (cod === null || cod === undefined) return { estado: 'sem', cor: COR_NEUTRA, rot: 'sem comparação' };
    if (cod === 'A') return { estado: 'estavel', cor: U.COR.neutro3, rot: 'estável' };
    if (cod === 'Z') {
      if (vazio(d) || d === 0) return { estado: 'sig0', cor: U.COR.estrutura, rot: 'significativa (menor que o arredondamento)' };
      const sobe = d > 0, juizo = ind.sentido * (sobe ? 1 : -1);
      return { estado: sobe ? 'alta' : 'queda', sobe, juizo, rot: sobe ? 'aumentou (significativa)' : 'recuou (significativa)',
        cor: juizo > 0 ? U.COR.bom : juizo < 0 ? U.COR.ruim : U.COR.estrutura };
    }
    return { estado: 'desconhecida', cor: COR_NEUTRA, rot: `código "${cod}" não reconhecido` };
  }
  const COR_NEUTRA = '#78909c';
  function celVar(ind, d, cod) {
    const s = situacao(ind, d, cod);
    return `<span style="color:${s.cor};font-weight:700">${U.esc(fmtD(ind, d))}</span> <span class="mini-info">${U.esc(s.rot)}</span>`;
  }
  const csvVar = (ind, d, cod) => `${fmtD(ind, d)} (${situacao(ind, d, cod).rot})`;

  /* Frase da variação, com o hedging pela SITUAÇÃO publicada. `contra` é o
     período de comparação SEM artigo; o artigo (masculino: trimestre) vira
     contração -- "abaixo do 2º tri 2025", "igual ao trimestre móvel ...". */
  function fraseVar(ind, d, cod, contra) {
    const s = situacao(ind, d, cod);
    if (vazio(d) && s.estado !== 'estavel') return `sem comparação publicada com o ${contra}`;
    if (s.estado === 'alta' || s.estado === 'queda') return `${s.sobe ? 'aumentou' : 'recuou'} ${fmtAbs(ind, d)} em relação ao ${contra} (variação estatisticamente significativa, segundo o IBGE)`;
    if (s.estado === 'estavel') return `ficou estável em relação ao ${contra}` + (vazio(d) ? '' : ` (diferença de ${fmtD(ind, d)}, não significativa no teste do IBGE)`);
    if (s.estado === 'sig0') return `variou menos que o arredondamento em relação ao ${contra}, mas a variação é significativa no teste do IBGE`;
    if (s.estado === 'desconhecida') return `teve diferença de ${fmtD(ind, d)} em relação ao ${contra} (situação publicada com código não reconhecido: ${cod})`;
    return `teve diferença de ${fmtD(ind, d)} em relação ao ${contra} (sem comparação testada publicada)`;
  }
  /* Diferença de NÍVEL (não variação publicada): taxa em p.p. */
  function fmtDifNivel(ind, x) {
    if (vazio(x)) return '–';
    if (ind.tipo === 'rendimento') return 'R$ ' + U.fmtInt(Math.abs(x));
    if (ind.tipo === 'contagem') return U.fmtInt(Math.abs(x)) + ' mil';
    return U.fmtNum(Math.abs(x), ind.casas) + ' p.p.';
  }
  function implicacao(ind, d, cod) {
    const s = situacao(ind, d, cod), I = IMPLICA[ind.id];
    if (!I || (s.estado !== 'alta' && s.estado !== 'queda')) return null;
    return `${s.sobe ? I.sobe : I.desce}${s.juizo > 0 ? ' — movimento favorável' : s.juizo < 0 ? ' — movimento desfavorável' : ''}`;
  }
  /* Quando NÃO há implicação a dizer (nenhuma variação significativa com
     sentido), o que se afirma depende da SITUAÇÃO publicada, nunca da sua
     ausência (revisão de 26/10/2026, achado 3): "não é significativa" só com
     'A'; sem comparação ('-') ou código desconhecido, "sem indicação de
     significância do IBGE"; 'Z' com variação 0,0, significativa mas menor que
     o arredondamento. */
  function descSituacao(ind, d, cod) {
    const e = situacao(ind, d, cod).estado;
    if (e === 'estavel') return 'a variação não é significativa';
    if (e === 'sig0') return 'a variação é significativa no teste do IBGE, mas menor que o arredondamento';
    if (e === 'alta' || e === 'queda') return 'a variação é significativa';
    return 'sem indicação de significância do IBGE';
  }
  function fraseSemImplicacao(ind, p, nome) {
    const eC = situacao(ind, p.vc, p.sc).estado, eA = situacao(ind, p.va, p.sa).estado;
    if (eC === 'estavel' && eA === 'estavel')
      return `Nenhuma das duas variações de ${nome} é significativa no teste do IBGE: não se pode afirmar que o indicador mudou de patamar.`;
    return `Em ${nome}, frente ao trimestre anterior, ${descSituacao(ind, p.vc, p.sc)}; em um ano, ${descSituacao(ind, p.va, p.sa)}. Sem variação significativa com sentido, não se pode afirmar que o indicador mudou de patamar.`;
  }
  /* Intervalo APROXIMADO de 95%: estimativa ± 1,96 × CV × estimativa. */
  function ic(v, cv) { if (vazio(v) || vazio(cv)) return null; const m = Z95 * cv / 100 * Math.abs(v); return [v - m, v + m]; }
  function compararAreas(a, b) {
    const ia = ic(a.v, a.cv), ib = ic(b.v, b.cv);
    if (!ia || !ib) return 'sem CV para comparar';
    return (ia[1] < ib[0] || ib[1] < ia[0]) ? 'diferença provável (os intervalos aproximados de 95% não se sobrepõem)'
      : 'não dá para afirmar diferença (os intervalos aproximados de 95% se sobrepõem)';
  }
  const ordinal = n => `${n}ª`;
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // ------------------------------------------------------------------ procedência
  function fonte(ind, fam) {
    const t = ind[fam].tabela, c = consulta(t);
    const s = serie(ind, fam, 'N1', '1'), i = ultimoIdx(s);
    const caixa = U.el('div', { class: 'fonte-dado' }, U.el('span', { class: 'rot' }, 'Fonte: '),
      'IBGE, PNAD Contínua — ',
      U.el('a', { href: `https://sidra.ibge.gov.br/tabela/${t}`, target: '_blank', rel: 'noopener' }, `SIDRA tabela ${t}`),
      U.el('span', { class: 'mini-info' }, ` (variáveis ${ind[fam].variaveis.valor} valor, ${ind[fam].variaveis.cv} CV, ${ind[fam].variaveis.var_curta}/${ind[fam].variaveis.sit_curta} e ${ind[fam].variaveis.var_ano}/${ind[fam].variaveis.sit_ano} variações e situação)`),
      i >= 0 ? ` · até ${rotPer(s.per[i], fam)}` : '',
      c && c.baixado_em ? ` · baixado em ${U.fmtDataHora(c.baixado_em)}` : '',
      c && c.ultimo_ok ? ` · conferido com o IBGE em ${U.fmtDataHora(c.ultimo_ok)}` : '');
    if (!c) caixa.append(U.el('span', { class: 'ausente' }, ' · ainda não consultada'));
    else if (!c.ok) caixa.append(U.el('span', { class: 'ausente' }, ` · a última consulta (${U.fmtDataHora(c.quando)}) falhou: ${c.erro || 'erro'}`));
    return caixa;
  }
  /* Aviso no cartão quando a tabela não chegou ou a última consulta falhou. */
  function avisoTabela(ind, fam) {
    const t = ind[fam].tabela, c = consulta(t), s = serie(ind, fam, 'N1', '1');
    if (!s) return U.el('div', { class: 'aviso' + (c && !c.ok ? ' erro' : '') },
      c && !c.ok ? `A tabela ${t} ainda não está no banco: a consulta de ${U.fmtDataHora(c.quando)} falhou (${c.erro || 'erro'}).`
        : D.atualizando ? `A tabela ${t} está sendo baixada do IBGE…` : `A tabela ${t} ainda não foi consultada.`);
    if (c && !c.ok) return U.el('div', { class: 'aviso erro' }, `A última consulta da tabela ${t} (${U.fmtDataHora(c.quando)}) falhou: ${c.erro || 'erro'}. `,
      `Mostrando o que foi baixado em ${U.fmtDataHora(c.baixado_em)}.`);
    return null;
  }

  // ------------------------------------------------------------------ peças
  function chipsIndicador(atual, href, filtro) {
    const lista = filtro ? D.indicadores.filter(filtro) : D.indicadores;
    return U.el('div', { class: 'mo-chips' },
      ...lista.map(i => U.el('a', { class: 'mo-chip' + (i.id === atual.id ? ' ativo' : ''), href: href(i.id), title: i.definicao }, i.rotulo)));
  }
  const UNID = ind => (ind.tipo === 'contagem' ? 'mil pessoas' : ind.tipo === 'rendimento' ? 'R$' : '%');
  /* texto da fonte que vai DENTRO das imagens (JPG, PDF) */
  function fonteImg(ind, fam, extra) {
    const t = ind[fam].tabela, s = serie(ind, fam, 'N1', '1'), i = ultimoIdx(s);
    return `Fonte: IBGE, PNAD Contínua (SIDRA, tabela ${t})${i >= 0 ? `, dados até ${rotPer(s.per[i], fam)}` : ''}. ${extra || 'A cor de uma variação é a situação publicada pelo IBGE.'}`;
  }
  /* Alternância NÍVEL × VARIAÇÃO, só nos gráficos de série: nas contagens é "quantidade × % em um ano" */
  function modosSerie(ind) {
    if (ind.tipo === 'contagem') return [{ valor: 'nivel', rotulo: 'Quantidade', dica: 'Pessoas, em mil' }, { valor: 'var', rotulo: '% em 1 ano', dica: 'Variação percentual contra o mesmo período do ano anterior, como publicada pelo IBGE' }];
    if (ind.tipo === 'rendimento') return [{ valor: 'nivel', rotulo: 'Valor (R$)', dica: 'Rendimento médio real habitual' }, { valor: 'var', rotulo: '% em 1 ano', dica: 'Variação percentual contra o mesmo período do ano anterior, como publicada pelo IBGE' }];
    return [{ valor: 'nivel', rotulo: 'Taxa (%)', dica: 'A taxa em cada período' }, { valor: 'var', rotulo: 'Variação (p.p.)', dica: 'Variação em pontos percentuais contra o mesmo período do ano anterior, como publicada pelo IBGE' }];
  }
  const subSerie = (ind, fam) => m => (m === 'var'
    ? `Variação contra o mesmo ${fam === 'trimestral' ? 'trimestre' : 'trimestre móvel'} do ano anterior (${ind.unidade_var === 'p.p.' ? 'p.p.' : '%'}), como publicada pelo IBGE`
    : `${ind.rotulo}, em ${UNID(ind)}`);
  /* defs: [{ rotulo, v: [...], va: [...], cor, tracejado }] já alinhadas aos `labels` */
  function graficoSerie(cont, ctx, labels, defs, ind) {
    const emVar = ctx.modo === 'var';
    const cv = G.canvasEm(cont, ctx.cheia ? 'mo-grafico-cheio' : 'mo-grafico alto');
    const ch = G.linha(cv, { labels, series: defs.map(d => ({ rotulo: d.rotulo, dados: emVar ? d.va : d.v, cor: d.cor, tracejado: d.tracejado })),
      formato: v => (emVar ? fmtD(ind, v) : fmtV(ind, v)), doZero: emVar });
    return MOLDURA.estilizar(ch);
  }
  /* cartão de série temporal (nível x variação) */
  function cartaoSerie(o) {
    return MOLDURA.cartao({ titulo: o.titulo, icone: 'linha', classe: o.meia ? 'mo-meia' : '', ajuda: o.ajuda, nome: o.nome, chave: 'serie.' + o.ind.tipo, modos: modosSerie(o.ind),
      faixa: { rotulos: o.labels },
      subtituloDe: (m, f) => subSerie(o.ind, o.fam)(m) + (f && (f[0] > 0 || f[1] < o.labels.length - 1) ? ` · ${o.labels[f[0]]} a ${o.labels[f[1]]}` : ''),
      superior: o.superior, rodape: o.rodape, fonteImagem: fonteImg(o.ind, o.fam, o.fonteExtra),
      desenhar: (cont, ctx) => {
        const f = ctx.faixa || [0, o.labels.length - 1], corta = x => x.slice(f[0], f[1] + 1);
        graficoSerie(cont, ctx, corta(o.labels), o.defs.map(d => Object.assign({}, d, { v: corta(d.v), va: corta(d.va) })), o.ind);
      } });
  }
  function cartaoTabela(o) {
    return MOLDURA.cartao({ titulo: o.titulo, subtitulo: o.subtitulo, icone: 'tabela', ajuda: o.ajuda, nome: o.nome, superior: o.superior, rodape: o.rodape,
      fonteImagem: o.fonteImagem || 'Fonte: IBGE, PNAD Contínua (SIDRA). A cor da variação é a situação publicada pelo IBGE; ⚠ = precisão razoável ou pior (CV acima de 15%).',
      desenhar: cont => { cont.append(U.tabela({ nomeArquivo: o.nome, linhas: o.linhas, colunas: o.colunas, ordenarPor: o.ordenarPor, limite: o.limite })); } });
  }
  const leitura = (titulo, paragrafos, naoDiz, extra) => MOLDURA.cartao({ titulo, icone: 'texto', nome: titulo, fonteImagem: 'Fonte: IBGE, PNAD Contínua. Texto montado por PNADC Resultados a partir das estimativas publicadas.',
    desenhar: cont => {
      // `append(null)` escreve o TEXTO "null" na tela: só entra o que existe
      const partes = paragrafos.filter(Boolean).map(t => U.el('p', { style: { margin: '6px 0', lineHeight: '1.55' } }, t));
      if (naoDiz && naoDiz.length) partes.push(U.el('div', { style: { marginTop: '10px' } }, U.el('b', {}, 'O que estes números não dizem'),
        U.el('ul', { style: { margin: '4px 0 0 18px', padding: 0 } }, ...naoDiz.map(t => U.el('li', { class: 'mini-info', style: { margin: '2px 0' } }, t)))));
      if (extra) partes.push(extra);
      cont.append(...partes);
    } });
  /* cartão-resumo (KPI) com a tendência da série ao lado do número */
  function kpiCard(i, fam, nivel, loc, subDe, rotuloExtra) {
    const s = serie(i, fam, nivel, loc), p = ponto(s, ultimoIdx(s));
    if (!p) return U.kpi('–', i.rotulo, 'ainda não no banco');
    const sit = situacao(i, p.va, p.sa);
    const k = U.kpi(fmtV(i, p.v), i.rotulo + (rotuloExtra ? ' · ' + rotuloExtra : ''), subDe(p), '', i.definicao);
    U.anexar(k, U.el('div', { class: 'sub', style: { color: sit.cor, fontWeight: 700 } }, `${fmtD(i, p.va)} em 1 ano · ${sit.rot}`),
      precisao(p.cv) && precisao(p.cv).aviso ? U.el('div', { class: 'sub', style: { color: precisao(p.cv).cor } }, `CV ${fmtCv(p.cv)} — escala do IBGE`) : null);
    const ini = Math.max(0, s.v.length - 16);
    k.append(MOLDURA.sparkline(s.v.slice(ini), { cor: sit.estado === 'alta' || sit.estado === 'queda' ? sit.cor : '#6b8794' }));
    return k;
  }
  const alinharA = (s, per, campo) => per.map(p => { const j = s ? idxDe(s, p) : -1; return j < 0 ? null : s[campo || 'v'][j]; });
  function avisoCv(nome, cv) {
    const p = precisao(cv);
    return p && p.aviso ? `Atenção à precisão: o CV de ${nome} é ${U.fmtNum(cv, 1)}% — precisão "${p.classe}" na escala do IBGE (até 5% ótima, 5-15% boa, 15-30% razoável, 30-50% pouco precisa, acima de 50% imprecisa): diferenças pequenas não devem ser lidas como mudança.` : null;
  }

  // ------------------------------------------------------------------ NACIONAL
  const barraChips = (ind, sec, filtro) => U.el('div', { style: { marginTop: '14px' } }, chipsIndicador(ind, id => `#/publicacoes?sec=${sec}&ind=${id}`, filtro));
  function secBrasil(cont, ind) {
    const fam = 'movel';
    const linhas = D.indicadores.map(i => {
      const s = serie(i, fam, 'N1', '1'), p = ponto(s, ultimoIdx(s));
      return p ? { id: i.id, ind: i, indicador: i.rotulo, per: p.per, perRot: rotPer(p.per, fam), v: p.v, cv: p.cv, vc: p.vc, sc: p.sc, va: p.va, sa: p.sa } : null;
    }).filter(Boolean);
    if (!linhas.length) { cont.append(avisoTabela(ind, fam) || U.el('div', { class: 'vazio' }, 'Nenhuma tabela do trimestre móvel no banco ainda.')); return; }
    const per = linhas.map(l => l.per).sort().pop();
    // ---- cartões-resumo, cada um com a tendência da própria série
    const resumo = U.el('div', { class: 'grade g4', style: { marginTop: '14px' } });
    for (const i of D.indicadores) resumo.append(kpiCard(i, fam, 'N1', '1', p => `${rotPer(p.per, fam)} · Brasil, trimestre móvel`));
    cont.append(resumo);
    cont.append(barraChips(ind, 'brasil'));
    // ---- série
    const s = serie(ind, fam, 'N1', '1');
    const rodape = [avisoTabela(ind, fam)];
    if (s && s.per.length) {
      const i = ultimoIdx(s), v = s.v.filter(x => !vazio(x));
      const mx = Math.max(...v), mn = Math.min(...v);
      const pMx = s.per[s.v.indexOf(mx)], pMn = s.per[s.v.indexOf(mn)];
      rodape.push(U.el('p', { class: 'mini-info', style: { marginTop: '6px' } },
        `Série desde ${rotPer(s.per[0], fam)}: máximo de ${fmtV(ind, mx)} (${rotPer(pMx, fam)}), mínimo de ${fmtV(ind, mn)} (${rotPer(pMn, fam)}); o valor atual (${fmtV(ind, s.v[i])}) está ${s.v[i] === mn ? 'no mínimo da série' : s.v[i] === mx ? 'no máximo da série' : `${fmtDifNivel(ind, s.v[i] - mn)} acima do mínimo`}.`,
        ind.tipo === 'rendimento' ? ' Valores reais: a série inteira está a preços do último trimestre, então a comparação ao longo do tempo já desconta a inflação.' : ''));
      rodape.push(fonte(ind, fam));
      cont.append(cartaoSerie({ titulo: `${ind.rotulo} — Brasil, trimestre móvel`, ind, fam, nome: `pnadc_brasil_${ind.id}_movel`, ajuda: ind.definicao, rodape,
        labels: s.per.map(p => rotPer(p, fam, true)), defs: [{ rotulo: `${ind.rotulo} — Brasil`, v: s.v, va: s.va, cor: U.COR.estrutura }] }));
    } else if (avisoTabela(ind, fam)) cont.append(avisoTabela(ind, fam));
    // ---- leitura
    const pars = [];
    const prin = linhas.find(l => l.id === 'desocupacao') || linhas[0];
    pars.push(`No trimestre móvel ${rotPer(prin.per, fam)}, ${comArtigo(prin.ind)} do Brasil foi de ${fmtV(prin.ind, prin.v)}: ` +
      `${fraseVar(prin.ind, prin.vc, prin.sc, 'trimestre móvel ' + rotPer(perAnterior(prin.per, fam), fam))}; e ` +
      `${fraseVar(prin.ind, prin.va, prin.sa, 'mesmo trimestre móvel de ' + (+String(prin.per).slice(0, 4) - 1))}.`);
    const imp = implicacao(prin.ind, prin.va, prin.sa);
    const impC = implicacao(prin.ind, prin.vc, prin.sc);
    if (imp) pars.push(`Em um ano: ${imp}.`);
    else if (impC) pars.push(`Frente ao trimestre móvel sem sobreposição: ${impC}. Em um ano, ${descSituacao(prin.ind, prin.va, prin.sa)}.`);
    const sig = linhas.filter(l => l.id !== prin.id && ['alta', 'queda'].includes(situacao(l.ind, l.va, l.sa).estado));
    const est = linhas.filter(l => l.id !== prin.id && situacao(l.ind, l.va, l.sa).estado === 'estavel');
    if (sig.length) pars.push('Na comparação com o mesmo trimestre móvel do ano anterior, mudaram de forma significativa: ' +
      sig.map(l => `${l.ind.curto} (${fmtD(l.ind, l.va)}, ${fmtV(l.ind, l.v)} agora)`).join('; ') + '.');
    if (est.length) pars.push('Ficaram estáveis no mesmo confronto: ' + est.map(l => `${l.ind.curto} (${fmtV(l.ind, l.v)})`).join(', ') + '.');
    const atras = linhas.filter(l => l.per < per);
    if (atras.length) pars.push(`Ainda sem ${rotPer(per, fam)}: ${atras.map(l => `${l.ind.curto} (último: ${l.perRot})`).join(', ')}.`);
    cont.append(leitura(`Brasil — trimestre móvel ${rotPer(per, fam)}`, pars, [
      'O trimestre móvel só existe para o BRASIL: não há UF nem Grande Região nessa divulgação (para elas, ver as outras abas, trimestrais).',
      'Trimestres móveis vizinhos dividem dois dos três meses; por isso o IBGE compara com o trimestre móvel de TRÊS meses antes, sem sobreposição.',
      '"Estável" quer dizer que a variação não passou no teste de significância do IBGE — não quer dizer que o número não se moveu.',
      'O que se mede é o mercado de trabalho da população; nada aqui é indicador da coleta (aproveitamento, abordagens).',
    ]));
    // ---- tabela
    cont.append(cartaoTabela({ titulo: 'Indicadores do trimestre móvel mais recente', nome: `pnadc_brasil_trimestre_movel_${per}`, linhas,
      ajuda: 'Cor da variação: a SITUAÇÃO publicada pelo IBGE. Cinza = estável (não significativa); verde = significativa no sentido favorável; vermelho = significativa no sentido desfavorável; azul = significativa num indicador sem sentido favorável (participação).',
      colunas: [
        { chave: 'indicador', rotulo: 'Indicador', largura: '220px' },
        { chave: 'perRot', rotulo: 'Trimestre móvel' },
        { chave: 'v', rotulo: 'Valor', num: true, fmt: (v, l) => fmtV(l.ind, v), valorOrd: l => l.v },
        { chave: 'cv', rotulo: 'CV (precisão)', num: true, html: true, fmt: v => celCv(v), fmtCsv: v => fmtCv(v) },
        { chave: 'vc', rotulo: '× 3 trimestres móveis antes', html: true, fmt: (v, l) => celVar(l.ind, v, l.sc), fmtCsv: (v, l) => csvVar(l.ind, v, l.sc) },
        { chave: 'va', rotulo: '× mesmo trimestre do ano anterior', html: true, fmt: (v, l) => celVar(l.ind, v, l.sa), fmtCsv: (v, l) => csvVar(l.ind, v, l.sa) },
      ] }));
  }

  // ------------------------------------------------------------------ REGIONAL
  function secRegioes(cont, ind) {
    const fam = 'trimestral', regUf = D.regiao.codigo;
    const sBr = serie(ind, fam, 'N1', '1'), iBr = ultimoIdx(sBr);
    if (iBr < 0) { cont.append(avisoTabela(ind, fam) || U.el('div', { class: 'vazio' }, 'Sem dados trimestrais no banco ainda.')); return; }
    const per = sBr.per[iBr];
    const regs = ['1', '2', '3', '4', '5'].map(r => {
      const s = serie(ind, fam, 'N2', r), p = ponto(s, idxDe(s, per));
      return p ? { cod: r, nome: nomeLocal('N2', r), daUf: r === regUf, v: p.v, cv: p.cv, vc: p.vc, sc: p.sc, va: p.va, sa: p.sa } : null;
    }).filter(Boolean);
    const br = ponto(sBr, iBr);
    cont.append(barraChips(ind, 'regioes'));
    // ---- série das regiões
    const defs = ['1', '2', '3', '4', '5'].map((r, k) => {
      const s = serie(ind, fam, 'N2', r);
      return s ? { rotulo: nomeLocal('N2', r), v: alinharA(s, sBr.per, 'v'), va: alinharA(s, sBr.per, 'va'),
        cor: r === regUf ? U.COR.estrutura : ['#9575cd', '#ffa726', '#26a69a', '#8d6e63', '#ec407a'][k] } : null;
    }).filter(Boolean);
    defs.push({ rotulo: 'Brasil', v: sBr.v, va: sBr.va, cor: '#37474f', tracejado: true });
    cont.append(cartaoSerie({ titulo: `${ind.rotulo} por Grande Região`, ind, fam, nome: `pnadc_regioes_${ind.id}_serie`, labels: sBr.per.map(p => rotPer(p, fam, true)), defs,
      rodape: [avisoTabela(ind, fam), fonte(ind, fam)], ajuda: ind.definicao + ' Em azul, a região da UF desta instalação; Brasil tracejado.' }));
    // ---- tabela do indicador
    const linhas = regs.concat([{ cod: 'BR', nome: 'Brasil', v: br.v, cv: br.cv, vc: br.vc, sc: br.sc, va: br.va, sa: br.sa }]);
    cont.append(cartaoTabela({ titulo: `${ind.rotulo}, por Grande Região — ${rotPer(per, fam)}`, nome: `pnadc_regioes_${ind.id}_${per}`, linhas,
      fonteImagem: fonteImg(ind, fam), rodape: [avisoTabela(ind, fam)],
      colunas: [
        { chave: 'nome', rotulo: 'Grande Região', fmt: (v, l) => (l.daUf ? `${v} ★ (região de ${D.uf.sigla || D.uf.nome})` : v) },
        { chave: 'v', rotulo: rotPer(per, fam), num: true, fmt: v => fmtV(ind, v) },
        { chave: 'cv', rotulo: 'CV (precisão)', num: true, html: true, fmt: v => celCv(v), fmtCsv: v => fmtCv(v) },
        { chave: 'vc', rotulo: '× trimestre anterior', html: true, fmt: (v, l) => celVar(ind, v, l.sc), fmtCsv: (v, l) => csvVar(ind, v, l.sc) },
        { chave: 'va', rotulo: '× mesmo trimestre do ano anterior', html: true, fmt: (v, l) => celVar(ind, v, l.sa), fmtCsv: (v, l) => csvVar(ind, v, l.sa) },
      ] }));
    // ---- leitura
    const ord = regs.slice().sort((a, b) => b.v - a.v);
    const minha = regs.find(r => r.daUf);
    const pars = [];
    if (ord.length) pars.push(`No ${rotPer(per, fam)}, ${comArtigo(ind)} vai de ${fmtV(ind, ord[ord.length - 1].v)} (${ord[ord.length - 1].nome}) a ${fmtV(ind, ord[0].v)} (${ord[0].nome}); no Brasil, ${fmtV(ind, br.v)}.`);
    if (minha) {
      const pos = ord.indexOf(minha) + 1;
      pars.push(`A região ${minha.nome}, onde fica ${D.uf.nome}, tem ${fmtV(ind, minha.v)} — a ${ordinal(pos)} maior das cinco; frente ao Brasil, ${compararAreas(minha, br)}. Em um ano, ${fraseVar(ind, minha.va, minha.sa, rotPer(perAno(per), fam))}.`);
      const imp = implicacao(ind, minha.va, minha.sa);
      if (imp) pars.push(`Na região, em um ano: ${imp}.`);
    }
    const mud = regs.filter(r => ['alta', 'queda'].includes(situacao(ind, r.va, r.sa).estado));
    pars.push(mud.length ? `Variação significativa em um ano: ${mud.map(r => `${r.nome} (${fmtD(ind, r.va)})`).join(', ')}; ${regs.length - mud.length} região(ões) estável(is).`
      : 'Nenhuma Grande Região teve variação significativa em um ano.');
    cont.append(leitura(`Grandes Regiões — ${ind.rotulo}, ${rotPer(per, fam)}`, pars, [
      'O IBGE testa a variação de cada região contra ela mesma no tempo; a diferença ENTRE regiões não tem teste publicado — a comparação acima usa o intervalo aproximado (± 1,96 × CV).',
      'A região soma UFs muito diferentes: o número da região não descreve nenhuma UF em particular.',
    ]));
    // ---- matriz: todos os indicadores × regiões
    const colsReg = ['1', '2', '3', '4', '5'];
    const mat = D.indicadores.map(i => {
      const sb = serie(i, fam, 'N1', '1'), ib = ultimoIdx(sb);
      if (ib < 0) return null;
      const p = sb.per[ib], l = { indicador: i.rotulo, per: rotPer(p, fam), ind: i, BR: sb.v[ib] };
      for (const r of colsReg) { const s = serie(i, fam, 'N2', r); const j = idxDe(s, p); l['R' + r] = j < 0 ? null : s.v[j]; l['S' + r] = j < 0 ? null : s.sa[j]; l['D' + r] = j < 0 ? null : s.va[j]; }
      return l;
    }).filter(Boolean);
    cont.append(cartaoTabela({ titulo: 'Todos os indicadores, por Grande Região', subtitulo: 'Último trimestre de cada tabela', nome: 'pnadc_regioes_todos', linhas: mat,
      ajuda: 'A cor do valor é a situação da variação em UM ANO (contra o mesmo trimestre do ano anterior), como publicada pelo IBGE: cinza estável, verde/vermelho significativa no sentido favorável/desfavorável.',
      colunas: [
        { chave: 'indicador', rotulo: 'Indicador', largura: '200px' }, { chave: 'per', rotulo: 'Trimestre' },
        ...colsReg.map(r => ({ chave: 'R' + r, rotulo: nomeLocal('N2', r) + (r === regUf ? ' ★' : ''), num: true, html: true,
          fmt: (v, l) => `<span style="color:${situacao(l.ind, l['D' + r], l['S' + r]).cor};font-weight:${r === regUf ? 800 : 600}">${U.esc(fmtV(l.ind, v))}</span>`,
          fmtCsv: (v, l) => fmtV(l.ind, v), valorOrd: l => l['R' + r] })),
        { chave: 'BR', rotulo: 'Brasil', num: true, fmt: (v, l) => fmtV(l.ind, v) },
      ] }));
  }

  /* as UFs com valor no período `per`, da maior para a menor, com posição e intervalo aproximado; `uf`/`reg` marcam o destaque */
  function listaUfs(ind, fam, per, uf, reg) {
    const ufs = Object.keys((D.series[ind.id] || {})[fam] || {}).filter(k => k.startsWith('N3|')).map(k => {
      const loc = k.split('|')[1], s = D.series[ind.id][fam][k], p = ponto(s, idxDe(s, per));
      return p && !vazio(p.v) ? { loc, nome: nomeLocal('N3', loc), minha: !!uf && loc === uf, regiao: !!reg && loc.charAt(0) === reg, v: p.v, cv: p.cv, va: p.va, sa: p.sa } : null;
    }).filter(Boolean).sort((a, b) => b.v - a.v);
    ufs.forEach((u, k) => { u.pos = k + 1; const icx = ic(u.v, u.cv); u.ic = icx ? `${fmtV(ind, icx[0])} a ${fmtV(ind, icx[1])}` : '–'; });
    return ufs;
  }
  /* ranking das UFs (gráfico com alternância de modo + tabela); `nomeUf` vazio = nenhuma UF em destaque */
  function blocoRanking(cont, ind, fam, per, ufs, pb, nomeUf, nomeReg) {
    if (!ufs.length) return;
      const pbv = pb && !vazio(pb.v) ? pb.v : null;
      const modosR = pbv === null ? [] : ind.tipo === 'taxa'
        ? [{ valor: 'nivel', rotulo: 'Taxa (%)' }, { valor: 'dif', rotulo: 'Dif. ao Brasil (p.p.)', dica: 'Quantos pontos percentuais acima (+) ou abaixo (−) do Brasil' }]
        : [{ valor: 'nivel', rotulo: ind.tipo === 'contagem' ? 'Quantidade' : 'Valor (R$)' },
          { valor: 'rel', rotulo: ind.tipo === 'contagem' ? '% do Brasil' : '% da média do Brasil', dica: ind.tipo === 'contagem' ? 'Participação de cada UF no total do Brasil' : 'Cada UF como porcentagem do valor do Brasil' }];
      const sinal = (v, un) => (v > 0 ? '+' : v < 0 ? '−' : '') + U.fmtNum(Math.abs(v), 1) + un;
      cont.append(MOLDURA.cartao({ classe: nomeUf ? 'mo-meia' : '', titulo: `Ranking das UFs — ${ind.rotulo}, ${rotPer(per, fam)}`, icone: 'rank', nome: `pnadc_ranking_${ind.id}_${per}`, chave: 'rank.' + ind.tipo, modos: modosR,
        subtituloDe: m => (m === 'dif' ? `Diferença da taxa de cada UF para a do Brasil (${fmtV(ind, pbv)}), em p.p.` : m === 'rel' ? (ind.tipo === 'contagem' ? 'Cada UF como % do total do Brasil' : `Cada UF como % do valor do Brasil (${fmtV(ind, pbv)})`) : `${ind.rotulo}, em ${UNID(ind)}`),
        fonteImagem: fonteImg(ind, fam, nomeUf ? `Em destaque: ${nomeUf}; azul claro: demais UFs da região ${nomeReg}.` : undefined),
        rodape: [fonte(ind, fam)], ajuda: nomeUf ? `Em azul forte, ${nomeUf}; azul claro, as demais UFs da região ${nomeReg}.` : null,
        desenhar: (c, ctx) => {
          const vals = ufs.map(u => (ctx.modo === 'rel' ? u.v / pbv * 100 : ctx.modo === 'dif' ? u.v - pbv : u.v));
          const fmt = v => (ctx.modo === 'rel' ? U.fmtNum(v, 1) + '%' : ctx.modo === 'dif' ? sinal(v, ' p.p.') : fmtV(ind, v));
          const cv = G.canvasEm(c, ctx.cheia ? 'mo-grafico-cheio' : 'grafico');
          MOLDURA.estilizar(G.barras(cv, { labels: ufs.map(u => u.nome), valores: vals, horizontal: true, formato: fmt,
            cores: ufs.map(u => (u.minha ? U.COR.estrutura : u.regiao ? '#90caf9' : U.COR.neutro2)) }));
        } }));
      cont.append(cartaoTabela({ titulo: `Ranking das UFs — tabela`, subtitulo: `${ind.rotulo}, ${rotPer(per, fam)}`, nome: `pnadc_ufs_${ind.id}_${per}`, linhas: ufs, ordenarPor: 'pos',
        fonteImagem: fonteImg(ind, fam), rodape: [fonte(ind, fam)],
        ajuda: `⚠ = precisão razoável ou pior na escala do IBGE (CV acima de 15%). O intervalo é aproximado (± 1,96 × CV): o IBGE não publica teste entre UFs.`,
        colunas: [
          { chave: 'pos', rotulo: 'Posição', num: true },
          { chave: 'nome', rotulo: 'UF', fmt: (v, l) => (l.minha ? `${v} ★` : v) },
          { chave: 'v', rotulo: 'Valor', num: true, fmt: v => fmtV(ind, v) },
          { chave: 'cv', rotulo: 'CV (precisão)', num: true, html: true, fmt: v => celCv(v), fmtCsv: v => fmtCv(v) },
          { chave: 'ic', rotulo: 'Intervalo aprox. 95%' },
          { chave: 'va', rotulo: '× ano anterior', html: true, fmt: (v, l) => celVar(ind, v, l.sa), fmtCsv: (v, l) => csvVar(ind, v, l.sa) },
        ] }));
  }

  /* sem UF em destaque: o Brasil, o ranking das 27 UFs sem destaque e o convite para escolher uma UF */
  function secUfSemDestaque(cont, ind) {
    const fam = 'trimestral';
    const sB = serie(ind, fam, 'N1', '1'), iB = ultimoIdx(sB);
    const resumo = U.el('div', { class: 'grade g4', style: { marginTop: '14px' } });
    for (const i of D.indicadores) resumo.append(kpiCard(i, fam, 'N1', '1', p => `${rotPer(p.per, fam)} · Brasil`));
    cont.append(resumo);
    cont.append(U.el('p', { class: 'mo-dica' }, MOLDURA.icone('info', 14), 'Escolha uma UF em "UF em destaque", no alto da página, para ver o resumo, a série e a leitura dela.'));
    if (iB < 0) { cont.append(avisoTabela(ind, fam) || U.el('div', { class: 'vazio' }, 'Sem dados trimestrais no banco ainda.')); return; }
    const per = sB.per[iB], pb = ponto(sB, iB);
    cont.append(barraChips(ind, 'uf'));
    blocoRanking(cont, ind, fam, per, listaUfs(ind, fam, per, '', ''), pb, '', '');
  }

  // ------------------------------------------------------------------ UF
  function secUf(cont, ind) {
    if (!D.uf.codigo) { secUfSemDestaque(cont, ind); return; }
    const fam = 'trimestral', uf = D.uf.codigo, reg = D.regiao.codigo;
    const nomeUf = nomeLocal('N3', uf) || D.uf.nome, nomeReg = nomeLocal('N2', reg);
    const sUf = serie(ind, fam, 'N3', uf), iUf = ultimoIdx(sUf);
    // capital (N6) e região metropolitana (N7) da UF, quando a tabela tem
    const extras = ['N6', 'N7'].flatMap(n => Object.keys((D.series[ind.id] || {})[fam] || {}).filter(k => k.startsWith(n + '|')).map(k => ({ nivel: n, loc: k.split('|')[1] })));
    // ---- cartões-resumo (todos os indicadores), com a tendência da série da UF
    const resumo = U.el('div', { class: 'grade g4', style: { marginTop: '14px' } });
    for (const i of D.indicadores) {
      resumo.append(kpiCard(i, fam, 'N3', uf, p => {
        const sr = serie(i, fam, 'N2', reg), sb = serie(i, fam, 'N1', '1');
        const pr = ponto(sr, idxDe(sr, p.per)), pb = ponto(sb, idxDe(sb, p.per));
        return `${rotPer(p.per, fam)} · ${nomeReg} ${pr ? fmtV(i, pr.v) : '–'} · Brasil ${pb ? fmtV(i, pb.v) : '–'}`;
      }));
    }
    cont.append(resumo);
    if (iUf < 0) { cont.append(U.el('div', { style: { marginTop: '14px' } }, avisoTabela(ind, fam) || U.el('div', { class: 'aviso' }, `A tabela ${ind[fam].tabela} não traz ${nomeUf}.`))); return; }
    const per = sUf.per[iUf], pu = ponto(sUf, iUf);
    const sR = serie(ind, fam, 'N2', reg), sB = serie(ind, fam, 'N1', '1');
    const pr = ponto(sR, idxDe(sR, per)), pb = ponto(sB, idxDe(sB, per));
    // ranking das 27 UFs no mesmo trimestre
    const ufs = listaUfs(ind, fam, per, uf, reg);
    const eu = ufs.find(u => u.minha);
    const empatadas = eu ? ufs.filter(u => !u.minha && compararAreas(u, eu).startsWith('não dá')).length : 0;
    cont.append(barraChips(ind, 'uf'));
    // ---- série UF × região × Brasil (× capital)
    const defs = [{ rotulo: nomeUf, v: sUf.v, va: sUf.va, cor: U.COR.estrutura }];
    if (sR) defs.push({ rotulo: nomeReg, v: alinharA(sR, sUf.per, 'v'), va: alinharA(sR, sUf.per, 'va'), cor: '#ffa726' });
    if (sB) defs.push({ rotulo: 'Brasil', v: alinharA(sB, sUf.per, 'v'), va: alinharA(sB, sUf.per, 'va'), cor: '#37474f', tracejado: true });
    for (const x of extras) { const s = serie(ind, fam, x.nivel, x.loc); if (s) defs.push({ rotulo: nomeLocal(x.nivel, x.loc), v: alinharA(s, sUf.per, 'v'), va: alinharA(s, sUf.per, 'va'), cor: '#26a69a', tracejado: true }); }
    cont.append(cartaoSerie({ meia: true, titulo: `${ind.rotulo}: ${nomeUf} × ${nomeReg} × Brasil`, ind, fam, nome: `pnadc_${D.uf.sigla || uf}_${ind.id}_serie`, ajuda: ind.definicao,
      labels: sUf.per.map(p => rotPer(p, fam, true)), defs, rodape: [avisoTabela(ind, fam), fonte(ind, fam)] }));
    blocoRanking(cont, ind, fam, per, ufs, pb, nomeUf, nomeReg);
    // ---- leitura
    const pars = [];
    pars.push(`No ${rotPer(per, fam)}, ${comArtigo(ind)} de ${nomeUf} foi de ${fmtV(ind, pu.v)} (${cvTexto(pu.cv)}), ` +
      `${pr ? `${pu.v > pr.v ? 'acima' : pu.v < pr.v ? 'abaixo' : 'no mesmo nível'} da região ${nomeReg} (${fmtV(ind, pr.v)})` : 'sem o número da região'} e ` +
      `${pb ? `${pu.v > pb.v ? 'acima' : pu.v < pb.v ? 'abaixo' : 'no mesmo nível'} do Brasil (${fmtV(ind, pb.v)})` : 'sem o número do Brasil'}.` +
      (pb ? ` Contra o Brasil, ${compararAreas(pu, pb)}.` : ''));
    if (eu) pars.push(`É a ${ordinal(eu.pos)} maior entre as ${ufs.length} UFs (${ordinal(ufs.length - eu.pos + 1)} menor)` +
      (empatadas ? `, mas ${empatadas} UF(s) têm intervalo que se sobrepõe ao de ${nomeUf}: a posição exata no ranking não é estatisticamente firme.` : '.'));
    pars.push(`No tempo, ${fraseVar(ind, pu.vc, pu.sc, rotPer(perAnterior(per, fam), fam))}; e ${fraseVar(ind, pu.va, pu.sa, rotPer(perAno(per), fam))}.`);
    const imp = implicacao(ind, pu.va, pu.sa), impC = implicacao(ind, pu.vc, pu.sc);
    if (imp) pars.push(`Em ${nomeUf}, em um ano: ${imp}.`);
    else if (impC) pars.push(`Em ${nomeUf}, frente ao trimestre anterior: ${impC}. Em um ano, ${descSituacao(ind, pu.va, pu.sa)}` +
      (situacao(ind, pu.va, pu.sa).estado === 'estavel' ? ' — a mudança ainda não se sustenta na comparação anual.' : '.'));
    else pars.push(fraseSemImplicacao(ind, pu, nomeUf));
    pars.push(avisoCv(nomeUf, pu.cv));
    for (const x of extras) {
      const s = serie(ind, fam, x.nivel, x.loc), p = ponto(s, idxDe(s, per));
      if (p && !vazio(p.v)) pars.push(`${x.nivel === 'N6' ? 'Na capital' : 'Na região metropolitana'}, ${nomeLocal(x.nivel, x.loc)}: ${fmtV(ind, p.v)} (${cvTexto(p.cv)}); em um ano, ${fraseVar(ind, p.va, p.sa, rotPer(perAno(per), fam))}.`);
    }
    cont.append(leitura(`${nomeUf} — ${ind.rotulo}, ${rotPer(per, fam)}`, pars, [
      `A UF só tem divulgação TRIMESTRAL: o trimestre móvel mais recente (aba Brasil) não existe para ${nomeUf}.`,
      'Ranking e comparação com o Brasil não têm teste publicado pelo IBGE: a página usa o intervalo aproximado de 95% (estimativa ± 1,96 × CV). Diferenças dentro dele são ruído amostral possível.',
      `O CV de uma UF é muito maior que o do Brasil (amostra menor): uma variação de 1 p.p. pode ser estável em ${nomeUf} e significativa no Brasil.`,
      `Nada aqui mede a coleta${AMBIENTE.superc ? ' do SuperC' : ''}: são as estimativas que a PNADc publica, depois de expandidas e calibradas.`,
    ]));
    // ---- tabela UF × região × Brasil, todos os indicadores
    const linhasT = D.indicadores.map(i => {
      const s = serie(i, fam, 'N3', uf), j = ultimoIdx(s);
      if (j < 0) return null;
      const p = s.per[j], q = ponto(s, j);
      const r = serie(i, fam, 'N2', reg), b = serie(i, fam, 'N1', '1');
      const l = { ind: i, indicador: i.rotulo, per: rotPer(p, fam), v: q.v, cv: q.cv, vc: q.vc, sc: q.sc, va: q.va, sa: q.sa,
        reg: r && idxDe(r, p) >= 0 ? r.v[idxDe(r, p)] : null, br: b && idxDe(b, p) >= 0 ? b.v[idxDe(b, p)] : null, cap: null };
      const capK = Object.keys((D.series[i.id] || {})[fam] || {}).find(k => k.startsWith('N6|'));
      if (capK) { const c = D.series[i.id][fam][capK]; const jc = idxDe(c, p); l.cap = jc < 0 ? null : c.v[jc]; }
      return l;
    }).filter(Boolean);
    const capNome = (() => { for (const i of D.indicadores) { const k = Object.keys((D.series[i.id] || {})[fam] || {}).find(x => x.startsWith('N6|')); if (k) return D.locais[k]; } return null; })();
    cont.append(cartaoTabela({ titulo: `${nomeUf}, ${nomeReg} e Brasil — todos os indicadores`, nome: `pnadc_${D.uf.sigla || uf}_indicadores`, linhas: linhasT,
      ajuda: `Capital e região metropolitana só aparecem nas tabelas que o IBGE divulga nesse nível (desocupação e rendimento).${capNome ? '' : ' Esta UF não tem capital nessas tabelas.'} ${D.uf.nome} ${extras.some(x => x.nivel === 'N7') ? 'tem' : 'não tem'} região metropolitana na PNADc.`,
      colunas: [
        { chave: 'indicador', rotulo: 'Indicador', largura: '200px' }, { chave: 'per', rotulo: 'Trimestre' },
        { chave: 'v', rotulo: nomeUf, num: true, fmt: (v, l) => fmtV(l.ind, v) },
        { chave: 'cv', rotulo: 'CV (precisão)', num: true, html: true, fmt: v => celCv(v), fmtCsv: v => fmtCv(v) },
        { chave: 'vc', rotulo: '× trim. anterior', html: true, fmt: (v, l) => celVar(l.ind, v, l.sc), fmtCsv: (v, l) => csvVar(l.ind, v, l.sc) },
        { chave: 'va', rotulo: '× ano anterior', html: true, fmt: (v, l) => celVar(l.ind, v, l.sa), fmtCsv: (v, l) => csvVar(l.ind, v, l.sa) },
        { chave: 'reg', rotulo: nomeReg, num: true, fmt: (v, l) => fmtV(l.ind, v) },
        { chave: 'br', rotulo: 'Brasil', num: true, fmt: (v, l) => fmtV(l.ind, v) },
      ].concat(capNome ? [{ chave: 'cap', rotulo: capNome + ' (capital)', num: true, fmt: (v, l) => fmtV(l.ind, v) }] : []) }));
  }

  // ------------------------------------------------------------------ CAPITAL E REGIÃO METROPOLITANA (fase 5)
  const locaisCap = (i, fam) => ['N6', 'N7'].flatMap(n => Object.keys(((D.series[i.id] || {})[fam]) || {}).filter(k => k.startsWith(n + '|')).map(k => ({ nivel: n, loc: k.split('|')[1] })));
  /* sem UF em destaque: todas as capitais e regiões metropolitanas que o IBGE divulga, lado a lado */
  function secCapitaisTodas(cont, ind) {
    const fam = 'trimestral';
    const comCap = D.indicadores.filter(i => locaisCap(i, fam).length);
    if (!comCap.length) {
      cont.append(MOLDURA.cartao({ titulo: 'Capitais e regiões metropolitanas', icone: 'capital', semJpg: true, semCheia: true,
        desenhar: c => c.append(U.el('div', { class: 'mo-vazio' }, D.atualizando ? 'As tabelas estão sendo baixadas do IBGE…' : 'O banco ainda não tem capitais nem regiões metropolitanas. Use "Atualizar com o IBGE".')) }));
      return;
    }
    if (!comCap.some(i => i.id === ind.id)) ind = comCap[0];
    cont.append(barraChips(ind, 'capitais', i => comCap.some(c => c.id === i.id)));
    const locs = locaisCap(ind, fam);
    const base = serie(ind, fam, locs[0].nivel, locs[0].loc), per = base.per[ultimoIdx(base)];
    const linhas = [];
    locs.forEach(x => {
      const s = serie(ind, fam, x.nivel, x.loc), p = ponto(s, idxDe(s, per));
      if (p && !vazio(p.v)) linhas.push({ nome: nomeLocal(x.nivel, x.loc), tipo: x.nivel === 'N6' ? 'Capital' : 'Região metropolitana', v: p.v, cv: p.cv, vc: p.vc, sc: p.sc, va: p.va, sa: p.sa });
    });
    linhas.sort((a, b) => b.v - a.v);
    cont.append(MOLDURA.cartao({ titulo: `${ind.rotulo} — capitais e regiões metropolitanas, ${rotPer(per, fam)}`, icone: 'capital', nome: `pnadc_capitais_${ind.id}_${per}`,
      subtitulo: `${ind.rotulo}, em ${UNID(ind)}`, fonteImagem: fonteImg(ind, fam), rodape: [fonte(ind, fam)],
      desenhar: (c, ctx) => {
        const cv = G.canvasEm(c, ctx.cheia ? 'mo-grafico-cheio' : 'grafico');
        MOLDURA.estilizar(G.barras(cv, { labels: linhas.map(l => (l.tipo === 'Capital' ? l.nome : l.nome + ' (RM)')), valores: linhas.map(l => l.v), horizontal: true,
          formato: v => fmtV(ind, v), cores: linhas.map(l => (l.tipo === 'Capital' ? U.COR.estrutura : '#90caf9')) }));
      } }));
    cont.append(cartaoTabela({ titulo: 'Capitais e regiões metropolitanas — tabela', subtitulo: `${ind.rotulo}, ${rotPer(per, fam)}`, nome: `pnadc_capitais_${ind.id}_${per}_tabela`, linhas,
      fonteImagem: fonteImg(ind, fam), rodape: [fonte(ind, fam)], ajuda: 'Azul forte: capital; azul claro: região metropolitana. ⚠ = precisão razoável ou pior (CV acima de 15%).',
      colunas: [
        { chave: 'nome', rotulo: 'Território' }, { chave: 'tipo', rotulo: 'Tipo' },
        { chave: 'v', rotulo: rotPer(per, fam), num: true, fmt: v => fmtV(ind, v) },
        { chave: 'cv', rotulo: 'CV (precisão)', num: true, html: true, fmt: v => celCv(v), fmtCsv: v => fmtCv(v) },
        { chave: 'vc', rotulo: '× trim. anterior', html: true, fmt: (v, l) => celVar(ind, v, l.sc), fmtCsv: (v, l) => csvVar(ind, v, l.sc) },
        { chave: 'va', rotulo: '× ano anterior', html: true, fmt: (v, l) => celVar(ind, v, l.sa), fmtCsv: (v, l) => csvVar(ind, v, l.sa) },
      ] }));
  }
  function secCapitais(cont, ind) {
    if (!D.uf.codigo) { secCapitaisTodas(cont, ind); return; }
    const fam = 'trimestral', uf = D.uf.codigo, reg = D.regiao.codigo;
    const nomeUf = nomeLocal('N3', uf) || D.uf.nome, nomeReg = nomeLocal('N2', reg);
    const comCap = D.indicadores.filter(i => locaisCap(i, fam).length);
    if (!comCap.length) {
      cont.append(MOLDURA.cartao({ titulo: 'Capital e região metropolitana', icone: 'capital', semJpg: true, semCheia: true,
        desenhar: c => c.append(U.el('div', { class: 'mo-vazio' }, D.atualizando ? 'As tabelas estão sendo baixadas do IBGE…' : `O banco ainda não tem capital nem região metropolitana de ${nomeUf}. Elas vêm das tabelas de desocupação e de rendimento; use "Atualizar com o IBGE".`)) }));
      return;
    }
    if (!comCap.some(i => i.id === ind.id)) ind = comCap[0];
    // ---- cartões: cada local × cada indicador que o IBGE divulga nesse nível
    const resumo = U.el('div', { class: 'grade g4', style: { marginTop: '14px' } });
    for (const i of comCap) for (const x of locaisCap(i, fam)) {
      resumo.append(kpiCard(i, fam, x.nivel, x.loc, p => {
        const su = serie(i, fam, 'N3', uf), pu = ponto(su, idxDe(su, p.per));
        return `${rotPer(p.per, fam)} · ${nomeUf} ${pu ? fmtV(i, pu.v) : '–'}`;
      }, nomeLocal(x.nivel, x.loc)));
    }
    cont.append(resumo);
    cont.append(barraChips(ind, 'capitais', i => comCap.some(c => c.id === i.id)));
    const locs = locaisCap(ind, fam);
    const sUf = serie(ind, fam, 'N3', uf), sBr = serie(ind, fam, 'N1', '1'), sR = serie(ind, fam, 'N2', reg);
    const base = serie(ind, fam, locs[0].nivel, locs[0].loc);
    const per = base.per[ultimoIdx(base)];
    // ---- série
    const defs = [];
    const cores = ['#00897b', '#7e57c2', '#26a69a'];
    locs.forEach((x, k) => { const s = serie(ind, fam, x.nivel, x.loc); if (s) defs.push({ rotulo: nomeLocal(x.nivel, x.loc), v: alinharA(s, base.per, 'v'), va: alinharA(s, base.per, 'va'), cor: k === 0 ? U.COR.estrutura : cores[k % 3] }); });
    if (sUf) defs.push({ rotulo: nomeUf, v: alinharA(sUf, base.per, 'v'), va: alinharA(sUf, base.per, 'va'), cor: '#ffa726' });
    if (sBr) defs.push({ rotulo: 'Brasil', v: alinharA(sBr, base.per, 'v'), va: alinharA(sBr, base.per, 'va'), cor: '#37474f', tracejado: true });
    cont.append(cartaoSerie({ titulo: `${ind.rotulo}: capital e região metropolitana de ${nomeUf}`, ind, fam, nome: `pnadc_${D.uf.sigla || uf}_capital_${ind.id}`, ajuda: ind.definicao,
      labels: base.per.map(p => rotPer(p, fam, true)), defs, rodape: [avisoTabela(ind, fam), fonte(ind, fam)] }));
    // ---- tabela
    const linhas = [];
    const add = (nome, s) => { const p = ponto(s, idxDe(s, per)); if (p && !vazio(p.v)) linhas.push({ nome, v: p.v, cv: p.cv, vc: p.vc, sc: p.sc, va: p.va, sa: p.sa }); };
    locs.forEach(x => add(`${nomeLocal(x.nivel, x.loc)} (${x.nivel === 'N6' ? 'capital' : 'região metropolitana'})`, serie(ind, fam, x.nivel, x.loc)));
    add(nomeUf, sUf); add(nomeReg, sR); add('Brasil', sBr);
    cont.append(cartaoTabela({ titulo: `${ind.rotulo} — capital, UF, região e Brasil, ${rotPer(per, fam)}`, nome: `pnadc_${D.uf.sigla || uf}_capital_${ind.id}_${per}`, linhas, fonteImagem: fonteImg(ind, fam),
      rodape: [fonte(ind, fam)], colunas: [
        { chave: 'nome', rotulo: 'Território' },
        { chave: 'v', rotulo: rotPer(per, fam), num: true, fmt: v => fmtV(ind, v) },
        { chave: 'cv', rotulo: 'CV (precisão)', num: true, html: true, fmt: v => celCv(v), fmtCsv: v => fmtCv(v) },
        { chave: 'vc', rotulo: '× trim. anterior', html: true, fmt: (v, l) => celVar(ind, v, l.sc), fmtCsv: (v, l) => csvVar(ind, v, l.sc) },
        { chave: 'va', rotulo: '× ano anterior', html: true, fmt: (v, l) => celVar(ind, v, l.sa), fmtCsv: (v, l) => csvVar(ind, v, l.sa) },
      ] }));
    // ---- leitura
    const pars = [];
    const pU = ponto(sUf, idxDe(sUf, per));
    locs.forEach(x => {
      const s = serie(ind, fam, x.nivel, x.loc), p = ponto(s, idxDe(s, per));
      if (!p || vazio(p.v)) return;
      const onde = x.nivel === 'N6' ? 'A capital' : 'A região metropolitana';
      pars.push(`${onde}, ${nomeLocal(x.nivel, x.loc)}, tem ${comArtigo(ind).replace(/^(a|o) /, '')} de ${fmtV(ind, p.v)} (${cvTexto(p.cv)}) no ${rotPer(per, fam)}` +
        (pU ? `, ${p.v > pU.v ? 'acima' : p.v < pU.v ? 'abaixo' : 'no mesmo nível'} de ${nomeUf} (${fmtV(ind, pU.v)}); contra a UF, ${compararAreas(p, pU)}` : '') + `. Em um ano, ${fraseVar(ind, p.va, p.sa, rotPer(perAno(per), fam))}.`);
      pars.push(avisoCv(nomeLocal(x.nivel, x.loc), p.cv));
    });
    cont.append(leitura(`Capital e região metropolitana — ${ind.rotulo}, ${rotPer(per, fam)}`, pars, [
      'Capital e região metropolitana só têm divulgação trimestral e só em algumas tabelas (desocupação e rendimento); os demais indicadores ficam de fora por decisão do IBGE, não da página.',
      'A amostra é menor que a da UF: o CV costuma ser maior e variações pequenas raramente são significativas. Compare com a UF pelo intervalo aproximado (± 1,96 × CV), não pelo número solto.',
      'Nem toda UF tem região metropolitana na PNAD Contínua.',
    ]));
  }

  // ------------------------------------------------------------------ COMPARAR DOIS PERÍODOS (fase 5)
  /* Compara o MESMO território em dois períodos quaisquer. Se os dois períodos são os que o IBGE já compara (o mesmo
     período do ano anterior, ou o período anterior), vale a SITUAÇÃO publicada; senão não há teste publicado, e a
     página diz isso e usa o intervalo aproximado (± 1,96 × CV), sem cor de bom ou ruim. */
  function comparacaoPeriodos(ind, pA, pB, a, b, fam) {
    if (!pA || !pB || vazio(pA.v) || vazio(pB.v)) return null;
    const dif = pB.v - pA.v, rel = pA.v !== 0 ? (pB.v / pA.v - 1) * 100 : null;
    let pub = null;
    if (a === perAno(b)) pub = { d: pB.va, cod: pB.sa, contra: 'o mesmo período do ano anterior' };
    else if (a === perAnterior(b, fam)) pub = { d: pB.vc, cod: pB.sc, contra: 'o período anterior' };
    if (pub) {
      const sit = situacao(ind, pub.d, pub.cod);
      return { dif, rel, publicada: true, estado: sit.estado, rot: sit.rot, cor: sit.cor, texto: `situação publicada pelo IBGE (contra ${pub.contra}): ${sit.rot}` };
    }
    const txt = compararAreas(pA, pB), prov = /^diferença provável/.test(txt);
    return { dif, rel, publicada: false, estado: prov ? 'provavel' : 'incerto', rot: prov ? 'diferença provável' : 'não dá para afirmar diferença', cor: COR_NEUTRA,
      texto: `sem teste publicado para estes dois períodos; ${txt}` };
  }
  function secComparar(cont, _ind, query) {
    const fam = 'trimestral', uf = D.uf.codigo, reg = D.regiao.codigo;
    const nomeUf = nomeLocal('N3', uf) || D.uf.nome;
    const terr = [{ id: 'br', nome: 'Brasil', nivel: 'N1', loc: '1' }];
    ['1', '2', '3', '4', '5'].forEach(r => terr.push({ id: 'r' + r, nome: `Região ${nomeLocal('N2', r)}`, nivel: 'N2', loc: r }));
    if (uf) terr.push({ id: 'uf', nome: nomeUf, nivel: 'N3', loc: uf });
    const vistos = {};
    D.indicadores.forEach(i => locaisCap(i, fam).forEach(x => { const k = x.nivel + '|' + x.loc; if (!vistos[k]) { vistos[k] = 1; terr.push({ id: (x.nivel === 'N6' ? 'cap' : 'rm') + x.loc, nome: `${nomeLocal(x.nivel, x.loc)} (${x.nivel === 'N6' ? 'capital' : 'região metropolitana'})`, nivel: x.nivel, loc: x.loc }); } }));
    const pedido = (query && query.get('ter')) || (uf ? 'uf' : 'br');
    const t = terr.find(x => x.id === pedido) || terr.find(x => x.id === (uf ? 'uf' : 'br'));
    const serieT = i => serie(i, fam, t.nivel, t.loc);
    const base = D.indicadores.map(serieT).find(s => s && s.per.length);
    if (!base) { cont.append(U.el('div', { class: 'aviso' }, `O banco ainda não tem ${t.nome} nas tabelas trimestrais.`)); return; }
    const pers = base.per.slice();
    const ultimo = pers[ultimoIdx(base)] || pers[pers.length - 1];
    const b = pers.indexOf(query && query.get('b')) >= 0 ? query.get('b') : ultimo;
    const a = pers.indexOf(query && query.get('a')) >= 0 ? query.get('a') : (pers.indexOf(perAno(b)) >= 0 ? perAno(b) : pers[0]);
    // ---- controles
    const ir = (ter, pa, pb) => { location.hash = `#/publicacoes?sec=comparar&ter=${encodeURIComponent(ter)}&a=${pa}&b=${pb}`; };
    const sel = (rotulo, opcoes, atual, aoMudar) => {
      const s = U.el('select', {}, ...opcoes.map(o => U.el('option', { value: o[0] }, o[1])));
      s.value = atual; s.onchange = () => aoMudar(s.value);
      return U.el('label', {}, rotulo, s);
    };
    const opPer = pers.slice().reverse().map(p => [p, rotPer(p, fam)]);
    const controles = U.el('div', { class: 'mo-comp' },
      sel('Território', terr.map(x => [x.id, x.nome]), t.id, v => ir(v, a, b)),
      sel('Período A (base)', opPer, a, v => ir(t.id, v, b)),
      sel('Período B (comparado)', opPer, b, v => ir(t.id, a, v)));
    // ---- linhas
    const linhas = D.indicadores.map(i => {
      const s = serieT(i);
      if (!s) return null;
      const pA = ponto(s, idxDe(s, a)), pB = ponto(s, idxDe(s, b)), cmp = comparacaoPeriodos(i, pA, pB, a, b, fam);
      return cmp ? { ind: i, indicador: i.rotulo, vA: pA.v, vB: pB.v, cvA: pA.cv, cvB: pB.cv, dif: cmp.dif, rel: cmp.rel, cmp } : null;
    }).filter(Boolean);
    const sinal = (x, un) => (x > 0 ? '+' : x < 0 ? '−' : '') + U.fmtNum(Math.abs(x), 1) + un;
    const fmtDif = l => (l.ind.tipo === 'taxa' ? sinal(l.dif, ' p.p.') : l.ind.tipo === 'rendimento' ? (l.dif < 0 ? '−' : '+') + 'R$ ' + U.fmtInt(Math.abs(l.dif)) : (l.dif < 0 ? '−' : '+') + U.fmtInt(Math.abs(l.dif)) + ' mil');
    cont.append(MOLDURA.cartao({ titulo: 'Comparar dois períodos', icone: 'comparar', semJpg: true, semCheia: true,
      subtitulo: 'Escolha o território e os dois períodos. Os números são os publicados; a página só calcula a diferença.',
      desenhar: c => c.append(controles, U.el('p', { class: 'mini-info', style: { margin: '4px 0 0' } },
        `${t.nome}: ${rotPer(a, fam)} → ${rotPer(b, fam)}. O IBGE só publica teste de significância contra o mesmo período do ano anterior e contra o período anterior; para outros pares, a página usa o intervalo aproximado de 95% (± 1,96 × CV) e não usa cor de bom ou ruim.`)) }));
    if (!linhas.length) { cont.append(U.el('div', { class: 'aviso', style: { marginTop: '14px' } }, `Sem valores de ${t.nome} nos dois períodos escolhidos.`)); return; }
    // ---- gráfico: variação % (todos os indicadores) × diferença em p.p. (só as taxas)
    cont.append(MOLDURA.cartao({ titulo: `${t.nome}: de ${rotPer(a, fam)} para ${rotPer(b, fam)}`, icone: 'grafico', nome: `pnadc_comparar_${t.id}_${a}_${b}`, chave: 'comparar', modos: [
      { valor: 'pct', rotulo: '% de variação', dica: 'Variação percentual de cada indicador (comparável entre eles)' },
      { valor: 'abs', rotulo: 'Diferença (p.p.)', dica: 'Diferença em pontos percentuais, só para as taxas' }],
      subtituloDe: m => (m === 'abs' ? 'Diferença em pontos percentuais entre os dois períodos (só indicadores que são taxas)' : 'Variação percentual entre os dois períodos, em cada indicador'),
      fonteImagem: 'Fonte: IBGE, PNAD Contínua (SIDRA). Cor só quando o IBGE publica a situação da comparação; cinza = sem teste publicado para este par de períodos.',
      desenhar: (c, ctx) => {
        const lista = ctx.modo === 'abs' ? linhas.filter(l => l.ind.tipo === 'taxa') : linhas.filter(l => l.rel !== null);
        if (!lista.length) { c.append(U.el('div', { class: 'mo-vazio' }, 'Nada a mostrar neste modo.')); return; }
        const cv = G.canvasEm(c, ctx.cheia ? 'mo-grafico-cheio' : 'grafico');
        MOLDURA.estilizar(G.barras(cv, { labels: lista.map(l => l.ind.curto), valores: lista.map(l => (ctx.modo === 'abs' ? l.dif : l.rel)), horizontal: true,
          formato: v => (ctx.modo === 'abs' ? sinal(v, ' p.p.') : sinal(v, '%')),
          cores: lista.map(l => (l.cmp.publicada && (l.cmp.estado === 'alta' || l.cmp.estado === 'queda') ? l.cmp.cor : '#90a4ae')) }));
      } }));
    // ---- tabela
    cont.append(cartaoTabela({ titulo: 'Todos os indicadores', subtitulo: `${t.nome}: ${rotPer(a, fam)} → ${rotPer(b, fam)}`, nome: `pnadc_comparar_${t.id}_${a}_${b}_tabela`, linhas,
      fonteImagem: 'Fonte: IBGE, PNAD Contínua (SIDRA). Intervalo aproximado de 95% = estimativa ± 1,96 × CV; o IBGE não testa a diferença entre estes dois períodos, salvo quando indicado.',
      colunas: [
        { chave: 'indicador', rotulo: 'Indicador', largura: '200px' },
        { chave: 'vA', rotulo: rotPer(a, fam), num: true, fmt: (v, l) => fmtV(l.ind, v) },
        { chave: 'vB', rotulo: rotPer(b, fam), num: true, fmt: (v, l) => fmtV(l.ind, v) },
        { chave: 'dif', rotulo: 'Diferença', num: true, fmt: (v, l) => fmtDif(l) },
        { chave: 'rel', rotulo: 'Variação %', num: true, fmt: v => (v === null ? '–' : sinal(v, '%')) },
        { chave: 'cvB', rotulo: 'CV (B)', num: true, html: true, fmt: v => celCv(v), fmtCsv: v => fmtCv(v) },
        { chave: 'cmp', rotulo: 'Leitura', html: true, fmt: (v) => `<span style="color:${v.cor};font-weight:700">${U.esc(v.rot)}</span> <span class="mini-info">${U.esc(v.publicada ? '(situação publicada pelo IBGE)' : '(intervalo aproximado)')}</span>`,
          fmtCsv: v => `${v.rot} — ${v.texto}` },
      ] }));
    // ---- leitura
    const pars = [`${t.nome}, de ${rotPer(a, fam)} para ${rotPer(b, fam)}:`];
    linhas.forEach(l => {
      pars.push(`${cap(l.ind.curto)}: de ${fmtV(l.ind, l.vA)} para ${fmtV(l.ind, l.vB)} (${fmtDif(l)}${l.rel === null ? '' : `, ${sinal(l.rel, '%')}`}) — ${l.cmp.texto}.`);
    });
    cont.append(leitura('Leitura da comparação', pars, [
      'A diferença entre dois períodos quaisquer NÃO tem teste de significância publicado pelo IBGE. O intervalo aproximado (± 1,96 × CV) é uma indicação, não um teste.',
      'Períodos diferentes do mesmo trimestre do ano anterior misturam sazonalidade com mudança real (ex.: 4º tri × 1º tri).',
      'Rendimento está a preços do último trimestre: a comparação já desconta a inflação.',
    ]));
  }

  // ------------------------------------------------------------------ como ler
  function cartaoComoLer() {
    const L = D.limites || {};
    return MOLDURA.cartao({ titulo: 'Como ler esta página', icone: 'info', semJpg: true, semCheia: true, desenhar: cont => cont.append(...[
      U.el('p', { style: { margin: '4px 0' } }, U.el('b', {}, 'Situação da variação. '),
        'Cada variação vem com a situação que o IBGE publica, resultado do teste de significância: ',
        U.el('b', {}, 'Z'), ' = variação estatisticamente significativa (o sentido é o sinal: só então a página diz "aumentou" ou "recuou"); ',
        U.el('b', {}, 'A'), ' = não significativa ("ficou estável"); ', U.el('b', {}, '-'), ' = sem comparação. Código diferente é mostrado cru, sem tradução. Essas letras não têm relação com a escala de precisão do CV.'),
      U.el('p', { class: 'mini-info', style: { margin: '4px 0' } }, D.fonte_legenda || ''),
      U.el('p', { style: { margin: '4px 0' } }, U.el('b', {}, 'Símbolos do SIDRA. '),
        Object.keys(D.simbolos || {}).map(k => `"${k}" ${D.simbolos[k]}`).join('; ') + '. "–" nesta página = sem valor.'),
      U.el('p', { style: { margin: '4px 0' } }, U.el('b', {}, 'Precisão. '),
        `O CV (coeficiente de variação) é publicado com cada estimativa e vem com a classe de precisão da escala do IBGE: até 5% ótima, 5–15% boa, 15–30% razoável, 30–50% pouco precisa, acima de 50% imprecisa (o aviso ⚠ aparece de "razoável" para baixo). Nível de confiança da PNADC: ${D.confianca || 95}%. O intervalo aproximado de 95% é estimativa ± 1,96 × CV.`),
      U.el('p', { style: { margin: '4px 0' } }, U.el('b', {}, `Quando ${AMBIENTE.produto || 'o programa'} fala com o IBGE. `),
        `Só por evento — abrir esta página com o cache vencido ou o botão "Atualizar com o IBGE"; nunca por relógio. No máximo uma consulta por tabela a cada ${L.intervalo_h || 12} h (o botão fura esse prazo, mas não consulta a mesma tabela duas vezes em ${L.intervalo_forcado_min || 30} min). Depois de uma falha de rede, espera ${L.espera_erro_min || 15} min, e o que já estava no banco continua valendo. Quando o IBGE publica um período novo, ele entra sozinho na consulta seguinte.`),
      U.el('p', { class: 'mini-info', style: { margin: '4px 0' } }, `API: ${D.api || 'servicodados.ibge.gov.br/api/v3/agregados'}`),
    ]) });
  }

  // ------------------------------------------------------------------ página
  function faixaEstado() {
    const cs = Object.keys(D.consultas || {}).filter(k => k !== '*').map(k => D.consultas[k]);
    const okEm = cs.map(c => c.ultimo_ok).filter(Boolean).sort().pop();
    const falhas = cs.filter(c => !c.ok).length;
    const partes = [okEm ? `Última conferência com o IBGE: ${U.fmtDataHora(okEm)}` : 'Ainda não houve consulta ao IBGE nesta máquina',
      ` · ${cs.filter(c => c.baixado_em).length} de ${D.indicadores.length * 2} tabelas no banco`];
    if (falhas) partes.push(` · ${falhas} com a última consulta falhada`);
    const el = U.el('div', { class: 'mini-info', style: { margin: '0 0 8px' } }, ...partes);
    if (D.atualizando) el.append(U.el('span', { style: { color: 'var(--laranja)', marginLeft: '6px' } }, '· consultando o IBGE agora…'));
    if (D.rede_pausada_ate) el.append(U.el('span', { style: { color: U.COR.ruim, marginLeft: '6px' } }, `· sem rede com o IBGE: nova tentativa a partir de ${U.fmtDataHora(D.rede_pausada_ate)}`));
    return el;
  }
  function botaoAtualizar() {
    const dica = 'Atualizar com o IBGE: pergunta se há publicação nova (a mesma tabela não é consultada duas vezes em 30 minutos)';
    const b = MOLDURA.botaoHero('Atualizar com o IBGE', 'atualizar', () => {}, true);
    b.disabled = !!(D && D.atualizando); b.title = D && D.atualizando ? 'Consultando o IBGE…' : dica; b.setAttribute('aria-label', 'Atualizar com o IBGE');
    b.onclick = () => {
      b.disabled = true; b.title = 'Consultando o IBGE…'; b.classList.add('girando');
      carregar('POST').then(() => {
        if (erro) AMBIENTE.toast('Não consegui pedir a atualização: ' + erro, 'erro', 6000);
        else if (!D.agendada) AMBIENTE.toast(D.atualizando ? 'Já há uma consulta ao IBGE em curso.' : 'Todas as tabelas foram conferidas há menos de 30 minutos (ou a rede está em pausa): nada a consultar agora.', '', 6000);
        if (naPagina()) AMBIENTE.renderizar();
      });
    };
    return b;
  }

  function render(cont, _F, query) {
    MOLDURA.injetarCss();
    cont.classList.add('mo-pagina'); cont.classList.remove('sobre');
    const secPedida = (query && query.get('sec')) || 'brasil';
    // o gerador de releases (releases.js) é uma aba desta página: mesmo cache, nenhuma rede nova
    const temRelease = typeof RELEASES !== 'undefined' && RELEASES.pode();
    const secoes = temRelease ? SECOES.concat([{ id: 'release', rot: 'Gerar release', ico: 'texto' }]) : SECOES;
    const sec = secoes.some(s => s.id === secPedida) ? secPedida : 'brasil';
    const temApres = typeof APRESENTACAO !== 'undefined';
    const periodoRef = (() => {
      if (!D) return null;
      const i = indDe('desocupacao'), s = serie(i, 'trimestral', D.uf.codigo ? 'N3' : 'N1', D.uf.codigo || '1'), j = ultimoIdx(s);
      return j >= 0 ? rotPer(s.per[j], 'trimestral') : null;
    })();
    const soAtualizar = sec === 'comparar' || sec === 'release';
    const acoes = D ? [
      temApres && !soAtualizar ? MOLDURA.botaoHero('Apresentar', 'apresentar', () => APRESENTACAO.abrir(D)) : null,
      temApres && !soAtualizar ? MOLDURA.botaoHero('PDF', 'pdf', b => APRESENTACAO.baixarPdf(D, b)) : null,
      botaoAtualizar(),
    ].concat(AMBIENTE.acoesExtras ? AMBIENTE.acoesExtras() : []) : null;
    const cabecalho = sec === 'comparar' ? { t: 'Comparar períodos', s: 'Escolha um território e dois períodos: a página mostra a diferença em cada indicador.' }
      : sec === 'release' ? { t: 'Gerar release', s: 'Texto, imagens, HTML e PDF prontos para divulgar a publicação em análise.' }
        : { t: 'Resultados da PNAD Contínua', s: 'Os números que o IBGE divulga — Brasil, Grandes Regiões, UF, capital e região metropolitana.' };
    const opcHero = { titulo: cabecalho.t,
      subtitulo: cabecalho.s,
      selos: D ? [D.uf.codigo ? { rotulo: 'UF em destaque', valor: D.uf.nome || D.uf.sigla } : null, periodoRef ? { rotulo: D.referencia ? 'Publicação (anterior)' : 'Última publicação', valor: periodoRef } : null, { rotulo: 'Fonte', valor: 'IBGE · SIDRA' }].filter(Boolean) : [], acoes };
    // hospedeiro com cabeçalho próprio (casca): um cabeçalho só; sem ele (SuperC), a faixa verde da página
    if (AMBIENTE.cabecalho) AMBIENTE.cabecalho(opcHero); else cont.append(MOLDURA.hero(opcHero));
    if (!D || velho) {
      if (!D) cont.append(erro ? U.el('div', { class: 'aviso erro' }, 'Não consegui ler as publicações guardadas: ' + erro + ' ',
        U.el('button', { class: 'btn pequeno', onclick: () => { erro = null; carregar().then(() => { if (naPagina()) AMBIENTE.renderizar(); }); } }, 'Tentar de novo'))
        : U.el('div', { class: 'vazio' }, 'Lendo as publicações guardadas…'));
      if (!carregando && !(erro && !D)) carregar().then(() => { if (naPagina()) AMBIENTE.renderizar(); });
      if (!D) return;
    }
    if (AMBIENTE.mostrarStatus) AMBIENTE.mostrarStatus(faixaEstado()); else cont.append(faixaEstado());
    // alerta de publicação nova / revisão: o que era novo NA CHEGADA; abrir a página marca como visto
    if (typeof NOVIDADES !== 'undefined') U.anexar(cont, NOVIDADES.blocoResultados(D));
    const ufSigla = D.uf.sigla || D.uf.nome;
    const rotuloSec = s => (s.id === 'uf' ? (D.uf.nome || ufSigla) : s.id === 'regioes' ? `${s.rot} (${nomeLocal('N2', D.regiao.codigo) || '—'} em destaque)` : s.rot);
    // com o menu lateral do hospedeiro (casca), Comparar períodos e Gerar release moram lá: aqui só as seções de Resultados
    const doMenu = !!AMBIENTE.menuTemAreas, abas = secoes.filter(s => !(doMenu && (s.id === 'comparar' || s.id === 'release')));
    if (!(doMenu && (sec === 'comparar' || sec === 'release'))) cont.append(U.el('nav', { class: 'mo-secoes', 'aria-label': 'Seções de Resultados' },
      ...abas.map(s => U.el('a', { class: 'mo-secao' + (s.id === sec ? ' ativo' : ''), href: `#/publicacoes?sec=${s.id}` + (query && query.get('ind') && s.id !== 'comparar' ? `&ind=${encodeURIComponent(query.get('ind'))}` : ''),
        'aria-current': s.id === sec ? 'page' : null }, MOLDURA.icone(s.ico, 16), rotuloSec(s)))));
    const semNada = !Object.keys(D.series || {}).some(k => Object.keys(D.series[k].movel || {}).length || Object.keys(D.series[k].trimestral || {}).length);
    if (semNada) {
      cont.append(U.el('div', { class: D.rede_pausada_ate ? 'aviso erro' : 'aviso' },
        D.atualizando ? 'Primeira consulta ao IBGE em curso: as dezesseis tabelas levam cerca de dois minutos. A página se atualiza sozinha.'
          : D.rede_pausada_ate ? `Não consegui falar com o IBGE (${(D.consultas['*'] || {}).erro || 'sem rede'}). Nova tentativa a partir de ${U.fmtDataHora(D.rede_pausada_ate)}, ao abrir esta página ou pelo botão.`
            : 'Ainda não há publicações no banco. Use "Atualizar com o IBGE".'));
      cont.append(U.el('div', { style: { marginTop: '14px' } }, cartaoComoLer()));
      return;
    }
    if (sec === 'release') { RELEASES.render(cont, D, query); return; }
    const ind = indDe((query && query.get('ind')) || 'desocupacao');
    if (sec === 'brasil') secBrasil(cont, ind);
    if (sec === 'regioes') secRegioes(cont, ind);
    if (sec === 'uf') secUf(cont, ind);
    if (sec === 'capitais') secCapitais(cont, ind);
    if (sec === 'comparar') secComparar(cont, ind, query);
    cont.append(U.el('div', { style: { marginTop: '14px' } }, cartaoComoLer()));
  }

  return { render, sair: () => { velho = true; clearTimeout(espera); if (typeof NOVIDADES !== 'undefined') NOVIDADES.sairResultados(); },
    // o gerador de releases (releases.js) e os alertas leem o MESMO cache já carregado
    dados: () => D, carregar, situacao, precisao,
    _teste: { rotPer, perAnterior, perAno, situacao, fraseVar, ic, compararAreas, descSituacao, fraseSemImplicacao, modosSerie, comparacaoPeriodos } };
})();

/* O hospedeiro registra a página: PUBLICACOES.render(cont, F, query) e PUBLICACOES.sair(). No SuperC:
   PAGINAS.publicacoes = { semFiltros: true, render(cont, F, q) { PUBLICACOES.render(cont, F, q); }, sair() { PUBLICACOES.sair(); } }. */
