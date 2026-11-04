# PNADC Resultados

Os números que o **IBGE divulga da PNAD Contínua** — Brasil, Grandes Regiões, UF, capital e região metropolitana — num
arquivo só (`PNADC_Resultados.html`): abra com duplo clique no Edge ou no Chrome. Sem instalação, sem servidor, sem login.

- **Resultados** com a significância publicada de cada variação e o CV sempre à vista; escolha da UF em destaque (ou nenhuma)
  e da publicação em análise (por padrão a última).
- Gráficos e tabelas em **tela cheia**, exportáveis em **JPG**, com **slider de período** e alternância entre quantidade e
  percentual onde faz sentido. **Comparar períodos**, **Capital e RM**, **mapa das UFs**.
- **Apresentar** (slides em tela cheia) e **PDF** do relatório; **gerador de releases** (texto, imagens, HTML, PDF, Word e OpenDocument).
- Aviso de publicação nova do IBGE. Os dados vêm direto da API pública de agregados do IBGE (SIDRA) e ficam guardados no
  seu navegador; nada sai do seu computador além dos pedidos ao IBGE.

Este programa não é um produto oficial do IBGE. Licença [MIT](LICENSE).

## Desenvolvimento

```bash
python -I scripts/construir.py   # gera dist/PNADC_Resultados.html
python -I testes/rodar.py        # suíte (sem rede)
```

Veja [CONTRIBUTING.md](CONTRIBUTING.md), [PLANO.md](PLANO.md) e [docs/PUBLICAR_NO_GITHUB.md](docs/PUBLICAR_NO_GITHUB.md).
Dados do IBGE: <https://sidra.ibge.gov.br/>. Avisos de terceiros: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

**Erros e sugestões:** abra uma *issue* ou escreva para renatoprado.lima@gmail.com.
