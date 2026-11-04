/* SuperC -- GERADOR DE RELEASES DA PNAD CONTÍNUA: o MOTOR DE TEXTO (26/10/2026).

   Pedido do usuário: "crie um sistema para gerar releases ... passo-a-passo
   com as indicações do usuário quanto ao escopo (territorial, temporal),
   público, mídia, estilo, gráficos, tabelas, cartogramas, tamanho". A base é
   o estudo em GUIA_JORNALISMO_RELEASES.md; as seções citadas abaixo (§) são
   dele. Este arquivo é PURO -- não toca DOM, rede nem `U`: recebe o cache de
   /api/publicacoes (o mesmo objeto da página Resultados) e as ESCOLHAS do
   assistente e devolve fatos, texto, conferência e a especificação dos
   visuais. É assim que `scripts/teste_releases.py` o exercita no Edge.

   REGRAS QUE O TEXTO SEGUE (e que a conferência cobra no texto EDITADO):
   - Texto 100% DETERMINÍSTICO, sem IA: mesmo dado e mesmas escolhas, mesmo
     texto (§12.4: o sinônimo depende da posição do parágrafo, não de sorteio).
   - Verbo de tendência SÓ com a situação publicada pelo IBGE: 'Z' =
     significativa (o sentido é o sinal), 'A' = estável, '-' ou desconhecida =
     sem indicação (verbo neutro, "passou de X para Y", e aviso). Nunca pela
     diferença entre números arredondados (§2.4, §3.3). Confiança: 95%.
   - p.p. para variação de TAXA, % para contagem e rendimento (§3.4).
   - Precisão pela escala do IBGE (apêndice): até 15% sem aviso; 15-30%
     "precisão razoável" junto do número; acima de 30% (pouco precisa ou
     pior) NÃO vira manchete nem lide -- a manchete passa ao seguinte, e sem
     nenhum utilizável a exportação é bloqueada.
   - Trimestre móvel só existe para o BRASIL; UF, Região e capital só no
     trimestre civil, e nunca "trimestre encerrado em" para eles (§2.1).
   - Nunca causa (lista de conectivos proibidos, §12.3), nunca aspas geradas
     (só o espaço reservado da citação, §9.1), nunca adjetivo valorativo,
     exclamação, emoji ou primeira pessoa (§3.8, §6).
   - Duas datas (referência e divulgação oficial), fonte com a tabela SIDRA e
     a data da consulta em toda peça (§9.4, §2.6). Nada antes da divulgação:
     a PNADC é conjuntural, não há embargo (§1.6).
   - Dado operacional da coleta (SuperC) NUNCA entra: só o cache publicado.
   - Sem `??`, `?.`, espalhamento de objeto nem lookbehind: a conferência de
     sintaxe do projeto (esprima) não os lê. */
'use strict';

