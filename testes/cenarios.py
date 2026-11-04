# -*- coding: utf-8 -*-
u"""Cenários do núcleo (a passada, os limites de rede, o armazém) e paridade do catálogo.

Espelham SuperC/scripts/teste_sidra.py::teste_unidade, com os resultados esperados escritos à mão
(a paridade sozinha não prova que o Python está certo). Chamado por testes/rodar.py; `ctx` traz os
auxiliares dele (bancada, confere, gravado, canon, diferenca, SUPERC_SCRIPTS).
"""
import sys

JS_CENARIOS = r"""
const S = SIDRA, F = FIX, R = [];
const T = (c, m) => R.push((c ? 'OK ' : 'FALHOU ') + m);
let AGORA = new Date(2026, 9, 26, 9, 0, 0);
const avancar = ms => { AGORA = new Date(AGORA.getTime() + ms); };
const MIN = 60000, H = 3600000;
const REDE = { modo: 'ok', chamadas: [], per_extra: {}, modif: {}, falha: {}, tira_local: null, tira_per: null, tira_var: null };
const clone = x => JSON.parse(JSON.stringify(x));
function io() {
  return { buscar(u) {
    REDE.chamadas.push(u);
    if (REDE.modo === 'sem_rede') return Promise.reject(new Error('curl: (7) Failed to connect'));
    if (REDE.modo === 'interrompida') return Promise.resolve({ status: 200, corpo: '[{"id":', interrompida: true, erro: 'curl: (18) transfer closed' });
    const tab = u.slice(S.BASE_URL.length).split('/')[1];
    if (REDE.falha[tab]) return Promise.resolve({ status: 500, corpo: '{"statusCode":500}', interrompida: false, erro: '' });
    const base6381 = tab === '6381';
    if (/\/periodos$/.test(u)) {
      const per = clone(base6381 ? F.per6381 : F.per6468).concat(clone(REDE.per_extra[tab] || []));
      per.forEach(p => { const k = tab + '|' + p.id; if (REDE.modif[k]) p.modificacao = REDE.modif[k]; });
      return Promise.resolve({ status: 200, corpo: JSON.stringify(per), interrompida: false, erro: '' });
    }
    let dados = clone(base6381 ? F.dados6381 : F.dados6468);
    (REDE.per_extra[tab] || []).forEach(extra => dados.forEach(v => v.resultados[0].series.forEach(s => {
      const ks = Object.keys(s.serie).sort(); s.serie[extra.id] = s.serie[ks[ks.length - 1]];
    })));
    if (REDE.tira_var) dados = dados.filter(v => v.id !== REDE.tira_var);
    dados.forEach(v => {
      const res = v.resultados[0];
      if (REDE.tira_local) res.series = res.series.filter(s => s.localidade.id !== REDE.tira_local);
      if (REDE.tira_per) res.series.forEach(s => { delete s.serie[REDE.tira_per]; });
    });
    return Promise.resolve({ status: 200, corpo: JSON.stringify(dados), interrompida: false, erro: '' });
  } };
}
const A = ARMAZEM.memoria();
const so2 = INDICADORES_CATALOGO.tabelas().filter(t => t.tabela === '6381' || t.tabela === '6468');
function passada(forcar, tabelas) {
  REDE.chamadas = [];
  return S.atualizar(A, '11', { io: io(), forcar, agora: () => AGORA, tabelas: tabelas || so2 });
}
const venc = forcar => A.estado().then(est => S.vencidas(est, so2, !!forcar, AGORA).sort());
const nLinhas = tab => A.lerSerie(tab).then(x => (x ? x.linhas.length : 0));
const ambas = ['6381', '6468'];
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let cadeia = Promise.resolve();
let nPasso = 0;
const passo = fn => { cadeia = cadeia.then(fn).then(() => { document.title = 'passo ' + (++nPasso) + ' de ' + (R.length) + ' resultados'; }); };

/* ---- períodos e valores especiais */
passo(() => {
  T(S.rotuloPeriodo('202608', 'movel') === 'jun-jul-ago 2026', 'móvel AAAAMM = trimestre que TERMINA no mês');
  T(S.rotuloPeriodo('202601', 'movel') === 'nov-dez-jan 2026', 'móvel que atravessa o ano');
  T(S.rotuloPeriodo('202602', 'trimestral') === '2º tri 2026', 'trimestral AAAAQQ');
  T(S.periodoAnoAnterior('202602') === '202502', 'mesmo período do ano anterior');
  T(igual(S.normalizar('5.3'), [5.3, null]), 'número com ponto');
  T(S.normalizar('-')[0] === 0, "'-' = zero absoluto: num VALOR vale 0");
  T(S.normalizar('-', false, false)[0] === null, "'-' numa variação/CV vira null (não calculado)");
  ['..', '...', 'X'].forEach(x => { const r = S.normalizar(x); T(r[0] === null && !!r[1], x + ' vira null com o motivo'); });
  T(igual(S.normalizar('A', true), ['A', null]), "situação 'A' fica como letra");
  const sc = S.normalizar('-', true);
  T(sc[0] === null && sc[1] === 'sem comparação', "situação '-' = sem comparação");
  const q = S.normalizar('Q', true);
  T(q[0] === 'Q' && /não reconhecida/.test(q[1]), 'situação desconhecida NÃO é traduzida: vai crua, com o aviso');
  T(S.normalizar('B')[0] === null, 'letra num campo de valor não vira número');
  T(S.dataModificacao('14/08/2026') === '2026-08-14', 'data de modificação comparável como texto');
  const C = INDICADORES_CATALOGO;
  T(C.classePrecisao(5) === 'ótima' && C.classePrecisao(5.1) === 'boa' && C.classePrecisao(50.1) === 'imprecisa' &&
    C.classePrecisao(null) === null, 'classes de precisão pelo CV');
});
/* ---- primeira passada */
passo(() => venc().then(v => {
  T(igual(v, ambas), 'banco vazio: as duas tabelas estão vencidas');
  return passada(false);
}).then(r => {
  T(igual(r.novas.slice().sort(), ambas) && !Object.keys(r.erros).length, 'primeira passada baixa as duas tabelas');
  return A.estado();
}).then(est => {
  T(est['6381'].ultimo_periodo === '202608' && est['6468'].ultimo_periodo === '202602', 'o último período sai da API, não do código');
  T(est['6468'].modificacao === '2026-08-14', 'a modificação mais recente é guardada');
  T(est['*'].ok === true, 'passada sem falha marca a rede como ok');
  return Promise.all([nLinhas('6381'), nLinhas('6468'), A.lerSerie('6468'), A.lerLocais()]);
}).then(x => {
  T(x[0] > 0 && x[1] > 0, 'valores gravados');
  const l = x[2].linhas;
  T(l.some(r => r[1] === 'N6'), 'capital (N6) da UF da instalação entra');
  T(l.some(r => igual(r, ['4099', 'N3', '11', '202602', '2.6'])), 'RO 2º tri 2026 = 2,6');
  T(l.some(r => igual(r, ['9130', 'N3', '11', '202602', 'Z'])), 'situação publicada Z guardada crua');
  T(/^Porto Velho/.test(x[3]['N6|1100205'] || ''), 'nome da capital vem da API');
}));
/* ---- limite de 12 h */
passo(() => { avancar(10 * MIN); });
passo(() => venc().then(v => { T(v.length === 0, 'logo depois do sucesso nada está vencido'); return passada(false); })
  .then(r => { T(r.consultadas.length === 0 && REDE.chamadas.length === 0, 'sem tabela vencida, NENHUMA chamada à rede'); avancar(11 * H + 40 * MIN); return venc(); })
  .then(v => { T(v.length === 0, 'com 11 h 50 min ainda não vence'); avancar(15 * MIN); return venc(); })
  .then(v => { T(igual(v, ambas), 'depois de 12 h vence'); }));
/* ---- sem novidade: só a lista de períodos */
let antes = 0;
passo(() => Promise.all([nLinhas('6381'), nLinhas('6468')]).then(n => { antes = n[0] + n[1]; return passada(false); }).then(r => {
  T(igual(r.sem_novidade.slice().sort(), ambas), 'sem período novo: sem novidade');
  T(REDE.chamadas.length === 2 && REDE.chamadas.every(u => /\/periodos$/.test(u)), 'sem novidade custa só a lista de períodos (2 chamadas, nenhuma série)');
  return Promise.all([nLinhas('6381'), nLinhas('6468')]);
}).then(n => T(n[0] + n[1] === antes, 'e o cache fica como estava')));
/* ---- botão (forçar) */
passo(() => { avancar(20 * MIN); });
passo(() => venc(true).then(v => { T(v.length === 0, 'forçar com 20 min: ainda não consulta de novo'); avancar(11 * MIN); return venc(true); })
  .then(v => { T(igual(v, ambas), 'forçar depois de 30 min: consulta'); return venc(false); })
  .then(v => T(v.length === 0, 'sem forçar, as 12 h continuam valendo')));
/* ---- período novo publicado entra sozinho */
passo(() => {
  REDE.per_extra['6381'] = [{ id: '202609', literals: ['jul-ago-set 2026'], modificacao: '30/10/2026' }];
  return passada(true).then(r => {
    T(r.novas.indexOf('6381') >= 0 && r.sem_novidade.indexOf('6468') >= 0, 'período novo publicado: a série é baixada de novo');
    return Promise.all([A.estado(), A.lerSerie('6381')]);
  }).then(x => {
    T(x[0]['6381'].ultimo_periodo === '202609', 'e o último período passa a ser o novo');
    T(x[1].linhas.some(l => l[3] === '202609'), 'a série guardada recebe o período novo sem mudar código');
  });
});
/* ---- revisão (modificação mais recente mudou) */
passo(() => {
  avancar(13 * H);
  REDE.modif['6468|202504'] = '20/10/2026';
  return passada(false).then(r => { T(r.novas.indexOf('6468') >= 0, 'revisão publicada (data de modificação nova): série baixada de novo'); return A.lerPeriodos(); })
    .then(p => T((p['6468'] || {})['202602'] === '2026-08-14', 'a data de modificação de CADA período fica guardada (divulgação do 2º tri 2026)'));
});
passo(() => { avancar(13 * H); return passada(false).then(r => T(igual(r.sem_novidade.slice().sort(), ambas), 'passada sem novidade não baixa nada')); });
/* ---- download INCOMPLETO não encolhe o cache */
let antes6468 = 0;
const erro6468 = r => r.erros['6468'] || '';
passo(() => { avancar(13 * H); return nLinhas('6468').then(n => { antes6468 = n; REDE.modif['6468|202504'] = '21/10/2026'; REDE.tira_local = '12'; return passada(false); })
  .then(r => { T(/localidade/.test(erro6468(r)), 'download sem uma UF é recusado'); return nLinhas('6468'); })
  .then(n => { T(n === antes6468, 'e o cache da tabela fica como estava'); return A.estado(); })
  .then(est => T(est['6468'].ok === false, 'a recusa fica registrada como erro da tabela')); });
passo(() => { REDE.tira_local = null; avancar(16 * MIN); REDE.tira_per = '202601'; return passada(false)
  .then(r => { T(/período/.test(erro6468(r)), 'download sem um período da lista é recusado'); return nLinhas('6468'); })
  .then(n => T(n === antes6468, 'e o cache fica como estava')); });
passo(() => { REDE.tira_per = null; avancar(16 * MIN); REDE.tira_var = '4103'; return passada(false)
  .then(r => { T(/valores/.test(erro6468(r)), 'download com muito menos valores que a gravação anterior é recusado'); return nLinhas('6468'); })
  .then(n => T(n === antes6468, 'e o cache fica como estava')); });
passo(() => { REDE.tira_var = null; avancar(16 * MIN); return passada(false)
  .then(r => { T(r.novas.indexOf('6468') >= 0, 'resposta completa volta a ser gravada'); return nLinhas('6468'); })
  .then(n => T(n === antes6468, 'e o número de valores volta ao de antes')); });
/* ---- erro de rede: pausa tudo e NÃO apaga */
passo(() => { avancar(13 * H); return Promise.all([nLinhas('6381'), nLinhas('6468')]).then(n => { antes = n[0] + n[1]; REDE.modo = 'sem_rede'; return passada(false); })
  .then(r => { T(!!r.rede && REDE.chamadas.length === 1, 'sem rede: a passada para na PRIMEIRA falha (1 chamada, não 16)'); return Promise.all([nLinhas('6381'), nLinhas('6468'), A.estado()]); })
  .then(x => {
    T(x[0] + x[1] === antes, 'erro de rede NÃO apaga o cache');
    T(x[2]['*'].ok === false && !!S.pausaRede(x[2], AGORA), 'a rede fica em pausa');
    return Promise.all([venc(false), venc(true)]);
  }).then(v => T(v[0].length === 0 && v[1].length === 0, 'durante a pausa nada é consultado, nem pelo botão')); });
passo(() => { avancar(16 * MIN); REDE.modo = 'interrompida'; return venc(false)
  .then(v => { T(igual(v, ambas), 'passados 15 min, volta a tentar'); return passada(false); })
  .then(r => { T(!!r.rede && /transfer/.test(r.rede), 'transferência interrompida (200 + erro do curl) conta como falha de rede'); return Promise.all([nLinhas('6381'), nLinhas('6468')]); })
  .then(n => T(n[0] + n[1] === antes, 'e também não apaga nada')); });
/* ---- 5xx isolado: a outra tabela segue */
passo(() => { avancar(16 * MIN); REDE.modo = 'ok'; REDE.falha = { '6381': true }; return passada(false)
  .then(r => {
    T(!!r.erros['6381'] && r.rede === null && (r.novas.indexOf('6468') >= 0 || r.sem_novidade.indexOf('6468') >= 0), '5xx isolado fica na tabela dele; a outra é consultada');
    return Promise.all([A.estado(), nLinhas('6381')]);
  }).then(x => {
    T(x[0]['6381'].ok === false && !!x[0]['6381'].baixado_em, 'a tabela com erro guarda o erro E a data do último dado');
    T(x[1] > 0, 'e mantém os valores');
    return venc(false);
  }).then(v => { T(v.length === 0, 'tabela com erro espera 15 min'); avancar(16 * MIN); return venc(false); })
  .then(v => T(igual(v, ['6381']), 'e depois volta a ser tentada (a que deu certo espera 12 h)')); });
/* ---- três 5xx seguidos = serviço fora */
passo(() => {
  const extra = [['9001', 'movel'], ['9002', 'trimestral'], ['9011', 'movel'], ['9012', 'trimestral']].map(x => ({
    tabela: x[0], familia: x[1], espec: Object.assign({}, so2[0].espec, { tabela: x[0] }) }));
  REDE.falha = { '6381': true, '9001': true, '9002': true, '9011': true, '9012': true };
  return passada(false, so2.concat(extra)).then(r => {
    T(!!r.rede && r.consultadas.length === 3, 'três 5xx seguidos param a passada (o serviço está fora)');
    REDE.falha = {};
  });
});
/* ---- a trava: duas passadas ao mesmo tempo */
passo(() => { avancar(16 * MIN); const a = passada(true), b = passada(true); return Promise.all([a, b]).then(rs => {
  T(rs.some(r => r.ok === false && /em curso/.test(r.erro)), 'segunda passada simultânea é recusada');
  T(!S.emCurso(), 'e a trava é solta no fim'); }); });
/* ---- armazém: as camadas guardam e devolvem a mesma coisa */
function viagem(kv, nome) {
  const a = ARMAZEM.sobre(kv), linhas = [['4099', 'N1', '1', '202601', '5.3'], ['4099', 'N1', '1', '202602', null]];
  return a.gravarSerie('t1', linhas, [['N1', '1', 'Brasil']], '2026-10-26 09:00:00')
    .then(() => a.gravarConsulta('t1', { quando: 'x', ok: true })).then(() => a.gravarPeriodos('t1', [['202601', '2026-05-14'], ['202602', '']]))
    .then(() => Promise.all([a.lerSerie('t1'), a.estado(), a.lerLocais(), a.lerPeriodos(), a.temValores('t1'), a.temValores('t2'), kv.chaves()]))
    .then(x => {
      T(igual(x[0].linhas, linhas) && x[0].baixado_em === '2026-10-26 09:00:00', nome + ': a série volta igual (inclusive null)');
      T(x[1].t1.ok === true && x[2]['N1|1'] === 'Brasil', nome + ': consulta e locais');
      T(igual(x[3], { t1: { '202601': '2026-05-14' } }), nome + ': só períodos com data entram em lerPeriodos');
      T(x[4] === true && x[5] === false, nome + ': temValores');
      T(x[6].indexOf('serie:t1') >= 0, nome + ': chaves');
    });
}
passo(() => viagem(ARMAZEM.kvMemoria(), 'memória'));
passo(() => { let kv = null; try { kv = ARMAZEM.kvLocalStorage('teste_' + Date.now()); } catch (e) { R.push('SKIP localStorage indisponível: ' + e.message); }
  return kv ? viagem(kv, 'localStorage') : undefined; });
passo(() => ARMAZEM.kvIndexedDB('teste_' + Date.now()).then(kv => viagem(kv, 'IndexedDB').then(() => kv.fechar()), e => { R.push('SKIP IndexedDB indisponível: ' + e.message); }));
passo(() => ARMAZEM.abrir('teste_abrir_' + Date.now()).then(x => T(['indexedDB', 'localStorage', 'memoria'].indexOf(x.kv.tipo) >= 0,
  'abrir() escolhe uma camada (' + x.kv.tipo + (x.aviso ? '; ' + x.aviso : '') + ')')));

cadeia.catch(e => { R.push('FALHOU exceção: ' + (e && e.stack || e)); }).then(() => {
  const pre = document.createElement('pre'); pre.textContent = '<<<' + JSON.stringify(R) + '>>>'; document.body.replaceChildren(pre);
});
"""

