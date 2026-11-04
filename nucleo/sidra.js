/* PNADC Resultados -- SIDRA: normalização, períodos, pedidos à API de agregados do IBGE.
   Porte de SuperC/scripts/lib_sidra.py (PLANO.md, fase 1). Dono deste arquivo: PNADC_Resultados.

   Aqui estão: símbolos do SIDRA, rótulos de período, divisão da série em blocos de pedido, o download de
   uma tabela, os limites de consulta (12 h, pausa de 15 min, botão a cada 30 min, 3 erros 5xx seguidos),
   a conferência do download e a passada `atualizar`. A rede é INJETADA (`io.buscar`) e o cache também
   (armazem.js), por isso os testes usam as respostas gravadas em testes/gravados/ e nunca falam com o IBGE.

   Regras que vêm do Python e não mudam:
   - '-' num VALOR é zero absoluto; numa variação ou CV é "não calculado" (null);
   - '..', '...' e 'X' viram null com o motivo; letra de situação desconhecida NÃO é traduzida;
   - falha de rede (sem resposta, transferência interrompida, bloqueio do Cloudflare) é ErroRede e
     pausa tudo; o resto (HTTP de erro, JSON ruim, resposta vazia) é ErroTabela e fica na tabela;
   - N6/N7 só da UF escolhida.
   Diferença conhecida: a ordem dos períodos de uma série segue a do objeto JSON do JavaScript
   (chaves numéricas em ordem crescente); a API já as entrega crescentes.
   Sem `??` nem `?.`: a conferência de sintaxe do projeto não os lê. */
'use strict';

