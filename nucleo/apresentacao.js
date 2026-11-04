/* PNADC Resultados -- MODO APRESENTAÇÃO e PDF do relatório (fase 5). Dono: PNADC_Resultados.

   Os slides são as MESMAS imagens do assistente de releases (releases.js, `_desenhar`): título com a conclusão, fonte e
   data dentro da imagem, cor só da situação publicada pelo IBGE. Aqui elas viram uma apresentação em tela cheia:
     capa · resumo (halteres + tabela) · por indicador: série, ranking das UFs e (nos três primeiros) o cartograma · como ler
   Teclas: ← → PgUp PgDn Espaço Home End · P (passar sozinho) · F (tela inteira do navegador) · Esc (sair).
   Também: JPG do slide atual e PDF com todos os slides (PDFREL). Tudo local: nenhuma rede.
   Contrato: RELEASE_MODELOS, RELEASES._desenhar, MOLDURA e PDFREL carregados antes. Sem `??` nem `?.`. */
'use strict';

const APRESENTACAO = (() => {
  const RM = RELEASE_MODELOS;
  const F = '"Segoe UI", Arial, sans-serif';
  const CSS = `
.ap-tela { position:fixed; inset:0; z-index:6000; background:radial-gradient(1200px 600px at 20% -10%, #123d2c, #08170f 60%); color:#fff; display:flex; flex-direction:column; font-family:${F}; }
.ap-topo { display:flex; align-items:center; gap:12px; padding:10px 16px; flex-wrap:wrap; }
.ap-topo .ap-tit { font-weight:800; font-size:15px; letter-spacing:.2px; }
.ap-topo .ap-sub { opacity:.7; font-size:12.5px; }
.ap-topo .ap-esp { margin-left:auto; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.ap-btn { height:36px; min-width:36px; padding:0 12px; border-radius:11px; border:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.08); color:#fff; display:inline-flex; align-items:center; justify-content:center; gap:7px; cursor:pointer; font:700 13px/1 ${F}; }
.ap-btn:hover { background:rgba(255,255,255,.18); } .ap-btn[disabled] { opacity:.55; cursor:progress; } .ap-btn.on { background:#1b8a5a; border-color:#1b8a5a; }
.ap-palco { position:relative; flex:1 1 auto; min-height:0; display:flex; align-items:center; justify-content:center; padding:0 56px; overflow:hidden; }
.ap-palco canvas { flex:0 0 auto; border-radius:12px; box-shadow:0 24px 70px rgba(0,0,0,.55); background:#fff; }
.ap-seta { position:absolute; top:50%; transform:translateY(-50%); width:48px; height:48px; border-radius:50%; border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.08); color:#fff; display:grid; place-items:center; cursor:pointer; }
.ap-seta:hover { background:rgba(255,255,255,.2); } .ap-seta.e { left:8px; } .ap-seta.d { right:8px; } .ap-seta[disabled] { opacity:.25; cursor:default; }
.ap-base { display:flex; align-items:center; justify-content:center; gap:7px; padding:8px 16px 14px; flex-wrap:wrap; }
.ap-ponto { width:10px; height:10px; border-radius:50%; background:rgba(255,255,255,.28); border:0; padding:0; cursor:pointer; }
.ap-ponto.on { background:#7cd1a4; transform:scale(1.35); }
.ap-cont { margin-left:12px; font-size:12.5px; opacity:.8; font-variant-numeric:tabular-nums; }
@media (max-width:700px) { .ap-palco { padding:4px 8px; } .ap-seta { width:38px; height:38px; } .ap-topo .ap-sub { display:none; } }
`;
  function css() {
    if (document.getElementById('ap-css')) return;
    const s = document.createElement('style'); s.id = 'ap-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  // ------------------------------------------------------------------ dados do relatório
  const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const nomeLugar = D => (D.uf.codigo ? (D.uf.nome || D.uf.sigla) : 'Brasil');
  /* último trimestre com valor (não passa da publicação escolhida no cabeçalho, se houver) */
  function ultimoPeriodo(D) {
    const f = ((D.series.desocupacao || {}).trimestral || {})[D.uf.codigo ? 'N3|' + D.uf.codigo : 'N1|1'];
    if (!f) return null;
    for (let i = f.per.length - 1; i >= 0; i--) if (f.v[i] !== null && f.v[i] !== undefined && (!D.referencia || f.per[i] <= D.referencia)) return f.per[i];
    return null;
  }
  const rotPer = p => (p ? `${+String(p).slice(4)}º tri ${String(p).slice(0, 4)}` : '');
  const nomeBase = D => `pnadc_${D.uf.codigo ? String(D.uf.sigla || D.uf.codigo).toLowerCase() : 'brasil'}_${ultimoPeriodo(D) || 'sem_periodo'}`;

  function especs(D) {
    const base = Object.assign(RM.padrao(hojeIso()), { territorio: D.uf.codigo ? 'uf' : 'brasil', familia: 'trimestral', serie: 'n5', periodo: D.referencia || null, ufsEscopo: 'regiao' });
    const E0 = RM.normalizar(base);
    const ordem = RM.ordemSugerida(D, E0).filter(x => !x.it.indisponivel).map(x => x.id);
    const pedir = (ids, V) => {
      const E = RM.normalizar(Object.assign({}, E0, { indicadores: ids, visuais: V }));
      return RM.visuais(RM.montarFatos(D, E), E);
    };
    const grupos = [];
    const V0 = { linha: false, barras: false, grade: false, halteres: false, tabela: false };
    try { grupos.push({ rotulo: 'Resumo', specs: pedir(ordem, Object.assign({}, V0, { halteres: true, tabela: true })) }); } catch (e) { console.error(e); }
    ordem.forEach((id, k) => {
      try { grupos.push({ rotulo: id, specs: pedir([id], Object.assign({}, V0, { linha: true, barras: true, grade: k < 3 })) }); } catch (e) { console.error(e); }
    });
    const slides = [];
    grupos.forEach(g => g.specs.forEach(sp => slides.push({ titulo: sp.titulo, spec: sp, canvas: null })));
    return slides;
  }
  // ------------------------------------------------------------------ capa e "como ler" (desenhadas aqui)
  function fundo(c, W, H) {
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0a3524'); g.addColorStop(0.6, '#12603f'); g.addColorStop(1, '#1b8a5a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const r = c.createRadialGradient(W * 0.85, H * 0.1, 10, W * 0.85, H * 0.1, W * 0.5); r.addColorStop(0, 'rgba(160,240,200,.28)'); r.addColorStop(1, 'rgba(160,240,200,0)');
    c.fillStyle = r; c.fillRect(0, 0, W, H);
  }
  function capa(D) {
    const W = 1600, H = 900, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'); fundo(c, W, H);
    MOLDURA.desenharLogo(c, 110, 110, 120);
    c.textBaseline = 'top'; c.textAlign = 'left'; c.fillStyle = '#fff';
    c.font = `800 92px ${F}`; c.fillText('Resultados da', 110, 300); c.fillText('PNAD Contínua', 110, 400);
    c.font = `600 52px ${F}`; c.fillStyle = '#c9f2dc'; c.fillText(`${nomeLugar(D)} · ${rotPer(ultimoPeriodo(D))}`, 110, 540);
    c.font = `500 30px ${F}`; c.fillStyle = 'rgba(255,255,255,.85)';
    c.fillText('Brasil, Grandes Regiões, UF, capital e região metropolitana', 110, 625);
    c.font = `600 26px ${F}`; c.fillStyle = 'rgba(255,255,255,.75)';
    c.fillText(`Fonte: IBGE, PNAD Contínua (SIDRA) · gerado em ${MOLDURA.hojeBr()} por PNADC Resultados`, 110, H - 90);
    return cv;
  }
  function comoLer(D) {
    const W = 1600, H = 900, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#0b3d2b'); g.addColorStop(1, '#1fa36a'); c.fillStyle = g; c.fillRect(0, 0, W, 12);
    MOLDURA.desenharLogo(c, 60, 44, 60);
    c.textBaseline = 'top'; c.textAlign = 'left'; c.fillStyle = '#14302a'; c.font = `800 48px ${F}`; c.fillText('Como ler estes números', 140, 52);
    const linhas = [
      ['Situação da variação', 'Verde ou vermelho só quando o IBGE publica a variação como significativa (e então o sentido é o sinal); cinza = estável.'],
      ['Precisão (CV)', 'Até 5% ótima · 5–15% boa · 15–30% razoável · 30–50% pouco precisa · acima de 50% imprecisa.'],
      ['Comparar áreas e períodos', 'O IBGE não publica teste entre UFs nem entre períodos quaisquer: a página usa o intervalo aproximado (± 1,96 × CV).'],
      ['Trimestre móvel', 'Só existe para o Brasil; UF, região, capital e região metropolitana só têm divulgação trimestral.'],
      ['Fonte', `IBGE, PNAD Contínua, API de agregados (SIDRA). Dados até ${rotPer(ultimoPeriodo(D))}. Não é um produto oficial do IBGE.`],
    ];
    let y = 170;
    linhas.forEach(l => {
      c.fillStyle = '#0f5132'; c.font = `800 30px ${F}`; c.fillText(l[0], 70, y);
      c.fillStyle = '#35524a'; c.font = `500 28px ${F}`;
      MOLDURA.quebrar(c, l[1], W - 140).forEach((t, i) => c.fillText(t, 70, y + 42 + i * 38));
      y += 42 + MOLDURA.quebrar(c, l[1], W - 140).length * 38 + 34;
    });
    return cv;
  }
  // ------------------------------------------------------------------ o conjunto de slides
  let cache = { chave: null, slides: null };
  function slidesDe(D) {
    const chave = `${D.uf.codigo}|${D.referencia || ''}|${ultimoPeriodo(D)}|${Object.keys(D.consultas || {}).length}`;
    if (cache.chave === chave && cache.slides) return cache.slides;
    const meio = especs(D);
    const slides = [{ titulo: 'Capa', canvas: null, fazer: () => capa(D) }]
      .concat(meio.map(s => ({ titulo: s.titulo, canvas: null, fazer: () => RELEASES._desenhar.desenhar(s.spec) })))
      .concat([{ titulo: 'Como ler', canvas: null, fazer: () => comoLer(D) }]);
    cache = { chave, slides };
    return slides;
  }
  const canvasDe = s => { if (!s.canvas) s.canvas = s.fazer(); return s.canvas; };

  // ------------------------------------------------------------------ visor
  let aberto = null;
  function fechar() {
    if (!aberto) return;
    const a = aberto; aberto = null;
    clearInterval(a.timer);
    document.removeEventListener('keydown', a.tecla, true);
    document.removeEventListener('fullscreenchange', a.fs);
    window.removeEventListener('resize', a.reaj);
    try { if (document.fullscreenElement === a.tela && document.exitFullscreen) document.exitFullscreen(); } catch (e) { /* ok */ }
    a.tela.remove();
    document.body.classList.remove('mo-sem-rolagem');
    if (a.foco && a.foco.focus) { try { a.foco.focus(); } catch (e) { /* ok */ } }
  }
  function abrir(D) {
    css();
    if (aberto) fechar();
    if (typeof MOLDURA !== 'undefined' && MOLDURA._cheiaAberta()) MOLDURA.fecharCheia();
    const palco = U.el('div', { class: 'ap-palco' }, U.el('div', { style: { opacity: '.8' } }, 'Preparando a apresentação…'));
    const topoTit = U.el('div', {}, U.el('div', { class: 'ap-tit' }, `Resultados da PNAD Contínua — ${nomeLugar(D)}`), U.el('div', { class: 'ap-sub' }, '←  →  navegam · P passa sozinho · F tela inteira · Esc sai'));
    const btnJpg = U.el('button', { class: 'ap-btn', type: 'button', title: 'Baixar o slide atual em JPG' }, MOLDURA.icone('imagem', 16), 'JPG');
    const btnPdf = U.el('button', { class: 'ap-btn', type: 'button', title: 'Baixar todos os slides em um PDF' }, MOLDURA.icone('pdf', 16), 'PDF');
    const btnPlay = U.el('button', { class: 'ap-btn', type: 'button', title: 'Passar os slides sozinho (P)' }, MOLDURA.icone('play', 16), 'Passar');
    const btnFs = U.el('button', { class: 'ap-btn', type: 'button', title: 'Tela inteira do navegador (F)' }, MOLDURA.icone('expandir', 16));
    const btnX = U.el('button', { class: 'ap-btn', type: 'button', title: 'Sair (Esc)', 'aria-label': 'Sair da apresentação' }, MOLDURA.icone('fechar', 16));
    const topo = U.el('div', { class: 'ap-topo' }, U.el('div', { style: { display: 'flex' } }, MOLDURA.logo(34)), topoTit, U.el('div', { class: 'ap-esp' }, btnPlay, btnJpg, btnPdf, btnFs, btnX));
    const base = U.el('div', { class: 'ap-base' });
    const tela = U.el('div', { class: 'ap-tela', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Apresentação' }, topo, palco, base);
    const a = { tela, foco: document.activeElement, i: 0, slides: [], timer: null, tecla: null, fs: null };
    aberto = a;
    document.body.appendChild(tela);
    document.body.classList.add('mo-sem-rolagem');
    const seta = (cls, nome, passo) => { const b = U.el('button', { class: 'ap-seta ' + cls, type: 'button', 'aria-label': passo < 0 ? 'Slide anterior' : 'Próximo slide' }, MOLDURA.icone(nome, 22)); b.onclick = () => ir(a.i + passo); return b; };
    const sE = seta('e', 'esq', -1), sD = seta('d', 'dir', 1);
    const pontos = [], cont = U.el('span', { class: 'ap-cont' }, '');
    function ir(n) {
      if (!a.slides.length) return;
      a.i = Math.max(0, Math.min(a.slides.length - 1, n));
      const s = a.slides[a.i];
      let cv;
      try { cv = canvasDe(s); } catch (e) { console.error(e); cv = document.createElement('canvas'); cv.width = 800; cv.height = 300; const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 800, 300); c.fillStyle = '#b71c1c'; c.font = `20px ${F}`; c.fillText('Não consegui desenhar este slide: ' + e.message, 20, 150); }
      palco.replaceChildren(sE, cv, sD);
      cabe(cv);
      sE.disabled = a.i === 0; sD.disabled = a.i === a.slides.length - 1;
      pontos.forEach((p, k) => p.classList.toggle('on', k === a.i));
      cont.textContent = `${a.i + 1} / ${a.slides.length} · ${s.titulo || ''}`.slice(0, 110);
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', s.titulo || 'Slide');
    }
    /* o slide cresce até ocupar toda a área disponível (mantendo a proporção): o canvas tem 1200 px, a tela tem mais */
    function cabe(cv) {
      const r = palco.getBoundingClientRect(), pad = window.innerWidth <= 700 ? 0 : 56;
      const k = Math.min((r.width - 2 * pad) / cv.width, r.height / cv.height);
      cv.style.width = Math.floor(cv.width * k) + 'px'; cv.style.height = Math.floor(cv.height * k) + 'px';
    }
    const reaj = () => { const cv = palco.querySelector('canvas'); if (cv) cabe(cv); };
    window.addEventListener('resize', reaj);
    a.fs = () => setTimeout(reaj, 80);
    document.addEventListener('fullscreenchange', a.fs);
    function parar() { clearInterval(a.timer); a.timer = null; btnPlay.classList.remove('on'); btnPlay.replaceChildren(MOLDURA.icone('play', 16), 'Passar'); }
    function passar() {
      if (a.timer) { parar(); return; }
      btnPlay.classList.add('on'); btnPlay.replaceChildren(MOLDURA.icone('pausa', 16), 'Pausar');
      a.timer = setInterval(() => { if (a.i >= a.slides.length - 1) { parar(); return; } ir(a.i + 1); }, 9000);
    }
    a.reaj = reaj;
    a.tecla = ev => {
      const k = ev.key;
      if (k === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fechar(); return; }
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { ev.preventDefault(); ir(a.i + 1); } else if (k === 'ArrowLeft' || k === 'PageUp') { ev.preventDefault(); ir(a.i - 1); }
      else if (k === 'Home') { ev.preventDefault(); ir(0); } else if (k === 'End') { ev.preventDefault(); ir(a.slides.length - 1); }
      else if (k === 'p' || k === 'P') passar(); else if (k === 'f' || k === 'F') btnFs.click();
    };
    document.addEventListener('keydown', a.tecla, true);
    try { if (tela.requestFullscreen) { const pr = tela.requestFullscreen(); if (pr && pr.catch) pr.catch(() => { /* sem tela inteira: o painel já cobre a janela */ }); } } catch (e) { /* idem */ }
    btnX.onclick = fechar; btnPlay.onclick = passar;
    btnFs.onclick = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else if (tela.requestFullscreen) tela.requestFullscreen(); } catch (e) { /* ok */ } };
    btnJpg.onclick = () => { try { MOLDURA.baixarCanvas(canvasDe(a.slides[a.i]), `${nomeBase(D)}_slide${a.i + 1}.jpg`, 'image/jpeg', 0.92); } catch (e) { AMBIENTE.toast('Não consegui gerar a imagem: ' + e.message, 'erro', 5000); } };
    btnPdf.onclick = () => baixarPdf(D, btnPdf);
    // toque: deslizar troca de slide
    let x0 = null;
    palco.addEventListener('pointerdown', ev => { x0 = ev.clientX; });
    palco.addEventListener('pointerup', ev => { if (x0 !== null && Math.abs(ev.clientX - x0) > 60) ir(a.i + (ev.clientX < x0 ? 1 : -1)); x0 = null; });
    // os slides (a conta pesa um pouco: deixa a tela aparecer antes)
    setTimeout(() => {
      if (aberto !== a) return;
      try { a.slides = slidesDe(D); } catch (e) { console.error(e); palco.replaceChildren(U.el('div', {}, 'Não consegui preparar a apresentação: ' + e.message)); return; }
      a.slides.forEach((s, k) => { const p = U.el('button', { class: 'ap-ponto', type: 'button', title: s.titulo || ('Slide ' + (k + 1)), 'aria-label': 'Ir ao slide ' + (k + 1) }); p.onclick = () => ir(k); pontos.push(p); base.appendChild(p); });
      base.appendChild(cont);
      ir(0);
    }, 40);
  }
  /* PDF com todos os slides (uma página por slide) */
  function baixarPdf(D, botao) {
    const rot = botao ? botao.textContent : '';
    const marcar = t => { if (botao) { botao.disabled = true; botao.lastChild.textContent = t; } };
    const slides = slidesDe(D), paginas = [];
    let i = 0;
    const passo = () => {
      if (i >= slides.length) {
        try {
          const blob = PDFREL.criar({ titulo: `Resultados da PNAD Contínua — ${nomeLugar(D)}`, assunto: `${nomeLugar(D)}, ${rotPer(ultimoPeriodo(D))}`, paginas, moldura: false });
          PDFREL.baixar(blob, `${nomeBase(D)}.pdf`);
          AMBIENTE.toast(`PDF gerado (${slides.length} páginas).`, 'ok', 3500);
        } catch (e) { console.error(e); AMBIENTE.toast('Não consegui gerar o PDF: ' + e.message, 'erro', 6000); }
        if (botao) { botao.disabled = false; botao.lastChild.textContent = rot || 'PDF'; }
        return;
      }
      marcar(`${i + 1}/${slides.length}`);
      try { paginas.push({ tipo: 'imagem', canvas: canvasDe(slides[i]) }); } catch (e) { console.error(e); }
      i++;
      setTimeout(passo, 0);   // respira entre os slides: a tela não congela
    };
    setTimeout(passo, 20);
  }
  return { abrir, fechar, baixarPdf, slidesDe, especs, canvasDe, _aberta: () => !!aberto };
})();
