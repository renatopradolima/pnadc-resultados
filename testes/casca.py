# -*- coding: utf-8 -*-
u"""Teste da casca: o arquivo único construído, aberto num navegador sem janela, com um IBGE SIMULADO.

O gancho de teste (rede simulada, relatório no fim) entra só na construção feita aqui (`antes_de_iniciar`);
o dist/PNADC_Resultados.html de produção não o leva. Nada fala com a rede.

Cobre: abertura sem erro de console, primeira passada das 16 tabelas, página Resultados (Brasil, Regiões, UF),
o assistente de releases, a página Sobre, troca de UF e o cache que sobrevive entre passadas.
"""
import json
import os
import sys

# O IBGE simulado: gera, para qualquer tabela do catálogo, as respostas de /periodos e de dados no formato real.
JS_REDE = r"""
(function () {
  const FAM = {}, ESPEC = {};
  INDICADORES_CATALOGO.tabelas().forEach(t => { FAM[t.tabela] = t.familia; ESPEC[t.tabela] = t.espec; });
  const BASE = { '4099': 6, '4097': 57, '4096': 62, '12466': 38.5, '4118': 16, '9869': 3, '5933': 3200, '4090': 100000 };
  const UFS_ = FONTE.ufs();
  const REG = { '1': 'Norte', '2': 'Nordeste', '3': 'Sudeste', '4': 'Sul', '5': 'Centro-Oeste' };
  function periodos(tab) {
    const out = [];
    if (FAM[tab] === 'trimestral') { for (let a = 2012; a <= 2026; a++) for (let q = 1; q <= 4; q++) if (a < 2026 || q <= 2) out.push(a + '0' + q); }
    else { for (let a = 2012; a <= 2026; a++) for (let m = 1; m <= 12; m++) if ((a > 2012 || m >= 3) && (a < 2026 || m <= 8)) out.push(a + (m < 10 ? '0' : '') + m); }
    return out;
  }
  function locais(niveis) {
    const L = [];
    niveis.forEach(n => {
      if (n === 'N1') L.push(['N1', 'Brasil', '1', 'Brasil']);
      if (n === 'N2') Object.keys(REG).forEach(r => L.push(['N2', 'Grande Região', r, REG[r]]));
      if (n === 'N3') UFS_.forEach(u => L.push(['N3', 'Unidade da Federação', u.codigo, u.nome]));
      if (n === 'N6') UFS_.forEach(u => L.push(['N6', 'Município', u.codigo + '00205', 'Capital ' + u.sigla + ' (' + u.sigla + ')']));
      if (n === 'N7') UFS_.slice(0, 20).forEach(u => L.push(['N7', 'Região Metropolitana', u.codigo + '01', 'RM ' + u.sigla]));
    });
    return L;
  }
  function dado(tab, pers, vars) {
    const e = ESPEC[tab], tipo = BASE[e.valor] > 1000 ? 'abs' : 'taxa', lag = FAM[tab] === 'trimestral' ? [1, 4] : [3, 12];
    const todos = periodos(tab), L = locais(e.niveis);
    const doBloco = todos.filter(p => pers.indexOf(p) >= 0);
    const serie = (loc, k) => todos.map((p, i) => {
      const fase = (parseInt(loc[2], 10) % 7) + k, mult = loc[0] === 'N1' ? 1 : 1 + (parseInt(loc[2], 10) % 9) / 40;
      return BASE[e.valor] * mult * (1 + 0.1 * Math.sin(i / 5 + fase) + 0.03 * Math.cos(i / 1.7));
    });
    const arred = (x, c) => Number(x.toFixed(c));
    const casas = tipo === 'abs' ? 0 : 1;
    return vars.map((vid, pos) => {
      const campo = ['valor', 'cv', 'var_curta', 'sit_curta', 'var_ano', 'sit_ano'][pos];
      const series = L.map(loc => {
        const v = serie(loc, pos).map(x => arred(x, casas));
        const serieObj = {};
        todos.forEach((p, i) => {
          if (doBloco.indexOf(p) < 0) return;
          let x;
          const d = (a) => (i - a < 0 ? null : (tipo === 'abs' ? arred((v[i] / v[i - a] - 1) * 100, 1) : arred(v[i] - v[i - a], 1)));
          if (campo === 'valor') x = String(v[i]);
          else if (campo === 'cv') x = String(arred(loc[0] === 'N1' ? 1.2 : loc[0] === 'N2' ? 3.1 : 9.5, 1));
          else if (campo === 'var_curta') { const y = d(lag[0]); x = y === null ? '...' : String(y); }
          else if (campo === 'var_ano') { const y = d(lag[1]); x = y === null ? '...' : String(y); }
          else {
            const y = d(campo === 'sit_curta' ? lag[0] : lag[1]);
            x = y === null ? '-' : (Math.abs(y) > (loc[0] === 'N1' ? 0.3 : 1.0) ? 'Z' : 'A');
          }
          serieObj[p] = x;
        });
        return { localidade: { id: loc[2], nivel: { id: loc[0], nome: loc[1] }, nome: loc[3] }, serie: serieObj };
      });
      return { id: vid, variavel: 'variável ' + vid, unidade: '%', resultados: [{ classificacoes: [], series }] };
    });
  }
  window.__IBGE_CHAMADAS = [];
  window.__IBGE_MODO = 'ok';
  FONTE.configurar({
    io: { buscar(u) {
      window.__IBGE_CHAMADAS.push(u);
      if (window.__IBGE_MODO === 'sem_rede') return Promise.reject(new Error('Failed to fetch'));
      const partes = u.slice(SIDRA.BASE_URL.length).split('?')[0].split('/');
      const tab = partes[1];
      let corpo;
      if (partes[2] === 'periodos' && partes.length === 3) {
        corpo = periodos(tab).map((p, i, a) => ({ id: p, literals: [p], modificacao: i === a.length - 1 ? '14/08/2026' : '14/05/2026' }));
      } else {
        const faixa = partes[3].split('-'), todos = periodos(tab);
        const ini = todos.indexOf(faixa[0]), fim = todos.indexOf(faixa[faixa.length - 1]);
        corpo = dado(tab, todos.slice(ini, fim + 1), decodeURIComponent(partes[5]).split('|'));
      }
      return Promise.resolve({ status: 200, corpo: JSON.stringify(corpo), interrompida: false, erro: '' });
    } },
    kv: ARMAZEM.kvMemoria()
  });
})();
"""

