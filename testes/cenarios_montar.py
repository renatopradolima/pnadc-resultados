# -*- coding: utf-8 -*-
u"""Paridade do JSON inteiro de montar() e novidades() (nucleo/montar.js) contra lib_sidra.py.

As duas pontas partem das mesmas respostas gravadas (testes/gravados/), do mesmo relógio fixo e do mesmo
catálogo reduzido (só a desocupação: tabelas 6381 e 6468). Chamado por testes/rodar.py.
"""
import json
import os
import sqlite3
import sys
import tempfile
from datetime import datetime

JS_MONTAR = r"""
const S = SIDRA, F = FIX, R = {};
const AGORA = new Date(2026, 9, 26, 9, 0, 0);
const io = { buscar(u) {
  const tab = u.slice(S.BASE_URL.length).split('/')[1];
  const corpo = /\/periodos$/.test(u) ? F['per' + tab] : F['dados' + tab];
  return Promise.resolve({ status: 200, corpo: JSON.stringify(corpo), interrompida: false, erro: '' });
} };
const A = ARMAZEM.memoria();
const inds = INDICADORES_CATALOGO.INDICADORES.filter(i => i.id === 'desocupacao');
const tabs = INDICADORES_CATALOGO.tabelas().filter(t => t.tabela === '6381' || t.tabela === '6468');
const opc = { agora: () => AGORA, indicadores: inds };
S.atualizar(A, '11', { io, agora: () => AGORA, tabelas: tabs })
  .then(() => MONTAR.montar(A, '11', 'RO', 'Rondônia', opc))
  .then(m => { R.montar = m; return MONTAR.montar(A, '12', 'AC', 'Acre', opc); })
  .then(m => { R.montar_ac = m; return MONTAR.novidades(A, '11', 'RO', 'Rondônia', opc); })
  .then(n => { R.novidades = n; return A.lerSerie('6468'); })
  .then(s => {
    /* símbolos especiais, como no teste do SuperC */
    s.linhas.forEach(l => {
      if (l[0] === '9402' && l[1] === 'N6' && l[3] === '202601') l[4] = '-';
      if (l[0] === '4099' && l[1] === 'N3' && l[2] === '12' && l[3] === '202601') l[4] = 'X';
      if (l[0] === '9130' && l[1] === 'N3' && l[2] === '12' && l[3] === '202504') l[4] = 'Q';
      if (l[0] === '4103' && l[1] === 'N3' && l[2] === '12' && l[3] === '202504') l[4] = 'abc';
    });
    return A.kv.set('serie:6468', s);
  })
  .then(() => MONTAR.montar(A, '11', 'RO', 'Rondônia', opc))
  .then(m => { R.montar_esp = m; return MONTAR.novidades(A, '11', 'RO', 'Rondônia', opc); })
  .then(n => {
    R.novidades_esp = n;
    /* corte das outras UFs: 12 períodos de uma UF que não é a escolhida */
    const B = ARMAZEM.memoria(), linhas = [];
    for (let i = 0; i < 12; i++) {
      const p = (2020 + (i >> 2)) + '0' + ((i % 4) + 1);
      linhas.push(['4099', 'N3', '12', p, String(i)]);
      linhas.push(['4099', 'N3', '11', p, String(i)]);
    }
    return B.gravarSerie('6468', linhas, [['N3', '12', 'Acre'], ['N3', '11', 'Rondônia']], 'x')
      .then(() => MONTAR.montar(B, '11', 'RO', 'Rondônia', opc));
  })
  .then(m => {
    const s = m.series.desocupacao.trimestral, ac = s['N3|12'];
    R.corte = { ac: ac.per.length, ro: s['N3|11'].per.length, ultimo_ac: ac.per[ac.per.length - 1], primeiro_ac: ac.per[0] };
    return MONTAR.montar(ARMAZEM.memoria(), '11', 'RO', 'Rondônia', opc);
  })
  .then(m => { R.vazio = m; return MONTAR.novidades(ARMAZEM.memoria(), '11', 'RO', 'Rondônia', opc); })
  .then(n => { R.novidades_vazio = n; }, e => { R.FALHA_GERAL = String(e && e.stack || e); })
  .then(() => { const pre = document.createElement('pre'); pre.textContent = '<<<' + JSON.stringify(R) + '>>>'; document.body.replaceChildren(pre); });
"""


