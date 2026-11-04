# -*- coding: utf-8 -*-
"""Gera nucleo/indicadores.js a partir do catálogo de SuperC/scripts/lib_sidra.py (uso único: depois disto o
catálogo é editado AQUI, em indicadores.js; o teste de paridade acusa divergência com o Python)."""
import json, os, sys
sys.path.insert(0, r'C:\Projetos\SuperC\scripts')
import lib_sidra as L
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def j(x, ind=2):
    return json.dumps(x, ensure_ascii=False, indent=ind)
inds = json.loads(json.dumps(L.INDICADORES, ensure_ascii=False))
corpo = u"""/* PNADC Resultados -- catálogo de indicadores e escala de precisão.
   Porte de SuperC/scripts/lib_sidra.py (INDICADORES, SITUACAO, PRECISAO_CV). Dono: PNADC_Resultados.

   `vars` de cada família: valor, cv, var_curta (x período anterior), sit_curta, var_ano (x mesmo período
   do ano anterior), sit_ano. `sentido`: +1 subir é desejável, -1 cair é desejável, 0 sem juízo. A cor da
   tela só usa o sentido quando a SITUAÇÃO publicada diz que a variação é significativa. `unidade_var`:
   nas TAXAS é ponto percentual mesmo quando a API diz "%". Família móvel: só Brasil (N1).
   Sem `??` nem `?.`. */
'use strict';

const INDICADORES_CATALOGO = (() => {
  const INDICADORES = @@IND@@;

  const PRECISAO_CV = @@CV@@;

  const FONTE_LEGENDA = @@LEG@@;

  const FAMILIAS = ['movel', 'trimestral'];

  /* [{ tabela, familia, espec }] -- uma por tabela do SIDRA, na ordem do catálogo */
  function tabelas() {
    const out = [];
    INDICADORES.forEach(ind => FAMILIAS.forEach(f => out.push({ tabela: ind[f].tabela, familia: f, espec: ind[f] })));
    return out;
  }

  /* classe de precisão pelo CV, na escala do IBGE (nenhum corte próprio); null se não há CV */
  function classePrecisao(cv) {
    if (cv === null || cv === undefined || isNaN(cv)) return null;
    for (let i = 0; i < PRECISAO_CV.length; i++) {
      const a = PRECISAO_CV[i][0];
      if (a === null || cv <= a) return PRECISAO_CV[i][1];
    }
    return null;
  }

  return { INDICADORES, PRECISAO_CV, FONTE_LEGENDA, FAMILIAS, tabelas, classePrecisao };
})();
"""
NL = chr(10)
corpo = (corpo.replace('@@IND@@', j(inds).replace(NL, NL + '  ')).replace('@@CV@@', j([list(x) for x in L.PRECISAO_CV], None))
         .replace('@@LEG@@', json.dumps(L.FONTE_LEGENDA, ensure_ascii=False)))
with open(os.path.join(RAIZ, 'nucleo', 'indicadores.js'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(corpo)
print(len(corpo), 'bytes')
