# PNADC Resultados — plano do projeto autônomo

Criado em 04/11/2026. Derivado da página **Resultados da PNADC** do SuperC PNADC
(`C:\Projetos\SuperC`, `#/publicacoes`) e do **gerador de releases** que mora ao lado dela.

## 1. O que é e para quem

Um arquivo só — `PNADC_Resultados.html` — que qualquer pessoa abre com duplo clique (Edge ou Chrome),
sem instalar nada, sem servidor, sem login e sem dado do SIGC. Ele busca na API pública do IBGE
(`servicodados.ibge.gov.br`, a base do SIDRA) os números que o IBGE **divulga** da PNAD Contínua e
mostra Brasil, Grandes Regiões e a UF escolhida, com tabelas, gráficos e texto; avisa quando sai
publicação nova; e gera releases (texto, imagem, tabela) com o assistente de 10 passos.

Quem usa: a equipe do IBGE-RO que prepara divulgação local; colegas de outras UFs; imprensa e
gestores que recebam o arquivo. Não há dado pessoal nem dado de coleta: tudo é público.

## 2. Por que é viável (conferido em 04/11/2026)

| Pergunta | Resposta medida |
|---|---|
| O navegador consegue falar com o IBGE direto? | Sim: a API responde `Access-Control-Allow-Origin: *`, inclusive a partir de `file://` (origem `null`). Não precisa de servidor. |
| Quanto código já existe? | `publicacoes.js` 48 KB, `releases.js` 73 KB, `releases_modelos.js` 117 KB (motor de texto puro), `lib_sidra.py` 43 KB (a camada de dados, hoje em Python). |
| O que depende do SIGC? | Nada disso. `contexto_pnadc.js` (UF × coleta) e as "análises novas" da Leitura gerencial dependem e **ficam só no SuperC**. |
| O que falta? | Trocar o Python por JavaScript (rede, cache, `montar`), uma casca mínima (abas, UF, avisos) e o empacotamento em arquivo único. |
| Há testes que sirvam de rede de segurança? | `teste_sidra.py` (92 verificações, respostas reais gravadas), `teste_releases.py` (85, motor no Edge sem janela), `teste_contexto_pnadc.py`. As respostas gravadas viram *fixtures* deste projeto. |

## 3. Decisões tomadas (podem ser revistas)

1. **Pasta e nome**: `C:\Projetos\PNADC_Resultados`, produto "PNADC Resultados".
2. **Sem servidor**: a camada de dados roda no navegador. Cache em IndexedDB (com `localStorage` e
   memória como reserva). Servidor só para desenvolvimento, opcional (porta 8771, reservada na tabela de portas do mantenedor).
3. **JavaScript é a fonte única da lógica de dados.** O `lib_sidra.py` do SuperC vira legado depois de
   provada a paridade (fase 3) — manter duas implementações é o jeito de as páginas divergirem.
4. **Dono por arquivo** (seção 5): cada arquivo tem UM lugar onde se edita; o outro lado só recebe cópia.
5. **UF**: nasce com Rondônia, mas com seletor das 27 UFs (a API já traz todas).
6. **Navegador**: Edge e Chrome. Firefox e Safari têm restrições de armazenamento em `file://`; o
   arquivo avisa e segue só com memória.
7. **Atualização do arquivo**: o SuperC passa a oferecer o arquivo mais novo (fase 4); fora dele, troca-se
   o arquivo. O arquivo mostra versão e data de geração.

## 4. Arquitetura

```
PNADC_Resultados/
  nucleo/        código NOSSO (dono: este projeto) -- é o que o SuperC recebe
    sidra.js            rede + normalização + cache + limites  (porte de lib_sidra.py)
    indicadores.js      catálogo de tabelas/variáveis, IMPLICA, escala de precisão, legendas
    armazem.js          interface do cache + adaptador IndexedDB/localStorage/memória
    montar.js           montar() e novidades(): funções puras sobre o cache
    publicacoes.js      a página Resultados (hoje app/js/publicacoes.js)
    releases_modelos.js motor de texto (puro)
    releases.js         assistente, alertas e exportações
  kit/           cópia do "kit de interface" do SuperC (dono: SuperC) -- util.js, graficos.js,
                 infra.js, glossario.js, superc.css (recorte), vendor/chart.umd.min.js
  casca/         só do autônomo: index.html, casca.js (roteador de 3 abas, seletor de UF,
                 estado "atualizando", toasts, rodapé de fonte e versão), estilos próprios
  scripts/       sincronizar.py (a ponte com o SuperC), construir.py (arquivo único), conferir.py
  testes/        rodar.py (Edge sem janela, como teste_releases.py) + gravados/ (respostas reais do IBGE)
  dist/          PNADC_Resultados.html (gerado, fora do git)
  docs/          GUIA_JORNALISMO_RELEASES.md (cópia, dono: SuperC até a fase 3) e notas
```

