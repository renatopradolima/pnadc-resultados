/* PNADC Resultados -- montar() e novidades(): funções sobre o cache (armazem.js).
   Porte de SuperC/scripts/lib_sidra.py (montar, novidades, _ponto, _divulgacoes). Dono: PNADC_Resultados.

   `montar` devolve tudo o que a página usa, em séries colunares por (indicador, família, 'nível|localidade'):
   per (períodos), v (valor), cv, vc/sc (variação e situação contra o período anterior), va/sa (contra o mesmo
   período do ano anterior) e esp (símbolos especiais, com o motivo). As UFs que não são a escolhida levam só
   os últimos PERIODOS_OUTRAS_UFS períodos (ranking e comparação anual). O JSON é o mesmo de /api/publicacoes.
   `novidades` é o resumo pequeno do AVISO de publicação nova. As duas só LEEM o cache: nunca falam com o IBGE.
   Não portado: `versao` (chave de cache da montagem no servidor) -- aqui não há servidor.
   Sem `??` nem `?.`. */
'use strict';

const MONTAR = (() => {
  const PERIODOS_OUTRAS_UFS = 9;
  const CURTO = { valor: 'v', cv: 'cv', var_curta: 'vc', sit_curta: 'sc', var_ano: 'va', sit_ano: 'sa' };
  const CAMPOS_INFO = ['id', 'rotulo', 'curto', 'unidade', 'unidade_var', 'tipo', 'sentido', 'casas'];

  function pick(o, ks) {
    const r = {};
    ks.forEach(k => { r[k] = o[k]; });
    return r;
  }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function ehSituacao(c) { return SIDRA.CAMPOS_SITUACAO.indexOf(c) >= 0; }
  function precisaoLista() { return INDICADORES_CATALOGO.PRECISAO_CV.map(x => ({ ate: x[0], classe: x[1] })); }
  function simbolos() {
    const r = {};
    Object.keys(SIDRA.SIMBOLOS).forEach(k => { r[k] = SIDRA.SIMBOLOS[k][1]; });
    return r;
  }
  function lerSerieOuVazia(A, tab) {
    return A.lerSerie(tab).then(x => (x && x.linhas ? x.linhas : []));
  }

  /* opc: { agora: () => Date, indicadores: [...] (padrão: o catálogo) } */
  function montar(A, ufCodigo, ufSigla, ufNome, opc) {
    opc = opc || {};
    const agora = opc.agora || function () { return new Date(); };
    const indicadores = opc.indicadores || INDICADORES_CATALOGO.INDICADORES;
    ufCodigo = String(ufCodigo);
    const reg = ufCodigo.slice(0, 1);
    return Promise.all([A.lerLocais(), A.estado(), A.lerPeriodos()]).then(base => {
      const locais = base[0], est = base[1], divulgacao = base[2];
      const tarefas = [];
      indicadores.forEach(ind => INDICADORES_CATALOGO.FAMILIAS.forEach(fam => {
        tarefas.push(lerSerieOuVazia(A, ind[fam].tabela));
      }));
      return Promise.all(tarefas).then(todas => {
        const series = {}, lista = [];
        let k = 0;
        indicadores.forEach(ind => {
          const di = pick(ind, CAMPOS_INFO);
          di.definicao = ind.definicao;
          series[ind.id] = {};
          INDICADORES_CATALOGO.FAMILIAS.forEach(fam => {
            const esp = ind[fam];
            di[fam] = { tabela: esp.tabela, niveis: esp.niveis.slice(), variaveis: pick(esp, SIDRA.CAMPOS) };
            const campoDe = {};
            SIDRA.CAMPOS.forEach(c => { campoDe[esp[c]] = c; });
            const porLoc = {};
            todas[k++].forEach(l => {
              const c = campoDe[l[0]];
              if (!c) return;
              const chave = l[1] + '|' + l[2];
              if (!porLoc[chave]) porLoc[chave] = {};
              if (!porLoc[chave][l[3]]) porLoc[chave][l[3]] = {};
              porLoc[chave][l[3]][c] = l[4];       // a última linha repetida vale (INSERT OR REPLACE)
            });
            const famOut = {};
            Object.keys(porLoc).sort((a, b) => {
              const x = a.split('|'), y = b.split('|');
              return cmp(x[0], y[0]) || cmp(x[1], y[1]);
            }).forEach(chave => {
              const i0 = chave.indexOf('|'), nivel = chave.slice(0, i0), loc = chave.slice(i0 + 1);
              const pers = porLoc[chave];
              let ps = Object.keys(pers).sort();
              if (nivel === 'N3' && loc !== ufCodigo) ps = ps.slice(-PERIODOS_OUTRAS_UFS);
              const s = { per: [], v: [], cv: [], vc: [], sc: [], va: [], sa: [], esp: [] };
              ps.forEach((p, i) => {
                s.per.push(p);
                SIDRA.CAMPOS.forEach(c => {
                  const bruto = pers[p][c] === undefined ? null : pers[p][c];
                  const r = SIDRA.normalizar(bruto, ehSituacao(c), c === 'valor');
                  s[CURTO[c]].push(r[0]);
                  /* '...' é o caso comum (o começo de toda série de variação) e a legenda geral já o explica */
                  if (r[1] && bruto !== null && bruto !== '...') s.esp.push([CURTO[c], i, String(bruto), r[1]]);
                });
              });
              famOut[chave] = s;
            });
            series[ind.id][fam] = famOut;
          });
          lista.push(di);
        });
        return {
          ok: true,
          uf: { codigo: ufCodigo, sigla: ufSigla || '', nome: ufNome || '' },
          regiao: { codigo: reg, nome: locais['N2|' + reg] || '' },
          situacao: SIDRA.SITUACAO,
          simbolos: simbolos(),
          fonte_legenda: INDICADORES_CATALOGO.FONTE_LEGENDA,
          precisao_cv: precisaoLista(),
          confianca: 95,
          limites: { intervalo_h: SIDRA.INTERVALO_H, espera_erro_min: SIDRA.ESPERA_ERRO_MIN,
                     intervalo_forcado_min: SIDRA.INTERVALO_FORCADO_MIN },
          consultas: est,
          rede_pausada_ate: SIDRA.pausaRede(est, agora()),
          indicadores: lista,
          series,
          locais,
          divulgacao,
          api: SIDRA.BASE_URL
        };
      });
    });
  }

  /* o ponto (valor, cv, variações e situações) de uma localidade num período, ou null */
  function ponto(linhas, espec, nivel, loc, periodo) {
    const vals = {};
    linhas.forEach(l => { if (l[1] === nivel && l[2] === loc && l[3] === periodo) vals[l[0]] = l[4]; });
    if (!Object.prototype.hasOwnProperty.call(vals, espec.valor)) return null;
    const out = {};
    SIDRA.CAMPOS.forEach(c => {
      out[CURTO[c]] = SIDRA.normalizar(vals[espec[c]] === undefined ? null : vals[espec[c]], ehSituacao(c), c === 'valor')[0];
    });
    return out.v === null ? null : out;
  }

  function novidades(A, ufCodigo, ufSigla, ufNome, opc) {
    opc = opc || {};
    const indicadores = opc.indicadores || INDICADORES_CATALOGO.INDICADORES;
    ufCodigo = String(ufCodigo);
    const reg = ufCodigo.slice(0, 1);
    return Promise.all([A.estado(), A.lerPeriodos(), A.lerLocais()]).then(base => {
      const est = base[0], div = base[1], locais = base[2];
      const tarefas = [];
      indicadores.forEach(ind => INDICADORES_CATALOGO.FAMILIAS.forEach(fam => tarefas.push(lerSerieOuVazia(A, ind[fam].tabela))));
      return Promise.all(tarefas).then(todas => {
        let k = 0;
        const inds = indicadores.map(ind => {
          const di = pick(ind, CAMPOS_INFO);
          INDICADORES_CATALOGO.FAMILIAS.forEach(fam => {
            const esp = ind[fam], tab = esp.tabela, linhas = todas[k++];
            let per = null;
            linhas.forEach(l => {
              if (l[0] === esp.valor && l[1] === 'N1' && l[4] !== null && ['...', '..', 'X'].indexOf(l[4]) < 0 &&
                  (per === null || l[3] > per)) per = l[3];
            });
            if (!per) return;
            const c = est[tab] || {};
            const dData = (div[tab] || {})[per];
            const divul = dData ? dData : (c.ultimo_periodo === per && c.modificacao !== undefined ? c.modificacao : null);
            const f = { tabela: tab, periodo: per, modificacao: c.modificacao === undefined ? null : c.modificacao,
                        divulgacao: divul, brasil: ponto(linhas, esp, 'N1', '1', per) };
            if (fam === 'trimestral') {
              f.regiao = ponto(linhas, esp, 'N2', reg, per);
              f.uf = ponto(linhas, esp, 'N3', ufCodigo, per);
            }
            di[fam] = f;
          });
          return di;
        });
        return {
          ok: true,
          uf: { codigo: ufCodigo, sigla: ufSigla || '', nome: locais['N3|' + ufCodigo] || ufNome || '' },
          regiao: { codigo: reg, nome: locais['N2|' + reg] || '' },
          indicadores: inds,
          precisao_cv: precisaoLista()
        };
      });
    });
  }

  return { PERIODOS_OUTRAS_UFS, montar, novidades };
})();
