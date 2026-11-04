# -*- coding: utf-8 -*-
u"""Gera nucleo/bandeiras.js: miniaturas das bandeiras do Brasil e das 27 UFs, embutidas (PNG em base64).

As bandeiras vêm do Wikimedia Commons, onde todas estão marcadas como domínio público (símbolos oficiais).
O script consulta a API do Commons (só aqui, na construção do repositório; o produto final não faz nenhuma
requisição de imagem), baixa as miniaturas de 96 px de largura e grava o módulo JavaScript, com o título, a
licença e a página de cada arquivo. Rode de novo só se quiser atualizar as imagens:

    python -I scripts/gerar_bandeiras.py            # baixa e gera
    python -I scripts/gerar_bandeiras.py --pasta X  # usa PNGs já baixados em X (nomes <codigo>.png) e meta.json
"""
import base64
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, '..', 'nucleo', 'bandeiras.js')
UA = 'PNADC-Resultados-build/1.0 (https://github.com/renatopradolima/pnadc-resultados)'

# código IBGE da UF (ou BR) -> título do arquivo no Commons, sigla e nome
UFS = [
    ('BR', 'Flag of Brazil.svg', 'BR', 'Brasil'),
    ('11', 'Bandeira de Rondônia.svg', 'RO', 'Rondônia'), ('12', 'Bandeira do Acre.svg', 'AC', 'Acre'), ('13', 'Bandeira do Amazonas.svg', 'AM', 'Amazonas'),
    ('14', 'Bandeira de Roraima.svg', 'RR', 'Roraima'), ('15', 'Bandeira do Pará.svg', 'PA', 'Pará'), ('16', 'Bandeira do Amapá.svg', 'AP', 'Amapá'),
    ('17', 'Bandeira do Tocantins.svg', 'TO', 'Tocantins'), ('21', 'Bandeira do Maranhão.svg', 'MA', 'Maranhão'), ('22', 'Bandeira do Piauí.svg', 'PI', 'Piauí'),
    ('23', 'Bandeira do Ceará.svg', 'CE', 'Ceará'), ('24', 'Bandeira do Rio Grande do Norte.svg', 'RN', 'Rio Grande do Norte'), ('25', 'Bandeira da Paraíba.svg', 'PB', 'Paraíba'),
    ('26', 'Bandeira de Pernambuco.svg', 'PE', 'Pernambuco'), ('27', 'Bandeira de Alagoas.svg', 'AL', 'Alagoas'), ('28', 'Bandeira de Sergipe.svg', 'SE', 'Sergipe'),
    ('29', 'Bandeira da Bahia.svg', 'BA', 'Bahia'), ('31', 'Bandeira de Minas Gerais.svg', 'MG', 'Minas Gerais'), ('32', 'Bandeira do Espírito Santo.svg', 'ES', 'Espírito Santo'),
    ('33', 'Bandeira do estado do Rio de Janeiro.svg', 'RJ', 'Rio de Janeiro'), ('35', 'Bandeira do estado de São Paulo.svg', 'SP', 'São Paulo'),
    ('41', 'Bandeira do Paraná.svg', 'PR', 'Paraná'), ('42', 'Bandeira de Santa Catarina.svg', 'SC', 'Santa Catarina'), ('43', 'Bandeira do Rio Grande do Sul.svg', 'RS', 'Rio Grande do Sul'),
    ('50', 'Bandeira de Mato Grosso do Sul.svg', 'MS', 'Mato Grosso do Sul'), ('51', 'Bandeira de Mato Grosso.svg', 'MT', 'Mato Grosso'), ('52', 'Bandeira de Goiás.svg', 'GO', 'Goiás'),
    ('53', 'Bandeira do Distrito Federal (Brasil).svg', 'DF', 'Distrito Federal'),
]


def _get(url):
    err = None
    for i in range(4):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40).read()
        except Exception as e:  # noqa: BLE001 -- tenta de novo com espera crescente
            err = e
            time.sleep(3 + 3 * i)
    raise err