**Interface entre a página e a fonte de dados** (o que torna a mesma página servir aos dois lados):

```
FONTE = {
  uf(),                        -> { codigo, sigla, nome }
  carregar({forcar}) -> Promise<D>   // D = o mesmo JSON de hoje (/api/publicacoes)
  novidades()        -> Promise<resumo>
  atualizar()        -> Promise<estado>   // única operação que fala com o IBGE
}
```
- Autônomo: `FONTE` = núcleo JS + IndexedDB, direto no IBGE.
- SuperC: `FONTE` = adaptador sobre `/api/publicacoes` enquanto o Python existir; depois, o mesmo
  núcleo JS (o SuperC já tem armazenamento próprio). A página não muda nos dois casos.

**Regras herdadas e que não mudam** (estão no cabeçalho de `publicacoes.js` e no guia): cor só da
*situação* publicada (Z significativa, A estável, `-` sem comparação); CV sempre à vista com a escala
do IBGE; trimestre móvel só Brasil; texto de dado como nó de texto (nunca HTML); "falar com a rede o
mínimo": no máximo uma consulta por tabela a cada 12 h, falha pausa 15 min, o cache nunca é apagado,
período novo entra sozinho; sem `??` nem `?.` (a conferência de sintaxe do projeto não os lê).

## 5. Como o SuperC fica sempre atualizado (o requisito central)

**Manifesto `ORIGEM.json`** (neste projeto): cada arquivo compartilhado, seu dono, destino e sha256.

| Arquivo | Dono (único lugar onde se edita) | Quem recebe cópia |
|---|---|---|
| `nucleo/*.js` | **PNADC_Resultados** | SuperC em `app/js/resultados/` |
| `kit/util.js`, `graficos.js`, `infra.js`, `glossario.js`, CSS, Chart.js | **SuperC** | PNADC_Resultados em `kit/` |
| `GUIA_JORNALISMO_RELEASES.md` | SuperC (até a fase 3) | PNADC_Resultados em `docs/` |

**`scripts/sincronizar.py`** (um script, três modos):
- `--empurrar` copia `nucleo/` para o SuperC e acerta os `<script>` do `index.html` e a lista do pacote;
- `--puxar-kit` traz o kit de interface do SuperC para `kit/`;
- `--verificar` compara hashes e **falha** se alguém editou a cópia em vez do dono.

**Quando roda:** (a) ao fim de toda mudança no núcleo (item da "definição de pronto"); (b) no teste
`SuperC/scripts/teste_resultados_sincronia.py`; (c) no `lib_atualizacao.planejar_publicacao` do SuperC,
que **recusa publicar** versão com cópia defasada — o mesmo mecanismo da "sétima porta".

**Definição de pronto de qualquer mudança no núcleo:**
1. testes do projeto passam (`testes/rodar.py`);
2. `sincronizar.py --empurrar` + `--verificar` limpos;
3. testes do SuperC que tocam a página passam (`teste_releases.py`, `teste_sidra.py` enquanto existir);
4. a página `#/publicacoes` do SuperC conferida no navegador (servidor isolado) e o arquivo
   autônomo conferido por duplo clique;
5. `CLAUDE.md` do SuperC e deste projeto atualizados.

**Número de versão do núcleo** (`VERSAO_NUCLEO`) aparece nos dois: no rodapé do arquivo autônomo e no
da página do SuperC — dá para ver de relance se estão alinhados.

**O que é só do SuperC e fica fora do núcleo** (marcado com `AMBIENTE.superc`): alerta na tela inicial e
selo no menu, "análises novas" da Leitura gerencial, rascunhos por login, `contexto_pnadc.js`.

## 6. Fases

Tamanho: P = uma sessão curta, M = uma sessão, G = mais de uma.

