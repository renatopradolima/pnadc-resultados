/* PNADC Resultados -- página "Entenda a PNADC": história, desenho e conceitos da pesquisa, com figuras e fontes oficiais do IBGE.
   Os textos RESUMEM documentos do IBGE (citados em [n] e listados no fim da página); em caso de dúvida valem os originais.
   Tudo é texto de nó (nunca HTML). Figuras em HTML/CSS (reorganizam-se no celular). JavaScript sem `??` nem `?.`. */
const ENTENDA = (() => {
  const FONTES = [
    { n: 1, t: 'IBGE. Pesquisa Nacional por Amostra de Domicílios Contínua: Notas Metodológicas, volume 1. Rio de Janeiro: IBGE, 2014.',
      url: 'https://ftp.ibge.gov.br/Trabalho_e_Rendimento/Pesquisa_Nacional_por_Amostra_de_Domicilios_continua/Notas_metodologicas/notas_metodologicas.pdf' },
    { n: 2, t: 'IBGE. Nota Técnica: principais diferenças metodológicas entre as pesquisas PME, PNAD e PNAD Contínua (2015).',
      url: 'https://ftp.ibge.gov.br/Trabalho_e_Rendimento/Pesquisa_Nacional_por_Amostra_de_Domicilios_continua/Nota_Tecnica/Nota_Tecnica_Diferencas_Metodologicas_das_pesquisas_PNAD_PME_e_PNAD_Continua.pdf' },
    { n: 3, t: 'IBGE. PNAD Contínua: Glossário (divulgação mensal).',
      url: 'https://ftp.ibge.gov.br/Trabalho_e_Rendimento/Pesquisa_Nacional_por_Amostra_de_Domicilios_continua/Mensal/glossario_pnadc_mensal.pdf' },
    { n: 4, t: 'IBGE. PNAD Contínua, divulgação especial: Medidas de Subutilização da Força de Trabalho no Brasil, 4º trimestre de 2025 (publicado em 20/02/2026).',
      url: 'https://ftp.ibge.gov.br/Trabalho_e_Rendimento/Pesquisa_Nacional_por_Amostra_de_Domicilios_continua/Trimestral/Novos_Indicadores_Sobre_a_Forca_de_Trabalho/pnadc_202504_trimestre_novos_indicadores.pdf' },
    { n: 5, t: 'IBGE. PNAD Contínua: página da pesquisa (apresentação, calendário e resultados).',
      url: 'https://www.ibge.gov.br/estatisticas/sociais/trabalho/17270-pnad-continua.html' },
    { n: 6, t: 'IBGE. PNAD Contínua Trimestral, 2º trimestre de 2026 (Agência de Notícias): definição da proxy de informalidade.',
      url: 'https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/47774-pnad-continua-trimestral-desocupacao-cai-em-13-das-27-ufs-no-2-trimestre-de-2026' },
    { n: 7, t: 'OIT. Resolução I da 19ª Conferência Internacional de Estatísticos do Trabalho (2013): trabalho, ocupação e subutilização da força de trabalho.',
      url: 'http://www.ilo.org/wcmsp5/groups/public/---dgreports/---stat/documents/normativeinstrument/wcms_234036.pdf' },
    { n: 8, t: 'IBGE. PME, PNAD e divulgação mensal da PNAD Contínua (páginas das pesquisas no portal do IBGE).',
      url: 'https://www.ibge.gov.br/estatisticas/sociais/trabalho/9180-pesquisa-mensal-de-emprego.html' },
    { n: 9, t: 'IBGE. SIDRA: Sistema IBGE de Recuperação Automática (tabelas da PNAD Contínua usadas por este programa).', url: 'https://sidra.ibge.gov.br/' },
  ];

  const el = U.el;
  const ref = (...ns) => el('sup', { class: 'ent-ref' }, '[' + ns.join(', ') + ']');
  const p = (...f) => el('p', {}, ...f);
  const b = t => el('b', {}, t);
  const lista = itens => el('ul', {}, ...itens.map(i => el('li', {}, ...(Array.isArray(i) ? i : [i]))));
  const caixaNota = (...f) => el('div', { class: 'ent-nota' }, ...f);
  const card = (titulo, icone, corpo, sub) => MOLDURA.cartao({ titulo, icone, subtitulo: sub, semJpg: true, semCheia: true, desenhar: c => c.append(...corpo) });

  // ------------------------------------------------------------------ linha do tempo (HTML: no celular vira lista)
  function linhaDoTempo() {
    const marcos = [
      ['2006', 'Começam os Fóruns do SIPD, seminários semestrais em que o IBGE discute com os usuários a reformulação das suas pesquisas domiciliares.', [1]],
      ['out/2011', 'Implantação experimental: 20 regiões metropolitanas que contêm a capital, a RIDE Grande Teresina, cinco capitais e o Distrito Federal.', [1]],
      ['jan/2012', 'A pesquisa passa a cobrir todo o território nacional, em caráter definitivo. Até a transição terminar, o IBGE mantém em paralelo a PNAD e a PME.', [1, 2]],
      ['out/2013', 'A 19ª Conferência Internacional de Estatísticos do Trabalho (OIT) adota as recomendações sobre trabalho, ocupação e subutilização que a PNAD Contínua incorpora.', [1, 7]],
      ['2014', 'Notas Metodológicas, volume 1: o IBGE detalha o plano da pesquisa e anuncia os primeiros resultados trimestrais do tema trabalho, para o Brasil e as Grandes Regiões, a partir de 2012.', [1]],
      ['2016', 'Os indicadores de subutilização passam a sair por trimestre. A partir do 2º trimestre, o conceito de pessoa desocupada fica alinhado à 19ª CIET. Com o fim da PME e da PNAD anual, a PNAD Contínua vira a pesquisa domiciliar de referência do mercado de trabalho.', [4, 8]],
    ];
    return el('ol', { class: 'ent-tempo' }, ...marcos.map(m => el('li', {}, el('span', { class: 'ent-data' }, m[0]), el('div', {}, m[1], ' ', ref.apply(null, m[2])))));
  }

  function tabelaComparativa() {
    const cab = ['', 'PME', 'PNAD (anual)', 'PNAD Contínua'];
    const L = [
      ['Cobertura', 'Áreas urbanas de 6 regiões metropolitanas', 'Todo o território nacional', 'Todo o território nacional'],
      ['Divulgação', 'Mensal', 'Anual', 'Trimestral (trabalho e rendimento)'],
      ['Amostra', 'cerca de 40 mil domicílios por mês', 'cerca de 150 mil domicílios por ano', 'cerca de 211 mil domicílios por trimestre'],
      ['Rotação', '4-8-4', 'não tem', '1-2(5): cinco visitas, uma por trimestre'],
      ['Idade mínima', '10 anos', '10 anos', '14 anos'],
    ];
    const t = el('table', { class: 'ent-tabela' }, el('caption', {}, 'Principais diferenças, segundo o IBGE'),
      el('thead', {}, el('tr', {}, ...cab.map(c => el('th', { scope: 'col' }, c)))),
      el('tbody', {}, ...L.map(l => el('tr', {}, el('th', { scope: 'row' }, l[0]), ...l.slice(1).map(x => el('td', {}, x))))));
    return el('div', { class: 'ent-rolagem' }, t);
  }

  // ------------------------------------------------------------------ rotação 1-2(5)
  function figuraRotacao() {
    const nT = 9, grupos = 5, linhas = [];
    const cab = el('tr', {}, el('th', { scope: 'col' }, 'Grupo'), ...Array.from({ length: nT }, (_, i) => el('th', { scope: 'col' }, 'T' + (i + 1))));
    for (let g = 0; g < grupos; g++) linhas.push(el('tr', {}, el('th', { scope: 'row' }, 'Grupo ' + 'ABCDE'.charAt(g)),
      ...Array.from({ length: nT }, (_, i) => el('td', { class: i >= g && i < g + 5 ? 'on' : '', 'aria-label': i >= g && i < g + 5 ? 'visitado' : 'fora da amostra' }, i >= g && i < g + 5 ? String(i - g + 1) : ''))));
    return el('div', { class: 'ent-rolagem' }, el('table', { class: 'ent-rot' }, el('caption', {}, 'Cada grupo de domicílios é visitado em cinco trimestres seguidos (o número é a visita). Em cada trimestre há cinco grupos na amostra; do T5 para o T6, quatro dos cinco se repetem.'),
      el('thead', {}, cab), el('tbody', {}, ...linhas)));
  }

  // ------------------------------------------------------------------ força de trabalho (figura)
  function figuraForcaDeTrabalho() {
    const caixa = (cls, tit, desc, ...dentro) => el('div', { class: 'ent-caixa ' + cls }, el('div', { class: 'ent-tit' }, tit), desc ? el('div', { class: 'ent-desc' }, desc) : null, ...dentro.filter(Boolean));
    return el('figure', { class: 'ent-fig' },
      el('div', { class: 'ent-topo' }, el('b', {}, 'Pessoas em idade de trabalhar'), el('span', {}, ' 14 anos ou mais')),
      el('div', { class: 'ent-seta', 'aria-hidden': 'true' }, '▼'),
      el('div', { class: 'ent-colunas' },
        el('div', { class: 'ent-grupo ent-ft' }, el('h4', {}, 'Na força de trabalho'),
          el('div', { class: 'ent-filhos' },
            caixa('ent-oc', 'Ocupadas', 'Trabalharam pelo menos 1 hora completa na semana, ou estavam afastadas de um trabalho remunerado',
              el('div', { class: 'ent-sub' }, 'Subocupadas por insuficiência de horas: trabalham menos de 40 h, querem e podem trabalhar mais')),
            caixa('ent-de', 'Desocupadas', 'Sem trabalho, procuraram nos últimos 30 dias e estavam disponíveis'))),
        el('div', { class: 'ent-grupo ent-fora' }, el('h4', {}, 'Fora da força de trabalho'),
          el('div', { class: 'ent-filhos' },
            caixa('ent-pot', 'Força de trabalho potencial', 'Não estão ocupadas nem desocupadas, mas poderiam entrar na força de trabalho',
              el('div', { class: 'ent-sub ent-sub2' }, 'Desalentadas: disponíveis, mas não procuraram por achar que não conseguiriam')),
            caixa('ent-demais', 'Demais pessoas', 'Nem ocupadas, nem desocupadas, nem no potencial')))),
      el('figcaption', {}, 'Como o IBGE classifica a população de 14 anos ou mais na semana de referência. Esquema simplificado, feito a partir dos conceitos de ', ref(1, 3, 4), '.'));
  }

  function fluxoClassificacao() {
    const passo = (n, q, sim, nao) => el('li', {}, el('div', { class: 'ent-q' }, el('span', { class: 'ent-n' }, String(n)), q),
      el('div', { class: 'ent-resp' }, el('span', { class: 'ent-sim' }, 'Sim → ', b(sim)), nao ? el('span', { class: 'ent-nao' }, 'Não → ' + nao) : null));
    return el('ol', { class: 'ent-fluxo' },
      passo(1, 'Trabalhou pelo menos uma hora completa na semana de referência em trabalho remunerado (em dinheiro, produtos, mercadorias ou benefícios) ou em ajuda a atividade econômica de morador do domicílio? Ou estava só temporariamente afastada de um trabalho remunerado?', 'ocupada', 'vai para a pergunta 2'),
      passo(2, 'Tomou alguma providência efetiva para conseguir trabalho nos últimos 30 dias e estava disponível para começar na semana de referência? (Quem já tinha conseguido trabalho para começar em menos de quatro meses também conta.)', 'desocupada', 'fora da força de trabalho'));
  }

  function numerosDoBrasil(D) {
    if (!D || !D.series) return null;
    const ult = id => {
      const f = D.series[id] && D.series[id].trimestral, s = f && f['N1|1'];
      if (!s || !s.per || !s.per.length) return null;
      for (let i = s.per.length - 1; i >= 0; i--) if (s.v[i] !== null && s.v[i] !== undefined) return { per: s.per[i], v: s.v[i] };
      return null;
    };
    const part = ult('participacao'), oc = ult('ocupacao'), des = ult('desocupacao');
    if (!part || !oc || !des) return null;
    const rot = per => `${+String(per).slice(4)}º trimestre de ${String(per).slice(0, 4)}`;
    const f1 = v => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
    return { rot: rot(des.per), part: f1(part.v), oc: f1(oc.v), des: f1(des.v) };
  }

  function glossario(itens) {
    return el('dl', { class: 'ent-gloss' }, ...[].concat(...itens.map(i => [el('dt', {}, i[0]), el('dd', {}, ...(Array.isArray(i[1]) ? i[1] : [i[1]]))])));
  }
  const formula = (n, d) => el('span', { class: 'ent-formula' }, n, el('span', { class: 'ent-div' }, ' ÷ '), d, ' × 100');

  // ------------------------------------------------------------------ a página
  function render(cont, D) {
    cont.classList.add('mo-pagina', 'sobre', 'entenda');
    MOLDURA.injetarCss();
    AMBIENTE.cabecalho({ titulo: 'Entenda a PNADC', acoes: [] });
    const nb = numerosDoBrasil(D);

    cont.append(el('div', { class: 'ent-intro' },
      p('A ', b('Pesquisa Nacional por Amostra de Domicílios Contínua (PNAD Contínua)'), ' é a principal fonte oficial do IBGE sobre o mercado de trabalho brasileiro. Esta página conta como ela surgiu, como é feita e o que cada conceito significa, para você ler os números deste programa sabendo de onde eles vêm. Os trechos entre colchetes, como ', ref(1), ', remetem às fontes oficiais listadas no fim.')));

    cont.append(card('O que é a PNAD Contínua', 'info', [
      p('É uma pesquisa por amostra: o IBGE visita uma parte dos domicílios, escolhida por seleção probabilística (cada domicílio tem chance conhecida de ser escolhido), e generaliza o resultado para toda a população. O objetivo é ', b('acompanhar as oscilações trimestrais e a evolução, no médio e no longo prazo, da força de trabalho'), ' e levantar outras informações para o estudo do desenvolvimento socioeconômico do país ', ref(1), '.'),
      p('Os resultados são representativos para o ', b('Brasil, as Grandes Regiões, as Unidades da Federação e as Regiões Metropolitanas que incluem as capitais'), ' ', ref(1), '. A cada trimestre são investigados em torno de ', b('211 mil domicílios'), ', em aproximadamente 16 mil setores censitários ', ref(1), '.'),
      p('O questionário reduzido, com o trabalho que gera rendimento e as características básicas dos moradores, vai a todos os domicílios do trimestre. O questionário ampliado, com outras formas de trabalho (produção para o próprio consumo, trabalho voluntário, cuidado de pessoas e afazeres domésticos), vai a 20% da amostra de cada trimestre e é acumulado para gerar resultados anuais ', ref(1), '.'),
    ]));

    cont.append(card('Como surgiu: a história da pesquisa', 'relogio', [
      p('Até então, o IBGE tinha dois retratos do mercado de trabalho: a ', b('PME'), ', mensal, mas só para seis regiões metropolitanas, e a ', b('PNAD'), ', de todo o país, mas anual. Faltavam, segundo as Notas Metodológicas, indicadores de curto prazo sobre a força de trabalho de todo o país e das Unidades da Federação, cobrados por órgãos de governo, centros de estudo, pesquisadores e organismos internacionais ', ref(1), '. A PNAD Contínua foi criada para somar a cobertura nacional da PNAD à periodicidade da PME.'),
      linhaDoTempo(),
      p('Ela é um dos pilares do ', b('Sistema Integrado de Pesquisas Domiciliares (SIPD)'), ', em que planejamento, coleta e divulgação das pesquisas domiciliares do IBGE são coordenados, com conceitos harmonizados e uma amostra mestra comum ', ref(1, 2), '. Durante o desenvolvimento, o IBGE contou com assistência técnica da OIT ', ref(1), '.'),
      el('h4', { class: 'ent-h4' }, 'As três pesquisas lado a lado'),
      tabelaComparativa(),
      caixaNota(b('Atenção: '), 'o IBGE ressalta que as diferenças de método entre as pesquisas inviabilizam comparar seus resultados diretamente ', ref(2), '. Por isso as séries deste programa começam no 1º trimestre de 2012, quando a PNAD Contínua passou a cobrir o país, e não se emendam com as da PME ou da PNAD anual.'),
    ], 'Da PME e da PNAD anual ao retrato trimestral do país'));

    cont.append(card('Como a amostra é feita', 'pessoas', [
      p('O plano é de ', b('conglomerados em dois estágios'), ', com estratificação ', ref(1), '. No primeiro, selecionam-se unidades primárias de amostragem (UPAs): cada uma é um setor censitário, ou um grupo de setores vizinhos, com pelo menos 60 domicílios particulares permanentes. No segundo, selecionam-se ', b('14 domicílios'), ' em cada UPA, a partir do Cadastro Nacional de Endereços para Fins Estatísticos (CNEFE) ', ref(1), '.'),
      p('Só entram domicílios particulares permanentes. Ficam de fora, por exemplo, aldeias indígenas, quartéis, penitenciárias, asilos, hospitais e embarcações ', ref(1), '.'),
      el('h4', { class: 'ent-h4' }, 'Por que os mesmos domicílios voltam: a rotação 1-2(5)'),
      p('Cada domicílio é visitado ', b('cinco vezes, uma por trimestre'), ', em cinco trimestres consecutivos. É o esquema 1-2(5): o domicílio é entrevistado em um mês, fica dois meses fora e volta, até somar cinco entrevistas ', ref(1), '. Assim, de um trimestre para o seguinte, ', b('80% dos domicílios se repetem'), '; de um trimestre para o mesmo do ano seguinte, 20% ', ref(1), '. A sobreposição melhora a precisão das comparações entre trimestres, porque a covariância entre as duas estimativas reduz a variância da diferença ', ref(1), '.'),
      figuraRotacao(),
      p('Na prática, a amostra é dividida em 15 grupos de rotação: a cada mês do trimestre são pesquisados cinco deles, e ao final os três meses são reunidos para produzir os indicadores ', ref(1), '.'),
    ]));

    cont.append(card('Semana de referência e outros períodos', 'relogio', [
      glossario([
        ['Semana de referência', ['De domingo a sábado, a semana que antecede a semana da entrevista. É nela que se verifica se a pessoa trabalhou. ', ref(1)]],
        ['Período de 30 dias', ['Os 30 dias que terminam no último dia da semana de referência. É o prazo em que se verifica a procura por trabalho. ', ref(1)]],
        ['Mês de referência', ['O mês anterior ao que contém a semana de referência: é dele o rendimento do trabalho. ', ref(1)]],
        ['Trimestre', ['A amostra é coletada ao longo de três meses; as estimativas trimestrais reúnem os três. ', ref(1)]],
      ]),
    ]));

    cont.append(card('O que é "força de trabalho"', 'pessoas', [
      p('Pense em todas as pessoas que têm ', b('14 anos ou mais'), ' (a idade mínima da pesquisa) ', ref(1), '. Nem todas trabalham ou querem trabalhar: há estudantes, pessoas que cuidam da casa, aposentados. A ', b('força de trabalho'), ' é só a parte dessa população que está ', b('ocupada'), ' ou ', b('desocupada'), ': quem tem trabalho e quem não tem, mas procura e pode começar. Todas as demais ficam ', b('fora da força de trabalho'), ' ', ref(1, 3), '.'),
      figuraForcaDeTrabalho(),
      el('h4', { class: 'ent-h4' }, 'Como o IBGE decide em qual grupo cada pessoa entra'),
      fluxoClassificacao(),
      p('Quem não é ocupada nem desocupada fica fora da força de trabalho ', ref(1), '.'),
      nb ? caixaNota(b('Com os números mais recentes do Brasil (' + nb.rot + '): '), 'a taxa de participação foi de ', b(nb.part), ', ou seja, essa parcela de quem tem 14 anos ou mais estava na força de trabalho; o nível da ocupação foi de ', b(nb.oc), ' (ocupadas entre todas as de 14 anos ou mais); e a taxa de desocupação, de ', b(nb.des), ' (desocupadas entre as pessoas da força de trabalho). Números do cache deste programa, publicados pelo IBGE.') : null,
    ], 'Quem conta como ocupada, desocupada ou fora dela'));

    cont.append(card('Os indicadores e como se calculam', 'tabela', [
      glossario([
        ['Taxa de participação na força de trabalho', [formula('pessoas na força de trabalho', 'pessoas em idade de trabalhar'), ' Mede quanto da população em idade de trabalhar está disponível para o mercado. ', ref(1)]],
        ['Nível da ocupação', [formula('pessoas ocupadas', 'pessoas em idade de trabalhar'), ' Mede quanto da população em idade de trabalhar está trabalhando. ', ref(1)]],
        ['Taxa de ocupação', [formula('pessoas ocupadas', 'pessoas na força de trabalho'), ' ', ref(1)]],
        ['Nível da desocupação', [formula('pessoas desocupadas', 'pessoas em idade de trabalhar'), ' ', ref(1)]],
        ['Taxa de desocupação', [formula('pessoas desocupadas', 'pessoas na força de trabalho'), ' É a taxa de "desemprego" da imprensa. Atenção ao denominador: é a força de trabalho, não toda a população. ', ref(1)]],
      ]),
    ]));

    cont.append(card('Desocupação, desalento, subocupação e subutilização', 'rank', [
      p('A taxa de desocupação mostra só quem procurou trabalho e não achou. Para enxergar o que ela deixa de fora, a OIT recomenda medidas complementares, que o IBGE divulga em conjunto: a ', b('subutilização da força de trabalho'), ' ', ref(4, 7), '. Ela reúne três grupos que não se misturam ', ref(4), ':'),
      glossario([
        ['Desocupadas', ['Sem trabalho na semana de referência, com providência efetiva para conseguir um nos últimos 30 dias e disponíveis para assumi-lo na semana de referência. Contam também as que não procuraram porque já haviam conseguido trabalho para começar em menos de quatro meses. Esse limite de quatro meses vale desde o 2º trimestre de 2016, quando o conceito foi ajustado à 19ª CIET; antes, não havia prazo. ', ref(4)]],
        ['Subocupadas por insuficiência de horas', ['Pessoas de 14 anos ou mais que trabalham habitualmente menos de 40 horas, gostariam de trabalhar mais e estavam disponíveis para isso nos 30 dias seguintes ao início da semana de referência. Já estão contadas entre as ocupadas. ', ref(4)]],
        ['Força de trabalho potencial', ['Pessoas de 14 anos ou mais que não estavam ocupadas nem desocupadas, mas poderiam virar força de trabalho: (i) buscaram trabalho, mas não estavam disponíveis na semana de referência; ou (ii) não buscaram, mas gostariam de trabalhar e estavam disponíveis. ', ref(4)]],
        ['Desalentadas', ['Parte da força de trabalho potencial: pessoas fora da força de trabalho que estavam disponíveis para trabalhar, mas não procuraram nos 30 dias por não ter conseguido trabalho adequado, não ter experiência ou qualificação, não haver trabalho na localidade ou ser considerada muito jovem ou muito idosa. ', ref(4)]],
        ['Força de trabalho ampliada', ['A força de trabalho somada à força de trabalho potencial. É o denominador da taxa composta de subutilização e da taxa de desalento. ', ref(4)]],
      ]),
      el('h4', { class: 'ent-h4' }, 'As taxas de subutilização'),
      lista([
        [b('Taxa composta de subutilização: '), '(subocupadas por insuficiência de horas + desocupadas + força de trabalho potencial) ÷ força de trabalho ampliada. ', ref(4)],
        [b('Taxa combinada de desocupação e subocupação por insuficiência de horas: '), '(subocupadas + desocupadas) ÷ força de trabalho. ', ref(4)],
        [b('Taxa combinada de desocupação e força de trabalho potencial: '), '(desocupadas + potencial) ÷ força de trabalho ampliada. ', ref(4)],
        [b('Percentual de desalentados: '), 'desalentadas ÷ pessoas fora da força de trabalho (e, noutra versão, ÷ força de trabalho potencial). ', ref(4)],
      ]),
      caixaNota(b('Por que o desalento não entra na taxa de desocupação? '), 'Porque quem desistiu de procurar não preenche o critério de busca: fica fora da força de trabalho, no grupo do potencial. É por isso que acompanhar só a taxa de desocupação pode subestimar a falta de trabalho; a taxa composta de subutilização mostra um quadro mais completo ', ref(4), '.'),
    ]));

    cont.append(card('Informalidade e rendimento', 'pin', [
      glossario([
        ['Taxa de informalidade', ['O IBGE calcula uma ', el('i', {}, 'proxy'), ' sobre a população ocupada. Entram como informais: empregados do setor privado sem carteira assinada, trabalhadores domésticos sem carteira, empregadores sem CNPJ, trabalhadores por conta própria sem CNPJ e trabalhadores familiares auxiliares. ', ref(6)]],
        ['Rendimento médio real habitual', ['Rendimento bruto médio habitualmente recebido em todos os trabalhos pelos ocupados com rendimento, a preços do mês do meio do trimestre mais recente, deflacionado pelo IPCA. "Habitual" exclui o que não tem caráter contínuo (13º salário, horas extras, bonificações). ', ref(3)]],
      ]),
    ]));

    cont.append(card('Estimativas de amostra: precisão e significância', 'linha', [
      p('Como os números vêm de uma amostra, cada um tem uma margem de incerteza. O IBGE a mede pelo ', b('coeficiente de variação (CV)'), ' e testa, com 95% de confiança, se uma variação entre períodos é ', b('estatisticamente significativa'), '. Variações não significativas são tratadas como estabilidade ', ref(1), '.'),
      p('A variância é estimada pelo método do conglomerado primário (ultimate cluster) com estimadores de razão e linearização de Taylor. Para a diferença entre dois trimestres, entra também a covariância entre eles, que cresce com a sobreposição da amostra ', ref(1), '.'),
      caixaNota(b('No PNADC Resultados: '), 'a cor de uma variação vem sempre da situação que o IBGE publica (significativa, estável ou sem comparação), nunca de um corte calculado aqui, e o CV de cada estimativa fica à vista.'),
    ]));

    cont.append(card('Fontes e referências', 'livro', [
      p('Esta página resume documentos oficiais; os conceitos podem ser atualizados pelo IBGE, e em caso de divergência valem os documentos originais. Este programa não é um produto oficial do IBGE.'),
      el('ol', { class: 'ent-fontes' }, ...FONTES.map(f => el('li', { value: f.n }, f.t + ' ', el('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, f.url)))),
    ]));
  }

  return { render, FONTES };
})();
