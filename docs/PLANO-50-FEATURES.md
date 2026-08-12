# Cleopatra — 50 features novas

Plano de produto da versão de apresentação, escrito do ponto de vista de quem
vai assistir à demonstração: o **coordenador-geral de transferências voluntárias**
de um ministério, o **analista técnico** que trabalha na fila todo dia, e o
**assessor parlamentar** que quer saber onde está a emenda dele.

> Restrição que atravessa tudo: **nada é executado de verdade** no TransfereGov
> nem no SEI. A plataforma reconstrói as telas oficiais e simula a execução com
> o mesmo contrato de eventos que um worker real emitiria. Nenhum dado é
> inventado no ar: tudo vem do gerador determinístico, e toda regra mostra a
> própria fórmula na tela.

---

## O que a Cleopatra não respondia antes

A versão atual responde bem a três perguntas: *o que eu tenho na carteira*,
*o que está travado* e *o que a Cleo já fez por mim*. Ela não responde às
perguntas que decidem a vida de um gestor de convênios:

| Pergunta do gestor | Onde doía |
|---|---|
| "De quem é essa emenda e quanto ainda falta empenhar?" | Emenda parlamentar não existia no modelo |
| "Quanto do meu orçamento eu perco em 31 de dezembro?" | Não havia dotação, empenho, liquidação nem pagamento |
| "Quais convênios vencem antes do fim do trimestre?" | Vigência não existia |
| "Quem está inadimplente na prestação de contas?" | Prestação de contas não existia |
| "Meu analista está com quantas propostas?" | Não havia equipe nem carteira |
| "O que eu pedi ao proponente e ele não respondeu?" | Diligência não existia |
| "Quem mandou a Cleo fazer isso, e quando?" | Não havia trilha de auditoria consultável |
| "Consigo criar uma automação nova sem chamar a TI?" | Rito era código |

As 50 features abaixo fecham essas oito lacunas e sobem o nível do que já existe.

---

## Frente 1 — O dinheiro

O que faz o telefone do coordenador tocar: emenda parlamentar e prazo de empenho.

**F01 · Emenda parlamentar no modelo de dados**
Parlamentar (nome, partido, UF, casa), emenda (número, ano, tipo RP6 individual /
RP7 bancada / RP2 discricionária, valor), vínculo emenda ↔ proposta. Toda proposta
passa a saber de onde veio o dinheiro.
*Pronto quando:* qualquer proposta abre mostrando autor, número da emenda e tipo.

**F02 · Tela Emendas**
Carteira por parlamentar: valor indicado, valor empenhado, valor pago, propostas
paradas. Ordenável por pressão — quem tem mais valor parado há mais tempo.
*Pronto quando:* dá para responder "quanto da emenda do deputado X já virou obra".

**F03 · Ficha do parlamentar**
Página do parlamentar: execução da carteira dele, municípios beneficiados, funil
das propostas, linha do tempo de indicações.
*Pronto quando:* serve de resposta pronta a uma cobrança de gabinete.

**F04 · Execução orçamentária no modelo**
Ação orçamentária com dotação, empenhado, liquidado e pago. Cada empenho da
proposta passa a apontar para uma ação.
*Pronto quando:* a soma dos empenhos das propostas bate com o empenhado da ação.

**F05 · Tela Orçamento**
Funil dotação → empenhado → liquidado → pago, por ação e por programa, com o que
sobra em cada degrau nomeado (saldo a empenhar, a liquidar, a pagar).
*Pronto quando:* o gestor vê em um golpe onde o dinheiro está preso.

**F06 · Relógio de fim de exercício**
Contador de dias até 31/12 com o saldo a empenhar e o ritmo necessário por dia
útil para não devolver recurso.
*Pronto quando:* mostra "faltam N dias úteis e R$ X por dia para zerar".

**F07 · Risco de restos a pagar**
Classificação do empenhado não liquidado por idade, com a fatia que tende a virar
restos a pagar processados e não processados.
*Pronto quando:* lista as propostas que puxam o indicador para baixo.

