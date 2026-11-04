# -*- coding: utf-8 -*-
u"""Gera nucleo/mapa_uf.js: os limites das 27 UFs, simplificados, para o mapa dos releases e da apresentação.

Uso de DESENVOLVIMENTO (o produto não busca malha na rede): baixa uma vez a malha pública de UFs do IBGE
(API de malhas, qualidade mínima), projeta (equirretangular com escala de longitude pelo cosseno de 15° S),
simplifica (Douglas-Peucker) e calcula, para cada UF, o ponto onde cabe o rótulo (polo de inacessibilidade do
maior polígono) e a área. Saída: caminhos SVG compactos, num quadro de 1000 unidades de largura.

    python -I scripts/gerar_mapa_uf.py [--arquivo malha.geojson]
"""
import argparse
import json
import math
import os
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = ('https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&qualidade=minima'
       '&formato=application/vnd.geo+json')
SIGLAS = {'11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI',
          '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES',
          '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'}
LARGURA = 1000.0
TOLERANCIA = 0.85          # unidades do quadro (~3,5 km)
ILHA_MINIMA = 5.0          # área mínima (unidades²) para um polígono entrar


def poligonos(geom):
    return geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]


def dp(pts, tol):
    """Douglas-Peucker iterativo."""
    if len(pts) < 3:
        return pts
    manter = [False] * len(pts)
    manter[0] = manter[-1] = True
    pilha = [(0, len(pts) - 1)]
    while pilha:
        a, b = pilha.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        n = math.hypot(dx, dy) or 1e-9
        mx, mi = 0.0, -1
        for i in range(a + 1, b):
            d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / n
            if d > mx:
                mx, mi = d, i
        if mx > tol:
            manter[mi] = True
            pilha.append((a, mi))
            pilha.append((mi, b))
    return [p for p, k in zip(pts, manter) if k]


def area(anel):
    s = 0.0
    for i in range(len(anel)):
        x1, y1 = anel[i]
        x2, y2 = anel[(i + 1) % len(anel)]
        s += x1 * y2 - x2 * y1
    return s / 2.0


def dentro(x, y, anel):
    r = False
    j = len(anel) - 1
    for i in range(len(anel)):
        xi, yi = anel[i]
        xj, yj = anel[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            r = not r
        j = i
    return r


def dist_borda(x, y, anel):
    m = 1e18
    for i in range(len(anel)):
        x1, y1 = anel[i]
        x2, y2 = anel[(i + 1) % len(anel)]
        dx, dy = x2 - x1, y2 - y1
        t = 0 if dx == dy == 0 else max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
        m = min(m, math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)))
    return m


def polo(anel):
    """ponto interno mais afastado da borda (grade fina + refinamento)"""
    xs = [p[0] for p in anel]
    ys = [p[1] for p in anel]
    melhor, bx, by = -1, sum(xs) / len(xs), sum(ys) / len(ys)
    passo = max(1.0, (max(xs) - min(xs)) / 40.0)
    for _ in range(3):
        x = min(xs)
        while x <= max(xs):
            y = min(ys)
            while y <= max(ys):
                if dentro(x, y, anel):
                    d = dist_borda(x, y, anel)
                    if d > melhor:
                        melhor, bx, by = d, x, y
                y += passo
            x += passo
        xs, ys = [bx - passo * 2, bx + passo * 2], [by - passo * 2, by + passo * 2]
        passo /= 4.0
    return bx, by, melhor


def caminho(aneis):
    """M absoluto no primeiro ponto, depois deslocamentos inteiros relativos (l ... z)"""
    out = []
    for a in aneis:
        pts = [(int(round(x)), int(round(y))) for x, y in a]
        ded = [pts[0]]
        for p in pts[1:]:
            if p != ded[-1]:
                ded.append(p)
        if len(ded) < 3:
            continue
        s = 'M%d %d l' % ded[0]
        s += ' '.join('%d %d' % (ded[i][0] - ded[i - 1][0], ded[i][1] - ded[i - 1][1]) for i in range(1, len(ded)))
        out.append(s + 'z')
    return ''.join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--arquivo', help='malha GeoJSON já baixada (senão baixa da API do IBGE)')
    a = ap.parse_args()
    if a.arquivo:
        with open(a.arquivo, encoding='utf-8') as f:
            dados = json.load(f)
    else:
        with urllib.request.urlopen(URL, timeout=60) as r:
            dados = json.loads(r.read().decode('utf-8'))
    feats = dados['features']
    lons = [p[0] for f in feats for poly in poligonos(f['geometry']) for anel in poly for p in anel]
    lats = [p[1] for f in feats for poly in poligonos(f['geometry']) for anel in poly for p in anel]
    lon0, lat0 = min(lons), max(lats)
    k = math.cos(math.radians(15))
    esc = LARGURA / ((max(lons) - lon0) * k)
    proj = lambda lon, lat: ((lon - lon0) * k * esc, (lat0 - lat) * esc)
    saida, altura = {}, 0.0
    for f in feats:
        sig = SIGLAS[f['properties']['codarea']]
        aneis, maior, a_tot = [], None, 0.0
        for poly in poligonos(f['geometry']):
            ext = [proj(*p) for p in poly[0]]
            ar = abs(area(ext))
            if ar < ILHA_MINIMA:
                continue
            # anel fechado: parte no ponto mais distante do primeiro e simplifica as duas metades
            m = max(range(len(ext)), key=lambda i: math.hypot(ext[i][0] - ext[0][0], ext[i][1] - ext[0][1]))
            s = dp(ext[:m + 1], TOLERANCIA)[:-1] + dp(ext[m:], TOLERANCIA)[:-1]
            aneis.append(s)
            a_tot += abs(area(s))
            if maior is None or ar > maior[0]:
                maior = (ar, s)
        px, py, raio = polo(maior[1])
        altura = max(altura, max(p[1] for s in aneis for p in s))
        saida[sig] = {'d': caminho(aneis), 'x': round(px), 'y': round(py), 'r': round(raio, 1), 'a': round(a_tot)}
    js = ("/* PNADC Resultados -- limites das 27 UFs para o mapa (releases e apresentação). GERADO por scripts/gerar_mapa_uf.py a partir da malha\n"
          "   pública de UFs do IBGE (qualidade mínima), projetada e simplificada: serve para MOSTRAR, não para medir. Dono: PNADC_Resultados.\n"
          "   Por UF: d = caminho SVG (Path2D); x, y = onde cabe o rótulo; r = raio do maior círculo que cabe (unidades); a = área (unidades²). */\n"
          "'use strict';\nconst MAPA_UF = { w: %d, h: %d, ufs: %s };\n") % (
        int(LARGURA), int(math.ceil(altura)) + 4, json.dumps(saida, separators=(',', ':'), ensure_ascii=False))
    destino = os.path.join(RAIZ, 'nucleo', 'mapa_uf.js')
    with open(destino, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print('%s: %.1f KB, 27 UFs, quadro %dx%d' % (destino, os.path.getsize(destino) / 1024.0, LARGURA, math.ceil(altura) + 4))
    print('menores áreas:', sorted((v['a'], k) for k, v in saida.items())[:8])


if __name__ == '__main__':
    main()
