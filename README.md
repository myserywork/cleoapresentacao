# Cleopatra — versão de apresentação

Plataforma de apresentação da **Cleopatra**, sistema de automação da gestão de
convênios e transferências voluntárias que integra o TransfereGov ao SEI.

Esta aplicação existe para ser demonstrada a decisores de órgãos públicos — e
para se tornar, ao longo do tempo, a base do produto novo. Ela é **autônoma**:
não depende de API, banco nem rede.

## O que ela faz

| Tela | Conteúdo |
|------|----------|
| **Painel** | Fita de trâmite da carteira, valores, empenhos, série mensal e cartograma por UF |
| **Meu dia** | Fila priorizada por risco, prazo e valor, com a próxima ação de cada proposta |
| **Propostas** | Busca, ordenação, colunas configuráveis, ação em lote e visão de trâmite |
| **Proposta** | Dossiê com saúde, alertas de conformidade, empenhos, cronograma, documentos e comentários |
| **Aprovações** | Cabine de decisão com contexto completo, atalhos de teclado, lote por critério e desfazer |
| **Cérebro** | Grafo do conhecimento do órgão, com histórias guiadas e a cadeia legível de cada convênio |
| **Assistente** | Copiloto que consulta os dados e **opera a interface** por linguagem natural |
| **Minutas** | Modelos de documento com campos calculados e pré-visualização em proposta real |
| **Meus painéis** | Construtor de painéis com grade redimensionável e layouts salvos |
| **O ganho** | Comparativo antes × depois, com a premissa de tempo ajustável pelo órgão |

## Três decisões que sustentam tudo

**Nenhuma automação é executada de verdade.** O modal reconstrói as telas do SEI
e do TransfereGov ao vivo — cursor, digitação, cliques — mas nada é disparado
nos sistemas oficiais. É simulação fiel, não integração.

**Sem backend.** O dado é gerado por semente fixa: a demonstração é idêntica em
todo ensaio e em toda máquina, e roda sem internet. O acesso a dado está isolado
em `src/data/repo.ts` — trocar pela API real é reimplementar um módulo.

**Sem autenticação.** Não há login, perfil nem isolamento por órgão. É adequado
para demonstração e **inadequado para produção** — é a primeira frente do plano
de produto.

## Rodar

```bash
npm install
npm run dev       # desenvolvimento em http://127.0.0.1:5180
npm run build     # build de produção
npm run preview   # serve o build — use este na apresentação
```

## Atalhos

| Tecla | Ação |
|-------|------|
| `Ctrl+K` | Paleta de comando: busca, navega, executa ou pergunta à Cleo |
| `Ctrl+Shift+P` | Modo apresentação — a plataforma se apresenta em 8 cenas |
| `J` / `K` | Percorrer a fila de aprovações |
| `A` / `R` / `U` | Aprovar, recusar, desfazer |

## Estrutura

```
src/
├── data/          gerador determinístico e ponto único de acesso a dado
├── dominio/       saúde da proposta, riscos, conformidade e prazo
├── simulacao/     roteiros das automações e reconstrução das telas oficiais
├── comandos/      motor de intenção → ações na interface
├── assistente/    interpretador de linguagem natural sobre os dados
├── cerebro/       grafo, simulação de forças e camadas de desenho
├── components/    design system, gráficos e camadas globais
└── pages/         as telas
```

## Identidade visual

Tema escuro navy com dourado da marca. A cor carrega significado fixo no sistema
inteiro: **verde-azulado** para trâmite em andamento, **dourado** para recurso
comprometido, **roxo** para o que a Cleo produziu, **cinza** para o que está
parado e **vermelho** para pendência. As cores dos gráficos foram validadas para
banda de luminosidade, croma, contraste e separação sob daltonismo.