**F08 · Simulador de empenho**
"Se eu empenhar as N propostas de maior valor prontas para empenho, quanto do
saldo eu zero?" — com a lista resultante e o efeito no funil.
*Pronto quando:* mexer no controle recalcula o funil na tela.

---

## Frente 2 — O tempo

Convênio é um contrato com data para morrer. Perder a data custa o convênio.

**F09 · Vigência e aditivos no modelo**
Data de início, data de fim, prorrogações já feitas, aditivos (prazo, valor, meta).
*Pronto quando:* toda proposta celebrada tem vigência e histórico de aditivos.

**F10 · Tela Vigências**
Régua de vencimento em 30/60/90 dias, separando o que ainda dá para prorrogar do
que já passou do ponto. Convênio vencendo com meta física incompleta sobe ao topo.
*Pronto quando:* o gestor sai da tela com a lista do que assinar esta semana.

**F11 · Simulação de termo aditivo**
Escolher a nova data, ver o efeito no cronograma e gerar a minuta do aditivo —
como toda automação, simulada.
*Pronto quando:* o modal mostra o SEI recebendo a minuta do aditivo.

**F12 · Prestação de contas no modelo**
Prazo de apresentação, status (não iniciada, apresentada, em análise, aprovada,
com ressalva, rejeitada), data de entrega e responsável pela análise.
*Pronto quando:* a inadimplência é derivada da regra, não escrita à mão.

**F13 · Tela Prestação de contas**
Radar de vencimento, fila de análise e painel de inadimplência com o efeito
prático — proponente inadimplente não recebe novo repasse.
*Pronto quando:* mostra quantos municípios estão bloqueados por conta disso.

**F14 · Ciclo de vida do convênio**
Faixa horizontal única, do cadastro à prestação de contas, com a fase atual, o
que ficou para trás e o prazo de cada etapa. Aparece na proposta e na sala de situação.
*Pronto quando:* uma pessoa que nunca viu o sistema entende o processo em 5 segundos.

**F15 · Relógio de prazos legais**
Contador por proposta: prazo da fase, prazo de resposta a diligência, prazo de
prestação de contas — cada um com a base normativa citada.
*Pronto quando:* nenhum prazo aparece sem dizer de onde vem.

---

## Frente 3 — As pessoas

Sistema de convênio é sistema de gente esperando resposta de outra gente.

**F16 · Equipe e carteira no modelo**
Analistas com perfil, capacidade declarada e carteira atribuída de propostas.
*Pronto quando:* toda proposta tem um responsável.

**F17 · Tela Equipe**
Carga por analista (quantidade, valor, propostas em risco), ociosidade e
sobrecarga lado a lado, com sugestão de redistribuição da Cleo.
*Pronto quando:* mostra quem está com 3× a carga da média e o que mover.

**F18 · Ficha do proponente**
Histórico completo: convênios anteriores, prestação de contas, inadimplência,
valores recebidos, propostas em curso.
*Pronto quando:* responde "posso confiar nesse município?" sem sair da tela.

**F19 · Score de capacidade do proponente**
Nota composta por histórico de execução, pontualidade em prestação de contas,
porte e reincidência de diligência — com os pesos visíveis.
*Pronto quando:* a nota abre e mostra as parcelas que a formaram.

**F20 · Diligências no modelo**
Pedido de complementação: itens solicitados, data, prazo, resposta, reiterações.
*Pronto quando:* a proposta sabe o que foi pedido e há quanto tempo se espera.

**F21 · Tela Diligências**
Caixa de duas colunas: o que a casa pediu e ainda não voltou; o que voltou e
ninguém analisou. É a fila de ping-pong que trava convênio.
*Pronto quando:* mostra o tempo médio de resposta por proponente.

**F22 · Reiteração automática**
Diligência vencida gera ofício de reiteração a partir de minuta — simulado no SEI,
em lote, com pré-visualização de cada ofício antes.
*Pronto quando:* o gestor dispara 12 reiterações em um clique e vê as 12 no modal.

