# PNADC Resultados — regras do projeto

Arquivo de entrada: duplo clique em `dist/PNADC_Resultados.html`. Plano completo em `PLANO.md`
(leia antes de mexer). Projeto irmão: `C:\Projetos\SuperC` (SuperC PNADC), de onde vem o código.

## Regras que não se negociam
- **Dono único por arquivo** (`ORIGEM.json`): `nucleo/` se edita AQUI; `kit/` se edita no SuperC e se
  puxa com `scripts/sincronizar.py --puxar-kit`. Nunca editar a cópia. `--verificar` falha se alguém o fez.
- **Definição de pronto** de mudança no núcleo: testes do projeto; `sincronizar.py --empurrar` e
  `--verificar`; testes do SuperC que tocam a página; conferência no navegador nos DOIS lugares
  (arquivo autônomo e `#/publicacoes` do SuperC); diários atualizados.
- **Rede**: só a API pública de agregados do IBGE; no máximo uma consulta por tabela a cada 12 h; falha
  de rede pausa 15 min; o cache nunca é apagado; testes nunca usam rede (respostas em `testes/gravados/`).
- **Sem dado pessoal, sem login, sem servidor** no produto final.
- **Cor só da situação publicada** pelo IBGE (Z significativa, A estável, `-` sem comparação); CV sempre
  à vista; trimestre móvel só Brasil; texto de dado como nó de texto, nunca HTML.
- **JavaScript sem `??` nem `?.`** (a conferência de sintaxe do projeto não os lê). Sem `node` nesta
  máquina: testes no Edge sem janela (`--headless --dump-dom`), como `SuperC/scripts/teste_releases.py`.
- Arquivo de entrada: `python -I scripts/construir.py` gera `dist/PNADC_Resultados.html` (nada de `dist/` vai ao git).
  Núcleo e páginas falam com o hospedeiro só por `FONTE` e `AMBIENTE` (ver PLANO.md §10); nunca por `fetch`, `APP`, `SESSAO`.
- Testes: `python -I testes/rodar.py` (paridade Python × JS contra o `lib_sidra.py` do SuperC, só leitura). Em
  04/11/2026 o Edge sem janela devolve vazio nesta máquina; o runner cai sozinho no Chrome.
- Código e comentários em português; nomes de arquivo sem acento.
- Fase 4 feita: `--empurrar` também constrói e entrega `SuperC/app/PNADC_Resultados.html` (botão "Baixar o PNADC Resultados"
  na página do SuperC). Mudou núcleo, kit ou casca? `--empurrar` de novo; `--verificar` acusa arquivo defasado.
- Fase 3 feita: `SuperC/app/js/resultados/` é cópia. Mudou o núcleo? `scripts/sincronizar.py --empurrar`, depois os testes
  do SuperC (`teste_releases`, `teste_sidra`, `teste_resultados_sincronia`) e a página `#/publicacoes` num servidor isolado.
- Servidor de desenvolvimento, se preciso: porta **8771** (`C:\Projetos\PORTAS.md`), nunca outra.
- Commit/push só quando o usuário pedir. Sem remoto configurado.
