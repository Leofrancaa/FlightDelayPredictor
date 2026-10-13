# App web: Previsão de Atrasos

Next.js 15 (App Router) + TypeScript + Tailwind 4. Duas áreas:

- **Meu voo** (`/passageiro`): o passageiro escolhe o dia e busca pelo número do voo ou pela rota. Vê o alerta de atraso previsto na véspera e 3 h antes, as probabilidades de cada faixa, o que pesou na previsão e o que aconteceu de fato.
- **Análise do modelo** (`/analista`): comparação com o chute, matriz de confusão, desempenho por faixa, importância das variáveis, estabilidade semana a semana e a análise descritiva de 2025.

## Como funciona

O modelo (scikit-learn) **não roda no Vercel**. O script `module_decea/exportar_web.py` treina os modelos e grava as previsões do período de teste (out–dez 2025) em `public/data/`:

```
public/data/
├── resumo.json            métricas e análises (lado do analista)
├── indice.json            datas, companhias e aeroportos
└── voos/AAAA-MM-DD.json   previsões de cada voo do dia (carregadas sob demanda)
```

O site é 100% estático: rápido, sem servidor e grátis no plano Hobby do Vercel.

## Atualizar os dados

Na raiz do projeto (precisa dos dados em `data/raw/vra` e `data/raw/metar`):

```bash
uv run python -m module_decea.exportar_web
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

- É uma demonstração com voos de 2025. Para prever voos futuros de verdade seria preciso uma fonte de METAR em tempo real (API da REDEMET/AISWEB) e a programação de voos do dia, rodando o modelo num serviço Python à parte.
- Na véspera não existe previsão do tempo no histórico (TAF), então o modelo da véspera usa só o clima típico e o dia anterior.
