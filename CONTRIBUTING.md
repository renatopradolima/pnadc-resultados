# Como contribuir

Obrigado por querer ajudar. Este projeto mostra os números que o IBGE divulga da PNAD Contínua em um arquivo único
(`PNADC_Resultados.html`). A regra mais importante: **os números não são calculados aqui, são os que o IBGE publica**.

## Indicar um erro ou sugerir algo

- Abra uma *issue* (há modelos para erro e para sugestão). Diga a versão que aparece no rodapé do menu e, se for um
  erro, o que você fez e o que apareceu.
- Também aceito por e-mail: `renatoprado.lima@gmail.com`.

## Rodar e testar

Precisa de Python 3.10+ e de um navegador Chromium (Chrome ou Edge). Não há `node`, nem dependências para instalar.

```bash
python -I scripts/construir.py     # gera dist/PNADC_Resultados.html
python -I testes/rodar.py          # roda a suíte (sem rede)
python -I testes/rodar.py casca    # roda só um grupo: sidra, catalogo, cenarios, montar, casca
```

Os testes **nunca usam a rede**: as respostas reais do IBGE estão gravadas em `testes/gravados/`. A paridade com a
implementação original em Python usa `testes/esperado/*.json`.

## Regras do código

- JavaScript **sem `??` nem `?.`** (a conferência de sintaxe do projeto não os lê) e sem dependências de build.
- Texto vindo de dado entra como nó de texto, nunca como HTML.
- Cor de uma variação só vem da **situação publicada** pelo IBGE (Z significativa, A estável, `-` sem comparação).
- O CV (precisão) fica sempre à vista; trimestre móvel só existe para o Brasil.
- Rede: só a API pública de agregados do IBGE, no máximo uma consulta por tabela a cada 12 h; falha de rede pausa
  15 min; o cache nunca é apagado.
- Código e comentários em português; nomes de arquivo sem acento.

## Estrutura

| Pasta | O que é |
|---|---|
| `nucleo/` | A lógica e as páginas (dados do IBGE, cache, gráficos, releases). |
| `casca/` | O que é só do arquivo autônomo: menu, rotas, UF, armazenamento. |
| `kit/` | Interface de base (utilitários, gráficos, CSS, Chart.js). |
| `scripts/` | `construir.py` (gera o arquivo único) e ferramentas do mantenedor. |
| `testes/` | Suíte, respostas gravadas e saídas de referência. |

`scripts/sincronizar.py` e a pasta `ORIGEM.json` servem só ao mantenedor, para manter uma instalação interna em
sincronia com este núcleo; quem contribui não precisa deles.
