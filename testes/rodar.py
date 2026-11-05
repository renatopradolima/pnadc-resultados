# -*- coding: utf-8 -*-
u"""Testes do núcleo (rodam no Edge sem janela; nunca usam a rede).

PARIDADE Python x JS (PLANO.md, fase 1): as mesmas entradas passam por
`SuperC/scripts/lib_sidra.py` (referência, só leitura) e por `nucleo/sidra.js`
no Edge; os resultados são comparados campo a campo, tolerância zero. As
respostas do IBGE vêm de testes/gravados/ (gravadas em 26/10/2026).

Roda:  python -I testes/rodar.py
"""
import html as H
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
GRAVADOS = os.path.join(AQUI, 'gravados')
ORIGEM = os.path.join(RAIZ, 'ORIGEM.json')


def pasta_superc():
    """Projeto irmão (SuperC), OPCIONAL: variável PNADC_SUPERC, ou o "superc" de ORIGEM.json (relativo a esta pasta)."""
    p = os.environ.get('PNADC_SUPERC') or os.environ.get('SUPERC_PASTA')
    if not p:
        try:
            with open(ORIGEM, encoding='utf-8') as f:
                p = json.load(f).get('superc')
        except (OSError, ValueError):
            p = None
    p = p or os.path.join('..', 'SuperC')
    return os.path.normpath(p if os.path.isabs(p) else os.path.join(RAIZ, p))


SUPERC = pasta_superc()
SUPERC_SCRIPTS = os.path.join(SUPERC, 'scripts')
ESPERADO = os.path.join(AQUI, 'esperado')


def superc_disponivel():
    return os.path.exists(os.path.join(SUPERC_SCRIPTS, 'lib_sidra.py'))