JS_ROTEIRO = r"""
(function () {
  const erros = [], R = { passos: {} };
  window.addEventListener('error', e => erros.push('erro: ' + e.message));
  window.addEventListener('unhandledrejection', e => erros.push('promessa: ' + (e.reason && e.reason.message || e.reason)));
  const ce = console.error; console.error = function () { erros.push('console.error: ' + Array.prototype.join.call(arguments, ' ')); ce.apply(console, arguments); };
  const txt = () => document.getElementById('conteudo').innerText;
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const prog = nome => { document.title += ' | ' + nome; };
  const marca = (nome, extra) => { prog(nome); R.passos[nome] = Object.assign({ texto: txt().length, hash: location.hash }, extra || {}); };
  espera(1000).then(() => {
    marca('abertura', { tabelas: FONTE._armazem() ? 1 : 0 });
    return espera(14000);                                  // a passada das 16 tabelas + o redesenho de 5 em 5 s
  }).then(() => { prog('apos espera'); return FONTE._armazem().estado(); }).then(est => {
    const tabs = Object.keys(est).filter(k => k !== '*');
    R.tabelas_ok = tabs.filter(k => est[k].ok && est[k].n_valores > 0).length;
    R.tabelas_total = tabs.length;
    R.rede_ok = est['*'] && est['*'].ok;
    R.diag = { emCurso: SIDRA.emCurso(), atualizando: !!(PUBLICACOES.dados() && PUBLICACOES.dados().atualizando), temD: !!PUBLICACOES.dados(), hash: location.hash, agora: Date.now() };
    R.chamadas = window.__IBGE_CHAMADAS.length;
    R.resultados = txt();
    R.n_cartoes = document.querySelectorAll('#conteudo .cartao').length;
    R.n_canvas = document.querySelectorAll('#conteudo canvas').length;
    R.n_erros_tela = document.querySelectorAll('#conteudo .aviso.erro').length;
    R.tem_uf_ro = /Rondônia/.test(txt());
    R.faixa = (document.querySelector('#conteudo .mini-info') || { innerText: '' }).innerText;
    R.menu = Array.from(document.querySelectorAll('#nav a[data-pagina]')).map(a => a.textContent.trim() + (a.classList.contains('ativo') ? '*' : ''));
    marca('resultados');
    // as outras seções
    const seccoes = {};
    const ir = (h) => { prog(h); location.hash = h; return espera(600); };
    return ir('#/publicacoes?sec=brasil').then(() => { seccoes.brasil = txt().length; return ir('#/publicacoes?sec=regioes'); })
      .then(() => { seccoes.regioes = txt().length; seccoes.regioes_norte = /Norte/.test(txt()); return ir('#/publicacoes?sec=uf&ind=informalidade'); })
      .then(() => { seccoes.informalidade = /nformalidade/.test(txt()); R.seccoes = seccoes; return ir('#/publicacoes?sec=release&passo=1'); })
      .then(() => {
        R.release = { raiz: !!document.querySelector('.rel-raiz'), texto: txt().length, ativo: Array.from(document.querySelectorAll('#nav a.ativo')).map(a => a.dataset.pagina) };
        return ir('#/publicacoes?sec=release&passo=10');
      }).then(() => {
        R.release10 = { raiz: !!document.querySelector('.rel-raiz'), texto: txt().slice(0, 400), botoes: Array.from(document.querySelectorAll('#conteudo button')).map(b => b.textContent.trim()).filter(Boolean).slice(0, 30) };
        return ir('#/sobre');
      }).then(() => {
        R.sobre = txt();
        return ir('#/publicacoes?sec=uf');
      }).then(() => {
        // troca de UF: capitais da UF nova são baixadas na passada seguinte
        const sel = document.getElementById('seletor-uf');
        sel.value = '12'; sel.dispatchEvent(new Event('change'));
        return espera(14000);
      }).then(() => FONTE._armazem().lerSerie('6468')).then(s => {
        R.apos_trocar_uf = { uf: FONTE.uf().codigo, titulo: txt().slice(0, 200), tem_acre: /Acre/.test(txt()),
          capital_acre: s.linhas.some(l => l[1] === 'N6' && l[2] === '1200205'), capital_ro: s.linhas.some(l => l[1] === 'N6' && l[2] === '1100205'),
          chamadas: window.__IBGE_CHAMADAS.length };
        // sem rede: nada é apagado e a tela segue
        window.__IBGE_MODO = 'sem_rede';
        return FONTE._armazem().estado();
      }).then(() => { R.erros = erros; });
  }).catch(e => { R.FALHA_GERAL = String(e && e.stack || e); R.erros = erros; })
        .then(() => { const pre = document.createElement('pre'); pre.id = '__res'; pre.textContent = '<<<' + JSON.stringify(R) + '>>>'; document.body.append(pre); });
})();
"""


