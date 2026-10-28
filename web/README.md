# App web: Previsão de Atrasos

Next.js 15 (App Router) + TypeScript + Tailwind 4. Duas áreas:

- **Meu voo** (`/passageiro`): o passageiro escolhe o aeroporto e o dia e busca pelo número do voo. Vê o alerta de atraso previsto na véspera, 3 h e 1 h antes, a chance de atrasar mais de 30 min (com o limiar do alerta), o que pesou na previsão e o que aconteceu de fato.
- **Análise do modelo** (`/analista`): comparação dos horizontes com o chute, pontos de operação (precisão × recall), matriz de confusão, recall por causa do atraso, quanto vale a matrícula do avião, importância das variáveis e a análise descritiva.

## Como funciona

O modelo (scikit-learn) **não roda no Vercel**. O script `module_decea/exportar_web_eua.py` treina os modelos (BTS 2022–2024, 10 maiores aeroportos dos EUA) e grava as previsões do período de demonstração (15–31 dez 2024) em `public/data/`:

```
public/data/
├── resumo.json            métricas e análises (lado do analista)
├── indice.json            datas, companhias, aeroportos e coordenadas
└── voos/AAAA-MM-DD.json   previsões de cada voo do dia (carregadas sob demanda)
```

O site é 100% estático: rápido, sem servidor e grátis no plano Hobby do Vercel.

## Atualizar os dados

Na raiz do projeto (precisa de `data/raw/bts/BTS_*.parquet` e `data/raw/metar_eua/`), ou pelo workflow *Treinar modelo EUA* no GitHub Actions:

```bash
uv run python -m module_decea.exportar_web_eua
```

## Rodar local

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

## Publicar no Vercel

1. Suba o repositório no GitHub, **incluindo `web/public/data/`** (o `.gitignore` já deixa).
2. No Vercel: *Add New → Project* → importe o repositório.
3. Em **Root Directory**, escolha `web`. O resto (framework Next.js, `npm run build`) é detectado sozinho.
4. *Deploy*.

## Limitações

- É uma demonstração com voos de dezembro de 2024. Para prever voos futuros seria preciso METAR em tempo real e a programação de voos do dia, rodando o modelo num serviço Python à parte.
- Na véspera não existe previsão do tempo no histórico (TAF), então o modelo da véspera usa só o clima típico e o dia anterior, e nada que dependa da matrícula (a BTS registra o avião que de fato voou).
