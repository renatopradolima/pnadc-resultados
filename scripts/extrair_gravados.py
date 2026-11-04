# -*- coding: utf-8 -*-
"""Extrai as respostas reais do IBGE gravadas em 26/10/2026 (embutidas em
SuperC/scripts/teste_sidra.py) para testes/gravados/*.json. Uso único: depois
disto, as fixtures daqui são a fonte. Não usa rede."""
import ast, json, os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SUPERC = os.environ.get('SUPERC_PASTA') or os.path.join(RAIZ, '..', 'SuperC')
ORIGEM = os.path.join(SUPERC, 'scripts', 'teste_sidra.py')
NOMES = {'PER_6381': 'periodos_6381', 'PER_6468': 'periodos_6468',
         'DADOS_6381': 'dados_6381', 'DADOS_6468': 'dados_6468'}
arvore = ast.parse(open(ORIGEM, encoding='utf-8').read())
achou = {}
for no in arvore.body:
    if isinstance(no, ast.Assign) and isinstance(no.targets[0], ast.Name) and no.targets[0].id in NOMES:
        achou[no.targets[0].id] = ast.literal_eval(no.value)
faltam = set(NOMES) - set(achou)
if faltam:
    sys.exit('não achei: %s' % sorted(faltam))
os.makedirs(os.path.join(RAIZ, 'testes', 'gravados'), exist_ok=True)
for k, nome in NOMES.items():
    obj = json.loads(achou[k])
    dest = os.path.join(RAIZ, 'testes', 'gravados', nome + '.json')
    with open(dest, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(dest, os.path.getsize(dest), 'bytes')