### Fase 0 — Fundação (P) · *parte feita em 04/11/2026*
Pasta, plano, regras, repositório local, porta reservada. **Pendente dentro da fase:** extrair as
respostas gravadas de `teste_sidra.py` para `testes/gravados/*.json`; escrever `ORIGEM.json` e o
esqueleto de `sincronizar.py`.
*Aceite:* `sincronizar.py --verificar` roda e diz "nada compartilhado ainda".

### Fase 1 — Núcleo de dados em JavaScript (G)
Porte de `lib_sidra.py` para `sidra.js` + `montar.js` + `armazem.js`: lista de tabelas, períodos,
blocos de variáveis × localidades, normalização dos símbolos do SIDRA (`-`, `..`, `...`, `X`),
conferência do download, estado de consultas (12 h, pausa de 15 min, Retry-After), `montar`,
`novidades`, atualização por *evento* (abrir a página com cache vencido ou botão).
*Aceite (teste de paridade):* com as mesmas respostas gravadas, `montar` em JS e `montar` em Python
geram **o mesmo JSON** (comparação campo a campo, tolerância zero); nenhuma chamada de rede nos testes.
*Risco:* arredondamento e ordem de chaves; o teste de paridade existe para isso.

### Fase 2 — Casca autônoma e arquivo único (M)
`index.html` + `casca.js` (3 abas: Resultados, Releases, Sobre; seletor de UF; estado
"atualizando…"; mensagem clara de armazenamento indisponível) e `construir.py`, que concatena CSS,
JS, Chart.js e o núcleo em **um** `dist/PNADC_Resultados.html` (~1,5 MB), sem requisição externa além
do IBGE. Páginas e releases consomem a interface `FONTE`.
*Aceite:* duplo clique no arquivo, sem internet → abre e mostra o último cache (ou diz que não há);
com internet → baixa as 16 tabelas (≈3 min na primeira vez, com barra de progresso), mostra Brasil,
Regiões e UF, gera um release e exporta texto, PNG, HTML e CSV; zero erro de console; conferido em
Edge e em Chrome, em tela larga e em 375 px.

### Fase 3 — O SuperC passa a consumir o núcleo (M)
`sincronizar.py --empurrar` leva `nucleo/` para `SuperC/app/js/resultados/`; as páginas do SuperC
deixam de ter cópia própria; adaptador `FONTE` sobre o servidor. Entra o teste
`teste_resultados_sincronia.py` e a recusa de publicação com cópia defasada. Depois de **dois ciclos
mensais de publicação do IBGE** com paridade verde, decide-se aposentar `lib_sidra.py`, as rotas
`/api/publicacoes*` e a migração 10 (o cache do SuperC passa a ser o do núcleo).
*Aceite:* página do SuperC idêntica à de hoje (comparação de tela e de dados), alertas da tela inicial
intactos, versão do núcleo igual nos dois lados.

### Fase 4 — Distribuição (P)
Botão "Baixar o PNADC Resultados" na página do SuperC (e o arquivo dentro do pacote portátil).
`construir.py` carimba versão e data. Instruções de uma linha no topo do arquivo.
*Aceite:* um colega sem o SuperC recebe o arquivo, abre e usa.

### Fase 5 — Evolução própria (aberta)
Itens candidatos, a decidir depois de uso real: capitais e regiões metropolitanas, modo apresentação
(tela cheia, fonte maior), PDF direto, comparação de dois períodos arbitrários, outras pesquisas do
IBGE na mesma casca (PNAD Contínua trimestral já cobre o essencial). Tudo que nascer aqui entra pelo
mesmo ciclo da seção 5.

## 7. Testes

- Sem `node` nesta máquina: motor e páginas rodam no Edge sem janela (`--headless --dump-dom`), como em
  `teste_releases.py`. `testes/rodar.py` reaproveita esse esqueleto.
- Rede: **nunca** nos testes. Respostas reais gravadas em `testes/gravados/`.
- Paridade Python × JS na fase 1 e 3; depois da aposentadoria do Python, a fixture é o árbitro.
- Verificação final sempre por duplo clique no arquivo gerado, não só pela pasta de desenvolvimento.

## 8. Riscos e como tratar

