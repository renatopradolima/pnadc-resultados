/* SuperC -- gráficos (Chart.js 4 + plugin treemap) e calendário. */
'use strict';

const G = (() => {
  Chart.defaults.font.family = '"Segoe UI", system-ui, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#3c4a42';
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.animation.duration = 300;

  // rótulos de valor no fim das barras / topo das colunas
  const plugRotulos = {
    id: 'rotulosValor',
    afterDatasetsDraw(chart, _a, opts) {
      if (!opts || !opts.ativo) return;
      const { ctx } = chart;
      ctx.save(); ctx.font = '600 11px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = '#2b3a32';
      const horizontal = chart.options.indexAxis === 'y';
      const empilhado = chart.options.scales?.x?.stacked || chart.options.scales?.y?.stacked;
      const visiveis = chart.data.datasets.map((_, k) => k).filter(k => !chart.getDatasetMeta(k).hidden);
      /* Os rótulos são COLETADOS antes de desenhar, e só então escritos, do
         maior valor para o menor, pulando quem colidiria com um já escrito
         (medido em 17/09/2026: 9 gráficos de 6 páginas tinham rótulos
         sobrepostos -- 36 colisões em "Abordagens e realizadas por
         entrevistador"). Número sobreposto não é informação, é borrão: o
         valor exato continua na dica do mouse. Em coluna estreita o texto
         VIRA na vertical antes de ser descartado, que é o que salva a
         maioria dos casos. */
      const pendentes = [];
      const anotar = (el, txt, peso) => pendentes.push({ el, txt, peso });
      if (empilhado && chart.data.datasets.length > 1) {
        /* UM rótulo por categoria -- o TOTAL da pilha --, ancorado no último
           segmento NÃO ZERO. Antes o rótulo saía preso ao último DATASET, e
           bastava a última série valer 0 naquela barra para o número sumir:
           na página Geral com um mês filtrado, 3 das 5 agências e 3 das 4
           semanas ficavam sem total (achado do usuário, 17/09/2026). Com a
           pilha em percentual o total é sempre 100%, então escreve-se o
           total ABSOLUTO (`opts.totais`), que é o que ainda informa. */
        for (let j = 0; j < (chart.data.labels || []).length; j++) {
          let total = 0, ancora = null;
          for (const k of visiveis) {
            const v = chart.data.datasets[k].data[j] || 0;
            total += v;
            const el = chart.getDatasetMeta(k).data[j];
            if (v > 0 && el) ancora = el;
          }
          if (!ancora || !total) continue;
          anotar(ancora, opts.totais ? U.fmtInt(opts.totais[j]) : (opts.formato ? opts.formato(total) : U.fmtInt(total)), total);
        }
      } else {
        for (const i of visiveis) {
          const ds = chart.data.datasets[i];
          chart.getDatasetMeta(i).data.forEach((el, j) => {
            const v = ds.data[j]; if (v === null || v === undefined || v === 0) return;
            anotar(el, opts.formato ? opts.formato(v) : U.fmtInt(v), Math.abs(Number(v) || 0));
          });
        }
      }
      escrever();
      ctx.restore();

      /* Escreve os rótulos coletados, os maiores primeiro, pulando colisões. */
      function escrever() {
        const postos = [];
        const cabe = c => !postos.some(p => c.x0 < p.x1 && p.x0 < c.x1 && c.y0 < p.y1 && p.y0 < c.y1);
        for (const r of pendentes.slice().sort((a, b) => b.peso - a.peso)) {
          const l = ctx.measureText(r.txt).width, alt = 12;
          if (horizontal) {
            const c = { x0: r.el.x + 4, x1: r.el.x + 4 + l, y0: r.el.y - alt / 2, y1: r.el.y + alt / 2 };
            if (!cabe(c)) continue;
            postos.push(c);
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(r.txt, c.x0, r.el.y);
          } else {
            // coluna: primeiro deitado; se o texto for mais largo que a
            // coluna (ou colidir), tenta em pé antes de desistir
            const larg = (r.el.width || 20) + 2;
            const deitado = { x0: r.el.x - l / 2, x1: r.el.x + l / 2, y0: r.el.y - 14, y1: r.el.y - 2 };
            if (l <= larg && cabe(deitado)) {
              postos.push(deitado);
              ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(r.txt, r.el.x, r.el.y - 2);
              continue;
            }
            const empe = { x0: r.el.x - alt / 2, x1: r.el.x + alt / 2, y0: r.el.y - 4 - l, y1: r.el.y - 4 };
            if (!cabe(empe) || empe.y0 < (chart.chartArea ? chart.chartArea.top - 14 : 0)) continue;
            postos.push(empe);
            ctx.save(); ctx.translate(r.el.x, r.el.y - 4); ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(r.txt, 0, 0); ctx.restore();
          }
        }
      }
    },
  };
  Chart.register(plugRotulos);

  const instancias = new WeakMap();
  function canvasEm(cont, classe = 'grafico') {
    const box = U.el('div', { class: classe }); const cv = U.el('canvas'); box.append(cv);
    if (cont) cont.append(box);
    return cv;
  }
  function destruir(cv) { const c = instancias.get(cv); if (c) { c.destroy(); instancias.delete(cv); } }
  /* Cada render troca o conteúdo da página, mas o Chart.js não sabe: o gráfico
     do canvas que saiu do DOM continua em `Chart.instances`, com um
     MutationObserver no documento e a referência aos dados filtrados de
     ANTES. Numa sessão longa a memória só crescia e a tela ia ficando lenta
     -- pior na WebView do celular (revisão de 19/09/2026). O roteador chama
     isto antes de cada render; `dentro` é o contêiner que vai ser esvaziado. */
  function limparOrfaos(dentro) {
    for (const c of Object.values(Chart.instances || {})) {
      const cv = c.canvas;
      if (!cv || !cv.isConnected || (dentro && dentro.contains(cv))) { try { c.destroy(); } catch (_) { /* já destruído */ } if (cv) instancias.delete(cv); }
    }
  }
  function criar(cv, cfg) { destruir(cv); const c = new Chart(cv, cfg); instancias.set(cv, c); return c; }

  /* Altura de gráfico de barra HORIZONTAL: quem manda é o número de
     categorias, nunca uma classe de CSS fixa. Com 30 entrevistadores dentro
     de um `.grafico` de 260 px cada nome ganhava 8 px e eles se escreviam uns
     por cima dos outros -- ilegível, e foi o que o usuário fotografou no
     celular (19/09/2026). A correção existia em três lugares soltos
     (`porDim`, e dois gráficos de `paginas_extra.js`); agora vive AQUI, no
     único ponto por onde toda barra horizontal passa, então gráfico novo
     nasce certo sem ninguém lembrar. Caller que já fixou a altura por
     `style.height` manda (`.style.height` na caixa vence). */
  const ALTURA_MOLDURA = 56;     // eixo de valor + respiro
  // px por barra: poucas categorias ganham respiro, muitas ficam compactas --
  // 27 px ainda cabe o nome em ~12 px de fonte sem encostar no vizinho
  const porBarra = n => (n <= 8 ? 40 : n <= 18 ? 32 : 27);
  function alturaPorCategoria(cv, n) {
    const box = cv.parentNode;
    if (!box || !n || box.dataset.alturaFixa === '1') return;
    box.style.height = Math.max(180, Math.min(1100, ALTURA_MOLDURA + n * porBarra(n))) + 'px';
  }

  /* barras({labels, valores} | {labels, series:[{rotulo, dados, cor}]}, horizontal, empilhado, cores, formato, aoClicar(indice, label), rotulos:true, maxTicks, legenda}) */
  function barras(cv, o) {
    const datasets = o.series ? o.series.map((s, i) => ({ label: s.rotulo, data: s.dados, backgroundColor: s.cor || U.PALETA[i % U.PALETA.length], borderRadius: 3, maxBarThickness: 46, stack: o.empilhado ? 'a' : undefined }))
      : [{ label: o.rotulo || '', data: o.valores, backgroundColor: o.cores || '#1a73e8', borderRadius: 3, maxBarThickness: 46 }];
    const horizontal = !!o.horizontal;
    // Os `callback` de tick só entram quando existem: uma chave presente com
    // valor undefined SUBSTITUI o callback padrão do Chart.js (que devolve o
    // rótulo da categoria) e o eixo passa a mostrar o índice 0, 1, 2...
    const fmtValor = v => o.formato ? o.formato(v) : U.fmtInt(v);
    /* Nome comprido em barra horizontal: o corte é pela LARGURA que o eixo
       pode ocupar, não por um número fixo de caracteres. Cortar em 28 letras
       sempre dava o mesmo tamanho de texto num monitor e num celular de
       390 px -- e no celular esse texto comia o gráfico. "Sacrifique um
       pouco a parte final dos nomes" (pedido do usuário, 19/09/2026): o eixo
       nunca passa de `FATIA_EIXO` da largura, e o que não couber vira "…". */
    const FATIA_EIXO = 0.42;
    const encurta = function (v) {
      const l = String(this.getLabelForValue(v));
      const larg = (this.chart && this.chart.width) || 0;
      if (!larg) return l.length > 28 ? l.slice(0, 27) + '…' : l;
      const ctx = this.ctx;
      const teto = larg * FATIA_EIXO - 12;
      ctx.save();
      try { ctx.font = this._resolveTickFontOptions(0).string; } catch (_) { /* fonte padrão serve */ }
      if (ctx.measureText(l).width <= teto) { ctx.restore(); return l; }
      // busca binária pelo maior prefixo que cabe -- medir letra a letra num
      // eixo de 30 categorias custa caro a cada redesenho
      let lo = 1, hi = l.length;
      while (lo < hi) { const m = Math.ceil((lo + hi) / 2);
        if (ctx.measureText(l.slice(0, m) + '…').width <= teto) lo = m; else hi = m - 1; }
      ctx.restore();
      return l.slice(0, Math.max(1, lo)).trimEnd() + '…';
    };
    /* Categoria escondida é informação perdida em silêncio: numa coluna o
       `autoSkip` do Chart.js sumia com 3 das 4 semanas e com 9 das 18 horas
       em tela estreita (medido em 17/09/2026). Até 30 categorias o eixo
       INCLINA o texto em vez de escondê-lo; acima disso o gráfico já não se
       lê deitado e o `autoSkip` volta, porque aí a alternativa seria um
       borrão. */
    const muitas = (o.labels || []).length > 30;
    const eixoX = { stacked: !!o.empilhado, grid: { display: horizontal }, beginAtZero: true,
      ticks: { autoSkip: horizontal ? false : muitas, maxRotation: horizontal ? 0 : 60, minRotation: 0, autoSkipPadding: 4 } };
    const eixoY = { stacked: !!o.empilhado, grid: { display: !horizontal }, beginAtZero: true, ticks: { autoSkip: false } };
    if (horizontal) {
      eixoX.ticks.callback = fmtValor; eixoY.ticks.callback = encurta;
      /* Achado 19/09/2026, testado num celular de verdade: em tela estreita
         o Chart.js por vezes aloca ao eixo de categorias menos largura do
         que o rótulo (já encurtado por `encurta`) de fato ocupa -- o texto
         nasce cortado À ESQUERDA, sem reticências (medido: "Responsável
         pelo domicílio …" com 156 px de texto ganhando só 146,5 px de
         eixo, e outro rótulo, mais longo, ganhando o MESMO 146,5 px --
         sinal de que não é o texto que decide). `afterFit` mede de
         verdade com o canvas do próprio eixo e corrige; teto de 62% da
         largura do gráfico para as barras não desaparecerem com um nome
         enorme. */
      eixoY.afterFit = scale => {
        const ctx = scale.ctx;
        const fonte = scale._resolveTickFontOptions(0);
        ctx.save();
        ctx.font = fonte.string;
        let maior = 0;
        for (const t of scale.ticks) maior = Math.max(maior, ctx.measureText(String(t.label)).width);
        ctx.restore();
        const necessario = Math.ceil(maior) + 12;
        const teto = scale.chart.width * FATIA_EIXO;
        scale.width = Math.min(Math.max(scale.width, necessario), teto);
      };
      alturaPorCategoria(cv, (o.labels || []).length);
    } else { eixoY.ticks.callback = fmtValor; }
    if (o.maxTicks) eixoX.ticks.maxTicksLimit = o.maxTicks;
    // teto explícito do eixo de VALOR. Sem ele, uma pilha percentual (que
    // fecha em 1) ganhava eixo até 200%: o gerador de ticks do Chart.js
    // preferia passo inteiro e as barras ficavam com metade do comprimento.
    if (o.max !== null && o.max !== undefined) { (horizontal ? eixoX : eixoY).max = o.max; }
    const ch = criar(cv, {
      type: 'bar',
      data: { labels: o.labels, datasets },
      options: {
        indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
        layout: { padding: { right: horizontal ? 40 : 4, top: horizontal ? 0 : 16 } },
        onClick: (_e, els) => { if (o.aoClicar && els.length) o.aoClicar(els[0].index, o.labels[els[0].index], els[0].datasetIndex); },
        onHover: (e, els) => { e.native.target.style.cursor = (o.aoClicar && els.length) ? 'pointer' : 'default'; },
        plugins: {
          legend: { display: o.legenda ?? (!!o.series && o.series.length > 1), position: 'bottom' },
          tooltip: { callbacks: { label: o.tooltipLabel || (c => `${c.dataset.label ? c.dataset.label + ': ' : ''}${o.formato ? o.formato(c.raw) : U.fmtInt(c.raw)}`) } },
          rotulosValor: { ativo: o.rotulos !== false, formato: o.formato, totais: o.totais || null },
        },
        scales: { x: eixoX, y: eixoY },
      },
    });
    if (o.aoClicar) ligarCliqueFaixa(ch, cv, o, horizontal);
    return ch;
  }

  /* O Chart.js só chama `onClick` DENTRO da área de plotagem. Numa barra
     horizontal o nome da categoria fica do lado de fora, e é nele que se
     clica -- o clique morria ali (defeito apontado pelo usuário,
     10/09/2026). Aqui a faixa inteira da categoria passa a valer: rótulo,
     barra e o espaço vazio da linha. O ponteiro vira mãozinha também sobre
     o rótulo, para o clique se anunciar. */
  function ligarCliqueFaixa(chart, cv, o, horizontal) {
    const indiceEm = (x, y) => {
      const a = chart.chartArea; if (!a) return -1;
      if (x >= a.left && x <= a.right && y >= a.top && y <= a.bottom) return -1;  // dentro: o onClick do Chart.js cuida
      if (horizontal ? (y < a.top || y > a.bottom) : (x < a.left || x > a.right)) return -1;
      const eixo = horizontal ? chart.scales.y : chart.scales.x;
      if (!eixo) return -1;
      const i = Math.round(eixo.getValueForPixel(horizontal ? y : x));
      return (i >= 0 && i < o.labels.length) ? i : -1;
    };
    const ponto = ev => { const r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    cv.addEventListener('click', ev => { const [x, y] = ponto(ev); const i = indiceEm(x, y); if (i >= 0) o.aoClicar(i, o.labels[i], null); });
    cv.addEventListener('mousemove', ev => { const [x, y] = ponto(ev); if (indiceEm(x, y) >= 0) cv.style.cursor = 'pointer'; });
  }

  /* COMPOSIÇÃO (pedido do usuário, 10/09/2026): barras empilhadas nascem em
     PERCENTUAL, com um botão para ver os valores absolutos. Em percentual as
     agências se comparam entre si -- Porto Velho tem quatro vezes mais
     domicílios que Vilhena, e na escala absoluta só dava para ler a maior.
     O total absoluto continua escrito na ponta de cada barra, e o modo
     escolhido fica guardado por gráfico.

     Devolve o CARTÃO pronto (título, botão e gráfico), porque o botão
     pertence ao cabeçalho do cartão. */
  const MODO_PADRAO = 'pct';
  /* `padrao` por gráfico (19/09/2026): composição nasce em % -- decisão de
     10/09/2026 e continua valendo para comparar agências de tamanhos
     diferentes. Mas onde a pergunta é de VOLUME ("quantas abordagens houve
     na quinta-feira?"), o percentual esconde justamente o que se quer ver:
     um dia com 3 abordagens e outro com 300 desenham a mesma barra cheia. */
  function modoDe(chave, padrao) {
    try { return (JSON.parse(localStorage.getItem('superc.modoGrafico') || '{}'))[chave] || padrao || MODO_PADRAO; } catch (_) { return padrao || MODO_PADRAO; }
  }
  function guardarModo(chave, modo) {
    try {
      const m = JSON.parse(localStorage.getItem('superc.modoGrafico') || '{}');
      m[chave] = modo; localStorage.setItem('superc.modoGrafico', JSON.stringify(m));
    } catch (_) { /* ignora */ }
  }
  /* Cartão com botão % / nº para QUALQUER gráfico em que a alternância faça
     sentido: `desenhar(cv, modo)` monta o gráfico no modo pedido. */
  function alternavel(o) {
    const cv = canvasEm(null, o.altura || 'grafico');
    const seg = U.seg([{ valor: 'pct', rotulo: '%' }, { valor: 'abs', rotulo: 'nº' }], modoDe(o.chave, o.padrao),
      v => { guardarModo(o.chave, v); o.desenhar(cv, v); });
    const cartao = U.cartao(o.titulo, cv.parentNode, { ajuda: o.ajuda, dir: seg });
    setTimeout(() => o.desenhar(cv, modoDe(o.chave, o.padrao)), 0);
    return cartao;
  }

  function composicao(o) {
    const cv = canvasEm(null, o.altura || 'grafico');
    const totais = o.labels.map((_, j) => U.soma(o.series, s => s.dados[j] || 0));
    /* Ordem das barras. `ordenarPor` aceita o rótulo de uma série (ranqueia
       por ela, do maior para o menor) ou 'total'. Ranquear pela série que
       interessa -- "Realizadas", quase sempre -- põe a melhor agência no
       topo e transforma a pilha num ranking (pedido do usuário, 10/09/2026).
       Categorias com ordem própria (semanas, dias, faixas) NÃO passam
       `ordenarPor`: ali a ordem natural é a informação.
       No modo percentual o rank é pela proporção, no absoluto pelo volume --
       é o que está desenhado que manda. */
    const posicoes = modo => {
      const idx = o.labels.map((_, j) => j);
      if (!o.ordenarPor) return idx;
      // 'total' (ou um rótulo que não exista) ranqueia pelo total da barra
      const serie = o.ordenarPor === 'total' ? null : o.series.find(s => s.rotulo === o.ordenarPor);
      const valor = j => {
        if (!serie) return totais[j];
        const v = serie.dados[j] || 0;
        return modo === 'pct' ? (totais[j] ? v / totais[j] : 0) : v;
      };
      return idx.sort((a2, b2) => valor(b2) - valor(a2) || U.cmp(o.labels[a2], o.labels[b2]));
    };
    const desenhar = modo => {
      const pct = modo === 'pct';
      const ord = posicoes(modo);
      const totaisOrd = ord.map(j => totais[j]);
      barras(cv, {
        labels: ord.map(j => o.labels[j]), horizontal: o.horizontal, empilhado: true, legenda: o.legenda,
        rotulos: o.rotulos, maxTicks: o.maxTicks,
        aoClicar: o.aoClicar ? (k, rot, ds) => o.aoClicar(ord[k], rot, ds) : null,
        series: o.series.map(s => ({ rotulo: s.rotulo, cor: s.cor,
          dados: ord.map(j => pct ? (totais[j] ? (s.dados[j] || 0) / totais[j] : null) : s.dados[j]) })),
        formato: pct ? (v => U.fmtPct(v, 1)) : U.fmtInt,
        max: pct ? 1 : null,
        totais: pct ? totaisOrd : null,
        tooltipLabel: c => {
          const bruto = o.series[c.datasetIndex].dados[ord[c.dataIndex]] || 0;
          return `${c.dataset.label}: ${pct ? `${U.fmtPct(c.raw, 1)} (${U.fmtInt(bruto)})` : `${U.fmtInt(bruto)} (${U.fmtPct(totaisOrd[c.dataIndex] ? bruto / totaisOrd[c.dataIndex] : null, 1)})`}`;
        },
      });
    };
    const modo = modoDe(o.chave);
    const seg = U.seg([{ valor: 'pct', rotulo: '%' }, { valor: 'abs', rotulo: 'nº' }], modo,
      v => { guardarModo(o.chave, v); desenhar(v); });
    const cartao = U.cartao(o.titulo, cv.parentNode, { ajuda: o.ajuda, dir: seg });
    setTimeout(() => desenhar(modoDe(o.chave, o.padrao)), 0);
    return cartao;
  }

  /* DISTRIBUIÇÃO: uma série só, cujas fatias somam o todo (tipos de
     abordagem, grupos A/B/C, faixas de tempo). Mesma regra da composição --
     percentual primeiro, botão para a contagem -- porque a pergunta natural
     é "que parte do total é isso", e a contagem varia com o filtro. */
  function distribuicao(o) {
    const total = U.soma(o.valores);
    return alternavel({ chave: o.chave, titulo: o.titulo, altura: o.altura, ajuda: o.ajuda,
      desenhar: (cv, modo) => {
        const pct = modo === 'pct';
        barras(cv, { labels: o.labels, horizontal: o.horizontal, cores: o.cores, rotulos: o.rotulos,
          aoClicar: o.aoClicar, maxTicks: o.maxTicks,
          valores: pct ? o.valores.map(v => total ? (v || 0) / total : null) : o.valores,
          formato: pct ? (v => U.fmtPct(v, 1)) : U.fmtInt,
          tooltipLabel: c => { const bruto = o.valores[c.dataIndex] || 0;
            return pct ? `${U.fmtPct(c.raw, 1)} (${U.fmtInt(bruto)})` : `${U.fmtInt(bruto)} (${U.fmtPct(total ? bruto / total : null, 1)})`; } });
      } });
  }

  /* MISTO: contagens em barra (eixo da esquerda) e taxas em linha (eixo da
     direita, 0 a 100%). Serve para pôr volume e qualidade no mesmo quadro --
     "fez muito" e "fez bem" são perguntas diferentes, e separá-las em dois
     cartões obrigava o olho a ir e voltar (pedido do usuário, 10/09/2026). */
  function misto(cv, o) {
    const datasets = [
      ...o.barras.map((b, i) => ({ type: 'bar', label: b.rotulo, data: b.dados, backgroundColor: b.cor || U.PALETA[i % U.PALETA.length],
        borderRadius: 3, maxBarThickness: 34, yAxisID: 'y', order: 2 })),
      ...o.linhas.map((l, i) => ({ type: 'line', label: l.rotulo, data: l.dados, borderColor: l.cor || U.PALETA[i % U.PALETA.length],
        backgroundColor: (l.cor || U.PALETA[i % U.PALETA.length]) + '22', borderWidth: 3, tension: .25,
        pointRadius: 5, pointHoverRadius: 8, pointBackgroundColor: l.cor, spanGaps: true, yAxisID: 'y1', order: 1 })),
    ];
    const pct = v => U.fmtPct(v, 1);
    return criar(cv, {
      type: 'bar',
      data: { labels: o.labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 18 } },
        onClick: (_e, els) => { if (o.aoClicar && els.length) o.aoClicar(els[0].index, o.labels[els[0].index]); },
        onHover: (e, els) => { e.native.target.style.cursor = (o.aoClicar && els.length) ? 'pointer' : 'default'; },
        plugins: {
          legend: { display: true, position: 'bottom' },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.dataset.yAxisID === 'y1' ? pct(c.raw) : U.fmtInt(c.raw)}` } },
          rotulosValor: { ativo: false },
        },
        scales: {
          x: { grid: { display: false }, ticks: { autoSkip: false } },
          y: { position: 'left', beginAtZero: true, ticks: { callback: U.fmtInt },
               title: { display: true, text: o.tituloEsq || 'quantidade', color: '#5a6a60', font: { size: 10 } } },
          y1: { position: 'right', beginAtZero: true, max: 1, grid: { drawOnChartArea: false },
                ticks: { callback: pct },
                title: { display: true, text: o.tituloDir || 'percentual', color: '#5a6a60', font: { size: 10 } } },
        },
      },
    });
  }

  /* `parciais`: índices de pontos apoiados numa base incompleta (mês ainda
     em coleta). O traço até eles fica pontilhado e o ponto vira um círculo
     vazado -- o número existe, mas não se compara com os demais. */
  /* FAIXAS DE SEMANA (04/11/2026, página Prognóstico). `o.faixas` = [{de, ate, titulo, curto, sub,
     corSub, cor, corTab}] (índices do eixo) pinta uma faixa de fundo por semana, com uma ABA no alto
     que diz qual é a semana, as datas e (em `sub`) o que se mede nela; `o.marcas` = [{i, texto}]
     traça uma linha vertical (ex.: "dados até 03/11"). Os textos que não cabem na largura da faixa
     caem para a versão curta, nunca se sobrepõem. O gráfico continua sendo de UM mês: a semana 4 de
     um mês cai nos mesmos dias da semana 1 do seguinte. */
  const ALT_ABA = 40;
  function pluginFaixas(o) {
    const cabe = (ctx, textos, largura) => { for (const t of textos) if (t && ctx.measureText(t).width <= largura - 8) return t; return ''; };
    const geom = chart => {
      const x = chart.scales.x, n = o.labels.length;
      const passo = n > 1 ? (x.getPixelForValue(n - 1) - x.getPixelForValue(0)) / (n - 1) : chart.chartArea.width;
      return { x, passo };
    };
    return { id: 'faixasSemana',
      beforeDatasetsDraw(chart) {
        const { ctx, chartArea: a } = chart, { x, passo } = geom(chart);
        ctx.save();
        ctx.beginPath(); ctx.rect(a.left, a.top - ALT_ABA, a.width, a.height + ALT_ABA); ctx.clip();
        for (const f of o.faixas || []) {
          const x0 = x.getPixelForValue(f.de) - passo / 2, x1 = x.getPixelForValue(f.ate) + passo / 2;
          ctx.fillStyle = f.cor; ctx.fillRect(x0, a.top, x1 - x0, a.height);
          ctx.fillStyle = f.corTab; ctx.fillRect(x0 + 1, a.top - ALT_ABA, x1 - x0 - 2, ALT_ABA - 3);
        }
        ctx.restore();
      },
      afterDatasetsDraw(chart) {
        const { ctx, chartArea: a } = chart, { x, passo } = geom(chart);
        ctx.save();
        ctx.beginPath(); ctx.rect(a.left - 2, a.top - ALT_ABA, a.width + 4, a.height + ALT_ABA); ctx.clip();
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
        for (const f of o.faixas || []) {
          const x0 = x.getPixelForValue(f.de) - passo / 2, x1 = x.getPixelForValue(f.ate) + passo / 2;
          const xc = (Math.max(x0, a.left) + Math.min(x1, a.right)) / 2, larg = Math.min(x1, a.right) - Math.max(x0, a.left);
          ctx.font = '700 12px sans-serif'; ctx.fillStyle = '#1b2a41';
          ctx.fillText(cabe(ctx, [f.titulo, f.curto], larg), xc, a.top - ALT_ABA + 15);
          if (f.sub) { ctx.font = '600 11px sans-serif'; ctx.fillStyle = f.corSub || '#3d4f66'; ctx.fillText(cabe(ctx, [].concat(f.sub), larg), xc, a.top - 9); }
        }
        for (const m of o.marcas || []) {
          const px = x.getPixelForValue(m.i);
          ctx.setLineDash([4, 3]); ctx.strokeStyle = m.cor || '#37474f'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke(); ctx.setLineDash([]);
          ctx.font = '700 11px sans-serif'; const w = ctx.measureText(m.texto).width + 10;
          const lado = px - w - 4 >= a.left ? -1 : 1, bx = lado < 0 ? px - w - 4 : px + 4;
          ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(bx, a.top + 5, w, 17);
          ctx.fillStyle = m.cor || '#37474f'; ctx.textAlign = 'left'; ctx.fillText(m.texto, bx + 5, a.top + 17); ctx.textAlign = 'center';
        }
        ctx.restore();
      } };
  }
  function linha(cv, o) {
    const parcial = i => !!(o.parciais && o.parciais.includes(i));
    return criar(cv, {
      type: 'line',
      plugins: o.faixas || o.marcas ? [pluginFaixas(o)] : [],
      data: { labels: o.labels, datasets: o.series.map((s, i) => { const cor = s.cor || U.PALETA[i % U.PALETA.length];
        return { label: s.rotulo, data: s.dados, borderColor: cor, backgroundColor: cor + '33', tension: .25, fill: s.preencher || false,
          pointRadius: s.raios || o.labels.map((_, j) => (parcial(j) ? (o.aoClicar ? 6 : 4) : (o.aoClicar ? 5 : 3))),
          pointBackgroundColor: o.labels.map(( _, j) => (parcial(j) ? '#fff' : cor)),
          pointBorderColor: cor, pointBorderWidth: 2, pointHoverRadius: 7, spanGaps: true,
          borderDash: s.tracejado ? [5, 4] : undefined,
          segment: o.parciais ? { borderDash: ctx => (parcial(ctx.p0DataIndex) || parcial(ctx.p1DataIndex)) ? [6, 4] : (s.tracejado ? [5, 4] : undefined) } : undefined };
      }) },
      options: { responsive: true, maintainAspectRatio: false,
        // clicar num ponto (ou na vertical dele) filtra aquele período
        onClick: (_e, els, chart) => {
          if (!o.aoClicar) return;
          if (els.length) return o.aoClicar(els[0].index, o.labels[els[0].index], els[0].datasetIndex);
          const p = chart.scales.x.getValueForPixel(_e.x);
          const i = Math.round(p);
          if (i >= 0 && i < o.labels.length) o.aoClicar(i, o.labels[i], null);
        },
        onHover: (e, els, chart) => { e.native.target.style.cursor = o.aoClicar ? 'pointer' : 'default'; },
        plugins: { legend: { display: o.legenda ?? o.series.length > 1, position: 'bottom' },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${o.formato ? o.formato(c.raw) : U.fmtInt(c.raw)}`,
            afterBody: o.rodapeDica ? (its => o.rodapeDica(its[0].dataIndex)) : undefined } } },
        scales: { y: Object.assign({ beginAtZero: o.doZero !== false, ticks: { callback: v => (o.formatoEixo || o.formato) ? (o.formatoEixo || o.formato)(v) : U.fmtInt(v) } }, o.max !== undefined ? { max: o.max } : {}),
          x: { ticks: Object.assign({ maxRotation: 0 }, o.autoSkipX ? { autoSkip: true, autoSkipPadding: 6 } : {}) } },
        layout: o.faixas || o.marcas ? { padding: { top: ALT_ABA + 4 } } : undefined },
    });
  }

  function rosca(cv, o) {
    return criar(cv, {
      type: 'doughnut',
      data: { labels: o.labels, datasets: [{ data: o.valores, backgroundColor: o.cores, borderWidth: 1 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: o.cutout || '55%',
        onClick: (_e, els) => { if (o.aoClicar && els.length) o.aoClicar(els[0].index, o.labels[els[0].index]); },
        plugins: { legend: { position: o.legendaPos || 'right', labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: c => { const t = c.dataset.data.reduce((a, b) => a + b, 0); return `${c.label}: ${U.fmtInt(c.raw)} (${U.fmtPct(c.raw / t)})`; } } } } },
    });
  }

  /* treemap({itens:[{rotulo, valor, cor}], aoClicar(item)}) */
  function treemap(cv, o) {
    const total = U.soma(o.itens, i => i.valor);
    return criar(cv, {
      type: 'treemap',
      data: { datasets: [{
        tree: o.itens, key: 'valor',
        backgroundColor: c => c.raw ? (c.raw._data.cor || '#999') : '#ccc', borderWidth: 1.5, borderColor: '#fff', spacing: 1,
        labels: { display: true, align: 'left', position: 'top', color: '#fff', font: [{ size: 13, weight: '700' }, { size: 11 }],
          formatter: c => c.raw ? [c.raw._data.rotulo, `${U.fmtInt(c.raw.v)} · ${U.fmtPct(c.raw.v / total)}`] : '', overflow: 'hidden' },
      }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: it => it[0].raw._data.rotulo, label: it => `${U.fmtInt(it.raw.v)} (${U.fmtPct(it.raw.v / total)})` } } },
        onClick: (_e, els) => { if (o.aoClicar && els.length) o.aoClicar(els[0].element.$context.raw._data); },
        onHover: (e, els) => { e.native.target.style.cursor = (o.aoClicar && els.length) ? 'pointer' : 'default'; } },
    });
  }

  /* medidor({valor, min, max, cor, formato}) -- meia rosca com o valor no centro */
  /* Medidor: o ponteiro é um valor só, mas o cartão inteiro pode levar a um
     filtro (ex.: "distância fora do setor" -> filtrar o que está fora). */
  function medidor(cv, o) {
    if (o.aoClicar) {
      cv.style.cursor = 'pointer';
      cv.addEventListener('click', () => o.aoClicar());
      cv.title = o.dica || 'clique para filtrar';
    }
    const v = o.valor ?? 0; const min = o.min ?? 0; const max = o.max ?? Math.max(v * 1.6, 1);
    const frac = U.clamp((v - min) / (max - min || 1), 0, 1);
    const plugCentro = { id: 'centro', afterDraw(chart) { const { ctx, chartArea } = chart; ctx.save(); ctx.textAlign = 'center'; ctx.font = '800 24px "Segoe UI", system-ui'; ctx.fillStyle = '#12408f'; ctx.fillText(o.formato ? o.formato(v) : U.fmtInt(v), (chartArea.left + chartArea.right) / 2, chartArea.bottom - 6); ctx.font = '11px "Segoe UI", system-ui'; ctx.fillStyle = '#5a6a60'; ctx.textAlign = 'left'; ctx.fillText(o.formato ? o.formato(min) : U.fmtInt(min), chartArea.left + 4, chartArea.bottom + 12); ctx.textAlign = 'right'; ctx.fillText(o.formato ? o.formato(max) : U.fmtInt(max), chartArea.right - 4, chartArea.bottom + 12); ctx.restore(); } };
    return criar(cv, {
      type: 'doughnut',
      data: { datasets: [{ data: [frac, 1 - frac], backgroundColor: [o.cor || '#1a73e8', '#e5eae2'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, rotation: -90, circumference: 180, cutout: '68%', layout: { padding: { bottom: 14 } }, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
      plugins: [plugCentro],
    });
  }

  /* calendário semanal: linhas = semanas (domingo a sábado), colunas = dias; célula colorida pela contagem.
     calendario({dias: Map('AAAA-MM-DD' -> n), inicio, fim, semanasColeta:[{semana, inicio, fim}], aoClicar(data), diaSel}) */
  /* Calendário de dias, com SUBDIVISÃO POR TURNO opcional (pedido do
     usuário, 19/09/2026: "as linhas devem ser subdivididas para mostrar os
     totais por turno"). É a pergunta do protocolo de supervisão: antes de
     dar um domicílio por fechado exige-se visita em turnos DIFERENTES, e o
     total do dia não diz se as 161 abordagens foram todas de manhã.

     `turnos` = lista de turnos a subdividir (vazia = só o total, como antes);
     `porTurno` = Map com chave `data|turno`. Cada turno vira uma linha
     abaixo da linha do total, na PRÓPRIA cor (as do `U.TURNOS`), com a
     intensidade proporcional ao maior valor DE TURNO -- não ao maior total
     do dia, senão a linha da noite ficaria sempre quase branca e justamente
     ela é a que se vai olhar. Cor diferente por linha evita que as duas
     escalas -- a azul do total e a do turno -- sejam lidas como uma só. */
  function calendario(o) {
    /* DOIS MODOS, NUNCA OS DOIS DE UMA VEZ (pedido do usuário, 19/09/2026:
       "não é pra mostrar simultaneamente a soma por dia e os subtotais por
       turno; uma chave alterna"). Mostrar os dois junto dobrava a altura da
       grade e ainda convidava a uma conta que a tela já tinha feito -- ler o
       total e conferir se os turnos fecham com ele.
         'dia'   -> uma linha por semana: número do dia e o total, mapa de
                    calor azul. É o calendário de sempre.
         'turno' -> uma linha FINA com os números dos dias (orientação, sem
                    valor) e uma linha por turno ligado, na cor do turno.
       No modo 'turno' o total do dia NÃO aparece: quem quer o total troca a
       chave. */
    const turnos = o.turnos || [];
    const comTurno = o.modo === 'turno' && turnos.length > 0;
    const t = U.el('table', { class: 'calendario' + (comTurno ? ' com-turno' : '') });
    const thead = U.el('thead', {}, U.el('tr', {}, U.el('th', {}, 'Semana'),
      comTurno ? U.el('th', { class: 'turno-cab' }, '') : null,
      ...U.DIA_SEMANA.map(d => U.el('th', {}, d[0].toUpperCase() + d.slice(1)))));
    t.append(thead);
    const tb = U.el('tbody');
    const valores = [...o.dias.values()]; const max = Math.max(1, ...valores);
    const porTurno = o.porTurno || new Map();
    const maxTurno = Math.max(1, ...[...porTurno.values()]);
    let d = new Date(o.inicio + 'T00:00:00'); d.setDate(d.getDate() - d.getDay());
    const fim = new Date(o.fim + 'T00:00:00');
    const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    let n = 0;
    while (d <= fim && n < 12) {
      const tr = U.el('tr', { class: comTurno ? 'linha-dias' : 'linha-total' });
      const ini = iso(d); const fimSem = new Date(d); fimSem.setDate(fimSem.getDate() + 6);
      const sc = (o.semanasColeta || []).find(s => s.inicio === ini);
      const rot = sc ? `Semana ${String(sc.semana).padStart(2, '0')}` : `Semana`;
      const cSem = U.el('td', { class: 'sem' }, rot, U.el('small', {}, `${U.fmtData(ini).slice(0, 5)} a ${U.fmtData(iso(fimSem)).slice(0, 5)}`));
      if (comTurno) cSem.rowSpan = 1 + turnos.length;
      tr.append(cSem);
      if (comTurno) tr.append(U.el('td', { class: 'turno-rot dias' }, ''));
      const diasDaSemana = [];
      for (let i = 0; i < 7; i++) {
        const k = iso(d); const v = o.dias.get(k) || 0;
        diasDaSemana.push(k);
        const foraMes = o.mesRef && k.slice(0, 7) !== o.mesRef ? ' foraMes' : '';
        const sel = k === o.diaSel ? ' sel' : '';
        if (comTurno) {
          // linha fina, só o número do dia: orientação, não dado
          tr.append(U.el('td', {}, U.el('div', { class: 'dia so-num' + sel + foraMes,
            title: `${U.fmtData(k)}: ${U.fmtInt(v)} no dia`, onclick: () => o.aoClicar && o.aoClicar(k) },
            U.el('div', { class: 'num' }, d.getDate()))));
        } else {
          const fundo = v ? U.corEscala(0.15 + 0.85 * v / max, o.escala || 'azul') : '#fff';
          const cel = U.el('div', { class: 'dia' + sel + foraMes, style: { background: fundo, color: v ? U.corTextoPara(fundo) : 'inherit' }, title: `${U.fmtData(k)}: ${U.fmtInt(v)}`, onclick: () => o.aoClicar && o.aoClicar(k) },
            U.el('div', { class: 'num' }, d.getDate()), U.el('div', { class: 'qtd' }, v ? U.fmtInt(v) : ''));
          tr.append(U.el('td', {}, cel));
        }
        d.setDate(d.getDate() + 1);
      }
      tb.append(tr);
      for (const tu of (comTurno ? turnos : [])) {
        const trT = U.el('tr', { class: 'linha-turno' });
        trT.append(U.el('td', { class: 'turno-rot', style: { borderLeft: `3px solid ${tu.cor}` } }, tu.rotulo));
        for (const k of diasDaSemana) {
          const v = porTurno.get(k + '|' + tu.nome) || 0;
          const alfa = v ? 0.16 + 0.74 * (v / maxTurno) : 0;
          const cel = U.el('div', { class: 'dia turno' + (k === o.diaSel ? ' sel' : '') + (o.mesRef && k.slice(0, 7) !== o.mesRef ? ' foraMes' : ''),
            style: { background: v ? corAlfa(tu.cor, alfa) : '#fff' },
            title: `${U.fmtData(k)} · ${tu.rotulo}: ${U.fmtInt(v)}`,
            onclick: () => o.aoClicar && o.aoClicar(k) }, U.el('div', { class: 'qtd' }, v ? U.fmtInt(v) : ''));
          trT.append(U.el('td', {}, cel));
        }
        tb.append(trT);
      }
      n++;
    }
    t.append(tb);
    return t;
  }
  function corAlfa(hex, a) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return hex;
    return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a.toFixed(3)})`;
  }

  return { canvasEm, destruir, limparOrfaos, modoDe, guardarModo, barras, composicao, distribuicao, alternavel, misto, linha, rosca, treemap, medidor, calendario };
})();