JS_CATALOGO = r"""
const C = INDICADORES_CATALOGO, R = {};
R.indicadores = C.INDICADORES; R.precisao = C.PRECISAO_CV; R.legenda = C.FONTE_LEGENDA;
R.tabelas = C.tabelas().map(t => [t.tabela, t.familia, t.espec]);
R.classes = CVS.map(c => C.classePrecisao(c));
const pre = document.createElement('pre'); pre.textContent = '<<<' + JSON.stringify(R) + '>>>'; document.body.replaceChildren(pre);
"""
CVS = [0, 1, 5, 5.0001, 15, 15.1, 30, 30.5, 50, 50.1, 100, 1000, None]


def teste_cenarios(ctx):
    fix = {'per6381': ctx.gravado('periodos_6381'), 'per6468': ctx.gravado('periodos_6468'),
           'dados6381': ctx.gravado('dados_6381'), 'dados6468': ctx.gravado('dados_6468')}
    r = ctx.bancada(['indicadores.js', 'armazem.js', 'sidra.js'], JS_CENARIOS, {'FIX': fix})
    if r is None:
        ctx.confere(False, 'cenários: nenhum navegador')
        return
    if isinstance(r, dict):
        ctx.confere(False, 'cenários: ' + r.get('FALHA_GERAL', '?'))
        return
    for linha in r:
        if linha.startswith('SKIP'):
            print(u'AVISO  ' + linha)
        else:
            ctx.confere(linha.startswith('OK'), u'cenários: ' + linha)