| Risco | Tratamento |
|---|---|
| API do IBGE mudar ou sair do ar | Cache nunca é apagado; página mostra "dados de <data>"; erro de rede pausa 15 min. |
| CORS deixar de valer | Hoje `*`. Se mudar, o plano B é um proxy mínimo local (o SuperC já faz isso) — a interface `FONTE` já o comporta. |
| Muitas máquinas consultando o IBGE | Mesmo limite (12 h/tabela, 1–2 requisições em paralelo), `Retry-After` respeitado, sem chave. |
| Armazenamento em `file://` instável | IndexedDB → `localStorage` → memória, com aviso; exportar/importar cache em arquivo (fase 5). |
| Divergência entre SuperC e autônomo | Seção 5: dono único, `--verificar` e recusa na publicação. |
| Arquivo grande demais | ~1,5 MB (Chart.js 200 KB + 330 KB de código + CSS recortado). Folgado. |
| Texto do release publicado errado | As travas do guia (§12.8) continuam bloqueando exportação; nada muda. |

## 9. O que este projeto **não** faz

Não lê relatório do SIGC, não guarda dado de morador ou de coleta, não tem login nem perfis, não
substitui a Leitura gerencial nem o prognóstico (são do SuperC), não publica nada sozinho na internet,
não contorna a verificação anti-robô do SIDRA (só usa a API de agregados).

## 10. Estado e próximo passo

**Feito em 04/11/2026**
- Fase 0 concluída: `testes/gravados/` (4 respostas reais do IBGE, extraídas por `scripts/extrair_gravados.py`),
  `ORIGEM.json` e `scripts/sincronizar.py` (`--verificar` diz "nada compartilhado ainda").
- Fase 1, primeiro pedaço: `nucleo/sidra.js` (símbolos e `normalizar`, rótulos de período, `url`, `blocos`,
  `consultarPeriodos`, `baixarSerie`, erros de rede x de tabela; rede injetada) e `testes/rodar.py`: 212
  verificações de paridade com `lib_sidra.py`, 0 falha. Só a mensagem do analisador de JSON difere (é do motor).
- Achado: nesta máquina o **Edge sem janela devolve saída vazia** (até o runner do SuperC); o Chrome responde.
  `testes/rodar.py` tenta Edge e cai no Chrome. O `teste_releases.py` do SuperC tem o mesmo problema.

- Também feito: `nucleo/indicadores.js` (catálogo de 16 tabelas gerado do Python por `scripts/gerar_indicadores.py`,
  com paridade; `classePrecisao`), `nucleo/armazem.js` (KV em IndexedDB → localStorage → memória, e o armazém
  de consultas/séries/locais/períodos) e, em `sidra.js`, os limites de consulta, `conferirDownload` e a passada
  `atualizar` (trava, pausa de rede, 5xx seguidos). `testes/cenarios.py` reproduz o `teste_unidade` do SuperC com
  esperados escritos à mão. Suíte: 295 verificações, 0 falha.
- **Lacuna**: o IndexedDB **não pôde ser provado** aqui: no navegador sem janela, em `file://`, o pedido de
  abertura nunca responde (nem falha). `kvIndexedDB` ganhou limite de 4 s para cair no localStorage, e o teste
  mostra AVISO. Precisa ser conferido de verdade (duplo clique no arquivo) na fase 2; localStorage e memória estão
  provados.
- `IMPLICA` pertence à página (`publicacoes.js`): vem com ela.

- `nucleo/montar.js` (`montar`, `novidades`): o JSON inteiro bate com o do Python, campo a campo, em 7 situações
  (UF escolhida, outra UF, símbolos `-`/`X`/letra desconhecida, cache vazio…), mais o corte de 9 períodos das
  outras UFs. Não portado de propósito: `versao` (chave de cache do servidor). **Fase 1 concluída**:
  315 verificações, 0 falha.

**Fase 2 (feita em 04/11/2026, falta a conferência por duplo clique)**
- Kit puxado do SuperC (`util.js`, `glossario.js`, `graficos.js`, `superc.css`, `chart.umd.min.js`; o `infra.js`
  não é usado pelas páginas e ficou de fora). O CSS vai inteiro (o arquivo final tem 699 KB: sem recorte).
