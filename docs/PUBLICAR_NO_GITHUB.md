# Publicar o PNADC Resultados no GitHub

Guia do mantenedor. Nada aqui foi executado por ninguém além de você: o repositório local **não tem remoto**.

## 0. Decisões que só você pode tomar (faça antes de qualquer `git push`)

1. **Autorização institucional.** O projeto nasceu dentro do SuperC PNADC, um sistema da equipe do IBGE-RO. Confirme com
   a chefia/TI/comunicação que o código pode ser público. O ponto mais sensível é a pasta `kit/`, que é **cópia de
   arquivos do SuperC** (`util.js`, `graficos.js`, `glossario.js`, `superc.css`) e cita o SIGC em comentários. Se a
   autorização não vier para o SuperC, há três saídas: (a) publicar sem `kit/` e sem o arquivo único, (b) trocar o `kit/`
   por uma camada própria, (c) não publicar o código e só distribuir o arquivo `PNADC_Resultados.html`.
2. **Licença.** MIT, já criada em `LICENSE` (autoria: Renato Izolino Manoel Prado Lima, 2026). O Chart.js embutido também é MIT (ver `THIRD_PARTY_NOTICES.md`).
3. **Nome e marca.** O projeto não é um produto oficial do IBGE e não usa o logotipo do IBGE (a marca do projeto é
   própria). Mantenha o aviso do README e não use a marca do IBGE no repositório, na página ou nas imagens.
4. **E-mail dos commits.** O primeiro commit tem seu e-mail pessoal como autor. Para esconder, use o e-mail *noreply* do
   GitHub (Settings → Emails → "Keep my email addresses private"; ele mostra `ID+usuario@users.noreply.github.com`).
   Como ainda não há remoto e o histórico é curto, dá para reescrever o autor antes da primeira publicação:

   ```bash
   git config user.name  "Seu Nome"
   git config user.email "ID+usuario@users.noreply.github.com"
   git rebase -r --root --exec "git commit --amend --reset-author --no-edit"
   ```
5. **Contato público.** O e-mail de contato aparece em `CONTRIBUTING.md` e no arquivo (menu e página *Sobre*). Se preferir
   só as *issues*, remova-o desses lugares (`casca/casca.js`, constante `CONTATO`).

## 1. Conferir o repositório local

```bash
git status                       # tem que estar limpo
python -I scripts/construir.py   # gera dist/PNADC_Resultados.html
python -I testes/rodar.py        # suíte inteira, sem rede
git grep -n -i "senha\|token\|secret" -- . ':!kit/chart.umd.min.js'   # nada sensível
```

## 2. Criar o repositório no GitHub

1. github.com → **New repository**. Nome sugerido: `pnadc-resultados`. Deixe **vazio** (sem README, `.gitignore` ou licença).
   Escolha *Public*.
2. No terminal, dentro da pasta do projeto:

   ```bash
   git branch -M main
   git remote add origin https://github.com/<seu-usuario>/pnadc-resultados.git
   git push -u origin main
   ```
   (O GitHub pede login pelo navegador ou um *Personal Access Token*; não cole a senha da conta.)

## 3. Ligar o que já está preparado

- **Testes automáticos:** `.github/workflows/testes.yml` roda a cada `push`. Veja na aba *Actions*. Foi escrito sem poder
  ser executado aqui; se falhar, o log mostra onde (o ponto mais provável é o Chrome headless do runner).
- **Página pública (GitHub Pages):** Settings → Pages → *Build and deployment* → **Source: GitHub Actions**. O fluxo
  `pages.yml` publica o arquivo único em `https://<seu-usuario>.github.io/pnadc-resultados/` a cada `push` na `main`.
  Quem abrir a página usa sem baixar nada (os dados vêm direto do IBGE; o cache fica no navegador de cada pessoa).
- **Download com um clique:** crie uma *Release* (Releases → *Draft a new release* → tag `v0.4.0`). O fluxo `release.yml`
  anexa o `PNADC_Resultados.html` sozinho.
- **Descrição e tópicos** (engrenagem ao lado de *About*): "Números da PNAD Contínua do IBGE em um arquivo único (HTML)".
  Tópicos: `pnad-continua`, `ibge`, `sidra`, `mercado-de-trabalho`, `html`, `javascript`, `dados-abertos`.
- **Issues:** já há modelos para erro e sugestão em `.github/ISSUE_TEMPLATE/`.

## 4. Depois de publicar

- Ponha o endereço da página e da Release no `README.md`.
- Mantenha `THIRD_PARTY_NOTICES.md` em dia se trocar o Chart.js.
- Quando o IBGE mudar algo na API, as respostas de `testes/gravados/` continuam servindo de rede de segurança; para
  atualizá-las há `scripts/extrair_gravados.py` (só funciona com o SuperC por perto).
- `scripts/sincronizar.py` e `ORIGEM.json` são do mantenedor (ponte com o SuperC). Se o SuperC não for público, deixe-os
  no repositório mesmo assim: eles só funcionam com a pasta do SuperC ao lado (`../SuperC`) ou em `SUPERC_PASTA`.
