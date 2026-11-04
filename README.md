# PNADC Resultados

Os números que o IBGE divulga da **PNAD Contínua** — Brasil, Grandes Regiões e a UF escolhida — em
tabelas, gráficos e texto, com aviso de publicação nova e gerador de releases.

**Como usar (meta do projeto):** dar duplo clique em `PNADC_Resultados.html` (Edge ou Chrome).
Sem instalação, sem servidor, sem login. A primeira abertura baixa as tabelas públicas do IBGE; depois
fica tudo guardado no seu navegador.

> Estado (04/11/2026): **fases 1 a 4 feitas** — o SuperC usa este núcleo (cópia sincronizada) e oferece o arquivo pelo botão "Baixar o PNADC Resultados"; falta só a conferência por duplo clique em `file://` com uma pessoa: o arquivo `dist/PNADC_Resultados.html` existe (gerado por
> `python -I scripts/construir.py`) e funciona com dados reais do IBGE; falta conferir por duplo clique em `file://`
> (Edge e Chrome). Leia o [PLANO.md](PLANO.md).

É derivado da página **Resultados da PNADC** do SuperC PNADC (`C:\Projetos\SuperC`), e o que for
avançado aqui chega à página do SuperC pelo script `scripts/sincronizar.py` (ver o plano, seção 5).

Dados: API pública de agregados do IBGE (`servicodados.ibge.gov.br`). Nada sai do seu computador além
dos pedidos ao IBGE.