const RELEASE_MODELOS = (() => {
  const M = {};
  // ------------------------------------------------------------------ formatação
  const vazio = v => v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v));
  const num = (v, c) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const inteiro = v => Number(Math.round(v)).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const lista = arr => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1]);
  const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const ORD_FALADO = ['', 'primeiro', 'segundo', 'terceiro', 'quarto'];
  const dataLonga = iso => { if (!iso) return ''; const p = String(iso).slice(0, 10).split('-'); return `${+p[2]} de ${MESES[+p[1] - 1]} de ${p[0]}`; };
  const dataCurta = iso => { if (!iso) return ''; const p = String(iso).slice(0, 10).split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };
  const diasEntre = (a, b) => Math.round((new Date(String(b).slice(0, 10) + 'T12:00:00') - new Date(String(a).slice(0, 10) + 'T12:00:00')) / 86400000);
  const diaSemana = iso => DIAS[new Date(String(iso).slice(0, 10) + 'T12:00:00').getDay()];

  // ------------------------------------------------------------------ número por extenso (rádio e TV, §12.1)
  const U_M = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const U_F = ['zero', 'uma', 'duas'].concat(U_M.slice(3));
  const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const CEM_M = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const CEM_F = ['', 'cento', 'duzentas', 'trezentas', 'quatrocentas', 'quinhentas', 'seiscentas', 'setecentas', 'oitocentas', 'novecentas'];
  function ate999(n, fem) {
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100, partes = [];
    if (c) partes.push((fem ? CEM_F : CEM_M)[c]);
    if (r) partes.push(r < 20 ? (fem ? U_F : U_M)[r] : DEZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + (fem ? U_F : U_M)[r % 10] : ''));
    return partes.join(' e ');
  }
  function extenso(n, fem) {
    n = Math.round(Math.abs(n));
    if (n === 0) return 'zero';
    const grupos = [[Math.floor(n / 1e9) % 1000, 'bi'], [Math.floor(n / 1e6) % 1000, 'mi'], [Math.floor(n / 1e3) % 1000, 'mil'], [n % 1000, '']].filter(g => g[0]);
    const txt = grupos.map(([g, q]) => q === 'bi' ? (g === 1 ? 'um bilhão' : ate999(g, false) + ' bilhões')
      : q === 'mi' ? (g === 1 ? 'um milhão' : ate999(g, false) + ' milhões')
        : q === 'mil' ? (g === 1 ? 'mil' : ate999(g, fem) + ' mil') : ate999(g, fem));
    if (txt.length === 1) return txt[0];
    const ult = grupos[grupos.length - 1][0];
    const lig = (ult < 100 || ult % 100 === 0) ? ' e ' : ', ';
    return txt.slice(0, -1).join(', ') + lig + txt[txt.length - 1];
  }
  /* "dois vírgula seis"; casas = 1 sempre que a fonte tem uma casa */
  function decimalFalado(v, casas, fem) {
    const s = num(Math.abs(v), casas).replace(/\./g, '');
    const partes = s.split(',');
    const int = extenso(+partes[0], fem);
    if (!partes[1] || /^0+$/.test(partes[1])) return int;
    return int + ' vírgula ' + partes[1].split('').map(d => U_M[+d]).join(' ');
  }
  M.extenso = extenso;
  M.decimalFalado = decimalFalado;
  /* converte números escritos em texto editado à mão para fala (contagem de palavras do rádio) */
  M.falarNumeros = texto => String(texto).replace(/\d{1,3}(\.\d{3})+(,\d+)?|\d+(,\d+)?/g, m => {
    const v = +m.replace(/\./g, '').replace(',', '.');
    return m.indexOf(',') >= 0 ? decimalFalado(v, m.split(',')[1].length) : extenso(v);
  });
  const palavras = t => (String(t).match(/[0-9A-Za-zÀ-ÿ]+/g) || []).length;
  M.palavras = palavras;

  // ------------------------------------------------------------------ períodos
  const pAno = p => +String(p).slice(0, 4), pN = p => +String(p).slice(4);
  function perAnterior(p, fam) {
    const ano = pAno(p), n = pN(p);
    if (fam === 'trimestral') return n > 1 ? `${ano}${String(n - 1).padStart(2, '0')}` : `${ano - 1}04`;
    const m = n - 3; return m >= 1 ? `${ano}${String(m).padStart(2, '0')}` : `${ano - 1}${String(m + 12).padStart(2, '0')}`;
  }
  const perAnoAnt = p => `${pAno(p) - 1}${String(p).slice(4)}`;
  const mesesDoMovel = p => { const n = pN(p); return [n - 2, n - 1, n].map(m => ((m - 1 + 12) % 12)); };
  function perLongo(p, fam) {
    if (fam === 'trimestral') return `${pN(p)}º trimestre de ${pAno(p)}`;
    return `trimestre encerrado em ${MESES[pN(p) - 1]} de ${pAno(p)}`;
  }
  function perCurto(p, fam) {
    if (fam === 'trimestral') return `${pN(p)}º tri/${pAno(p)}`;
    const ms = mesesDoMovel(p); return `${MES3[ms[0]]}-${MES3[ms[2]]}/${pAno(p)}`;
  }
  function perRefAnt(p, fam) {
    const q = perAnterior(p, fam);
    if (fam === 'trimestral') return perLongo(q, fam);
    const ms = mesesDoMovel(q); return `trimestre de ${MESES[ms[0]]} a ${MESES[ms[2]]} de ${pAno(q)}`;
  }
  const perRefAno = (p, fam) => (fam === 'trimestral' ? perLongo(perAnoAnt(p), fam) : `mesmo trimestre de ${pAno(p) - 1}`);
  function perFalado(p, fam, anoPub) {
    if (fam === 'trimestral') return `${ORD_FALADO[pN(p)]} trimestre` + (pAno(p) === anoPub ? ' do ano' : ` de ${extenso(pAno(p))}`);
    return `trimestre encerrado em ${MESES[pN(p) - 1]}`;
  }
  /* a comparação com o trimestre anterior envolve o 1º trimestre (§2.3, ressalva sazonal) */
  const sazonal = (p, fam) => (fam === 'trimestral' ? (pN(p) === 1 || pN(p) === 2) : (pN(p) === 3 || pN(p) === 6));
  M.periodos = { perAnterior, perAnoAnt, perLongo, perCurto, perRefAnt, perRefAno, perFalado, sazonal };

  // ------------------------------------------------------------------ territórios
  const UF_SIGLA = { 11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF' };
  // artigo do nome da UF: "em Rondônia", "no Amazonas", "na Bahia"
  const UF_ART = { AC: 'o', AP: 'o', AM: 'o', BA: 'a', CE: 'o', DF: 'o', ES: 'o', MA: 'o', PA: 'o', PB: 'a', PR: 'o', PI: 'o', RJ: 'o', RN: 'o', RS: 'o', TO: 'o' };
  const emUf = (sig, nome) => (UF_ART[sig] === 'o' ? 'no ' : UF_ART[sig] === 'a' ? 'na ' : 'em ') + nome;
  const deUf = (sig, nome) => (UF_ART[sig] === 'o' ? 'do ' : UF_ART[sig] === 'a' ? 'da ' : 'de ') + nome;
  M.UF_SIGLA = UF_SIGLA;
  /* Cartograma em GRADE das 27 UFs (§8.3), 7 colunas × 8 linhas. */
  M.GRADE = ['..RRAP...', '.AMPAMACERN.', 'ACROTOPIPEPB.', '.MTGOBASEAL.', '.MSDFMGES..', '.PRSPRJ...', '.SC.....', '.RS.....'];
  M.gradeCasas = () => {
    const casas = [];
    M.GRADE.forEach((linha, y) => { let x = 0; for (let i = 0; i < linha.length;) { if (linha[i] === '.') { x++; i++; } else { casas.push({ sigla: linha.substr(i, 2), x, y }); x++; i += 2; } } });
    return casas;
  };

  const serieD = (D, id, fam, nivel, loc) => { const f = D.series && D.series[id] && D.series[id][fam]; return (f && f[nivel + '|' + loc]) || null; };
  const limpaCapital = s => String(s || '').replace(/\s*[-(].*$/, '').trim();
  function capitalLoc(D) {
    const uf = String(D.uf.codigo);
    for (const ind of D.indicadores || []) {
      const fam = (D.series[ind.id] || {}).trimestral || {};
      const k = Object.keys(fam).find(x => x.indexOf('N6|' + uf) === 0);
      if (k) return k.split('|')[1];
    }
    return null;
  }
  M.territorios = function (D, ufsEscopo) {
    const ufc = String(D.uf.codigo), reg = String((D.regiao && D.regiao.codigo) || ufc.charAt(0));
    const nomeReg = (D.locais && D.locais['N2|' + reg]) || (D.regiao && D.regiao.nome) || '';
    const sig = D.uf.sigla || UF_SIGLA[ufc] || '';
    const nomeUf = (D.locais && D.locais['N3|' + ufc]) || D.uf.nome || sig;
    const capLoc = capitalLoc(D), capNome = capLoc ? limpaCapital(D.locais['N6|' + capLoc]) : null;
    const out = [
      { id: 'brasil', nivel: 'N1', loc: '1', nome: 'Brasil', em: 'no Brasil', de: 'do Brasil', curto: 'no país', familias: ['trimestral', 'movel'] },
      { id: 'regiao', nivel: 'N2', loc: reg, nome: 'Região ' + nomeReg, em: 'na Região ' + nomeReg, de: 'da Região ' + nomeReg, curto: 'na região', familias: ['trimestral'], regNome: nomeReg },
      { id: 'uf', nivel: 'N3', loc: ufc, nome: nomeUf, em: emUf(sig, nomeUf), de: deUf(sig, nomeUf), curto: 'no estado', familias: ['trimestral'], sigla: sig },
    ];
    out.push(capLoc ? { id: 'capital', nivel: 'N6', loc: capLoc, nome: capNome, em: 'em ' + capNome, de: 'de ' + capNome, curto: 'na capital', familias: ['trimestral'], capital: true }
      : { id: 'capital', indisponivel: 'a capital não aparece nas tabelas guardadas' });
    const escopo = ufsEscopo === 'todas' ? 'todas' : 'regiao';
    out.push({ id: 'ufs', nivel: 'N3', loc: '*', conjunto: true, escopo, nome: escopo === 'todas' ? 'unidades da federação' : `unidades da federação da Região ${nomeReg}`,
      em: escopo === 'todas' ? 'nas unidades da federação' : `nas unidades da federação da Região ${nomeReg}`, de: '', curto: 'nas UFs', familias: ['trimestral'], regNome: nomeReg, foco: { loc: ufc, sigla: sig, nome: nomeUf, em: emUf(sig, nomeUf) } });
    return out;
  };

  // ------------------------------------------------------------------ indicadores: nomes para o texto
  const NOMES = {
    desocupacao: { medio: 'a taxa de desocupação', sujeito: 'a taxa de desocupação', curto: 'a taxa', titulo: 'Desocupação', tituloImprensa: 'Desemprego', g: 'f', plural: 'taxas de desocupação', sing: 'taxa de desocupação', gp: 'f', falado: 'o desemprego', chave: /\b(desocupa\w*|desemprego\w*|desempregad\w*)/ },
    ocupacao: { medio: 'o nível da ocupação', sujeito: 'o nível da ocupação', curto: 'o nível da ocupação', titulo: 'Nível da ocupação', g: 'm', plural: 'níveis da ocupação', sing: 'nível da ocupação', gp: 'm', falado: 'o nível da ocupação', chave: /\bnive(l|is) d[ae] ocupacao/ },
    participacao: { medio: 'a taxa de participação', sujeito: 'a taxa de participação na força de trabalho', curto: 'a taxa de participação', titulo: 'Participação na força de trabalho', g: 'f', plural: 'taxas de participação', sing: 'taxa de participação', gp: 'f', falado: 'a participação na força de trabalho', chave: /\bparticipacao\b/ },
    informalidade: { medio: 'a taxa de informalidade', sujeito: 'a taxa de informalidade', curto: 'a informalidade', titulo: 'Informalidade', g: 'f', plural: 'taxas de informalidade', sing: 'taxa de informalidade', gp: 'f', falado: 'a informalidade', chave: /\binforma(lidade|is|l)\b/ },
    subutilizacao: { medio: 'a taxa de subutilização', sujeito: 'a taxa composta de subutilização da força de trabalho', curto: 'a taxa de subutilização', titulo: 'Subutilização', g: 'f', plural: 'taxas de subutilização', sing: 'taxa de subutilização', gp: 'f', falado: 'a subutilização da força de trabalho', chave: /\bsubutiliza\w*/ },
    desalento: { medio: 'o percentual de desalentados', sujeito: 'o percentual de pessoas desalentadas', curto: 'o desalento', titulo: 'Desalento', g: 'm', plural: 'percentuais de desalentados', sing: 'percentual de desalentados', gp: 'm', falado: 'o desalento', chave: /\bdesalent\w*/ },
    rendimento: { medio: 'o rendimento médio', sujeito: 'o rendimento médio real habitual de todos os trabalhos', curto: 'o rendimento médio', titulo: 'Rendimento médio', g: 'm', plural: 'rendimentos médios', sing: 'rendimento médio', gp: 'm', falado: 'o rendimento médio', chave: /\brendimento\w*/ },
    ocupados: { medio: 'a população ocupada', sujeito: 'a população ocupada', curto: 'a população ocupada', titulo: 'População ocupada', g: 'f', plural: null, gp: 'f', falado: 'o número de pessoas trabalhando', chave: /\b(ocupados|populacao ocupada|pessoas ocupadas|ocupadas)\b/ },
  };
  const nomeDe = ind => NOMES[ind.id] || { medio: 'o indicador ' + ind.curto, sujeito: 'o indicador ' + ind.curto, curto: 'o indicador', titulo: cap(ind.curto), g: 'm', plural: null, gp: 'm', falado: ind.curto, chave: new RegExp(semAcento(ind.curto).toLowerCase()) };
  M.NOMES = NOMES;
  /* "Entenda" (§12.2): definição em linguagem simples */
  const ENTENDA = {
    desocupacao: 'É desocupada a pessoa de 14 anos ou mais que não tinha trabalho, procurou trabalho nos 30 dias anteriores e estava disponível para começar.',
    desalento: 'Desalentado é quem gostaria de trabalhar e estava disponível, mas não procurou trabalho por achar que não encontraria.',
    informalidade: 'São informais os empregados sem carteira (no setor privado e no trabalho doméstico), os empregadores e trabalhadores por conta própria sem CNPJ e quem ajuda a família no trabalho sem remuneração.',
    subutilizacao: 'A subutilização soma quem está desocupado, quem trabalha menos horas do que gostaria e quem gostaria de trabalhar mas não pôde procurar ou começar.',
    ocupacao: 'O nível da ocupação é a parte das pessoas de 14 anos ou mais que está trabalhando.',
    participacao: 'A participação na força de trabalho é a parte das pessoas de 14 anos ou mais que está trabalhando ou procurando trabalho.',
    rendimento: 'O rendimento médio real habitual é o que as pessoas ocupadas costumam receber por mês em todos os trabalhos, já descontada a inflação.',
    ocupados: 'A população ocupada reúne as pessoas de 14 anos ou mais que trabalharam na semana da pesquisa, com ou sem carteira.',
  };
  M.ENTENDA = ENTENDA;
  // ordem temática do corpo (§12.5) -- desempate da ordem sugerida
  const ORDEM_TEMA = ['desocupacao', 'ocupados', 'ocupacao', 'participacao', 'informalidade', 'rendimento', 'subutilizacao', 'desalento'];

  // ------------------------------------------------------------------ situação e precisão
  /* Direção pela SITUAÇÃO publicada: 'aumentou' | 'diminuiu' só com 'Z'. */
  function direcao(cod, d) {
    if (cod === null || cod === undefined || cod === '' || cod === '-') return 'sem';
    if (cod === 'A') return 'estavel';
    if (cod === 'Z') return vazio(d) || d === 0 ? 'sig0' : d > 0 ? 'aumentou' : 'diminuiu';
    return 'desconhecida';
  }
  M.direcao = direcao;
  const significativa = dir => dir === 'aumentou' || dir === 'diminuiu';
  const ESCALA = [{ ate: 5, classe: 'ótima' }, { ate: 15, classe: 'boa' }, { ate: 30, classe: 'razoável' }, { ate: 50, classe: 'pouco precisa' }, { ate: null, classe: 'imprecisa' }];
  function precisao(cv, esc) {
    if (vazio(cv)) return { classe: 'sem CV publicado', nivel: -1 };
    const e = esc || ESCALA;
    let k = e.findIndex(x => x.ate === null || x.ate === undefined || cv <= x.ate); if (k < 0) k = e.length - 1;
    return { classe: e[k].classe, nivel: k };
  }
  M.precisao = precisao;
  const CV_LIDE_MAX = 30;      // acima: "pouco precisa" ou pior -- não vira manchete nem lide
  const CV_AVISO = 15;         // acima: "precisão razoável" ao lado do número
  M.CV_LIDE_MAX = CV_LIDE_MAX;

  // ------------------------------------------------------------------ ESCOLHAS (o estado do assistente)
  M.padrao = function (hojeIso) {
    return { territorio: 'uf', ufsEscopo: 'regiao', familia: 'trimestral', periodo: null, comparar: { anterior: true, ano: true }, serie: 'nao',
      indicadores: null, publico: 'imprensa', midia: 'site', estilo: 'factual', tamanho: 'padrao', segundos: 30, telas: 5, formatoImg: '1080x1350',
      visuais: null, extras: { portaVoz: { incluir: false, nome: '', cargo: '' }, contato: { setor: '', telefone: '', email: '' }, nota: 'auto',
        entenda: false, destaques: true, cidade: '', dataPublicacao: hojeIso || '', link: '', divulgacaoManual: '', alt: { titulo: '', linhaFina: '', lide: '' } } };
  };
  M.MIDIAS = [
    { id: 'site', rot: 'Site ou portal', desc: 'Título, linha fina, lide, intertítulos e destaques; gráfico logo depois do parágrafo que o anuncia.', formato: 'md', tamanhos: ['curta', 'padrao', 'completo'] },
    { id: 'impresso', rot: 'Jornal ou revista impressa', desc: 'O mesmo release, com tabela e figura de legenda completa: o leitor não clica.', formato: 'md', tamanhos: ['curta', 'padrao', 'completo'] },
    { id: 'radio', rot: 'Rádio', desc: 'Lauda com cabeça, texto e deixa; números por extenso, no máximo três; fonte antes do fato.', formato: 'plano', tamanhos: [15, 30, 45, 60] },
    { id: 'tv', rot: 'TV', desc: 'Cabeça, off, GC (um número por tela) e pé; nota pelada (15 s) ou coberta.', formato: 'plano', tamanhos: [15, 30, 45, 60] },
    { id: 'x', rot: 'X (antigo Twitter)', desc: 'Um fato, um número, a fonte e o link, em até 280 caracteres.', formato: 'plano', tamanhos: ['fixo'] },
    { id: 'instagram', rot: 'Instagram (carrossel)', desc: 'Uma ideia por tela, número grande, fonte em toda tela; legenda que começa pelo fato.', formato: 'plano', tamanhos: [3, 5] },
    { id: 'linkedin', rot: 'LinkedIn', desc: 'Tom institucional-analítico, 3 a 5 parágrafos curtos, até 3.000 caracteres.', formato: 'plano', tamanhos: ['fixo'] },
    { id: 'whatsapp', rot: 'WhatsApp', desc: 'Cabe numa tela: primeira linha em negrito, marcadores com os números, fonte e link.', formato: 'plano', tamanhos: ['fixo'] },
    { id: 'boletim', rot: 'Boletim interno / gestores', desc: 'Conclusão na primeira linha (BLUF), os fatos que a sustentam, o que pede atenção e o que não concluir.', formato: 'md', tamanhos: ['curta', 'padrao', 'completo'] },
  ];
  M.PUBLICOS = [
    { id: 'imprensa', rot: 'Imprensa', desc: 'Fato, número, gancho local e material pronto (release completo, tabela, gráfico, contato).' },
    { id: 'gestores', rot: 'Gestores e tomadores de decisão', desc: 'Conclusão e comparação para decidir: CV e significância explícitos, posição exata no ranking, o que não concluir.' },
    { id: 'geral', rot: 'Público geral', desc: 'Linguagem simples, conceito explicado, proporções do dia a dia ("cerca de um terço"), sem sigla sem tradução.' },
    { id: 'academia', rot: 'Academia', desc: 'Definições exatas, denominadores, CVs, tabelas do SIDRA e nota metodológica estendida.' },
    { id: 'equipe', rot: 'Equipe técnica da pesquisa', desc: 'Reconhecimento: liga a resposta dos domicílios à precisão. Nunca identifica entrevistador nem usa dado operacional.' },
  ];
  M.ESTILOS = [
    { id: 'factual', rot: 'Notícia factual', desc: 'O que saiu, sem interpretação: pirâmide invertida e verbos neutros.' },
    { id: 'analise', rot: 'Análise / interpretativo', desc: 'Relaciona indicadores, série e territórios ("Ao mesmo tempo, ..."); causa só se a fonte atribuir.' },
    { id: 'didatico', rot: 'Didático / explicativo', desc: 'Explica os conceitos com o dado do dia (caixa "Entenda", o que o número quer dizer na prática).' },
    { id: 'institucional', rot: 'Institucional', desc: 'Voz institucional: nome completo da pesquisa e do instituto, terceira pessoa, sem coloquialismo.' },
  ];
  M.TAMANHOS = { curta: { rot: 'Nota curta', faixa: [300, 500] }, padrao: { rot: 'Padrão', faixa: [2500, 4000] }, completo: { rot: 'Completo', faixa: [5000, 8000] } };
  const LIM = { x: 280, linkedin: 3000, instagram: 2200, instagramVisivel: 125, whatsapp: [400, 700], urlX: 23 };
  M.LIMITES = LIM;
  const PALAVRAS_MIN = { min: 130, max: 150 };    // locução (§4.3): 130-150 palavras por minuto
  M.midia = id => M.MIDIAS.find(m => m.id === id) || M.MIDIAS[0];

  /* As escolhas sempre coerentes (o assistente e o teste passam por aqui):
     trimestre móvel só para o Brasil; tamanho válido para a mídia. */
  M.normalizar = function (E) {
    const e = JSON.parse(JSON.stringify(E || {}));
    const p = M.padrao(e.extras && e.extras.dataPublicacao);
    for (const k of Object.keys(p)) if (e[k] === undefined) e[k] = p[k];
    e.extras = Object.assign({}, p.extras, e.extras || {});
    e.extras.portaVoz = Object.assign({}, p.extras.portaVoz, e.extras.portaVoz || {});
    e.extras.contato = Object.assign({}, p.extras.contato, e.extras.contato || {});
    e.extras.alt = Object.assign({}, p.extras.alt, e.extras.alt || {});
    e.comparar = Object.assign({}, p.comparar, e.comparar || {});
    if (e.territorio !== 'brasil' && e.familia === 'movel') e.familia = 'trimestral';
    const md = M.midia(e.midia);
    if (md.tamanhos[0] === 'fixo') e.tamanho = 'fixo';
    else if (typeof md.tamanhos[0] === 'number') { if (md.id === 'instagram') { if (md.tamanhos.indexOf(+e.telas) < 0) e.telas = 5; } else if (md.tamanhos.indexOf(+e.segundos) < 0) e.segundos = 30; e.tamanho = 'tempo'; }
    else if (md.tamanhos.indexOf(e.tamanho) < 0) e.tamanho = 'padrao';
    return e;
  };

  // ------------------------------------------------------------------ períodos disponíveis e divulgação
  /* Quantas UFs têm valor no período (o cache guarda das OUTRAS UFs só os
     últimos `PERIODOS_OUTRAS_UFS` trimestres -- lib_sidra). Ranking, "comparar
     UFs", contagem de UFs e cartograma só valem com as UFs presentes. */
  const UFS_MIN = 20;
  M.UFS_MIN = UFS_MIN;
  function nUfsEm(D, fam, per) {
    let n = 0;
    for (const ind of D.indicadores || []) {
      const fs = (D.series[ind.id] || {})[fam] || {};
      const ks = Object.keys(fs).filter(k => k.indexOf('N3|') === 0);
      if (!ks.length) continue;
      for (const k of ks) { const p = pontoEm(fs[k], per); if (p && !vazio(p.v)) n++; }
      return n;                                   // o primeiro indicador com UF basta
    }
    return 0;
  }
  M.nUfsEm = nUfsEm;
  /* territórios cujo texto usa as UFs: o seletor só oferece os períodos com elas */
  const usaUfs = (t, fam) => fam === 'trimestral' && (t.id === 'uf' || t.conjunto || t.id === 'brasil');
  M.periodosDisponiveis = function (D, E) {
    const terrs = M.territorios(D, E.ufsEscopo), t = terrs.find(x => x.id === E.territorio) || terrs[2];
    const fam = E.familia;
    const ref = (D.indicadores || []).map(ind => (t.conjunto ? serieD(D, ind.id, fam, 'N3', t.foco.loc) : serieD(D, ind.id, fam, t.nivel, t.loc))).filter(Boolean);
    const pers = new Set();
    for (const s of ref) s.per.forEach((p, i) => { if (!vazio(s.v[i])) pers.add(p); });
    let lista = Array.from(pers).sort().reverse();
    if (usaUfs(t, fam)) lista = lista.filter(p => nUfsEm(D, fam, p) >= UFS_MIN);
    return lista;
  };
  /* Data de divulgação oficial do período: a de modificação do período na API
     (sidra_periodo); na falta, a da tabela quando ela é o último período; a
     marcação manual do usuário vence (é ele quem confere no calendário). */
  M.divulgacao = function (D, tabelas, per, manual) {
    let melhor = null;
    for (const t of tabelas) {
      const d = (D.divulgacao && D.divulgacao[t] && D.divulgacao[t][per]) || (D.consultas && D.consultas[t] && D.consultas[t].ultimo_periodo === per ? D.consultas[t].modificacao : null);
      if (d && (!melhor || d > melhor)) melhor = d;
    }
    // a data informada à mão só vale igual ou DEPOIS da que a API publica: antes dela
    // seria publicar antes da divulgação (sem embargo na PNADC)
    if (manual && (!melhor || manual >= String(melhor).slice(0, 10))) return { data: manual, origem: 'informada pelo usuário' };
    const r = melhor ? { data: melhor, origem: 'data de publicação do período na API do IBGE' } : { data: null, origem: 'desconhecida' };
    if (manual) r.manualRecusada = manual;
    return r;
  };
  const consultaEm = (D, tabelas) => tabelas.map(t => D.consultas && D.consultas[t] && (D.consultas[t].ultimo_ok || D.consultas[t].baixado_em)).filter(Boolean).sort().pop() || null;

  // ------------------------------------------------------------------ FATOS
  function ponto(s, i) { if (!s || i < 0) return null; return { per: s.per[i], v: s.v[i], cv: s.cv[i], vc: s.vc[i], sc: s.sc[i], va: s.va[i], sa: s.sa[i] }; }
  function pontoEm(s, per) { return s ? ponto(s, s.per.indexOf(per)) : null; }
  function relevancia(it) {
    if (it.indisponivel) return -99;
    let r = 0;
    if (significativa(it.dirAno)) r += 3; if (significativa(it.dirAnt)) r += 1.5;
    const base = it.ind.tipo === 'taxa' ? Math.max(1, Math.abs(it.v)) : 100;
    const mag = Math.max(significativa(it.dirAno) ? Math.abs(it.va || 0) : 0, significativa(it.dirAnt) ? Math.abs(it.vc || 0) : 0) / base;
    r += Math.min(2, mag * 10);
    if (!vazio(it.cv) && it.cv > CV_AVISO) r -= 1; if (!vazio(it.cv) && it.cv > CV_LIDE_MAX) r -= 3;
    if (it.ind.id === 'desocupacao') r += 0.5;
    return r;
  }
  function itemDe(D, ind, fam, t, per) {
    const nm = nomeDe(ind), tab = ind[fam] ? ind[fam].tabela : null;
    const base = { ind, nm, tab, fam };
    if (t.capital && ['desocupacao', 'rendimento'].indexOf(ind.id) < 0) return Object.assign(base, { indisponivel: 'o IBGE não divulga este indicador para a capital' });
    if (fam === 'movel' && t.id !== 'brasil') return Object.assign(base, { indisponivel: 'o trimestre móvel só existe para o Brasil' });
    if (t.conjunto) {
      const reg = t.foco.loc.charAt(0);
      const fs = (D.series[ind.id] || {})[fam] || {};
      const conj = Object.keys(fs).filter(k => k.indexOf('N3|') === 0 && (t.escopo === 'todas' || k.charAt(3) === reg)).map(k => {
        const loc = k.split('|')[1], p = pontoEm(fs[k], per);
        const sig = UF_SIGLA[loc] || loc, nome = (D.locais && D.locais[k]) || sig;
        return p && !vazio(p.v) ? { loc, sigla: sig, nome, em: emUf(sig, nome), de: deUf(sig, nome), foco: loc === t.foco.loc, v: p.v, cv: p.cv, vc: p.vc, sc: p.sc, va: p.va, sa: p.sa, dirAno: direcao(p.sa, p.va), dirAnt: direcao(p.sc, p.vc) } : null;
      }).filter(Boolean).sort((a, b) => b.v - a.v);
      const esperadas = Object.keys(fs).filter(k => k.indexOf('N3|') === 0 && (t.escopo === 'todas' || k.charAt(3) === reg)).length;
      if (conj.length < 3 || conj.length < esperadas || (t.escopo === 'todas' && conj.length < UFS_MIN))
        return Object.assign(base, { indisponivel: `só ${conj.length} das ${esperadas} UFs do grupo têm valor no período (o cache guarda poucos trimestres das outras UFs)` });
      const f = conj.find(u => u.foco) || conj[0];
      return Object.assign(base, { conjunto: conj, v: f.v, cv: f.cv, va: f.va, sa: f.sa, vc: f.vc, sc: f.sc, dirAno: direcao(f.sa, f.va), dirAnt: direcao(f.sc, f.vc), focoUf: f });
    }
    const s = serieD(D, ind.id, fam, t.nivel, t.loc), p = pontoEm(s, per);
    if (!p || vazio(p.v)) return Object.assign(base, { indisponivel: s ? 'sem valor para o período' : 'sem divulgação para este recorte' });
    const pAnt = pontoEm(s, perAnterior(per, fam)), pAnoP = pontoEm(s, perAnoAnt(per));
    const refs = {};
    const sBr = serieD(D, ind.id, fam, 'N1', '1'), sReg = serieD(D, ind.id, fam, 'N2', String(D.regiao.codigo)), sUf = serieD(D, ind.id, fam, 'N3', String(D.uf.codigo));
    if (t.id !== 'brasil') refs.brasil = pontoEm(sBr, per);
    if (t.id === 'uf') refs.regiao = pontoEm(sReg, per);
    if (t.id === 'capital') refs.uf = pontoEm(sUf, per);
    let ranking = null;
    if (t.id === 'uf') {
      const fs = (D.series[ind.id] || {})[fam] || {};
      const ufs = Object.keys(fs).filter(k => k.indexOf('N3|') === 0).map(k => ({ loc: k.split('|')[1], p: pontoEm(fs[k], per) })).filter(x => x.p && !vazio(x.p.v)).sort((a, b) => b.p.v - a.p.v);
      const pos = ufs.findIndex(x => x.loc === t.loc);
      if (pos >= 0 && ufs.length >= UFS_MIN) ranking = { n: ufs.length, posMaior: pos + 1, posMenor: ufs.length - pos };
    }
    return Object.assign(base, { s, i: s.per.indexOf(per), v: p.v, cv: p.cv, va: p.va, sa: p.sa, vc: p.vc, sc: p.sc, dirAno: direcao(p.sa, p.va), dirAnt: direcao(p.sc, p.vc),
      v0Ano: pAnoP ? pAnoP.v : null, v0Ant: pAnt ? pAnt.v : null, refs, ranking });
  }
  /* Ordem SUGERIDA (passo 3): significância, tamanho relativo da variação e
     precisão; a desocupação na frente quando é utilizável (§12.5). */
  M.ordemSugerida = function (D, E) {
    const F = M.montarFatos(D, Object.assign({}, E, { indicadores: (D.indicadores || []).map(i => i.id) }));
    // o principal padrão é a taxa de desocupação (§12.5, item 1) quando ela pode ser lide
    const prim = it => (it.ind.id === 'desocupacao' && !it.indisponivel && (vazio(it.cv) || it.cv <= CV_LIDE_MAX) ? 1 : 0);
    return F.todos.slice().sort((a, b) => (prim(b) - prim(a)) || (relevancia(b) - relevancia(a)) || (ORDEM_TEMA.indexOf(a.ind.id) - ORDEM_TEMA.indexOf(b.ind.id))).map(it => ({ id: it.ind.id, it, relevancia: relevancia(it) }));
  };

  M.montarFatos = function (D, E0) {
    const E = M.normalizar(E0);
    const terrs = M.territorios(D, E.ufsEscopo);
    let t = terrs.find(x => x.id === E.territorio);
    const F = { E, bloqueios: [], avisos: [], todos: [], itens: [], fam: E.familia };
    if (!t || t.indisponivel) { F.bloqueios.push('Recorte territorial indisponível: ' + ((t && t.indisponivel) || E.territorio) + '.'); t = terrs[2]; }
    F.terr = t;
    if (E.familia === 'movel' && t.id !== 'brasil') F.bloqueios.push('O trimestre móvel só existe para o Brasil: UF, Grande Região e capital só têm divulgação trimestral.');
    const pers = M.periodosDisponiveis(D, E);
    const per = E.periodo && pers.indexOf(E.periodo) >= 0 ? E.periodo : pers[0];
    if (!per) { F.bloqueios.push('Não há período publicado no cache para este recorte.'); return F; }
    F.per = per;
    const ids = (E.indicadores && E.indicadores.length ? E.indicadores : (D.indicadores || []).map(i => i.id));
    F.todos = (D.indicadores || []).map(ind => itemDe(D, ind, E.familia, t, per));
    F.itens = ids.map(id => F.todos.find(x => x.ind.id === id)).filter(x => x && !x.indisponivel);
    for (const id of ids) { const x = F.todos.find(y => y.ind.id === id); if (x && x.indisponivel) F.avisos.push(`${x.ind.rotulo}: ${x.indisponivel} — fica de fora.`); }
    if (!F.itens.length) { F.bloqueios.push('Nenhum indicador escolhido tem valor publicado para este recorte e período.'); return F; }
    // LIDE: o primeiro escolhido com precisão suficiente (CV até 30%)
    const lide = F.itens.find(x => vazio(x.cv) || x.cv <= CV_LIDE_MAX);
    if (!lide) F.bloqueios.push(`Nenhum indicador escolhido tem precisão suficiente para manchete ou lide (CV acima de ${CV_LIDE_MAX}%, "pouco precisa" ou pior na escala do IBGE).`);
    else if (lide !== F.itens[0]) F.avisos.push(`${F.itens[0].ind.rotulo} tem CV de ${num(F.itens[0].cv, 1)}% (${precisao(F.itens[0].cv).classe}): não vira manchete nem lide. A manchete passou para ${lide.ind.rotulo}.`);
    F.lide = lide || F.itens[0];
    F.resto = F.itens.filter(x => x !== F.lide);
    for (const x of F.itens) if (!vazio(x.cv) && x.cv > CV_AVISO) F.avisos.push(`${x.ind.rotulo}: CV de ${num(x.cv, 1)}%, precisão ${precisao(x.cv).classe} na escala do IBGE — o texto avisa junto do número.`);
    for (const x of F.itens) {
      for (const [c, liga] of [['dirAno', E.comparar.ano], ['dirAnt', E.comparar.anterior]]) {
        if (liga && (x[c] === 'sem' || x[c] === 'desconhecida') && !x.conjunto) F.avisos.push(`${x.ind.rotulo}: o IBGE não indicou a significância da comparação ${c === 'dirAno' ? 'anual' : 'com o período anterior'} — o texto usa verbo neutro ("passou de X para Y"). Confira no Comentário ou no Quadro Sintético.`);
      }
    }
    F.tabelas = Array.from(new Set(F.itens.map(x => x.tab).filter(Boolean)));
    F.div = M.divulgacao(D, F.tabelas, per, E.extras.divulgacaoManual);
    if (F.div.manualRecusada) F.avisos.push(`A data de divulgação informada (${dataCurta(F.div.manualRecusada)}) é anterior à que a API do IBGE publica para o período (${dataCurta(F.div.data)}): vale a da API.`);
    F.consulta = consultaEm(D, F.tabelas);
    if (!F.div.data) F.bloqueios.push('Data de divulgação oficial desconhecida: informe-a (passo 2) a partir do calendário de divulgação do IBGE.');
    if (F.div.data && E.extras.dataPublicacao && E.extras.dataPublicacao < String(F.div.data).slice(0, 10))
      F.bloqueios.push(`A data de publicação (${dataCurta(E.extras.dataPublicacao)}) é anterior à divulgação oficial (${dataCurta(F.div.data)}). A PNAD Contínua é conjuntural: não há embargo, nada sai antes da divulgação.`);
    if (!E.extras.dataPublicacao) F.bloqueios.push('Falta a data de publicação do release.');
    F.uf = { codigo: String(D.uf.codigo), sigla: D.uf.sigla || UF_SIGLA[D.uf.codigo] || '', nome: (D.locais && D.locais['N3|' + D.uf.codigo]) || D.uf.nome };
    F.regNome = (D.locais && D.locais['N2|' + D.regiao.codigo]) || D.regiao.nome || '';
    F.capNome = (terrs.find(x => x.id === 'capital') || {}).nome || '';
    F.D = D;
    return F;
  };

  // ------------------------------------------------------------------ REDAÇÃO
  const VERBO = {
    aumentou: ['aumentou', 'cresceu', 'subiu', 'avançou'],
    diminuiu: ['recuou', 'caiu', 'diminuiu'],
    estavel: ['ficou estável', 'manteve-se estável', 'não apresentou variação estatisticamente significativa'],
  };
  const VERBO_TITULO = { aumentou: 'sobe para', diminuiu: 'recua para', estavel: 'fica estável em', sem: 'é de', desconhecida: 'é de', sig0: 'é de' };
  const VERBO_TITULO_CURTO = { aumentou: 'sobe', diminuiu: 'recua', estavel: 'fica estável', sem: 'é estimado', desconhecida: 'é estimado', sig0: 'é estimado' };

  function Redator(F) {
    const E = F.E, R = { F, E, pp: false, k: 0, nums: new Set(), pub: E.publico, midia: E.midia, estilo: E.estilo };
    R.reg = s => { (String(s).match(/\d[\d.]*(,\d+)?/g) || []).forEach(x => { R.nums.add(x); R.nums.add(x.replace(/\.$/, '')); }); return s; };
    R.tecnico = R.pub === 'gestores' || R.pub === 'academia';
    R.verbo = dir => { const l = VERBO[dir]; return l ? l[(R.k++) % l.length] : ''; };
    R.val = (it, v) => {
      if (vazio(v)) return '–';
      const ind = it.ind;
      if (ind.tipo === 'rendimento') return R.reg('R$ ' + inteiro(v));
      if (ind.tipo === 'contagem') { const mi = Math.round(v / 100) / 10; return R.reg(Math.round(v) >= 1000 ? num(mi, 1) + (mi < 2 ? ' milhão' : ' milhões') : inteiro(v) + ' mil'); }
      return R.reg(num(v, ind.casas === undefined ? 1 : ind.casas) + '%');
    };
    R.valPessoas = (it, v) => (it.ind.tipo === 'contagem' ? R.val(it, v) + (Math.round(v) >= 1000 ? ' de pessoas' : ' pessoas') : R.val(it, v));
    R.ppTxt = d => {
      const a = Math.abs(d), sing = Math.round(a * 10) < 20;
      if (R.pub === 'geral') return R.reg(num(a, 1)) + (sing ? ' ponto percentual' : ' pontos percentuais');
      if (!R.ppFeito) { R.ppFeito = true; return R.reg(num(a, 1)) + (sing ? ' ponto percentual (p.p.)' : ' pontos percentuais (p.p.)'); }
      return R.reg(num(a, 1)) + ' p.p.';
    };
    R.varTxt = (it, d) => (it.ind.tipo === 'taxa' ? R.ppTxt(d) : R.reg(num(Math.abs(d), 1)) + '%');
    R.cvTxt = it => (vazio(it.cv) ? '' : R.reg(`coeficiente de variação de ${num(it.cv, 1)}%, precisão ${precisao(it.cv).classe} na escala do IBGE`));
    // nota de precisão perto do número (apêndice): técnico sempre; público geral/imprensa só de "razoável" para baixo
    R.notaCv = it => {
      if (vazio(it.cv)) return '';
      if (R.tecnico) return ` (${R.cvTxt(it)})`;
      if (it.cv > CV_LIDE_MAX) return ` (estimativa pouco precisa: ${R.reg('coeficiente de variação de ' + num(it.cv, 1) + '%')}; diferenças pequenas não indicam mudança)`;
      if (it.cv > CV_AVISO) return ' (estimativa de precisão razoável, segundo a escala do IBGE)';
      return '';
    };
    R.notaCvCurta = it => {
      if (vazio(it.cv)) return '';
      if (R.tecnico) return ', CV ' + R.reg(num(it.cv, 1)) + '%';
      if (it.cv > CV_LIDE_MAX) return ', estimativa pouco precisa: CV de ' + R.reg(num(it.cv, 1)) + '%';
      if (it.cv > CV_AVISO) return ', precisão razoável';
      return '';
    };
    R.refAno = () => R.reg(perRefAno(F.per, F.fam));
    R.refAnt = () => R.reg(perRefAnt(F.per, F.fam));
    R.perL = () => R.reg(perLongo(F.per, F.fam));
    R.perC = () => R.reg(perCurto(F.per, F.fam));
    const pubIso = E.extras.dataPublicacao, divIso = F.div && F.div.data ? String(F.div.data).slice(0, 10) : null;
    R.hoje = !!(divIso && pubIso === divIso);
    R.divTxt = () => (R.hoje ? 'hoje' : 'em ' + R.reg(dataLonga(divIso)));
    R.divFalado = () => { if (R.hoje) return 'hoje'; const d = diasEntre(divIso, pubIso); if (d > 0 && d <= 6) return 'nesta ' + diaSemana(divIso).replace('sábado', 'último sábado').replace('domingo', 'último domingo'); const p = divIso.split('-'); return `no dia ${extenso(+p[2])} de ${MESES[+p[1] - 1]}`; };
    R.fraseFonte = () => (R.estilo === 'institucional'
      ? `segundo a Pesquisa Nacional por Amostra de Domicílios Contínua (PNAD Contínua), divulgada ${R.divTxt()} pelo Instituto Brasileiro de Geografia e Estatística (IBGE)`
      : `segundo a Pesquisa Nacional por Amostra de Domicílios Contínua (PNAD Contínua), divulgada ${R.divTxt()} pelo IBGE`);
    R.part = it => (it.nm.g === 'f' ? 'estimada' : 'estimado');
    return R;
  }
  /* PREDICADO da comparação: "recuou 1,0 ponto percentual (p.p.) em relação ao
     2º trimestre de 2025, de 3,6% para 2,6%". `comRef` false omite o "em
     relação ao ..." (quando o período já foi dito na frase). */
  function predicado(R, it, comp, comRef, insercao) {
    const dir = comp === 'ano' ? it.dirAno : it.dirAnt, d = comp === 'ano' ? it.va : it.vc, v0 = comp === 'ano' ? it.v0Ano : it.v0Ant;
    const ref = comp === 'ano' ? R.refAno() : R.refAnt();
    const emRel = (insercao || '') + (comRef === false ? '' : ` em relação ao ${ref}`);
    if (significativa(dir)) {
      const vb = R.verbo(dir);
      if (it.ind.tipo === 'taxa') return `${vb} ${R.ppTxt(d)}${emRel}` + (!vazio(v0) ? `, de ${R.val(it, v0)} para ${R.val(it, it.v)}` : '');
      if (it.ind.tipo === 'contagem' && !vazio(v0)) return `${vb} ${R.reg(num(Math.abs(d), 1))}%${emRel}, ${R.valPessoas(it, Math.abs(it.v - v0))} ${dir === 'aumentou' ? 'a mais' : 'a menos'}`;
      return `${vb} ${R.reg(num(Math.abs(d), 1))}%${emRel}` + (!vazio(v0) ? `, de ${R.val(it, v0)} para ${R.val(it, it.v)}` : '');
    }
    if (dir === 'estavel') {
      const vb = R.verbo('estavel');
      return `${vb}${emRel}` + (R.tecnico && !vazio(d) ? ` (diferença de ${it.ind.tipo === 'taxa' ? R.reg(num(d, 1).replace('-', '−')) + ' p.p.' : R.reg(num(d, 1).replace('-', '−')) + '%'}, não significativa no teste do IBGE, com 95% de confiança)` : '');
    }
    if (dir === 'sig0') return `teve variação estatisticamente significativa${emRel}, menor que o arredondamento`;
    // sem significância informada: verbo neutro (§3.3)
    if (!vazio(v0)) return comRef === false ? `passou de ${R.val(it, v0)} para ${R.val(it, it.v)} (o IBGE não indicou se a variação é significativa)`
      : `passou de ${R.val(it, v0)}, no ${ref}, para ${R.val(it, it.v)} (o IBGE não indicou se a variação é significativa)`;
    return `não tem comparação publicada com o ${ref}`;
  }
  /* qual comparação abre o fato: a anual, salvo quando só a do período anterior é significativa (§12.5) */
  function compPrincipal(E, it) {
    const ano = E.comparar.ano, ant = E.comparar.anterior;
    if (ano && (significativa(it.dirAno) || !(ant && significativa(it.dirAnt)))) return 'ano';
    if (ant) return 'ant';
    return null;
  }
  /* `extensa`: "ponto percentual" por extenso (a linha fina vem ANTES do lide,
     que é onde a sigla p.p. é apresentada) */
  const sitResumo = (R, it, comp, extensa) => {
    const dir = comp === 'ano' ? it.dirAno : it.dirAnt, d = comp === 'ano' ? it.va : it.vc;
    const quando = comp === 'ano' ? 'em um ano' : (R.F.fam === 'trimestral' ? 'frente ao trimestre anterior' : 'frente a três meses antes');
    const pp = extensa ? (Math.round(Math.abs(d) * 10) < 20 ? ' ponto percentual' : ' pontos percentuais') : ' p.p.';
    if (significativa(dir)) return `${dir === 'aumentou' ? 'subiu' : 'recuou'} ${it.ind.tipo === 'taxa' ? R.reg(num(Math.abs(d), 1)) + pp : R.reg(num(Math.abs(d), 1)) + '%'} ${quando}`;
    if (dir === 'estavel') return `estável ${quando}`;
    if (dir === 'sig0') return `variação significativa ${quando}, menor que o arredondamento`;
    return `sem significância informada ${quando}`;
  };
  /* frase "Isso quer dizer..." (didático/geral), só com variação significativa */
  const IMPLICA = {
    desocupacao: ['mais pessoas procurando trabalho sem encontrar', 'menos pessoas procurando trabalho sem encontrar'],
    ocupacao: ['uma parcela maior da população em idade de trabalhar está ocupada', 'uma parcela menor da população em idade de trabalhar está ocupada'],
    participacao: ['mais gente trabalhando ou procurando trabalho', 'menos gente trabalhando ou procurando trabalho'],
    informalidade: ['uma parcela maior dos ocupados trabalha sem vínculo formal', 'uma parcela menor dos ocupados trabalha sem vínculo formal'],
    subutilizacao: ['mais força de trabalho sem uso pleno', 'menos força de trabalho sem uso pleno'],
    desalento: ['mais gente que desistiu de procurar trabalho', 'menos gente que desistiu de procurar trabalho'],
    rendimento: ['ganho real, já descontada a inflação', 'perda real, já descontada a inflação'],
    ocupados: ['mais pessoas trabalhando', 'menos pessoas trabalhando'],
  };
  function implicacao(it, comp) {
    const dir = comp === 'ano' ? it.dirAno : it.dirAnt, I = IMPLICA[it.ind.id];
    if (!I || !significativa(dir)) return '';
    return `Na prática, ${it.ind.id === 'rendimento' ? 'é ' : 'há '}${I[dir === 'aumentou' ? 0 : 1]}.`;
  }
  /* proporção do dia a dia (§12.1), só para o público geral */
  function fracao(v) {
    const x = v / 100;
    if (x >= 0.30 && x <= 0.36) return 'cerca de um terço'; if (x >= 0.45 && x <= 0.55) return 'cerca da metade';
    if (x >= 0.23 && x <= 0.27) return 'cerca de um quarto'; if (x >= 0.18 && x <= 0.22) return 'cerca de um em cada cinco';
    if (x >= 0.08 && x <= 0.12) return 'cerca de um em cada dez'; return '';
  }

  // ---- frases de bloco
  function lideFrase(R, it, opc) {
    const F = R.F, E = R.E, t = F.terr, o = opc || {};
    if (t.conjunto) return lideConjunto(R, it, o);
    const comp = compPrincipal(E, it);
    const sujeito = o.ordem === 'terr' ? cap(t.em) + ', ' + it.nm.sujeito : cap(it.nm.sujeito) + ' ' + t.em;
    const fonte = o.semFonte ? '' : ', ' + R.fraseFonte();
    const outro = comp === 'ano' ? 'ant' : 'ano';
    const ligaOutro = comp && (outro === 'ano' ? E.comparar.ano : E.comparar.anterior);
    const fr = geral => (R.pub === 'geral' && it.ind.tipo === 'taxa' && fracao(it.v) ? `${fracao(it.v)} (${R.val(it, it.v)})` : R.val(it, it.v));
    if (!comp) return `${sujeito} foi ${R.part(it)} em ${fr()}${R.notaCv(it)} no ${R.perL()}${fonte}.`;
    const dir = comp === 'ano' ? it.dirAno : it.dirAnt;
    if (significativa(dir)) return `${sujeito} ${predicado(R, it, comp, true, ' no ' + R.perL())}${R.notaCv(it)}${fonte}.`;
    if (dir === 'estavel') {
      const ambos = ligaOutro && (outro === 'ano' ? it.dirAno : it.dirAnt) === 'estavel';
      if (ambos) { o.combinado = true; return `${sujeito} foi ${R.part(it)} em ${fr()}${R.notaCv(it)} no ${R.perL()} e ficou estável tanto em relação ao ${R.refAnt()} quanto ao ${R.refAno()}${fonte}.`; }
      return `${sujeito} foi ${R.part(it)} em ${fr()}${R.notaCv(it)} no ${R.perL()} e ${R.verbo('estavel')} em relação ao ${comp === 'ano' ? R.refAno() : R.refAnt()}${fonte}.`;
    }
    return `${sujeito} foi ${R.part(it)} em ${fr()}${R.notaCv(it)} no ${R.perL()}${fonte}. Na comparação com o ${comp === 'ano' ? R.refAno() : R.refAnt()}, ${it.nm.curto} ${predicado(R, it, comp, false)}.`;
  }
  /* Contagem por SITUAÇÃO publicada: 'estavel' só com A; '-', código
     desconhecido e 'sig0' (significativa, menor que o arredondamento) ficam em
     `outros` e são ditos "sem indicação de sentido" -- nunca "estável". */
  function contarDirecoes(dirs) {
    const k = { aumentou: 0, diminuiu: 0, estavel: 0, outros: 0, n: dirs.length };
    for (const d of dirs) { if (d === 'aumentou') k.aumentou++; else if (d === 'diminuiu') k.diminuiu++; else if (d === 'estavel') k.estavel++; else k.outros++; }
    return k;
  }
  M.contarDirecoes = contarDirecoes;
  function contagemConjunto(R, it, comp) { return contarDirecoes(it.conjunto.map(u => (comp === 'ano' ? u.dirAno : u.dirAnt))); }
  /* "recuou em 3 e subiu em 1 das 7 ..., ficou estável em 2 e não tem indicação de sentido em 1" */
  function fraseContagem(R, k, nome) {
    const n = R.reg(String(k.n)), rg = x => R.reg(String(x));
    if (!k.aumentou && !k.diminuiu) {
      if (k.estavel === k.n) return `ficou estável em todas as ${n} ${nome}`;
      if (!k.estavel) return `não tem indicação de sentido da variação publicada em nenhuma das ${n} ${nome}`;
      return `ficou estável em ${rg(k.estavel)} das ${n} ${nome} e não tem indicação de sentido da variação nas demais ${rg(k.outros)}`;
    }
    const partes = [];
    if (k.diminuiu) partes.push(`recuou em ${rg(k.diminuiu)}`);
    if (k.aumentou) partes.push(`subiu em ${rg(k.aumentou)}`);
    return `${partes.join(' e ')} das ${n} ${nome}` + (k.estavel ? `, ficou estável em ${rg(k.estavel)}` : '') + (k.outros ? ` e não tem indicação de sentido da variação em ${rg(k.outros)}` : '');
  }
  function lideConjunto(R, it, o) {
    const F = R.F, E = R.E, t = F.terr, n = it.conjunto.length;
    const comp = E.comparar.anterior ? 'ant' : E.comparar.ano ? 'ano' : null;
    const fonte = o.semFonte ? '' : ', ' + R.fraseFonte();
    const sujeito = cap(it.nm.sujeito);
    if (!comp) return `${sujeito} ${t.em} foi ${R.part(it)} no ${R.perL()}${fonte}.`;
    const k = contagemConjunto(R, it, comp), ref = comp === 'ano' ? R.refAno() : R.refAnt();
    return `${sujeito}, no ${R.perL()} em relação ao ${ref}, ${fraseContagem(R, k, t.nome)}${fonte}.`;
  }
  /* maiores e menores do grupo: fato aritmético, sem afirmar diferença (§2.5) */
  function extremosConjunto(R, it) {
    const c = it.conjunto; if (c.length < 3) return '';
    const fmt = u => `${u.de} (${R.val(it, u.v)})`;
    return `As maiores estimativas foram as ${lista(c.slice(0, 2).map(fmt))}; as menores, as ${lista(c.slice(-2).reverse().map(fmt))}.`;
  }
  function focoConjunto(R, it) {
    const u = it.focoUf; if (!u || !it.conjunto.length) return '';
    const comp = compPrincipal(R.E, Object.assign({}, it, { dirAno: u.dirAno, dirAnt: u.dirAnt }));
    const pseudo = Object.assign({}, it, { v: u.v, cv: u.cv, va: u.va, sa: u.sa, vc: u.vc, sc: u.sc, dirAno: u.dirAno, dirAnt: u.dirAnt, v0Ano: null, v0Ant: null });
    const pos = it.conjunto.indexOf(u) + 1, n = it.conjunto.length;
    // "entre as três" só diz algo num grupo de seis ou mais
    return `${cap(u.em)}, ${it.nm.curto} foi de ${R.val(it, u.v)}${R.notaCv(pseudo)}` + (comp ? ` e ${predicado(R, pseudo, comp)}` : '') + '.' +
      (n >= 6 && pos > n - 3 ? ` ${cap(u.nome)} está entre as três menores estimativas do grupo.` : n >= 6 && pos <= 3 ? ` ${cap(u.nome)} está entre as três maiores estimativas do grupo.` : '');
  }
  function sublide(R, it, combinado) {
    const E = R.E; if (R.F.terr.conjunto || combinado) return '';
    const comp = compPrincipal(E, it); if (!comp) return '';
    const outro = comp === 'ano' ? 'ant' : 'ano';
    if (!(outro === 'ano' ? E.comparar.ano : E.comparar.anterior)) return '';
    const ref = outro === 'ano' ? R.refAno() : R.refAnt();
    let s = `Na comparação com o ${ref}, ${it.nm.curto} ${predicado(R, it, outro, false)}.`;
    if ((outro === 'ant' || comp === 'ant') && sazonal(R.F.per, R.F.fam)) s += ' Na comparação com o trimestre anterior, é preciso considerar que o início do ano costuma registrar mais procura por trabalho.';
    return s;
  }
  function referencia(R, it) {
    const t = R.F.terr, r = it.refs || {};
    if (it.ind.tipo === 'contagem' || t.conjunto) return '';
    const pedaco = p => (p && !vazio(p.v) ? R.val(it, p.v) : null);
    if (t.id === 'uf' && pedaco(r.brasil)) return `No Brasil, ${it.nm.curto} foi de ${pedaco(r.brasil)}` + (pedaco(r.regiao) ? ` e, na Região ${R.F.regNome}, de ${pedaco(r.regiao)}` : '') + ', no mesmo período.';
    if (t.id === 'regiao' && pedaco(r.brasil)) return `No Brasil, ${it.nm.curto} foi de ${pedaco(r.brasil)} no mesmo período.`;
    if (t.id === 'capital' && pedaco(r.uf)) return `${cap(emUf(R.F.uf.sigla, R.F.uf.nome))}, ${it.nm.curto} foi de ${pedaco(r.uf)}` + (pedaco(r.brasil) ? ` e, no Brasil, de ${pedaco(r.brasil)}` : '') + '.';
    if (t.id === 'brasil' && R.F.fam === 'trimestral') {
      const fs = (R.F.D.series[it.ind.id] || {}).trimestral || {};
      const comp = R.E.comparar.anterior ? 'ant' : R.E.comparar.ano ? 'ano' : null;
      if (!comp) return '';
      const dirs = [];
      for (const k of Object.keys(fs)) if (k.indexOf('N3|') === 0) { const p = pontoEm(fs[k], R.F.per); if (!p || vazio(p.v)) continue; dirs.push(comp === 'ano' ? direcao(p.sa, p.va) : direcao(p.sc, p.vc)); }
      if (dirs.length < UFS_MIN) return '';
      const ref = comp === 'ano' ? R.refAno() : R.refAnt();
      return `Na comparação com o ${ref}, ${it.nm.curto} ${fraseContagem(R, contarDirecoes(dirs), 'unidades da federação')}.`;
    }
    return '';
  }
  function rankingFrase(R, it) {
    const rk = it.ranking; if (!rk || !it.nm.plural || it.ind.tipo === 'contagem') return '';
    const art = it.nm.gp === 'f' ? 'as' : 'os', t = R.F.terr, n = R.reg(String(rk.n));
    if (R.tecnico) {
      // gestores e academia: a posição exata, com a ressalva (§2.5, §5)
      const o = it.nm.gp === 'f' ? 'ª' : 'º', a = it.nm.gp === 'f' ? 'a' : 'o';
      return `Entre as ${n} unidades da federação, ${t.nome} tem ${a} ${R.reg(String(rk.posMenor))}${o} menor ${it.nm.sing} na ordenação das estimativas (${R.reg(String(rk.posMaior))}${o} maior) — posição aritmética: o IBGE não testa diferenças entre UFs, e UFs vizinhas no ranking podem não diferir.`;
    }
    if (rk.posMenor <= 5) return `Entre as ${n} unidades da federação, ${t.nome} está entre ${art} cinco menores ${it.nm.plural} do país.`;
    if (rk.posMaior <= 5) return `Entre as ${n} unidades da federação, ${t.nome} está entre ${art} cinco maiores ${it.nm.plural} do país.`;
    return '';
  }
  /* Série: recorde só com a série INTEIRA comparável (§3.7, §12.2) */
  function serieFrase(R, it) {
    const E = R.E; if (E.serie === 'nao' || !it.s || R.F.terr.conjunto) return '';
    const s = it.s, i = it.i, F = R.F;
    let ini = 0;
    if (E.serie === 'n5') ini = Math.max(0, i - (F.fam === 'trimestral' ? 19 : 59));
    if (E.serie === 'n2') ini = Math.max(0, i - (F.fam === 'trimestral' ? 7 : 23));
    const pts = []; for (let j = ini; j <= i; j++) if (!vazio(s.v[j])) pts.push({ per: s.per[j], v: s.v[j] });
    if (pts.length < 4) return '';
    // "série histórica" só com a série inteira E longa (20 pontos ou mais): série curta não sustenta recorde
    const inteira = ini === 0 && pts.length >= 20, anoIni = pAno(s.per[0]);
    const v = it.v, vals = pts.map(p => p.v), mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    const g = it.nm.g === 'f' ? 'a' : 'o';
    if (inteira) {
      const nMin = vals.filter(x => x === mn).length, nMax = vals.filter(x => x === mx).length;
      R.F.recorde = false;
      if (v === mn) { R.F.recorde = true; return `${cap(it.nm.curto)} de ${R.val(it, v)} é ${nMin > 1 ? `igual à menor da série histórica` : `${g} menor da série histórica`}, iniciada em ${R.reg(String(anoIni))}.`; }
      if (v === mx) { R.F.recorde = true; return `${cap(it.nm.curto)} de ${R.val(it, v)} é ${nMax > 1 ? `igual à maior da série histórica` : `${g} maior da série histórica`}, iniciada em ${R.reg(String(anoIni))}.`; }
      if (F.fam === 'trimestral') {
        const mesmo = pts.filter(p => pN(p.per) === pN(F.per)).map(p => p.v);
        if (mesmo.length >= 4 && v === Math.min.apply(null, mesmo) && mesmo.filter(x => x === v).length === 1) return `${cap(it.nm.curto)} de ${R.val(it, v)} é ${g} menor para um ${pN(F.per)}º trimestre desde o início da série, em ${R.reg(String(anoIni))}.`;
        if (mesmo.length >= 4 && v === Math.max.apply(null, mesmo) && mesmo.filter(x => x === v).length === 1) return `${cap(it.nm.curto)} de ${R.val(it, v)} é ${g} maior para um ${pN(F.per)}º trimestre desde o início da série, em ${R.reg(String(anoIni))}.`;
      }
    }
    const pMn = pts.find(p => p.v === mn), pMx = pts.find(p => p.v === mx);
    const abre = inteira ? `Na série iniciada em ${R.reg(String(anoIni))}` : E.serie === 'n5' ? 'Nos últimos cinco anos' : E.serie === 'n2' ? 'Nos últimos dois anos' : `Desde o ${R.reg(perLongo(s.per[ini], F.fam))}`;
    return `${abre}, ${it.nm.curto} ${R.F.terr.em} variou entre ${R.val(it, mn)} (${R.reg(perCurto(pMn.per, F.fam))}) e ${R.val(it, mx)} (${R.reg(perCurto(pMx.per, F.fam))}).`;
  }
    function paragrafoItem(R, it, ordem) {
    const E = R.E, comp = compPrincipal(E, it); if (!comp) return '';
    let s = `${cap(it.nm.sujeito)} ${R.F.terr.em} ${predicado(R, it, comp)}${R.notaCv(it)}.`;
    const outro = comp === 'ano' ? 'ant' : 'ano';
    if (outro === 'ano' ? E.comparar.ano : E.comparar.anterior) {
      s += ` Frente ao ${outro === 'ano' ? R.refAno() : R.refAnt()}, ${it.nm.curto} ${predicado(R, it, outro, false)}.`;
    }
    if (R.pub === 'geral' || R.estilo === 'didatico') { const imp = implicacao(it, comp); if (imp) s += ' ' + imp; }
    if (R.pub === 'geral' && it.ind.tipo === 'taxa' && fracao(it.v)) s += ` Isso equivale a ${fracao(it.v)} (${R.val(it, it.v)}).`;
    return s;
  }
  function itemSig(E, it) { return (E.comparar.ano && significativa(it.dirAno)) || (E.comparar.anterior && significativa(it.dirAnt)); }
  function itemEstavel(E, it) {
    const cs = []; if (E.comparar.ano) cs.push(it.dirAno); if (E.comparar.anterior) cs.push(it.dirAnt);
    return cs.length && cs.every(d => d === 'estavel');
  }
  function estaveisFrase(R, itens) {
    const E = R.E, est = itens.filter(it => itemEstavel(E, it)), semInfo = itens.filter(it => !itemSig(E, it) && !itemEstavel(E, it));
    const partes = [];
    const quando = E.comparar.ano && E.comparar.anterior ? 'nas duas comparações' : E.comparar.ano ? `na comparação com o ${R.refAno()}` : `na comparação com o ${R.refAnt()}`;
    if (est.length) partes.push(`Ficaram estáveis ${quando} ${lista(est.map(it => `${it.nm.sujeito} (${R.val(it, it.v)}${R.notaCvCurta(it)})`))}.`);
    if (semInfo.length && (E.comparar.ano || E.comparar.anterior)) partes.push(`Para ${lista(semInfo.map(it => `${it.nm.sujeito} (${R.val(it, it.v)}${R.notaCvCurta(it)})`))}, o IBGE não indicou a significância da variação.`);
    if (!E.comparar.ano && !E.comparar.anterior && itens.length) partes.push(`No mesmo período, ${lista(itens.map(it => `${it.nm.sujeito} foi de ${R.val(it, it.v)}`))}.`);
    return partes.join(' ');
  }
  const intertitulo = (R, it) => {
    const comp = compPrincipal(R.E, it), dir = comp === 'ano' ? it.dirAno : it.dirAnt;
    return `${it.nm.titulo} ${VERBO_TITULO_CURTO[dir] || 'é estimado'} ${R.F.terr.curto}`.replace('é estimado', it.nm.g === 'f' ? 'é estimada' : 'é estimado');
  };
  function tituloPadrao(R, it) {
    const F = R.F, E = R.E, t = F.terr;
    if (t.conjunto) {
      const comp = E.comparar.anterior ? 'ant' : 'ano', k = contagemConjunto(R, it, comp), n = it.conjunto.length;
      const suj = it.ind.id === 'desocupacao' ? (R.pub === 'imprensa' || R.pub === 'geral' ? 'Desemprego' : 'Desocupação') : it.nm.titulo;
      const quando = F.fam === 'trimestral' ? ` no ${pN(F.per)}º trimestre` : '';
      if (!k.aumentou && !k.diminuiu) {
        if (k.estavel === n) return `${suj} fica estável em todas as ${n} ${t.nome}${quando}`;
        if (k.estavel) return `${suj} fica estável em ${k.estavel} das ${n} ${t.nome}${quando}`;
        return `${suj} ${t.em}${quando}: sem indicação de sentido da variação`;
      }
      return `${suj} ${k.diminuiu >= k.aumentou ? `recua em ${k.diminuiu}` : `sobe em ${k.aumentou}`} das ${n} ${t.nome}${quando}`;
    }
    const comp = compPrincipal(E, it), dir = comp === 'ano' ? it.dirAno : comp === 'ant' ? it.dirAnt : 'sem';
    const suj = it.ind.id === 'desocupacao' ? (R.pub === 'imprensa' || R.pub === 'geral' ? 'Desemprego' : 'Desocupação') : it.nm.titulo;
    const val = R.val(it, it.v);
    const verbo = VERBO_TITULO[dir] || 'é de';
    const perT = F.fam === 'trimestral' ? `no ${pN(F.per)}º trimestre de ${pAno(F.per)}` : `no trimestre encerrado em ${MESES[pN(F.per) - 1]}`;
    const frente = comp === 'ant' && significativa(dir) ? (F.fam === 'trimestral' ? ` frente ao ${pN(perAnterior(F.per, F.fam))}º trimestre` : ' frente a três meses antes') : '';
    let tt = `${suj} ${t.em} ${verbo} ${val} ${perT}${frente}`;
    if (tt.length > 90) tt = `${suj} ${t.em} ${verbo} ${val}${frente}`;      // §12.6: o período vai para a linha fina
    return tt;
  }

  // ------------------------------------------------------------------ ALTERNATIVAS de redação (manchete, linha fina, lide)
  /* Cada alternativa é montada com os MESMOS fatos e as mesmas regras (verbo de tendência só com significância, nada de causa,
     diferença entre territórios só como fato aritmético) e passa pela mesma conferência. O assistente mostra as opções e guarda a
     escolha em E.extras.alt; sem escolha vale a primeira (a padrão). Montar as alternativas não pode mexer no rodízio de verbos. */
  const minusc = s => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const ARTIGO_INICIAL = /^(A|O|As|Os|Um|Uma|Uns|Umas) /;
  const minArt = s => (ARTIGO_INICIAL.test(s) ? minusc(s) : s);
  const semEfeito = (R, fn) => { const k = R.k, pf = R.ppFeito; try { return fn(); } finally { R.k = k; R.ppFeito = pf; } };
  const unicas = lista => { const vistos = new Set(); return lista.filter(a => { const k = semAcento(a.texto).toLowerCase(); if (!a.texto || vistos.has(k)) return false; vistos.add(k); return true; })
    .map(a => Object.assign({}, a, { nota: `${a.texto.length} caracteres${a.texto.length > 100 && a.grupo === 'titulo' ? ' (longo para manchete)' : ''}` })); };
  const escolhida = (R, grupo, lista) => { const id = (R.E.extras.alt || {})[grupo]; return lista.find(x => x.id === id) || lista[0]; };
  function titulos(R, it) {
    return semEfeito(R, () => {
      const F = R.F, E = R.E, t = F.terr, out = [{ id: 'padrao', rot: 'Verbo e valor (padrão)', texto: tituloPadrao(R, it) }];
      if (t.conjunto) {
        out.push({ id: 'institucional', rot: 'Institucional', texto: 'PNAD Contínua: ' + minusc(out[0].texto) });
        return unicas(out.map(a => Object.assign(a, { grupo: 'titulo' })));
      }
      const comp = compPrincipal(E, it), dir = comp === 'ano' ? it.dirAno : comp === 'ant' ? it.dirAnt : 'sem';
      const suj = it.ind.id === 'desocupacao' ? (R.pub === 'imprensa' || R.pub === 'geral' ? 'Desemprego' : 'Desocupação') : it.nm.titulo;
      const val = R.val(it, it.v);
      const perT = F.fam === 'trimestral' ? `no ${pN(F.per)}º trimestre de ${pAno(F.per)}` : `no trimestre encerrado em ${MESES[pN(F.per) - 1]}`;
      const quando = comp === 'ano' ? 'em um ano' : (F.fam === 'trimestral' ? 'frente ao trimestre anterior' : 'frente a três meses antes');
      if (significativa(dir)) {
        const d = comp === 'ano' ? it.va : it.vc;
        const delta = R.reg(num(Math.abs(d), 1)) + (it.ind.tipo === 'taxa' ? ' p.p.' : '%');
        out.push({ id: 'variacao', rot: 'Foco na variação', texto: `${suj} ${t.em} ${dir === 'aumentou' ? 'sobe' : 'recua'} ${delta} ${quando} e chega a ${val}` });
      }
      out.push({ id: 'numero', rot: 'Número em primeiro lugar', texto: `${val}: ${minusc(suj)} ${t.em} ${perT}` });
      const r = it.refs || {};
      const ref = (t.id === 'uf' || t.id === 'regiao') && r.brasil ? ['no Brasil', r.brasil] : t.id === 'capital' && r.uf ? [emUf(F.uf.sigla, F.uf.nome), r.uf] : null;
      if (ref && it.ind.tipo !== 'contagem' && !vazio(ref[1].v)) out.push({ id: 'contexto', rot: 'Com a referência (sem afirmar diferença)', texto: `${suj} ${t.em} é de ${val}; ${ref[0]}, ${R.val(it, ref[1].v)}` });
      out.push({ id: 'curto', rot: 'Curto', texto: `${suj} ${t.sigla ? 'em ' + t.sigla : t.em}: ${val}` });
      const inst = `PNAD Contínua: ${minusc(suj)} ${t.em} ${VERBO_TITULO[dir] || 'é de'} ${val} ${perT}`;
      out.push({ id: 'institucional', rot: 'Institucional', texto: inst });
      return unicas(out.map(a => Object.assign(a, { grupo: 'titulo' })));
    });
  }
  const titulo = (R, it) => escolhida(R, 'titulo', titulos(R, it)).texto;
  function lides(R, it) {
    const t = R.F.terr, f = o => semEfeito(R, () => lideFrase(R, it, o));
    const out = [{ id: 'padrao', rot: 'Fato, comparação e fonte (padrão)', texto: f({}) }];
    if (!t.conjunto) {
      out.push({ id: 'territorio', rot: 'Começa pelo território', texto: f({ ordem: 'terr' }) });
      out.push({ id: 'fonte', rot: 'Começa pela fonte', texto: `${cap(R.fraseFonte())}, ${minArt(f({ semFonte: true }))}` });
    }
    out.push({ id: 'enxuto', rot: 'Enxuto (a fonte fica na linha de fonte)', texto: f({ semFonte: true }) });
    return unicas(out.map(a => Object.assign(a, { grupo: 'lide' })));
  }
  function lideEscolhido(R, it, o) {
    const id = (R.E.extras.alt || {}).lide;
    if (id === 'territorio') return lideFrase(R, it, Object.assign(o, { ordem: 'terr' }));
    if (id === 'fonte') return `${cap(R.fraseFonte())}, ${minArt(lideFrase(R, it, Object.assign(o, { semFonte: true })))}`;
    if (id === 'enxuto') return lideFrase(R, it, Object.assign(o, { semFonte: true }));
    return lideFrase(R, it, o);
  }
  function linhasFinas(R, it, resto, semPer) {
    return semEfeito(R, () => unicas([
      { id: 'padrao', rot: 'Destaque, referência e período (padrão)', texto: linhaFina(R, it, resto, semPer, 'padrao') },
      { id: 'contexto', rot: 'Referência primeiro', texto: linhaFina(R, it, resto, semPer, 'contexto') },
      { id: 'curta', rot: 'Curta (uma informação)', texto: linhaFina(R, it, resto, semPer, 'curta') },
    ].map(a => Object.assign(a, { grupo: 'linhaFina' }))));
  }
  /* alternativas para o assistente (site e jornal): { titulo, linhaFina, lide } */
  M.alternativas = function (F) {
    if (!F || !F.lide || !F.per) return null;
    const R = Redator(F), it = F.lide, tt = titulo(R, it);
    return { titulo: titulos(R, it), linhaFina: linhasFinas(R, it, F.resto, tt.indexOf('trimestre') < 0), lide: lides(R, it) };
  };
  function linhaFina(R, lide, resto, tituloSemPeriodo, modo) {
    const F = R.F, E = R.E;
    const sig = resto.filter(it => itemSig(E, it)).sort((a, b) => relevancia(b) - relevancia(a));
    const pPer = tituloSemPeriodo ? cap(R.perL()) : null;
    let pSig = null, pRef = null;
    if (sig.length) { const it = sig[0], comp = compPrincipal(E, it); pSig = `${it.nm.titulo} ${sitResumo(R, it, comp, true)}`; }
    const r = lide.refs || {};
    const nomeL = lide.nm.titulo.toLowerCase();
    if (F.terr.id === 'uf' && r.brasil && lide.ind.tipo !== 'contagem') pRef = `no Brasil, ${nomeL} de ${R.val(lide, r.brasil.v)}` + (r.regiao ? `; na Região ${F.regNome}, de ${R.val(lide, r.regiao.v)}` : '');
    else if (F.terr.id === 'regiao' && r.brasil && lide.ind.tipo !== 'contagem') pRef = `no Brasil, ${nomeL} de ${R.val(lide, r.brasil.v)}`;
    else if (F.terr.id === 'capital' && r.uf) pRef = `${emUf(F.uf.sigla, F.uf.nome)}, ${nomeL} de ${R.val(lide, r.uf.v)}`;
    const m = modo || (R.E.extras.alt || {}).linhaFina || 'padrao';
    let partes = (m === 'contexto' ? [pPer, pRef, pSig] : [pPer, pSig, pRef]).filter(Boolean);
    if (m === 'curta') partes = [pPer, pSig || pRef].filter(Boolean);
    if (!partes.length) { const rk = rankingFrase(R, lide); if (rk) partes.push(rk.replace(/\.$/, '')); }
    return cap(partes.map((p, i) => (i && p === pSig ? minusc(p) : p)).join('; '));
  }
  function citacao(E) {
    const p = E.extras.portaVoz;
    return `[CITAÇÃO — porta-voz: ${p.nome || 'NOME'}, ${p.cargo || 'CARGO'}. Inserir apenas declaração real, dita ou aprovada pela pessoa.]`;
  }
  const NOTA_MINIMA = 'A Pesquisa Nacional por Amostra de Domicílios Contínua (PNAD Contínua), do IBGE, investiga o mercado de trabalho das pessoas de 14 anos ou mais. A cada trimestre são visitados cerca de 211 mil domicílios em todo o país, e cada domicílio é entrevistado em cinco trimestres seguidos. Os resultados são estimativas de uma amostra. Por isso o IBGE só considera aumento ou queda a variação estatisticamente significativa; as demais são tratadas como estabilidade. A série começa em 2012. Resultados por unidade da federação são trimestrais (janeiro a março, abril a junho, julho a setembro, outubro a dezembro).';
  const NOTA_EXTRA = 'Os testes de significância do IBGE usam 95% de confiança e consideram a covariância entre trimestres, porque 80% dos domicílios se repetem de um trimestre para o seguinte (a amostra é renovada em rodízio). O coeficiente de variação (CV) mede a precisão de cada estimativa; o IBGE a classifica como ótima (até 5%), boa (5% a 15%), razoável (15% a 30%), pouco precisa (30% a 50%) ou imprecisa (acima de 50%). Comparações entre unidades da federação ou com o Brasil não têm teste publicado.';
  const NOTA_MOVEL = 'O trimestre móvel é divulgado todo mês e só para o Brasil; a comparação é com o trimestre móvel de três meses antes, sem meses em comum.';
  M.NOTA_MINIMA = NOTA_MINIMA;
  function linhaFonte(R) {
    const F = R.F;
    return R.reg(`Fonte: IBGE, PNAD Contínua ${F.fam === 'trimestral' ? 'trimestral' : 'mensal (trimestre móvel)'}. SIDRA, ${F.tabelas.length > 1 ? 'tabelas' : 'tabela'} ${lista(F.tabelas)}.` +
      (F.consulta ? ` Consulta em ${dataCurta(F.consulta)}.` : '') + ` Referência: ${perLongo(F.per, F.fam)}. Divulgação oficial: ${dataCurta(F.div.data)}.`);
  }
  const linkDe = R => R.E.extras.link || (R.F.tabelas[0] ? `https://sidra.ibge.gov.br/tabela/${R.F.tabelas[0]}` : 'https://sidra.ibge.gov.br');
  function linhaContato(E) {
    const c = E.extras.contato; const p = [c.setor, c.telefone, c.email].filter(x => String(x || '').trim());
    return p.length ? 'Contato: ' + p.join(' – ') : '';
  }
  function cidadeDe(R) {
    const F = R.F, c = String(R.E.extras.cidade || '').trim();
    return c || F.capNome || '';
  }

  // ------------------------------------------------------------------ MÍDIAS
  /* SITE / IMPRESSO: pirâmide, cortada de baixo para cima (§7) */
  function releaseTexto(R) {
    const F = R.F, E = R.E, it = F.lide, md = [];
    const tam = E.tamanho;
    const blocos = [];   // { md, prioridade (menor = mais importante), corta }
    const tt = titulo(R, it);
    const semPer = tt.indexOf('trimestre') < 0;
    const o = {};
    const cidade = cidadeDe(R);
    const dateline = cidade && E.extras.dataPublicacao ? `${cidade}, ${R.reg(dataLonga(E.extras.dataPublicacao))} – ` : '';
    let lide = lideEscolhido(R, it, o);
    if (tam === 'curta') {
      const ref = referencia(R, it);
      const txt = [`# ${tt}`, '', dateline + lide + (ref ? ' ' + ref : '') + (F.terr.conjunto ? ' ' + focoConjunto(R, it) : ''), '', R.reg(`Fonte: IBGE, PNAD Contínua, SIDRA tabela ${F.tabelas[0]}. Divulgação oficial: ${dataCurta(F.div.data)}.`) + ` Mais informações: ${linkDe(R)}`];
      return { md: txt.join('\n'), titulo: tt };
    }
    const lf = linhaFina(R, it, F.resto, semPer);
    blocos.push({ p: 0, t: `# ${tt}` });
    if (lf) blocos.push({ p: 0, t: `*${lf}*` });
    blocos.push({ p: 0, t: dateline + lide });
    if (F.terr.conjunto) { const ex = extremosConjunto(R, it); if (ex) blocos.push({ p: 1, t: ex }); const fc = focoConjunto(R, it); if (fc) blocos.push({ p: 1, t: fc }); }
    const sl = sublide(R, it, o.combinado); if (sl) blocos.push({ p: 1, t: sl });
    const ref = referencia(R, it); if (ref) blocos.push({ p: 1, t: ref });
    const sig = F.resto.filter(x => itemSig(E, x)), est = F.resto.filter(x => !itemSig(E, x));
    if (E.extras.destaques && F.resto.length) {
      blocos.push({ p: 2, t: '## Principais destaques' });
      blocos.push({ p: 2, t: F.resto.slice(0, 5).map(x => { const c = compPrincipal(E, x); return `- ${x.ind.rotulo}: ${R.val(x, x.v)}` + (c ? ` (${sitResumo(R, x, c)})` : ''); }).join('\n') });
    }
    let prev = null;
    sig.forEach((x, i) => {
      const par = paragrafoItem(R, x, i);
      if (!par) return;
      if (!F.terr.conjunto) blocos.push({ p: 3 + i, t: `## ${intertitulo(R, x)}`, corta: 'ind' + i });
      let pt = par;
      // análise: contraste só entre fatos significativos de direção oposta (§12.3)
      if (R.estilo === 'analise' && prev) { const d1 = compPrincipal(E, prev) === 'ano' ? prev.dirAno : prev.dirAnt, d2 = compPrincipal(E, x) === 'ano' ? x.dirAno : x.dirAnt; if (significativa(d1) && significativa(d2) && d1 !== d2) pt = 'Ao mesmo tempo, ' + pt.charAt(0).toLowerCase() + pt.slice(1); }
      blocos.push({ p: 3 + i, t: pt, corta: 'ind' + i });
      prev = x;
    });
    const ef = estaveisFrase(R, est); if (ef) blocos.push({ p: 9, t: ef, corta: 'est' });
    const sf = serieFrase(R, it); if (sf) blocos.push({ p: 10, t: (tam === 'completo' ? '## Contexto\n' : '') + sf, corta: 'serie' });
    const rk = rankingFrase(R, it); if (rk && F.terr.id === 'uf') blocos.push({ p: 11, t: rk, corta: 'rank' });
    if (tam === 'completo' && F.terr.id === 'uf' && E.visuais && E.visuais.tabela) blocos.push({ p: 12, t: tabelaMd(R), corta: 'tab' });
    if (R.pub === 'equipe') blocos.push({ p: 12, t: 'Cada entrevista realizada entra na precisão destas estimativas: com menos domicílios respondendo, o coeficiente de variação cresce e variações reais deixam de ser detectadas como significativas.', corta: 'equipe' });
    if (E.extras.portaVoz.incluir) blocos.push({ p: 13, t: '> ' + citacao(E) });
    const entenda = E.extras.entenda || R.estilo === 'didatico' || R.pub === 'geral' || tam === 'completo';
    if (entenda) { const ents = F.itens.filter(x => ENTENDA[x.ind.id]).slice(0, tam === 'completo' ? 8 : 2).map(x => `- ${x.nm.titulo}: ${ENTENDA[x.ind.id]}`); if (ents.length) blocos.push({ p: 14, t: '## Entenda\n' + ents.join('\n'), corta: 'entenda' }); }
    const nota = E.extras.nota === 'auto' ? (tam === 'completo' || R.pub === 'academia' ? 'estendida' : 'minima') : E.extras.nota;
    if (nota === 'link') blocos.push({ p: 0, t: `Sobre a pesquisa: ${linkDe(R)}` });
    else blocos.push({ p: 0, t: '### Sobre a pesquisa\n' + NOTA_MINIMA + (F.fam === 'movel' ? ' ' + NOTA_MOVEL : '') + (nota === 'estendida' ? '\n\n' + NOTA_EXTRA : '') });
    blocos.push({ p: 0, t: linhaFonte(R) + `\nMais informações: ${linkDe(R)}` + (linhaContato(E) ? '\n' + linhaContato(E) : '') });
    // corte para o tamanho: do fim para o começo, nunca nota, fonte, contato, lide (§7)
    const faixa = (M.TAMANHOS[tam] || M.TAMANHOS.padrao).faixa;
    let vivos = blocos.slice();
    const comprimento = bs => planoDeMd(bs.map(b => b.t).join('\n\n')).length;
    while (comprimento(vivos) > faixa[1]) {
      const cortaveis = vivos.filter(b => b.corta);
      if (!cortaveis.length) break;
      const pior = cortaveis.reduce((a, b) => (b.p >= a.p ? b : a));
      vivos = vivos.filter(b => b.corta !== pior.corta);
    }
    return { md: vivos.map(b => b.t).join('\n\n'), titulo: tt };
  }
  function tabelaMd(R) {
    const F = R.F, t = F.terr;
    const cab = `| Indicador | ${t.nome} | CV | × ${perCurto(perAnoAnt(F.per), F.fam)} | Situação | Região ${F.regNome} | Brasil |`;
    const sep = '|---|---:|---:|---:|---|---:|---:|';
    const ls = F.itens.map(it => `| ${it.ind.rotulo} | ${R.val(it, it.v)} | ${vazio(it.cv) ? '–' : R.reg(num(it.cv, 1)) + '%'} | ${vazio(it.va) ? '–' : R.reg(num(it.va, 1).replace('-', '−')) + (it.ind.tipo === 'taxa' ? ' p.p.' : '%')} | ${({ aumentou: 'aumentou', diminuiu: 'diminuiu', estavel: 'estável', sem: 'sem indicação', sig0: 'significativa (< arredondamento)', desconhecida: 'código não reconhecido' })[it.dirAno]} | ${it.refs && it.refs.regiao ? R.val(it, it.refs.regiao.v) : '–'} | ${it.refs && it.refs.brasil ? R.val(it, it.refs.brasil.v) : '–'} |`);
    return [`### Indicadores ${t.de}, ${perCurto(F.per, F.fam)}`, cab, sep].concat(ls).join('\n') + `\n\n${linhaFonte(R)}`;
  }
  /* RÁDIO (§4.3, §11.4): no máximo três números, por extenso, fonte antes do fato */
  /* Contagem falada (v em MIL pessoas), arredondada por faixa: abaixo de 100 mil,
     ao milhar; até 1 milhão, à dezena de milhar; até 10 milhões, à centena de
     milhar; acima, ao milhão. Quando o arredondamento chega à unidade seguinte
     sem o valor chegar lá, "quase" (995 mil = "quase um milhão"). */
  function falaContagem(v) {
    if (v < 100) return `cerca de ${extenso(Math.round(v), true)} mil pessoas`;
    if (v < 1000) { const r = Math.round(v / 10) * 10; return r >= 1000 ? 'quase um milhão de pessoas' : `cerca de ${extenso(r, true)} mil pessoas`; }
    if (v < 10000) {
      const r = Math.round(v / 100) * 100; if (r >= 10000) return 'quase dez milhões de pessoas';
      const mi = Math.floor(r / 1000), mil = r - mi * 1000, mis = mi === 1 ? 'um milhão' : extenso(mi) + ' milhões';
      return mil ? `cerca de ${mis} e ${extenso(mil, true)} mil pessoas` : `cerca de ${mis} de pessoas`;
    }
    return `cerca de ${extenso(Math.round(v / 1000))} milhões de pessoas`;
  }
  M.falaContagem = falaContagem;
  function falaValor(it, v) {
    if (it.ind.tipo === 'rendimento') { const r = Math.round(v / 100) * 100; return `cerca de ${extenso(r)} reais`; }
    if (it.ind.tipo === 'contagem') return falaContagem(v);
    return `${decimalFalado(v, it.ind.casas === undefined ? 1 : it.ind.casas)} por cento`;
  }
  function falaVar(it, d) {
    if (it.ind.tipo === 'taxa') { const a = Math.abs(d); return `${decimalFalado(a, 1)} ${Math.round(a * 10) < 20 ? 'ponto percentual' : 'pontos percentuais'}`; }
    return `${decimalFalado(Math.abs(d), 1)} por cento`;
  }
  const VERBO_FALADO = { aumentou: 'subiu', diminuiu: 'caiu', estavel: 'ficou estável' };
  function radio(R) {
    const F = R.F, E = R.E, it = F.lide, t = F.terr, seg = +E.segundos || 30;
    const anoPub = E.extras.dataPublicacao ? +E.extras.dataPublicacao.slice(0, 4) : pAno(F.per);
    const per = perFalado(F.per, F.fam, anoPub);
    const comp = compPrincipal(E, it), dir = comp === 'ano' ? it.dirAno : comp === 'ant' ? it.dirAnt : 'sem';
    const onde = t.id === 'brasil' ? 'no país' : (t.id === 'uf' || t.conjunto) ? 'no estado' : t.id === 'capital' ? 'na capital' : t.em;
    const nomeT = t.conjunto ? t.foco.nome : t.nome;
    let nNum = 0;
    const cabeca = significativa(dir) || dir === 'estavel'
      ? `${cap(it.nm.falado)} ${t.conjunto ? t.foco.em : t.em} ${VERBO_FALADO[dir]}${comp === 'ano' ? ' em um ano' : dir === 'estavel' ? '' : ' frente ao trimestre anterior'} no ${per}.`
      : `O IBGE divulgou ${R.hoje ? 'hoje ' : ''}os números do trabalho ${t.conjunto ? t.foco.em : t.em} no ${per}.`;
    const linhas = [];
    // 15 s: a cabeça já nomeou o indicador; "a taxa" basta e cabe no tempo
    linhas.push(`Segundo o IBGE, ${seg <= 15 ? it.nm.curto : it.nm.sujeito} ${onde} foi de ${falaValor(it, t.conjunto ? it.focoUf.v : it.v)}.`); nNum++;
    if (significativa(dir) && seg >= 30) { linhas.push(`${cap(it.nm.curto)} ${VERBO_FALADO[dir]} ${falaVar(it, comp === 'ano' ? it.va : it.vc)} ${comp === 'ano' ? 'em um ano' : 'em relação ao trimestre anterior'}.`); nNum++; }
    const rb = it.refs && it.refs.brasil;
    if (seg >= 30 && rb && it.ind.tipo !== 'contagem' && nNum < 3) { linhas.push(`No país, ${it.nm.curto} ficou em ${falaValor(it, rb.v)}.`); nNum++; }
    if (seg >= 45 && nNum < 3) {
      const x = F.resto.find(y => itemSig(E, y));
      if (x) { const c = compPrincipal(E, x), d2 = c === 'ano' ? x.dirAno : x.dirAnt; linhas.push(`${cap(x.nm.falado)} ${VERBO_FALADO[d2]}${c === 'ano' ? ' em um ano' : ''} e chegou a ${falaValor(x, x.v)}.`); nNum++; }
    }
    if (seg >= 30 && rankingFrase(R, it) && it.ranking && it.ranking.posMenor <= 5) linhas.push(`${nomeT} está entre os estados com ${it.ind.id === 'desocupacao' ? 'menor desemprego' : 'menores ' + it.nm.plural}.`);
    linhas.push(seg <= 15 ? `Dados do IBGE, divulgados ${R.divFalado()}.` : `Os dados são da pesquisa do IBGE sobre trabalho, divulgada ${R.divFalado()}.`);
    if (seg >= 60) linhas.push(cabeca.replace(/\.$/, ', segundo o IBGE.'));
    const texto = linhas.join('\n');
    const ult = linhas[linhas.length - 1].split(' ').slice(-3).join(' ');
    const pal = palavras(cabeca) + palavras(texto);
    const segEst = Math.round(pal * 60 / 140);
    const lauda = `[CABEÇA/LOCUTOR]\n${cabeca}\n[TEXTO]\n${texto}\n[DEIXA] ... ${ult}\n[TEMPO ESTIMADO: ${segEst} s · ${pal} palavras · pedido: ${seg} s]`;
    return { plano: lauda, titulo: cabeca, falado: { palavras: pal, segundos: segEst, pedido: seg, numeros: nNum } };
  }
  /* TV (§4.4, §11.5) */
  function tv(R) {
    const F = R.F, E = R.E, it = F.lide, t = F.terr, seg = +E.segundos || 30;
    const anoPub = E.extras.dataPublicacao ? +E.extras.dataPublicacao.slice(0, 4) : pAno(F.per);
    const per = perFalado(F.per, F.fam, anoPub);
    const comp = compPrincipal(E, it), dir = comp === 'ano' ? it.dirAno : comp === 'ant' ? it.dirAnt : 'sem';
    const lugar = t.conjunto ? t.foco : t;
    const v = t.conjunto ? it.focoUf.v : it.v;
    const sitFal = significativa(dir) || dir === 'estavel' ? ` ${VERBO_FALADO[dir]}${comp === 'ano' ? ' em um ano' : dir === 'estavel' ? '' : ' frente ao trimestre anterior'}` : ' foi divulgada';
    const cabeca = `O IBGE divulgou ${R.hoje ? 'hoje ' : ''}os números do trabalho no ${per}. ${cap(lugar.em)}, ${it.nm.sujeito}${sitFal}.`;
    const gc = [`${String(lugar.nome).toUpperCase()} – ${it.ind.id === 'desocupacao' ? 'DESOCUPAÇÃO' : String(it.nm.titulo).toUpperCase()}: ${R.val(it, v)}`];
    const rb = it.refs && it.refs.brasil;
    if (rb && it.ind.tipo !== 'contagem') gc.push(`BRASIL: ${R.val(it, rb.v)}`);
    gc.push(`Fonte: IBGE – PNAD Contínua – ${R.perC()}`);
    const off = [];
    if (seg > 15) {
      off.push(`${cap(it.nm.curto)} foi de ${falaValor(it, v)}${it.ranking && it.ranking.posMenor <= 5 ? ', uma das menores do país' : ''}.`);
      if (rb && it.ind.tipo !== 'contagem') off.push(`A média nacional ficou em ${falaValor(it, rb.v).replace(' por cento', '')}.`);
      if (seg >= 45) { const x = F.resto.find(y => itemSig(E, y)); if (x) { const c = compPrincipal(E, x), d2 = c === 'ano' ? x.dirAno : x.dirAnt; off.push(`${cap(x.nm.falado)} ${VERBO_FALADO[d2]}${c === 'ano' ? ' em um ano' : ''}.`); } }
      if (seg >= 60 && significativa(dir)) off.push(`Em relação ao ${comp === 'ano' ? 'mesmo trimestre do ano passado' : 'trimestre anterior'}, a variação foi de ${falaVar(it, comp === 'ano' ? it.va : it.vc)}.`);
    }
    const pe = R.hoje ? 'Os dados completos estão no site do IBGE.' : `Os dados, divulgados ${R.divFalado()}, estão no site do IBGE.`;
    const pal = palavras(cabeca) + palavras(off.join(' ')) + palavras(pe);
    const segEst = Math.round(pal * 60 / 140);
    const txt = seg <= 15
      ? `NOTA PELADA (apresentador, ~${segEst} s): ${cabeca} ${pe}\n${gc.map((g, i) => `GC${i + 1}: ${g}`).join('\n')}\n[TEMPO ESTIMADO: ${segEst} s · ${pal} palavras · pedido: ${seg} s]`
      : `CABEÇA (apresentador, ~${Math.round(palavras(cabeca) * 60 / 140)} s): ${cabeca}\nOFF (~${Math.round(palavras(off.join(' ')) * 60 / 140)} s, sobre imagens de comércio, obra ou carteira de trabalho): ${off.join(' ')}\n${gc.map((g, i) => `GC${i + 1}: ${g}`).join('\n')}\nPÉ (apresentador, ~2 s): ${pe}\n[TEMPO ESTIMADO: ${segEst} s · ${pal} palavras · pedido: ${seg} s]`;
    R.reg(txt);
    return { plano: txt, titulo: cabeca, falado: { palavras: pal, segundos: segEst, pedido: seg, numeros: gc.length - 1 } };
  }
  const hashtags = R => { const t = R.F.terr, lugar = t.id === 'uf' || t.id === 'capital' ? t.nome : t.conjunto ? t.foco.nome : null; return ['#PNADContínua'].concat(lugar ? ['#' + lugar.replace(/[\s'-]+/g, '')] : []).concat(['#IBGE']).slice(0, 3); };
  function tituloCurto(R, it) {
    const F = R.F, t = F.terr, comp = compPrincipal(R.E, it), dir = comp === 'ano' ? it.dirAno : comp === 'ant' ? it.dirAnt : 'sem';
    const suj = it.ind.id === 'desocupacao' ? 'Desocupação' : it.nm.titulo, lugar = t.conjunto ? t.foco : t;
    return `${suj} ${lugar.em} ${VERBO_TITULO[dir] || 'é de'} ${R.val(it, t.conjunto ? it.focoUf.v : it.v)} (${R.perC()})`;
  }
  function x(R) {
    const F = R.F, it = F.lide, t = F.terr, comp = compPrincipal(R.E, it), lugar = t.conjunto ? t.foco : t;
    const sit = comp ? ', ' + sitResumo(R, it, comp).replace('em um ano', `em relação a ${pAno(F.per) - 1}`) : '';
    const rb = it.refs && it.refs.brasil;
    const base = `${lugar.nome}: ${it.nm.sujeito.replace(/^(a|o) /, '')} de ${R.val(it, t.conjunto ? it.focoUf.v : it.v)} no ${R.perC()}${sit}.`;
    const ref = rb && it.ind.tipo !== 'contagem' ? ` Brasil: ${R.val(it, rb.v)}.` : '';
    const link = linkDe(R), hs = hashtags(R);
    const montar = (ref2, nh) => `${base}${ref2} Fonte: IBGE, PNAD Contínua. ${link}` + (nh ? ' ' + hs.slice(0, nh).join(' ') : '');
    const tam = s => s.length - link.length + LIM.urlX;
    let s = montar(ref, 3);
    if (tam(s) > LIM.x) s = montar(ref, 1);
    if (tam(s) > LIM.x) s = montar('', 1);
    if (tam(s) > LIM.x) s = montar('', 0);
    return { plano: s, titulo: base };
  }
  function whatsapp(R) {
    const F = R.F, E = R.E, it = F.lide, t = F.terr;
    const linhas = [`*${tituloCurto(R, it)}*`];
    const rb = it.refs && it.refs.brasil, rr = it.refs && it.refs.regiao;
    if (rb && it.ind.tipo !== 'contagem') linhas.push(`• Brasil: ${R.val(it, rb.v)}` + (rr ? ` · ${F.regNome}: ${R.val(it, rr.v)}` : ''));
    const c0 = compPrincipal(E, it); if (c0) linhas.push(`• ${it.nm.titulo}: ${sitResumo(R, it, c0)}`);
    F.resto.slice(0, 3).forEach(y => { const c = compPrincipal(E, y); linhas.push(`• ${y.nm.titulo}: ${R.val(y, y.v)}` + (c ? ` (${sitResumo(R, y, c)})` : '')); });
    linhas.push(R.reg(`Fonte: IBGE, PNAD Contínua, divulgada em ${dataCurta(F.div.data)}. Mais: ${linkDe(R)}`));
    let s = linhas.join('\n');
    while (s.length > LIM.whatsapp[1] && linhas.length > 3) { linhas.splice(linhas.length - 2, 1); s = linhas.join('\n'); }
    return { plano: s, titulo: tituloCurto(R, it) };
  }
  function linkedin(R) {
    const F = R.F, E = R.E, it = F.lide, o = {};
    const ps = [tituloCurto(R, it), lideFrase(R, it, o)];
    const sl = sublide(R, it, o.combinado), ref = referencia(R, it);
    if (sl || ref) ps.push([sl, ref].filter(Boolean).join(' '));
    const sig = F.resto.filter(y => itemSig(E, y)).slice(0, 3);
    if (sig.length) ps.push(sig.map(y => `${cap(y.nm.sujeito)} ${predicado(R, y, compPrincipal(E, y))}.`).join(' '));
    const est = estaveisFrase(R, F.resto.filter(y => !itemSig(E, y))); const rk = rankingFrase(R, it);
    if (est || rk) ps.push([est, rk].filter(Boolean).join(' '));
    ps.push(linhaFonte(R) + ' ' + linkDe(R) + '\n' + hashtags(R).join(' '));
    let s = ps.join('\n\n');
    while (s.length > LIM.linkedin && ps.length > 3) { ps.splice(ps.length - 2, 1); s = ps.join('\n\n'); }
    return { plano: s, titulo: ps[0] };
  }
  function boletim(R) {
    const F = R.F, E = R.E, it = F.lide, t = F.terr, tam = E.tamanho;
    const comp = compPrincipal(E, it);
    const sig = F.itens.filter(y => itemSig(E, y)), est = F.itens.filter(y => itemEstavel(E, y));
    const semInf = F.itens.filter(y => !itemSig(E, y) && !itemEstavel(E, y));
    const partesEst = [est.length ? `${lista(est.map(y => y.nm.medio))} ${est.length > 1 ? 'ficaram estáveis' : 'ficou estável'}` : null,
      semInf.length ? `sem indicação de significância publicada para ${lista(semInf.map(y => y.nm.medio))}` : null].filter(Boolean);
    const conc = sig.length
      ? `${lista(sig.map(y => `${y.nm.medio} ${sitResumo(R, y, compPrincipal(E, y))}`))} ${t.em} no ${R.perL()}` + (partesEst.length ? '; ' + partesEst.join('; ') : '') + '.'
      : `${t.em.charAt(0).toUpperCase() + t.em.slice(1)}, no ${R.perL()}: ${partesEst.join('; ')}.`;
    const base = F.itens.slice(0, tam === 'curta' ? 1 : 3).map((y, i) => `(${i + 1}) ${cap(y.nm.sujeito)}: ${R.val(y, y.v)}` + (compPrincipal(E, y) ? `, ${sitResumo(R, y, compPrincipal(E, y))}` : '') + (vazio(y.cv) ? '' : ` (CV ${R.reg(num(y.cv, 1))}%, ${precisao(y.cv).classe})`) + '.');
    const atencao = F.itens.filter(y => { const c = compPrincipal(E, y), d = c === 'ano' ? y.dirAno : y.dirAnt; return significativa(d) && y.ind.sentido * (d === 'aumentou' ? 1 : -1) < 0; }).map(y => `${y.nm.medio} ${sitResumo(R, y, compPrincipal(E, y))} (sentido desfavorável)`)
      .concat(F.itens.filter(y => !vazio(y.cv) && y.cv > CV_AVISO).map(y => `${y.nm.medio} com CV de ${R.reg(num(y.cv, 1))}% (${precisao(y.cv).classe})`));
    const nao = ['estável quer dizer que a variação não passou no teste de significância do IBGE, e não que o número ficou parado'];
    if (E.comparar.anterior && sazonal(F.per, F.fam)) nao.unshift('a comparação com o trimestre anterior inclui efeito sazonal do início do ano');
    if (t.id !== 'brasil') nao.push('as diferenças em relação ao Brasil e à região não têm teste publicado pelo IBGE');
    if (it.ranking) nao.push('a posição entre as UFs é aritmética: UFs vizinhas no ranking podem não diferir de forma significativa');
    const ls = [`# Boletim — ${t.nome}, ${R.perC()} (PNAD Contínua)`, `**CONCLUSÃO:** ${cap(conc)}`, `**Base:** ${base.join(' ')}`,
      `**Atenção:** ${atencao.length ? cap(lista(atencao)) + '.' : 'nenhuma variação significativa desfavorável nem estimativa de baixa precisão entre os indicadores escolhidos.'}`,
      `**Não concluir:** ${cap(nao.join('; '))}.`];
    if (tam !== 'curta') {
      ls.push(`**Precisão:** ${F.itens.filter(y => !vazio(y.cv)).map(y => `${y.nm.medio} CV ${R.reg(num(y.cv, 1))}% (${precisao(y.cv).classe})`).join('; ')}.`);
      const rk = rankingFrase(R, it); if (rk) ls.push(rk);
      const ref = referencia(R, it); if (ref) ls.push(ref);
    }
    if (tam === 'completo' && t.id === 'uf') ls.push(tabelaMd(R));
    if (R.pub === 'equipe') ls.push('A precisão destas estimativas depende de cada domicílio entrevistado: com menos respostas, o coeficiente de variação cresce. Este boletim não usa dados operacionais da coleta nem identifica pessoas.');
    if (E.extras.portaVoz.incluir) ls.push('> ' + citacao(E));
    ls.push(linhaFonte(R));
    return { md: ls.join('\n\n'), titulo: ls[0].replace(/^# /, '') };
  }
  /* INSTAGRAM: telas (§11.6) + legenda */
  function instagram(R) {
    const F = R.F, E = R.E, it = F.lide, t = F.terr, lugar = t.conjunto ? t.foco : t, v = t.conjunto ? it.focoUf.v : it.v;
    const comp = compPrincipal(E, it), rodape = R.reg(`Fonte: IBGE, PNAD Contínua, ${perCurto(F.per, F.fam)}`);
    const telas = [];
    telas.push({ titulo: `${it.ind.id === 'desocupacao' ? 'Desocupação' : it.nm.titulo} ${lugar.em}`, grande: R.val(it, v), texto: comp ? sitResumo(R, it, comp).replace('em um ano', 'em 1 ano') : R.perL(), rodape,
      alt: `${it.nm.titulo} ${lugar.em}: ${R.val(it, v)} no ${R.perL()}${comp ? ', ' + sitResumo(R, it, comp) : ''}. Fonte: IBGE, PNAD Contínua.` });
    const barras = [];
    if (t.conjunto) it.conjunto.forEach(u => barras.push({ rotulo: u.sigla, valor: u.v, destaque: u.foco }));
    else { barras.push({ rotulo: lugar.nome, valor: v, destaque: true }); if (it.refs.regiao) barras.push({ rotulo: 'Região ' + F.regNome, valor: it.refs.regiao.v }); if (it.refs.uf) barras.push({ rotulo: F.uf.nome, valor: it.refs.uf.v }); if (it.refs.brasil) barras.push({ rotulo: 'Brasil', valor: it.refs.brasil.v }); }
    if (barras.length > 1 && it.ind.tipo !== 'contagem') telas.push({ titulo: barras.length <= 4 ? barras.map(b => b.rotulo).join(' × ') : `${lugar.nome} e as UFs do grupo`, grafico: { tipo: 'barras', itens: barras, formato: it.ind.tipo }, texto: `${it.nm.titulo}, ${R.perC()}`, rodape,
      alt: `Gráfico de barras: ${barras.map(b => `${b.rotulo} ${R.val(it, b.valor)}`).join('; ')}. Fonte: IBGE, PNAD Contínua.` });
    if (+E.telas >= 5) {
      const y = F.resto.find(z => itemSig(E, z)) || F.resto[0];
      if (y) { const c = compPrincipal(E, y); telas.push({ titulo: `${y.nm.titulo} ${lugar.em}`, grande: R.val(y, y.v), texto: c ? sitResumo(R, y, c) : R.perL(), rodape, alt: `${y.nm.titulo} ${lugar.em}: ${R.val(y, y.v)}${c ? ', ' + sitResumo(R, y, c) : ''}. Fonte: IBGE, PNAD Contínua.` }); }
      if (ENTENDA[it.ind.id]) telas.push({ titulo: 'Entenda', texto: ENTENDA[it.ind.id], rodape, alt: 'Entenda: ' + ENTENDA[it.ind.id] });
    }
    telas.push({ titulo: 'Fonte e saiba mais', texto: R.reg(`PNAD Contínua – IBGE\nReferência: ${perLongo(F.per, F.fam)}\nDivulgação: ${dataCurta(F.div.data)}\n${linkDe(R)}`), rodape, alt: `Fonte: IBGE, PNAD Contínua, ${perLongo(F.per, F.fam)}, divulgada em ${dataCurta(F.div.data)}. ${linkDe(R)}` });
    const prim = t.conjunto ? `${it.nm.titulo} ${lugar.em}: ${R.val(it, v)} no ${R.perL()}.` : titulo(R, it).replace(/^Desemprego/, 'Desocupação') + '.';
    const legenda = [prim.length > LIM.instagramVisivel ? `${it.ind.id === 'desocupacao' ? 'Desocupação' : it.nm.titulo} ${lugar.em}: ${R.val(it, v)} (${R.perC()}).` : prim];
    const ref = referencia(R, it); if (ref) legenda.push(ref);
    const y2 = F.resto.find(z => itemSig(E, z)); if (y2) legenda.push(`${cap(y2.nm.sujeito)} ${predicado(R, y2, compPrincipal(E, y2))}.`);
    legenda.push(R.reg(`Fonte: IBGE, PNAD Contínua, divulgada em ${dataCurta(F.div.data)}. ${linkDe(R)}`));
    legenda.push(hashtags(R).join(' '));
    return { plano: legenda.join('\n'), titulo: legenda[0], telas };
  }

  /* Gera o DOCUMENTO para as escolhas. Determinístico. */
  M.redigir = function (F) {
    if (!F || !F.lide || !F.per) return { formato: 'plano', texto: '', titulo: '', bloqueios: (F && F.bloqueios) || ['Sem dados.'], avisos: (F && F.avisos) || [], nums: new Set(), metricas: {} };
    const R = Redator(F), E = F.E, md = M.midia(E.midia);
    let r;
    if (E.midia === 'site' || E.midia === 'impresso') r = releaseTexto(R);
    else if (E.midia === 'radio') r = radio(R);
    else if (E.midia === 'tv') r = tv(R);
    else if (E.midia === 'x') r = x(R);
    else if (E.midia === 'whatsapp') r = whatsapp(R);
    else if (E.midia === 'linkedin') r = linkedin(R);
    else if (E.midia === 'instagram') r = instagram(R);
    else r = boletim(R);
    const texto = md.formato === 'md' ? r.md : r.plano;
    R.reg(texto);
    [F.per, perCurto(F.per, F.fam), dataCurta(F.div.data), F.E.extras.dataPublicacao].concat(F.tabelas).forEach(s => R.reg(String(s || '')));
    const doc = { formato: md.formato, texto, titulo: r.titulo, telas: r.telas || null, falado: r.falado || null, nums: R.nums, recorde: !!F.recorde,
      bloqueios: F.bloqueios.slice(), avisos: F.avisos.slice(), link: linkDe(R) };
    doc.metricas = M.metricas(texto, E, doc);
    doc.visuais = M.visuais(F, E);
    return doc;
  };
  M.gerar = (D, E) => M.redigir(M.montarFatos(D, E));

  // ------------------------------------------------------------------ texto: md -> plano
  function planoDeMd(md) {
    return String(md).split('\n').map(l => l.replace(/^#{1,6}\s+/, '').replace(/^>\s?/, '').replace(/^- /, '• ').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\*(.+)\*$/, '$1')).join('\n');
  }
  M.planoDeMd = planoDeMd;
  M.metricas = function (texto, E, doc) {
    const md = M.midia(E.midia);
    const plano = md.formato === 'md' ? planoDeMd(texto) : String(texto);
    // locução: linha a linha (antes de juntar), sem marcas de lauda, sem GC e sem o rótulo de bloco
    // -- "PÉ" termina em letra acentuada, que não é \w: o rótulo casa pelo começo da linha
    const corpo = (E.midia === 'radio' || E.midia === 'tv') ? plano.split('\n').map(l => l.trim())
      .filter(l => l && !/^\[(TEMPO|DEIXA)/.test(l) && !/^GC\d+:/.test(l) && !/^\[[^\]]*\]$/.test(l))
      .map(l => l.replace(/^(CABEÇA|OFF|PÉ|NOTA PELADA)(\s*\([^)]*\))?\s*:/, ' ')).join(' ') : plano;
    const urls = (plano.match(/https?:\/\/\S+/g) || []);
    const carX = plano.length - urls.reduce((s, u) => s + u.length, 0) + urls.length * LIM.urlX;
    const pal = palavras(corpo), palFal = palavras(M.falarNumeros(corpo));
    const m = { caracteres: plano.length, caracteresX: carX, palavras: pal, leituraMin: Math.max(0.1, pal / 200), palavrasFaladas: palFal, locucaoSeg: Math.round(palFal * 60 / 140) };
    if (md.formato === 'md' && E.tamanho && M.TAMANHOS[E.tamanho]) m.faixa = M.TAMANHOS[E.tamanho].faixa;
    if (E.midia === 'radio' || E.midia === 'tv') m.faixaPalavras = [Math.round((+E.segundos || 30) * PALAVRAS_MIN.min / 60), Math.round((+E.segundos || 30) * PALAVRAS_MIN.max / 60)];
    return m;
  };


  // ------------------------------------------------------------------ LEGIBILIDADE (estimativa; não bloqueia)
  /* Índice de Flesch adaptado ao português (Martins et al., 1996): 248,835 - 1,015 x (palavras por frase) - 84,6 x (sílabas por palavra).
     Sílabas contadas por grupos de vogais (aproximação: hiatos contam como um só grupo). Ficam de fora a fonte, o contato, os links, as
     tabelas, os tópicos e as notas-padrão sobre a pesquisa: o que se mede é o texto que a pessoa escreve ou edita. */
  const silabasPt = w => { const g = semAcento(String(w).toLowerCase()).match(/[aeiouy]+/g); return Math.max(1, g ? g.length : 1); };
  M.legibilidade = function (texto, E) {
    const md = M.midia(E.midia);
    let plano = md.formato === 'md' ? planoDeMd(texto) : String(texto);
    for (const n of [NOTA_MINIMA, NOTA_EXTRA, NOTA_MOVEL]) plano = plano.split(n).join(' ');
    plano = plano.split('\n').filter(l => { const q = l.trim(); return q && !/^(Fontes?:|Mais informações|Contato|Sobre a pesquisa|\[)/i.test(q) && !/^[|•]/.test(q); }).join('\n').replace(/https?:\/\/\S+/g, ' ');
    const fs = [].concat(...frases(plano));
    const toks = fr => fr.match(/[0-9A-Za-zÀ-ÿ]+/g) || [];
    const alfa = [].concat(...fs.map(toks)).filter(w => !/\d/.test(w));
    const W = [].concat(...fs.map(toks)).length, S = fs.filter(fr => toks(fr).length).length;
    if (S < 1 || alfa.length < 1) return { frases: S, palavras: W, media: 0, flesch: null, nivel: '', longas: [] };
    const sil = alfa.reduce((a, w) => a + silabasPt(w), 0);
    const flesch = Math.round(248.835 - 1.015 * (W / S) - 84.6 * (sil / alfa.length));
    const nivel = flesch >= 75 ? 'muito fácil' : flesch >= 50 ? 'fácil' : flesch >= 25 ? 'difícil' : 'muito difícil';
    const longas = fs.filter(fr => toks(fr).length > 55).map(fr => fr.slice(0, 70) + '…');
    return { frases: S, palavras: W, media: Math.round(W / S * 10) / 10, flesch, nivel, longas };
  };

  // ------------------------------------------------------------------ CONFERÊNCIA (antes de exportar)
  const RE_TENDENCIA = /\b(subiu|subiram|sobe|sobem|subir|subindo|cresceu|cresceram|cresce|crescem|crescer|crescimento|aumentou|aumentaram|aumenta|aumentam|aumento|avancou|avancaram|avanca|avancam|avanco|recuou|recuaram|recua|recuam|recuo|caiu|cairam|cai|caem|queda|quedas|diminuiu|diminuiram|diminui|diminuem|diminuicao|reduziu|reduziram|reduz|reducao|alta|altas)\b/;
  const RE_ESTAVEL = /\b(estavel|estaveis|nao apresentou variacao estatisticamente significativa|nao apresentaram variacao estatisticamente significativa)\b/;
  const RE_CAUSA = /\b(gracas a|por causa d|devido a|devido ao|impulsionad\w*|reflexo d|resultado d|o que mostra que|em razao d|em funcao d|motivad\w* por|puxad\w* por)/;
  const RE_INTENSO = /\b(disparou|explodiu|saltou|despencou|desabou|derreteu|forte|fortes|expressiv\w*|preocupante\w*|otim[oa]s?|alarmante\w*|excelente\w*|pessim[oa]s?)\b/;
  const RE_ASPAS = /["“”«»]/;
  const RE_PRIMEIRA = /\b(nosso|nossa|nossos|nossas)\b/;
  const RE_EMOJI = /[\uD83C-\uDBFF][\uDC00-\uDFFF]|[☀-➿]/;
  const tiraAspas = s => String(s).replace(/["“][^"”]*["”]|«[^»]*»/g, ' ');
  function frases(texto) {
    // parágrafos; dentro deles, cada linha (tópico) e cada frase ("." "!" "?" seguidos de espaço); sem lookbehind
    // "p.p." não fecha frase: protegido antes de cortar
    return String(texto).split(/\n\s*\n/).map(p => p.replace(/p\.p\./g, 'p\u0002p\u0002').replace(/([.!?])\s+/g, '$1\u0001').replace(/\n/g, '\u0001')
      .split('\u0001').map(s => s.replace(/\u0002/g, '.').trim()).filter(Boolean));
  }
  M.conferir = function (texto, F, doc, marcados) {
    const E = F.E, mk = marcados || {}, out = [];
    const add = (id, ok, txt, bloqueia, det) => out.push({ id, ok: !!ok, texto: txt, bloqueia: !!bloqueia, detalhe: det || '' });
    const plano = M.midia(E.midia).formato === 'md' ? planoDeMd(texto) : String(texto);
    const semAsp = tiraAspas(plano), norm = semAcento(semAsp).toLowerCase();
    // 1) verbo de tendência só com significância -- DA comparação de que a frase fala
    //    ("em um ano" exige a situação anual; "frente ao trimestre anterior", a outra)
    //    e "estável" só com A (achados 2 e 9 da revisão de 26/10/2026)
    const S = {};
    for (const it of F.todos) {
      if (it.indisponivel) continue;
      // no Brasil trimestral o texto também conta as UFs ("recuou em 3 das 27, ficou estável em 24"): entram as UFs
      let us = it.conjunto || [it];
      if (F.terr.id === 'brasil' && F.fam === 'trimestral' && F.D) {
        const fs = (F.D.series[it.ind.id] || {}).trimestral || {};
        us = us.concat(Object.keys(fs).filter(k => k.indexOf('N3|') === 0).map(k => pontoEm(fs[k], F.per)).filter(Boolean).map(q => ({ dirAno: direcao(q.sa, q.va), dirAnt: direcao(q.sc, q.vc) })));
      }
      S[it.ind.id] = { sig: { ano: us.some(u => significativa(u.dirAno)), ant: us.some(u => significativa(u.dirAnt)) },
        est: { ano: us.some(u => u.dirAno === 'estavel'), ant: us.some(u => u.dirAnt === 'estavel') } };
    }
    const habil = [].concat(E.comparar.ano ? ['ano'] : []).concat(E.comparar.anterior ? ['ant'] : []);
    const refAnoN = semAcento(perRefAno(F.per, F.fam)).toLowerCase(), refAntN = semAcento(perRefAnt(F.per, F.fam)).toLowerCase();
    const anoAnt = String(pAno(F.per) - 1);
    const compsDe = n => {
      const c = [];
      if (/\b(em um ano|em 1 ano|ano anterior|ano passado|mesmo trimestre)\b/.test(n) || n.indexOf(refAnoN) >= 0 || n.indexOf('em relacao a ' + anoAnt) >= 0) c.push('ano');
      if (/\b(trimestre anterior|tres meses antes|periodo anterior)\b/.test(n) || n.indexOf(refAntN) >= 0) c.push('ant');
      return c.length ? c : habil;
    };
    const viol = [], violEst = [];
    for (const par of frases(semAsp)) {
      let ultimo = null;
      for (const fr of par) {
        const n = semAcento(fr).toLowerCase();
        const mencionados = Object.keys(NOMES).filter(id => S[id] && NOMES[id].chave.test(n));
        const alvo = mencionados.length ? mencionados : (ultimo ? [ultimo] : []);
        if (mencionados.length) ultimo = mencionados[mencionados.length - 1];
        if (!alvo.length) continue;
        const cs = compsDe(n);
        if (RE_TENDENCIA.test(n) && alvo.every(id => !cs.some(c => S[id].sig[c]))) viol.push(fr);
        if (RE_ESTAVEL.test(n) && alvo.every(id => !cs.some(c => S[id].est[c]))) violEst.push(fr);
      }
    }
    add('tendencia', !viol.length, 'Todo verbo de tendência tem significância publicada pelo IBGE, na comparação de que a frase fala', true, viol.length ? 'Sem significância: ' + viol.slice(0, 2).join(' | ') : '');
    add('estavel', !violEst.length, '"Estável" só onde o IBGE publicou a variação como não significativa (A)', true, violEst.length ? 'Sem a situação A: ' + violEst.slice(0, 2).join(' | ') : '');
    // 2) p.p. em taxa
    const ppMal = [];
    for (const par of frases(semAsp)) for (const fr of par) {
      const n = semAcento(fr).toLowerCase();
      const taxa = /\b(taxa|nivel da ocupacao|informalidade|subutiliza|desalent|participacao|desocupa|desemprego)/.test(n) && !/\b(rendimento|populacao ocupada|pessoas ocupadas)\b/.test(n);
      if (taxa && /\b(subiu|cresceu|aumentou|avancou|recuou|caiu|diminuiu|reduziu|alta|queda|recuo|aumento)( de| em)? \d+(,\d+)?\s?%/.test(n)) ppMal.push(fr);
    }
    add('pp', !ppMal.length, 'Variação de taxa em pontos percentuais (p.p.), não em %', true, ppMal.length ? ppMal[0] : '');
    // 3) causa
    const causa = RE_CAUSA.exec(norm);
    add('causa', !causa, 'Sem conectivo de causa fora de citação atribuída', true, causa ? `"${causa[0]}"`.replace(/"/g, '') : '');
    // 4) aspas e citação
    const reservado = /\[CITA[ÇC][ÃA]O/i.test(plano);
    add('citacao', !reservado, 'Espaço reservado da citação preenchido com declaração real ou removido', true, reservado ? 'O texto ainda tem [CITAÇÃO — ...].' : '');
    const temAspas = RE_ASPAS.test(plano);
    add('aspas', !temAspas || mk.aspasReais, temAspas ? 'Toda declaração entre aspas é real, dita ou aprovada pela pessoa (marque abaixo)' : 'Sem aspas no texto (o gerador nunca cria aspas)', true);
    // 5) estilo: intensificador, exclamação, emoji, primeira pessoa
    // a classe de precisão do IBGE ("precisão ótima", "CV 1,4%, ótima") é termo técnico, não adjetivo
    const intenso = RE_INTENSO.exec(norm.replace(/\b(precisao|cv|classifica)\b[^.]{0,60}?\b(otima|otimo)\b/g, ' ')), recorde = /\brecorde\w*/.test(norm) && !doc.recorde;
    add('estilo', !intenso && !recorde && semAsp.indexOf('!') < 0 && !RE_EMOJI.test(plano) && !RE_PRIMEIRA.test(norm), 'Sem adjetivo valorativo, "recorde" sem série, exclamação, emoji ou primeira pessoa', true,
      intenso ? intenso[0] : recorde ? 'recorde' : semAsp.indexOf('!') >= 0 ? 'exclamação' : RE_EMOJI.test(plano) ? 'emoji' : RE_PRIMEIRA.test(norm) ? 'primeira pessoa' : '');
    // 5b) leitura: aviso (não bloqueia) quando o texto fica pesado para o público ou tem frase muito longa
    const lg = M.legibilidade(texto, E);
    if (lg.flesch !== null && lg.frases >= 3 && ['x', 'whatsapp'].indexOf(E.midia) < 0) {
      const minimo = E.publico === 'geral' ? 35 : E.publico === 'imprensa' ? 25 : 10;
      add('leitura', lg.flesch >= minimo && !lg.longas.length, `Leitura ${lg.nivel} (índice de Flesch para o português: ${lg.flesch}; ${String(lg.media).replace('.', ',')} palavras por frase)`, false,
        lg.longas.length ? 'Frase com mais de 55 palavras: ' + lg.longas.slice(0, 2).join(' | ') : lg.flesch < minimo ? 'Texto pesado para este público: frases mais curtas ajudam (a precisão do texto continua a mesma).' : '');
    }
    // 6) trimestre móvel / "trimestre encerrado" fora do Brasil
    const movelUf = F.terr.id !== 'brasil' && (E.familia === 'movel' || /trimestre encerrado/.test(norm));
    add('movel', !movelUf, 'Trimestre móvel e "trimestre encerrado em" só para o Brasil', true);
    // 7) datas, fonte, link
    // o período de referência por inteiro ("2º trimestre" sozinho também casaria com o do ano anterior)
    const perOk = norm.indexOf(semAcento(perLongo(F.per, F.fam)).toLowerCase()) >= 0 || norm.indexOf(semAcento(perCurto(F.per, F.fam)).toLowerCase()) >= 0
      || norm.indexOf(semAcento(perFalado(F.per, F.fam, +String(E.extras.dataPublicacao || F.per).slice(0, 4))).toLowerCase()) >= 0;
    const divIso = F.div.data ? String(F.div.data).slice(0, 10) : '';
    const divOk = !!divIso && (plano.indexOf(dataCurta(divIso)) >= 0 || norm.indexOf(semAcento(dataLonga(divIso)).toLowerCase()) >= 0 || /divulg(ad[ao]s?|ou) (hoje|nest[ae]|no dia|no ultimo|neste)/.test(norm));
    const exigeDatas = E.midia !== 'x';
    add('datas', perOk && (divOk || !exigeDatas), exigeDatas ? 'Duas datas: referência e divulgação oficial' : 'Período de referência (no X a data de divulgação é opcional pelo limite de caracteres)', exigeDatas || !perOk,
      !perOk ? 'Falta o período de referência.' : !divOk && exigeDatas ? 'Falta a data de divulgação.' : '');
    const fonteOk = /\bibge\b/.test(norm) && (/pnad continua|pesquisa do ibge/.test(norm));
    const tabelaOk = /sidra/.test(norm) && F.tabelas.some(t => plano.indexOf(t) >= 0);
    const exigeTabela = ['site', 'impresso', 'boletim', 'linkedin'].indexOf(E.midia) >= 0;
    add('fonte', fonteOk && (tabelaOk || !exigeTabela), exigeTabela ? 'Fonte (IBGE, PNAD Contínua) e tabela do SIDRA' : 'Fonte (IBGE, PNAD Contínua)', true);
    const exigeLink = ['site', 'x', 'whatsapp', 'linkedin', 'instagram'].indexOf(E.midia) >= 0;
    if (exigeLink) add('link', /https?:\/\//.test(plano), 'Link para conferir os números', false);
    // 8) embargo e precisão do lide
    add('divulgacao', !F.bloqueios.some(b => /divulga|publica/i.test(b)), 'Publicação na data da divulgação oficial ou depois (sem embargo na PNADC)', true, F.bloqueios.filter(b => /divulga|publica/i.test(b)).join(' '));
    add('precisaoLide', !vazio(F.lide.cv) ? F.lide.cv <= CV_LIDE_MAX : true, `Manchete e lide com precisão suficiente (CV até ${CV_LIDE_MAX}%)`, true);
    // 9) limites da mídia
    const m = M.metricas(texto, E, doc);
    if (E.midia === 'x') add('limite', m.caracteresX <= LIM.x, `Até ${LIM.x} caracteres no X (link conta ${LIM.urlX}): ${m.caracteresX}`, true);
    if (E.midia === 'linkedin') add('limite', m.caracteres <= LIM.linkedin, `Até ${LIM.linkedin} caracteres no LinkedIn: ${m.caracteres}`, true);
    if (E.midia === 'instagram') add('limite', m.caracteres <= LIM.instagram, `Legenda até ${LIM.instagram} caracteres: ${m.caracteres}`, true);
    if (E.midia === 'whatsapp') add('limite', m.caracteres <= LIM.whatsapp[1], `Cabe numa tela de celular (até ${LIM.whatsapp[1]} caracteres): ${m.caracteres}`, false);
    if (E.midia === 'radio' || E.midia === 'tv') add('limite', m.palavrasFaladas <= m.faixaPalavras[1], `Tempo de locução até ${E.segundos} s (até ${m.faixaPalavras[1]} palavras faladas): ${m.palavrasFaladas} palavras, ~${m.locucaoSeg} s`, true);
    if (m.faixa) add('tamanho', m.caracteres <= m.faixa[1] * 1.1, `Tamanho ${M.TAMANHOS[E.tamanho].rot.toLowerCase()} (${m.faixa[0]} a ${m.faixa[1]} caracteres): ${m.caracteres}`, false);
    // 10) números sem origem
    const soltos = [];
    const semUrl = plano.replace(/https?:\/\/\S+/g, ' ').replace(/\S+@\S+/g, ' ').replace(String(E.extras.contato.telefone || '#'), ' ');
    for (const n of (semUrl.match(/\d[\d.]*(,\d+)?/g) || [])) { const k = n.replace(/\.$/, ''); if (!doc.nums.has(k) && !doc.nums.has(n) && soltos.indexOf(k) < 0) soltos.push(k); }
    // número sem origem registrada BLOQUEIA (§12.8): telefone e e-mail do contato e links ficam fora da conta
    add('origem', !soltos.length, 'Todo número do texto saiu do cache publicado', true, soltos.length ? 'Sem origem registrada: ' + soltos.slice(0, 8).join(', ') + ' — confira com a fonte ou retire.' : '');
    if (['site', 'impresso'].indexOf(E.midia) >= 0) add('contato', !!linhaContato(E), 'Contato de imprensa preenchido (passo 9)', false);
    // marcações manuais (§10, conferência final)
    add('manualNumeros', mk.numeros, 'Conferi os números com a fonte (SIDRA, Comentário ou Quadro Sintético)', true);
    add('manualRevisao', mk.revisao, 'Revisão humana feita: quem publica confirmou que tem a atribuição para divulgar', true);
    if (doc.visuais && doc.visuais.length) add('manualAlt', mk.alt, 'Revisei o texto alternativo das imagens', true);
    return out;
  };
  M.podeExportar = lista2 => lista2.every(c => c.ok || !c.bloqueia);

  // ------------------------------------------------------------------ VISUAIS (especificação; quem desenha é releases.js)
  M.sugerirVisuais = function (E) {
    if (E.midia === 'radio' || E.midia === 'x' || E.midia === 'whatsapp') return { linha: false, barras: false, halteres: false, tabela: false, grade: false };
    if (E.midia === 'tv') return { linha: false, barras: false, halteres: false, tabela: false, grade: false };
    if (E.territorio === 'brasil' && E.familia === 'movel') return { linha: true, barras: false, halteres: false, tabela: true, grade: false };
    if (E.territorio === 'brasil' || E.territorio === 'ufs') return { linha: false, barras: true, halteres: false, tabela: false, grade: true };
    if (E.serie !== 'nao') return { linha: true, barras: false, halteres: false, tabela: true, grade: false };
    if (E.territorio === 'uf') return { linha: false, barras: true, halteres: false, tabela: true, grade: false };
    return { linha: false, barras: false, halteres: true, tabela: true, grade: false };
  };
  const fmtVis = (ind, v) => (vazio(v) ? '–' : ind.tipo === 'rendimento' ? 'R$ ' + inteiro(v) : ind.tipo === 'contagem' ? inteiro(v) + ' mil' : num(v, ind.casas === undefined ? 1 : ind.casas) + '%');
  M.fmtVis = fmtVis;
  M.visuais = function (F, E) {
    const out = [], V = E.visuais || M.sugerirVisuais(E), it = F.lide, t = F.terr, D = F.D;
    if (!it || !D) return out;
    const fonte = `Fonte: IBGE, PNAD Contínua ${F.fam === 'trimestral' ? 'trimestral' : 'mensal'} (SIDRA tab. ${it.tab}). Divulgação: ${dataCurta(F.div.data)}.`;
    const sit = (cod, d) => direcao(cod, d);
    if (V.linha && it.s && !t.conjunto) {
      let ini = 0; if (E.serie === 'n5') ini = Math.max(0, it.i - (F.fam === 'trimestral' ? 19 : 59)); if (E.serie === 'n2') ini = Math.max(0, it.i - (F.fam === 'trimestral' ? 7 : 23));
      const pers = it.s.per.slice(ini, it.i + 1);
      const al = s => pers.map(p => { const j = s ? s.per.indexOf(p) : -1; return j < 0 ? null : s.v[j]; });
      const series = [{ rotulo: t.nome, dados: al(it.s), destaque: true }];
      if (t.id === 'uf') { const sr = serieD(D, it.ind.id, F.fam, 'N2', String(D.regiao.codigo)); if (sr) series.push({ rotulo: 'Região ' + F.regNome, dados: al(sr) }); }
      if (t.id === 'capital') { const su = serieD(D, it.ind.id, F.fam, 'N3', String(D.uf.codigo)); if (su) series.push({ rotulo: F.uf.nome, dados: al(su) }); }
      if (t.id !== 'brasil') { const sb = serieD(D, it.ind.id, F.fam, 'N1', '1'); if (sb) series.push({ rotulo: 'Brasil', dados: al(sb), tracejado: true }); }
      const br = series.find(s => s.rotulo === 'Brasil');
      let conclusao = `${it.nm.titulo}: ${series.map(s => s.rotulo).join(', ')}`;
      if (br) {
        const a = series[0].dados, b = br.dados, pares = a.map((v, k) => [v, b[k]]).filter(q => !vazio(q[0]) && !vazio(q[1]));
        // fato aritmético sobre TODOS os pontos publicados, não teste: só com todos do mesmo lado
        if (pares.length && pares.every(q => q[0] < q[1])) conclusao = `${it.nm.titulo} ${t.em} fica abaixo da média nacional em todo o período`;
        else if (pares.length && pares.every(q => q[0] > q[1])) conclusao = `${it.nm.titulo} ${t.em} fica acima da média nacional em todo o período`;
      }
      const ult = series[0].dados[series[0].dados.length - 1];
      const ressalva = /média nacional/.test(conclusao) ? ' · comparação dos valores publicados: o IBGE não testa a diferença entre áreas' : '';
      out.push({ id: 'linha', tipo: 'linha', titulo: conclusao, subtitulo: `${it.ind.rotulo}, ${perCurto(pers[0], F.fam)} a ${perCurto(pers[pers.length - 1], F.fam)}${ressalva}`, fonte,
        labels: pers.map(p => perCurto(p, F.fam)), series, ind: it.ind,
        alt: `Gráfico de linhas ${it.nm.titulo.toLowerCase() === 'desocupação' ? 'da taxa de desocupação' : 'de ' + it.ind.rotulo.toLowerCase()} de ${perCurto(pers[0], F.fam)} a ${perCurto(pers[pers.length - 1], F.fam)}, com ${series.map(s => s.rotulo).join(', ')}. ${conclusao}. No ${perLongo(F.per, F.fam)}, ${t.nome} ${fmtVis(it.ind, ult)}` + (br ? ` contra ${fmtVis(it.ind, br.dados[br.dados.length - 1])} no Brasil.` : '.') });
    }
    const ufsDe = ind => { const fs = (D.series[ind.id] || {})[F.fam] || {}; return Object.keys(fs).filter(k => k.indexOf('N3|') === 0).map(k => { const loc = k.split('|')[1], p = pontoEm(fs[k], F.per); return p && !vazio(p.v) ? { loc, sigla: UF_SIGLA[loc] || loc, nome: D.locais[k] || loc, v: p.v, va: p.va, sa: p.sa, vc: p.vc, sc: p.sc } : null; }).filter(Boolean); };
    const compVis = E.comparar.ano ? 'ano' : 'ant';
    if ((V.barras || V.grade) && F.fam === 'trimestral' && it.ind.tipo !== 'contagem') {
      const ufs = ufsDe(it.ind).sort((a, b) => b.v - a.v);
      const foco = t.id === 'uf' ? t.loc : t.conjunto ? t.foco.loc : t.id === 'capital' ? String(D.uf.codigo) : null;
      const pb = pontoEm(serieD(D, it.ind.id, F.fam, 'N1', '1'), F.per);
      if (V.barras && ufs.length >= 5) {
        const pos = ufs.findIndex(u => u.loc === foco);
        const fUf = pos >= 0 ? ufs[pos] : null;
        const tit = fUf && ufs.length - pos <= 5 && it.nm.plural ? `${fUf.nome} está entre ${it.nm.gp === 'f' ? 'as' : 'os'} cinco menores ${it.nm.plural} do país` : fUf && pos < 5 && it.nm.plural ? `${fUf.nome} está entre ${it.nm.gp === 'f' ? 'as' : 'os'} cinco maiores ${it.nm.plural} do país` : `${it.ind.rotulo} por unidade da federação`;
        out.push({ id: 'barras', tipo: 'barras', titulo: tit, subtitulo: `${it.ind.rotulo}, ${perCurto(F.per, F.fam)}${fUf ? ' · ' + fUf.nome + ' em destaque' : ''}${pb ? ' · linha tracejada: Brasil' : ''}`, fonte, ind: it.ind,
          itens: ufs.map(u => ({ rotulo: u.sigla, nome: u.nome, valor: u.v, destaque: u.loc === foco, estado: sit(compVis === 'ano' ? u.sa : u.sc, compVis === 'ano' ? u.va : u.vc) })), referencia: pb ? { rotulo: 'Brasil', valor: pb.v } : null,
          alt: `Gráfico de barras horizontais ${it.ind.rotulo.toLowerCase().indexOf('taxa') === 0 ? 'da ' : 'de '}${it.ind.rotulo.toLowerCase()} nas ${ufs.length} unidades da federação no ${perLongo(F.per, F.fam)}, da maior para a menor. Maior: ${ufs[0].nome}, ${fmtVis(it.ind, ufs[0].v)}; menor: ${ufs[ufs.length - 1].nome}, ${fmtVis(it.ind, ufs[ufs.length - 1].v)}.` + (fUf ? ` ${fUf.nome}: ${fmtVis(it.ind, fUf.v)}, ${pos + 1}ª posição.` : '') + (pb ? ` Brasil: ${fmtVis(it.ind, pb.v)}.` : '') });
      }
      if (V.grade && ufs.length >= 20) {
        const casas = M.gradeCasas().map(c => { const u = ufs.find(z => z.sigla === c.sigla); return Object.assign({}, c, u ? { valor: u.v, estado: sit(compVis === 'ano' ? u.sa : u.sc, compVis === 'ano' ? u.va : u.vc), destaque: u.loc === foco } : { valor: null, estado: 'sem' }); });
        const k = contarDirecoes(ufs.map(u => sit(compVis === 'ano' ? u.sa : u.sc, compVis === 'ano' ? u.va : u.vc)));
        const tGrade = k.diminuiu || k.aumentou ? `${k.diminuiu ? `recua em ${k.diminuiu}` : ''}${k.diminuiu && k.aumentou ? ' e ' : ''}${k.aumentou ? `sobe em ${k.aumentou}` : ''} das ${ufs.length} UFs`
          : k.estavel === k.n ? `estável em todas as ${ufs.length} UFs` : k.estavel ? `estável em ${k.estavel} das ${ufs.length} UFs` : `sem indicação de sentido da variação nas ${ufs.length} UFs`;
        out.push({ id: 'grade', tipo: 'grade', titulo: `${it.nm.titulo}: ${tGrade}`,
          subtitulo: `${it.ind.rotulo}, ${perCurto(F.per, F.fam)} · situação da variação ${compVis === 'ano' ? 'em um ano' : 'frente ao trimestre anterior'}, publicada pelo IBGE`, fonte, ind: it.ind, casas, sentido: it.ind.sentido,
          alt: `Mapa do Brasil com os limites das 27 unidades da federação, cada uma com a sigla e ${it.ind.rotulo.toLowerCase()} no ${perLongo(F.per, F.fam)}. Situação da variação ${compVis === 'ano' ? 'em um ano' : 'frente ao trimestre anterior'}: ${k.aumentou} UF(s) com aumento significativo, ${k.diminuiu} com redução significativa, as demais estáveis ou sem comparação.` + (foco ? ` ${F.uf.nome} em destaque: ${fmtVis(it.ind, (casas.find(c => c.destaque) || {}).valor)}.` : '') });
      }
    }
    if (V.halteres && !t.conjunto) {
      const taxas = F.itens.filter(y => y.ind.tipo === 'taxa' && !vazio(y.v0Ano) && E.comparar.ano);
      if (taxas.length) out.push({ id: 'halteres', tipo: 'halteres', titulo: `${t.nome}: ${perCurto(perAnoAnt(F.per), F.fam)} × ${perCurto(F.per, F.fam)}`, subtitulo: 'Taxas, em %; ponto cheio = período atual; mesma cor e "estável" quando a variação não é significativa', fonte,
        linhas: taxas.map(y => ({ rotulo: y.ind.rotulo, de: y.v0Ano, para: y.v, estado: y.dirAno, sentido: y.ind.sentido })), perDe: perCurto(perAnoAnt(F.per), F.fam), perPara: perCurto(F.per, F.fam),
        alt: `Gráfico de halteres ${t.de} comparando ${perCurto(perAnoAnt(F.per), F.fam)} e ${perCurto(F.per, F.fam)}: ` + taxas.map(y => `${y.ind.rotulo} de ${fmtVis(y.ind, y.v0Ano)} para ${fmtVis(y.ind, y.v)} (${({ aumentou: 'aumentou', diminuiu: 'diminuiu', estavel: 'estável' })[y.dirAno] || 'sem indicação de significância'})`).join('; ') + '.' });
    }
    if (V.tabela && !t.conjunto) {
      const cols = [t.nome, 'CV', `× ${perCurto(perAnoAnt(F.per), F.fam)}`, 'Situação'].concat(t.id === 'uf' ? ['Região ' + F.regNome] : []).concat(t.id !== 'brasil' ? ['Brasil'] : []);
      const ls = F.itens.map(y => [y.ind.rotulo, fmtVis(y.ind, y.v), vazio(y.cv) ? '–' : num(y.cv, 1) + '%', vazio(y.va) ? '–' : num(y.va, 1).replace('-', '−') + (y.ind.tipo === 'taxa' ? ' p.p.' : '%'),
        ({ aumentou: 'aumentou', diminuiu: 'diminuiu', estavel: 'estável', sem: 'sem indicação', sig0: 'significativa', desconhecida: '?' })[y.dirAno]]
        .concat(t.id === 'uf' ? [y.refs.regiao ? fmtVis(y.ind, y.refs.regiao.v) : '–'] : []).concat(t.id !== 'brasil' ? [y.refs.brasil ? fmtVis(y.ind, y.refs.brasil.v) : '–'] : []));
      out.push({ id: 'tabela', tipo: 'tabela', titulo: `Indicadores ${t.de}, ${perCurto(F.per, F.fam)}`, subtitulo: 'Situação da variação em um ano, como publicada pelo IBGE', fonte: `Fonte: IBGE, PNAD Contínua (SIDRA, tabelas ${F.tabelas.join(', ')}). Divulgação: ${dataCurta(F.div.data)}.`,
        colunas: ['Indicador'].concat(cols), linhas: ls, destaque: 0,
        alt: `Tabela dos indicadores ${t.de} no ${perLongo(F.per, F.fam)}: ` + F.itens.map(y => `${y.ind.rotulo} ${fmtVis(y.ind, y.v)}`).join('; ') + '.' });
    }
    return out;
  };

  // ------------------------------------------------------------------ ALERTAS de publicação nova (puro)
  /* Resumo do cache no MESMO formato de /api/publicacoes/novidades. */
  M.resumoDeD = function (D) {
    const out = { uf: D.uf, regiao: D.regiao, indicadores: [] };
    for (const ind of D.indicadores || []) {
      const o = { id: ind.id, rotulo: ind.rotulo, curto: ind.curto, tipo: ind.tipo, unidade_var: ind.unidade_var, sentido: ind.sentido, casas: ind.casas };
      for (const fam of ['movel', 'trimestral']) {
        const tab = ind[fam] && ind[fam].tabela; if (!tab) continue;
        const sb = serieD(D, ind.id, fam, 'N1', '1'); if (!sb) continue;
        let i = sb.per.length - 1; while (i >= 0 && vazio(sb.v[i])) i--; if (i < 0) continue;
        const per = sb.per[i], c = (D.consultas || {})[tab] || {};
        const f = { tabela: tab, periodo: per, modificacao: c.modificacao || null, divulgacao: M.divulgacao(D, [tab], per).data, brasil: ponto(sb, i) };
        if (fam === 'trimestral') { f.regiao = pontoEm(serieD(D, ind.id, fam, 'N2', String(D.regiao.codigo)), per); f.uf = pontoEm(serieD(D, ind.id, fam, 'N3', String(D.uf.codigo)), per); }
        o[fam] = f;
      }
      out.indicadores.push(o);
    }
    return out;
  };
  M.assinaturaDe = function (res) {
    const t = {};
    for (const ind of (res && res.indicadores) || []) for (const fam of ['movel', 'trimestral']) { const f = ind[fam]; if (f) t[f.tabela] = { per: f.periodo, mod: f.modificacao || null }; }
    return t;
  };
  /* O que é NOVO para quem viu `visto` ({tabelas}). Período mais recente =
     publicação nova; mesmo período com modificação mais recente = revisão. */
  M.diffPublicacao = function (res, visto) {
    if (!res || !res.indicadores) return null;
    /* Sem nada visto (primeira vez) ou tabela que o visto não tem (entrou no
       catálogo depois), não há com o que comparar: vira LINHA DE BASE em
       `semBase` -- quem chama grava em silêncio --, nunca "publicação nova". */
    const vt = (visto && visto.tabelas) || null, novos = {}, revisoes = [], semBase = [];
    for (const ind of res.indicadores) for (const fam of ['movel', 'trimestral']) {
      const f = ind[fam]; if (!f) continue;
      const v = vt ? vt[f.tabela] : null;
      if (!v) { semBase.push(f.tabela); continue; }
      const novo = String(f.periodo) > String(v.per);
      const rev = v && String(f.periodo) === String(v.per) && f.modificacao && v.mod && f.modificacao > v.mod;
      if (novo) {
        const k = fam + '|' + f.periodo;
        if (!novos[k]) novos[k] = { fam, periodo: f.periodo, rotulo: fam === 'trimestral' ? perLongo(f.periodo, fam) : perLongo(f.periodo, fam), curto: perCurto(f.periodo, fam), divulgacao: null, destaques: [], tabelas: [] };
        const g = novos[k];
        g.tabelas.push(f.tabela);
        if (f.divulgacao && (!g.divulgacao || f.divulgacao > g.divulgacao)) g.divulgacao = f.divulgacao;
        const p = fam === 'trimestral' ? f.uf : f.brasil;
        // o que mudou: significativa em um ano; sem isso, significativa frente ao período anterior
        const comp = p && p.sa === 'Z' && !vazio(p.va) && p.va !== 0 ? 'ano' : p && p.sc === 'Z' && !vazio(p.vc) && p.vc !== 0 ? 'ant' : null;
        if (comp) g.destaques.push({ id: ind.id, rotulo: ind.rotulo, curto: ind.curto, tipo: ind.tipo, sentido: ind.sentido, casas: ind.casas, unidade_var: ind.unidade_var, v: p.v, va: comp === 'ano' ? p.va : p.vc, comp, local: fam === 'trimestral' ? 'uf' : 'brasil' });
      } else if (rev) revisoes.push({ fam, periodo: f.periodo, tabela: f.tabela, indicador: ind.rotulo, modificacao: f.modificacao });
    }
    const lista2 = Object.keys(novos).map(k => novos[k]).sort((a, b) => (a.fam === b.fam ? 0 : a.fam === 'trimestral' ? -1 : 1));
    return { novos: lista2, revisoes, semBase, primeiraVez: !vt, algo: lista2.length > 0 || revisoes.length > 0 };
  };
  /* Leitura gerencial: fatos novos e prioridades diferentes desde a última vista */
  M.diffLeitura = function (atual, visto) {
    if (!atual) return null;
    if (!visto) return { primeiraVez: true, novos: atual.fatos.length, prioridadesMudaram: false, total: atual.fatos.length };
    const antes = new Set(visto.fatos || []);
    const novos = atual.fatos.filter(f => !antes.has(f)).length;
    const pm = (atual.prioridades || []).join('|') !== (visto.prioridades || []).join('|');
    return { primeiraVez: false, novos, prioridadesMudaram: pm, total: atual.fatos.length, desde: visto.em };
  };

  return M;
})();