const SIDRA = (() => {
  const BASE_URL = 'https://servicodados.ibge.gov.br/api/v3/agregados';
  const INTERVALO_H = 12;
  const ESPERA_ERRO_MIN = 15;
  const INTERVALO_FORCADO_MIN = 30;
  const TEMPO_LIMITE_S = 120;
  const MAX_VALORES_POR_PEDIDO = 40000;
  const MAX_5XX_SEGUIDOS = 3;

  const SITUACAO = {
    A: { rotulo: 'estável', significativa: false, texto: 'variação não estatisticamente significativa (estável)' },
    Z: { rotulo: 'significativa', significativa: true,
         texto: 'variação estatisticamente significativa (o sentido é o sinal da variação)' }
  };
  /* [valor, motivo]: valor 'zero' vira 0, null fica null */
  const SIMBOLOS = {
    '-': ['zero', 'zero absoluto, não resultante de cálculo ou arredondamento'],
    '..': [null, 'valor não se aplica'],
    '...': [null, 'valor não disponível'],
    X: [null, 'valor inibido para não identificar o informante']
  };
  const CAMPOS = ['valor', 'cv', 'var_curta', 'sit_curta', 'var_ano', 'sit_ano'];
  const CAMPOS_SITUACAO = ['sit_curta', 'sit_ano'];

  class ErroRede extends Error {}
  class ErroTabela extends Error {
    constructor(msg, doServidor) {
      super(msg);
      this.doServidor = !!doServidor;
    }
  }

  /* ---------------------------------------------------------------- texto */
  /* equivalente do %r do Python para os textos que aparecem aqui */
  function repr(s) {
    s = String(s);
    const aspa = s.indexOf("'") >= 0 && s.indexOf('"') < 0 ? '"' : "'";
    let o = s.replace(/\\/g, '\\\\');
    if (aspa === "'") o = o.replace(/'/g, "\\'");
    return aspa + o + aspa;
  }
  const RE_NUMERO = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

  /* ---------------------------------------------------------------- períodos */
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  /* AAAAQQ (trimestral) -> '2º tri 2026'; AAAAMM (móvel, trimestre que TERMINA no mês) -> 'jun-jul-ago 2026' */
  function rotuloPeriodo(p, familia) {
    p = String(p);
    if (!/^\d{6}$/.test(p)) return p;
    const ano = parseInt(p.slice(0, 4), 10), n = parseInt(p.slice(4), 10);
    if (familia === 'trimestral') return n + 'º tri ' + ano;
    if (n < 1 || n > 12) return p;
    const ms = [];
    for (let i = 0; i < 3; i++) ms.push(MESES[(((n - 3 + i) % 12) + 12) % 12]);
    return ms.join('-') + ' ' + ano;
  }

  function periodoAnoAnterior(p) {
    p = String(p);
    if (!/^\d{6}$/.test(p)) return null;
    const a = String(parseInt(p.slice(0, 4), 10) - 1);
    return '0000'.slice(a.length) + a + p.slice(4);
  }

  /* '14/08/2026' -> '2026-08-14' (comparável como texto) */
  function dataModificacao(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s === null || s === undefined ? '' : s).trim());
    return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
  }

  /* ---------------------------------------------------------------- valores */
  /* Valor cru do SIDRA -> [valor, motivo]. Situação devolve a LETRA.
     zeroAbsoluto=false para variação e CV: o '-' ali é "não calculado" (null). */
  function normalizar(bruto, situacao, zeroAbsoluto) {
    if (zeroAbsoluto === undefined) zeroAbsoluto = true;
    if (bruto === null || bruto === undefined) return [null, 'sem valor no banco'];
    const s = String(bruto).trim();
    if (situacao) {
      if (Object.prototype.hasOwnProperty.call(SITUACAO, s)) return [s, null];
      if (s === '-') return [null, 'sem comparação'];
      if (Object.prototype.hasOwnProperty.call(SIMBOLOS, s)) return [null, SIMBOLOS[s][1]];
      return [s, 'situação não reconhecida (código ' + repr(s) + ')'];
    }
    if (Object.prototype.hasOwnProperty.call(SIMBOLOS, s)) {
      const tipo = SIMBOLOS[s][0], motivo = SIMBOLOS[s][1];
      if (tipo === 'zero' && !zeroAbsoluto) return [null, motivo + ' -- numa variação ou CV, lido como "não calculado"'];
      return [tipo === 'zero' ? 0 : null, motivo];
    }
    const t = s.replace(',', '.');
    if (RE_NUMERO.test(t)) return [parseFloat(t), null];
    if (/^[A-Z]$/.test(s)) return [null, 'faixa de valores (' + s + '), não um número'];
    return [null, 'valor não numérico (' + repr(s.slice(0, 20)) + ')'];
  }

  /* ---------------------------------------------------------------- rede */
  function url(caminho) {
    /* mesma forma codificada do Python (a API aceita; conferido em 26/10/2026) */
    return BASE_URL + caminho.replace(/\[/g, '%5B').replace(/\]/g, '%5D').replace(/\|/g, '%7C');
  }

  /* io.buscar(url) -> Promise<{ status, corpo (texto), interrompida, erro }>; rejeitar = sem resposta */
  function ioNavegador() {
    return {
      buscar(u) {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), TEMPO_LIMITE_S * 1000);
        return fetch(u, { headers: { Accept: 'application/json' }, signal: ctl.signal, cache: 'no-store' })
          .then(r => r.text().then(corpo => ({ status: r.status, corpo, interrompida: false, erro: '' })))
          .then(x => { clearTimeout(t); return x; }, e => { clearTimeout(t); throw e; });
      }
    };
  }

  function pedirJson(u, io) {
    return Promise.resolve().then(() => io.buscar(u)).then(r => r, e => {
      throw new ErroRede((e && e.message) || 'sem resposta do IBGE');
    }).then(r => {
      if (!r.status || r.interrompida) throw new ErroRede(r.erro || 'sem resposta do IBGE');
      const corpo = r.corpo || '';
      if (r.status === 403) {
        const t = corpo.slice(0, 4000).toLowerCase();
        if (['cloudflare', 'browser_signature', 'cf-ray', 'attention required', 'just a moment'].some(m => t.indexOf(m) >= 0))
          throw new ErroRede('bloqueio transitório do Cloudflare (HTTP 403)');
      }
      if (r.status < 200 || r.status >= 300)
        throw new ErroTabela('o IBGE respondeu HTTP ' + r.status + ': ' + corpo.slice(0, 160).trim(), r.status >= 500);
      try {
        return JSON.parse(corpo);
      } catch (ex) {
        throw new ErroTabela('resposta do IBGE não é JSON: ' + ex.message);
      }
    });
  }

  /* [[periodo, modificacao ISO], ...] em ordem */
  function consultarPeriodos(tabela, io) {
    return pedirJson(url('/' + tabela + '/periodos'), io).then(d => {
      if (!Array.isArray(d) || !d.length) throw new ErroTabela('lista de períodos vazia');
      const out = [];
      d.forEach(p => {
        const pid = String(p.id === undefined || p.id === null ? '' : p.id);
        if (/^\d{6}$/.test(pid)) out.push([pid, dataModificacao(p.modificacao)]);
      });
      if (!out.length) throw new ErroTabela('nenhum período reconhecível');
      out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
      return out;
    });
  }

  function localidades(niveis) {
    return niveis.map(n => n + '[all]').join('|');
  }

  const LOCS_POR_NIVEL = { N1: 1, N2: 5, N3: 27, N6: 27, N7: 20 };
  /* parte os períodos em blocos que cabem no teto de valores por pedido */
  function blocos(periodos, nVars, niveis) {
    let locs = 0;
    niveis.forEach(n => { locs += Object.prototype.hasOwnProperty.call(LOCS_POR_NIVEL, n) ? LOCS_POR_NIVEL[n] : 30; });
    const por = Math.max(1, Math.floor(MAX_VALORES_POR_PEDIDO / Math.max(1, nVars * locs)));
    const out = [];
    for (let i = 0; i < periodos.length; i += por) out.push(periodos.slice(i, i + por));
    return out;
  }

  function ehTotal(r) {
    const cls = r.classificacoes || [];
    return cls.every(c => {
      const cat = c.categoria || {};
      return Object.keys(cat).some(k => String(cat[k]).trim().toLowerCase() === 'total');
    });
  }

  function textoDe(x, padrao) {
    return x === undefined || x === null ? padrao : String(x);
  }

  /* Baixa a série inteira. Promise<{ linhas: [[variavel, nivel, localidade, periodo, valor], ...],
     locais: [[nivel, id, nome], ...] }>. Os pedidos saem em sequência (um de cada vez). */
  function baixarSerie(tabela, espec, periodos, ufCodigo, io) {
    const vars = CAMPOS.map(c => espec[c]);
    const linhas = [], locais = [], visto = {};
    const grupos = blocos(periodos, vars.length, espec.niveis);
    let cadeia = Promise.resolve();
    grupos.forEach(bloco => {
      cadeia = cadeia.then(() => {
        const faixa = bloco.length === 1 ? bloco[0] : bloco[0] + '-' + bloco[bloco.length - 1];
        return pedirJson(url('/' + tabela + '/periodos/' + faixa + '/variaveis/' + vars.join('|') +
          '?localidades=' + localidades(espec.niveis)), io);
      }).then(d => {
        if (!Array.isArray(d)) throw new ErroTabela('resposta de dados fora do formato');
        d.forEach(v => {
          const vid = textoDe(v.id, '');
          if (vars.indexOf(vid) < 0) return;
          const res = v.resultados || [];
          let escolhido = null;
          for (let i = 0; i < res.length; i++) if (ehTotal(res[i])) { escolhido = res[i]; break; }
          if (escolhido === null && res.length) escolhido = res[0];
          ((escolhido && escolhido.series) || []).forEach(s => {
            const loc = s.localidade || {};
            const niv = textoDe((loc.nivel || {}).id, '');
            const lid = textoDe(loc.id, '');
            if (espec.niveis.indexOf(niv) < 0 || !lid) return;
            if ((niv === 'N6' || niv === 'N7') && lid.indexOf(String(ufCodigo)) !== 0) return;
            const chave = niv + '|' + lid;
            const nome = textoDe(loc.nome, lid);
            if (Object.prototype.hasOwnProperty.call(visto, chave)) locais[visto[chave]][2] = nome;
            else { visto[chave] = locais.length; locais.push([niv, lid, nome]); }
            const serie = s.serie || {};
            Object.keys(serie).forEach(per => {
              const val = serie[per];
              linhas.push([vid, niv, lid, String(per), val === null || val === undefined ? null : String(val)]);
            });
          });
        });
      });
    });
    return cadeia.then(() => {
      if (!linhas.length) throw new ErroTabela('o IBGE não devolveu nenhum valor');
      return { linhas, locais };
    });
  }

  /* ---------------------------------------------------------------- tempo */
  const MIN = 60 * 1000;
  function dois(n) { return (n < 10 ? '0' : '') + n; }
  /* 'AAAA-MM-DD HH:MM:SS' no horário local, como o Python */
  function iso(d) {
    return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()) + ' ' +
      dois(d.getHours()) + ':' + dois(d.getMinutes()) + ':' + dois(d.getSeconds());
  }
  function deIso(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(s === null || s === undefined ? '' : s));
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
  }

  /* ---------------------------------------------------------------- estado das consultas */
  /* ISO até quando a rede está em pausa depois de uma falha, ou null (linha '*' do estado) */
  function pausaRede(est, agora) {
    const g = est['*'];
    if (!g || g.ok) return null;
    const t = deIso(g.quando);
    if (t && agora.getTime() - t.getTime() < ESPERA_ERRO_MIN * MIN) return iso(new Date(t.getTime() + ESPERA_ERRO_MIN * MIN));
    return null;
  }

  /* Date a partir do qual a tabela pode ser consultada, ou null (nunca consultada) */
  function proximaConsulta(c, forcar) {
    if (!c) return null;
    const t = deIso(c.quando);
    if (!t) return null;
    if (!c.ok) return new Date(t.getTime() + ESPERA_ERRO_MIN * MIN);
    return new Date(t.getTime() + (forcar ? INTERVALO_FORCADO_MIN * MIN : INTERVALO_H * 60 * MIN));
  }

  /* tabelas que podem ser consultadas agora (respeitando os limites); `lista` = [{tabela, familia, espec}] */
  function vencidas(est, lista, forcar, agora) {
    if (pausaRede(est, agora)) return [];
    const out = [];
    lista.forEach(t => {
      const prox = proximaConsulta(est[t.tabela], forcar);
      if (prox === null || agora.getTime() >= prox.getTime()) out.push(t.tabela);
    });
    return out;
  }

  /* Estado novo de uma tabela depois de uma consulta (equivale a `_registrar`): devolve o objeto a gravar. */
  function registrar(est, tabela, ok, erro, campos, agora) {
    const ant = est[tabela] || {};
    const novo = {
      ultimo_ok: ok ? iso(agora) : (ant.ultimo_ok === undefined ? null : ant.ultimo_ok),
      ultimo_periodo: ant.ultimo_periodo === undefined ? null : ant.ultimo_periodo,
      modificacao: ant.modificacao === undefined ? null : ant.modificacao,
      baixado_em: ant.baixado_em === undefined ? null : ant.baixado_em,
      n_valores: ant.n_valores === undefined ? null : ant.n_valores
    };
    Object.keys(campos || {}).forEach(k => { if (Object.prototype.hasOwnProperty.call(novo, k)) novo[k] = campos[k]; });
    return {
      quando: iso(agora), ok: !!ok, erro: erro ? String(erro).slice(0, 400) : null, ultimo_ok: novo.ultimo_ok,
      ultimo_periodo: novo.ultimo_periodo, modificacao: novo.modificacao, baixado_em: novo.baixado_em,
      n_valores: novo.n_valores
    };
  }

  /* Download que encolhe o cache é recusado: devolve null se pode substituir, ou o MOTIVO da recusa.
     `serieAntiga` = o que `lerSerie` devolveu (ou null); `antes` = n_valores da gravação anterior. */
  const FRACAO_MINIMA_VALORES = 0.9;
  function conferirDownload(serieAntiga, antes, espec, periodos, linhas) {
    const vv = espec.valor;
    const vieram = {}, novos = {};
    linhas.forEach(l => {
      if (l[0] !== vv) return;
      vieram[l[3]] = true;
      if (!novos[l[1]]) novos[l[1]] = {};
      novos[l[1]][l[2]] = true;
    });
    const faltam = periodos.filter(p => !vieram[p]);
    if (faltam.length)
      return 'download incompleto: ' + faltam.length + ' período(s) da lista não vieram na série (' + faltam.slice(-3).join(', ') + ')';
    const antigos = {};
    ((serieAntiga && serieAntiga.linhas) || []).forEach(l => {
      if (l[0] !== vv) return;
      if (!antigos[l[1]]) antigos[l[1]] = {};
      antigos[l[1]][l[2]] = true;
    });
    const niveis = Object.keys(antigos).sort();
    for (let i = 0; i < niveis.length; i++) {
      const n = niveis[i];
      const perdidas = Object.keys(antigos[n]).filter(l => !(novos[n] && novos[n][l])).sort();
      if (perdidas.length)
        return 'download incompleto: o nível ' + n + ' perdeu ' + perdidas.length + ' localidade(s) (' + perdidas.slice(0, 3).join(', ') + ')';
    }
    if (antes && linhas.length < FRACAO_MINIMA_VALORES * antes)
      return 'download incompleto: ' + linhas.length + ' valores contra ' + antes + ' da gravação anterior';
    return null;
  }

  /* ---------------------------------------------------------------- a passada */
  let emCursoFlag = false;
  function emCurso() { return emCursoFlag; }

  /* Uma passada pelas tabelas vencidas. `A` = armazém (armazem.js). Opções: io, forcar, log, devePararFn,
     agora (função que devolve Date; os testes trocam o relógio), tabelas (padrão: o catálogo).
     Promise<resumo>; a rede corre fora do armazém, que só é tocado para ler o estado e gravar. */
  function atualizar(A, ufCodigo, opc) {
    opc = opc || {};
    const io = opc.io || ioNavegador();
    const forcar = !!opc.forcar;
    const log = opc.log || function () {};
    const devePararFn = opc.devePararFn || function () { return false; };
    const agora = opc.agora || function () { return new Date(); };
    const lista = opc.tabelas || INDICADORES_CATALOGO.tabelas();
    if (emCursoFlag) return Promise.resolve({ ok: false, erro: 'já há uma atualização em curso' });
    emCursoFlag = true;
    const resumo = { ok: true, consultadas: [], novas: [], sem_novidade: [], erros: {}, rede: null };
    const porTabela = {};
    lista.forEach(t => { porTabela[t.tabela] = t; });
    let estado = {};
    let seguidos5xx = 0;

    /* grava o estado de uma tabela (lê o estado ATUAL: os registros se acumulam durante a passada) */
    function regista(tab, ok, erro, campos) {
      return A.estado().then(est => A.gravarConsulta(tab, registrar(est, tab, ok, erro, campos, agora())));
    }

    function passo(tab) {
      const t = porTabela[tab], espec = t.espec, fam = t.familia;
      resumo.consultadas.push(tab);
      return consultarPeriodos(tab, io).then(pers => {
        const ultimo = pers[pers.length - 1][0];
        let modif = '';
        pers.forEach(p => { if (p[1] > modif) modif = p[1]; });
        const ant = estado[tab] || {};
        return A.temValores(tab).then(tem => {
          if (tem && ant.ultimo_periodo === ultimo && (ant.modificacao || '') === modif) {
            return regista(tab, true, null, { ultimo_periodo: ultimo, modificacao: modif })
              .then(() => A.gravarPeriodos(tab, pers)).then(() => {
                resumo.sem_novidade.push(tab);
                seguidos5xx = 0;
                return true;
              });
          }
          const listaPers = pers.map(p => p[0]);
          return baixarSerie(tab, espec, listaPers, ufCodigo, io).then(r => {
            seguidos5xx = 0;
            return A.lerSerie(tab).then(antiga => {
              return A.estado().then(est => {
                const motivo = conferirDownload(antiga, (est[tab] || {}).n_valores, espec, listaPers, r.linhas);
                /* resposta incompleta: o cache fica como estava; a tabela registra o erro (volta em 15 min) */
                if (motivo) throw new ErroTabela(motivo);
                const quando = iso(agora());
                return A.gravarSerie(tab, r.linhas, r.locais, quando).then(() => A.gravarPeriodos(tab, pers))
                  .then(() => regista(tab, true, null, { ultimo_periodo: ultimo, modificacao: modif, baixado_em: quando, n_valores: r.linhas.length }))
                  .then(() => {
                    resumo.novas.push(tab);
                    log('[publicações] tabela ' + tab + ' (' + fam + '): ' + r.linhas.length + ' valores até ' + rotuloPeriodo(ultimo, fam));
                    return true;
                  });
              });
            });
          });
        });
      }).catch(ex => {
        if (ex instanceof ErroRede) {
          resumo.rede = ex.message;
          resumo.erros[tab] = ex.message;
          return regista(tab, false, 'rede: ' + ex.message, {}).then(() => regista('*', false, 'rede: ' + ex.message, {})).then(() => {
            log('[publicações] sem rede com o IBGE (' + ex.message + '): passada interrompida; nova tentativa em ' + ESPERA_ERRO_MIN + ' min');
            return false;
          });
        }
        if (ex instanceof ErroTabela) {
          resumo.erros[tab] = ex.message;
          return regista(tab, false, ex.message, {}).then(() => {
            log('[publicações] tabela ' + tab + ': ' + ex.message);
            seguidos5xx = ex.doServidor ? seguidos5xx + 1 : 0;
            if (seguidos5xx >= MAX_5XX_SEGUIDOS) {
              resumo.rede = 'o serviço do IBGE respondeu erro ' + seguidos5xx + ' vezes seguidas';
              return regista('*', false, resumo.rede, {}).then(() => {
                log('[publicações] ' + resumo.rede + ': passada interrompida; nova tentativa em ' + ESPERA_ERRO_MIN + ' min');
                return false;
              });
            }
            return true;
          });
        }
        throw ex;
      });
    }

    function seguir(fila) {
      if (!fila.length || devePararFn()) return Promise.resolve();
      return passo(fila[0]).then(continua => (continua ? seguir(fila.slice(1)) : undefined));
    }

    return A.estado().then(est => {
      estado = est;
      return seguir(vencidas(est, lista, forcar, agora()));
    }).then(() => {
      if (resumo.consultadas.length && resumo.rede === null) return regista('*', true, null, {});
      return undefined;
    }).then(() => { emCursoFlag = false; return resumo; }, e => { emCursoFlag = false; throw e; });
  }

  return {
    iso, deIso, pausaRede, proximaConsulta, vencidas, registrar, conferirDownload, FRACAO_MINIMA_VALORES, atualizar, emCurso,
    BASE_URL, INTERVALO_H, ESPERA_ERRO_MIN, INTERVALO_FORCADO_MIN, TEMPO_LIMITE_S, MAX_VALORES_POR_PEDIDO,
    MAX_5XX_SEGUIDOS, SITUACAO, SIMBOLOS, CAMPOS, CAMPOS_SITUACAO, ErroRede, ErroTabela,
    rotuloPeriodo, periodoAnoAnterior, dataModificacao, normalizar, url, ioNavegador, pedirJson,
    consultarPeriodos, blocos, baixarSerie
  };
})();
