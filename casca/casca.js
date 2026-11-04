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
    produto: 'PNADC Resultados',
    // sem login e sem perfis: o rascunho de release fica guardado neste navegador, em nome de "local"
    login: () => 'local',
    podeGerar: () => true,
    toast,
    renderizar: () => CASCA.renderizar()
  };
})();

const CASCA = (() => {
  let paginaAtual = null;

  function rota() {
    const h = location.hash || '#/publicacoes?sec=uf';
    const m = /^#\/([\w-]+)(\?(.*))?$/.exec(h);
    return { pagina: m ? m[1] : 'publicacoes', query: m && m[3] ? new URLSearchParams(m[3]) : new URLSearchParams() };
  }

  // ------------------------------------------------------------------ páginas
  function paginaSobre(cont) {
    const arm = FONTE.armazenamento();
    const u = FONTE.uf();
    const li = (...f) => U.el('li', { style: { margin: '3px 0' } }, ...f);
    cont.append(U.titulo('Sobre o PNADC Resultados', 'Os números que o IBGE divulga da PNAD Contínua, num arquivo só.'));
    cont.append(U.cartao('O que é', U.el('div', {},
      U.el('p', {}, 'Mostra, para o Brasil, as Grandes Regiões e a UF escolhida, os resultados que o IBGE divulga da PNAD Contínua: tabelas, gráficos e texto, com a significância publicada de cada variação e o coeficiente de variação sempre à vista. Avisa quando sai publicação nova e gera releases (texto, imagem e tabela) com um assistente de 10 passos.'),
      U.el('p', {}, 'Os números NÃO são calculados aqui: são os que o IBGE publica. A cor de uma variação vem da situação que o IBGE informa (estável ou significativa), nunca de um corte inventado.'))));
    cont.append(U.cartao('De onde vêm os dados e o que sai do seu computador', U.el('ul', { style: { margin: 0, paddingLeft: '18px' } },
      li('Fonte única: a API pública de agregados do IBGE (servicodados.ibge.gov.br), a mesma base do SIDRA. Sem chave, sem login.'),
      li('Os pedidos ao IBGE saem só quando você abre a página com o cache vencido ou aperta "Atualizar com o IBGE": no máximo uma consulta por tabela a cada 12 horas. Se a rede falha, nada é apagado e o programa espera 15 minutos antes de tentar de novo.'),
      li('Não há servidor nem dado pessoal. Tudo o que é baixado fica guardado neste navegador.'),
      li('A primeira abertura baixa as 16 tabelas (cerca de 3 minutos, com a página se atualizando sozinha); depois só confere se há período novo.'))));
    cont.append(U.cartao('Esta cópia', U.el('ul', { style: { margin: 0, paddingLeft: '18px' } },
      li('Versão do núcleo: ', U.el('b', {}, typeof VERSAO_NUCLEO !== 'undefined' ? VERSAO_NUCLEO : '?'),
        typeof CONSTRUCAO !== 'undefined' && CONSTRUCAO.data ? ` · arquivo gerado em ${CONSTRUCAO.data}` : ''),
      li('UF em destaque: ', U.el('b', {}, `${u.nome} (${u.sigla})`), ' — troque no alto da página.'),
      li('Armazenamento do cache: ', U.el('b', {}, arm.tipo === 'indexedDB' ? 'IndexedDB (completo)' : arm.tipo === 'localStorage' ? 'localStorage (pequeno)' : arm.tipo === 'memoria' ? 'só memória (some ao fechar a aba)' : 'ainda abrindo…'),
        arm.aviso ? ' — ' + arm.aviso : ''),
      li('Funciona no Edge e no Chrome. Firefox e Safari restringem o armazenamento de arquivos abertos do disco: o programa avisa e segue só com a memória.'))));
  }

  const PAGINAS_CASCA = {
    publicacoes: { render(cont, F, q) { PUBLICACOES.render(cont, F, q); }, sair() { PUBLICACOES.sair(); } },
    sobre: { render(cont) { paginaSobre(cont); }, sair() {} }
  };

  // ------------------------------------------------------------------ desenho
  function marcarMenu(pagina, query) {
    const sec = query.get('sec') || '';
    const ativa = pagina === 'publicacoes' ? (sec === 'release' ? 'release' : 'publicacoes') : pagina;
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
    const b = U.el('button', { class: 'btn pequeno' }, 'Entendi');
    b.onclick = () => { el.hidden = true; try { localStorage.setItem(CHAVE_DICA, '1'); } catch (e) { /* vale nesta aba */ } };
    el.replaceChildren(U.el('span', { class: 'mini-info' }, 'Primeira vez? Os números vêm direto do IBGE e ficam guardados neste navegador (a primeira abertura leva alguns segundos). Escolha a UF no alto e use "Gerar release" no menu.'), b);
    el.hidden = false;
  }

  function seletorUf() {
    const sel = document.getElementById('seletor-uf');
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
    marcar();
  }

  function iniciar() {
    /* Sem "#" na URL (duplo clique no arquivo) a rota padrão precisa estar NA URL: as páginas do núcleo decidem
       "estou na página" por location.hash e, sem isto, não se redesenhariam ao fim da primeira passada. */
    if (!location.hash || location.hash === '#') {
      try { history.replaceState(null, '', '#/publicacoes?sec=uf'); } catch (e) { location.hash = '#/publicacoes?sec=uf'; }
    }
    U.aplicarIcones(document.getElementById('nav'));
    const rodape = document.getElementById('nav-rodape');
    rodape.textContent = `PNADC Resultados · núcleo ${typeof VERSAO_NUCLEO !== 'undefined' ? VERSAO_NUCLEO : '?'}` +
      (typeof CONSTRUCAO !== 'undefined' && CONSTRUCAO.data ? ` · ${CONSTRUCAO.data}` : '');
    ligarMenu();
    seletorUf();
    dicaDeUso();
    window.addEventListener('hashchange', renderizar);
    document.getElementById('conteudo').replaceChildren(U.el('div', { class: 'vazio' }, 'Abrindo o armazenamento…'));
    FONTE.pronto().then(() => { desenharAvisoArmazenamento(); renderizar(); }, e => {
      document.getElementById('conteudo').replaceChildren(U.el('div', { class: 'aviso erro' }, 'Não consegui abrir o armazenamento: ' + e.message));
    });
  }

  return { iniciar, renderizar, rota };
})();