- Páginas trazidas para `nucleo/` e **desacopladas do SuperC**: `publicacoes.js`, `releases_modelos.js`,
  `releases.js` (só o assistente) e `novidades.js` (só o alerta de publicação nova; a parte "análises novas" da
  Leitura gerencial fica no SuperC, que a acopla por `NOVIDADES.extras`). Contrato com o hospedeiro:
  **`FONTE`** (`carregar({forcar})`, `novidades()`) e **`AMBIENTE`** (`superc`, `produto`, `login()`,
  `podeGerar()`, `toast()`, `renderizar()`, `motivoSemPermissao()` opcional). A página NÃO registra a si mesma em
  `PAGINAS`: o hospedeiro faz (3 linhas, ver o fim de `publicacoes.js`). `nucleo/versao.js` traz `VERSAO_NUCLEO`.
- `casca/`: `index.html`, `casca.js` (AMBIENTE, rotas `#/publicacoes?sec=…` e `#/sobre`, menu, seletor das 27 UFs,
  aviso de armazenamento, Sobre), `fonte.js` (FONTE autônoma: lê o cache, dispara UMA passada em segundo plano, o
  "atualizando" da página se atualiza a cada 5 s; trocar de UF tira do cache SÓ as capitais/RMs da UF antiga e
  baixa as da nova), `casca.css`.
- `scripts/construir.py` → `dist/PNADC_Resultados.html` (699 KB, sem requisição externa além do IBGE; versão e data
  no rodapé).
- Testes: `testes/casca.py` abre o arquivo construído num navegador sem janela com um IBGE SIMULADO das 16 tabelas
  (gancho só na construção do teste): sem erro de console, 16 tabelas, Resultados/Brasil/Regiões/UF, assistente,
  Sobre, troca de UF. Suíte inteira: 329 verificações, 0 falha. `python -I testes/rodar.py <nome>` roda só um.
- **Bug achado pelo teste**: com a URL sem `#` (duplo clique), `publicacoes.js` achava que não estava na página e
  nunca se redesenhava ao fim da primeira passada; a casca agora grava a rota padrão na URL.
- Conferido com dados REAIS do IBGE no navegador do app (servidor local na 8771): 16 tabelas em poucos segundos
  (não 3 min), Rondônia 2º tri 2026 = 2,6% (CV 10,5%), IndexedDB funcionando e persistindo entre recargas, assistente
  gera release de 450 palavras com todas as conferências automáticas verdes, 375 px sem rolagem horizontal.

**Falta para fechar a fase 2** (o que só dá para ver abrindo o arquivo de verdade): duplo clique em
`dist/PNADC_Resultados.html` em `file://` no Edge e no Chrome (o IndexedDB em `file://` não pôde ser provado aqui:
no navegador sem janela a abertura não responde; há limite de 4 s para cair no localStorage), abrir sem internet
mostrando o cache, e exportar texto/PNG/HTML/CSV com uma tela de verdade.

**Fase 3 (feita em 04/11/2026)**: o SuperC consome o núcleo.
- `sincronizar.py --empurrar` copia `nucleo/` para `SuperC/app/js/resultados/`, grava `ORIGEM.json` lá (hash por
  arquivo + `versao_nucleo`) e refaz o bloco de `<script>` do `index.html` do SuperC entre marcadores
  (`carregar_no_superc` em `ORIGEM.json` dá a lista e a ordem). `--verificar` confere cópia, dono, bloco e manifesto.
- No SuperC: `app/js/resultados_superc.js` (dele) traz `AMBIENTE`, `FONTE` (adaptador sobre `/api/publicacoes`), o
  registro da página e a extensão "Novas análises" da Leitura gerencial (por `NOVIDADES.extras`/`inicioExtras`). As três
  páginas antigas saíram de `app/js/`. `lib_resultados.py` + sétima porta RECUSAM publicar com a cópia editada ou
  defasada; `teste_resultados_sincronia.py` (22) cobre. `teste_releases` (85) e `teste_sidra` (92) seguem verdes.
- Conferido no navegador com um servidor ISOLADO do SuperC (porta 8799): mesmas 16 tabelas e números do arquivo
  autônomo, rodapé com a versão do núcleo, alerta de publicação nova, sem erro de console.
- `lib_sidra.py`, as rotas `/api/publicacoes*` e a migração 10 CONTINUAM no SuperC: só saem depois de dois ciclos
  mensais de publicação do IBGE com paridade verde (a paridade roda em `testes/rodar.py`).
