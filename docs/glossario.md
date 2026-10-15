# Glossário

Siglas e termos técnicos que aparecem nos notebooks (`01_explorar_aisweb`, `02_insights_ml`) e no `module_decea`. Estão agrupados por tema. Para achar uma sigla específica, use a busca do editor (Cmd/Ctrl+F).

1. [Órgãos, fontes de dados e normas](#1-órgãos-fontes-de-dados-e-normas)
2. [Os 10 aeroportos do projeto](#2-os-10-aeroportos-do-projeto)
3. [Aeródromos e infraestrutura](#3-aeródromos-e-infraestrutura)
4. [Regras de voo e navegação](#4-regras-de-voo-e-navegação)
5. [Publicações e cartas aeronáuticas](#5-publicações-e-cartas-aeronáuticas)
6. [NOTAM](#6-notam)
7. [Meteorologia: METAR e TAF](#7-meteorologia-metar-e-taf)
8. [Voos e o VRA](#8-voos-e-o-vra)
9. [Machine learning e mineração de dados](#9-machine-learning-e-mineração-de-dados)
10. [Nomes de colunas e variáveis do código](#10-nomes-de-colunas-e-variáveis-do-código)
11. [Unidades, horários e coordenadas](#11-unidades-horários-e-coordenadas)
12. [API e organização dos dados](#12-api-e-organização-dos-dados)

---

## 1. Órgãos, fontes de dados e normas

| Termo | Significado |
|---|---|
| **ANAC** | Agência Nacional de Aviação Civil. Regula as companhias aéreas e publica o VRA. |
| **AIS** | *Aeronautical Information Service*, Serviço de Informação Aeronáutica: quem publica AIP, NOTAMs e cartas. Na ficha ROTAER, também é uma das categorias de serviço do aeródromo. |
| **AISWEB** | Portal de informação aeronáutica do DECEA (`aisweb.decea.mil.br`). A API dele é o assunto do notebook 01. Só mostra o que está vigente agora, sem histórico. |
| **Anexo 15** | Anexo da Convenção de Chicago (ICAO) que regula os serviços de informação aeronáutica. É dele a regra de que informação com mais de 3 meses de duração vira suplemento da AIP, e não NOTAM. |
| **CGNA** | Centro de Gerenciamento da Navegação Aérea, órgão do DECEA que planeja o fluxo de tráfego do país (por exemplo, reduz a quantidade de pousos por hora num aeroporto com nevoeiro). |
| **CRCEA-SE** | Centro Regional de Controle do Espaço Aéreo Sudeste. Aparece no campo `jur` (jurisdição) da ficha de Guarulhos. |
| **DECEA** | Departamento de Controle do Espaço Aéreo, do Comando da Aeronáutica. Responsável pelo controle de tráfego aéreo e pela informação aeronáutica no Brasil. |
| **DIRAD** | Diretoria de Administração da Aeronáutica. Exemplo de órgão com indicador próprio (`SBEA`) usado só em NOTAM. |
| **GTS** | *Global Telecommunication System*, rede da Organização Meteorológica Mundial por onde circulam os boletins meteorológicos. O IEM coleta os METARs dali. |
| **ICA** | Instrução do Comando da Aeronáutica, o nome das normas do DECEA. A **ICA 100-12** (Regras do Ar) define os limites de VMC usados no projeto. |
| **ICAO** | *International Civil Aviation Organization* (em português, OACI), agência da ONU que padroniza a aviação civil: códigos de aeroportos, formato do METAR, do NOTAM etc. |
| **ICAO Doc 8126** | Manual de Serviços de Informação Aeronáutica da ICAO, citado no notebook 02 como referência dos códigos Q do NOTAM. |
| **IEM** | *Iowa Environmental Mesonet*, da Iowa State University. Arquivo público com METAR histórico de aeroportos do mundo todo. É a fonte de METAR do notebook 02. |
| **REDEMET** | Rede de Meteorologia do Comando da Aeronáutica. Fonte oficial do DECEA para METAR e TAF históricos (`api-redemet.decea.mil.br`, exige chave gratuita). |
| **VRA** | Voo Regular Ativo: base da ANAC com todos os voos regulares, horários previstos e reais, e situação (realizado ou cancelado). Ver [seção 8](#8-voos-e-o-vra). |

## 2. Os 10 aeroportos do projeto

Os 10 com mais partidas domésticas em 2025 (lista `AEROPORTOS` do notebook 02). Os dados usam o código **ICAO** (4 letras); o **IATA** (3 letras) é o das passagens, que o texto às vezes usa (GRU, CGH, BSB, POA).

| ICAO | IATA | Aeroporto | Atende |
|---|---|---|---|
| SBGR | GRU | Guarulhos | São Paulo (SP) |
| SBSP | CGH | Congonhas | São Paulo (SP) |
| SBKP | VCP | Viracopos | Campinas (SP) |
| SBCF | CNF | Confins | Belo Horizonte (MG) |
| SBBR | BSB | Brasília | Brasília (DF) |
| SBGL | GIG | Galeão | Rio de Janeiro (RJ) |
| SBRJ | SDU | Santos Dumont | Rio de Janeiro (RJ) |
| SBPA | POA | Salgado Filho | Porto Alegre (RS) |
| SBCT | CWB | Afonso Pena | Curitiba (PR) |
| SBRF | REC | Guararapes | Recife (PE) |

Outros indicadores citados: `SDJV` (aeródromo pequeno usado no notebook 01 para mostrar a resposta de um local sem estação meteorológica: METAR e TAF vazios), `SBEA` (DIRAD) e `SBBS` (FIR Brasília).

## 3. Aeródromos e infraestrutura

| Termo | Significado |
|---|---|
| **Aeródromo (AD)** | Qualquer área preparada para pouso e decolagem, de um grande aeroporto a uma pista de terra numa fazenda. **Aeroporto** é o aeródromo público com instalações para passageiros e carga. |
| **Heliponto (HP)** | Aeródromo só para helicópteros. |
| **HD** | Tipo que aparece em 9 registros da rota `localidades`, sem documentação na API. |
| **NOT** | Tipo da rota `localidades` para indicadores usados só em NOTAM: são órgãos, não lugares (ex.: `SBEA` = DIRAD). |
| **Indicador ICAO** | Código de 4 letras de um aeródromo ou órgão. No Brasil começa com S; os aeroportos principais usam `SB`. Nas respostas da API aparece como `icaoCode`, `AeroCode`, `IcaoCode` ou `icaoairport_id`. |
| **ROTAER** | Manual Auxiliar de Rotas Aéreas: publicação do DECEA com a ficha de cada aeródromo brasileiro (pistas, frequências, horários, auxílios). A rota `rotaer` da AISWEB devolve essa ficha. |
| **FIR** | *Flight Information Region*, Região de Informação de Voo: as grandes áreas em que o espaço aéreo é dividido. O Brasil tem cinco: Amazônica (SBAZ), Brasília (SBBS), Curitiba (SBCW), Recife (SBRE) e Atlântico (SBAO). NOTAM sem aeródromo costuma valer para uma área dentro de uma FIR. |
| **Pista (RWY)** | *Runway*. O número vem do rumo magnético dividido por 10: a pista `10L/28R` aponta para ~100° num sentido e ~280° no outro. `L`, `R` e `C` (esquerda, direita, centro) distinguem pistas paralelas. |
| **Cabeceira (THR)** | *Threshold*, início da parte da pista usada para pouso. Cada pista tem duas, uma por sentido (campo `thr` da ficha). |
| **Pista de táxi (TWY)** | *Taxiway*, caminho entre a pista e o pátio. |
| **PCN** | *Pavement Classification Number*: resistência do pavimento, ou seja, que aviões a pista aguenta. Coluna `resistencia_pcn` no notebook 01. |
| **Distâncias declaradas** | Comprimento de pista disponível para cada operação, por cabeceira: TORA (corrida de decolagem), TODA (decolagem), ASDA (aceleração e parada) e LDA (pouso). |
| **`altFt`** | Elevação do aeródromo, em pés. |
| **`typeUtil`** | Utilização do aeródromo: `PUB` público, `MIL` militar, `PRIV` privado. Guarulhos é `PUB/MIL`. |
| **`typeOpr`** | Tipo de operação permitida: `VFR`, `IFR` ou ambos. |
| **`cat`** (ficha ROTAER) | Categoria do aeródromo. `INTL` = internacional. |
| **COM / NAV / MET / AIS** | Categorias de serviço da ficha ROTAER: comunicações (frequências), auxílios à navegação, meteorologia e informação aeronáutica. |
| **Órgão ATS** | Órgão de serviço de tráfego aéreo (*Air Traffic Services*): torre, controle de aproximação, centro de controle de área. |
| **Torre (TWR)** | Controla pousos, decolagens e o tráfego em volta do aeródromo. |
| **Solo (GND)** | Controla o táxi das aeronaves no chão. |
| **Tráfego** | Frequência de autorização de tráfego (*clearance delivery*): passa ao piloto a rota autorizada antes de o avião sair do pátio. |
| **APP** | Controle de Aproximação: cuida de chegadas e saídas na área terminal em volta dos aeroportos. |
| **ACC** | Centro de Controle de Área: controla os voos em rota, entre as áreas terminais. |
| **ATIS** | *Automatic Terminal Information Service*: gravação contínua com o tempo, a pista em uso e avisos do aeroporto. |
| **AFIS** | *Aerodrome Flight Information Service*: em aeródromos sem torre, um operador passa informações ao piloto, mas não dá autorizações. |
| **CTR** | Zona de controle (*Control Zone*): espaço aéreo controlado em volta de um aeródromo, do solo até uma altitude definida. |
| **FIZ** | Zona de Informação de Voo (*Flight Information Zone*): o equivalente da CTR em aeródromos com AFIS. |
| **Indicativo** | *Callsign*, o nome usado no rádio ("Guarulhos", "São Paulo"). |
| **Hub** | Aeroporto concentrador, onde as companhias fazem conexões (GRU, CGH, BSB). Um problema num hub se espalha pela malha. |
| **Malha (aérea)** | O conjunto de voos programados e as ligações entre aeroportos, visto como uma rede. |

## 4. Regras de voo e navegação

| Termo | Significado |
|---|---|
| **VFR** | *Visual Flight Rules*, regras de voo visual: o piloto navega e evita os outros aviões olhando para fora. Só é permitido em VMC. |
| **IFR** | *Instrument Flight Rules*, regras de voo por instrumentos: o voo segue procedimentos publicados e é separado dos outros pelo controle. Voos de linha aérea são IFR. |
| **VMC** | *Visual Meteorological Conditions*: tempo bom o bastante para VFR. Em aeródromo controlado (ICA 100-12): visibilidade ≥ 5 km **e** teto ≥ 1.500 ft. |
| **IMC** | *Instrument Meteorological Conditions*: o contrário de VMC (visibilidade < 5 km **ou** teto < 1.500 ft). O aeroporto continua operando, mas só por instrumentos e com menos pousos por hora. É a flag `imc` do projeto. |
| **Mínimos** | Visibilidade e teto mínimos para executar um procedimento de aproximação. Abaixo deles, o avião não pode pousar. A flag `abaixo_minimos` do projeto usa visibilidade < 800 m ou teto < 200 ft. |
| **ILS** | *Instrument Landing System*: sistema de rádio que guia o avião no alinhamento e na rampa de descida até a pista. É o procedimento mais preciso nos aeroportos grandes. |
| **CAT I** | Categoria mais comum de ILS: permite descer até 200 ft acima da pista com visibilidade de 800 m (ou 550 m de alcance visual na pista). CAT II e III vão mais baixo, mas exigem equipamento e tripulação certificados. |
| **IM** | *Inner Marker*, radiobaliza interna do ILS (75 MHz). Aparece na lista de auxílios de Guarulhos. |
| **DME** | *Distance Measuring Equipment*: informa a distância até a estação. Costuma vir junto com ILS ou VOR (`ILS/DME`, `VOR/DME`). |
| **VOR** | *VHF Omnidirectional Range*: radiofarol que indica ao piloto em que direção ele está em relação à estação. |
| **NDB** | *Non-Directional Beacon*: radiofarol mais antigo e mais simples que o VOR. |
| **PAPI** | *Precision Approach Path Indicator*: conjunto de luzes ao lado da pista que mostra se o avião está acima, abaixo ou na rampa certa de descida. |
| **RNAV** | *Area Navigation*: navegação por coordenadas (GPS e outros sensores), sem precisar voar de radiofarol em radiofarol. Aparece no nome das SIDs e STARs (ex.: `RNAV AMVUL 6A RWY 10L`). |
| **Waypoint / fixo** | Ponto geográfico com nome (em geral 5 letras, como `AMVUL`) usado para montar rotas e procedimentos. Rota `waypoints` da AISWEB. |
| **Procedimento IFR** | Trajetória publicada que leva o avião até a pista (ou da pista até a rota) por instrumentos. No notebook 02, "aeródromo com procedimento IFR" = aeródromo que tem carta IAC. |
| **Área proibida (P)** | Espaço aéreo onde o voo é vetado. |
| **Área restrita (R)** | Espaço aéreo onde o voo só é permitido sob certas condições (ex.: fora do horário de um exercício militar). |
| **Área perigosa (D)** | Espaço aéreo com atividade que pode ser perigosa (balão, show pirotécnico, ultraleve), mas onde o voo não é proibido. |
| **PJE** | *Parachute Jumping Exercise*, salto de paraquedas. Boa parte dos NOTAMs de área restrita temporária. |
| **RPA** | *Remotely Piloted Aircraft*, aeronave remotamente pilotada (drone). |

## 5. Publicações e cartas aeronáuticas

| Termo | Significado |
|---|---|
| **AIP** | *Aeronautical Information Publication*: publicação oficial do país com toda a informação aeronáutica permanente (aeródromos, espaço aéreo, regras). Rota `pub`. |
| **AIP SUP** | Suplemento da AIP: mudanças temporárias longas (mais de 3 meses) ou com muito texto e gráficos. Rota `suplementos`. |
| **AMDT** | *Amendment*, emenda à AIP ou a uma carta. Coluna `amdt` das cartas. |
| **AIRAC** | *Aeronautical Information Regulation and Control*: calendário mundial de ciclos de 28 dias, com datas fixas para as mudanças entrarem em vigor. Os suplementos do tipo `airac` seguem esse calendário. |
| **Infotemp** | Informação temporária de aeródromo publicada na AISWEB (rota `infotemp`). |
| **Carta aeronáutica** | Mapa padronizado para uso em voo. A rota `cartas` dá o link do PDF de cada uma. |

Tipos de carta (coluna `tipo` da rota `cartas`):

| Sigla | Em inglês | O que é |
|---|---|---|
| **ADC** | Aerodrome Chart | Carta de aeródromo: planta com pistas, pistas de táxi e pátios |
| **AGMC** | Aerodrome Ground Movement Chart | Carta de movimento no solo, com mais detalhe do táxi |
| **AOC** | Aerodrome Obstacle Chart | Carta de obstáculos do aeródromo |
| **ARC** | Area Chart | Carta de área: rotas dentro da área terminal |
| **ENRC** | Enroute Chart | Carta de rota: as aerovias entre regiões |
| **IAC** | Instrument Approach Chart | Carta de aproximação por instrumentos |
| **PDC** | Parking/Docking Chart | Carta de estacionamento de aeronaves |
| **SID** | Standard Instrument Departure | Saída padrão por instrumentos: trajeto da decolagem até a rota |
| **STAR** | Standard Terminal Arrival Route | Chegada padrão: trajeto da rota até o início da aproximação |
| **VAC** | Visual Approach Chart | Carta de aproximação visual |

## 6. NOTAM

| Termo | Significado |
|---|---|
| **NOTAM** | *Notice to Airmen*: aviso de mudança temporária ou não prevista que afeta o voo (pista fechada, obstáculo novo, área restrita ativada, auxílio fora de serviço). Rota `notam`. |
| **NOTAMN / NOTAMR / NOTAMC** | Tipo do NOTAM (campo `tp`): **N**ovo, **R**eplace (substitui o NOTAM indicado em `ref`) e **C**ancel (cancela). |
| **Código Q** | Código de 5 letras que começa com Q e resume o NOTAM: letras 2–3 = **assunto**, letras 4–5 = **condição**. Ex.: `QOBCE` = obstáculo (`OB`) erguido (`CE`). Os sistemas de briefing usam esse código para filtrar o que mostrar ao piloto. |
| **XX** | No código Q, "não classificado": o assunto (ou a condição) só está no texto livre. |
| **PERM** | Fim de vigência permanente (no campo `c`). |
| **Regra dos 90 dias** | Pelo Anexo 15, informação que vai durar mais de 3 meses deveria virar AIP SUP. Por isso a vigência dos NOTAMs se amontoa logo antes dos 90 dias. |
| **Briefing** | Conjunto de informações (NOTAMs, meteorologia) que o piloto consulta antes do voo. |
| **NOTAM overload** | Problema conhecido na aviação: o piloto recebe tantos NOTAMs por voo que os importantes se perdem no meio. |

Campos da rota `notam`:

| Campo | Significado |
|---|---|
| `n` | Número do NOTAM (série + número/ano) |
| `tp` | Tipo: `NOTAMN`, `NOTAMR` ou `NOTAMC` |
| `ref` | NOTAM substituído ou cancelado |
| `cod` | Código Q |
| `cat` | Categoria (ver abaixo) |
| `b` / `c` | Início e fim da vigência, no formato `AAMMDDhhmm` UTC; `c` pode ser `PERM` |
| `d` | Horários de atividade dentro da vigência |
| `e` | Texto do NOTAM |
| `f` / `g` | Limites inferior e superior (altitude) |
| `geo` | Centro e raio da área afetada. `1707S04911W014` = 17°07'S, 49°11'W, raio de 14 NM |
| `icaoairport_id` | Aeródromo do NOTAM. Vazio = NOTAM de espaço aéreo |

Categorias (campo `cat`). A API não documenta esses valores; os significados abaixo seguem os domínios da ICAO e batem com os assuntos encontrados em cada grupo:

| Categoria | Significado |
|---|---|
| **NAV** | Avisos à navegação e restrições de espaço aéreo: áreas restritas e perigosas, saltos, drones, balões. É o maior grupo. |
| **AGA** | *Aerodromes, Air Routes and Ground Aids*: aeródromos e infraestrutura no solo (pistas, pistas de táxi, iluminação). |
| **ATM** | *Air Traffic Management*: organização do espaço aéreo, procedimentos e serviços de tráfego. |
| **CNS** | *Communication, Navigation and Surveillance*: frequências, radares e auxílios como ILS e VOR. |
| **OTR** | Outros. |

Assuntos mais comuns (letras 2–3 do código Q):

| Código | Assunto | Código | Assunto |
|---|---|---|---|
| `RT` | área restrita temporária | `MR` | pista |
| `WP` | salto de paraquedas | `WL` | balão livre |
| `OB` | obstáculo | `WG` | voo de planador |
| `XX` | não classificado (texto livre) | `PI` | procedimento de aproximação por instrumentos |
| `WU` | voo de drone (RPA) | `MX` | pista de táxi |
| `FA` | aeródromo | `NM` | VOR/DME |
| `RD` | área perigosa | `WE` | exercícios |
| `RR` | área restrita | `LP` | PAPI |
| `RP` | área proibida | `SF` | AFIS |
| `FM` | serviço meteorológico | `FF` | contraincêndio e salvamento |

Condições comuns (letras 4–5): `LC` fechado, `AS` fora de serviço, `CA` ativado, `CE` erguido, `CH` alterado.

Abreviaturas que aparecem no texto (campo `e`):

| Abreviatura | Significado |
|---|---|
| `AMSL` | acima do nível médio do mar |
| `BDRY` | limite (*boundary*) |
| `COORD` | coordenadas |
| `EXER` | exercício |
| `FLT` | voo (*flight*) |
| `REF` | referência |
| `SUBJ AUTH/COOR` | sujeito a autorização/coordenação do órgão citado em seguida |
| `U/S` | fora de serviço (*unserviceable*) |
| `VER` | vertical |
| `WI` | dentro de (*within*) |

`ACC`, `APP`, `CTR`, `FIZ`, `TWR` e `TWY` estão na [seção 3](#3-aeródromos-e-infraestrutura).

## 7. Meteorologia: METAR e TAF

| Termo | Significado |
|---|---|
| **METAR** | Boletim meteorológico regular de aeródromo (*Meteorological Aerodrome Report*). No Brasil sai a cada hora cheia, num formato fixo de códigos (exemplo abaixo). |
| **SPECI** | Boletim especial, emitido fora da hora cheia quando o tempo muda de forma significativa. O IEM tira o prefixo, então o projeto reconhece o SPECI pelo minuto diferente de zero e o descarta nas análises. |
| **TAF** | *Terminal Aerodrome Forecast*: previsão do tempo para o aeródromo nas próximas horas (em geral de 12 a 30 h). A rota `met` traz o TAF mais recente. |
| **Teto** | Altura da base da camada de nuvens mais baixa que cobre metade do céu ou mais (`BKN` ou `OVC`), ou da visibilidade vertical (`VV`). Sem camada assim, o projeto considera o teto ilimitado (`99999`). |
| **Ponto de orvalho** | Temperatura em que o ar ficaria saturado. Quanto mais perto da temperatura do ar, mais úmido: diferença pequena favorece nevoeiro. |
| **Spread** | Temperatura menos ponto de orvalho. Variável criada no notebook 02 (seção 8.2). |
| **QNH** | Pressão ajustada ao nível médio do mar, em hPa, usada para acertar o altímetro. Queda de pressão costuma anteceder mudança de tempo. |
| **Rajada** | Pico de vento acima da velocidade média. Rajadas fortes, sobretudo de través, impedem pouso e decolagem mesmo com céu limpo (caso de 10/12/2025). |
| **Nevoeiro × névoa** | Os dois são gotículas de água no ar. **Nevoeiro** (`FG`) derruba a visibilidade para menos de 1.000 m; **névoa úmida** (`BR`) deixa entre 1.000 e 5.000 m. |
| **Cumulonimbus (CB)** | Nuvem de trovoada, de grande desenvolvimento vertical. |
| **Nowcasting** | Previsão de curtíssimo prazo (de 0 a ~6 h), feita a partir do estado atual. |
| **Persistência** | Baseline de previsão do tempo: "daqui a X horas vai estar igual a agora". Como o tempo muda devagar, é difícil de bater. |

Um METAR real do notebook 01, decodificado:

```
METAR SBGR 061100Z 07008KT 5000 BR OVC003 18/18 Q1020=
```

| Trecho | Significado |
|---|---|
| `METAR` | Tipo do boletim |
| `SBGR` | Aeródromo (Guarulhos) |
| `061100Z` | Dia 06, 11:00 UTC (`Z` = UTC) |
| `07008KT` | Vento de 070° (direção de onde vem) a 8 kt |
| `5000` | Visibilidade de 5.000 m |
| `BR` | Névoa úmida |
| `OVC003` | Céu encoberto a 300 ft, ou seja, teto de 300 ft |
| `18/18` | Temperatura 18 °C, ponto de orvalho 18 °C (ar saturado) |
| `Q1020` | QNH de 1020 hPa |
| `=` | Fim da mensagem |

Com teto de 300 ft (abaixo de 1.500 ft), esse boletim é **IMC**. Não está **abaixo dos mínimos**, porque o teto passa de 200 ft e a visibilidade, de 800 m.

Códigos que o `module_decea/metar.py` decodifica:

| Código | Significado |
|---|---|
| `dddffKT` | Vento: direção de onde sopra (graus) e velocidade (nós). `27015KT` = de 270° a 15 kt |
| `G` | Rajada. `27015G35KT` = rajadas de 35 kt |
| `VRB` | Direção do vento variável |
| `020V100` | Direção variando entre 020° e 100° |
| 4 dígitos | Visibilidade em metros. `9999` = 10 km ou mais |
| `FEW` / `SCT` / `BKN` / `OVC` | Nuvens cobrindo 1–2, 3–4, 5–7 e 8 oitavos do céu. Seguidas da altura em centenas de pés: `BKN010` = 1.000 ft |
| `VV` | Visibilidade vertical: o céu não aparece (nevoeiro denso, por exemplo) |
| `///` | Altura não informada |
| `NSC` | Sem nuvens significativas |
| `CAVOK` | *Ceiling And Visibility OK*: visibilidade ≥ 10 km, sem nuvens abaixo de 5.000 ft, sem CB e sem fenômeno significativo. O projeto registra visibilidade 9999 e teto 99999 |
| `TT/DD` | Temperatura e ponto de orvalho em °C. `M` = negativo (`M02` = −2 °C) |
| `Qpppp` | QNH em hPa |
| `RMK` | Observações no fim do boletim (o código ignora o que vem depois) |
| `TEMPO` / `BECMG` | No fim do METAR, tendência para as próximas 2 h (o código também ignora) |
| `NIL` | Boletim ausente (descartado) |

Fenômenos de tempo:

| Código | Significado |
|---|---|
| `TS` | Trovoada |
| `RA` | Chuva |
| `SH` | Pancada (chuva forte e rápida, de nuvem convectiva). `SHRA` = pancada de chuva |
| `DZ` | Chuvisco |
| `FG` | Nevoeiro |
| `BR` | Névoa úmida |
| `MI` / `BC` / `PR` | Prefixos do nevoeiro: baixo, em bancos, parcial |
| `VC` | Nas vizinhanças (entre 8 e 16 km do aeródromo). `VCTS` = trovoada nas vizinhanças |
| `+` / `-` | Intensidade forte / fraca. `+TSRA` = trovoada com chuva forte |

Termos que só aparecem no TAF:

| Código | Significado |
|---|---|
| `0606/0712` | Validade: do dia 06 às 06 UTC até o dia 07 às 12 UTC |
| `TN` / `TX` | Temperatura mínima / máxima prevista, com o horário. `TX23/0618Z` = 23 °C no dia 06 às 18 UTC |
| `TEMPO` | Variações temporárias dentro do período indicado |
| `BECMG` | *Becoming*: mudança gradual para a condição indicada |
| `PROB30` | 30% de probabilidade da condição indicada |

## 8. Voos e o VRA

| Termo | Significado |
|---|---|
| **VRA** | Voo Regular Ativo, base da ANAC com um CSV por mês (~25 MB). Cada linha é uma etapa de voo, com horários previsto e real de partida e chegada. Lida por `module_decea/vra.py`. |
| **Voo regular** | Voo de linha com horário publicado e vendido ao público, em oposição a voos extras e fretamentos. |
| **Código DI** | Dígito identificador do tipo de voo. `0` = etapa regular, o filtro do projeto. Os outros valores (1–9, D, E) marcam voos extras, fretamentos, retornos etc. |
| **Código Tipo Linha** | `N` = doméstica de passageiros (o filtro do projeto), `I` = internacional. `C` e `G` são linhas cargueiras. |
| **Sigla ICAO da empresa** | Código de 3 letras da companhia: `AZU` Azul, `GLO` Gol, `TAM` LATAM Brasil, entre outras. |
| **Equipamento** | Modelo da aeronave (coluna "Modelo Equipamento", renomeada para `aeronave`). |
| **Partida/chegada prevista e real** | Horário programado e horário em que de fato aconteceu. O atraso é a diferença entre os dois. |
| **Atraso > 30 min** | Critério da ANAC nos relatórios de pontualidade: o voo conta como atrasado se partiu mais de 30 min depois do previsto. Coluna `atrasado_30`. |
| **Cancelado** | "Situação Voo" = `CANCELADO` (o resto é `REALIZADO`). |
| **Propagação de atraso** | Um atraso empurra os voos seguintes do mesmo avião e da mesma tripulação. Por isso a taxa de atraso cresce ao longo do dia. |
| **Disrupção** | Período em que a operação normal se rompe, com muitos atrasos e cancelamentos ao mesmo tempo (ex.: 10/12/2025). |
| **Programação** | Grupo de variáveis da seção 8.1 do notebook 02 conhecidas antes do voo: empresa, rota, horário, avião, assentos, número de partidas na hora. |
| **Fuso horário do VRA** | O arquivo não diz, mas os horários estão no horário oficial de Brasília, que até fev/2019 tinha horário de verão (UTC−2 de outubro/novembro a fevereiro). O METAR está em UTC. Prova: no início do horário de verão, os voos de Recife, Salvador, Fortaleza, Belém e Manaus (sem horário de verão) não mudam de horário no VRA, e só os internacionais de GRU (que seguem o UTC) andam 1 h. Por isso o projeto converte com o fuso `America/Sao_Paulo` (`para_utc` em `features.py`), que soma 2 h no verão até 2019 e 3 h no resto. Somar 3 h fixas desalinharia o clima em 1 h justo na época de trovoadas. |

### 8.1 Problemas nos dados da ANAC

Medidos nos voos regulares domésticos que saem dos 10 aeroportos (planilha `reports/qualidade_dados.xlsx`).

| Problema | O que acontece | Tratamento |
|---|---|---|
| **Jun e jul de 2014 vazios** | Os arquivos da ANAC só têm o cabeçalho (desde 2022, sem como recuperar). | Fora (`PERIODOS_ANOMALOS`). |
| **Partida real em branco (out/2015 a mar/2018)** | 45% a 61% dos voos realizados sem partida real; por companhia, TAM ~80%, Avianca ~78%, Gol ~69%, Azul ~17%. A coluna de situação da partida também vem vazia. Os vazios não são aleatórios: entre os voos com horário a taxa de atraso > 30 min fica em 10–21% (alta demais) e, contando os vazios como "no horário", em 3–10% (baixa demais). Além disso a Gol quase some de ago/2017 a jan/2018. | O período inteiro fica fora. Antes só ago/2017 a mar/2018 era excluído. |
| **Cancelamentos 2011 a mar/2018** | 4% a 19% dos voos programados, contra 1% a 3% depois. Parece mudança de critério da ANAC (não confirmado). | Cancelados não entram no alvo, mas mexem nas variáveis de demanda programada e de voo de chegada cancelado. O treino compara "todos os meses válidos desde 2011" com "só desde abr/2018". |
| **Horário de verão (até fev/2019)** | Ver "Fuso horário do VRA". | Conversão com `America/Sao_Paulo`. |
| **Pandemia (2020–2021)** | Malha e atrasos atípicos. | Fora. |
| **Voo de chegada sem partida real** | Antes da correção, um voo de chegada cancelado ou sem registro era tratado como "ainda no solo", com atraso falso crescendo com o tempo. | Agora vira desconhecido; só conta como "preso no solo" o voo que decolou depois do instante de referência. |

## 9. Machine learning e mineração de dados

### Tipos de problema

| Termo | Significado |
|---|---|
| **Situação-problema** | O problema concreto (operacional, de negócio) que motiva o modelo, descrito em termos do mundo real antes de virar uma tarefa de ML. |
| **Aprendizado supervisionado** | O modelo aprende a partir de exemplos com a resposta certa (o alvo). Classificação e regressão são supervisionadas. |
| **Aprendizado não supervisionado** | Não há alvo; o modelo procura estrutura nos dados, como grupos parecidos. |
| **Variável-alvo** | O que se quer prever (`y`, *target*). Ex.: `atrasado_30`, `cancelado`, o assunto do NOTAM. |
| **Variável / feature** | Cada informação de entrada do modelo (atributo, preditor). Ex.: hora prevista, rajada na origem. |
| **Variável categórica** | Variável com categorias sem ordem (empresa, aeroporto, modelo do avião). |
| **Classificação binária** | Prever uma de duas classes (atrasa / não atrasa). |
| **Classificação multiclasse** | Prever uma entre várias classes (o assunto do NOTAM). |
| **Classificação de texto / NLP** | Classificação em que a entrada é texto livre. NLP = *Natural Language Processing*, processamento de linguagem natural. |
| **Série temporal** | Dados ordenados no tempo, em que o valor de agora depende dos anteriores (os METARs de hora em hora de um aeroporto). |
| **Agrupamento (clustering)** | Tarefa não supervisionada de juntar exemplos parecidos em grupos (ex.: tipos de dia de disrupção). |

### Avaliação

| Termo | Significado |
|---|---|
| **Treino e teste** | O modelo aprende com os dados de treino e é avaliado em dados de teste que ele nunca viu. |
| **Divisão temporal** | Treino com o passado e teste com o futuro (no projeto, jan–set × out–dez). Evita que o modelo "veja o futuro". |
| **Vazamento de dados** | *Data leakage*: informação que não estaria disponível na hora da previsão vaza para o treino e infla o resultado. Ex.: usar o METAR do destino na hora da chegada, ou o mesmo texto de NOTAM no treino e no teste. |
| **Validação cruzada** | Divide os dados em k partes, treina em k−1 e testa na que sobrou, repetindo k vezes. O notebook usa 5 partes. |
| **StratifiedKFold** | Validação cruzada que mantém a proporção de cada classe em todas as partes. |
| **`cross_val_predict`** | Devolve, para cada exemplo, a previsão feita pelo modelo que não o viu no treino. |
| **Baseline** | Modelo simples de referência; o modelo final precisa superá-lo. Ex.: chutar a classe mais comum, persistência, ou só as variáveis de programação. |
| **Classe rara / desbalanceamento** | Quando uma classe é muito menos frequente que a outra (7,2% de atrasos, 1,7% de cancelamentos). A acurácia engana nesses casos: prever "nunca atrasa" já acerta 93%. |
| **Prevalência** | Proporção de positivos na base. É o valor da PR-AUC de um modelo que chuta ao acaso. |
| **Lag** | Valor de uma variável num momento anterior. `atraso_origem_lag2` = taxa de atraso da origem 2 h antes. |
| **Horizonte** | Com quanto tempo de antecedência se prevê. Na seção 8.2, 3 h. |

### Métricas

| Termo | Significado |
|---|---|
| **Precisão** | Dos que o modelo marcou como positivos, quantos eram de fato. |
| **Revocação (recall)** | Dos positivos de verdade, quantos o modelo encontrou. |
| **F1** | Média harmônica entre precisão e revocação, para um limiar fixo (no notebook, probabilidade > 0,5). Vai de 0 a 1. |
| **F1-macro** | Média simples do F1 de cada classe; dá o mesmo peso às classes raras e às comuns. |
| **`classification_report`** | Tabela do scikit-learn com precisão, revocação, F1 e *support* (número de exemplos) de cada classe. |
| **ROC-AUC** | Área sob a curva ROC. Mede se o modelo **ordena** bem: é a chance de um positivo sorteado receber nota maior que um negativo sorteado. 0,5 = chute, 1 = perfeito. Não depende de limiar. |
| **PR-AUC** | Área sob a curva precisão × revocação, calculada no notebook com `average_precision_score`. Mais informativa que a ROC-AUC em classe rara. O chute vale a prevalência. |
| **Probabilidade prevista** | Saída de `predict_proba`: a nota de 0 a 1 que o modelo dá para a classe positiva. |
| **Limiar** | Valor de corte que transforma a probabilidade em sim/não. |

### Modelos e técnicas

| Termo | Significado |
|---|---|
| **Regressão logística** | Modelo linear que dá a probabilidade de cada classe. No notebook, `C=10` (inverso da regularização: quanto maior, menos regularizado) e `class_weight="balanced"` (classes raras ganham mais peso no treino). |
| **Árvore de decisão** | Modelo que divide os dados em regras sucessivas do tipo "rajada ≥ 25 kt?". |
| **Gradient boosting** | Sequência de árvores pequenas em que cada uma corrige os erros das anteriores. Costuma ser o mais forte em dados tabulares. |
| **`HistGradientBoostingClassifier`** | Gradient boosting do scikit-learn que agrupa os valores em faixas (histogramas), o que o torna rápido em bases grandes. Aceita valores ausentes e, com `categorical_features="from_dtype"`, usa direto as colunas categóricas do pandas. |
| **TF-IDF** | *Term Frequency–Inverse Document Frequency*: transforma texto em números. Cada termo pesa mais quanto mais aparece no documento e menos aparece nos outros. `sublinear_tf` amortece termos muito repetidos; `min_df=2` descarta termos que aparecem num documento só. |
| **n-grama** | Sequência de n itens. De palavras: `(1, 2)` = palavras soltas e pares. De caracteres (`char_wb`): pedaços de 3 a 5 letras dentro de cada palavra, o que ajuda com abreviaturas e erros de digitação. |
| **Token** | Unidade do texto depois de quebrado (palavra, número). A função `limpar` troca todo número pelo token `0`. |
| **Pipeline** | Encadeia etapas (vetorizar o texto, depois classificar) num objeto só (`make_pipeline`). `make_union` junta lado a lado as features de dois vetorizadores. |
| **Importância de variáveis** | Quanto cada variável contribui para as previsões do modelo. |
| **SHAP** | *SHapley Additive exPlanations*: explica cada previsão individual mostrando quanto cada variável puxou a probabilidade para cima ou para baixo. |

## 10. Nomes de colunas e variáveis do código

| Nome | Significado |
|---|---|
| `o_` / `d_` | Prefixo das variáveis de clima da **origem** e do **destino** (ex.: `o_trovoada`, `d_vis_m`) |
| `vis_m` | Visibilidade em metros (9999 = 10 km ou mais) |
| `teto_ft` | Teto em pés (99999 = sem teto) |
| `vento_dir`, `vento_kt`, `rajada_kt` | Direção do vento (graus), velocidade e rajada (nós) |
| `temp_c`, `orvalho_c`, `qnh` | Temperatura e ponto de orvalho (°C), QNH (hPa) |
| `trovoada`, `chuva`, `nevoeiro`, `nevoa`, `cb` | Fenômeno presente no boletim (verdadeiro/falso). `trovoada` inclui `VCTS` |
| `imc`, `abaixo_minimos` | Flags derivadas (ver [seção 4](#4-regras-de-voo-e-navegação)) |
| `speci` | Boletim fora da hora cheia |
| `hora_utc`, `hora_local` | Hora em UTC e em horário de Brasília |
| `di`, `tipo_linha`, `empresa`, `aeronave`, `assentos`, `situacao` | Colunas do VRA renomeadas em `vra.py` |
| `partida_prev`, `partida_real`, `chegada_prev`, `chegada_real` | Horários previstos e reais |
| `atraso_partida_min`, `atraso_chegada_min` | Real menos previsto, em minutos |
| `atrasado_30`, `cancelado` | As duas variáveis-alvo da seção 8.1 |
| `atraso_origem_lag2`, `atraso_origem_lag3` | Taxa de atraso das partidas da origem 2 e 3 h antes |
| `partidas_previstas_hora` | Quantos voos estavam programados para sair da origem naquela hora |
| `_var1h`, `_var3h` | Variação da variável em 1 e 3 h (ex.: `vis_m_var3h`) |
| `alvo` (seção 8.2) | IMC daqui a `HORIZONTE` = 3 h |
| `assunto`, `condicao` | Letras 2–3 e 4–5 do código Q |
| `vigencia_dias` | Dias entre início e fim do NOTAM |
| `OUTROS` | Classe que junta os assuntos com menos de 10 NOTAMs no classificador da seção 3.2 |
| `procedimento_ifr` | Aeródromo tem carta IAC |

## 11. Unidades, horários e coordenadas

| Termo | Significado |
|---|---|
| **kt (nó)** | Milha náutica por hora = 1,852 km/h. 25 kt ≈ 46 km/h; 52 kt ≈ 96 km/h. |
| **ft (pé)** | 0,3048 m. 1.500 ft ≈ 460 m; 200 ft ≈ 60 m. |
| **NM** | Milha náutica = 1,852 km. |
| **hPa** | Hectopascal, unidade de pressão. |
| **Oitavo** | Fração do céu coberta por nuvens, de 0 a 8 (*okta*). |
| **UTC / Z** | Tempo Universal Coordenado. Toda a aviação usa UTC; nos boletins aparece como `Z` (`1100Z`). |
| **Horário de Brasília** | UTC−3. |
| **`AAMMDDhhmm`** | Formato das datas do NOTAM: ano, mês, dia, hora e minuto, com 2 dígitos cada, em UTC. `2610061430` = 06/10/2026 às 14:30 UTC. |
| **Graus e minutos** | `2326.38S 04629.41W` (ficha ROTAER) = 23°26,38'S, 46°29,41'W. No NOTAM, `1707S04911W014` = 17°07'S, 49°11'W, raio de 14 NM. |

## 12. API e organização dos dados

| Termo | Significado |
|---|---|
| **API** | Interface para pedir dados a um servidor por URL. A da AISWEB responde sempre em XML. |
| **Rota (`area`)** | Cada tipo de consulta da AISWEB (`notam`, `met`, `rotaer`...), escolhido pelo parâmetro `area`. |
| **Query string** | Parâmetros no fim da URL (`?area=notam&icaocode=SBGR`). A AISWEB recebe a autenticação (`apiKey` e `apiPass`) por ali. |
| **XML** | Formato de texto em árvore, com marcações `<item>...</item>`. `para_df` transforma os itens em DataFrame. |
| **Paginação / `rowstart`** | Rotas longas devolvem 100 itens por vez; `rowstart` é o deslocamento (*offset*) a partir do item 0. |
| **Cache** | Arquivos baixados uma vez e guardados em `data/raw/` para não baixar de novo. |
| **Retrato do momento** | Os dados da AISWEB valem para o dia da coleta (05/10/2026). Baixar outro dia dá outro retrato. |
| **`raw` / `interim` / `processed` / `external`** | Camadas de `data/`: downloads originais, dados intermediários, bases finais para modelagem e arquivos de terceiros (PDFs de cartas). |
