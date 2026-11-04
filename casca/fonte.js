/* PNADC Resultados -- FONTE do arquivo autônomo: o núcleo JS falando direto com o IBGE, cache no navegador.
   Dono: PNADC_Resultados (só da casca; no SuperC a FONTE é um adaptador sobre /api/publicacoes).

   Contrato (o mesmo que o núcleo espera de qualquer hospedeiro):
     FONTE.carregar({ forcar }) -> Promise<D>   D = o JSON de montar() + { atualizando, agendada, vencidas }
     FONTE.novidades()          -> Promise<resumo>
   Como o servidor do SuperC: carregar() NUNCA espera o IBGE -- lê o cache e, se há tabela vencida (12 h; 30 min
   com `forcar`), dispara UMA passada em segundo plano e devolve `atualizando: true`; a página pergunta de novo a
   cada 5 s até a passada terminar. Pausa de rede, 12 h e cache preservado são do núcleo (sidra.js).
   Sem `??` nem `?.`. */
'use strict';

const UFS = [
  ['11', 'RO', 'Rondônia'], ['12', 'AC', 'Acre'], ['13', 'AM', 'Amazonas'], ['14', 'RR', 'Roraima'], ['15', 'PA', 'Pará'],
  ['16', 'AP', 'Amapá'], ['17', 'TO', 'Tocantins'], ['21', 'MA', 'Maranhão'], ['22', 'PI', 'Piauí'], ['23', 'CE', 'Ceará'],
  ['24', 'RN', 'Rio Grande do Norte'], ['25', 'PB', 'Paraíba'], ['26', 'PE', 'Pernambuco'], ['27', 'AL', 'Alagoas'],
  ['28', 'SE', 'Sergipe'], ['29', 'BA', 'Bahia'], ['31', 'MG', 'Minas Gerais'], ['32', 'ES', 'Espírito Santo'],
  ['33', 'RJ', 'Rio de Janeiro'], ['35', 'SP', 'São Paulo'], ['41', 'PR', 'Paraná'], ['42', 'SC', 'Santa Catarina'],
  ['43', 'RS', 'Rio Grande do Sul'], ['50', 'MS', 'Mato Grosso do Sul'], ['51', 'MT', 'Mato Grosso'], ['52', 'GO', 'Goiás'],
  ['53', 'DF', 'Distrito Federal']
].map(x => ({ codigo: x[0], sigla: x[1], nome: x[2] }));

const FONTE = (() => {
  const CHAVE_UF = 'pnadc.uf';
  const cfg = { io: null, agora: function () { return new Date(); }, kv: null, tabelas: null, indicadores: null };
  let A = null, aviso = null, tipo = null, iniciando = null, ufAtual = null, ultimoErro = null;

  function ufPorCodigo(c) {
    for (let i = 0; i < UFS.length; i++) if (UFS[i].codigo === String(c)) return UFS[i];
    return null;
  }
  function uf() {
    if (!ufAtual) {
      let c = null;
      try { c = localStorage.getItem(CHAVE_UF); } catch (e) { c = null; }
      ufAtual = ufPorCodigo(c) || UFS[0];
    }
    return ufAtual;
  }
  const listaTabelas = () => cfg.tabelas || INDICADORES_CATALOGO.tabelas();
  const indicadores = () => cfg.indicadores || INDICADORES_CATALOGO.INDICADORES;
  const io = () => cfg.io || SIDRA.ioNavegador();

  /* testes: troca rede, relógio, armazenamento e catálogo (antes do primeiro uso) */
  function configurar(o) {
    Object.keys(o).forEach(k => { cfg[k] = o[k]; });
    A = null; iniciando = null; aviso = null; tipo = null;
  }

  /* abre o armazenamento uma vez; se a UF guardada no cache não é a atual, ajusta (ver trocarUf) */
  function pronto() {
    if (iniciando) return iniciando;
    iniciando = Promise.resolve().then(() => (cfg.kv ? { kv: cfg.kv, aviso: null } : ARMAZEM.abrir('pnadc_resultados')))
      .then(x => { A = ARMAZEM.sobre(x.kv); aviso = x.aviso; tipo = x.kv.tipo; return A.kv.get('meta'); })
      .then(meta => {
        if (!meta) return A.kv.set('meta', { uf: uf().codigo });
        if (meta.uf !== uf().codigo) return invalidarCapitais().then(() => A.kv.set('meta', { uf: uf().codigo }));
        return undefined;
      }).then(() => A);
    return iniciando;
  }

  /* Capitais (N6) e regiões metropolitanas (N7) só são baixadas da UF escolhida. Trocar de UF tira do cache
     SÓ essas linhas e faz a tabela ser baixada de novo na próxima passada; o resto do cache fica como está. */
  function invalidarCapitais() {
    const tabs = listaTabelas().filter(t => t.espec.niveis.indexOf('N6') >= 0 || t.espec.niveis.indexOf('N7') >= 0);
    let cadeia = Promise.resolve();
    tabs.forEach(t => {
      cadeia = cadeia.then(() => A.lerSerie(t.tabela)).then(s => {
        if (!s || !s.linhas) return undefined;
        s.linhas = s.linhas.filter(l => l[1] !== 'N6' && l[1] !== 'N7');
        return A.kv.set('serie:' + t.tabela, s);
      }).then(() => A.estado()).then(est => {
        if (!est[t.tabela]) return undefined;
        const c = Object.assign({}, est[t.tabela], { ultimo_periodo: null, modificacao: null, quando: '' });
        return A.gravarConsulta(t.tabela, c);
      });
    });
    return cadeia;
  }

  function definirUf(codigo) {
    const nova = ufPorCodigo(codigo);
    if (!nova || nova.codigo === uf().codigo) return Promise.resolve(uf());
    ufAtual = nova;
    try { localStorage.setItem(CHAVE_UF, nova.codigo); } catch (e) { /* sem armazenamento: vale nesta aba */ }
    return pronto().then(() => invalidarCapitais()).then(() => A.kv.set('meta', { uf: nova.codigo })).then(() => nova);
  }

  function iniciarPassada(forcar) {
    ultimoErro = null;
    SIDRA.atualizar(A, uf().codigo, { io: io(), forcar: !!forcar, agora: cfg.agora, tabelas: listaTabelas() })
      .catch(e => { ultimoErro = e; if (typeof console !== 'undefined') console.error(e); });
  }

  function carregar(opc) {
    const forcar = !!(opc && opc.forcar);
    let venc = [], agendada = false;
    return pronto().then(() => A.estado()).then(est => {
      venc = SIDRA.vencidas(est, listaTabelas(), forcar, cfg.agora());
      if (venc.length && !SIDRA.emCurso()) { agendada = true; iniciarPassada(forcar); }
      const u = uf();
      return MONTAR.montar(A, u.codigo, u.sigla, u.nome, { agora: cfg.agora, indicadores: indicadores() });
    }).then(m => {
      m.atualizando = SIDRA.emCurso();
      m.agendada = agendada;
      m.vencidas = venc;
      if (ultimoErro) m.erro_passada = String(ultimoErro.message || ultimoErro);
      return m;
    });
  }

  function novidades() {
    return pronto().then(() => {
      const u = uf();
      return MONTAR.novidades(A, u.codigo, u.sigla, u.nome, { indicadores: indicadores() });
    });
  }

  /* { tipo: 'indexedDB'|'localStorage'|'memoria', aviso } -- só depois de pronto() */
  function armazenamento() { return { tipo, aviso }; }

  return { uf, ufs: () => UFS, definirUf, configurar, pronto, carregar, novidades, armazenamento, _armazem: () => A };
})();
