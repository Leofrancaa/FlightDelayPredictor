// =====================================================================
//  CONFIGURAÇÃO DA CENA — edite aqui.
//  Troque os valores do voo e das probabilidades pela saída REAL do modelo
//  para um voo do conjunto de teste. Os textos das falas ficam em LINES.
// =====================================================================

export const CFG = {
  brand: {
    title: 'Previsão de Voo',
    subtitle: 'Seu voo vai atrasar?',
    footer: 'Previsão com IA · dados BTS + METAR',
    modelNote: 'Modelo de 3 classes · horizonte de 1 h antes da partida',
  },

  // Voo REAL do conjunto de teste (saída do modelo publicada em web/public/data/voos/2024-12-16.json)
  flight: {
    airline: 'Frontier Airlines',
    code: 'F9 2886',
    origin: 'DFW',
    dest: 'MCO',
    when: 'Segunda, 19:57',
    clock: 'Seg · 18:57',
    date: '16/12/2024',
  },

  // Dados puxados automaticamente (valores reais das features do voo)
  auto: [
    { icon: 'storm', title: 'Clima em DFW agora (METAR)', value: 'Trovoada na origem', detail: 'Teto 9.000 pés · 1 h antes da partida', color: '#ffb020' },
    { icon: 'plane', title: 'Avião que fará seu voo', value: 'Ainda não decolou', detail: 'Voo de entrada já com 120 min de atraso', color: '#ff5a5f' },
    { icon: 'chart', title: 'Atrasos agora em DFW', value: '40% saindo com +30 min', detail: 'Frontier: 33% das partidas recentes', color: '#ffb020' },
  ],

  analyzingMsgs: ['Lendo o clima do aeroporto…', 'Checando o avião de entrada…', 'Comparando com o histórico…', 'Calculando a chance de atraso…'],

  // Saída do modelo (alvo: partida com atraso > 30 min)
  result: {
    p: 0.99,            // 1 h antes da partida
    threshold: 0.28,    // limiar de alerta do modelo de 1 h
    horizons: [
      { label: 'Véspera', p: 0.29, t: 0.18 },
      { label: '3 h antes', p: 0.52, t: 0.25 },
      { label: '1 h antes', p: 0.99, t: 0.28 },
    ],
    actual: 'Atraso real: 2 h 27 min',
  },

  reasons: [
    'Avião de entrada ainda não decolou (+120 min)',
    'Trovoada em DFW 1 h antes da partida',
    '40% das partidas de DFW atrasando agora',
    'Frontier: 33% das partidas recentes atrasadas',
  ],

  // Painel de partidas ao fundo (o voo do professor aparece "ON TIME" — ironia)
  board: [
    ['17:55', 'AA 2210', 'Charlotte', 'B12', 'BOARDING'],
    ['18:05', 'WN 1488', 'Nashville', 'C03', 'DELAYED 19:10'],
    ['18:20', 'UA 1702', 'Chicago ORD', 'D07', 'ON TIME'],
    ['18:30', 'DL 2391', 'New York LGA', 'A09', 'DELAYED 19:25'],
    ['19:57', 'F9 2886', 'Orlando', 'E14', 'ON TIME'],
    ['18:45', 'F9 1120', 'Denver', 'D22', 'CANCELLED'],
    ['18:55', 'DL 0560', 'Miami', 'A02', 'ON TIME'],
    ['19:05', 'B6 0418', 'Boston', 'C11', 'DELAYED 19:40'],
    ['19:15', 'NK 0931', 'Fort Lauderdale', 'D02', 'ON TIME'],
    ['19:30', 'DL 1879', 'Dallas DFW', 'A17', 'ON TIME'],
  ],
};

// Falas. Para usar áudio gravado, coloque o arquivo em public/audio/
// com o nome indicado em `audio`. Sem arquivo, usa a voz sintética do navegador.
export const LINES = {
  p1: { who: 'prof', audio: 'p1.mp3', text: 'Aniversário de noventa e quatro anos do meu sogro… Se eu chegar atrasado, não é ele que vai reclamar. É a minha esposa.' },
  p2: { who: 'prof', audio: 'p2.mp3', text: 'Moço, esse totem aí diz se o meu voo vai atrasar?' },
  a1: { who: 'att', audio: 'a1.mp3', text: 'Diz sim, senhor. Me passa o cartão de embarque?' },
  a2: { who: 'att', audio: 'a2.mp3', text: 'Ele já puxa o clima do aeroporto e a situação do avião que vai fazer o seu voo.' },
  a3: { who: 'att', audio: 'a3.mp3', text: 'Olha… a chance maior é de atrasar mais de meia hora.' },
  p3: { who: 'prof', audio: 'p3.mp3', text: 'Mas por quê?' },
  a4: { who: 'att', audio: 'a4.mp3', text: 'Principalmente porque o avião que vai fazer o seu voo ainda nem decolou, tem trovoada aqui agora, e o aeroporto inteiro já está atrasando.' },
  p4: { who: 'prof', audio: 'p4.mp3', text: 'Noventa e quatro anos esperando… meu sogro aguenta mais meia hora. Tranquilo.' },
  p5: { who: 'prof', audio: 'p5.mp3', text: 'A minha esposa é que não.' },
};
