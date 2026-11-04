/* PNADC Resultados -- armazém do cache (substitui as tabelas sidra_* do SQLite do SuperC).
   Dono: PNADC_Resultados. Camadas:
     1. KV: chave -> valor JSON, assíncrono, em três versões: IndexedDB, localStorage e memória;
     2. ARMAZEM: o que o núcleo precisa guardar (consultas, séries por tabela, locais, períodos), SEM regra
        de negócio -- as regras (12 h, pausa, conferência de download) ficam em sidra.js.
   Chaves: 'consulta' (estado de todas as tabelas, inclusive '*'), 'serie:<tabela>', 'locais', 'periodos'.
   A série de uma tabela é gravada de uma vez (troca inteira, como o DELETE+INSERT do Python). Não há
   transação entre chaves: se a gravação cair entre 'serie' e 'consulta', a consulta ainda diz "desatualizada" e
   a próxima passada baixa de novo -- o cache nunca fica pior do que estava.
   Este é dado PÚBLICO (números divulgados pelo IBGE). Sem `??` nem `?.`. */
'use strict';

const ARMAZEM = (() => {
  /* ---------------------------------------------------------------- KV */
  function kvMemoria() {
    const m = {};
    return {
      tipo: 'memoria',
      get(k) { return Promise.resolve(Object.prototype.hasOwnProperty.call(m, k) ? JSON.parse(m[k]) : null); },
      set(k, v) { m[k] = JSON.stringify(v); return Promise.resolve(); },
      chaves() { return Promise.resolve(Object.keys(m)); }
    };
  }

  function kvLocalStorage(prefixo) {
    const ls = window.localStorage;
    const p = prefixo + ':';
    const prova = p + '__prova';
    ls.setItem(prova, '1');
    ls.removeItem(prova);
    return {
      tipo: 'localStorage',
      get(k) {
        return new Promise(res => {
          const t = ls.getItem(p + k);
          res(t === null ? null : JSON.parse(t));
        });
      },
      set(k, v) {
        return new Promise((res, rej) => {
          try { ls.setItem(p + k, JSON.stringify(v)); res(); } catch (e) { rej(e); }
        });
      },
      chaves() {
        return Promise.resolve(Object.keys(ls).filter(k => k.indexOf(p) === 0).map(k => k.slice(p.length)));
      }
    };
  }

  /* `limiteMs`: há navegadores/contextos (arquivo local, janela privada) em que o pedido de abertura nunca
     responde nem falha; passado o limite, rejeita para o `abrir` cair numa camada menor. */
  function kvIndexedDB(nome, limiteMs) {
    return new Promise((res0, rej0) => {
      let encerrado = false;
      const timer = setTimeout(() => { encerrado = true; rej0(new Error('IndexedDB não respondeu')); }, limiteMs || 4000);
      const res = x => { if (!encerrado) { encerrado = true; clearTimeout(timer); res0(x); } else if (x && x.fechar) x.fechar(); };
      const rej = e => { if (!encerrado) { encerrado = true; clearTimeout(timer); rej0(e); } };
      if (typeof indexedDB === 'undefined' || !indexedDB) { rej(new Error('sem IndexedDB')); return; }
      let aberto;
      try { aberto = indexedDB.open(nome, 1); } catch (e) { rej(e); return; }
      aberto.onupgradeneeded = () => { aberto.result.createObjectStore('kv'); };
      aberto.onerror = () => rej(aberto.error || new Error('IndexedDB recusou'));
      aberto.onblocked = () => rej(new Error('IndexedDB bloqueado'));
      aberto.onsuccess = () => {
        const db = aberto.result;
        const pedido = (modo, fn) => new Promise((ok, falha) => {
          const t = db.transaction('kv', modo);
          const r = fn(t.objectStore('kv'));
          t.oncomplete = () => ok(r.result);
          t.onerror = () => falha(t.error);
          t.onabort = () => falha(t.error || new Error('transação cancelada'));
        });
        res({
          tipo: 'indexedDB',
          fechar() { db.close(); },
          get(k) { return pedido('readonly', s => s.get(k)).then(v => (v === undefined ? null : v)); },
          set(k, v) { return pedido('readwrite', s => s.put(v, k)).then(() => undefined); },
          chaves() { return pedido('readonly', s => s.getAllKeys()).then(x => x.map(String)); }
        });
      };
    });
  }

  /* Escolhe o melhor disponível: IndexedDB -> localStorage -> memória. `aviso` explica o rebaixamento. */
  function abrir(nome) {
    nome = nome || 'pnadc_resultados';
    return kvIndexedDB(nome).then(kv => ({ kv, aviso: null }), e1 => {
      let ls = null;
      try { ls = kvLocalStorage(nome); } catch (e2) { ls = null; }
      if (ls) return { kv: ls, aviso: 'IndexedDB indisponível (' + e1.message + '): guardando no localStorage, que é pequeno' };
      return { kv: kvMemoria(), aviso: 'Sem armazenamento no navegador (' + e1.message + '): os dados valem só até fechar esta aba' };
    });
  }

  /* ---------------------------------------------------------------- ARMAZEM sobre um KV */
  function sobre(kv) {
    return {
      tipo: kv.tipo,
      kv,
      /* { tabela: estado } -- inclui '*' (pausa geral de rede) */
      estado() { return kv.get('consulta').then(x => x || {}); },
      gravarConsulta(tabela, obj) {
        return kv.get('consulta').then(x => { x = x || {}; x[tabela] = obj; return kv.set('consulta', x); });
      },
      temValores(tabela) { return kv.get('serie:' + tabela).then(x => !!(x && x.linhas && x.linhas.length)); },
      /* { linhas: [[variavel, nivel, localidade, periodo, valor]], baixado_em } ou null */
      lerSerie(tabela) { return kv.get('serie:' + tabela); },
      /* troca a série da tabela de uma vez; os locais novos entram por cima dos antigos */
      gravarSerie(tabela, linhas, locais, baixadoEm) {
        return kv.set('serie:' + tabela, { linhas, baixado_em: baixadoEm })
          .then(() => kv.get('locais')).then(x => {
            x = x || {};
            locais.forEach(l => { x[l[0] + '|' + l[1]] = l[2]; });
            return kv.set('locais', x);
          });
      },
      /* { 'nivel|id': nome } */
      lerLocais() { return kv.get('locais').then(x => x || {}); },
      gravarPeriodos(tabela, pers) {
        return kv.get('periodos').then(x => {
          x = x || {};
          x[tabela] = pers.map(p => [p[0], p[1] || null]);
          return kv.set('periodos', x);
        });
      },
      /* { tabela: { periodo: 'AAAA-MM-DD' } } -- só períodos com data, como `_divulgacoes` */
      lerPeriodos() {
        return kv.get('periodos').then(x => {
          const out = {};
          Object.keys(x || {}).forEach(t => x[t].forEach(p => {
            if (p[1]) { if (!out[t]) out[t] = {}; out[t][p[0]] = p[1]; }
          }));
          return out;
        });
      }
    };
  }

  return { kvMemoria, kvLocalStorage, kvIndexedDB, abrir, sobre, memoria() { return sobre(kvMemoria()); } };
})();
