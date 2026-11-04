/* PNADC Resultados -- casca do arquivo autônomo: AMBIENTE (o que o núcleo pede ao hospedeiro), roteador de
   hash (#/publicacoes?sec=..., #/sobre), menu, seletor de UF, avisos de armazenamento e a página "Sobre".
   Dono: PNADC_Resultados (só da casca). Usa o kit do SuperC (U, G, Chart) e o núcleo. Sem `??` nem `?.`. */
'use strict';

const AMBIENTE = (() => {
  function toast(msg, tipo, ms) {
    const caixa = document.getElementById('toasts');
    if (!caixa) return;
    const t = U.el('div', { class: 'toast ' + (tipo || '') }, msg);
    caixa.append(t);
    setTimeout(() => t.remove(), ms || 4500);
  }
  return {
    superc: false,
    menuTemAreas: true,
    produto: 'PNADC Resultados',
    // sem login e sem perfis: o rascunho de release fica guardado neste navegador, em nome de "local"
    login: () => 'local',
    podeGerar: () => true,
    toast,
    renderizar: () => CASCA.renderizar(),
    /* a faixa "Última conferência com o IBGE…" mora na barra lateral, acima do rodapé (a página só entrega o elemento) */
    /* cabeçalho único: a barra verde do alto da casca leva o título da página e as ações (a página não desenha outro) */
    cabecalho: opc => {
      const t = document.getElementById('cab-pagina'), a = document.getElementById('cab-acoes');
      if (t) t.textContent = opc.titulo;
      if (a) a.replaceChildren(...(opc.acoes || []).filter(Boolean));
    },
    mostrarStatus: el => { const alvo = document.getElementById('nav-status'); if (alvo) alvo.replaceChildren(el); }
  };
})();

