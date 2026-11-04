/* SuperC PNADC -- GLOSSÁRIO dos indicadores (25/10/2026, porte do "?" do PNS-26).
   `U.kpi(valor, rótulo, sub, classe, ajuda)` procura aqui a definição quando a
   página não passa `ajuda`: todo indicador com rótulo conhecido ganha o "?" com
   o que ele conta, sem ninguém editar a página. A busca ignora maiúsculas e
   acentos. Rótulo com o lugar no fim ("aproveitamento Rondônia", "... Brasil")
   só herda a definição das taxas de PREFIXO, que têm o mesmo sentido em
   qualquer fonte: "recusas Rondônia" na UF × Brasil é % do resumo do SIGC, e
   uma busca solta por prefixo daria a ela a definição de contagem.

   Regra: só entra definição conferida no código que faz a conta. Rótulo de
   conta que não foi conferida fica sem "?" -- definição errada é pior que
   nenhuma, porque o supervisor passa a confiar nela. Mudou a conta, mude o texto. */
'use strict';
const GLOSSARIO = (() => {
  const TXT = {
    // ---- amostra e desfechos (P.aproveitamento, paginas.js)
    'domicilios': 'Domicílios da amostra no recorte: cada entrevista de cada domicílio selecionado nos meses carregados, inclusive os que ainda não foram iniciados.',
    'classificados': 'Domicílios que já têm desfecho codificado (grupos A, B ou C). Os "não iniciados/pendentes" ficam fora.',
    'com desfecho (classificados)': 'Domicílios que já têm desfecho codificado (grupos A, B ou C). Os "não iniciados/pendentes" ficam fora.',
    'realizadas': 'Entrevistas realizadas: domicílios do grupo A (ocupados) com a entrevista feita.',
    'entrevistas realizadas': 'Entrevistas realizadas: domicílios do grupo A (ocupados) com a entrevista feita.',
    'realizadas % da amostra': 'INDICADOR PRINCIPAL. Realizadas ÷ todos os domicílios do recorte, inclusive os não iniciados e os de semana que ainda não começou. No mês em coleta é baixo por construção: a amostra inteira está no denominador desde o primeiro dia.',
    'realizadas % dos classificados': 'Realizadas ÷ domicílios já classificados (grupos A + B + C). Não é o aproveitamento: marcar ocupado como vago infla o aproveitamento, mas não este número -- a distância entre os dois denuncia a marcação inadequada.',
    'aproveitamento': 'Taxa oficial: realizadas ÷ domicílios ocupados (grupo A: realizadas, recusas, fechados e outras perdas). Domicílios vagos ou inexistentes (B e C) e os não iniciados ficam fora do denominador.',
    'ocupados (grupo a)': 'Grupo A: domicílios com morador -- realizadas, recusas, domicílios fechados e outros motivos de perda. É o denominador do aproveitamento.',
    'marcados como nao ocupados': 'Grupos B e C: vagos, de uso ocasional, não abrangidos, que não existem mais ou fora da área. Proporção sobre os classificados.',

    // ---- abordagens e prazo (Relatório de Tentativas; dados.js)
    'abordagens': 'Abordagens registradas no Relatório de Tentativas: cada visita presencial ou contato por telefone, com a data e a hora que o DMC carimbou.',
    'abordagens por domicilio': 'Abordagens ÷ domicílios abordados: quantas vezes, em média, cada domicílio foi procurado.',
    'domicilios abordados': 'Domicílios com pelo menos uma abordagem registrada.',
    'sem abordagem, semana vencida': 'Domicílios cuja semana de coleta já terminou (data de fim no relatório de Períodos) sem NENHUMA abordagem: pendência de visita -- ninguém foi lá. Não é recusa nem fechado.',
    'sem abordagem, semana em curso': 'Domicílios da semana de coleta em curso ainda sem nenhuma abordagem.',
    'semana vencida, sem visita': 'Domicílios cuja semana de coleta já terminou sem NENHUMA abordagem: pendência de visita.',
    'semana em curso, sem desfecho': 'Domicílios da semana de coleta em curso ainda sem desfecho codificado.',
    'contatos telefonicos': 'Abordagens feitas por telefone. Contato às 19h não é visita noturna: o protocolo conta turno só para visita presencial.',

    // ---- GPS
    'com gps': 'Abordagens com coordenada registrada pelo DMC. Sem coordenada é suspeita de defeito do aparelho (o DMC não deixa desligar o GPS), não de conduta.',

    // ---- prognóstico e prazos
    'dados ate': 'Último dia com abordagem ou conclusão na base. As contas de prazo partem daqui, nunca do relógio: com relatório atrasado, o relógio inventaria dias sem trabalho.',
    'hoje = ultimo dia com dado': 'Último dia com abordagem ou conclusão na base. As contas de prazo partem daqui, nunca do relógio.',
    'semanas de atraso': 'Domicílios atrás do plano ÷ domicílios de uma semana típica do mês. O plano reparte cada semana por igual nos seus dias de campo.',
    'desfechos por dia de campo': 'Domicílios que ganharam desfecho por dia de campo (segunda a sábado, menos os dias sem expediente), nos últimos 14 dias de campo.',

    // ---- produtividade e relatório
    'dias de campo': 'Pares pessoa × dia com pelo menos uma abordagem ou sessão de entrevista.',
    'abordagens por dia de campo': 'Abordagens ÷ dias de campo (pares pessoa × dia com trabalho registrado).',
    'domicilios trabalhados': 'Domicílios com pelo menos uma abordagem no período.',
    'desfechos': 'Domicílios que receberam desfecho codificado no período, pela data de conclusão (ou, sem ela, pela data da última abordagem).',

    // ---- análise de risco
    'indicios de fraude': 'Indícios da categoria fraude, de gravidade média ou alta (coordenada repetida, rajada de abordagens, deslocamento implausível, tempos idênticos, registro tardio...). Ordenam quem olhar primeiro; não condenam ninguém.',
    'indicios de desidia': 'Indícios da categoria desídia (semana vencida sem visita, fechado com uma só visita ou sem variar o turno, desfecho só por telefone...). Ordenam quem olhar primeiro; não condenam ninguém.',

    // ---- registro de supervisão e Minha Jornada
    'atividades registradas': 'Registros de atividade de supervisão (visita, verificação, notificação, justificativa...) que não foram removidos.',
    'verificacoes da amostra': 'A amostra de verificação do Plano: 2 domicílios por UPA por semana (parâmetro), em rodízio pelos entrevistadores com menos verificações.',
    'com foto': 'Registros de supervisão com foto anexada -- a prova de que a visita aconteceu.',
    'com localizacao': 'Registros de supervisão com a posição do GPS no momento do registro.',
    'dias seguidos agora': 'Dias seguidos, até hoje, com pelo menos um registro de supervisão (data local).',
    'sequencia recorde': 'A maior sequência de dias seguidos com registro de supervisão.',
    'upas com registro': 'UPAs diferentes com pelo menos um registro de supervisão.',
  };

  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const PREFIXO = ['realizadas % dos classificados', 'aproveitamento'];   // a mais longa primeiro

  /* Definição do rótulo, ou null. `rotulo` pode ser texto ou nó (aí não há definição). */
  function definicao(rotulo) {
    if (typeof rotulo !== 'string') return null;
    const r = norm(rotulo);
    if (!r) return null;
    if (TXT[r]) return TXT[r];
    // "aproveitamento Rondônia", "Realizadas % dos classificados Brasil": prefixo seguido de espaço
    for (const k of PREFIXO) if (r.startsWith(k + ' ')) return TXT[k];
    return null;
  }

  return { definicao, termos: () => Object.keys(TXT) };
})();