def teste_montar(ctx):
    sys.path.insert(0, ctx.SUPERC_SCRIPTS)
    import lib_curl
    import lib_sidra
    sys.path.remove(ctx.SUPERC_SCRIPTS)
    fix = {'per6381': ctx.gravado('periodos_6381'), 'per6468': ctx.gravado('periodos_6468'),
           'dados6381': ctx.gravado('dados_6381'), 'dados6468': ctx.gravado('dados_6468')}

    # ---- lado Python (referência)
    agora = datetime(2026, 10, 26, 9, 0, 0)
    lib_sidra._agora = lambda: agora

    def falso(url, **kw):
        tab = url[len(lib_sidra.BASE_URL):].split('/')[1]
        obj = fix[('per' if url.endswith('/periodos') else 'dados') + tab]
        return lib_curl.RespostaCurl(200, json.dumps(obj, ensure_ascii=False).encode('utf-8'), {})
    original = (lib_curl.chamar, lib_sidra.INDICADORES)
    lib_curl.chamar = falso
    lib_sidra.INDICADORES = [i for i in lib_sidra.INDICADORES if i['id'] == 'desocupacao']
    pasta = tempfile.mkdtemp(prefix='pnadc_py_')
    con = sqlite3.connect(os.path.join(pasta, 'u.sqlite'))
    vazio = sqlite3.connect(':memory:')
    try:
        lib_sidra.garantir(con)
        lib_sidra.atualizar(lambda fn: fn(con), '11', log=lambda *a: None)
        esp = {'montar': lib_sidra.montar(con, '11', 'RO', 'Rondônia'),
               'montar_ac': lib_sidra.montar(con, '12', 'AC', 'Acre'),
               'novidades': lib_sidra.novidades(con, '11', 'RO', 'Rondônia')}
        for valor, var, nivel, loc, per in (('-', '9402', 'N6', '1100205', '202601'), ('X', '4099', 'N3', '12', '202601'),
                                            ('Q', '9130', 'N3', '12', '202504'), ('abc', '4103', 'N3', '12', '202504')):
            con.execute('UPDATE sidra_valor SET valor=? WHERE tabela=? AND variavel=? AND nivel=? AND localidade=? AND periodo=?',
                        (valor, '6468', var, nivel, loc, per))
        con.commit()
        esp['montar_esp'] = lib_sidra.montar(con, '11', 'RO', 'Rondônia')
        esp['novidades_esp'] = lib_sidra.novidades(con, '11', 'RO', 'Rondônia')
        lib_sidra.garantir(vazio)
        esp['vazio'] = lib_sidra.montar(vazio, '11', 'RO', 'Rondônia')
        esp['novidades_vazio'] = lib_sidra.novidades(vazio, '11', 'RO', 'Rondônia')
    finally:
        con.close()
        vazio.close()
        lib_curl.chamar, lib_sidra.INDICADORES = original
    esp = ctx.canon(esp)

    # ---- lado JS
    r = ctx.bancada(['indicadores.js', 'armazem.js', 'sidra.js', 'montar.js'], JS_MONTAR, {'FIX': fix})
    if r is None or 'FALHA_GERAL' in r:
        ctx.confere(False, 'montar: ' + ('nenhum navegador' if r is None else r['FALHA_GERAL']))
        return
    for k in ('montar', 'montar_ac', 'novidades', 'montar_esp', 'novidades_esp', 'vazio', 'novidades_vazio'):
        d = ctx.diferenca(esp[k], r[k])
        ctx.confere(d is None, 'paridade do JSON de %s: %s' % (k, d))

    # ---- conferidos à mão (a paridade sozinha não prova que o Python está certo)
    m = r['montar']
    s = m['series']['desocupacao']['trimestral']['N3|11']
    ctx.confere(s['per'][-1] == '202602' and s['v'][-1] == 2.6 and s['cv'][-1] == 10.5, 'série da UF: 2º tri 2026 = 2,6% (CV 10,5%)')
    ctx.confere(s['sc'][-1] == 'Z' and s['vc'][-1] == -1.0 and s['sa'][-1] == 'A', 'variação e situação publicadas')
    ctx.confere(m['series']['desocupacao']['movel']['N1|1']['v'][-1] == 5.3, 'trimestre móvel Brasil jun-jul-ago 2026 = 5,3%')
    ctx.confere(m['regiao'] == {'codigo': '1', 'nome': 'Norte'}, 'a Grande Região da UF sai do código (1 = Norte)')
    ctx.confere(m['locais'].get('N6|1100205', '').startswith('Porto Velho'), 'nome da capital vem da API')
    ctx.confere(m['divulgacao']['6468']['202602'] == '2026-08-14', 'data de divulgação de cada período')
    tri = r['novidades']['indicadores'][0]['trimestral']
    ctx.confere(tri['periodo'] == '202602' and tri['divulgacao'] == '2026-08-14' and tri['uf']['v'] == 2.6 and
                tri['uf']['sc'] == 'Z' and tri['regiao']['v'] == 6.1 and tri['brasil']['v'] == 5.4,
                'resumo dos alertas: último período, divulgação e o ponto de UF, região e Brasil')
    ctx.confere('uf' not in r['novidades']['indicadores'][0]['movel'], 'no trimestre móvel o resumo só tem o Brasil')
    cap = r['montar_esp']['series']['desocupacao']['trimestral']['N6|1100205']
    i = cap['per'].index('202601')
    ctx.confere(cap['vc'][i] is None and any(e[0] == 'vc' and e[1] == i and e[2] == '-' for e in cap['esp']),
                "'-' numa variação chega como null, com o símbolo e o motivo")
    ac = r['montar_esp']['series']['desocupacao']['trimestral']['N3|12']
    ctx.confere(ac['v'][ac['per'].index('202601')] is None and any(e[2] == 'X' for e in ac['esp']),
                "'X' (inibido) chega como null, com o motivo")
    ctx.confere(any(e[0] == 'sc' and e[2] == 'Q' and 'não reconhecida' in e[3] for e in ac['esp']) and
                ac['sc'][ac['per'].index('202504')] == 'Q', 'letra de situação desconhecida vai crua, com o aviso')
    ctx.confere(r['corte']['ac'] == 9 and r['corte']['ro'] == 12 and r['corte']['ultimo_ac'] == '202204',
                'outras UFs levam só os últimos 9 períodos; a UF escolhida leva todos (%r)' % (r['corte'],))
    ctx.confere(r['vazio']['series']['desocupacao']['trimestral'] == {} and r['vazio']['regiao']['nome'] == '',
                'cache vazio: montar não quebra')