const CASCA = (() => {
  let paginaAtual = null;

  /* Contato do mantenedor, só para receber indicação de erros e sugestões (pedido do usuário, 04/11/2026). O corpo do
     e-mail leva apenas a versão do programa: nenhum dado da pessoa nem do navegador vai no link. */
  const CONTATO = 'renatoprado.lima@gmail.com';
  function linkContato(texto, estilo) {
    const v = typeof VERSAO_NUCLEO !== 'undefined' ? VERSAO_NUCLEO : '?';
    const href = 'mailto:' + CONTATO + '?subject=' + encodeURIComponent('PNADC Resultados: erro ou sugestão') +
      '&body=' + encodeURIComponent('Versão do programa: ' + v + '\n\nDescreva o erro (o que você fez e o que apareceu) ou a sugestão:\n');
    return U.el('a', { href, title: 'Enviar indicação de erro ou sugestão para ' + CONTATO, style: estilo || null }, texto || CONTATO);
  }

  function rota() {
    const h = location.hash || '#/publicacoes?sec=uf';
    const m = /^#\/([\w-]+)(\?(.*))?$/.exec(h);
    return { pagina: m ? m[1] : 'publicacoes', query: m && m[3] ? new URLSearchParams(m[3]) : new URLSearchParams() };
  }

  // ------------------------------------------------------------------ páginas
  function paginaSobre(cont) {
    const arm = FONTE.armazenamento();
    const u = FONTE.uf();
    const li = (...f) => U.el('li', { style: { margin: '4px 0', lineHeight: '1.5' } }, ...f);
    const ul = (...itens) => U.el('ul', { style: { margin: 0, paddingLeft: '18px' } }, ...itens);
    const cartaoSobre = (titulo, icone, corpo) => MOLDURA.cartao({ titulo, icone, semJpg: true, semCheia: true, desenhar: c => c.append(corpo) });
    cont.classList.add('mo-pagina', 'sobre');
    AMBIENTE.cabecalho({ titulo: 'Sobre o programa', acoes: [] });
    cont.append(cartaoSobre('O que é', 'info', U.el('div', {},
      U.el('p', { style: { marginTop: 0 } }, 'Mostra, para o Brasil, as Grandes Regiões, a UF escolhida, a capital e a região metropolitana, os resultados que o IBGE divulga da PNAD Contínua: tabelas, gráficos e texto, com a significância publicada de cada variação e o coeficiente de variação sempre à vista. Avisa quando sai publicação nova e gera releases (texto, imagem e PDF) com um assistente de 10 passos.'),
      U.el('p', {}, 'Os números NÃO são calculados aqui: são os que o IBGE publica. A cor de uma variação vem da situação que o IBGE informa (estável ou significativa), nunca de um corte inventado.'),
      U.el('p', { style: { marginBottom: 0 } }, 'Cada gráfico e cada tabela pode ser aberto em tela cheia, baixado como imagem JPG e, onde faz sentido, alternado entre quantidade e percentual. O botão ', U.el('b', {}, 'Apresentar'), ' mostra os resultados em slides e o botão ', U.el('b', {}, 'PDF'), ' baixa o relatório.'))));
    cont.append(cartaoSobre('De onde vêm os dados e o que sai do seu computador', 'relogio', ul(
      li('Fonte única: a API pública de agregados do IBGE (servicodados.ibge.gov.br), a mesma base do SIDRA. Sem chave, sem login.'),
      li('Os pedidos ao IBGE saem só quando você abre a página com o cache vencido ou aperta "Atualizar com o IBGE": no máximo uma consulta por tabela a cada 12 horas. Se a rede falha, nada é apagado e o programa espera 15 minutos antes de tentar de novo.'),
      li('Não há servidor nem dado pessoal. Tudo o que é baixado fica guardado neste navegador.'),
      li('A primeira abertura baixa as 16 tabelas (de alguns segundos a poucos minutos, com a página se atualizando sozinha); depois só confere se há período novo.'))));
    cont.append(cartaoSobre('Esta cópia', 'pin', ul(
      li('Versão do núcleo: ', U.el('b', {}, typeof VERSAO_NUCLEO !== 'undefined' ? VERSAO_NUCLEO : '?'),
        typeof CONSTRUCAO !== 'undefined' && CONSTRUCAO.data ? ` · arquivo gerado em ${CONSTRUCAO.data}` : ''),
      li('UF em destaque: ', u.codigo ? U.el('b', {}, `${u.nome} (${u.sigla})`) : 'escolha uma no alto da página', u.codigo ? ' — troque no alto da página.' : '.'),
      li('Armazenamento do cache: ', U.el('b', {}, arm.tipo === 'indexedDB' ? 'IndexedDB (completo)' : arm.tipo === 'localStorage' ? 'localStorage (pequeno)' : arm.tipo === 'memoria' ? 'só memória (some ao fechar a aba)' : 'ainda abrindo…'),
        arm.aviso ? ' — ' + arm.aviso : ''),
      li('Funciona no Edge e no Chrome. Firefox e Safari restringem o armazenamento de arquivos abertos do disco: o programa avisa e segue só com a memória.'),
      li('Este programa não é um produto oficial do IBGE.'))));
    cont.append(cartaoSobre('Erros e sugestões', 'texto', U.el('p', { style: { margin: 0 } },
      'Encontrou um erro ou tem uma sugestão? Escreva para ', linkContato(), ' (o e-mail já sai com a versão desta cópia).')));
  }

  const PAGINAS_CASCA = {
    publicacoes: { render(cont, F, q) { PUBLICACOES.render(cont, F, q); }, sair() { PUBLICACOES.sair(); } },
    entenda: { render(cont) { cont.classList.remove('sobre'); ENTENDA.render(cont, typeof PUBLICACOES !== 'undefined' ? PUBLICACOES.dados() : null); }, sair() { document.getElementById('conteudo').classList.remove('entenda'); } },
    sobre: { render(cont) { paginaSobre(cont); }, sair() {} }
  };

  // ------------------------------------------------------------------ desenho
  function marcarMenu(pagina, query) {
    const sec = query.get('sec') || '';
    const ativa = pagina === 'publicacoes' ? (sec === 'release' ? 'release' : sec === 'comparar' ? 'comparar' : 'publicacoes') : pagina;
    document.querySelectorAll('#nav a[data-pagina]').forEach(a => a.classList.toggle('ativo', a.dataset.pagina === ativa));
  }

  function renderizar() {
    const { pagina, query } = rota();
    const cont = document.getElementById('conteudo');
    const pg = PAGINAS_CASCA[pagina] || PAGINAS_CASCA.publicacoes;
    const nome = PAGINAS_CASCA[pagina] ? pagina : 'publicacoes';
    marcarMenu(nome, query);
    if (paginaAtual && paginaAtual !== nome && PAGINAS_CASCA[paginaAtual]) PAGINAS_CASCA[paginaAtual].sair();
    paginaAtual = nome;
    cont.replaceChildren();
    try {
      pg.render(cont, null, query);
    } catch (e) {
      console.error(e);
      cont.append(U.el('div', { class: 'aviso erro' }, 'Não consegui desenhar esta página: ' + e.message));
    }
    U.ligarDicas(cont);
    atualizarSeletorPublicacao();
    // a página carrega o cache de forma assíncrona: refaz o seletor quando os dados chegam
    setTimeout(atualizarSeletorPublicacao, 1200);
  }

  function desenharAvisoArmazenamento() {
    const arm = FONTE.armazenamento();
    const el = document.getElementById('aviso-armazenamento');
    if (!el) return;
    el.replaceChildren();
    if (arm.aviso) { el.append(U.el('div', { class: 'aviso erro', style: { margin: '8px 16px 0' } }, arm.aviso + '.')); el.hidden = false; }
    else el.hidden = true;
  }

  /* Uma linha de instrução na primeira vez (some ao "Entendi"; lembrado no navegador, sem depender dele). */
  const CHAVE_DICA = 'pnadc.dica_uso';
  function dicaDeUso() {
    const el = document.getElementById('dica-uso');
    let vista = false;
    try { vista = localStorage.getItem(CHAVE_DICA) === '1'; } catch (e) { vista = false; }
    if (!el || vista) return;
    const b = U.el('button', { class: 'mo-btn', type: 'button', title: 'Dispensar esta dica', 'aria-label': 'Dispensar esta dica' }, MOLDURA.icone('fechar', 14));
    b.onclick = () => { el.hidden = true; try { localStorage.setItem(CHAVE_DICA, '1'); } catch (e) { /* vale nesta aba */ } };
    el.replaceChildren(MOLDURA.icone('info', 15), U.el('span', {}, 'Primeira vez? Os números vêm direto do IBGE e ficam guardados neste navegador (a primeira abertura leva alguns segundos). Escolha a UF e a publicação no alto; "Gerar release" e "Comparar períodos" estão no menu.'), b);
    el.hidden = false;
  }

  function seletorUf() {
    const sel = document.getElementById('seletor-uf');
    sel.append(U.el('option', { value: '' }, 'Nenhuma'));
    FONTE.ufs().forEach(u => sel.append(U.el('option', { value: u.codigo }, `${u.nome} (${u.sigla})`)));
    sel.value = FONTE.uf().codigo;
    sel.addEventListener('change', () => {
      sel.disabled = true;
      FONTE.definirUf(sel.value).then(() => {
        PUBLICACOES.sair();       // volta a ler o cache com a UF nova (e a baixar capitais dela, se faltarem)
        renderizar();
      }, e => AMBIENTE.toast('Não consegui trocar a UF: ' + e.message, 'erro', 6000)).then(() => { sel.disabled = false; });
    });
  }

  /* Seletor da PUBLICAÇÃO em análise (ao lado da UF): "Última" por padrão; as passadas vêm dos trimestres que o cache tem. */
  function atualizarSeletorPublicacao() {
    const sel = document.getElementById('seletor-publicacao'), D = PUBLICACOES.dados();
    if (!sel || !D) return;
    const s = ((D.series.desocupacao || {}).trimestral || {})['N1|1'];
    const pers = s ? s.per.filter((p, i) => s.v[i] !== null && s.v[i] !== undefined).slice().reverse() : [];
    const atual = FONTE.publicacao() || '';
    const chave = pers.join(',') + '|' + atual;
    if (sel.dataset.chave === chave) return;
    sel.dataset.chave = chave;
    const rot = p => `${+p.slice(4)}º tri ${p.slice(0, 4)}`;
    sel.replaceChildren(U.el('option', { value: '' }, pers.length ? `Última (${rot(pers[0])})` : 'Última'), ...pers.slice(1).map(p => U.el('option', { value: p }, rot(p))));
    sel.value = pers.indexOf(atual) > 0 ? atual : '';
  }
  function seletorPublicacao() {
    const sel = document.getElementById('seletor-publicacao');
    sel.addEventListener('change', () => {
      FONTE.definirPublicacao(sel.value);
      PUBLICACOES.sair();          // a página volta a ler com a publicação escolhida
      renderizar();
    });
  }

  function ligarMenu() {
    const corpo = document.body, btn = document.getElementById('btn-menu');
    const eGaveta = () => window.innerWidth <= 1000;
    const marcar = () => {
      const gaveta = eGaveta(), recolhido = corpo.classList.contains('menu-recolhido');
      const aberto = gaveta ? corpo.classList.contains('menu-aberto') : !recolhido;
      btn.replaceChildren(U.icone(gaveta ? 'menu' : (recolhido ? 'painel_abrir' : 'painel_recolher'), 20));
      btn.title = gaveta ? (aberto ? 'Fechar o menu' : 'Abrir o menu') : (recolhido ? 'Abrir o menu lateral' : 'Recolher o menu lateral (só os ícones)');
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-expanded', String(aberto));
    };
    window.addEventListener('resize', U.debounce(marcar, 150));
    btn.addEventListener('click', () => {
      if (eGaveta()) corpo.classList.toggle('menu-aberto');
      else { corpo.classList.toggle('menu-recolhido'); setTimeout(() => window.dispatchEvent(new Event('resize')), 220); }
      marcar();
    });
    const fechar = () => { corpo.classList.remove('menu-aberto'); marcar(); };
    document.getElementById('fundo-menu').addEventListener('click', fechar);
    document.getElementById('nav').addEventListener('click', e => { if (e.target.closest('a') && eGaveta()) fechar(); });
    window.addEventListener('hashchange', fechar);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
    // balão com o nome e a descrição do item ao passar o mouse ou focar (indispensável com o menu recolhido, só com ícones)
    const nav = document.getElementById('nav'), tip = U.el('div', { id: 'tip-nav', role: 'tooltip' });
    document.body.append(tip);
    nav.querySelectorAll('a[data-pagina]').forEach(a => a.setAttribute('aria-label', (a.textContent || '').trim()));
    const mostrar = a => {
      if (eGaveta()) return;
      const r = a.getBoundingClientRect(), txt = (a.dataset.dica || a.textContent || '').trim();
      tip.textContent = txt; tip.style.display = 'block'; tip.style.whiteSpace = 'normal'; tip.style.maxWidth = '280px';
      tip.style.left = Math.round(r.right + 10) + 'px'; tip.style.top = Math.round(r.top + r.height / 2 - tip.offsetHeight / 2) + 'px';
    };
    const esconder = () => { tip.style.display = 'none'; };
    nav.addEventListener('mouseover', e => { const a = e.target.closest('a[data-pagina]'); if (a) mostrar(a); });
    nav.addEventListener('mouseout', e => { const a = e.target.closest('a[data-pagina]'); if (a && !a.contains(e.relatedTarget)) esconder(); });
    nav.addEventListener('focusin', e => { const a = e.target.closest('a[data-pagina]'); if (a) mostrar(a); });
    nav.addEventListener('focusout', esconder); nav.addEventListener('click', esconder); nav.addEventListener('scroll', esconder);
    // SEMPRE abre estendida; depois de 10 s a barra se recolhe sozinha (só ícones), a menos que a pessoa já tenha mexido nela
    corpo.classList.remove('menu-recolhido');
    let mexeu = false;
    btn.addEventListener('click', () => { mexeu = true; });
    const recolherSozinha = () => {
      if (mexeu || eGaveta() || corpo.classList.contains('menu-recolhido')) return;
      if (nav.matches(':hover') || nav.contains(document.activeElement)) { setTimeout(recolherSozinha, 3000); return; }
      corpo.classList.add('menu-recolhido'); setTimeout(() => window.dispatchEvent(new Event('resize')), 220); marcar();
    };
    setTimeout(recolherSozinha, 10000);
    marcar();
  }

  function iniciar() {
    /* Sem "#" na URL (duplo clique no arquivo) a rota padrão precisa estar NA URL: as páginas do núcleo decidem
       "estou na página" por location.hash e, sem isto, não se redesenhariam ao fim da primeira passada. */
    if (!location.hash || location.hash === '#') {
      try { history.replaceState(null, '', '#/publicacoes?sec=uf'); } catch (e) { location.hash = '#/publicacoes?sec=uf'; }
    }
    // marca e ícones da moldura (o kit não tem os ícones novos): o menu passa a usá-los
    const marca = document.querySelector('.topo .marca');
    if (marca && !marca.querySelector('svg')) { const l = MOLDURA.logo(38); l.style.flex = '0 0 auto'; marca.insertBefore(l, marca.firstChild); }
    const ICONE_MENU = { publicacoes: 'grafico', comparar: 'comparar', release: 'texto', sobre: 'livro' };
    document.querySelectorAll('#nav a[data-pagina]').forEach(a => { const ic = a.querySelector('.ico'); if (ic && ICONE_MENU[a.dataset.pagina]) ic.replaceChildren(MOLDURA.icone(ICONE_MENU[a.dataset.pagina], 18)); });
    U.aplicarIcones(document.getElementById('nav'));
    const rodape = document.getElementById('nav-rodape');
    rodape.replaceChildren(document.createTextNode(`PNADC Resultados · núcleo ${typeof VERSAO_NUCLEO !== 'undefined' ? VERSAO_NUCLEO : '?'}` +
      (typeof CONSTRUCAO !== 'undefined' && CONSTRUCAO.data ? ` · ${CONSTRUCAO.data}` : '')), U.el('br'),
      linkContato('Erros e sugestões', { color: 'inherit', textDecoration: 'underline dotted', opacity: '.85' }));
    ligarMenu();
    seletorUf();
    seletorPublicacao();
    dicaDeUso();
    window.addEventListener('hashchange', renderizar);
    document.getElementById('conteudo').replaceChildren(U.el('div', { class: 'vazio' }, 'Abrindo o armazenamento…'));
    FONTE.pronto().then(() => { desenharAvisoArmazenamento(); renderizar(); }, e => {
      document.getElementById('conteudo').replaceChildren(U.el('div', { class: 'aviso erro' }, 'Não consegui abrir o armazenamento: ' + e.message));
    });
  }

  return { iniciar, renderizar, rota };
})();
