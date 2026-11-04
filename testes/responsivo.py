# -*- coding: utf-8 -*-
"""Responsividade: a casca em celular, tablet, notebook e tela grande. Em cada tamanho, cada página
(seções de Resultados, Comparar períodos, Gerar release, Sobre) não pode ter rolagem horizontal, nem
elemento (fora de áreas rolantes e do canvas) passando da largura da janela, e os cartões têm de caber."""
import json
import sys

from casca import JS_REDE

TAMANHOS = [('celular', '390,844'), ('tablet', '820,1180'), ('notebook', '1366,768'), ('tela grande', '2200,1200')]

PAGINAS = ['#/publicacoes?sec=brasil', '#/publicacoes?sec=regioes', '#/publicacoes?sec=uf&ind=desocupacao', '#/publicacoes?sec=capitais',
           '#/publicacoes?sec=comparar', '#/publicacoes?sec=release&passo=1', '#/publicacoes?sec=release&passo=10', '#/entenda', '#/sobre']

JS_ROTEIRO = r"""
(function () {
  const R = { paginas: {}, largura: window.innerWidth };
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const PAGINAS = __PAGINAS__;
  // dentro de área rolante (tabela larga, abas) o transbordo é esperado
  const rolante = e => { for (let p = e; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return true; } return false; };
  function medir(h) {
    const W = document.documentElement.clientWidth, fora = [];
    document.querySelectorAll('#conteudo *, .topo *, #nav *').forEach(e => {
      const dt = e.closest('details');
      if ((dt && !dt.open && e.tagName !== 'SUMMARY' && !e.closest('summary')) || e.closest('svg') || e.tagName === 'CANVAS' || e.closest('#tip-nav') || getComputedStyle(e).position === 'fixed') return;
      const b = e.getBoundingClientRect();
      if (b.width > 0 && b.right > W + 1 && !rolante(e)) fora.push(e.tagName + '.' + String(e.className).slice(0, 24) + ':' + Math.round(b.right) + ' w' + Math.round(b.width) + ' em ' + e.parentElement.tagName + '.' + String(e.parentElement.className).slice(0, 24) + ' "' + (e.innerText || '').slice(0, 40).replace(/\s+/g, ' ') + '"');
    });
    const k = Array.from(document.getElementById('conteudo').children).filter(e => e.getBoundingClientRect().height > 0), sobre = [];
    for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const p = k[i].getBoundingClientRect(), q = k[j].getBoundingClientRect();
      if (Math.min(p.right, q.right) - Math.max(p.left, q.left) > 2 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 2) sobre.push(i + 'x' + j); }
    if (sobre.length) fora.push('SOBREPOSTOS ' + sobre.join(','));
    R.paginas[h] = { W: W, sw: document.documentElement.scrollWidth, conteudo: Math.round(document.getElementById('conteudo').getBoundingClientRect().width),
                     cartoes: document.querySelectorAll('#conteudo .mo-cartao').length, fora: fora.slice(0, 6) };
  }
  (async function () {
    await espera(15000);
    for (const h of PAGINAS) { location.hash = h; await espera(900); medir(h); }
    // sem UF em destaque (ranking das 27 UFs): os cartões também não podem se sobrepor
    const su = document.getElementById('seletor-uf'); su.value = ''; su.dispatchEvent(new Event('change')); await espera(3500);
    for (const h of PAGINAS.slice(0, 5)) { location.hash = h; await espera(1500); medir('(sem UF) ' + h); }
  })().catch(e => { R.FALHA = String(e && e.stack || e); }).then(() => {
    const pre = document.createElement('pre'); pre.id = '__res'; pre.textContent = '<<<' + JSON.stringify(R) + '>>>'; document.body.append(pre);
  });
})();
""".replace('__PAGINAS__', json.dumps(PAGINAS))


def teste_responsivo(ctx):
    import html as H
    sys.path.insert(0, ctx.AQUI + '/../scripts')
    import construir
    sys.path.pop(0)
    gancho = 'try {' + JS_REDE + '} catch (e) { document.title = "REDE: " + e.stack; }\n' + JS_ROTEIRO
    html = construir.construir(antes_de_iniciar=gancho)
    for nome, janela in TAMANHOS:
        dom = ctx.rodar_no_edge(html, timeout=300, virtual_ms=120000, janela=janela)
        if not dom:
            ctx.confere(False, 'responsivo %s: o navegador não devolveu nada' % nome)
            continue
        i, j = dom.find('&lt;&lt;&lt;'), dom.rfind('&gt;&gt;&gt;')
        if i < 0 or j < i:
            ctx.confere(False, 'responsivo %s: o roteiro não terminou' % nome)
            continue
        r = json.loads(H.unescape(dom[i + 12:j]))
        ctx.confere(not r.get('FALHA'), 'responsivo %s: roteiro sem exceção (%s)' % (nome, r.get('FALHA')))
        for h, m in sorted((r.get('paginas') or {}).items()):
            ctx.confere(m['sw'] <= m['W'] + 1 and not m['fora'],
                        'responsivo %s (%d px) %s: sem rolagem horizontal (rolagem %d, janela %d, fora: %s)' % (nome, r.get('largura', 0), h, m['sw'], m['W'], m['fora']))
            ctx.confere(m['conteudo'] <= m['W'], 'responsivo %s %s: o conteúdo cabe na janela (%d de %d)' % (nome, h, m['conteudo'], m['W']))
        ctx.confere(len(r.get('paginas') or {}) == len(PAGINAS) + 5, 'responsivo %s: todas as páginas foram medidas' % nome)
