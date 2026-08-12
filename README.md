# Cleopatra — versão de apresentação

Plataforma de apresentação da **Cleopatra**, sistema de automação da gestão de
convênios e transferências voluntárias que integra o TransfereGov ao SEI.

Esta aplicação existe para ser demonstrada a decisores de órgãos públicos — e
para se tornar, ao longo do tempo, a base do produto novo. Ela é **autônoma**:
não depende de API, banco nem rede.

## O que ela faz

**Carteira**

| Tela | Conteúdo |
|------|----------|
| **Painel** | Fita de trâmite, sinais do órgão, série mensal, cartograma por UF e feed de atividade viva |
| **Meu dia** | Fila priorizada por risco, prazo e valor, com a próxima ação de cada proposta |
| **Propostas** | Busca, ordenação, colunas configuráveis, ação em lote, comparação e visão de trâmite |
| **Proposta** | Dossiê com ciclo de vida, saúde, conformidade, emenda de origem, prazos legais, previsão de celebração, vigência, metas físicas e prestação de contas |
| **Aprovações** | Cabine de decisão com **recomendação da Cleo** — fatos e grau de confiança à vista |

**Recurso**

| Tela | Conteúdo |
|------|----------|
| **Emendas** | Carteira por parlamentar e por emenda, ordenada por pressão de cobrança |
| **Parlamentar** | Ficha do gabinete: indicado, empenhado, municípios e estágio de cada proposta |
| **Orçamento** | Funil dotação → empenho → liquidação → pagamento, relógio de fim de exercício, risco de restos a pagar e simulador de empenho |

**Prazo**

| Tela | Conteúdo |
|------|----------|
| **Vigências** | Régua de vencimento em 30/60/90 dias e simulação de termo aditivo |
| **Prestação de contas** | Radar de vencimento, fila de análise e inadimplência que bloqueia novo repasse |
| **Diligências** | O que saiu e não voltou, o que voltou e ninguém olhou, e reiteração em lote |

**Casa**

| Tela | Conteúdo |
|------|----------|
| **Equipe** | Carga por analista, desequilíbrio e sugestão de redistribuição |
| **Ritos** | Biblioteca, **editor sem código**, regras "quando X faça Y", fila e agendamento |
| **Minutas** | Modelos de documento com campos calculados e pré-visualização em proposta real |
| **Auditoria** | Trilha consultável por pessoa, período, tipo e processo, com exportação |

**Inteligência**

| Tela | Conteúdo |
|------|----------|
| **Cérebro** | Grafo do órgão com seis histórias guiadas, incluindo emendas e território |
| **Assistente** | Copiloto que consulta os dados e **opera a interface** por linguagem natural |
| **Padrões** | Propostas irmãs, valores repetidos, contrapartida no limite, concentração e fracionamento |

**Apresentar**

| Tela | Conteúdo |
|------|----------|
| **Sala de situação** | Painel de parede para projetor, sem navegação, com rodízio automático |
| **Relatório** | Uma página em linguagem de ofício, gerada na hora e pronta para imprimir |
| **Comparar** | Órgãos lado a lado e até três propostas campo a campo, com as diferenças destacadas |
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
de produto. O que a sessão guarda (decisões, comentários, ritos, regras, tema)
fica no `localStorage` do navegador e não sai dele.

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
| `Ctrl+K` | Busca global: propostas, proponentes, parlamentares, emendas, ritos e comandos |
| `Ctrl+Shift+P` | Modo apresentação — roteiro por público: gestor, técnico ou gabinete |
| `Ctrl+Shift+T` | Tour guiado da plataforma |
| `J` / `K` | Percorrer a fila de aprovações |
| `A` / `R` / `U` | Aprovar, recusar, desfazer |
| `←` / `→` | Trocar de cena no modo apresentação |

## Estrutura

```
src/
├── data/          gerador determinístico em duas camadas e acesso único a dado
├── dominio/       tempo, saúde, riscos, ciclo, orçamento, emendas, equipe,
│                  proponentes, recomendação e padrões
├── automacao/     regras de gatilho e paleta do editor de ritos
├── simulacao/     roteiros das automações e reconstrução das telas oficiais
├── comandos/      motor de intenção → ações na interface
├── assistente/    interpretador de linguagem natural sobre os dados
├── cerebro/       grafo, simulação de forças e camadas de desenho
├── components/    design system, gráficos, tabela e camadas globais
└── pages/         as telas
```

O plano de produto com as 50 features desta versão está em
[`docs/PLANO-50-FEATURES.md`](docs/PLANO-50-FEATURES.md).

## Identidade visual

Tema escuro navy com dourado da marca, e um tema claro para sala com luz — a
mesma paleta com os papéis preservados. A cor carrega significado fixo no sistema
inteiro: **verde-azulado** para trâmite em andamento, **dourado** para recurso
comprometido, **roxo** para o que a Cleo produziu, **cinza** para o que está
parado e **vermelho** para pendência. As cores dos gráficos foram validadas para
banda de luminosidade, croma, contraste e separação sob daltonismo.
