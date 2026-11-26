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

  // Voo REAL do conjunto de teste (saída do modelo publicada em web/public/data/voos/2024-12-28.json)
  flight: {
    airline: 'American Airlines',
    code: 'AA 1455',
    origin: 'DFW',
    dest: 'LAS',
    when: 'Sábado, 13:05',
    clock: 'Sáb · 12:05',
    date: '28/12/2024',
  },

  // Dados puxados automaticamente (valores reais das features do voo)
  auto: [
    { icon: 'storm', title: 'Clima em DFW agora (METAR)', value: 'Trovoada na origem', detail: 'Rajadas de 24 kt · teto 7.500 pés', color: '#ffb020' },
    { icon: 'plane', title: 'Avião que fará seu voo', value: 'Saiu 58 min atrasado', detail: 'da cidade anterior, ainda a caminho', color: '#ff5a5f' },
    { icon: 'chart', title: 'Atrasos agora em DFW', value: '34% saindo com +30 min', detail: 'American: 33% das partidas recentes', color: '#ffb020' },
  ],

  analyzingMsgs: ['Lendo o clima do aeroporto…', 'Checando o avião de entrada…', 'Comparando com o histórico…', 'Calculando a chance de atraso…'],

  // Saída do modelo (alvo: partida com atraso > 30 min); t = limiar de alerta de cada horizonte
  result: {
    p: 0.89,
    threshold: 0.28,
    horizons: [
      { label: 'Véspera', p: 0.28, t: 0.18 },
      { label: '3 h antes', p: 0.80, t: 0.25 },
      { label: '1 h antes', p: 0.89, t: 0.28 },
    ],
    actual: 'Atraso real: 38 min',
  },

  reasons: [
    'Avião de entrada saiu 58 min atrasado',
    'Trovoada em DFW 1 h antes da partida',
    '34% das partidas de DFW atrasando agora',
    'Este voo atrasou em 33% dos últimos 7 dias',
  ],

  // Painel de partidas ao fundo (o voo do professor aparece "ON TIME" — ironia)
  board: [
    ['12:10', 'AA 2210', 'Charlotte', 'B12', 'BOARDING'],
    ['12:25', 'WN 1488', 'Nashville', 'C03', 'DELAYED 13:20'],
    ['12:40', 'UA 1702', 'Chicago ORD', 'D07', 'ON TIME'],
    ['12:50', 'DL 2391', 'Atlanta', 'E09', 'DELAYED 13:45'],
    ['13:05', 'AA 1455', 'Las Vegas', 'C14', 'ON TIME'],
    ['13:15', 'F9 1120', 'Denver', 'E22', 'CANCELLED'],
    ['13:30', 'AA 0560', 'Miami', 'A02', 'ON TIME'],
    ['13:40', 'B6 0418', 'Boston', 'E11', 'DELAYED 14:30'],
    ['13:55', 'NK 0931', 'Fort Lauderdale', 'E02', 'ON TIME'],
    ['14:10', 'AA 1879', 'Orlando', 'A17', 'ON TIME'],
  ],
};

// Falas. Para usar áudio gravado, coloque o arquivo em public/audio/
// com o nome indicado em `audio`. Sem arquivo, usa a voz sintética do navegador.
export const LINES = {
  p1: { who: 'prof', audio: 'p1.mp3', text: 'Aniversário de noventa e quatro anos do meu sogro… Se eu chegar atrasado, não é ele que vai reclamar. É a minha esposa.' },
  p2: { who: 'prof', audio: 'p2.mp3', text: 'Moço, esse totem aí diz se o meu voo vai atrasar?' },
  a1: { who: 'att', audio: 'a1.mp3', text: 'Diz sim, senhor. Me passa o cartão de embarque?' },
  a2: { who: 'att', audio: 'a2.mp3', text: 'Ele já puxa o clima do aeroporto e a situação do avião que vai fazer o seu voo. O Guis garante, hohoho.' },
  a3: { who: 'att', audio: 'a3.mp3', text: 'Olha… o Guis lamenta, mas a chance maior é de atrasar mais de meia hora. Very crazyness.' },
  p3: { who: 'prof', audio: 'p3.mp3', text: 'Mas por quê?' },
  a4: { who: 'att', audio: 'a4.mp3', text: 'Principalmente porque o avião que vai fazer o seu voo saiu atrasado da última cidade, tem trovoada aqui agora, e o aeroporto inteiro já está atrasando.' },
  p4: { who: 'prof', audio: 'p4.mp3', text: 'Noventa e quatro anos esperando… meu sogro aguenta mais meia hora. Tranquilo.' },
  p5: { who: 'prof', audio: 'p5.mp3', text: 'A minha esposa é que não.' },
  // roteiro v2 (camada C) — áudios provisórios até cada integrante gravar a própria fala
  m1: { who: 'diniz', audio: 'm1.mp3', text: 'Ch… chegamos, senhor. É… dia feio pra voar, né?' },
  m2: { who: 'diniz', audio: 'm2.mp3', text: 'Ah… boa viagem, senhor.' },
  l1: { who: 'leo', audio: 'l1.mp3', text: 'Atrasou de novo? O painel dizia no horário até agora há pouco!' },
  mt1: { who: 'motti', audio: 'mt1.mp3', text: 'Ô, senhor! Vi que o senhor tá com pressa…' },
  sa1: { who: 'sa', audio: 'sa1.mp3', text: 'Então dá uma olhada no totem ali pra saber do seu voo.' },
  p10: { who: 'prof', audio: 'p10.mp3', text: 'Obrigado, moço! Fica com Deus.' },
  p8: { who: 'prof', audio: 'p8.mp3', text: 'Se eu soubesse que existia isso, podia ter visto e saído de casa sem essa pressa toda.' },
  p6: { who: 'prof', audio: 'p6.mp3', text: 'Amor… o voo vai atrasar uns quarenta minutos. Não, não fui eu, foi o avião!' },
  p7: { who: 'prof', audio: 'p7.mp3', text: 'Mas fala pro seu pai que o presente vai chegar sequinho.' },
  p9: { who: 'prof', audio: 'p9.mp3', text: 'Se eu tivesse alunos bons na minha época, esse preditor de atraso de voos daria um bom projeto de iniciação científica.' },
  // pós-crédito: no avião
  k1: { who: 'kauai', audio: 'k1.mp3', text: 'Professor Soussa?! Rapaz… me passa seu CPF aí que eu faço a moeda agora, aqui no aviãozinho mesmo.' },
  p11: { who: 'prof', audio: 'p11.mp3', text: '…Kauai. Como é que tá lá em Cancún?' },
  z1: { who: 'zuma', audio: 'z1.mp3', text: 'Professor! Larguei vocês pela USP e não me arrependo.' },
  p13: { who: 'prof', audio: 'p13.mp3', text: '…Tá sentado na econômica do mesmo jeito, Zuma.' },
  lp1: { who: 'lopo', audio: 'lp1.mp3', text: 'Ô professor! Cheguei!' },
  p12: { who: 'prof', audio: 'p12.mp3', text: 'Consegue se atrasar mais que o avião.' },
};

export const NAMES = { prof: 'Soussa', att: 'Guis', diniz: 'Diniz', leo: 'Leo', motti: 'Motti', sa: 'Sá', kauai: 'Kauai', zuma: 'Zuma', lopo: 'Lopo' };

export const CREDITS = [
  ['Soussa', 'ele mesmo'], ['Guis', 'atendente do totem'], ['Diniz', 'motorista'],
  ['Leo “Ratito”', 'passageiro ao telefone'], ['Motti e Sá', 'portaria'],
];