- O SuperC tem alterações NÃO commitadas de antes (dados/filtros/graficos/mapa/paginas…); as da fase 3 estão misturadas
  com elas. O kit puxado tem o `graficos.js` desse estado.

**Fase 4 (feita em 04/11/2026)**: distribuição.
- `sincronizar.py --empurrar` agora também CONSTRÓI o arquivo único e o entrega em `SuperC/app/PNADC_Resultados.html`
  (e o descreve no `ORIGEM.json` do SuperC: sha256, carimbo, versão). O carimbo só muda quando o conteúdo muda: se o
  que está lá é idêntico ao que se construiria com o MESMO carimbo, não se toca (`construir.py --carimbo`,
  `carimbo_de()`). `--verificar` reconstrói com o carimbo gravado e falha se o arquivo entregue está defasado (núcleo,
  kit ou casca mudaram).
- No topo do arquivo há a instrução em uma linha (duplo clique, Edge/Chrome, só precisa de internet para o IBGE) com
  versão e data; na tela, uma dica de primeira vez ("Entendi"; lembrada no navegador).
- No SuperC: botão **"⇩ Baixar o PNADC Resultados"** ao lado de "Atualizar com o IBGE" (gancho opcional
  `AMBIENTE.acoesExtras()` do núcleo; vale para visitante, é dado público). O arquivo viaja no pacote de atualização do
  desktop, aparece na RAIZ do pacote portátil (`empacotar_portatil.py`) e NÃO vai para o celular
  (`lib_atualizacao_movel.ARQUIVOS_SO_DO_DESKTOP`). `lib_resultados.conferir` (sétima porta) também recusa publicar
  com o arquivo ausente, alterado ou de outra versão do núcleo.
- Testes: `testes/rodar.py entregue` roda o MESMO roteiro da casca (16 tabelas, páginas, assistente, troca de UF) sobre o
  arquivo que o SuperC entrega: é o critério de aceite "um colega sem o SuperC recebe o arquivo, abre e usa" no que dá
  para provar sem janela. Suíte: 343 verificações, 0 falha. No SuperC, `teste_resultados_sincronia.py` (37).
- Conferido no navegador (servidor isolado do SuperC, porta 8799): o botão aparece, o arquivo é servido (717.186 bytes).

**Conferência por duplo clique (04/11/2026)**: o usuário seguiu o roteiro (primeira abertura, reabrir com cache, sem
internet, troca de UF, gerar release e exportar, tela estreita) com o arquivo baixado pelo botão do SuperC e relatou
"tudo funcionou bem". Não foram anotados aqui o navegador exato, o tipo de armazenamento mostrado em Sobre nem o tempo
da primeira baixada; se algum dia houver dúvida sobre IndexedDB em `file://`, é o que vale conferir de novo.
**Falta**: um colega SEM o SuperC receber o arquivo de fato (pendrive ou zip) e usar.
**Fase 5** (evolução própria) só depois de uso real.

## 11. Fase 5 e revisão de interface (04/11/2026, núcleo 0.5.0)
Feito: moldura única para gráficos e tabelas (`nucleo/moldura.js`: tela cheia, JPG, alternância de modo onde faz sentido,
**slider de período** com dois cursores); seções **Capital e RM** e **Comparar períodos**; **modo apresentação** (slides em
tela cheia, teclado e toque) e **PDF direto** (`nucleo/pdf.js`: faixa com logo, rodapé "Página n de N", texto justificado,
tabelas de verdade, "Fonte" em corpo menor; sem `about:blank`); **mapa das UFs com limites reais** (`nucleo/mapa_uf.js`,
gerado por `scripts/gerar_mapa_uf.py`); **seletor de publicação** (por padrão a última; as séries são cortadas no trimestre
escolhido); **UF "Nenhuma"** (o rótulo só existe no seletor; nada impresso o usa); barra lateral com a conferência do IBGE
embaixo, dicas ao passar o mouse e recolhimento automático após 10 s (sempre abre estendida); termos internos do IBGE
retirados dos textos. Regras novas: **nenhum rótulo pode se sobrepor** (testado em todos os mapas e linhas dos slides) e
nenhuma tela mostra `null`/`undefined`/`NaN`. Suíte: 391 verificações, 0 falha. Chrome vem antes do Edge nos testes
(o Edge sem janela devolve vazio e deixa processo órfão).
Pendente: README final/LICENSE para o GitHub (ver `docs/PUBLICAR_NO_GITHUB.md`) e nada do que está aqui foi commitado.


