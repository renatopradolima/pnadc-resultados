/* SuperC -- utilidades compartilhadas (formatação, agregação, tabelas). */
'use strict';

const U = (() => {
  const NOME_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const NOME_MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const DIA_SEMANA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  // Tipos de entrevista (Manual PNADC, seção 7.3): grupo A = domicílios
  // ocupados (entrevista realizada ou não), B = sem entrevista por estarem
  // vagos/ocupados por não abrangidos, C = não existem mais como habitação
  // ou estão fora da área.
  /* SEMÁFORO SEMÂNTICO (achado do usuário, 10/09/2026: "Iniciar entrevista"
     aparecia em vermelho, cor de coisa ruim). A cor carrega juízo, e o
     juízo é sempre o mesmo em todo o sistema:
       verde    -- desfecho desejado (a entrevista anda ou se completa);
       amarelo  -- pendência contornável (volte outro dia e resolve);
       vermelho -- perda (recusa, e o que fecha a porta de vez);
       azul     -- fato estrutural do cadastro, sem culpa nem mérito
                   (vago, uso ocasional, coletivo, não residencial);
       marrom   -- o domicílio deixou de existir (demolido, ruína);
       cinza    -- sem informação (indefinida, não iniciada).
     Dimensões de IDENTIDADE (entrevistador, agência, mês, semana, dia)
     seguem com paleta arbitrária: ali cor nenhuma quer dizer bom ou ruim. */
  const COR = {
    bom: '#2e9e5b', bomForte: '#1b7a44', atencao: '#f2b705', atencaoForte: '#e08b00',
    ruim: '#d8392b', ruimClaro: '#e2703a', estrutura: '#1a73e8', estrutura2: '#5c85c9',
    estrutura3: '#7e57c2', sumiu: '#8d6e63', sumiuForte: '#5d4037', neutro: '#b0bec5', neutro2: '#cfd8dc', neutro3: '#78909c',
  };
  const TIPOS = [
    { nome: 'Realizada', grupo: 'A', codigo: 'A01', cor: COR.bom, icone: '✔' },
    { nome: 'Domicilio Fechado', grupo: 'A', codigo: 'A02', cor: COR.atencao, icone: '⌂' },
    { nome: 'Recusa', grupo: 'A', codigo: 'A03', cor: COR.ruim, icone: '✖' },
    { nome: 'Outro motivo', grupo: 'A', codigo: 'A04', cor: COR.ruimClaro, icone: '…' },
    { nome: 'Indefinida', grupo: 'N', codigo: 'A00', cor: COR.neutro, icone: '?' },
    { nome: 'Não iniciada', grupo: 'N', codigo: '---', cor: COR.neutro2, icone: '○' },
    { nome: 'Domicilio vago', grupo: 'B', codigo: 'B05', cor: COR.estrutura2, icone: '○' },
    { nome: 'Domicilio de uso ocasional', grupo: 'B', codigo: 'B06', cor: COR.estrutura3, icone: '◐' },
    { nome: 'Domicilio coletivo ou improvisado', grupo: 'B', codigo: 'B07', cor: '#26a69a', icone: '⌂' },
    { nome: 'Domicilio em obras ou em ruinas', grupo: 'B', codigo: 'B08', cor: COR.sumiu, icone: '⚒' },
    { nome: 'Domicilio demolido', grupo: 'C', codigo: 'C09', cor: COR.sumiuForte, icone: '▼' },
    { nome: 'Domicilio nao encontrado', grupo: 'C', codigo: 'C10', cor: COR.neutro3, icone: '⚐' },
    { nome: 'Unidade nao residencial', grupo: 'C', codigo: 'C11', cor: '#546e7a', icone: '▣' },
    { nome: 'Domicilio fora do setor', grupo: 'C', codigo: 'C12', cor: '#37474f', icone: '⇱' },
  ];
  const TIPO_POR_NOME = new Map(TIPOS.map(t => [t.nome.toLowerCase(), t]));
  const ROTULO_TIPO = {
    'Realizada': 'Realizada', 'Domicilio Fechado': 'Domicílio fechado', 'Recusa': 'Recusa', 'Outro motivo': 'Outro motivo',
    'Indefinida': 'Indefinida', 'Domicilio vago': 'Domicílio vago', 'Domicilio de uso ocasional': 'Uso ocasional',
    'Domicilio coletivo ou improvisado': 'Coletivo ou improvisado', 'Domicilio em obras ou em ruinas': 'Obras ou ruínas',
    'Domicilio demolido': 'Demolido', 'Domicilio nao encontrado': 'Não encontrado', 'Unidade nao residencial': 'Não residencial',
    'Domicilio fora do setor': 'Fora do setor', 'Não iniciada': 'Não iniciada',
  };
  /* O controle é o código do setor censitário do IBGE: os dois primeiros
     dígitos são a UF. É daí que sai a UF de cada domicílio -- o SIGC não
     manda a sigla, e o sistema pode rodar em qualquer estado. */
  const UF_POR_CODIGO = {
    '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
    '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
    '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS',
    '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
  };
  function ufDoControle(controle) { return controle ? (UF_POR_CODIGO[String(controle).slice(0, 2)] || null) : null; }

  const GRUPO_COR = { A: COR.estrutura, B: COR.estrutura3, C: COR.neutro3, N: COR.neutro2 };
  const GRUPO_ROTULO = { A: 'A — ocupados (abrangidos)', B: 'B — vagos ou não abrangidos', C: 'C — não existem ou fora da área', N: 'Não iniciada / pendente' };
  const PALETA = ['#1a73e8', '#f29900', '#34a853', '#d93025', '#9c27b0', '#00acc1', '#ff7043', '#8d6e63', '#5c6bc0', '#c0ca33',
    '#ec407a', '#26a69a', '#7e57c2', '#fbc02d', '#78909c', '#43a047', '#e53935', '#3949ab', '#00897b', '#6d4c41',
    '#d81b60', '#039be5', '#fdd835', '#8e24aa', '#f4511e', '#7cb342', '#546e7a', '#1e88e5', '#ffb300', '#5e35b1', '#00bfa5', '#c62828'];

  function tipoInfo(nome) { return TIPO_POR_NOME.get(String(nome || '').toLowerCase()) || { nome, grupo: '?', cor: '#999', icone: '•' }; }
  function corTipo(nome) { return tipoInfo(nome).cor; }
  function grupoTipo(nome) { return tipoInfo(nome).grupo; }
  function rotuloTipo(nome) { return ROTULO_TIPO[nome] || nome || '(sem tipo)'; }
  function iconeTipo(nome) { return `<span class="icone-tipo" style="color:${corTipo(nome)}" title="${esc(rotuloTipo(nome))}">${tipoInfo(nome).icone}</span>`; }

  const corCache = new Map();
  function corCategoria(chave) {
    if (!corCache.has(chave)) corCache.set(chave, PALETA[corCache.size % PALETA.length]);
    return corCache.get(chave);
  }

  /* --------------------------------------------------- cores com significado
     O texto do motivo/tipo de abordagem vem escrito por extenso do DMC e
     muda de redação entre versões do sistema. Por isso a cor sai de
     PALAVRAS-CHAVE sobre o texto sem acento, não de uma lista fechada de
     frases: "Responsável pelo domicílio recusou-se a prestar informação" e
     um futuro "Recusa do morador" caem os dois no vermelho. */
  function semAcento(v) { return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  const REGRA_MOTIVO = [
    [/inicia(r|da|ndo)? a entrevista|entrevista (realizada|iniciada)|iniciar entrevista/, COR.bom],
    [/agendad|remarcad|retorn/, COR.bomForte],
    [/ausente|nao (foi )?encontrad[oa] o (respons|morador)|ninguem|fechado/, COR.atencao],
    [/recus/, COR.ruim],
    [/sem sucesso|nao atende|telefone invalid|impossibilitad|incapacitad/, COR.ruimClaro],
    [/vago|desocupad/, COR.estrutura2],
    [/uso ocasional|veranei/, COR.estrutura3],
    [/coletivo|improvisad/, '#26a69a'],
    [/demolid/, COR.sumiuForte],
    [/construcao|ruina|obras/, COR.sumiu],
    [/nao (e )?residencial|comercial/, '#546e7a'],
    [/nao foi encontrado|nao encontrado|inexistente/, COR.neutro3],
    [/fora do setor/, '#37474f'],
    [/outro motivo|outros/, COR.neutro],
  ];
  function corMotivo(nome) {
    if (vazio(nome)) return COR.neutro2;
    const t = semAcento(nome);
    for (const [re, cor] of REGRA_MOTIVO) if (re.test(t)) return cor;
    return corCategoria('mot:' + nome);
  }

  /* Fluxo do SIGC: quanto mais adiantado, mais verde; o que trava, vermelho. */
  const COR_STATUS = {
    'codificado': COR.bom, 'enviado para carga': COR.bomForte, 'liberado para codificacao': '#5ab08a',
    'distribuido': COR.neutro2, 'descarregado': COR.atencao, 'descarregado parcialmente': COR.atencaoForte,
    'nao codificavel': COR.ruim,
  };
  function corStatus(nome) { return COR_STATUS[semAcento(nome)] || (vazio(nome) ? COR.neutro2 : corCategoria('st:' + nome)); }

  /* GPS × setor: dentro é o certo (verde), setor vizinho da mesma UPA é
     aviso (amarelo), fora da UPA é erro (vermelho), sem malha/sem GPS é
     falta de informação (cinza). */
  const COR_SETOR = {
    'dentro do setor': COR.bom, 'outro setor da mesma upa': COR.atencao, 'fora da upa': COR.ruim,
    'setor sem malha': COR.estrutura3, 'sem gps': COR.neutro,
  };
  function corSetorRot(v) { return COR_SETOR[semAcento(v)] || COR.neutro; }

  /* Visita × telefone não têm juízo de valor: são meios, ambos válidos. */
  function corOrigem(v) { const t = semAcento(v); return t.includes('telefon') ? '#00897b' : t.includes('sessao') ? '#7b3fa0' : COR.estrutura; }

  const fmtIntBR = new Intl.NumberFormat('pt-BR');
  function fmtInt(n) { return (n === null || n === undefined || Number.isNaN(n)) ? '–' : fmtIntBR.format(Math.round(n)); }
  function fmtNum(n, d = 1) { return (n === null || n === undefined || Number.isNaN(n)) ? '–' : n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function fmtPct(x, d = 1) { return (x === null || x === undefined || Number.isNaN(x)) ? '–' : (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; }
  function fmtMin(seg) {
    if (seg === null || seg === undefined || Number.isNaN(seg)) return '–';
    const s = Math.abs(Math.round(seg)); const m = Math.floor(s / 60); const r = s % 60;
    return (seg < 0 ? '-' : '') + m + ':' + String(r).padStart(2, '0');
  }
  function fmtHms(seg) {
    if (seg === null || seg === undefined || Number.isNaN(seg)) return '–';
    const s = Math.abs(Math.round(seg)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
    return (seg < 0 ? '-' : '') + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }
  /* Sequência de dias corridos entre duas datas ISO (inclusive). Usada pelo
     painel de produtividade para mostrar TAMBÉM os dias sem abordagem: um
     dia em branco é informação (folga, feriado ou entrevistador parado). */
  function diasEntre(inicio, fim) {
    const saida = [];
    if (!inicio || !fim) return saida;
    const d = new Date(inicio + 'T12:00:00'); const ate = new Date(fim + 'T12:00:00');
    while (d <= ate && saida.length < 400) { saida.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
    return saida;
  }
  /* Distância em metros entre dois pontos (haversine). Serve para o
     deslocamento entre abordagens seguidas do mesmo entrevistador: o
     servidor calcula distância a setor e a CNEFE, mas a distância ENTRE
     abordagens só faz sentido na tela, depois dos filtros. */
  function distanciaM(lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some(v => v === null || v === undefined || Number.isNaN(v))) return null;
    const R = 6371000, r = Math.PI / 180;
    const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  /* Endereço sem o complemento: "RUA NATAL 2658 FRENTE MADEIRA" vira
     "RUA NATAL 2658". Dois domicílios com a mesma base e complementos
     diferentes são um condomínio ou uma casa de fundos -- GPS igual ali é
     legítimo. Sem número, a base é o logradouro sem os marcadores de
     complemento. */
  const MARCA_COMPLEMENTO = /^(APTO?|APT|APARTAMENTO|BL|BLOCO|CS|CASA|QD|QUADRA|LT|LOTE|FUNDOS?|FRENTE|ANDAR|SALA|LOJA|ED|EDIF|EDIFICIO|COND|CONDOMINIO|TORRE|UNID|UNIDADE|KM|GALPAO|SOBRADO|BOX|CX|CAIXA)$/;
  function enderecoBase(txt) {
    const tokens = semAcento(txt).toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const iNum = tokens.findIndex((t, i) => i > 0 && (/^\d+[A-Z]?$/.test(t) || t === 'SN'));
    if (iNum > 0) return tokens.slice(0, iNum + 1).join(' ');
    const iMarca = tokens.findIndex(t => MARCA_COMPLEMENTO.test(t));
    return (iMarca > 0 ? tokens.slice(0, iMarca) : tokens).join(' ');
  }
  function logradouroDe(txt) {
    const base = enderecoBase(txt).split(' ');
    return (/^\d+[A-Z]?$/.test(base[base.length - 1]) || base[base.length - 1] === 'SN') ? base.slice(0, -1).join(' ') : base.join(' ');
  }

  /* Nome do entrevistador com o que a equipe informou sobre ele (por
     período): supervisor, % em outras tarefas, afastamento. Sem data, vale
     o estado de hoje; a dica traz todos os períodos. Usado em tabela,
     gráfico, filtro e legenda, para a informação da equipe estar evidente
     em qualquer lugar que mostre dados por entrevistador. */
  function infoEnt(nome, data) { return (typeof DADOS !== 'undefined' && DADOS.infoEntrevistador) ? DADOS.infoEntrevistador(nome, data) : { supervisor: false, outrasPct: 0, afastado: null, inativo: null, periodos: [] }; }
  function rotuloEnt(nome, data) {
    const i = infoEnt(nome, data); const base = rotuloValor(nome, '(sem entrevistador)');
    return base + (i.supervisor ? ' [supervisor]' : '') + (i.outrasPct ? ` [${i.outrasPct}% outras tarefas]` : '') + (i.afastado ? ` [afastado: ${i.afastado}]` : '') + (i.inativo ? ' [inativo]' : '');
  }
  function entrevistadorHtml(nome, data) {
    const i = infoEnt(nome, data);
    const dica = i.periodos.length ? esc(i.periodos.map(p => p.texto).join(' · ')) : '';
    // o nome é link: leva à página da equipe, já com a pessoa escolhida
    // a FOTO da pessoa (avatar do drive) ou a inicial do nome vem antes dele
    // (`app/js/fotos.js`, 25/10/2026): toda tabela de entrevistador passa por aqui
    const foto = (!vazio(nome) && typeof FOTOS !== 'undefined') ? FOTOS.html(nome) : '';
    const nomeHtml = vazio(nome) ? esc(rotuloValor(nome, '(sem entrevistador)'))
      : `${foto}<a class="pessoa" data-pessoa="${esc(nome)}" title="abrir o cadastro da equipe desta pessoa">${esc(nome)}</a>`;
    return nomeHtml +
      (i.supervisor ? ` <span class="selo neutro" title="${dica}">supervisor</span>` : '') +
      (i.outrasPct ? ` <span class="selo alerta" title="${dica}">${i.outrasPct}% outras</span>` : '') +
      (i.afastado ? ` <span class="selo ruim" title="${dica}">afastado: ${esc(i.afastado)}</span>` : '') +
      (i.inativo ? ` <span class="selo neutro" title="${dica}">inativo</span>` : '') +
      (!i.supervisor && !i.outrasPct && !i.afastado && !i.inativo && i.periodos.length ? ` <span class="selo neutro" title="${dica}">períodos</span>` : '');
  }

  function horasEntre(iniIso, fimIso) {
    if (!iniIso || !fimIso) return null;
    const h = (new Date(fimIso.replace(' ', 'T')) - new Date(iniIso.replace(' ', 'T'))) / 3600000;
    return Number.isNaN(h) ? null : h;
  }
  function diaDaSemana(iso) { return iso ? new Date(iso + 'T12:00:00').getDay() : null; }
  function fimDeSemana(iso) { const d = diaDaSemana(iso); return d === 0 || d === 6; }

  function fmtData(iso) { if (!iso) return '–'; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; }
  function fmtDataHora(iso) { if (!iso) return '–'; return fmtData(iso) + ' ' + iso.slice(11, 16); }
  function fmtMes(ano, mes) { return `${NOME_MES[mes - 1]}/${ano}`; }
  function fmtMesLongo(ano, mes) { return `${NOME_MES_LONGO[mes - 1]} de ${ano}`; }
  function fmtPeriodo(chave) { const [a, m] = chave.split('-'); return fmtMes(+a, +m); }
  function fmtMetros(m) { return (m === null || m === undefined) ? '–' : (m >= 1000 ? fmtNum(m / 1000, 1) + ' km' : fmtInt(m) + ' m'); }

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // Valor ausente NUNCA vira o texto "null"/"undefined" numa visualização:
  // toda legenda, rótulo e agrupamento passa por aqui. (Achado do usuário,
  // 10/09/2026: a legenda do mapa mostrava "nullnull".)
  const SEM_VALOR = '(não informado)';
  function vazio(v) { return v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v)); }
  function rotuloValor(v, quandoVazio) { return vazio(v) ? (quandoVazio === undefined ? SEM_VALOR : quandoVazio) : String(v); }
  // `replaceChildren`/`append` do DOM convertem null na STRING "null" -- estes
  // dois filtram antes, e são a forma padrão de trocar filhos no projeto.
  function trocarFilhos(el, ...filhos) { el.replaceChildren(...filhos.flat(9).filter(x => x !== null && x !== undefined && x !== false)); }
  function anexar(el, ...filhos) { for (const f of filhos.flat(9)) if (f !== null && f !== undefined && f !== false) el.append(f); return el; }
  function el(tag, attrs = {}, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') { if (v !== null && v !== undefined) e.className = v; } else if (k === 'html') { if (v !== null && v !== undefined) e.innerHTML = v; } else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      /* ATRIBUTO BOOLEANO: em HTML o que vale é a PRESENÇA do atributo, não
         o valor -- `disabled="false"` desabilita igualzinho a `disabled`.
         `U.el('button', { disabled: i <= 0 })` escrevia "false" e o botão
         nascia morto (achado em 19/09/2026, nas setas ◀ ▶ do calendário:
         os TRÊS botões saíram desabilitados). Mesma família do `class`/`html`
         nulos logo acima. Quem precisa da string "false" (aria-*) já passa
         por `String()` -- conferido em todo o app antes de mudar isto. */
      else if (v === false) { /* atributo ausente */ }
      else if (v === true) e.setAttribute(k, '');
      else if (v !== null && v !== undefined) e.setAttribute(k, v);
    }
    for (const f of filhos.flat()) { if (f === null || f === undefined) continue; e.append(f instanceof Node ? f : document.createTextNode(String(f))); }
    return e;
  }

  function groupBy(arr, fn) { const m = new Map(); for (const x of arr) { const k = fn(x); let g = m.get(k); if (!g) { g = []; m.set(k, g); } g.push(x); } return m; }
  function contar(arr, fn, { ordenar = 'valor', desc = true } = {}) {
    const m = new Map(); for (const x of arr) { const k = fn(x); if (k === null || k === undefined) continue; m.set(k, (m.get(k) || 0) + 1); }
    const s = [...m.entries()];
    if (ordenar === 'valor') s.sort((a, b) => desc ? b[1] - a[1] : a[1] - b[1]); else s.sort((a, b) => cmp(a[0], b[0]));
    return s;
  }
  function cmp(a, b) { if (a === b) return 0; if (a === null || a === undefined) return 1; if (b === null || b === undefined) return -1; return (typeof a === 'number' && typeof b === 'number') ? a - b : String(a).localeCompare(String(b), 'pt-BR', { numeric: true }); }
  function soma(arr, fn = x => x) { let s = 0; for (const x of arr) { const v = fn(x); if (v !== null && v !== undefined && !Number.isNaN(v)) s += v; } return s; }
  function media(arr, fn = x => x) { const v = arr.map(fn).filter(x => x !== null && x !== undefined && !Number.isNaN(x)); return v.length ? soma(v) / v.length : null; }
  function percentil(valores, p) { const v = valores.filter(x => x !== null && x !== undefined && !Number.isNaN(x)).sort((a, b) => a - b); if (!v.length) return null; const i = (v.length - 1) * p; const lo = Math.floor(i); const hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); }
  function mediana(valores) { return percentil(valores, 0.5); }
  function unicos(arr, fn = x => x) { return [...new Set(arr.map(fn).filter(x => x !== null && x !== undefined && x !== ''))]; }
  function razao(a, b) { return b ? a / b : null; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  // Escala sequencial simples (0..1 -> cor) para calendários e coropléticos
  function corEscala(t, tipo = 'azul') {
    t = clamp(t ?? 0, 0, 1);
    const esc = {
      azul: [[232, 240, 253], [26, 86, 196]],
      verde: [[232, 246, 236], [21, 90, 48]],
      quente: [[255, 243, 224], [216, 57, 43]],
      semaforo: null,
    };
    if (tipo === 'semaforo') { // vermelho -> amarelo -> verde
      const r = t < .5 ? 220 : Math.round(220 - (t - .5) * 2 * (220 - 46)); const g = t < .5 ? Math.round(60 + t * 2 * (200 - 60)) : 200 - Math.round((t - .5) * 2 * 40);
      return `rgb(${r},${g},60)`;
    }
    const [a, b] = esc[tipo] || esc.azul;
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }
  /* Texto preto ou branco sobre um fundo, pela luminância. SÓ ENTENDIA
     `rgb(r, g, b)`: com um HEX -- que é como as cores estão escritas em
     `U.TURNOS`, `COR` e na paleta inteira -- o regex não casava e devolvia
     PRETO para tudo. Foi assim que a chave "Noite" saiu com texto preto
     sobre azul-marinho (#283593), ilegível (achado do usuário, 19/09/2026).
     O caminho `rgb()` vinha de `corEscala`, e por isso o defeito nunca
     apareceu nos calendários e coropléticos -- só em quem passou hex. */
  function corTextoPara(fundo) {
    let r, g, b2;
    const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(fundo || '').trim());
    if (hex) {
      let h = hex[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b2 = parseInt(h.slice(4, 6), 16);
    } else {
      const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(fundo);
      if (!m) return '#1f2a24';
      r = +m[1]; g = +m[2]; b2 = +m[3];
    }
    const l = (0.299 * r + 0.587 * g + 0.114 * b2) / 255;
    return l > 0.6 ? '#1f2a24' : '#fff';
  }

  // ---------------------------------------------------------------- tabela
  /* tabela({colunas:[{chave, rotulo, num, fmt(v,linha), html:bool, largura}], linhas, ordenarPor, desc, limite, rodape:{chave:valor}, aoClicar(linha), altura:'alta'}) */
  function tabela(opc) {
    const estado = { ord: opc.ordenarPor || null, desc: !!opc.desc, limite: opc.limite || 300 };
    const wrap = el('div', { class: 'tabela-wrap' + (opc.altura ? ' ' + opc.altura : '') });
    const rodape = el('div', { class: 'tabela-rodape' });
    const cont = el('div', {}, wrap, rodape);
    function desenhar() {
      let linhas = opc.linhas.slice();
      if (estado.ord) { const c = opc.colunas.find(x => x.chave === estado.ord); const f = c && c.valorOrd ? c.valorOrd : (l => l[estado.ord]); linhas.sort((a, b) => cmp(f(a), f(b)) * (estado.desc ? -1 : 1)); }
      const total = linhas.length; const mostradas = linhas.slice(0, estado.limite);
      const t = el('table', { class: 'tabela' });
      const thead = el('thead'); const tr = el('tr');
      for (const c of opc.colunas) {
        const th = el('th', { class: c.num ? 'num' : '', style: c.largura ? { minWidth: c.largura } : null, onclick: () => { if (estado.ord === c.chave) estado.desc = !estado.desc; else { estado.ord = c.chave; estado.desc = !!c.num; } desenhar(); } }, c.rotulo);
        if (estado.ord === c.chave) th.append(el('span', { class: 'ord' }, estado.desc ? '▼' : '▲'));
        tr.append(th);
      }
      thead.append(tr); t.append(thead);
      const tb = el('tbody');
      for (const l of mostradas) {
        const trl = el('tr', { class: opc.aoClicar ? 'clicavel' : '' });
        if (opc.aoClicar) trl.addEventListener('click', () => opc.aoClicar(l));
        for (const c of opc.colunas) {
          const v = l[c.chave]; const txt = c.fmt ? c.fmt(v, l) : (v === null || v === undefined ? '' : v);
          const td = el('td', { class: (c.num ? 'num ' : '') + (c.quebra ? 'quebra' : ''), title: (!c.html && txt && String(txt).length > 40) ? String(txt) : null });
          if (c.html) td.innerHTML = txt ?? ''; else td.textContent = txt ?? '';
          trl.append(td);
        }
        tb.append(trl);
      }
      t.append(tb);
      /* A linha de TOTAIS tem de respeitar `html: true` igual ao corpo
         (achado do usuário, 19/09/2026: o rodapé da tabela de
         aproveitamento mostrava `<span class="barra-cel"> <span ...` como
         TEXTO). O corpo já fazia `td.innerHTML = txt` quando a coluna é
         html; o rodapé passava o mesmo texto por `el(...)`, que o insere
         como nó de TEXTO -- então a barra virava código escrito na tela. */
      if (opc.rodape) {
        const tf = el('tfoot'); const trf = el('tr');
        for (const c of opc.colunas) {
          const v = opc.rodape[c.chave];
          /* Número grande sem separador no rodapé ('10038') estava entre o
             que o usuário chamou de má legibilidade. Só no RODAPÉ, e só em
             coluna `num` sem `fmt` próprio: ali o valor é sempre um AGREGADO,
             nunca um código -- no corpo, um ano ou um número de domicílio
             viraria '2.026' e '1.234', que seria pior. */
          let txt = v === undefined ? '' : (c.fmtRodape ? c.fmtRodape(v) : (c.fmt && typeof v === 'number' ? c.fmt(v, opc.rodape) : v));
          if (!c.fmt && !c.fmtRodape && c.num && typeof v === 'number' && Number.isFinite(v)) txt = Number.isInteger(v) ? fmtInt(v) : fmtNum(v);
          const td = el('td', { class: c.num ? 'num' : '' });
          if (c.html && !c.fmtRodape) td.innerHTML = txt ?? ''; else td.textContent = txt ?? '';
          trf.append(td);
        }
        tf.append(trf); t.append(tf);
      }
      wrap.replaceChildren(t);
      rodape.replaceChildren(
        el('span', {}, `${fmtInt(total)} linha(s)` + (total > mostradas.length ? ` — mostrando ${fmtInt(mostradas.length)}` : '')),
        el('div', { class: 'dir' },
          total > mostradas.length ? el('button', { class: 'btn pequeno', onclick: () => { estado.limite += 500; desenhar(); } }, 'Mostrar mais') : null,
          el('button', { class: 'btn pequeno', onclick: () => exportarCsv(opc.nomeArquivo || 'tabela', opc.colunas, linhas) }, '⇩ CSV'),
          podeExcel() ? el('button', { class: 'btn pequeno', title: 'Baixar a tabela inteira como planilha do Excel (.xlsx), com filtro e cabeçalho fixo',
            onclick: ev => exportarExcel(opc.nomeArquivo || 'tabela', opc.colunas, linhas, ev.currentTarget) }, '⇩ Excel') : null));
    }
    desenhar();
    return cont;
  }

  function exportarCsv(nome, colunas, linhas) {
    const sep = ';';
    const cab = colunas.map(c => `"${c.rotulo}"`).join(sep);
    const corpo = linhas.map(l => colunas.map(c => { let v = c.fmtCsv ? c.fmtCsv(l[c.chave], l) : (c.fmt && !c.html ? c.fmt(l[c.chave], l) : l[c.chave]); if (v === null || v === undefined) v = ''; return `"${String(v).replace(/"/g, '""')}"`; }).join(sep)).join('\r\n');
    const blob = new Blob(['﻿' + cab + '\r\n' + corpo], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome.replace(/[^\w\-]+/g, '_') + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* Excel (24/10/2026, porte do SuperC PNS-26): a tela manda as linhas que JÁ
     mostra e o servidor só empacota o .xlsx (`lib_xlsx`, sem dependência
     nova) -- o servidor não consulta nada, então a planilha nunca leva mais do
     que a tabela. Exige login (o servidor recusa sem ele; o botão nem aparece).
     Número vai como NÚMERO, que é o que se quer somar e filtrar na planilha;
     taxa vira "%" com uma casa (0,724 numa planilha ninguém lê como 72,4%). */
  const podeExcel = () => typeof SESSAO !== 'undefined' && !!(SESSAO.eu && SESSAO.eu.login);
  async function exportarExcel(nome, colunas, linhas, botao) {
    const pct = new Set();
    for (const c of colunas) {
      const l = linhas.find(x => typeof x[c.chave] === 'number' && Number.isFinite(x[c.chave]));
      if (l && c.fmt && !c.fmtCsv && /%\s*$/.test(String(c.fmt(l[c.chave], l)))) pct.add(c.chave);
    }
    const valor = (c, l) => {
      const v = l[c.chave];
      if (c.fmtCsv) return c.fmtCsv(v, l);
      if (typeof v === 'number' && Number.isFinite(v)) return pct.has(c.chave) ? Math.round(v * 1000) / 10 : v;
      const t = c.fmt && !c.html ? c.fmt(v, l) : v;
      return t === null || t === undefined ? '' : t;
    };
    const planilha = { nome: String(nome).slice(0, 31), colunas: colunas.map(c => c.rotulo + (pct.has(c.chave) ? ' (%)' : '')),
      linhas: linhas.map(l => colunas.map(c => valor(c, l))) };
    if (botao) { botao.disabled = true; botao.textContent = 'gerando…'; }
    try {
      const r = await fetch('/api/excel', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivo: String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\-]+/g, '_'), planilhas: [planilha] }) });
      if (!r.ok) { let m = 'falha ' + r.status; try { const j = await r.json(); if (j && j.erro) m = j.erro; } catch (_) { /* sem JSON */ } throw new Error(m); }
      const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob());
      a.download = String(nome).replace(/[^\w\-]+/g, '_') + '.xlsx'; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) {
      if (typeof APP !== 'undefined' && APP.toast) APP.toast('Não consegui gerar a planilha: ' + e.message, 'erro', 6000);
    } finally {
      if (botao) { botao.disabled = false; botao.textContent = '⇩ Excel'; }
    }
  }

  /* `ajuda` (porte do PNS, 24/10/2026): a definição do número vai num "?" no
     canto do KPI, com a dica que vale no mouse e no TOQUE (`data-dica`, ver
     ligarDicas) -- todo número diz o que conta. */
  function kpi(valor, rotulo, sub, classe = '', ajuda = null) {
    // sem `ajuda` da página, a definição vem do glossário (glossario.js), pelo rótulo
    if (!ajuda && typeof GLOSSARIO !== 'undefined') ajuda = GLOSSARIO.definicao(rotulo);
    const c = el('div', { class: 'cartao kpi ' + (classe || '') }, el('div', { class: 'valor' }, valor), el('div', { class: 'rotulo' }, rotulo), sub ? el('div', { class: 'sub' }, sub) : null);
    if (ajuda) c.append(el('span', { class: 'kpi-ajuda', 'data-dica': `<b>${esc(rotulo)}</b><br>${esc(ajuda)}`, 'aria-label': 'definição de ' + rotulo }, '?'));
    return c;
  }
  function cartao(titulo, corpo, opc = {}) {
    const c = el('div', { class: 'cartao ' + (opc.class || '') });
    if (titulo) { const h = el('h3', {}, titulo); if (opc.dir) h.append(el('span', { class: 'dir' }, opc.dir)); c.append(h); }
    for (const x of [corpo].flat()) if (x) c.append(x instanceof Node ? x : el('div', { html: x }));
    // `fonte: ['tentativas', ...]` carimba a PROCEDÊNCIA no rodapé do cartão:
    // de que relatório do SIGC saiu aquele número e quando ele entrou. Pedido
    // do usuário em 15/09/2026, depois de um extrato antigo ter entrado como
    // se fosse do mês corrente: número sem origem não dá para conferir.
    if (opc.fonte) c.append(selo(opc.fonte));
    if (opc.ajuda) c.append(el('div', { class: 'ajuda' }, opc.ajuda));
    return c;
  }
  /* Selo de procedência: "Fonte: Relatório de Tentativas · atualizado em
     12/09/2026 13:14". Sem dado carregado daquele relatório, diz que falta --
     é informação, não erro. */
  function selo(tipos) {
    // `const DADOS` no topo de um script NÃO vira propriedade de window
    // (só `var` faz isso): `window.DADOS` é undefined e o selo dizia
    // "ainda não depositado" para tudo. Daí o typeof, que também protege
    // util.js de ser carregado antes de dados.js.
    const P = (typeof DADOS !== 'undefined' && DADOS.procedencia) || {};
    const lista = [tipos].flat().filter(Boolean);
    const caixa = el('div', { class: 'fonte-dado' });
    caixa.append(el('span', { class: 'rot' }, lista.length > 1 ? 'Fontes: ' : 'Fonte: '));
    lista.forEach((t, i) => {
      const p = P[t];
      if (i) caixa.append(document.createTextNode(' · '));
      if (!p) { caixa.append(el('span', { class: 'ausente' }, (NOME_RELATORIO[t] || t) + ' (ainda não depositado)')); return; }
      caixa.append(el('span', {}, el('b', {}, p.nome),
        p.ultima_em ? ` — atualizado em ${fmtDataHora(p.ultima_em)}` : '',
        p.meses && p.meses.length ? el('span', { class: 'mini-info' }, ` · ${p.meses.length} mês(es): ${mesesResumidos(p.meses)}`) : null));
    });
    return caixa;
  }
  /* Nome de exibição quando o relatório ainda não entrou (aí não há
     procedência no banco para consultar). */
  const NOME_RELATORIO = {
    tentativas: 'Relatório de Tentativas', dados_gerais: 'Dados Gerais', geren01: 'Geren01',
    geren04: 'Geren04', geren05: 'Geren05', acomp01: 'Acomp01', andamento: 'Acomp02 (andamento)',
    periodos: 'Rotação Períodos', tempo_coleta_sessao: 'Tempo de coleta - auxiliar',
    tempo_coleta_dom: 'Tempo de Coleta', enderecos: 'Endereços Selecionados',
    acompanhar_entrevistas: 'Acompanhar Entrevistas', historico_entrevista: 'Histórico da Entrevista',
    moradores_incompletos: 'Moradores com Dados Incompletos', ultimo_movimento: 'Último Movimento',
    aproveitamento_uf: 'Aproveitamento da Coleta', andamento_regiao: 'Acomp03 (regiões)',
    acomp03_capital: 'Acomp03 (capitais)', malha: 'Malha de setores (pasta)',
    equipe: 'Equipe (cadastro na tela)', calendario: 'Calendário (cadastro na tela)',
  };
  function mesesResumidos(meses) {
    const ord = [...meses].sort((a, b) => cmp(a.slice(3) + a.slice(0, 2), b.slice(3) + b.slice(0, 2)));
    return ord.length <= 3 ? ord.join(', ') : `${ord[0]} a ${ord[ord.length - 1]}`;
  }
  function titulo(h, p, dir) { const t = el('div', { class: 'secao-titulo' }, el('div', {}, el('h2', {}, h), p ? el('p', {}, p) : null)); if (dir) t.append(el('div', { class: 'dir' }, ...[dir].flat())); return t; }
  function seg(opcoes, atual, aoMudar) {
    const s = el('div', { class: 'seg' });
    for (const o of opcoes) { const b = el('button', { class: o.valor === atual ? 'ativo' : '', onclick: () => { [...s.children].forEach(x => x.classList.remove('ativo')); b.classList.add('ativo'); aoMudar(o.valor); } }, o.rotulo); s.append(b); }
    return s;
  }
  function legenda(itens) { return el('div', { class: 'legenda' }, ...itens.map(i => el('span', { style: { '--cor': i.cor } }, i.rotulo))); }
  /* Barra + número numa célula numérica. O texto vai DENTRO, em caixa de
     largura fixa: sem isso a célula alinhada à direita empurrava a barra
     conforme o número fosse "100,0%" ou "8,3%", e as barras de linhas
     vizinhas começavam em posições diferentes -- impossível comparar de
     relance (achado do usuário, 10/09/2026). */
  /* Geocódigo clicável. Todo código de setor/controle ou de UPA que
     aparecer na tela vira link: clicar leva ao mapa, filtra por ele e
     enquadra a geometria (pedido do usuário, 10/09/2026). O tratamento do
     clique é único, por delegação, em `MAPA.ligarLinksGeo` -- assim vale em
     balão, ficha, tabela e qualquer lugar que use este helper. */
  function linkGeo(cod, tipo = 'controle', rotulo) {
    if (vazio(cod)) return SEM_VALOR;
    return `<a href="#/mapa" class="geo" data-geo="${esc(cod)}" data-geo-tipo="${esc(tipo)}" ` +
      `title="ver no mapa e enquadrar">${esc(rotulo === undefined ? cod : rotulo)}</a>`;
  }

  function barraInline(frac, cor = 'var(--azul)', texto) {
    const f = clamp(frac || 0, 0, 1);
    const barra = `<span class="barra-fundo"><span class="barra" style="width:${(f * 100).toFixed(0)}%;background:${cor}"></span></span>`;
    if (texto === undefined || texto === null) return barra;
    return `<span class="barra-cel">${barra}<span class="barra-valor">${esc(texto)}</span></span>`;
  }

  /* TURNOS da abordagem -- as faixas NACIONAIS do Dados Gerais / Plano de
     Supervisão (GT 2025): manhã 07-12, tarde 12-17, noite 17-21 (o SIGC
     ainda parte a noite em 17-19 e 19-21) e "fora do horário" 21-07, que é
     fora do expediente estendido das agências (07h-21h) e por isso pede
     justificativa. Uma definição só, para mapa, indícios e pendências
     falarem dos mesmos turnos. */
  const TURNOS = [
    { nome: 'Manhã', de: 7, ate: 12, cor: '#fbc02d' },
    { nome: 'Tarde', de: 12, ate: 17, cor: '#1a73e8' },
    { nome: 'Noite', de: 17, ate: 21, cor: '#283593' },
    { nome: 'Fora do horário (21h-7h)', de: 21, ate: 7, cor: COR.ruim },
  ];
  function turnoDe(hora) {
    if (hora === null || hora === undefined || Number.isNaN(+hora)) return null;
    const h = +hora;
    if (h >= 7 && h < 12) return 'Manhã';
    if (h >= 12 && h < 17) return 'Tarde';
    if (h >= 17 && h < 21) return 'Noite';
    return 'Fora do horário (21h-7h)';
  }
  function corTurno(nome) { const t = TURNOS.find(x => x.nome === nome); return t ? t.cor : COR.neutro; }
  function foraDoHorario(hora) { return turnoDe(hora) === 'Fora do horário (21h-7h)'; }
  /* Link para o Street View no ponto (pedido "Mapa - propostas" do GT): abre
     em aba nova; não há chave nem incorporação, só o endereço público. */
  function streetView(lat, lon) {
    return `https://www.google.com/maps?q=&layer=c&cbll=${(+lat).toFixed(6)},${(+lon).toFixed(6)}`;
  }

  function modal(titulo, corpo, largura) {
    const fundo = el('div', { class: 'modal-fundo', onclick: e => { if (e.target === fundo) fundo.remove(); } });
    const m = el('div', { class: 'modal', style: largura ? { width: largura } : null }, el('button', { class: 'btn pequeno fechar', title: 'Fechar (Esc)', 'aria-label': 'Fechar', onclick: () => fundo.remove() }, '✕'), el('h3', {}, titulo));
    for (const x of [corpo].flat()) if (x) m.append(x instanceof Node ? x : el('div', { html: x }));
    fundo.append(m); document.body.append(fundo);
    // Esc fecha só o modal de CIMA (uma ficha pode abrir um formulário)
    const aoTecla = e => {
      if (!fundo.isConnected) { document.removeEventListener('keydown', aoTecla); return; }
      if (e.key !== 'Escape') return;
      const todos = document.querySelectorAll('.modal-fundo');
      if (todos[todos.length - 1] === fundo) { fundo.remove(); document.removeEventListener('keydown', aoTecla); }
    };
    document.addEventListener('keydown', aoTecla);
    return fundo;
  }


  /* ------------------------------------------------------------- ÍCONES
     Um conjunto só, desenhado em SVG de TRAÇO (24×24, `stroke-width` 1,8,
     pontas arredondadas), no lugar da mistura que havia: símbolos
     geométricos do Unicode (⌂ ▦ ⚲ ▤ ◔ ⇄) ao lado de emojis coloridos
     (🏆 📖 📈 🧭). Os dois têm defeitos diferentes e somados ficavam pior:
     o símbolo geométrico muda de desenho e de largura conforme a fonte do
     sistema -- no Android nem todos existem, e o que falta vira retângulo
     vazio --, e o emoji chega com a paleta DELE, que briga com o semáforo
     de cor do sistema (verde = bom, vermelho = perda) e não escurece nem
     clareia com o tema. SVG inline resolve os dois: desenho igual em toda
     máquina, herda `currentColor` e acompanha o tamanho do texto.
     Uso: `U.icone('home')` devolve o elemento; `U.aplicarIcones(raiz)`
     preenche todo `[data-icone]` (é assim que o menu do index.html pede o
     seu, sem repetir SVG no HTML). */
  const ICONES = {
    home: '<path d="M3 10.7 12 3.5l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    grade: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    porta: '<path d="M12 21V4.6a1 1 0 0 0-1.2-1l-4 .9A1 1 0 0 0 6 5.5V21"/><path d="M4 21h16"/><path d="M12 21h5V8a1 1 0 0 0-1-1h-4"/><circle cx="9.4" cy="12.4" r=".9" fill="currentColor" stroke="none"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="8.5" cy="14.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="14.5" r="1" fill="currentColor" stroke="none"/>',
    alvo: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    confere: '<circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.3 2.6 2.6 5-5.4"/>',
    pulso: '<path d="M3 12h3.5l2.2-6 4.3 13 2.3-7h5.7"/>',
    telefone: '<path d="M6.3 3.5h3l1.6 4-2 1.3a12.5 12.5 0 0 0 6.3 6.3l1.3-2 4 1.6v3a2 2 0 0 1-2.2 2C11.6 19 5 12.4 4.3 5.7a2 2 0 0 1 2-2.2z"/>',
    comparar: '<path d="M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5"/><path d="M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5"/>',
    alerta: '<path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20.2h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4"/><circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none"/>',
    prancheta: '<path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/><path d="m9.3 13.4 1.9 1.9 3.5-4"/>',
    painel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    trofeu: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5.5H4.5A2.5 2.5 0 0 0 7 10M17 5.5h2.5A2.5 2.5 0 0 1 17 10"/><path d="M12 14v3.5M8.5 20.5h7"/>',
    ciclo: '<path d="M20.5 11a8.5 8.5 0 0 0-14.6-5"/><path d="M3.5 13a8.5 8.5 0 0 0 14.6 5"/><path d="M3.5 5.5V10h4.5M20.5 18.5V14H16"/>',
    estrela: '<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.5 9.8l5.9-.8z"/>',
    mapa: '<path d="m3 6.5 6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    tendencia: '<path d="M3 17.5 9.5 11l4 4L21 7.5"/><path d="M15.5 7.5H21v5.5"/>',
    livro: '<path d="M12 6.5C10.5 5 8.4 4.3 4.5 4.3v13c3.9 0 6 .7 7.5 2.2 1.5-1.5 3.6-2.2 7.5-2.2v-13c-3.9 0-6 .7-7.5 2.2z"/><path d="M12 6.5V19.5"/>',
    banco: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    pessoas: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="M16.5 5.2a3.4 3.4 0 0 1 0 5.6M18 20a6.2 6.2 0 0 0-2.3-4.8"/>',
    mira: '<circle cx="12" cy="12" r="6.5"/><path d="M12 1.8v3.6M12 18.6v3.6M1.8 12h3.6M18.6 12h3.6"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    bussola: '<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2 5.2-5.2 2 2-5.2z" fill="currentColor" stroke="none"/>',
    /* REALIDADE AUMENTADA. Achado do usuário (20/09/2026): o botão da AR
       usava `bussola` -- e, desde que a rosa dos ventos entrou no mapa, dois
       comandos diferentes passaram a ter o MESMO desenho na mesma tela. É o
       mesmo defeito da lanterna e do zoom, uma hora antes.
       O desenho novo não é uma bússola: são os quatro COLCHETES de
       enquadramento, que são a linguagem da própria tela da AR (o designador
       de alvo e a mira usam os mesmos), com um alfinete de lugar no meio.
       "Enquadre e o alvo aparece" -- que é literalmente o que o botão faz. */
    ra: '<path d="M3 8.2V4.6a1.6 1.6 0 0 1 1.6-1.6H8"/><path d="M16 3h3.4A1.6 1.6 0 0 1 21 4.6v3.6"/>'
      + '<path d="M21 15.8v3.6a1.6 1.6 0 0 1-1.6 1.6H16"/><path d="M8 21H4.6A1.6 1.6 0 0 1 3 19.4v-3.6"/>'
      + '<path d="M12 16.4s3.3-3 3.3-5.5a3.3 3.3 0 0 0-6.6 0c0 2.5 3.3 5.5 3.3 5.5z"/>'
      + '<circle cx="12" cy="10.8" r="1.15"/>',
    /* Lanterna e zoom da realidade aumentada. Achado do usuário
       (20/09/2026): os dois botões usavam `mira` e `expandir`, que são
       EXATAMENTE os ícones de "Minha posição" e "Enquadrar" no mapa, na
       mesma tela e a poucos centímetros -- dois comandos diferentes com o
       mesmo desenho é o mesmo defeito que o botão de menu sem ícone: quem
       olha não tem como saber o que vai acontecer. */
    /* RÉGUA DE CAMPO: uma linha com as duas pontas marcadas e os traços de
       escala embaixo. Não é uma seta (seta é direção) nem uma trena (trena
       é objeto): é a MEDIDA entre dois pontos, que é o que o botão faz. */
    regua: '<path d="M4.8 17.6 19.2 6.4"/><path d="M3.4 16.2 6.2 19"/><path d="M17.8 5 20.6 7.8"/>'
      + '<path d="M8.2 14.6l1.4 1.4M11 12.4l1.4 1.4M13.8 10.2l1.4 1.4"/>',
    lanterna: '<path d="M9 2.8h6a1 1 0 0 1 1 1v2.4a1 1 0 0 1-.3.7L14 8.6v11.6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V8.6L8.3 6.9a1 1 0 0 1-.3-.7V3.8a1 1 0 0 1 1-1z"/><path d="M8 6.2h8"/><path d="M12 11.4v2.2"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.3 15.3 5 5"/><path d="M10.5 7.8v5.4M7.8 10.5h5.4"/>',
    camadas: '<path d="m12 3 8.5 4.5L12 12 3.5 7.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/>',
    expandir: '<path d="M8.5 3.5H4.5a1 1 0 0 0-1 1v4M15.5 3.5h4a1 1 0 0 1 1 1v4M8.5 20.5h-4a1 1 0 0 1-1-1v-4M15.5 20.5h4a1 1 0 0 0 1-1v-4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    lua: '<path d="M20 14.2A8.5 8.5 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2z"/>',
    relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 2"/>',
    carta: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.6 6.8 8.4 6 8.4-6"/>',
    lapis: '<path d="M4 20.1h4l10.3-10.3a2.1 2.1 0 0 0 0-3l-1-1a2.1 2.1 0 0 0-3 0L4 16.1z"/><path d="m14.2 6.8 3 3"/>',
    antena: '<path d="M12 21v-7"/><circle cx="12" cy="11.5" r="2.2"/><path d="M7.6 15.9a6.2 6.2 0 0 1 0-8.8M16.4 7.1a6.2 6.2 0 0 1 0 8.8"/><path d="M4.8 18.7a10.2 10.2 0 0 1 0-14.4M19.2 4.3a10.2 10.2 0 0 1 0 14.4"/>',
    fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
    destacar: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
    recolher_tela: '<path d="M20 10h-6V4M4 14h6v6M14 10l7-7M3 21l7-7"/>',
    lista_tarefas: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="m3.6 6.3 1.4 1.4 2.4-2.6M3.6 11.8l1.4 1.4 2.4-2.6"/><circle cx="5.4" cy="17.5" r="1.3"/>',
    documento: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4"/><path d="M9 12.5h6M9 15.5h6M9 9.5h2.5"/>',
    caderno: '<path d="M6 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6z"/><path d="M6 3.5v17M4 7.5h3M4 12h3M4 16.5h3"/><path d="M10 8h5M10 11.5h5"/>',
    leitura: '<path d="M12 6.5c-2-1.6-5-2-8-1.5v13c3-.5 6-.1 8 1.5 2-1.6 5-2 8-1.5V5c-3-.5-6-.1-8 1.5z"/><path d="M12 6.5v13"/>',
    publicacao: '<path d="M4 5.5h13v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M17 9.5h3v9a2 2 0 0 1-2 2"/><path d="M7 9h7M7 12.5h7M7 16h4"/>',
    funil: '<path d="M3.5 4.5h17l-6.5 8v6l-4 1.5v-7.5z"/>',
    duvida: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.4"/><circle cx="12" cy="16.6" r="1" fill="currentColor" stroke="none"/>',
    voltar: '<path d="M12 21V4.6a1 1 0 0 0-1.2-1l-4 .9A1 1 0 0 0 6 5.5V21M4 21h16M12 21h5V8a1 1 0 0 0-1-1h-4"/><path d="m20.5 13.5-2.5 2.5 2.5 2.5"/>',
    troca: '<path d="M4 8h12m0 0-3-3m3 3-3 3"/><path d="M20 16H8m0 0 3-3m-3 3 3 3"/>',
    /* O botão do menu lateral diz para onde o menu vai: a faixa e a seta
       apontam o efeito do clique. Um desenho único (o mesmo antes e depois)
       não informava nada -- achado do usuário, 19/09/2026. */
    painel_recolher: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M9.5 4.5v15"/><path d="m15.6 9.4-2.6 2.6 2.6 2.6"/>',
    painel_abrir: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M9.5 4.5v15"/><path d="m13 9.4 2.6 2.6-2.6 2.6"/>',
  };
  function icone(nome, tamanho) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('width', tamanho || 18); el.setAttribute('height', tamanho || 18);
    el.setAttribute('fill', 'none'); el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '1.8'); el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round'); el.setAttribute('aria-hidden', 'true');
    el.setAttribute('focusable', 'false');
    // conteúdo CONSTANTE deste arquivo -- nunca recebe texto de fora
    el.innerHTML = ICONES[nome] || ICONES.grade;
    return el;
  }
  /* O mesmo desenho, em STRING: as colunas `html: true` de `U.tabela` montam
     HTML, e ali não dá para inserir um elemento. Mesmos atributos de
     `icone()` -- `currentColor`, traço 1,8 --, para os dois caminhos
     produzirem exatamente o mesmo ícone. */
  function iconeHtml(nome, tamanho) {
    const t = tamanho || 18;
    return `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor"`
      + ` stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`
      + ` focusable="false">${ICONES[nome] || ICONES.grade}</svg>`;
  }

  /* DICA FLUTUANTE, por delegação (19/09/2026). Pedido do usuário: substituir
     texto longo de tabela por ícones, com o texto legível "ao passar o mouse
     sobre o ícone ou ao clicar".
     Por que não `title=`: o balão nativo demora ~1 s, quebra mal, não aceita
     formatação e NÃO EXISTE no toque -- e `mouseover` também não existe na
     WebView do Android (regra já registrada para o mapa). Por isso os DOIS
     caminhos: passar o mouse e clicar.
     Por que `position: fixed`: a dica nasce no `body`, fora da tabela. Dentro
     dela seria recortada pelo `overflow: auto` do `.tabela-wrap` -- o texto
     apareceria cortado justamente nas colunas da direita, que é onde ele está.
     O clique é capturado na DESCIDA (`capture: true`) porque a linha da tabela
     tem o seu próprio `onclick` (abre a ficha do domicílio): na subida, o da
     linha já teria disparado. */
  let caixaDica = null;
  function esconderDica() { if (caixaDica) { caixaDica.remove(); caixaDica = null; } }
  function mostrarDica(alvo) {
    esconderDica();
    const html = alvo.getAttribute('data-dica');
    if (!html) return;
    caixaDica = el('div', { class: 'dica-flut', html });
    document.body.append(caixaDica);
    const r = alvo.getBoundingClientRect();
    const c = caixaDica.getBoundingClientRect();
    const x = Math.min(Math.max(8, r.left + r.width / 2 - c.width / 2), window.innerWidth - c.width - 8);
    let y = r.bottom + 8;
    if (y + c.height > window.innerHeight - 8) y = Math.max(8, r.top - c.height - 8);
    caixaDica.style.left = Math.round(x) + 'px';
    caixaDica.style.top = Math.round(y) + 'px';
    caixaDica.classList.add('visivel');
  }
  function ligarDicas(raiz) {
    if (!raiz || raiz.__dicas) return; raiz.__dicas = true;
    raiz.addEventListener('mouseover', e => { const a = e.target.closest && e.target.closest('[data-dica]'); if (a) mostrarDica(a); });
    raiz.addEventListener('mouseout', e => { const a = e.target.closest && e.target.closest('[data-dica]'); if (a) esconderDica(); });
    raiz.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('[data-dica]');
      if (!a) return;
      e.stopPropagation(); e.preventDefault();
      mostrarDica(a);
    }, true);
    // rolar leva o ícone embora e a dica ficaria flutuando no vazio
    raiz.addEventListener('scroll', esconderDica, true);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') esconderDica(); });
  window.addEventListener('resize', esconderDica);

  function aplicarIcones(raiz) {
    for (const el of (raiz || document).querySelectorAll('[data-icone]')) {
      el.replaceChildren(icone(el.dataset.icone, el.dataset.icTam ? +el.dataset.icTam : undefined));
    }
  }

  return { NOME_MES, NOME_MES_LONGO, DIA_SEMANA, DIA_SEMANA_CURTO, TIPOS, GRUPO_COR, GRUPO_ROTULO, PALETA, COR,
    semAcento, corMotivo, corStatus, corSetorRot, corOrigem,
    tipoInfo, corTipo, grupoTipo, rotuloTipo, iconeTipo, corCategoria, corEscala, corTextoPara,
    fmtInt, fmtNum, fmtPct, fmtMin, fmtHms, fmtData, fmtDataHora, fmtMes, fmtMesLongo, fmtPeriodo, fmtMetros,
    esc, el, groupBy, contar, cmp, soma, media, percentil, mediana, unicos, razao, clamp, debounce,
    SEM_VALOR, vazio, rotuloValor, trocarFilhos, anexar, diasEntre, diaDaSemana, fimDeSemana, UF_POR_CODIGO, ufDoControle, distanciaM, horasEntre, enderecoBase, logradouroDe, rotuloEnt, entrevistadorHtml, infoEnt,
    tabela, exportarCsv, exportarExcel, kpi, cartao, titulo, seg, legenda, barraInline, linkGeo, modal,
    selo, NOME_RELATORIO, mesesResumidos, TURNOS, turnoDe, corTurno, foraDoHorario, streetView,
    icone, iconeHtml, aplicarIcones, ligarDicas, esconderDica };
})();