GANCHO = ('try {' + JS_REDE + '} catch (e) { document.title = "REDE: " + e.stack; }\n'
          'try {' + JS_ROTEIRO + '} catch (e) { document.title = "ROTEIRO: " + e.stack; }')


def teste_entregue(ctx):
    """Fase 4: o MESMO roteiro, sobre o arquivo que o SuperC entrega no botão (SuperC/app/PNADC_Resultados.html)."""
    import json as _json
    ori = _json.load(open(ctx.ORIGEM, encoding='utf-8'))
    arq = os.path.join(ori['superc'], *ori['distribuicao']['arquivo_superc'].split('/'))
    if not os.path.exists(arq):
        print(u'AVISO  arquivo entregue ausente (%s): rode scripts/sincronizar.py --empurrar' % arq)
        return None
    sys.path.insert(0, ctx.AQUI + '/../scripts')
    import construir
    sys.path.pop(0)
    html = construir.injetar_antes_de_iniciar(open(arq, encoding='utf-8', newline='').read(), GANCHO)
    return teste_casca(ctx, html, 'entregue')


def teste_casca(ctx, html=None, rotulo='casca'):
    if html is None:
        sys.path.insert(0, ctx.AQUI + '/../scripts')
        import construir
        sys.path.pop(0)
        html = construir.construir(antes_de_iniciar=GANCHO)
    dom = ctx.rodar_no_edge(html, timeout=300, virtual_ms=60000)
    if dom is None:
        ctx.confere(False, rotulo + ': nenhum navegador')
        return
    import html as H
    i, j = dom.find('&lt;&lt;&lt;'), dom.rfind('&gt;&gt;&gt;')
    if i < 0 or j < i:
        ctx.confere(False, (rotulo + ': o roteiro não terminou (DOM de %d bytes)') % len(dom))
        return
    r = json.loads(H.unescape(dom[i + 12:j]))
    if 'FALHA_GERAL' in r:
        ctx.confere(False, rotulo + ': ' + r['FALHA_GERAL'])
    ctx.confere(not r.get('erros'), (rotulo + ': nenhum erro de console/exceção (%s)') % '; '.join(r.get('erros') or [])[:600])
    ctx.confere(r.get('tabelas_total') == 16 and r.get('tabelas_ok') == 16,
                (rotulo + ': as 16 tabelas baixadas pela passada (%s de %s)') % (r.get('tabelas_ok'), r.get('tabelas_total')))
    ctx.confere(r.get('rede_ok') is True, rotulo + ': passada completa marca a rede como ok')
    ctx.confere(r.get('tem_uf_ro') and r.get('n_cartoes', 0) >= 3, (rotulo + ': Resultados mostra a UF (Rondônia) e cartões (%s)') % r.get('n_cartoes'))
    ctx.confere(r.get('n_canvas', 0) >= 1, (rotulo + ': há gráfico (canvas) na página (%s)') % r.get('n_canvas'))
    ctx.confere(r.get('n_erros_tela') == 0, rotulo + ': nenhum aviso de erro na tela de Resultados')
    ctx.confere('Última conferência com o IBGE' in (r.get('faixa') or ''), (rotulo + ': faixa de estado diz quando conferiu (%r)') % (r.get('faixa'),))
    ctx.confere(r.get('menu') == ['Resultados*', 'Gerar release', 'Sobre'], (rotulo + ': menu e item ativo (%r)') % (r.get('menu'),))
    s = r.get('seccoes') or {}
    ctx.confere(s.get('brasil', 0) > 500 and s.get('regioes', 0) > 500 and s.get('regioes_norte') and s.get('informalidade'),
                (rotulo + ': seções Brasil, Regiões e indicador escolhido desenham (%r)') % (s,))
    rel = r.get('release') or {}
    ctx.confere(rel.get('raiz') and rel.get('ativo') == ['release'], (rotulo + ': o assistente de releases abre e o menu marca "Gerar release" (%r)') % (rel,))
    rel10 = r.get('release10') or {}
    ctx.confere(rel10.get('raiz'), (rotulo + ': o passo 10 do assistente desenha (%r)') % (rel10,))
    ctx.confere('Versão do núcleo' in (r.get('sobre') or '') and 'Armazenamento' in (r.get('sobre') or ''), rotulo + ': página Sobre')
    t = r.get('apos_trocar_uf') or {}
    ctx.confere(t.get('uf') == '12' and t.get('tem_acre'), (rotulo + ': trocar a UF mostra a nova (%r)') % (t.get('titulo'),))
    ctx.confere(t.get('capital_acre') and not t.get('capital_ro'),
                (rotulo + ': trocar a UF baixa a capital nova e tira só as capitais da antiga (acre=%s, ro=%s)') % (t.get('capital_acre'), t.get('capital_ro')))
    return r