---

## Frente 4 — A máquina

A promessa do pitch é "qualquer automação". Isso precisa aparecer na tela.

**F23 · Editor de ritos**
Montar uma automação nova arrastando passos de uma paleta (abrir sistema, buscar
processo, anexar documento, preencher formulário, incluir em bloco, assinar),
com condições e ordem. Sem código.
*Pronto quando:* dá para criar um rito na frente do cliente e executá-lo.

**F24 · Biblioteca de ritos**
Ritos prontos publicados, com quantas vezes rodaram, taxa de sucesso e tempo médio.
Duplicar um rito para editar é um clique.
*Pronto quando:* a biblioteca abre com os ritos que a Cleo já executa hoje.

**F25 · Gatilhos por regra**
"Quando proposta entra em Em análise **e** valor > R$ 1 mi, execute o rito X."
Regra composta, com pré-visualização de quantas propostas ela pegaria hoje.
*Pronto quando:* criar a regra mostra na hora "isso valeria para 34 propostas".

**F26 · Fila de execução**
Painel da fila: em execução, aguardando, concluídas, com concorrência configurável
e tempo estimado de esvaziamento.
*Pronto quando:* a fila anda sozinha na tela durante a apresentação.

**F27 · Trilha de auditoria consultável**
Todo evento (execução, decisão, comentário, alteração de regra) num registro
filtrável por pessoa, período, proposta e tipo — com exportação.
*Pronto quando:* responde "quem aprovou isso, quando e com qual justificativa".

**F28 · Falha e retomada**
Simulação de falha realista (sessão do SEI expirada) com retomada do passo exato,
não do começo — que é a diferença entre RPA de brinquedo e RPA de produção.
*Pronto quando:* o modal mostra a falha, a reautenticação e a retomada.

**F29 · Execução em lote**
Selecionar N propostas e rodar um rito sobre todas, com progresso individual,
falhas isoladas e resumo ao final.
*Pronto quando:* 20 propostas rodam em paralelo simulado sem travar a tela.

**F30 · Agendamento**
Rito recorrente (diário às 3h, semanal, no dia 25) com a próxima execução e o
histórico das últimas.
*Pronto quando:* a tela mostra "próxima execução em 6h" com contagem viva.

---

## Frente 5 — A inteligência

O Cérebro e o Assistente são a assinatura da plataforma. Precisam explicar, não impressionar.

**F31 · Cérebro: camada de emendas**
Parlamentar e emenda entram no grafo como nós, ligando dinheiro a território e a obra.
*Pronto quando:* dá para partir de um deputado e chegar na obra do município.

**F32 · Cérebro: modo território**
Recorte geográfico do grafo, agrupando por UF e região, com o valor em cada laço.
*Pronto quando:* a história "onde o dinheiro cai" roda sozinha.

**F33 · Cérebro: busca dentro do grafo**
Buscar por nome, número ou município e a câmera vai até o nó, destacando a
vizinhança e a cadeia legível até ele.
*Pronto quando:* digitar um município leva a câmera lá em menos de um segundo.

**F34 · Recomendação da Cleo em Aprovações**
Cada pedido de aprovação chega com recomendação (aprovar / recusar / verificar),
o porquê em uma frase, os fatos que sustentam e o grau de confiança.
*Pronto quando:* nenhuma recomendação aparece sem os fatos que a produziram.

**F35 · Assistente: novas intenções**
Emenda, orçamento, vigência, prestação de contas, equipe, diligência e proponente
entram no motor de intenção, com as respectivas ações executáveis.
*Pronto quando:* "quanto da emenda do deputado Y foi pago?" responde com número e tabela.

**F36 · Assistente: resposta que age**
Toda resposta oferece o próximo passo como botão que mexe na interface — filtrar,
abrir, executar, focar no Cérebro.
*Pronto quando:* dá para conduzir a demonstração inteira pelo Assistente.

