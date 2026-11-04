/* PNADC Resultados -- catálogo de indicadores e escala de precisão.
   Porte de SuperC/scripts/lib_sidra.py (INDICADORES, SITUACAO, PRECISAO_CV). Dono: PNADC_Resultados.

   `vars` de cada família: valor, cv, var_curta (x período anterior), sit_curta, var_ano (x mesmo período
   do ano anterior), sit_ano. `sentido`: +1 subir é desejável, -1 cair é desejável, 0 sem juízo. A cor da
   tela só usa o sentido quando a SITUAÇÃO publicada diz que a variação é significativa. `unidade_var`:
   nas TAXAS é ponto percentual mesmo quando a API diz "%". Família móvel: só Brasil (N1).
   Sem `??` nem `?.`. */
'use strict';

const INDICADORES_CATALOGO = (() => {
  const INDICADORES = [
    {
      "id": "desocupacao",
      "rotulo": "Taxa de desocupação",
      "curto": "desocupação",
      "unidade": "%",
      "unidade_var": "p.p.",
      "tipo": "taxa",
      "sentido": -1,
      "casas": 1,
      "definicao": "Pessoas desocupadas (sem trabalho, que tomaram providência para consegui-lo e estavam disponíveis) em % das pessoas na força de trabalho, 14 anos ou mais.",
      "movel": {
        "tabela": "6381",
        "valor": "4099",
        "cv": "4103",
        "var_curta": "8811",
        "sit_curta": "8814",
        "var_ano": "8816",
        "sit_ano": "8819",
        "niveis": [
          "N1"
        ]
      },
      "trimestral": {
        "tabela": "6468",
        "valor": "4099",
        "cv": "4103",
        "var_curta": "9402",
        "sit_curta": "9130",
        "var_ano": "9405",
        "sit_ano": "9131",
        "niveis": [
          "N1",
          "N2",
          "N3",
          "N6",
          "N7"
        ]
      }
    },
    {
      "id": "ocupacao",
      "rotulo": "Nível da ocupação",
      "curto": "nível da ocupação",
      "unidade": "%",
      "unidade_var": "p.p.",
      "tipo": "taxa",
      "sentido": 1,
      "casas": 1,
      "definicao": "Pessoas ocupadas em % das pessoas de 14 anos ou mais de idade.",
      "movel": {
        "tabela": "6379",
        "valor": "4097",
        "cv": "4101",
        "var_curta": "8789",
        "sit_curta": "8792",
        "var_ano": "8794",
        "sit_ano": "8797",
        "niveis": [
          "N1"
        ]
      },
      "trimestral": {
        "tabela": "6466",
        "valor": "4097",
        "cv": "4101",
        "var_curta": "9390",
        "sit_curta": "9126",
        "var_ano": "9393",
        "sit_ano": "9127",
        "niveis": [
          "N1",
          "N2",
          "N3"
        ]
      }
    },
    {
      "id": "participacao",
      "rotulo": "Taxa de participação na força de trabalho",
      "curto": "participação",
      "unidade": "%",
      "unidade_var": "p.p.",
      "tipo": "taxa",
      "sentido": 0,
      "casas": 1,
      "definicao": "Pessoas na força de trabalho (ocupadas + desocupadas) em % das pessoas de 14 anos ou mais.",
      "movel": {
        "tabela": "5944",
        "valor": "4096",
        "cv": "4100",
        "var_curta": "8778",
        "sit_curta": "8781",
        "var_ano": "8783",
        "sit_ano": "8786",
        "niveis": [
          "N1"
        ]
      },
      "trimestral": {
        "tabela": "6461",
        "valor": "4096",
        "cv": "4100",
        "var_curta": "9384",
        "sit_curta": "9124",
        "var_ano": "9387",
        "sit_ano": "9125",
        "niveis": [
          "N1",
          "N2",
          "N3"
        ]
      }
    },
    {
      "id": "informalidade",
      "rotulo": "Taxa de informalidade",
      "curto": "informalidade",
      "unidade": "%",
      "unidade_var": "p.p.",
      "tipo": "taxa",
      "sentido": -1,
      "casas": 1,
      "definicao": "Ocupados sem carteira (setor privado e doméstico), empregadores e conta própria sem CNPJ e trabalhador familiar auxiliar, em % dos ocupados. Série desde o fim de 2015.",
      "movel": {
        "tabela": "8513",
        "valor": "12466",
        "cv": "12467",
        "var_curta": "12468",
        "sit_curta": "12469",
        "var_ano": "12470",
        "sit_ano": "12471",
        "niveis": [
          "N1"
        ]
      },
      "trimestral": {
        "tabela": "8529",
        "valor": "12466",
        "cv": "12467",
        "var_curta": "12517",
        "sit_curta": "12518",
        "var_ano": "12519",
        "sit_ano": "12520",
        "niveis": [
          "N1",
          "N2",
          "N3"
        ]
      }
    },
    {
      "id": "subutilizacao",
      "rotulo": "Taxa composta de subutilização",
      "curto": "subutilização",
      "unidade": "%",
      "unidade_var": "p.p.",
      "tipo": "taxa",
      "sentido": -1,
      "casas": 1,
      "definicao": "Desocupados + subocupados por insuficiência de horas + força de trabalho potencial, em % da força de trabalho ampliada.",
      "movel": {
        "tabela": "6441",
        "valor": "4118",
        "cv": "4119",
        "var_curta": "8659",
        "sit_curta": "8662",
        "var_ano": "8663",
        "sit_ano": "8666",
        "niveis": [
          "N1"
        ]
      },
      "trimestral": {
        "tabela": "6485",
        "valor": "4118",
        "cv": "4119",
        "var_curta": "9376",
        "sit_curta": "9379",
        "var_ano": "9380",
        "sit_ano": "9383",
        "niveis": [
          "N1",
          "N2",
          "N3"
        ]
      }
    },
    {
      "id": "desalento",
      "rotulo": "Percentual de desalentados",
      "curto": "desalento",
      "unidade": "%",
      "unidade_var": "p.p.",
      "tipo": "taxa",
      "sentido": -1,
      "casas": 1,
      "definicao": "Pessoas desalentadas (queriam trabalhar, estavam disponíveis, mas não procuraram por achar que não conseguiriam) em % da força de trabalho mais os desalentados.",
      "movel": {
        "tabela": "6807",
        "valor": "9869",
        "cv": "9870",
        "var_curta": "9871",
        "sit_curta": "9874",
        "var_ano": "9875",
        "sit_ano": "9878",
        "niveis": [
          "N1"
        ]
      },
      "trimestral": {
        "tabela": "6813",
        "valor": "9869",
        "cv": "9870",
        "var_curta": "9919",
        "sit_curta": "9922",
        "var_ano": "9923",
        "sit_ano": "9926",
        "niveis": [
          "N1",
          "N2",
          "N3"
        ]
      }
    },
    {
      "id": "rendimento",
      "rotulo": "Rendimento médio real habitual",
      "curto": "rendimento médio real",
      "unidade": "R$",
      "unidade_var": "%",
      "tipo": "rendimento",
      "sentido": 1,
      "casas": 0,
      "definicao": "Rendimento médio mensal real, habitualmente recebido em todos os trabalhos, das pessoas ocupadas com rendimento (a preços do último período). A variação é percentual.",
      "movel": {
        "tabela": "6390",
        "valor": "5933",
        "cv": "5941",
        "var_curta": "8832",
        "sit_curta": "8836",
        "var_ano": "8837",
        "sit_ano": "8841",
        "niveis": [
          "N1"
        ]
      },
      "trimestral": {
        "tabela": "6472",
        "valor": "5933",
        "cv": "5941",
        "var_curta": "9142",
        "sit_curta": "9146",
        "var_ano": "9147",
        "sit_ano": "9151",
        "niveis": [
          "N1",
          "N2",
          "N3",
          "N6",
          "N7"
        ]
      }
    },
    {
      "id": "ocupados",
      "rotulo": "Pessoas ocupadas",
      "curto": "pessoas ocupadas",
      "unidade": "mil pessoas",
      "unidade_var": "%",
      "tipo": "contagem",
      "sentido": 1,
      "casas": 0,
      "definicao": "Pessoas de 14 anos ou mais ocupadas na semana de referência, em mil pessoas. A variação é percentual.",
      "movel": {
        "tabela": "6320",
        "valor": "4090",
        "cv": "4091",
        "var_curta": "8430",
        "sit_curta": "8434",
        "var_ano": "8435",
        "sit_ano": "8439",
        "niveis": [
          "N1"
        ]
      },
      "trimestral": {
        "tabela": "6459",
        "valor": "4090",
        "cv": "4091",
        "var_curta": "9112",
        "sit_curta": "9116",
        "var_ano": "9117",
        "sit_ano": "9121",
        "niveis": [
          "N1",
          "N2",
          "N3"
        ]
      }
    }
  ];

  const PRECISAO_CV = [[5, "ótima"], [15, "boa"], [30, "razoável"], [50, "pouco precisa"], [null, "imprecisa"]];

  const FONTE_LEGENDA = "Símbolos: legenda oficial das tabelas do SIDRA (sidra.ibge.gov.br). Situação da variação: o SIDRA só diz \"A a Z (exceto X): faixa de valores, varia em função da tabela\"; a nota técnica 06/2021 e o Quadro Sintético da PNADC usam Estável / Cresceu / Decresceu por teste de hipóteses. A leitura 'A' = estável e 'Z' = significativa (sentido pelo sinal) foi conferida nos dados em 26/10/2026, nas 16 tabelas: variação 0,0 é sempre 'A', salvo um caso de arredondamento em 30.884; '-' = sem comparação. Nível de confiança: 95%. Precisão pelo CV, escala do IBGE: até 5% ótima, 5-15% boa, 15-30% razoável, 30-50% pouco precisa, acima de 50% imprecisa.";

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
