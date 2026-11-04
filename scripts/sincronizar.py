# -*- coding: utf-8 -*-
"""Ponte com o SuperC (PLANO.md, seção 5). Cada arquivo compartilhado tem UM dono.

  --verificar   falha se a cópia (lado que NÃO é o dono) foi editada ou se algo
                mudou sem sincronizar. Sem nada compartilhado, diz isso e sai 0.
  --empurrar    copia nucleo/ (dono: aqui) para SuperC/app/js/resultados/.
  --puxar-kit   traz os arquivos do kit (dono: SuperC) para kit/.

O registro de hashes fica em ORIGEM.json. Só mexe nos arquivos listados/casados.
Falta ainda (fase 3): acertar os <script> do index.html do SuperC e a lista do pacote.
"""
import argparse, fnmatch, hashlib, json, os, shutil, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
MANIFESTO = os.path.join(RAIZ, 'ORIGEM.json')
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def sha(caminho):
    h = hashlib.sha256()
    with open(caminho, 'rb') as f:
        h.update(f.read())
    return h.hexdigest()


def carregar():
    with open(MANIFESTO, encoding='utf-8') as f:
        return json.load(f)


def salvar(m):
    with open(MANIFESTO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(m, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write('\n')


def lado_aqui(m, g):
    return os.path.join(RAIZ, *m['grupos'][g]['aqui'].split('/'))


def lado_superc(m, g):
    gr = m['grupos'][g]
    return os.path.join(m['superc'], *gr.get('superc', '').split('/')) if gr.get('superc') else None


def arquivos_do_grupo(m, g):
    """Nomes (relativos) que pertencem ao grupo."""
    gr = m['grupos'][g]
    if 'arquivos' in gr:
        return sorted(gr['arquivos'])
    pasta = lado_aqui(m, g)
    if not os.path.isdir(pasta):
        return []
    return sorted(n for n in os.listdir(pasta) if fnmatch.fnmatch(n, gr['padrao']))


NL, CRLF = chr(10), chr(13) + chr(10)
INICIO = '<!-- PNADC_RESULTADOS:INICIO'
FIM = '<!-- PNADC_RESULTADOS:FIM'


def versao_nucleo():
    with open(os.path.join(RAIZ, 'nucleo', 'versao.js'), encoding='utf-8') as f:
        t = f.read()
    i = t.index("VERSAO_NUCLEO = '") + len("VERSAO_NUCLEO = '")
    return t[i:t.index("'", i)]


def bloco_scripts(m):
    """O bloco de <script> que o index.html do SuperC deve ter, entre os marcadores (ordem do manifesto)."""
    linhas = [INICIO + ' (gerado por PNADC_Resultados/scripts/sincronizar.py --empurrar; não edite aqui) -->']
    for nome in m['grupos']['nucleo']['carregar_no_superc']:
        linhas.append('<script src="js/resultados/%s"></script>' % nome)
    linhas.append(FIM + ' -->')
    return NL.join(linhas)


def _indice(m):
    return os.path.join(m['superc'], *m['indice_superc'].split('/'))


def _partes_indice(texto):
    """(antes, bloco atual, depois) ou None se os marcadores não existem."""
    i, j = texto.find(INICIO), texto.find(FIM)
    if i < 0 or j < i:
        return None
    fim = texto.index('-->', j) + 3
    return texto[:i], texto[i:fim], texto[fim:]


def _construir():
    sys.path.insert(0, AQUI)
    try:
        import construir
    finally:
        sys.path.remove(AQUI)
    return construir


def _destino_autonomo(m):
    return os.path.join(m['superc'], *m['distribuicao']['arquivo_superc'].split('/'))


def _ler_texto(caminho):
    with open(caminho, encoding='utf-8', newline='') as f:
        return f.read()


def autonomo_defasado(m):
    """None se o arquivo autônomo que o SuperC distribui é EXATAMENTE o que se constrói agora (com o mesmo carimbo);
    senão o motivo. O carimbo é o gravado no próprio arquivo: reconstruir com ele dá o mesmo texto se nada mudou."""
    if not m.get('distribuicao'):
        return None
    destino = _destino_autonomo(m)
    if not os.path.exists(destino):
        return 'o arquivo autônomo não existe em %s' % m['distribuicao']['arquivo_superc']
    c = _construir()
    atual = _ler_texto(destino)
    carimbo = c.carimbo_de(atual)
    if not carimbo:
        return 'o arquivo autônomo do SuperC não tem carimbo de geração'
    if c.construir(carimbo=carimbo) != atual:
        return 'o arquivo autônomo do SuperC está DEFASADO (núcleo, kit ou casca mudaram): rode --empurrar'
    return None


def entregar_autonomo(m):
    """Constrói o arquivo único e o põe no SuperC. Se o que já está lá é idêntico ao que se construiria (mesmo carimbo),
    não toca: a data só muda quando o conteúdo muda."""
    destino = _destino_autonomo(m)
    c = _construir()
    existe = os.path.exists(destino)
    if existe:
        atual = _ler_texto(destino)
        carimbo = c.carimbo_de(atual)
        if carimbo and c.construir(carimbo=carimbo) == atual:
            print('arquivo autônomo já em dia (carimbo %s)' % carimbo)
            return
    texto = c.construir()
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, 'w', encoding='utf-8', newline='') as f:
        f.write(texto)
    print('arquivo autônomo atualizado em %s (%.0f KB, carimbo %s)' % (m['distribuicao']['arquivo_superc'], len(texto.encode('utf-8')) / 1024.0, c.carimbo_de(texto)))


def manifesto_superc(m):
    """O que o SuperC guarda em app/js/resultados/ORIGEM.json: de onde veio e o hash de cada cópia (e do arquivo autônomo)."""
    arqs = {n: m['hashes'].get('nucleo/' + n) for n in arquivos_do_grupo(m, 'nucleo')}
    r = {'origem': 'PNADC_Resultados/nucleo (dono). Cópia: NÃO edite aqui; edite lá e rode sincronizar.py --empurrar.',
         'versao_nucleo': versao_nucleo(), 'arquivos': arqs}
    if m.get('distribuicao'):
        destino = _destino_autonomo(m)
        if os.path.exists(destino):
            r['autonomo'] = {'arquivo': m['distribuicao']['arquivo_superc'], 'sha256': sha(destino),
                             'carimbo': _construir().carimbo_de(_ler_texto(destino)), 'versao': versao_nucleo()}
    return r


def verificar(m):
    problemas, n = [], 0
    for g, gr in m['grupos'].items():
        dono_aqui = gr['dono'] == 'PNADC_Resultados'
        pa, ps = lado_aqui(m, g), lado_superc(m, g)
        if g == 'kit':
            ps = os.path.join(m['superc'], 'app')   # kit: caminhos relativos a app/ vêm em "arquivos"
        for nome in arquivos_do_grupo(m, g):
            n += 1
            reg = m['hashes'].get('%s/%s' % (g, nome))
            fa = os.path.join(pa, os.path.basename(nome))
            fs = os.path.join(ps, nome) if ps else None
            if not reg:
                problemas.append('%s/%s: nunca sincronizado' % (g, nome)); continue
            copia = fs if dono_aqui else fa
            dono = fa if dono_aqui else fs
            if not copia or not os.path.exists(copia):
                problemas.append('%s/%s: cópia ausente (%s)' % (g, nome, copia)); continue
            if sha(copia) != reg:
                problemas.append('%s/%s: a CÓPIA foi editada (edite no dono: %s)' % (g, nome, gr['dono']))
            if dono and os.path.exists(dono) and sha(dono) != reg:
                problemas.append('%s/%s: o dono mudou e a cópia está defasada' % (g, nome))
    if n == 0:
        print('nada compartilhado ainda')
        return 0
    # o index.html do SuperC e o manifesto do lado de lá
    if m.get('indice_superc') and m['grupos']['nucleo'].get('carregar_no_superc'):
        try:
            with open(_indice(m), encoding='utf-8') as f:
                partes = _partes_indice(f.read())
        except OSError as ex:
            partes = None
            problemas.append('index.html do SuperC ilegível (%s)' % ex)
        if partes is None:
            problemas.append('index.html do SuperC sem os marcadores %s ... %s' % (INICIO, FIM))
        elif partes[1] != bloco_scripts(m):
            problemas.append('o bloco de <script> do index.html do SuperC está diferente do esperado (rode --empurrar)')
        arq = os.path.join(lado_superc(m, 'nucleo'), 'ORIGEM.json')
        try:
            with open(arq, encoding='utf-8') as f:
                atual = json.load(f)
        except (OSError, ValueError):
            atual = None
        if atual != manifesto_superc(m):
            problemas.append('app/js/resultados/ORIGEM.json do SuperC ausente ou diferente (versão do núcleo %s; rode --empurrar)' % versao_nucleo())
    if m.get('distribuicao'):
        motivo = autonomo_defasado(m)
        if motivo:
            problemas.append(motivo)
    for p in problemas:
        print('FALHOU  ' + p)
    print('%d arquivo(s) compartilhado(s), %d problema(s)' % (n, len(problemas)))
    return 1 if problemas else 0


def empurrar(m):
    g = 'nucleo'
    pa, ps = lado_aqui(m, g), lado_superc(m, g)
    nomes = arquivos_do_grupo(m, g)
    if not nomes:
        print('nucleo/ vazio: nada a empurrar'); return 0
    if not os.path.isdir(os.path.dirname(ps)):
        print('FALHOU  pasta do SuperC não encontrada: ' + ps); return 1
    os.makedirs(ps, exist_ok=True)
    for nome in nomes:
        shutil.copyfile(os.path.join(pa, nome), os.path.join(ps, nome))
        m['hashes']['%s/%s' % (g, nome)] = sha(os.path.join(pa, nome))
        print('empurrado ' + nome)
    salvar(m)
    if m.get('distribuicao'):
        entregar_autonomo(m)
    with open(os.path.join(ps, 'ORIGEM.json'), 'w', encoding='utf-8', newline=NL) as f:
        json.dump(manifesto_superc(m), f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write(NL)
    print('manifesto escrito em app/js/resultados/ORIGEM.json (núcleo %s)' % versao_nucleo())
    if m.get('indice_superc'):
        with open(_indice(m), encoding='utf-8', newline='') as f:
            texto = f.read()
        partes = _partes_indice(texto)
        if partes is None:
            print('FALHOU  index.html do SuperC sem os marcadores %s ... %s: ponha-os onde os scripts devem ficar' % (INICIO, FIM))
            return 1
        quebra = CRLF if CRLF in texto else NL
        novo = partes[0] + bloco_scripts(m).replace(NL, quebra) + partes[2]
        if novo != texto:
            with open(_indice(m), 'w', encoding='utf-8', newline='') as f:
                f.write(novo)
            print('bloco de <script> do index.html do SuperC atualizado')
    return 0


def puxar_kit(m):
    g = 'kit'
    nomes = arquivos_do_grupo(m, g)
    if not nomes:
        print('kit sem arquivos listados em ORIGEM.json: nada a puxar'); return 0
    base = os.path.join(m['superc'], 'app')
    os.makedirs(lado_aqui(m, g), exist_ok=True)
    for nome in nomes:
        origem = os.path.join(base, *nome.split('/'))
        if not os.path.exists(origem):
            print('FALHOU  não existe no SuperC: ' + origem); return 1
        destino = os.path.join(lado_aqui(m, g), os.path.basename(nome))
        shutil.copyfile(origem, destino)
        m['hashes']['%s/%s' % (g, nome)] = sha(origem)
        print('puxado ' + nome)
    salvar(m)
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    x = ap.add_mutually_exclusive_group(required=True)
    x.add_argument('--verificar', action='store_true')
    x.add_argument('--empurrar', action='store_true')
    x.add_argument('--puxar-kit', action='store_true')
    a = ap.parse_args()
    m = carregar()
    sys.exit(verificar(m) if a.verificar else empurrar(m) if a.empurrar else puxar_kit(m))


if __name__ == '__main__':
    main()