def teste_catalogo(ctx):
    def calc():
        sys.path.insert(0, ctx.SUPERC_SCRIPTS)
        import lib_sidra
        sys.path.remove(ctx.SUPERC_SCRIPTS)
        return ctx.canon({'indicadores': lib_sidra.INDICADORES, 'precisao': lib_sidra.PRECISAO_CV, 'legenda': lib_sidra.FONTE_LEGENDA,
                          'tabelas': [[t, f, e] for t, f, e in lib_sidra.tabelas()]})
    esperado = ctx.esperado('catalogo', calc)
    if esperado is None:
        print(u'AVISO  paridade do catálogo não exercitada: sem o SuperC e sem testes/esperado/catalogo.json')
        return
    r = ctx.bancada(['indicadores.js'], JS_CATALOGO, {'CVS': CVS})
    if r is None or 'FALHA_GERAL' in r:
        ctx.confere(False, 'catálogo: ' + ('nenhum navegador' if r is None else r['FALHA_GERAL']))
        return
    for k in ('indicadores', 'precisao', 'legenda', 'tabelas'):
        d = ctx.diferenca(esperado[k], r[k])
        ctx.confere(d is None, 'paridade do catálogo / %s: %s' % (k, d))

    def classe(cv):
        if cv is None:
            return None
        for ate, nome in esperado['precisao']:
            if ate is None or cv <= ate:
                return nome
    ctx.confere(r['classes'] == [classe(c) for c in CVS], 'classes de precisão iguais às da página (%r)' % (r['classes'],))
    ctx.confere(len(r['tabelas']) == 16, 'o catálogo tem 16 tabelas')
