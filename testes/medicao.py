# -*- coding: utf-8 -*-
u"""Medição de acessos só na página publicada: o script de inserção, o workflow e a garantia de que o arquivo distribuído não rastreia nada."""
import os
import re
import sys


def teste_medicao(ctx):
    sys.path.insert(0, os.path.join(ctx.AQUI, '..', 'scripts'))
    import injetar_medicao as IM
    import construir
    sys.path.pop(0)
    token = '0123456789abcdef0123456789abcdef'
    base = '<!doctype html><html><body><p>oi</p></body></html>'
    novo, msg = IM.injetar(base, token)
    ctx.confere(novo.count('beacon.min.js') == 1 and novo.index('beacon.min.js') < novo.rindex('</body>') and token in novo and 'data-cf-beacon' in novo, 'medição: o token entra uma vez, antes de </body>')
    ctx.confere(IM.injetar(novo, token)[0] == novo, 'medição: inserir de novo não duplica')
    ctx.confere(IM.injetar(base, '')[0] == base and IM.injetar(base, '   ')[0] == base, 'medição: sem token não muda nada (o padrão é não medir)')
    ruim = 0
    for t in ('abc', 'G-XXXXXXXXXX', token + '0', token.upper() + 'Z', '"><script>x</script>'):
        try:
            IM.injetar(base, t)
        except SystemExit:
            ruim += 1
    ctx.confere(ruim == 5, 'medição: token fora do formato é recusado (nada de texto livre no HTML)')
    html = construir.construir()
    ctx.confere(not re.search(r'cloudflareinsights|googletagmanager|google-analytics|gtag\(', html), 'medição: o arquivo distribuído NÃO tem nenhum código de rastreamento')
    wf = open(os.path.join(ctx.AQUI, '..', '.github', 'workflows', 'pages.yml'), encoding='utf-8').read()
    ctx.confere('injetar_medicao.py site/index.html' in wf and 'vars.CF_BEACON_TOKEN' in wf,
                'medição: o workflow só mede a cópia do Pages (site/index.html), com a variável CF_BEACON_TOKEN')
    ctx.confere('dist/' not in wf.split('injetar_medicao.py')[1].split('\n')[0], 'medição: o workflow nunca aponta o script para dist/')