def baixar(pasta):
    os.makedirs(pasta, exist_ok=True)
    meta = {}
    for cod, titulo, _sig, _nome in UFS:
        url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(
            {'action': 'query', 'titles': 'File:' + titulo, 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'iiurlwidth': 96, 'format': 'json'})
        pg = list(json.loads(_get(url))['query']['pages'].values())[0]
        ii = pg['imageinfo'][0]
        em = ii.get('extmetadata', {})
        open(os.path.join(pasta, cod + '.png'), 'wb').write(_get(ii['thumburl']))
        meta[cod] = {'titulo': pg['title'], 'licenca': (em.get('LicenseShortName') or {}).get('value', '?'), 'pagina': ii['descriptionurl']}
        time.sleep(1.5)
    json.dump(meta, open(os.path.join(pasta, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def miniatura(arq):
    u"""PNG de 64 px de largura com paleta reduzida (cada bandeira fica com 1 a 4 KB). Sem a biblioteca Pillow, usa o PNG como veio."""
    bruto = open(arq, 'rb').read()
    try:
        import io
        from PIL import Image
    except ImportError:
        return bruto
    im = Image.open(io.BytesIO(bruto)).convert('RGBA')
    h = max(1, round(im.height * 64 / im.width))
    im = im.resize((64, h), Image.LANCZOS)
    im = im.quantize(colors=96, method=Image.FASTOCTREE)
    saida = io.BytesIO()
    im.save(saida, format='PNG', optimize=True)
    return saida.getvalue()


def gerar(pasta):
    meta = json.load(open(os.path.join(pasta, 'meta.json'), encoding='utf-8'))
    imgs, fontes = {}, []
    for cod, _t, sig, nome in UFS:
        dados = miniatura(os.path.join(pasta, cod + '.png'))
        imgs[cod] = 'data:image/png;base64,' + base64.b64encode(dados).decode('ascii')
        m = meta[cod]
        fontes.append({'codigo': cod, 'sigla': sig, 'nome': nome, 'arquivo': m['titulo'], 'licenca': m['licenca'], 'pagina': m['pagina']})
    js = u"""/* GERADO por scripts/gerar_bandeiras.py -- não edite. Miniaturas (PNG, 64 px de largura, paleta reduzida) das bandeiras do Brasil e das 27 UFs,
   do Wikimedia Commons (todas marcadas como domínio público; lista abaixo). Embutidas: o produto não busca imagem nenhuma na rede. */
const BANDEIRAS = (() => {
  const IMG = %s;
  const FONTES = %s;
  const semAcento = s => String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
  const POR_NOME = {};
  FONTES.forEach(f => { POR_NOME[semAcento(f.nome)] = f.codigo; POR_NOME[semAcento(f.sigla)] = f.codigo; });
  /* aceita o código do IBGE (11, '11', 'N3|11'), a sigla (RO) ou o nome (Rondônia); devolve o código ou '' */
  function codigo(x) {
    if (x === null || x === undefined || x === '') return '';
    let s = String(x).trim();
    if (s.indexOf('|') >= 0) s = s.split('|')[1];
    if (IMG[s]) return s;
    const n = semAcento(s).replace(/\\s*\\([a-z]{2}\\)\\s*$/, '');
    return POR_NOME[n] || POR_NOME[semAcento(s)] || '';
  }
  /* Cada bandeira vira UMA URL curta (blob), criada na primeira vez que aparece: o <img> da tabela carrega só 'blob:...', não 3 KB de base64
     repetidos 27 vezes, e o navegador decodifica cada imagem uma única vez. */
  const BLOB = {};
  function src(c) {
    if (!BLOB[c]) {
      try {
        const bin = atob(IMG[c].split(',')[1]), b = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) b[k] = bin.charCodeAt(k);
        BLOB[c] = URL.createObjectURL(new Blob([b], { type: 'image/png' }));
      } catch (e) { BLOB[c] = IMG[c]; }
    }
    return BLOB[c];
  }
  const url = x => { const c = codigo(x); return c ? IMG[c] : ''; };
  /* <img> decorativa (o nome já está escrito ao lado): altura em em, largura automática */
  function img(x, altura) {
    const c = codigo(x); if (!c) return null;
    const i = document.createElement('img');
    i.className = 'mo-flag'; i.src = src(c); i.alt = ''; i.setAttribute('aria-hidden', 'true'); i.draggable = false;
    if (altura) i.style.height = altura;
    return i;
  }
  /* o mesmo, como texto HTML seguro (só o que está em IMG entra) -- para as tabelas */
  const html = x => { const c = codigo(x); return c ? '<img class="mo-flag" src="' + src(c) + '" alt="" aria-hidden="true" draggable="false">' : ''; };
  /* HTMLImageElement já carregado (para desenhar em canvas); `aoCarregar` é chamado quando terminar */
  const CACHE = {};
  function imagem(x, aoCarregar) {
    const c = codigo(x); if (!c) return null;
    if (!CACHE[c]) { const i = new Image(); i._cbs = []; i.onload = () => { i._ok = true; const l = i._cbs; i._cbs = []; l.forEach(f => f()); }; i.src = src(c); CACHE[c] = i; }
    const i = CACHE[c];
    if (!i._ok && aoCarregar && i._cbs.indexOf(aoCarregar) < 0) i._cbs.push(aoCarregar);   // a MESMA função só entra uma vez
    return i._ok ? i : null;
  }
  /* decodifica todas já na abertura (fora da hora de desenhar), para os gráficos não esperarem pelas imagens */
  function precarregar() { FONTES.forEach(f => imagem(f.codigo)); }
  setTimeout(precarregar, 0);
  return { codigo, url, img, html, imagem, FONTES };
})();
""" % (json.dumps(imgs, ensure_ascii=False, indent=1), json.dumps(fontes, ensure_ascii=False, indent=1))
    open(SAIDA, 'w', encoding='utf-8', newline='\n').write(js)
    print('nucleo/bandeiras.js: %d bandeiras, %d KB' % (len(imgs), len(js.encode('utf-8')) // 1024))


if __name__ == '__main__':
    if '--pasta' in sys.argv:
        gerar(sys.argv[sys.argv.index('--pasta') + 1])
    else:
        import tempfile
        pasta = os.path.join(tempfile.gettempdir(), 'pnadc_bandeiras')
        baixar(pasta)
        gerar(pasta)
