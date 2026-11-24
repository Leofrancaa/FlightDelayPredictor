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

  // Voo consultado no totem (placeholder — substituir por um voo real do teste)
  flight: {
    airline: 'Delta Air Lines',
    code: 'DL 1234',
    origin: 'ATL',
    dest: 'MCO',
    when: 'Sexta, 18:40',
    clock: 'Sex · 17:41',
  },

  // Dados puxados automaticamente
  auto: [
    { icon: 'storm', title: 'Clima em ATL agora (METAR)', value: 'Trovoada · vento 25 kt', detail: 'TSRA · visibilidade 3 mi', color: '#ffb020' },
    { icon: 'plane', title: 'Aeronave que fará seu voo', value: 'Chegando com +40 min', detail: 'Voo de entrada DL 877 (BOS)', color: '#ff5a5f' },
    { icon: 'chart', title: 'Atrasos da Delta hoje', value: 'Acima da média', detail: '38% dos voos vs. 21% habitual', color: '#ffb020' },
  ],

  analyzingMsgs: ['Lendo o clima do aeroporto…', 'Checando a aeronave de entrada…', 'Comparando com o histórico…', 'Calculando probabilidades…'],

  // Saída do modelo (3 classes)
  probs: [
    { label: 'Sem atraso', sub: 'menos de 15 min', p: 0.18, color: '#2fd27a' },
    { label: 'Atraso leve', sub: '15 a 30 min', p: 0.27, color: '#ffb020' },
    { label: 'Atraso grande', sub: 'mais de 30 min', p: 0.55, color: '#ff5a5f' },
  ],

  // Contribuição das features (ex.: SHAP local), já normalizada
  reasons: [
    { label: 'Aeronave de entrada atrasada', w: 0.21 },
    { label: 'Trovoada no aeroporto de origem', w: 0.14 },
    { label: 'Sexta à noite (horário de pico)', w: 0.07 },
  ],

  // Painel de partidas ao fundo (o voo do professor aparece "ON TIME" — ironia)
  board: [
    ['17:55', 'AA 2210', 'Charlotte', 'B12', 'BOARDING'],
    ['18:05', 'WN 1488', 'Nashville', 'C03', 'DELAYED 19:10'],
    ['18:20', 'UA 1702', 'Chicago ORD', 'D07', 'ON TIME'],
    ['18:30', 'DL 2391', 'New York LGA', 'A09', 'DELAYED 19:25'],
    ['18:40', 'DL 1234', 'Orlando', 'A14', 'ON TIME'],
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
  p2: { who: 'prof', audio: 'p2.mp3', text: 'Moça, esse totem aí diz se o meu voo vai atrasar?' },
  a1: { who: 'att', audio: 'a1.mp3', text: 'Diz sim, senhor. Me passa o cartão de embarque?' },
  a2: { who: 'att', audio: 'a2.mp3', text: 'Ele já puxa o clima do aeroporto e a situação do avião que vai fazer o seu voo.' },
  a3: { who: 'att', audio: 'a3.mp3', text: 'Olha… a chance maior é de atrasar mais de meia hora.' },
  p3: { who: 'prof', audio: 'p3.mp3', text: 'Mas por quê?' },
  a4: { who: 'att', audio: 'a4.mp3', text: 'Principalmente porque o avião que vai fazer o seu voo ainda está chegando atrasado, tem trovoada aqui agora, e é sexta à noite, horário de pico.' },
  p4: { who: 'prof', audio: 'p4.mp3', text: 'Noventa e quatro anos esperando… meu sogro aguenta mais meia hora. Tranquilo.' },
  p5: { who: 'prof', audio: 'p5.mp3', text: 'A minha esposa é que não.' },
};