## 12. Redação do release: alternativas e leitura (04/11/2026, núcleo 0.6.0)
- **Alternativas de redação** (site e jornal, passo 6 "Estilo"): manchete (verbo e valor, foco na variação, número primeiro,
  com a referência, curto, institucional), linha fina (padrão, referência primeiro, curta) e lide (padrão, território primeiro,
  fonte primeiro, enxuto). Todas usam os MESMOS fatos e regras (verbo de tendência só com significância publicada, nada de causa,
  diferença entre territórios só como fato aritmético) e passam pela mesma conferência. A escolha fica em `E.extras.alt`.
  Montar as alternativas não mexe no rodízio de verbos (`semEfeito`): a prévia da alternativa é o texto que sai.
- **Leitura** (conferência, só aviso): índice de Flesch adaptado ao português (Martins et al., 1996) e frases com mais de 55 palavras.
- **Sem modelo de linguagem de propósito**: o produto não tem servidor nem chave e só fala com a API de agregados do IBGE;
  texto gerado por gabarito é auditável, repetível e sem risco de número inventado. Teste: `V.alt` em `testes/casca.py`
  (toda combinação de alternativas × 4 recortes passa pela conferência, muda o texto e a padrão é a de sempre).

## 13. Word e OpenDocument (04/11/2026)
- Passo 10 do gerador de releases: **Baixar Word (.docx)** e **Baixar OpenDocument (.odt)** (`nucleo/docs.js`, global `DOCSREL`). Sem biblioteca e
  sem rede: ZIP gravado sem compressão (CRC-32 próprio) com o XML do Word/ODF. Mesmo conteúdo do PDF direto (`blocosPdf`): títulos, texto
  justificado, tópicos, citação, tabelas de verdade (cabeçalho verde repetido) e as imagens no fim, com texto alternativo; rodapé com "Página n de N".
- Texto de dado vai como texto XML escapado (nunca marcação). Teste (`V.docs` em `testes/casca.py`): ZIP íntegro, XML bem formado, título, tabelas e
  imagens; por fora, o Python reabre os dois (zipfile + minidom), o `python-docx` abre o .docx e, se houver LibreOffice, converte ambos em PDF
  (sem LibreOffice nesta máquina: o .odt só tem a conferência de estrutura).

## 14. Página "Entenda a PNADC" (04/11/2026)
- Nova página da casca, no menu acima de "Sobre" (`casca/entenda.js`, global `ENTENDA`; rota `#/entenda`). Conta a história da pesquisa (linha do tempo),
  compara PME × PNAD × PNAD Contínua, explica a amostra (2 estágios, UPAs, rotação 1-2(5) em figura), a semana de referência, o que é força de trabalho
  (figura + fluxo de classificação + exemplo com os números do Brasil do cache), os indicadores com fórmulas, desocupação, subocupação, força de trabalho
  potencial, desalento e as taxas de subutilização, informalidade, rendimento e precisão/significância.
- Todo trecho cita a fonte em [n]; a lista no fim tem link oficial (IBGE e OIT). Base principal: Notas Metodológicas v.1 (2014), Nota Técnica (2015),
  Glossário e "Medidas de Subutilização" (4º tri/2025), lidos do FTP do IBGE. As páginas do portal (ibge.gov.br) responderam 403 à leitura automática:
  o que depende delas (fim da PME e da PNAD anual; informalidade) está atribuído à fonte e merece conferência humana.
- Teste: `V.entenda` em `testes/casca.py` e a página no `testes/responsivo.py` (4 larguras, sem rolagem horizontal).

## 15. Comparar: várias variáveis no mesmo gráfico (04/11/2026)
- Em "Comparar períodos", um cartão novo mostra a SÉRIE do território escolhido com até seis variáveis ao mesmo tempo (chips para incluir/tirar,
  combinações sugeridas, slider de período, JPG e tela cheia). A seleção vai no endereço (`&v=a,b,c`).
- Combinações: mesma unidade (taxas em %) = um eixo; duas unidades (taxas + rendimento em R$, ou taxas + pessoas ocupadas em mil) = dois eixos, um de
  cada lado; três unidades = não cabe em dois eixos, então o cartão abre no modo **Índice (base 100 no primeiro período em foco)**, que serve para qualquer
  mistura e mostra ritmo de variação, não nível. Sem cor de significância: não há comparação entre dois períodos neste gráfico.