def esperado(nome, calcular):
    """Saída de REFERÊNCIA (a do lib_sidra.py do SuperC) para a paridade. Com o SuperC presente, calcula ao vivo e só
    regrava testes/esperado/<nome>.json com --gravar (ou se não existir); sem ele, lê o arquivo guardado. None = sem
    como comparar (nem SuperC nem arquivo)."""
    arq = os.path.join(ESPERADO, nome + '.json')
    if superc_disponivel():
        v = calcular()
        guardado = None
        if os.path.exists(arq):
            with open(arq, encoding='utf-8') as f:
                guardado = json.load(f)
        if '--gravar' in sys.argv or guardado is None:
            os.makedirs(ESPERADO, exist_ok=True)
            with open(arq, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(v, f, ensure_ascii=False, indent=1, sort_keys=True)
                f.write('\n')
        elif json.loads(json.dumps(v)) != guardado:
            print(u'AVISO  testes/esperado/%s.json está desatualizado em relação ao SuperC: rode com --gravar' % nome)
        return v
    if os.path.exists(arq):
        with open(arq, encoding='utf-8') as f:
            return json.load(f)
    return None

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Chrome primeiro: em 04/11/2026 o Edge sem janela desta máquina devolve saída VAZIA e ainda deixa um processo
# rodando (que disputa CPU e estoura o tempo do teste). O runner tenta cada um e fica com o primeiro que devolver DOM.
NAVEGADORES = [r'C:\Program Files\Google\Chrome\Application\chrome.exe',
               r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
               r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
               r'C:\Program Files\Microsoft\Edge\Application\msedge.exe']

falhas, feitas = [], 0


def confere(cond, msg):
    global feitas
    feitas += 1
    if not cond:
        falhas.append(msg)
        print(u'FALHOU  ' + msg)


def navegadores():
    achados = [e for e in NAVEGADORES if os.path.exists(e)]
    for nome in ('chrome', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'msedge'):
        e = shutil.which(nome)
        if e and e not in achados:
            achados.append(e)
    return achados


def rodar_no_edge(doc, timeout=180, virtual_ms=20000, janela='1280,900'):
    """DOM final da bancada, ou None se não há navegador. Devolve '' se nenhum respondeu."""
    lista = navegadores()
    if not lista:
        return None
    pasta = tempfile.mkdtemp(prefix='pnadc_edge_')
    arq = os.path.join(pasta, 'bancada.html')
    with open(arq, 'w', encoding='utf-8') as f:
        f.write(doc)
    try:
        for n, exe in enumerate(lista):
            extra = ['--no-sandbox'] if (os.environ.get('CI') or (hasattr(os, 'geteuid') and os.geteuid() == 0)) else []
            r = subprocess.run([exe, '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check'] + extra +
                               ['--window-size=' + janela, '--user-data-dir=' + os.path.join(pasta, 'perfil%d' % n),
                                '--virtual-time-budget=%d' % virtual_ms, '--dump-dom', pathlib.Path(arq).as_uri()],
                               capture_output=True, timeout=timeout)
            dom = r.stdout.decode('utf-8', 'replace')
            if dom.strip():
                return dom
        return ''
    finally:
        shutil.rmtree(pasta, ignore_errors=True)


def url_arquivo(rel):
    return pathlib.Path(os.path.join(RAIZ, rel)).as_uri()


def gravado(nome):
    with open(os.path.join(GRAVADOS, nome + '.json'), encoding='utf-8') as f:
        return json.load(f)


def canon(x):
    """ida e volta por JSON: tuplas viram listas, como no outro lado"""
    return json.loads(json.dumps(x, ensure_ascii=False))


# ------------------------------------------------------------------ entradas (iguais nos dois lados)
NORMALIZAR = [[b, s, z] for b in (None, '5.3', '5,3', ' 5.3 ', '-5.3', '+2', '.5', '5.', '1e3', '-', '..', '...', 'X',
                                  'A', 'Z', 'Q', 'B', 'abc', 'texto muito longo com mais de vinte caracteres',
                                  "it's", '', '0', '-0.0', '12.34.56')
               for s in (False, True) for z in (True, False)]
ROTULOS = [[p, f] for p in ('202608', '202601', '202603', '202602', '202612', '202600', '202613', '2026', 'x', '')
           for f in ('movel', 'trimestral')]
ANO_ANT = ['202602', '202608', '000102', '2026', 'abc', '']
DATAS = ['14/08/2026', ' 14/08/2026 ', '2026-08-14', '', None, '1/2/2026', '31/12/1999']
PERIODOS_LONGOS = ['%d%02d' % (2012 + i // 12, i % 12 + 1) for i in range(200)]
BLOCOS = [[n, v, nv] for n in (0, 1, 3, 200) for v in (1, 6)
          for nv in (['N1'], ['N1', 'N2', 'N3'], ['N1', 'N2', 'N3', 'N6', 'N7'], ['N9'])]


def resp(status, corpo, interrompida=False, erro='', rejeita=False):
    return {'status': status, 'corpo': corpo, 'interrompida': interrompida, 'erro': erro, 'rejeita': rejeita}


def cenarios():
    """nome -> {tab, familia, uf, periodos, per: resposta de /periodos, dados: resposta de dados}"""
    out = {}
    for tab, fam in (('6381', 'movel'), ('6468', 'trimestral')):
        per = json.dumps(gravado('periodos_' + tab), ensure_ascii=False)
        dados = json.dumps(gravado('dados_' + tab), ensure_ascii=False)
        pers = [p['id'] for p in gravado('periodos_' + tab)]
        base = {'tab': tab, 'familia': fam, 'uf': '11', 'periodos': pers, 'per': resp(200, per),
                'dados': resp(200, dados)}
        out['ok_' + tab] = base
        out['longo_' + tab] = dict(base, periodos=PERIODOS_LONGOS)
    base = out['ok_6468']
    out['outra_uf'] = dict(base, uf='12')                                  # N6 de Porto Velho cai fora
    out['sem_rede'] = dict(base, dados=resp(0, '', erro='curl: (7) Failed to connect', rejeita=True),
                           per=resp(0, '', erro='curl: (7) Failed to connect', rejeita=True))
    out['interrompida'] = dict(base, dados=resp(200, '[{"id":', True, 'curl: (18) transfer closed'),
                               per=resp(200, '[{"id":', True, 'curl: (18) transfer closed'))
    out['http500'] = dict(base, dados=resp(500, '{"statusCode":500,"message":"Internal server error"}'),
                          per=resp(500, 'x'))
    out['http404'] = dict(base, dados=resp(404, 'não achei ' * 40), per=resp(404, 'nada'))
    out['cloudflare'] = dict(base, dados=resp(403, '<html>Just a moment... cloudflare</html>'),
                             per=resp(403, 'Attention Required! | Cloudflare'))
    out['proibido'] = dict(base, dados=resp(403, 'sem permissão'), per=resp(403, ''))
    out['nao_json'] = dict(base, dados=resp(200, '<html>oi</html>'), per=resp(200, 'não é json'))
    out['lista_vazia'] = dict(base, dados=resp(200, '[]'), per=resp(200, '[]'))
    out['fora_formato'] = dict(base, dados=resp(200, '{"a":1}'), per=resp(200, '{"a":1}'))
    out['ids_ruins'] = dict(base, per=resp(200, '[{"id":"abc"},{"id":"2026"},{"x":1}]'))
    out['desordem'] = dict(base, per=resp(200, '[{"id":"202602","modificacao":"14/08/2026"},'
                                              '{"id":"202504","modificacao":"20/02/2026"},'
                                              '{"id":"202601","modificacao":"bobagem"}]'))
    # classificação: o resultado "Total" é o escolhido, mesmo vindo depois de outro
    d = gravado('dados_6381')
    for v in d:
        r = v['resultados'][0]
        outro = json.loads(json.dumps(r))
        outro['classificacoes'] = [{'id': '1', 'nome': 'Sexo', 'categoria': {'1': 'Homens'}}]
        for s in outro['series']:
            s['serie'] = dict((k, '99.9') for k in s['serie'])
        r['classificacoes'] = [{'id': '1', 'nome': 'Sexo', 'categoria': {'0': 'Total'}}]
        v['resultados'] = [outro, r]
    out['classificacao'] = dict(out['ok_6381'], dados=resp(200, json.dumps(d, ensure_ascii=False)))
    # valor nulo e variável que não pedimos
    d = gravado('dados_6381')
    d[0]['resultados'][0]['series'][0]['serie']['202607'] = None
    d.append({'id': '9999', 'resultados': []})
    out['nulo_e_extra'] = dict(out['ok_6381'], dados=resp(200, json.dumps(d, ensure_ascii=False)))
    return out


# ------------------------------------------------------------------ lado Python (referência)
def lado_python(entrada):
    sys.path.insert(0, SUPERC_SCRIPTS)
    import lib_curl
    import lib_sidra
    sys.path.remove(SUPERC_SCRIPTS)

    esp = {}
    for ind in lib_sidra.INDICADORES:
        if ind['id'] == 'desocupacao':
            for fam in lib_sidra.FAMILIAS:
                esp[ind[fam]['tabela']] = dict(ind[fam], niveis=list(ind[fam]['niveis']))
    saida = {'normalizar': [list(lib_sidra.normalizar(b, situacao=s, zero_absoluto=z)) for b, s, z in NORMALIZAR],
             'rotulos': [lib_sidra.rotulo_periodo(p, f) for p, f in ROTULOS],
             'ano_ant': [lib_sidra.periodo_ano_anterior(p) for p in ANO_ANT],
             'datas': [lib_sidra._data_modificacao(d) for d in DATAS],
             'blocos': [lib_sidra._blocos(PERIODOS_LONGOS[:n], v, nv) for n, v, nv in BLOCOS],
             'urls': [lib_sidra._url(c) for c in ('/6468/periodos/202601-202602/variaveis/4099|4103?localidades=N1[all]|N3[all]',)],
             'consultar': {}, 'baixar': {}}
    atual = {}

    def falso(url, **kw):
        atual['urls'].append(url)
        r = atual['sc']['per'] if url.endswith('/periodos') else atual['sc']['dados']
        return lib_curl.RespostaCurl(r['status'], r['corpo'].encode('utf-8'), {}, r['erro'],
                                     18 if r['interrompida'] else (7 if r['rejeita'] else 0))

    original = lib_curl.chamar
    lib_curl.chamar = falso
    try:
        for nome, sc in entrada['cenarios'].items():
            atual.update(sc=sc, urls=[])
            try:
                res = {'ok': canon([list(x) for x in lib_sidra.consultar_periodos(sc['tab'])])}
            except (lib_sidra.ErroRede, lib_sidra.ErroTabela) as ex:
                res = {'erro': type(ex).__name__, 'msg': str(ex), 'servidor': getattr(ex, 'do_servidor', False)}
            saida['consultar'][nome] = {'res': res, 'urls': atual['urls']}
            atual.update(urls=[])
            try:
                linhas, locais = lib_sidra.baixar_serie(sc['tab'], esp[sc['tab']], sc['periodos'], sc['uf'])
                res = {'ok': canon({'linhas': [list(x) for x in linhas],
                                    'locais': [[n, i, nome_] for (n, i), nome_ in locais.items()]})}
            except (lib_sidra.ErroRede, lib_sidra.ErroTabela) as ex:
                res = {'erro': type(ex).__name__, 'msg': str(ex), 'servidor': getattr(ex, 'do_servidor', False)}
            saida['baixar'][nome] = {'res': res, 'urls': atual['urls']}
    finally:
        lib_curl.chamar = original
    entrada['espec'] = esp
    return canon(saida)


# ------------------------------------------------------------------ lado JS (Edge)
JS = r"""
const E = ENTRADA, S = SIDRA, R = {};
function io(sc) {
  return { buscar(u) {
    R_urls.push(u);
    const r = /\/periodos$/.test(u) ? sc.per : sc.dados;
    if (r.rejeita) return Promise.reject(new Error(r.erro));
    return Promise.resolve({ status: r.status, corpo: r.corpo, interrompida: r.interrompida, erro: r.erro });
  } };
}
let R_urls = [];
function erroDe(ex) {
  return { erro: ex instanceof S.ErroRede ? 'ErroRede' : ex instanceof S.ErroTabela ? 'ErroTabela' : 'OUTRO:' + ex,
           msg: ex.message, servidor: ex instanceof S.ErroTabela ? ex.doServidor : false };
}
R.normalizar = E.normalizar.map(c => S.normalizar(c[0], c[1], c[2]));
R.rotulos = E.rotulos.map(c => S.rotuloPeriodo(c[0], c[1]));
R.ano_ant = E.ano_ant.map(p => S.periodoAnoAnterior(p));
R.datas = E.datas.map(d => S.dataModificacao(d));
R.blocos = E.blocos.map(c => S.blocos(E.periodos_longos.slice(0, c[0]), c[1], c[2]));
R.urls = ['/6468/periodos/202601-202602/variaveis/4099|4103?localidades=N1[all]|N3[all]'].map(c => S.url(c));
R.consultar = {}; R.baixar = {};
let cadeia = Promise.resolve();
Object.keys(E.cenarios).forEach(nome => {
  const sc = E.cenarios[nome];
  cadeia = cadeia.then(() => {
    R_urls = [];
    return S.consultarPeriodos(sc.tab, io(sc)).then(x => ({ ok: x }), erroDe);
  }).then(res => {
    R.consultar[nome] = { res, urls: R_urls };
    R_urls = [];
    return S.baixarSerie(sc.tab, E.espec[sc.tab], sc.periodos, sc.uf, io(sc)).then(x => ({ ok: x }), erroDe);
  }).then(res => { R.baixar[nome] = { res, urls: R_urls }; });
});
cadeia.then(() => R, e => ({ FALHA_GERAL: String(e && e.stack || e) })).then(r => {
  const pre = document.createElement('pre');
  pre.textContent = '<<<' + JSON.stringify(r) + '>>>';
  document.body.replaceChildren(pre);
});
"""


def lado_js(entrada):
    doc = ('<!doctype html><html><head><meta charset="utf-8"></head><body><script>var ENTRADA = '
           + json.dumps(entrada, ensure_ascii=False).replace('</', '<\\/') + ';</script>'
           '<script src="' + url_arquivo('nucleo/sidra.js') + '"></script>'
           '<script>try {' + JS + '} catch (e) { document.body.textContent = "<<<" + JSON.stringify({FALHA_GERAL: String(e && e.stack || e)}) + ">>>"; }</script>'
           '</body></html>')
    dom = rodar_no_edge(doc)
    if dom is None:
        return None
    i, j = dom.find('&lt;&lt;&lt;'), dom.rfind('&gt;&gt;&gt;')
    if i < 0 or j < i:
        return {'FALHA_GERAL': 'a bancada JS não respondeu'}
    return json.loads(H.unescape(dom[i + 12:j]))


# ------------------------------------------------------------------ comparação
def bancada(scripts, js, variaveis):
    """Roda `js` no navegador com as variáveis globais (JSON) e os scripts de nucleo/ carregados.
    Devolve o JSON que o código põe entre <<< >>>; None se não há navegador."""
    pre = ''.join('<script>var %s = %s;</script>' % (k, json.dumps(v, ensure_ascii=False).replace('</', '<\\/'))
                  for k, v in variaveis.items())
    doc = ('<!doctype html><html><head><meta charset="utf-8"></head><body>' + pre +
           ''.join('<script src="' + url_arquivo('nucleo/' + n) + '"></script>' for n in scripts) +
           '<script>try {' + js + '} catch (e) { document.body.textContent = "<<<" + JSON.stringify({FALHA_GERAL: '
           'String(e && e.stack || e)}) + ">>>"; }</script></body></html>')
    dom = rodar_no_edge(doc)
    if dom is None:
        return None
    i, j = dom.find('&lt;&lt;&lt;'), dom.rfind('&gt;&gt;&gt;')
    if i < 0 or j < i:
        return {'FALHA_GERAL': 'a bancada JS não respondeu'}
    return json.loads(H.unescape(dom[i + 12:j]))


PREFIXO_JSON =u'resposta do IBGE não é JSON'


def diferenca(a, b, caminho=''):
    """primeira diferença entre dois JSON (ou None). O detalhe da mensagem do analisador de JSON é do
    interpretador (Python x V8), não da nossa lógica: só o prefixo é comparado."""
    if isinstance(a, str) and isinstance(b, str) and a.startswith(PREFIXO_JSON) and b.startswith(PREFIXO_JSON):
        return None
    if type(a) != type(b) and not (isinstance(a, (int, float)) and isinstance(b, (int, float))
                                   and not isinstance(a, bool) and not isinstance(b, bool)):
        return '%s: tipo %s x %s (%r x %r)' % (caminho, type(a).__name__, type(b).__name__, a, b)
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                return '%s/%s: só de um lado' % (caminho, k)
            d = diferenca(a[k], b[k], '%s/%s' % (caminho, k))
            if d:
                return d
        return None
    if isinstance(a, list):
        if len(a) != len(b):
            return '%s: %d itens x %d' % (caminho, len(a), len(b))
        for i, (x, y) in enumerate(zip(a, b)):
            d = diferenca(x, y, '%s[%d]' % (caminho, i))
            if d:
                return d
        return None
    return None if a == b else '%s: %r x %r' % (caminho, a, b)


def teste_sidra():
    entrada = {'normalizar': NORMALIZAR, 'rotulos': ROTULOS, 'ano_ant': ANO_ANT, 'datas': DATAS,
               'periodos_longos': PERIODOS_LONGOS, 'blocos': BLOCOS, 'cenarios': cenarios()}
    def _calcular():
        saida = lado_python(entrada)             # preenche entrada['espec']
        return {'saida': saida, 'espec': entrada['espec']}
    ref = esperado('sidra', _calcular)
    if ref is None:
        print(u'AVISO  paridade do sidra.js não exercitada: sem o SuperC (%s) e sem testes/esperado/sidra.json' % SUPERC)
        return
    py = ref['saida']
    entrada['espec'] = ref['espec']
    js = lado_js(entrada)
    if js is None:
        print(u'FALHOU  Edge não encontrado: nada foi exercitado')
        sys.exit(1)
    if 'FALHA_GERAL' in js:
        print(u'FALHOU  ' + js['FALHA_GERAL'])
        sys.exit(1)

    for chave in ('normalizar', 'rotulos', 'ano_ant', 'datas', 'blocos', 'urls'):
        for i, (a, b) in enumerate(zip(py[chave], js[chave])):
            d = diferenca(a, b)
            confere(d is None, 'paridade %s #%d (entrada %r): %s' % (
                chave, i, (entrada.get(chave) or [None] * (i + 1))[i] if chave in entrada else '', d))
        confere(len(py[chave]) == len(js[chave]), 'paridade %s: mesmo número de casos' % chave)
    for chave in ('consultar', 'baixar'):
        for nome in entrada['cenarios']:
            d = diferenca(py[chave][nome], js[chave][nome])
            confere(d is None, 'paridade %s / %s: %s' % (chave, nome, d))

    # alguns resultados conferidos À MÃO (a paridade sozinha não prova que o Python está certo)
    b = js['baixar']['ok_6468']['res']['ok']
    confere(len(b['linhas']) > 0 and ['4099', 'N3', '11', '202602', '2.6'] in b['linhas'],
            'RO 2º tri 2026 = 2,6 nas linhas baixadas')
    confere(['N6', '1100205', 'Porto Velho (RO)'] in b['locais'], 'capital da UF escolhida entra')
    confere(not any(l[0] == 'N6' for l in js['baixar']['outra_uf']['res']['ok']['linhas']),
            'N6 de outra UF não entra')
    confere(js['baixar']['sem_rede']['res']['erro'] == 'ErroRede', 'sem resposta = ErroRede')
    confere(js['baixar']['http500']['res'].get('servidor') is True, '5xx marca do_servidor')
    confere(js['consultar']['ok_6468']['res']['ok'][-1] == ['202602', '2026-08-14'], 'último período e data de modificação')
    confere(len(js['baixar']['longo_6468']['urls']) == 3, '200 períodos x 80 localidades x 6 variáveis = 3 blocos de pedido')
    confere(all('[' not in u and '|' not in u for c in js['baixar'].values() for u in c['urls']),
            'nenhuma URL com colchete ou barra sem codificar')


def main():
    """Sem argumentos roda tudo; com nomes (sidra, catalogo, cenarios, montar, casca) roda só esses."""
    sys.path.insert(0, AQUI)
    import cenarios as CEN
    import cenarios_montar as CM
    import casca as CA
    import responsivo as RE
    import medicao as ME
    ctx = sys.modules[__name__]
    todos = [('sidra', teste_sidra), ('catalogo', lambda: CEN.teste_catalogo(ctx)),
             ('cenarios', lambda: CEN.teste_cenarios(ctx)), ('montar', lambda: CM.teste_montar(ctx)),
             ('casca', lambda: CA.teste_casca(ctx)), ('responsivo', lambda: RE.teste_responsivo(ctx)), ('medicao', lambda: ME.teste_medicao(ctx)), ('entregue', lambda: CA.teste_entregue(ctx))]
    pedidos = sys.argv[1:]
    for nome, fn in todos:
        if not pedidos or nome in pedidos:
            fn()
    print(u'%d verificações, %d falha(s)' % (feitas, len(falhas)))
    sys.exit(1 if falhas else 0)


if __name__ == '__main__':
    main()
