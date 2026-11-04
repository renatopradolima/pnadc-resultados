/* PNADC Resultados -- MOLDURA: a casa visual de todo gráfico e toda tabela (fase 5, revisão de interface).
   Dono: PNADC_Resultados. Serve às páginas do núcleo nos dois hospedeiros (arquivo autônomo e SuperC), por isso traz
   o PRÓPRIO CSS (injetado uma vez, tudo sob `.mo-`) e os próprios ícones: o kit é do SuperC e não se edita aqui.

   O que cada cartão feito por `MOLDURA.cartao` ganha:
   - cabeçalho com ícone, título e subtítulo;
   - TELA CHEIA (dar foco): abre o mesmo cartão num painel que ocupa a tela (Fullscreen API quando o navegador deixa;
     senão, um painel fixo), redesenhado no tamanho novo; Esc fecha;
   - JPG: exporta o cartão como imagem com título, subtítulo, fonte e data DENTRO da imagem, desenhado fora da tela
     num tamanho fixo (1600 px de largura), então a imagem sai igual em qualquer janela;
   - ALTERNAR entre modos (`modos`), só onde faz sentido: quem monta o cartão decide e o modo escolhido é lembrado.
   `desenhar(cont, { modo, cheia, exportando })` é chamado de novo a cada troca de modo, na tela cheia e no JPG.

   Regras herdadas: texto de dado como nó de texto (nunca HTML); cor de variação só vem da situação publicada.
   Sem `??` nem `?.`. */
'use strict';