**F37 · Detecção de anomalias**
Propostas irmãs (mesmo objeto, mesmo valor, municípios diferentes), valores
repetidos, contrapartida no limite exato, concentração por proponente.
*Pronto quando:* a tela mostra o padrão encontrado e as propostas que o formam.

**F38 · Previsão de conclusão**
Estimativa de quando a proposta chega à celebração, a partir do tempo histórico
de cada fase do órgão, com faixa de incerteza.
*Pronto quando:* a previsão mostra a mediana histórica que a sustenta.

---

## Frente 6 — A apresentação

A plataforma precisa se apresentar bem em sala escura, projetor ruim e internet pior.

**F39 · Sala de situação**
Tela cheia para projetor: números vivos, fila do dia, execuções em curso, mapa e
relógio de fim de exercício. Sem menu, sem distração.
*Pronto quando:* funciona como painel de parede durante uma reunião inteira.

**F40 · Modo apresentação por público**
Três roteiros: gestor (números e risco), técnico (automação e integração),
parlamentar (emenda e território).
*Pronto quando:* escolher o público muda a sequência de cenas.

**F41 · Relatório executivo**
Uma página gerada na hora com os números do órgão, os destaques e os riscos, em
linguagem de ofício, pronta para imprimir.
*Pronto quando:* imprime em uma folha sem cortar nada.

**F42 · Comparador de órgãos**
MIDR × MPA × MAPA lado a lado: volume, valor, aderência a prazo, automação,
inadimplência.
*Pronto quando:* mostra em que cada órgão é melhor e pior.

**F43 · Tema claro**
Alternância clara/escura preservando o significado das cores, para sala com luz.
*Pronto quando:* nenhum gráfico perde legibilidade no tema claro.

**F44 · Exportação**
Qualquer tabela vira CSV; qualquer painel vira imagem.
*Pronto quando:* o botão existe em toda tabela e o arquivo abre no Excel com acento correto.

**F45 · Busca global**
Ctrl+K encontra proposta, proponente, parlamentar, emenda, município, minuta,
rito e comando — em um só campo, com atalho por categoria.
*Pronto quando:* qualquer coisa da plataforma está a três teclas de distância.

**F46 · Tour guiado**
Percurso de primeira visita explicando as sete telas centrais, saltável e retomável.
*Pronto quando:* alguém sozinho entende a plataforma sem apresentador.

**F47 · Sessão persistente**
Decisões, comentários, painéis e preferências sobrevivem ao F5.
*Pronto quando:* recarregar no meio da demonstração não perde nada.

**F48 · Feed de atividade**
Fluxo vivo do que acontece no órgão: execuções, decisões, documentos, prazos
estourando — com filtro por tipo.
*Pronto quando:* roda sozinho e dá sensação de sistema em uso.

**F49 · Comparar propostas**
Duas ou três propostas lado a lado, campo a campo, com as diferenças destacadas.
*Pronto quando:* a diferença aparece sem o olho ter que procurar.

**F50 · Dossiê de uma página**
Resumo imprimível de um convênio: partes, valores, prazos, documentos, pendências,
histórico — o que o gestor leva para a reunião.
*Pronto quando:* cabe em uma folha e serve como anexo de processo.

---

## Ordem de construção

| Onda | Conteúdo | Por que primeiro |
|---|---|---|
| 1 | F01, F04, F09, F12, F16, F20 | Tudo o mais depende do modelo de dados |
| 2 | F19, F34, F37, F38, F06, F07, F15 | Domínio: as regras que as telas exibem |
| 3 | F02, F03, F05, F10, F13, F17, F18, F21 | Telas novas de gestão |
| 4 | F23–F30 | A máquina: editor, regras, fila, auditoria |
| 5 | F31–F33, F35, F36 | Cérebro e Assistente |
| 6 | F39–F50 | Camada de apresentação |

## O que continua fora, de propósito

Autenticação, isolamento por órgão, execução real, persistência em servidor e
integração com o PNCP. São itens de produto, não de apresentação — e o pedido
foi explícito: nada real no TransfereGov nem no SEI.
