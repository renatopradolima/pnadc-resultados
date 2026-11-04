# -*- coding: utf-8 -*-
u"""Monta o arquivo único dist/PNADC_Resultados.html (PLANO.md, fase 2).

Junta, nesta ordem, o CSS do kit + o da casca e os scripts: Chart.js, kit (util, glossário, gráficos), núcleo
(versão, catálogo, armazém, sidra, montar, motor de texto, páginas, alertas, assistente) e a casca. Nenhuma
requisição externa além da API do IBGE. Carimba versão e data.

Uso:  python -I scripts/construir.py [--saida CAMINHO]
"""
import argparse
import datetime
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

CSS = ['kit/superc.css', 'casca/casca.css']
# a ordem importa só para o que roda ao carregar (Chart antes de graficos.js; releases_modelos antes de releases)
SCRIPTS = ['kit/chart.umd.min.js', 'kit/util.js', 'kit/glossario.js', 'kit/graficos.js',
           'nucleo/versao.js', 'nucleo/indicadores.js', 'nucleo/armazem.js', 'nucleo/sidra.js', 'nucleo/montar.js',
           'nucleo/mapa_uf.js', 'nucleo/releases_modelos.js', 'nucleo/moldura.js', 'nucleo/pdf.js', 'nucleo/docs.js', 'nucleo/publicacoes.js', 'nucleo/novidades.js', 'nucleo/releases.js', 'nucleo/apresentacao.js',
           'casca/fonte.js', 'casca/entenda.js', 'casca/casca.js']


def ler(rel):
    with open(os.path.join(RAIZ, *rel.split('/')), encoding='utf-8') as f:
        return f.read()


def versao_nucleo():
    m = re.search(r"VERSAO_NUCLEO\s*=\s*'([^']+)'", ler('nucleo/versao.js'))
    return m.group(1) if m else '?'


def carimbo_de(texto):
    """A data de geração gravada num arquivo já construído (ou None): serve para reconstruir IDÊNTICO e comparar."""
    m = re.search(r"const CONSTRUCAO = \{ data: '([^']+)'", texto)
    return m.group(1) if m else None


def construir(agora=None, antes_de_iniciar='', carimbo=None):
    """`antes_de_iniciar`: JS extra, SÓ para os testes (rede simulada); o arquivo de produção não leva gancho."""
    agora = agora or datetime.datetime.now()
    html = ler('casca/index.html')
    css = '\n'.join(ler(c) for c in CSS)
    # um </script> dentro do código fecharia o bloco; <!-- também é perigoso dentro de <script>
    partes = []
    for s in SCRIPTS:
        partes.append('/* ===== %s ===== */\n%s' % (s, ler(s).replace('</script', '<\\/script').replace('<!--', '<\\!--')))
    data = carimbo or agora.strftime('%d/%m/%Y %H:%M')
    marca = "const CONSTRUCAO = { data: '%s', versao: '%s' };" % (data, versao_nucleo())
    js = marca + '\n' + '\n'.join(partes)
    html = html.replace('@@VERSAO@@', versao_nucleo()).replace('@@DATA@@', data)
    if '/*@@CSS@@*/' not in html or '/*@@JS@@*/' not in html:
        raise SystemExit('casca/index.html perdeu os marcadores @@CSS@@ / @@JS@@')
    # str.replace é literal: barras invertidas do código passam intactas
    html = html.replace('/*@@CSS@@*/', css).replace('/*@@JS@@*/', js)
    if antes_de_iniciar:
        html = injetar_antes_de_iniciar(html, antes_de_iniciar)
    return html


def injetar_antes_de_iniciar(html, js):
    """Põe `js` num <script> logo antes de CASCA.iniciar() (só para testes; vale também para um arquivo já construído)."""
    extra = '<script>' + js.replace('</script', '<\\/script') + '</script>\n'
    return html.replace('<script>CASCA.iniciar();</script>', extra + '<script>CASCA.iniciar();</script>')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--saida', default=os.path.join(RAIZ, 'dist', 'PNADC_Resultados.html'))
    ap.add_argument('--carimbo', help='data de geração a gravar (dd/mm/aaaa hh:mm); padrão: agora')
    a = ap.parse_args()
    texto = construir(carimbo=a.carimbo)
    os.makedirs(os.path.dirname(a.saida), exist_ok=True)
    with open(a.saida, 'w', encoding='utf-8', newline='\n') as f:
        f.write(texto)
    print('%s  %.0f KB  (núcleo %s)' % (a.saida, os.path.getsize(a.saida) / 1024.0, versao_nucleo()))


if __name__ == '__main__':
    main()