const MOLDURA = (() => {
  // ------------------------------------------------------------------ estilo (injetado uma vez)
  const CSS = `
.mo-pagina { --mo-verde:#0f5132; --mo-verde2:#1b8a5a; --mo-menta:#e7f4ed; --mo-azul:#1a73e8; --mo-texto:#14302a; --mo-sub:#587068;
  --mo-borda:#e1e9e4; --mo-fundo:#f3f7f5; --mo-sombra:0 1px 2px rgba(16,42,35,.06),0 10px 28px rgba(16,42,35,.08); }
.mo-hero { position:relative; overflow:hidden; border-radius:22px; padding:22px 24px; color:#fff; margin:0 0 6px;
  background: radial-gradient(1200px 300px at 85% -40%, rgba(120,220,170,.35), transparent 60%), linear-gradient(120deg,#0b3d2b 0%,#146c43 55%,#1b8a5a 100%);
  box-shadow:0 14px 34px rgba(11,61,43,.25); }
.mo-hero::after { content:''; position:absolute; right:-40px; bottom:-60px; width:260px; height:260px; border-radius:50%;
  background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.14), transparent 65%); pointer-events:none; }
.mo-hero-topo { display:flex; align-items:center; gap:14px; flex-wrap:wrap; position:relative; z-index:1; }
.mo-hero h2 { margin:0; font-size:22px; font-weight:800; letter-spacing:-.2px; color:#fff; }
.mo-hero p { margin:4px 0 0; color:rgba(255,255,255,.86); font-size:13.5px; max-width:760px; }
.mo-hero-acoes { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.mo-hero-selos { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; position:relative; z-index:1; }
.mo-selo { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:999px; font-size:12px; font-weight:600;
  background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.22); color:#fff; backdrop-filter:blur(4px); }
.mo-selo b { font-weight:800; }
.mo-hero .btn, .mo-hero .mo-btn-hero { background:rgba(255,255,255,.14); color:#fff; border:1px solid rgba(255,255,255,.3); border-radius:12px;
  padding:8px 13px; font-weight:700; font-size:13px; display:inline-flex; align-items:center; gap:7px; text-decoration:none; cursor:pointer; }
.mo-hero .btn:hover, .mo-hero .mo-btn-hero:hover { background:rgba(255,255,255,.26); }
.mo-hero .btn.primario, .mo-hero .mo-btn-hero.primario { background:#fff; color:#0f5132; border-color:#fff; }
.mo-hero .btn.primario:hover, .mo-hero .mo-btn-hero.primario:hover { background:#e9f7ef; }
.mo-hero .btn:disabled { opacity:.65; cursor:default; }
.mo-cartao { background:#fff; border:1px solid var(--mo-borda, #e1e9e4); border-radius:18px; box-shadow:var(--mo-sombra, 0 6px 20px rgba(16,42,35,.08)); margin-top:16px; overflow:hidden; }
.mo-cab { display:flex; align-items:center; gap:12px; padding:13px 16px; border-bottom:1px solid var(--mo-borda, #e1e9e4);
  background:linear-gradient(180deg,#fcfefd,#f4f9f6); flex-wrap:wrap; }
.mo-ic { flex:0 0 auto; width:36px; height:36px; border-radius:11px; display:grid; place-items:center; color:#0f5132;
  background:linear-gradient(135deg,#e7f4ed,#cfe8da); }
.mo-tit { min-width:0; flex:1 1 220px; }
.mo-tit h3 { margin:0; font-size:15px; font-weight:800; color:var(--mo-texto, #14302a); line-height:1.25; }
.mo-tit small { display:block; margin-top:2px; color:var(--mo-sub, #587068); font-size:12px; line-height:1.3; }
.mo-acoes { margin-left:auto; display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.mo-btn { width:34px; height:34px; border-radius:10px; border:1px solid var(--mo-borda, #dbe5df); background:#fff; color:#2d4a40; display:inline-grid; place-items:center;
  cursor:pointer; padding:0; transition:background .12s, border-color .12s, transform .12s; }
.mo-btn:hover { background:#eef6f1; border-color:#b8d3c4; }
.mo-btn:active { transform:scale(.95); }
.mo-btn:focus-visible, .mo-seg button:focus-visible { outline:2px solid #1a73e8; outline-offset:2px; }
.mo-btn[disabled] { opacity:.5; cursor:progress; }
.mo-seg { display:inline-flex; background:#e9f0ec; border-radius:11px; padding:3px; gap:2px; }
.mo-seg button { border:0; background:transparent; padding:6px 11px; border-radius:9px; font:700 12px/1 inherit; font-family:inherit; color:#4c675c; cursor:pointer; white-space:nowrap; }
.mo-seg button.on { background:#fff; color:#0f5132; box-shadow:0 1px 3px rgba(16,42,35,.18); }
.mo-corpo { padding:14px 16px 16px; }
.mo-sup { padding:12px 16px 0; }
.mo-rodape { padding:0 16px 14px; }
.mo-ajuda { margin:10px 0 0; padding:10px 12px; border-radius:12px; background:#f5f9f7; color:var(--mo-sub, #587068); font-size:12px; line-height:1.45; }
.mo-grafico { position:relative; height:340px; }
.mo-grafico.alto { height:390px; }
.mo-grafico-cheio { position:relative; height:100%; min-height:52vh; }
.mo-fora { position:fixed; left:-12000px; top:0; width:1600px; height:760px; pointer-events:none; opacity:0; }
.mo-tela { position:fixed; inset:0; z-index:5000; background:#fff; display:flex; flex-direction:column; }
.mo-tela-cab { display:flex; align-items:center; gap:12px; padding:12px 20px; border-bottom:1px solid var(--mo-borda, #e1e9e4); background:linear-gradient(180deg,#fcfefd,#f1f7f4); flex-wrap:wrap; }
.mo-tela-cab h3 { margin:0; font-size:17px; font-weight:800; color:#14302a; }
.mo-tela-cab small { display:block; color:#587068; font-size:12.5px; }
.mo-tela-corpo { flex:1 1 auto; min-height:0; overflow:auto; padding:16px 24px 20px; display:flex; flex-direction:column; }
.mo-tela-corpo > .mo-grafico-cheio { flex:1 1 auto; }
.mo-tela-rodape { padding:8px 24px 14px; color:#587068; font-size:12px; }
body.mo-sem-rolagem { overflow:hidden !important; }
.mo-pagina .tabela-wrap { border:1px solid var(--mo-borda, #e1e9e4); border-radius:14px; overflow:auto; }
.mo-pagina table.tabela { border-collapse:separate; border-spacing:0; width:100%; font-variant-numeric:tabular-nums; }
.mo-pagina table.tabela thead th { position:sticky; top:0; z-index:1; background:#eef5f1; color:#2b4a3e; font-weight:800; font-size:12px; text-transform:none;
  border-bottom:1px solid #d7e5dc; padding:10px 12px; }
.mo-pagina table.tabela tbody td { padding:9px 12px; border-bottom:1px solid #eef3f0; }
.mo-pagina table.tabela tbody tr:nth-child(even) td { background:#fafcfb; }
.mo-pagina table.tabela tbody tr:hover td { background:#eef7f2; }
.mo-pagina table.tabela tbody tr:last-child td { border-bottom:0; }
.mo-pagina .grade.g4 .kpi, .mo-pagina .kpi.mo-kpi { border-radius:18px; border:1px solid var(--mo-borda, #e1e9e4); box-shadow:var(--mo-sombra, 0 6px 20px rgba(16,42,35,.08));
  background:linear-gradient(180deg,#fff, #f8fcfa); position:relative; overflow:hidden; transition:transform .15s, box-shadow .15s; }
.mo-pagina .grade.g4 .kpi:hover { transform:translateY(-2px); box-shadow:0 14px 30px rgba(16,42,35,.14); }
.mo-pagina .grade.g4 .kpi::before { content:''; position:absolute; left:0; top:0; right:0; height:4px; background:linear-gradient(90deg,#1b8a5a,#7cd1a4); }
.mo-pagina .kpi .valor { font-weight:900; letter-spacing:-.5px; }
.mo-spark { display:block; margin:8px auto 0; }
.mo-vazio { text-align:center; padding:28px 16px; color:#587068; }
.mo-chips { display:flex; flex-wrap:wrap; gap:6px; }
.mo-chip { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; border:1px solid #d6e4db; background:#fff; color:#2d4a40;
  font-size:12.5px; font-weight:600; text-decoration:none; cursor:pointer; }
.mo-chip:hover { background:#eef6f1; }
.mo-chip.ativo { background:#0f5132; border-color:#0f5132; color:#fff; }
.mo-secoes { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 6px; }
.mo-secao { display:inline-flex; align-items:center; gap:8px; padding:9px 15px; border-radius:14px; border:1px solid var(--mo-borda, #dbe5df); background:#fff; color:#2d4a40;
  font-size:13px; font-weight:700; text-decoration:none; box-shadow:0 1px 2px rgba(16,42,35,.05); }
.mo-secao:hover { background:#eef6f1; border-color:#b8d3c4; }
.mo-secao.ativo { background:linear-gradient(135deg,#0f5132,#1b8a5a); color:#fff; border-color:transparent; box-shadow:0 6px 16px rgba(15,81,50,.3); }
.mo-comp { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:10px; margin-bottom:12px; }
.mo-comp label { display:flex; flex-direction:column; gap:4px; font-size:12px; font-weight:700; color:#476258; }
.mo-comp select { font:inherit; font-size:13.5px; padding:8px 10px; border:1px solid #cfdcd4; border-radius:10px; background:#fff; color:#14302a; }
.mo-pill { display:inline-block; padding:2px 9px; border-radius:999px; font-size:11.5px; font-weight:700; background:#eef3f0; color:#4c675c; }
@media (max-width:700px) {
  .mo-hero { padding:16px 15px; border-radius:18px; } .mo-hero h2 { font-size:18px; } .mo-hero-acoes { margin-left:0; }
  .mo-acoes { margin-left:0; } .mo-cab { padding:11px 12px; } .mo-corpo { padding:10px 10px 12px; } .mo-grafico { height:300px; } .mo-grafico.alto { height:330px; }
  .mo-tela-corpo { padding:10px 10px 14px; } .mo-secao { padding:8px 11px; font-size:12.5px; }
}
table.rel-tab { border-collapse:separate; border-spacing:0; width:100%; font-size:13px; margin:12px 0; border:1px solid #dfe9e3; border-radius:12px; overflow:hidden; font-variant-numeric:tabular-nums; }
.rel-tab th { background:#0f5132; color:#fff; padding:8px 10px; text-align:left; font-weight:700; } .rel-tab td { padding:7px 10px; border-bottom:1px solid #eef3f0; }
.rel-tab th.n, .rel-tab td.n { text-align:right; } .rel-tab tbody tr:nth-child(even) td { background:#f7faf8; } .rel-tab tbody tr:last-child td { border-bottom:0; }
.rel-raiz p, .rel-raiz li, .rel-raiz blockquote { text-align:justify; hyphens:auto; } .rel-raiz p.fonte { font-size:11px; color:#587068; text-align:left; }
.rel-raiz h1 { color:#0f5132; } .rel-raiz h2 { color:#0f5132; }
.mo-faixa { padding:4px 16px 14px; }
.mo-faixa-topo { display:flex; align-items:center; gap:10px; font-size:12px; color:#476258; margin-bottom:4px; flex-wrap:wrap; }
.mo-faixa-topo b { color:#0f5132; font-weight:800; font-variant-numeric:tabular-nums; }
.mo-faixa-topo button { margin-left:auto; border:1px solid #cfe0d6; background:#fff; color:#2d4a40; border-radius:9px; padding:4px 10px; font:700 11.5px/1 inherit; font-family:inherit; cursor:pointer; }
.mo-faixa-topo button:hover { background:#eef6f1; }
.mo-faixa-trilho { position:relative; height:30px; }
.mo-faixa-trilho::before { content:''; position:absolute; left:8px; right:8px; top:12px; height:6px; border-radius:3px; background:#e1ebe5; }
.mo-faixa-sel { position:absolute; top:12px; height:6px; border-radius:3px; background:linear-gradient(90deg,#0f5132,#1b8a5a); }
.mo-faixa-trilho input { position:absolute; left:0; top:0; width:100%; height:30px; margin:0; background:none; pointer-events:none; -webkit-appearance:none; appearance:none; }
.mo-faixa-trilho input::-webkit-slider-runnable-track { background:transparent; height:30px; }
.mo-faixa-trilho input::-moz-range-track { background:transparent; }
.mo-faixa-trilho input::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; pointer-events:auto; width:20px; height:20px; margin-top:5px; border-radius:50%; background:#fff; border:3px solid #0f5132; box-shadow:0 2px 6px rgba(16,42,35,.3); cursor:grab; }
.mo-faixa-trilho input::-moz-range-thumb { pointer-events:auto; width:14px; height:14px; border-radius:50%; background:#fff; border:3px solid #0f5132; cursor:grab; }
.mo-faixa-trilho input:focus-visible::-webkit-slider-thumb { outline:2px solid #1a73e8; outline-offset:2px; }
/* ================= revisão 2: relevo, sombras, volume e responsividade ================= */
.mo-pagina { max-width: 1800px; margin-left: auto; margin-right: auto; min-width: 0; width: 100%; box-sizing: border-box;
  --mo-realce: 0 1px 0 rgba(255,255,255,.95) inset;
  --mo-sombra: 0 1px 0 rgba(255,255,255,.95) inset, 0 1px 2px rgba(16,42,35,.09), 0 8px 18px rgba(16,42,35,.07), 0 26px 48px -14px rgba(16,42,35,.20);
  --mo-sombra-alta: 0 1px 0 rgba(255,255,255,.95) inset, 0 2px 4px rgba(16,42,35,.10), 0 14px 28px rgba(16,42,35,.11), 0 36px 64px -16px rgba(16,42,35,.26); }
.mo-cartao { background: linear-gradient(180deg, #ffffff 0%, #fafdfb 100%); border: 1px solid #d6e3dc; box-shadow: var(--mo-sombra); transition: box-shadow .22s ease, transform .22s ease; }
.mo-cartao:hover { box-shadow: var(--mo-sombra-alta); }
.mo-cab { background: linear-gradient(180deg, #ffffff 0%, #edf5f0 100%); border-bottom: 1px solid #d4e3da; box-shadow: var(--mo-realce); }
.mo-ic { background: linear-gradient(145deg, #f3fbf6 0%, #bfe0cd 100%); box-shadow: var(--mo-realce), 0 2px 6px rgba(15,81,50,.22), inset 0 -2px 4px rgba(15,81,50,.10); }
.mo-btn { background: linear-gradient(180deg, #ffffff 0%, #ecf3ef 100%); border: 1px solid #c9d9d0; box-shadow: var(--mo-realce), 0 1px 2px rgba(16,42,35,.14), 0 4px 8px rgba(16,42,35,.06); }
.mo-btn:hover { background: linear-gradient(180deg, #ffffff 0%, #dfeee6 100%); border-color: #a9c9b8; box-shadow: var(--mo-realce), 0 2px 4px rgba(16,42,35,.16), 0 8px 16px rgba(16,42,35,.10); transform: translateY(-1px); }
.mo-btn:active { transform: translateY(1px) scale(.97); box-shadow: inset 0 2px 5px rgba(16,42,35,.25); background: #e4eee8; }
.mo-seg { background: #dfe9e3; box-shadow: inset 0 2px 4px rgba(16,42,35,.18), 0 1px 0 rgba(255,255,255,.9); }
.mo-seg button.on { background: linear-gradient(180deg, #ffffff 0%, #eef6f1 100%); box-shadow: var(--mo-realce), 0 2px 5px rgba(16,42,35,.25); }
.mo-corpo { background: linear-gradient(180deg, rgba(247,251,249,0) 0%, rgba(240,247,243,.55) 100%); }
.mo-hero { box-shadow: 0 1px 0 rgba(255,255,255,.28) inset, 0 -2px 0 rgba(0,0,0,.18) inset, 0 3px 6px rgba(11,61,43,.25), 0 22px 44px -10px rgba(11,61,43,.42); }
.mo-hero::before { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: linear-gradient(180deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 46%); }
.mo-hero .btn, .mo-hero .mo-btn-hero { background: linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,.08)); box-shadow: 0 1px 0 rgba(255,255,255,.3) inset, 0 2px 6px rgba(0,0,0,.22); }
.mo-hero .btn:hover, .mo-hero .mo-btn-hero:hover { transform: translateY(-1px); box-shadow: 0 1px 0 rgba(255,255,255,.35) inset, 0 6px 14px rgba(0,0,0,.28); }
.mo-hero .btn:active, .mo-hero .mo-btn-hero:active { transform: translateY(1px); box-shadow: inset 0 2px 5px rgba(0,0,0,.3); }
.mo-hero .btn.primario, .mo-hero .mo-btn-hero.primario { background: linear-gradient(180deg, #ffffff, #dff2e7); box-shadow: 0 1px 0 #fff inset, 0 3px 8px rgba(0,0,0,.25); }
.mo-selo { box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 2px 6px rgba(0,0,0,.18); }
.mo-secao { background: linear-gradient(180deg, #ffffff 0%, #eef5f1 100%); border: 1px solid #cfdcd4; box-shadow: var(--mo-realce), 0 2px 4px rgba(16,42,35,.10), 0 8px 14px -4px rgba(16,42,35,.10); transition: transform .15s, box-shadow .15s; }
.mo-secao:hover { transform: translateY(-1px); box-shadow: var(--mo-realce), 0 3px 6px rgba(16,42,35,.14), 0 12px 20px -6px rgba(16,42,35,.16); }
.mo-secao.ativo { background: linear-gradient(180deg, #1e9a66 0%, #0f5132 100%); border-color: #0b3d2b; box-shadow: 0 1px 0 rgba(255,255,255,.35) inset, 0 -2px 0 rgba(0,0,0,.2) inset, 0 6px 14px rgba(15,81,50,.38); transform: none; }
.mo-chip { background: linear-gradient(180deg, #ffffff, #f0f6f2); box-shadow: var(--mo-realce), 0 1px 3px rgba(16,42,35,.12); }
.mo-chip.ativo { background: linear-gradient(180deg, #1e9a66, #0f5132); box-shadow: 0 1px 0 rgba(255,255,255,.3) inset, 0 3px 8px rgba(15,81,50,.35); }
.mo-pagina .grade.g4, .mo-pagina .grade.g3 { display: grid; grid-template-columns: repeat(auto-fill, minmax(236px, 1fr)); gap: 14px; }
.mo-pagina .grade.g4 .kpi { background: linear-gradient(165deg, #ffffff 0%, #f1f8f4 100%); border: 1px solid #d3e2d9; box-shadow: var(--mo-sombra); }
.mo-pagina .grade.g4 .kpi:hover { transform: translateY(-3px); box-shadow: var(--mo-sombra-alta); }
.mo-pagina .grade.g4 .kpi::before { height: 5px; box-shadow: 0 1px 3px rgba(15,81,50,.3); }
.mo-pagina table.tabela thead th { background: linear-gradient(180deg, #f3f9f5 0%, #e3efe8 100%); box-shadow: 0 1px 0 #fff inset, 0 1px 0 #cfe0d6; }
.mo-pagina .tabela-wrap { box-shadow: inset 0 1px 3px rgba(16,42,35,.08); background: #fff; }
.mo-ajuda { box-shadow: inset 0 1px 2px rgba(16,42,35,.08); }
.mo-dica { display: flex; align-items: center; gap: 8px; margin: 12px 4px 0; color: #5d766c; font-size: 12.5px; line-height: 1.4; }
.mo-dica svg { flex: 0 0 auto; opacity: .75; }
.mo-faixa-trilho input::-webkit-slider-thumb { background: radial-gradient(circle at 35% 30%, #ffffff, #e8f3ed); box-shadow: 0 1px 0 #fff inset, 0 3px 8px rgba(16,42,35,.4); }
/* ---- elementos do kit dentro das páginas (assistente de release, comparar): mesmo vocabulário visual ---- */
.mo-pagina .cartao { background: linear-gradient(180deg, #ffffff 0%, #fafdfb 100%); border: 1px solid #d6e3dc; border-radius: 16px; box-shadow: var(--mo-sombra); }
.mo-pagina .btn { border-radius: 10px; border: 1px solid #c9d9d0; background: linear-gradient(180deg, #ffffff 0%, #ecf3ef 100%); color: #14302a; box-shadow: var(--mo-realce), 0 1px 2px rgba(16,42,35,.14), 0 4px 8px rgba(16,42,35,.06); transition: transform .12s, box-shadow .12s; }
.mo-pagina .btn:hover { background: linear-gradient(180deg, #ffffff 0%, #dfeee6 100%); border-color: #a9c9b8; transform: translateY(-1px); }
.mo-pagina .btn:active { transform: translateY(1px); box-shadow: inset 0 2px 5px rgba(16,42,35,.25); }
.mo-pagina .btn.primario { background: linear-gradient(180deg, #1e9a66 0%, #0f5132 100%); border-color: #0b3d2b; color: #fff; box-shadow: 0 1px 0 rgba(255,255,255,.35) inset, 0 -2px 0 rgba(0,0,0,.2) inset, 0 4px 10px rgba(15,81,50,.32); }
.mo-pagina .btn.primario:hover { background: linear-gradient(180deg, #25ab73 0%, #11603b 100%); }
.mo-pagina input[type=text], .mo-pagina input[type=search], .mo-pagina input[type=number], .mo-pagina select, .mo-pagina textarea { border: 1px solid #c9d9d0; border-radius: 10px; background: #fff; box-shadow: inset 0 1px 3px rgba(16,42,35,.10); padding: 7px 10px; font: inherit; color: #14302a; max-width: 100%; box-sizing: border-box; }
.mo-pagina input:focus-visible, .mo-pagina select:focus-visible, .mo-pagina textarea:focus-visible { outline: 2px solid #1e9a66; outline-offset: 1px; }
.mo-pagina .chip { background: linear-gradient(180deg, #ffffff, #f0f6f2); color: #14302a; border: 1px solid #cfdcd4; border-radius: 999px; padding: 5px 12px; box-shadow: var(--mo-realce), 0 1px 3px rgba(16,42,35,.12); }
.mo-pagina .chip.ativo { background: linear-gradient(180deg, #1e9a66, #0f5132); color: #fff; border-color: #0b3d2b; box-shadow: 0 1px 0 rgba(255,255,255,.3) inset, 0 3px 8px rgba(15,81,50,.35); }
.mo-pagina .aviso { border-radius: 12px; box-shadow: 0 1px 0 rgba(255,255,255,.7) inset, 0 2px 6px rgba(16,42,35,.08); }
.mo-pagina .rel-previa, .mo-pagina .rel-opcoes, .mo-pagina .rel-exportar, .mo-pagina .rel-editor { border-radius: 16px; }
.mo-pagina .rel-previa iframe, .mo-pagina .rel-previa .rel-doc { border-radius: 12px; box-shadow: inset 0 1px 4px rgba(16,42,35,.12); }
.mo-tip { position: fixed; z-index: 100000; display: none; max-width: 260px; padding: 6px 10px; border-radius: 9px; background: linear-gradient(180deg, #1d3a2f, #0f2a20); color: #fff; font-size: 12px; font-weight: 600; line-height: 1.35; pointer-events: none;
  box-shadow: 0 1px 0 rgba(255,255,255,.18) inset, 0 6px 16px rgba(0,0,0,.35); }
/* ---- tela grande: duas colunas (os cartões "meia" ficam lado a lado; o resto ocupa a largura toda) ---- */
@media (min-width: 1500px) {
  .mo-pagina { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: max-content; align-content: start; gap: 16px; align-items: start; }
  .mo-pagina > * { grid-column: 1 / -1; margin-top: 0 !important; }
  .mo-pagina > .mo-meia { grid-column: auto; }
  .mo-pagina .grade.g4, .mo-pagina .grade.g3 { grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
  .mo-grafico { height: 380px; } .mo-grafico.alto { height: 430px; }
}
@media (min-width: 2100px) { .mo-pagina { max-width: 2000px; } .mo-grafico.alto { height: 480px; } }
/* ---- tablet ---- */
@media (max-width: 1000px) {
  .mo-hero { padding: 20px 20px; } .mo-hero-acoes { margin-left: 0; width: 100%; }
  .mo-pagina .grade.g4, .mo-pagina .grade.g3 { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
  .mo-comp { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
}
/* ---- celular ---- */
@media (max-width: 700px) {
  .mo-hero h2 { font-size: 18px; } .mo-hero p { font-size: 12.5px; }
  .mo-hero-acoes > * { flex: 1 1 calc(50% - 8px); justify-content: center; }
  .mo-hero-selos { gap: 6px; margin-top: 10px; } .mo-selo { font-size: 11px; padding: 4px 9px; }
  .mo-secoes { flex-wrap: nowrap; overflow-x: auto; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; padding: 4px 2px 10px; margin-left: -2px; margin-right: -2px; scrollbar-width: none; }
  .mo-secoes::-webkit-scrollbar { display: none; }
  .mo-secao { flex: 0 0 auto; scroll-snap-align: start; }
  .mo-cab { gap: 8px; } .mo-tit { flex-basis: calc(100% - 52px); } .mo-acoes { width: 100%; justify-content: space-between; }
  .mo-seg { flex: 1 1 auto; } .mo-seg button { flex: 1 1 auto; padding: 8px 8px; }
  .mo-btn { width: 40px; height: 40px; }
  .mo-pagina .grade.g4, .mo-pagina .grade.g3 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .mo-pagina .kpi { padding-left: 8px; padding-right: 8px; } .mo-pagina .kpi .valor { font-size: 22px; }
  .mo-faixa { padding: 4px 12px 12px; } .mo-faixa-trilho input::-webkit-slider-thumb { width: 26px; height: 26px; margin-top: 2px; }
  .mo-tela-cab { padding: 10px 12px; } .mo-tela-corpo { padding: 8px 8px 12px; }
  .mo-comp { grid-template-columns: 1fr; }
}
@media (max-width: 420px) { .mo-pagina .grade.g4, .mo-pagina .grade.g3 { grid-template-columns: 1fr 1fr; } .mo-pagina .kpi .valor { font-size: 20px; } .mo-pagina .kpi .rotulo, .mo-pagina .kpi .rot { font-size: 10.5px; } }
@media print { .mo-acoes, .mo-hero-acoes, .mo-tela { display:none !important; } .mo-cartao { box-shadow:none; break-inside:avoid; } }
`;
  function injetarCss() {
    if (document.getElementById('mo-css')) return;
    const s = document.createElement('style');
    s.id = 'mo-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ------------------------------------------------------------------ ícones (24x24, traço) e logo
  const ICONES = {
    expandir: 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
    reduzir: 'M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3',
    imagem: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
    baixar: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    apresentar: 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 21h8M12 17v4M10 7.5l5 2.5-5 2.5z',
    pdf: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    comparar: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
    capital: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h.01M9 12h.01M9 15h.01M9 18h.01',
    grafico: 'M18 20V10M12 20V4M6 20v-6',
    linha: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    tabela: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
    fechar: 'M18 6L6 18M6 6l12 12',
    esq: 'M15 18l-6-6 6-6',
    dir: 'M9 18l6-6-6-6',
    mapa: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4zM8 2v16M16 6v16',
    pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    rank: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3a2 2 0 0 1-2 4M7 5H4a2 2 0 0 0 2 4',
    pessoas: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    relogio: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    atualizar: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
    play: 'M5 3l14 9-14 9z',
    pausa: 'M6 4h4v16H6zM14 4h4v16h-4z',
    livro: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z',
    texto: 'M4 6h16M4 12h16M4 18h10',
  };
  const NS = 'http://www.w3.org/2000/svg';
  function icone(nome, tam, cor) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', String(tam || 18)); s.setAttribute('height', String(tam || 18));
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', cor || 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', ICONES[nome] || ICONES.grafico);
    s.appendChild(p);
    return s;
  }
  /* A MARCA: um quadrado arredondado verde com três barras que sobem e a linha de uma série com o ponto do último valor. */
  function logo(tam) {
    tam = tam || 40;
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 48 48'); s.setAttribute('width', String(tam)); s.setAttribute('height', String(tam)); s.setAttribute('role', 'img'); s.setAttribute('aria-label', 'PNADC Resultados');
    s.innerHTML = '<defs><linearGradient id="mo-lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3d2b"/><stop offset="1" stop-color="#1fa36a"/></linearGradient></defs>' +
      '<rect width="48" height="48" rx="13" fill="url(#mo-lg)"/>' +
      '<rect x="10" y="27" width="6" height="11" rx="2" fill="#fff" opacity=".95"/><rect x="21" y="21" width="6" height="17" rx="2" fill="#fff" opacity=".95"/><rect x="32" y="14" width="6" height="24" rx="2" fill="#fff" opacity=".95"/>' +
      '<path d="M9 22 L19 15 L27 18 L38 8" fill="none" stroke="#9be7bd" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="38" cy="8" r="3.2" fill="#ffd166" stroke="#0b3d2b" stroke-width="1.2"/>';
    return s;
  }
  function desenharLogo(c, x, y, t) {
    const g = c.createLinearGradient(x, y, x + t, y + t); g.addColorStop(0, '#0b3d2b'); g.addColorStop(1, '#1fa36a');
    c.fillStyle = g; rr(c, x, y, t, t, t * 0.27); c.fill();
    const k = t / 48; c.fillStyle = '#fff';
    [[10, 27, 6, 11], [21, 21, 6, 17], [32, 14, 6, 24]].forEach(b => { rr(c, x + b[0] * k, y + b[1] * k, b[2] * k, b[3] * k, 2 * k); c.fill(); });
    c.strokeStyle = '#9be7bd'; c.lineWidth = 2.6 * k; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x + 9 * k, y + 22 * k); c.lineTo(x + 19 * k, y + 15 * k); c.lineTo(x + 27 * k, y + 18 * k); c.lineTo(x + 38 * k, y + 8 * k); c.stroke();
    c.fillStyle = '#ffd166'; c.beginPath(); c.arc(x + 38 * k, y + 8 * k, 3.2 * k, 0, 7); c.fill();
  }
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // ------------------------------------------------------------------ peças pequenas
  function el(tag, attrs) { return U.el.apply(null, arguments); }
  function botao(nomeIcone, titulo, aoClicar) {
    const b = U.el('button', { class: 'mo-btn', type: 'button', title: titulo, 'aria-label': titulo });
    b.appendChild(icone(nomeIcone, 17));
    b.addEventListener('click', ev => { ev.preventDefault(); aoClicar(b); });
    return b;
  }
  const CHAVE_MODOS = 'pnadc.modos';
  function modoLembrado(chave) { try { return (JSON.parse(localStorage.getItem(CHAVE_MODOS) || '{}'))[chave] || null; } catch (e) { return null; } }
  function lembrarModo(chave, modo) {
    try { const m = JSON.parse(localStorage.getItem(CHAVE_MODOS) || '{}'); m[chave] = modo; localStorage.setItem(CHAVE_MODOS, JSON.stringify(m)); } catch (e) { /* vale nesta aba */ }
  }
  /* seletor de modo (botões segmentados) */
  function seg(modos, atual, aoMudar) {
    const caixa = U.el('div', { class: 'mo-seg', role: 'group' });
    const bs = modos.map(m => {
      const b = U.el('button', { type: 'button', title: m.dica || m.rotulo, 'aria-pressed': String(m.valor === atual) }, m.rotulo);
      if (m.valor === atual) b.classList.add('on');
      b.addEventListener('click', () => { bs.forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); aoMudar(m.valor); });
      caixa.appendChild(b);
      return b;
    });
    return caixa;
  }
  /* SLIDER DE PERÍODO com dois cursores: escolhe [inicial, final] sobre os rótulos de uma série (índices inclusivos).
     `aoMudar([i0, i1])` é chamado ao arrastar. Devolve o elemento; `.redefinir(faixa)` atualiza de fora. */
  function faixaSlider(rot, atual, aoMudar) {
    const n = rot.length;
    const a = U.el('input', { type: 'range', min: 0, max: Math.max(0, n - 1), step: 1, value: atual[0], 'aria-label': 'Período inicial' });
    const b = U.el('input', { type: 'range', min: 0, max: Math.max(0, n - 1), step: 1, value: atual[1], 'aria-label': 'Período final' });
    const sel = U.el('div', { class: 'mo-faixa-sel' });
    const rotA = U.el('b', {}, ''), rotB = U.el('b', {}, '');
    const tudo = U.el('button', { type: 'button', title: 'Voltar a mostrar o período inteiro' }, 'Período inteiro');
    const pinta = () => {
      const x0 = +a.value, x1 = +b.value, m = Math.max(1, n - 1);
      sel.style.left = `calc(8px + (100% - 16px) * ${x0 / m})`; sel.style.width = `calc((100% - 16px) * ${(x1 - x0) / m})`;
      rotA.textContent = rot[x0]; rotB.textContent = rot[x1];
      tudo.hidden = x0 === 0 && x1 === n - 1;
    };
    const mudou = quem => {
      if (+a.value > +b.value) { if (quem === a) a.value = b.value; else b.value = a.value; }
      pinta(); aoMudar([+a.value, +b.value]);
    };
    a.addEventListener('input', () => mudou(a)); b.addEventListener('input', () => mudou(b));
    tudo.addEventListener('click', () => { a.value = 0; b.value = n - 1; pinta(); aoMudar([0, n - 1]); });
    const caixa = U.el('div', { class: 'mo-faixa' }, U.el('div', { class: 'mo-faixa-topo' }, 'Período em destaque: ', rotA, ' até ', rotB, tudo),
      U.el('div', { class: 'mo-faixa-trilho' }, sel, a, b));
    caixa.redefinir = f => { a.value = f[0]; b.value = f[1]; pinta(); };
    pinta();
    return caixa;
  }
  function limparGraficos(dentro) { try { if (typeof G !== 'undefined' && G.limparOrfaos) G.limparOrfaos(dentro); } catch (e) { /* já destruído */ } }
  function hojeBr() { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }

  // ------------------------------------------------------------------ aparência dos gráficos (por instância; não mexe em Chart.defaults, que é do kit)
  const GRADE = '#e6eeea', TXT = '#476258';
  function estilizar(ch, opc) {
    if (!ch || !ch.options) return ch;
    opc = opc || {};
    const o = ch.options;
    try {
      /* `ch.options` é um resolvedor (proxy) do Chart.js: nada de Object.assign/spread a partir dele (isso lê as chaves
         simbólicas e quebra); só ATRIBUIÇÕES de propriedade, que ele aceita. */
      o.animation = { duration: 450 };
      const lg = o.plugins.legend.labels;
      lg.usePointStyle = true; lg.pointStyle = 'circle'; lg.boxWidth = 8; lg.boxHeight = 8; lg.padding = 16; lg.color = TXT; lg.font = { size: 12.5, weight: '600' };
      const tp = o.plugins.tooltip;
      tp.backgroundColor = 'rgba(15,40,32,.94)'; tp.titleColor = '#fff'; tp.bodyColor = '#e8f5ee'; tp.padding = 11; tp.cornerRadius = 10; tp.boxPadding = 4;
      Object.keys(ch.scales || {}).forEach(k => {
        const sc = o.scales[k];
        if (!sc) return;
        sc.grid.color = k === 'x' && ch.config.type !== 'bar' ? 'transparent' : GRADE;
        sc.border.display = false;
        sc.ticks.color = TXT; sc.ticks.font = { size: 12 };
      });
      (ch.data.datasets || []).forEach((d, i) => {
        if (ch.config.type === 'line') {
          d.borderWidth = d.borderDash ? 2.4 : 3; d.tension = 0.32; d.pointBorderWidth = 2; d.pointHoverRadius = 7;
          const cor = d.borderColor;
          if (opc.area !== false && i === 0 && typeof cor === 'string') {
            d.fill = true;
            d.backgroundColor = c => {
              const a = c.chart.chartArea; if (!a) return cor + '22';
              const g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, cor + '55'); g.addColorStop(1, cor + '04'); return g;
            };
          }
        } else if (ch.config.type === 'bar') {
          d.borderRadius = 7; d.borderSkipped = false; d.maxBarThickness = 38;
        }
      });
      ch.update('none');
    } catch (e) { /* estilo nunca derruba o gráfico */ }
    return ch;
  }
  /* minigráfico de tendência para os cartões-resumo: valores (null = lacuna), cor da linha */
  function sparkline(vals, opc) {
    opc = opc || {};
    const w = opc.w || 132, h = opc.h || 34, v = vals.filter(x => x !== null && x !== undefined && !isNaN(x));
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', `0 0 ${w} ${h}`); s.setAttribute('width', String(w)); s.setAttribute('height', String(h)); s.setAttribute('class', 'mo-spark'); s.setAttribute('aria-hidden', 'true');
    if (v.length < 2) return s;
    const mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), fa = mx === mn ? 1 : mx - mn, cor = opc.cor || '#1b8a5a';
    const X = i => 3 + (w - 6) * i / (vals.length - 1), Y = x => h - 4 - (h - 8) * (x - mn) / fa;
    let d = '', ini = false, ult = -1;
    vals.forEach((x, i) => { if (x === null || x === undefined || isNaN(x)) { ini = false; return; } d += `${ini ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x).toFixed(1)} `; ini = true; ult = i; });
    const area = d + `L${X(ult).toFixed(1)} ${h} L${X(vals.findIndex(x => x !== null && x !== undefined && !isNaN(x))).toFixed(1)} ${h} Z`;
    s.innerHTML = `<path d="${area}" fill="${cor}" opacity=".12"/><path d="${d}" fill="none" stroke="${cor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${X(ult).toFixed(1)}" cy="${Y(vals[ult]).toFixed(1)}" r="3" fill="${cor}" stroke="#fff" stroke-width="1.5"/>`;
    return s;
  }

  // ------------------------------------------------------------------ cartão
  /* opc: { titulo, subtitulo, icone, ajuda, nome, superior: [Node], rodape: [Node], classe,
            desenhar(cont, ctx{modo, cheia, exportando}), modos: [{valor, rotulo, dica}], chave, modo0,
            fonteImagem: texto da fonte dentro do JPG, semCheia, semJpg, extras: [Node] (botões a mais),
            subtituloDe(modo) opcional: subtítulo que muda com o modo } */
  function cartao(opc) {
    injetarCss();
    const raiz = U.el('div', { class: 'mo-cartao ' + (opc.classe || '') });
    const modos = opc.modos || [];
    let modo = null;
    if (modos.length) {
      const lembrado = opc.chave ? modoLembrado(opc.chave) : null;
      modo = modos.some(m => m.valor === lembrado) ? lembrado : (modos.some(m => m.valor === opc.modo0) ? opc.modo0 : modos[0].valor);
    }
    let faixa = opc.faixa && opc.faixa.rotulos && opc.faixa.rotulos.length > 2 ? [0, opc.faixa.rotulos.length - 1] : null;
    const ctxBase = () => ({ modo, cheia: false, exportando: false, faixa });
    const sub = U.el('small', {}, '');
    const titulo = U.el('div', { class: 'mo-tit' }, U.el('h3', {}, opc.titulo), sub);
    const atualizarSub = () => { const t = opc.subtituloDe ? opc.subtituloDe(modo, faixa) : opc.subtitulo; sub.textContent = t || ''; sub.hidden = !t; };
    atualizarSub();
    const acoes = U.el('div', { class: 'mo-acoes' });
    const corpo = U.el('div', { class: 'mo-corpo' });
    const redesenhar = () => { limparGraficos(corpo); corpo.replaceChildren(); atualizarSub(); opc.desenhar(corpo, ctxBase()); };
    if (modos.length) acoes.appendChild(seg(modos, modo, v => { modo = v; if (opc.chave) lembrarModo(opc.chave, v); redesenhar(); }));
    (opc.extras || []).forEach(x => acoes.appendChild(x));
    if (!opc.semJpg) acoes.appendChild(botao('imagem', 'Baixar como imagem (JPG)', b => exportarJpg(opc, () => ({ modo, faixa }), b)));
    let slider = null;
    if (!opc.semCheia) acoes.appendChild(botao('expandir', 'Abrir em tela cheia (dar foco)', () => abrirCheia(opc, () => ({ modo, faixa }),
      e => { modo = e.modo; faixa = e.faixa; if (opc.chave) lembrarModo(opc.chave, modo); if (slider && faixa) slider.redefinir(faixa); redesenhar(); })));
    const cab = U.el('div', { class: 'mo-cab' }, U.el('div', { class: 'mo-ic' }, icone(opc.icone || 'grafico', 19)), titulo, acoes);
    raiz.appendChild(cab);
    if (opc.superior && opc.superior.length) raiz.appendChild(U.el('div', { class: 'mo-sup' }, ...opc.superior.filter(Boolean)));
    raiz.appendChild(corpo);
    if (faixa) { slider = faixaSlider(opc.faixa.rotulos, faixa, f => { faixa = f; redesenhar(); }); raiz.appendChild(slider); }
    if (opc.rodape && opc.rodape.length) raiz.appendChild(U.el('div', { class: 'mo-rodape' }, ...opc.rodape.filter(Boolean)));
    if (opc.ajuda) raiz.appendChild(U.el('div', { class: 'mo-rodape' }, U.el('div', { class: 'mo-ajuda' }, opc.ajuda)));
    // o desenho espera o cartão entrar no DOM (Chart.js mede o contêiner)
    opc.desenhar(corpo, ctxBase());
    raiz._mo = { redesenhar, modo: () => modo, faixa: () => faixa };
    return raiz;
  }

  // ------------------------------------------------------------------ tela cheia
  let aberta = null;
  function fecharCheia() {
    if (!aberta) return;
    const a = aberta; aberta = null;
    document.removeEventListener('keydown', a.tecla, true);
    document.removeEventListener('fullscreenchange', a.fsmudou);
    limparGraficos(a.corpo);
    try { if (document.fullscreenElement === a.tela && document.exitFullscreen) document.exitFullscreen(); } catch (e) { /* ok */ }
    a.tela.remove();
    document.body.classList.remove('mo-sem-rolagem');
    window.dispatchEvent(new Event('resize'));
    if (a.foco && a.foco.focus) { try { a.foco.focus(); } catch (e) { /* ok */ } }
  }
  function abrirCheia(opc, estadoAtual, aoMudar) {
    if (aberta) fecharCheia();
    injetarCss();
    let modo = estadoAtual().modo, faixa = estadoAtual().faixa;
    const modos = opc.modos || [];
    const corpo = U.el('div', { class: 'mo-tela-corpo' });
    const sub = U.el('small', {}, '');
    const atualizarSub = () => { const t = opc.subtituloDe ? opc.subtituloDe(modo, faixa) : opc.subtitulo; sub.textContent = t || ''; sub.hidden = !t; };
    const desenhar = () => { limparGraficos(corpo); corpo.replaceChildren(); atualizarSub(); opc.desenhar(corpo, { modo, cheia: true, exportando: false, faixa }); };
    const acoes = U.el('div', { class: 'mo-acoes' });
    if (modos.length) acoes.appendChild(seg(modos, modo, v => { modo = v; aoMudar({ modo, faixa }); desenhar(); }));
    if (!opc.semJpg) acoes.appendChild(botao('imagem', 'Baixar como imagem (JPG)', b => exportarJpg(opc, () => ({ modo, faixa }), b)));
    acoes.appendChild(botao('fechar', 'Fechar (Esc)', fecharCheia));
    const tela = U.el('div', { class: 'mo-tela mo-pagina', role: 'dialog', 'aria-modal': 'true', 'aria-label': opc.titulo },
      U.el('div', { class: 'mo-tela-cab' }, U.el('div', { class: 'mo-ic' }, icone(opc.icone || 'grafico', 20)), U.el('div', { class: 'mo-tit' }, U.el('h3', {}, opc.titulo), sub), acoes),
      corpo,
      faixa ? faixaSlider(opc.faixa.rotulos, faixa, f => { faixa = f; aoMudar({ modo, faixa }); desenhar(); }) : null,
      opc.fonteImagem ? U.el('div', { class: 'mo-tela-rodape' }, opc.fonteImagem) : null);
    const a = { tela, corpo, foco: document.activeElement,
      tecla: ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fecharCheia(); } },
      fsmudou: () => { if (!document.fullscreenElement && aberta && aberta.tela === tela && aberta.usouFs) fecharCheia(); } };
    aberta = a;
    document.body.appendChild(tela);
    document.body.classList.add('mo-sem-rolagem');
    document.addEventListener('keydown', a.tecla, true);
    try {
      if (tela.requestFullscreen) {
        const p = tela.requestFullscreen();
        if (p && p.then) p.then(() => { a.usouFs = true; document.addEventListener('fullscreenchange', a.fsmudou); }, () => { /* painel fixo basta */ });
      }
    } catch (e) { /* painel fixo basta */ }
    desenhar();
    setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
  }

  // ------------------------------------------------------------------ exportação em JPG
  const FONTE_IMG = '"Segoe UI", Arial, sans-serif';
  function quebrar(c, txt, largura) {
    const out = [];
    String(txt || '').split('\n').forEach(par => {
      let l = '';
      par.split(' ').forEach(w => { const t = l ? l + ' ' + w : w; if (c.measureText(t).width > largura && l) { out.push(l); l = w; } else l = t; });
      out.push(l);
    });
    return out;
  }
  /* desenha o cartão FORA DA TELA, num tamanho fixo, e devolve o que sobrou no contêiner */
  function desenharForaDaTela(opc, modo, faixa) {
    const fora = U.el('div', { class: 'mo-fora mo-pagina' });
    document.body.appendChild(fora);
    opc.desenhar(fora, { modo, cheia: true, exportando: true, faixa: faixa || null });
    // gráficos: sem animação e já no estado final
    fora.querySelectorAll('canvas').forEach(cv => { try { const ch = window.Chart && Chart.getChart(cv); if (ch) { ch.options.animation = false; ch.resize(); ch.update('none'); } } catch (e) { /* ok */ } });
    return fora;
  }
  function tabelaParaCanvas(tab, W) {
    const ths = Array.from(tab.querySelectorAll('thead th')), linhas = Array.from(tab.querySelectorAll('tbody tr'));
    const cabec = ths.map(t => t.innerText.replace(/[▲▼]/g, '').trim());
    const max = 38, usadas = linhas.slice(0, max);
    const dados = usadas.map(tr => Array.from(tr.children).map(td => {
      const f = td.querySelector('[style*="color"]');
      return { t: td.innerText.replace(/\s+/g, ' ').trim(), cor: f && f.style && f.style.color ? f.style.color : '#243b53', num: td.classList.contains('num') };
    }));
    const cv = document.createElement('canvas'), c = cv.getContext('2d'), px = 20, h = 46;
    c.font = `600 ${px}px ${FONTE_IMG}`;
    const larg = cabec.map((t, i) => Math.max(c.measureText(t).width, ...dados.map(l => (l[i] ? c.measureText(l[i].t).width : 0))) + 34);
    const soma = larg.reduce((a, b) => a + b, 0), esc = soma > W ? W / soma : 1;
    const ws = larg.map(x => x * esc), total = ws.reduce((a, b) => a + b, 0);
    cv.width = Math.round(Math.max(total, W)); cv.height = Math.round(h * (dados.length + 1) + 6 + (linhas.length > max ? 40 : 0));
    const f = esc < 1 ? Math.max(13, Math.floor(px * esc)) : px;
    c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#eaf3ee'; c.fillRect(0, 0, cv.width, h);
    c.textBaseline = 'middle';
    let x = 0;
    cabec.forEach((t, i) => { c.fillStyle = '#2b4a3e'; c.font = `800 ${f}px ${FONTE_IMG}`; c.textAlign = i ? 'right' : 'left'; c.fillText(t, i ? x + ws[i] - 14 : x + 14, h / 2); x += ws[i]; });
    dados.forEach((l, k) => {
      const y = h * (k + 1);
      if (k % 2) { c.fillStyle = '#f7faf8'; c.fillRect(0, y, cv.width, h); }
      c.strokeStyle = '#e8efeb'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, y + h); c.lineTo(cv.width, y + h); c.stroke();
      let xx = 0;
      l.forEach((cel, i) => { c.fillStyle = cel.cor; c.font = `${i === 0 || cel.cor !== '#243b53' ? 700 : 500} ${f}px ${FONTE_IMG}`; c.textAlign = i && cel.num !== false && i > 0 ? 'right' : 'left';
        if (i === 0) c.textAlign = 'left'; else if (!cel.num) c.textAlign = 'right';
        c.fillText(cel.t, c.textAlign === 'right' ? xx + ws[i] - 14 : xx + 14, y + h / 2); xx += ws[i]; });
    });
    if (linhas.length > max) { c.fillStyle = '#587068'; c.font = `600 ${f}px ${FONTE_IMG}`; c.textAlign = 'left'; c.fillText(`… e mais ${linhas.length - max} linha(s): veja a tabela completa na tela ou no CSV.`, 14, h * (dados.length + 1) + 22); }
    return cv;
  }
  function textoParaCanvas(raiz, W) {
    const cv = document.createElement('canvas'), c = cv.getContext('2d');
    c.font = `500 24px ${FONTE_IMG}`;
    const blocos = Array.from(raiz.querySelectorAll('p, li, h3, h4')).map(n => ({ t: n.innerText.replace(/\s+/g, ' ').trim(), li: n.tagName === 'LI', tit: /^H/.test(n.tagName) })).filter(b => b.t);
    let linhas = [];
    blocos.forEach(b => { c.font = `${b.tit ? 800 : 500} 24px ${FONTE_IMG}`; quebrar(c, (b.li ? '• ' : '') + b.t, W - 20).forEach((l, i) => linhas.push({ l, tit: b.tit, fim: false })); linhas.push({ l: '', fim: true }); });
    const lh = 36; cv.width = W; cv.height = Math.max(120, linhas.length * lh + 10);
    c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.textBaseline = 'top';
    linhas.forEach((x, i) => { c.fillStyle = x.tit ? '#14302a' : '#243b53'; c.font = `${x.tit ? 800 : 500} 24px ${FONTE_IMG}`; c.fillText(x.l, 10, 5 + i * lh); });
    return cv;
  }
  /* título + subtítulo + conteúdo + fonte/data/marca, tudo DENTRO da imagem (o gráfico da tela não leva isso) */
  function compor(info, conteudo) {
    const W = 1600, P = 56, L = W - 2 * P;
    const medida = document.createElement('canvas').getContext('2d');
    medida.font = `800 38px ${FONTE_IMG}`; const tl = quebrar(medida, info.titulo || '', L - 76).slice(0, 2);
    medida.font = `500 22px ${FONTE_IMG}`; const sl = info.subtitulo ? quebrar(medida, info.subtitulo, L - 76).slice(0, 2) : [];
    medida.font = `500 19px ${FONTE_IMG}`; const fl = quebrar(medida, info.fonte || '', L).slice(0, 3);
    const cab = 36 + tl.length * 46 + (sl.length ? sl.length * 30 + 4 : 0) + 26;
    const esc = L / conteudo.width, hc = Math.round(conteudo.height * esc);
    const rod = 22 + fl.length * 26 + 34;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = cab + hc + rod + 20;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, cv.height);
    const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#0b3d2b'); g.addColorStop(1, '#1fa36a'); c.fillStyle = g; c.fillRect(0, 0, W, 10);
    desenharLogo(c, P, 34, 56);
    c.textBaseline = 'top'; c.textAlign = 'left';
    let y = 30; c.fillStyle = '#14302a'; c.font = `800 38px ${FONTE_IMG}`; tl.forEach(l => { c.fillText(l, P + 76, y); y += 46; });
    c.fillStyle = '#587068'; c.font = `500 22px ${FONTE_IMG}`; sl.forEach(l => { c.fillText(l, P + 76, y); y += 30; });
    c.drawImage(conteudo, P, cab, L, hc);
    c.strokeStyle = '#e1e9e4'; c.lineWidth = 2; c.beginPath(); c.moveTo(P, cab + hc + 12); c.lineTo(W - P, cab + hc + 12); c.stroke();
    c.fillStyle = '#587068'; c.font = `500 19px ${FONTE_IMG}`; let yy = cab + hc + 24; fl.forEach(l => { c.fillText(l, P, yy); yy += 26; });
    c.font = `700 19px ${FONTE_IMG}`; c.fillStyle = '#0f5132'; c.textAlign = 'right'; c.fillText(`PNADC Resultados · ${hojeBr()}`, W - P, yy + 4);
    return cv;
  }
  /* devolve a imagem (canvas) do cartão: o mesmo que o JPG baixa. Útil para o PDF e para a apresentação. */
  function imagemDoCartao(opc, modo, faixa) {
    const fora = desenharForaDaTela(opc, modo, faixa);
    try {
      const grafico = fora.querySelector('canvas'), tabela = fora.querySelector('table.tabela');
      let conteudo;
      if (grafico && grafico.width > 10) { conteudo = document.createElement('canvas'); conteudo.width = grafico.width; conteudo.height = grafico.height; const c = conteudo.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, conteudo.width, conteudo.height); c.drawImage(grafico, 0, 0); }
      else if (tabela) conteudo = tabelaParaCanvas(tabela, 1488);
      else conteudo = textoParaCanvas(fora, 1488);
      const sub = opc.subtituloDe ? opc.subtituloDe(modo, faixa) : opc.subtitulo;
      return compor({ titulo: opc.titulo, subtitulo: sub, fonte: opc.fonteImagem || 'Fonte: IBGE, PNAD Contínua (SIDRA).' }, conteudo);
    } finally { limparGraficos(fora); fora.remove(); }
  }
  function baixarCanvas(cv, nome, tipo, qualidade) {
    return new Promise(res => {
      cv.toBlob(bl => {
        const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = nome;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); res(bl);
      }, tipo || 'image/jpeg', qualidade || 0.92);
    });
  }
  const nomeArq = s => String(s || 'imagem').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'imagem';
  function exportarJpg(opc, estadoAtual, botaoEl) {
    if (botaoEl) botaoEl.disabled = true;
    // dá um respiro para o botão mostrar o estado antes do trabalho síncrono
    setTimeout(() => {
      try {
        const est = estadoAtual(), cv = imagemDoCartao(opc, est.modo, est.faixa);
        baixarCanvas(cv, `${nomeArq(opc.nome || opc.titulo)}.jpg`, 'image/jpeg', 0.92).then(() => { if (typeof AMBIENTE !== 'undefined' && AMBIENTE.toast) AMBIENTE.toast('Imagem JPG gerada.', 'ok', 2500); });
      } catch (e) {
        console.error(e);
        if (typeof AMBIENTE !== 'undefined' && AMBIENTE.toast) AMBIENTE.toast('Não consegui gerar a imagem: ' + e.message, 'erro', 6000);
      } finally { if (botaoEl) botaoEl.disabled = false; }
    }, 30);
  }

  // ------------------------------------------------------------------ cabeçalho da página
  /* opc: { titulo, subtitulo, selos: [{rotulo, valor}], acoes: [Node] } */
  function hero(opc) {
    injetarCss();
    const topo = U.el('div', { class: 'mo-hero-topo' },
      opc.semLogo ? null : U.el('div', { style: { display: 'flex', flex: '0 0 auto' } }, logo(46)),
      U.el('div', { style: { minWidth: 0, flex: '1 1 260px' } }, U.el('h2', {}, opc.titulo), opc.subtitulo ? U.el('p', {}, opc.subtitulo) : null),
      opc.acoes && opc.acoes.length ? U.el('div', { class: 'mo-hero-acoes' }, ...opc.acoes.filter(Boolean)) : null);
    const caixa = U.el('div', { class: 'mo-hero' }, topo);
    if (opc.selos && opc.selos.length) caixa.appendChild(U.el('div', { class: 'mo-hero-selos' }, ...opc.selos.filter(Boolean).map(s => U.el('span', { class: 'mo-selo' }, s.rotulo ? s.rotulo + ' ' : '', U.el('b', {}, s.valor)))));
    return caixa;
  }
  /* botão para o cabeçalho (tem ícone) */
  function botaoHero(rotulo, nomeIcone, aoClicar, primario) {
    const b = U.el('button', { class: 'mo-btn-hero' + (primario ? ' primario' : ''), type: 'button' });
    b.setAttribute('title', rotulo); b.appendChild(icone(nomeIcone, 16)); b.appendChild(U.el('span', { class: 'mo-btn-rot' }, rotulo));
    b.addEventListener('click', ev => { ev.preventDefault(); aoClicar(b); });
    return b;
  }

  // ------------------------------------------------------------------ dica ao passar o mouse (ou focar) em qualquer ícone
  /* Todo botão/ícone com "title" mostra uma dica estilizada na hora (o "title" nativo demora e some). A barra lateral da casca
     tem a própria dica (#tip-nav) e fica de fora. */
  function ligarDicas() {
    if (typeof document === 'undefined' || document.__moDicas) return;
    document.__moDicas = true;
    let tip = null, alvo = null;
    const esconder = () => { alvo = null; if (tip) tip.style.display = 'none'; };
    const mostrar = el => {
      if (el.closest('#nav')) return;
      let t = el.getAttribute('data-mo-dica');
      if (el.hasAttribute('title')) { t = el.getAttribute('title') || t; if (t) el.setAttribute('data-mo-dica', t); el.removeAttribute('title'); }
      if (!t) return;
      if (!tip) { tip = U.el('div', { class: 'mo-tip', role: 'tooltip' }); document.body.appendChild(tip); }
      alvo = el; tip.textContent = t; tip.style.display = 'block';
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      let x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
      let y = r.bottom + 8; if (y + h > window.innerHeight - 6) y = Math.max(6, r.top - h - 8);
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    const acha = ev => ev.target && ev.target.closest ? ev.target.closest('[title],[data-mo-dica]') : null;
    document.addEventListener('mouseover', ev => { const el = acha(ev); if (el && el !== alvo) mostrar(el); else if (!el) esconder(); });
    document.addEventListener('focusin', ev => { const el = acha(ev); if (el) mostrar(el); });
    document.addEventListener('focusout', esconder);
    document.addEventListener('mousedown', esconder);
    document.addEventListener('scroll', esconder, true);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') esconder(); });
  }

  /* Cores dos DADOS que não são situação publicada: foco em azul forte, o resto em azuis legíveis (nunca cinza claro).
     Verde e vermelho ficam reservados à situação publicada pelo IBGE (significativa); "estavel" é o neutro azul-ardósia. */
  const COR = { foco: '#1a5fb4', regiao: '#5b9bd5', demais: '#8fb7e6', estavel: '#8199ad', brasil: '#37474f' };

  injetarCss();
  ligarDicas();
  return { COR, cartao, faixaSlider, icone, logo, desenharLogo, hero, botaoHero, seg, sparkline, estilizar, injetarCss, fecharCheia, imagemDoCartao, compor, baixarCanvas, nomeArq,
    tabelaParaCanvas, quebrar, hojeBr, modoLembrado, lembrarModo, ICONES, _cheiaAberta: () => !!aberta };
})();
