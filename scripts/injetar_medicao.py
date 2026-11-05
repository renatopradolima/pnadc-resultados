# -*- coding: utf-8 -*-
u"""Insere a medição de acessos (Cloudflare Web Analytics) numa cópia do arquivo único, SÓ no build da página publicada.

    python -I scripts/injetar_medicao.py site/index.html <token>

- Sem token (variável CF_BEACON_TOKEN do repositório vazia): não faz nada e sai com sucesso. O padrão é NÃO medir.
- O arquivo que se distribui (dist/PNADC_Resultados.html) NUNCA passa por aqui: continua sem rastreamento e sem rede.
- O Cloudflare Web Analytics não usa cookies nem guarda dado pessoal (conta visitas, páginas e origens); o token é público (vai no HTML),
  não é segredo. O script só aceita o formato de token do Cloudflare (32 caracteres hexadecimais).
"""
import io
import re
import sys

MARCA = 'cloudflareinsights.com/beacon.min.js'


def injetar(html, token):
    token = (token or '').strip()
    if not token:
        return html, 'sem token: nada a inserir'
    if not re.fullmatch(r'[0-9a-f]{32}', token):
        raise SystemExit('token de medição inválido (esperado: 32 caracteres hexadecimais): %r' % token[:12])
    if MARCA in html:
        return html, 'a medição já estava inserida'
    # o mesmo trecho que o Cloudflare entrega ao criar o site (type=module), com o token já validado
    tag = ('<!-- Cloudflare Web Analytics --><script type=\'module\' src=\'https://static.%s\' data-cf-beacon=\'{"token": "%s"}\'></script>'
           '<!-- End Cloudflare Web Analytics -->\n') % (MARCA, token)
    i = html.rfind('</body>')
    if i < 0:
        raise SystemExit('o arquivo não tem </body>')
    return html[:i] + tag + html[i:], 'medição inserida'


def main(argv):
    if len(argv) < 2:
        raise SystemExit(__doc__)
    arq, token = argv[1], (argv[2] if len(argv) > 2 else '')
    html = io.open(arq, encoding='utf-8', newline='').read()
    novo, msg = injetar(html, token)
    if novo != html:
        io.open(arq, 'w', encoding='utf-8', newline='').write(novo)
    print('%s: %s' % (arq, msg))


if __name__ == '__main__':
    main(sys.argv)