- Teste: `V.multi` em `testes/casca.py` (um eixo, dois eixos, índice começando em 100 e clique mudando o endereço).

## 16. Bandeiras e grades equilibradas (04/11/2026)
- **Bandeiras** do Brasil e das 27 UFs ao lado do nome: abas Brasil/UF, seletor de UF do cabeçalho, eixo do gráfico de ranking das UFs e tabela do
  ranking. 28 miniaturas de 64 px (43 KB no total) embutidas em `nucleo/bandeiras.js` (gerado; Wikimedia Commons, domínio público); nada é baixado em uso.
  Cada `<img>` usa uma URL `blob:` curta (criada uma vez), não o base64 repetido; as imagens são decodificadas na abertura.
- **Lição de desempenho**: a 1ª versão do desenho das bandeiras no gráfico pedia um redesenho por bandeira ainda não carregada a cada quadro, e os pedidos
  se multiplicavam (a página UF travava). Agora há UMA função de redesenho por gráfico, juntada num quadro (`requestAnimationFrame`).
- **Grade equilibrada** (`MOLDURA.gradeEquilibrada`): os cartões-resumo se repartem por igual entre as linhas (8 cartões em tela larga = 4 + 4, nunca
  6 + 2). Regra geral para toda grade de cartões: calcular quantos cabem, fixar o número de linhas e dividir por igual. `testes/responsivo.py` falha se
  duas linhas diferirem em mais de um cartão.

## 17. Medição de acessos da página publicada (04/11/2026)
- Cloudflare Web Analytics (sem cookies, sem dado pessoal), SÓ na cópia do GitHub Pages: o workflow `pages.yml` roda `scripts/injetar_medicao.py site/index.html`
  com a variável de repositório `CF_BEACON_TOKEN` (token público do site no Cloudflare). Sem a variável, não insere nada. O arquivo distribuído (`dist/`)
  nunca é medido; o teste `medicao` falha se aparecer código de rastreamento nele.
- A página "Sobre" avisa o visitante, só quando aberta em `*.github.io`. O Insights → Traffic do GitHub mede só o repositório (código), não a página.

## 18. Desempenho: leitura do relatório do Cloudflare e gráfico de série longa (05/11/2026)
- **Relatório (24 h, só visitas de pessoas, ~20 amostras)**: LCP 95% bom (P50 173 ms, P75 546 ms, P90 1,2 s, P99 3,4 s; no P75 o tempo é 448 ms de resposta do servidor e 501 ms
  de atraso de desenho: análise e execução do JavaScript, não rede nem imagem); INP 88% bom, 6% a melhorar e 6% ruim (um clique de 2,2 s num botão do cartão de gráfico);
  CLS 100% bom. Medição própria na página publicada: resposta em ~300 ms, 325 KB transferidos (1.024 KB descomprimidos), DOMContentLoaded em ~830 ms (~400 ms de script).
- **Feito**: (1) enquanto as 16 tabelas chegam (primeira visita), a página inteira era redesenhada a cada 5 s, o que trava cliques e fecha a tela cheia: agora o redesenho espera
  se houver tela cheia ou toque/tecla nos últimos 4 s; (2) gráfico de série longa mais leve (ver abaixo).
- **Medido e NÃO adotado**: minificar JS e CSS reduz 994 KB para ~800 KB (312 KB para ~255 KB comprimido), mas o `rjsmin` estraga template literals (o teste da casca pegou: XML do Word/ODT
  inválido). Se for adotar, só com minificador de verdade (esbuild/terser, que precisam de node: no GitHub Actions há), com o roteiro completo da casca rodando sobre a versão minificada.
- **Próximos candidatos**: carregar sob demanda os módulos de uso raro (release, apresentação, PDF, Word/ODT: quase metade do JavaScript); desenhar primeiro a área visível.
- **Série longa** (`MOLDURA.estilizar`, mais de 16 pontos): sem bolinha em cada ponto (só o último), linhas de apoio mais finas, anos no eixo x, eixo da taxa a partir do zero,
  cruz de leitura e último valor ao fim de cada linha (sem sobreposição; não com dois eixos). Teste `V.serie_longa`.
