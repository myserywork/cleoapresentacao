# Roteiro de apresentação da Cleopatra

Guia de quem vai apresentar. Três roteiros embutidos na própria plataforma
(`Ctrl+Shift+P` → escolher público) e este documento para preparar a conversa.

> **Antes de subir ao palco:** abra em tela cheia, confira que o tema está no
> escuro (ou claro, se a sala tiver muita luz — botão no rodapé da navegação), e
> tenha o link do túnel copiado. `Ctrl+K` resolve qualquer coisa que faltar.

---

## O arco da história

A plataforma responde, em ordem, às cinco perguntas que um gestor de convênios
faz — e cada uma abre a próxima:

1. **O que eu tenho?** → Painel, Meu dia, Propostas
2. **De onde vem e para onde vai o dinheiro?** → Emendas, Orçamento
3. **O que vai vencer e me pegar?** → Vigências, Prestação de contas, Diligências
4. **Quem faz o trabalho?** → Ritos, Minutas, Documentos, Equipe, Extensão
5. **Posso confiar nisso?** → Usuários e permissões, Auditoria, Cérebro

O módulo Prefeitura é o epílogo: a mesma inteligência do outro lado do balcão.

---

## Roteiro completo — 19 cenas (público: Gestor)

| # | Tela | O que dizer | O momento |
|---|------|-------------|-----------|
| 1 | Painel | "Toda a carteira numa tela." | Os quatro cartões de sinal — é o que muda a semana |
| 2 | Meu dia | "Por onde começar hoje." | A fila já traz a próxima ação pronta |
| 3 | Propostas (filtro) | "A Cleo sabe o que não anda." | O filtro se aplica sozinho na frente deles |
| 4 | Proposta | "Dossiê, não formulário." | Ciclo de vida + previsão de celebração |
| 5 | **Rito executando** | "Um clique instrui o processo inteiro." | **O momento-chave.** Deixe o modal rodar |
| 6 | Aprovações | "A decisão continua sua." | Recomendação com fatos e confiança |
| 7 | Emendas | "O dinheiro tem autor." | Ordenado por pressão de gabinete |
| 8 | Orçamento | "O relógio de dezembro." | Saldo a empenhar × ritmo necessário |
| 9 | Vigências | "Contrato com data para morrer." | O que vence em 30 dias |
| 10 | Prestação de contas | "Quem está travado." | Inadimplência bloqueia repasse novo |
| 11 | Ritos — estúdio | "Qualquer automação, sem código." | Caminho de falha e nós de confirmação |
| 12 | Minutas | "O documento se escreve sozinho." | Verde = calculado, dourado = humano |
| 13 | **Usuários** | "A máquina obedece à hierarquia." | **Troque de perfil e mostre o botão bloqueado** |
| 14 | Extensão | "A Cleo dentro do navegador." | Sessão autenticada → cofre |
| 15 | Auditoria | "Tudo auditável." | Quem fez, com qual perfil, sob qual alçada |
| 16 | Cleo | "Pergunte em português." | Ligue o microfone e fale com ela |
| 17 | Cérebro | "Tudo que a Cleo sabe." | Modo cinema ou linha do tempo |
| 18 | Prefeitura | "O outro lado do balcão." | O ofício saindo pronto |
| 19 | O ganho | "O que isso devolve." | A corrida em escala real |

**Piloto automático:** botão *Auto* na barra. As cenas avançam sozinhas, com 40
segundos nas que rodam automação. Serve para deixar rodando enquanto a sala se
acomoda.

---

## Os cinco momentos que arrancam reação

Se você tiver só 10 minutos, use estes:

**1. O rito executando (cena 5)** — a janela reconstrói o SEI e o TransfereGov
ao vivo: cursor voando, campos se preenchendo, processo sendo autuado. É o que
transforma "automação" de conceito em coisa vista.

**2. O bloqueio por alçada (cena 13)** — vá em Usuários, troque para *Analista
técnico*, volte em Aprovações e passe o mouse no botão Aprovar. O tooltip diz:
*"O perfil Analista técnico não tem 'Decidir aprovações' · valor da operação:
R$ 2,6 mi · Sobe para Célia Nogueira (Coordenador)"*. É o momento em que o
gestor entende que a máquina obedece à casa.

**3. A linha do tempo do Cérebro** — botão 🕰️. O grafo *cresce* diante da sala
em 20 segundos, com o mês correndo. A frase: *"o que o órgão sabe hoje não foi
carregado — foi aprendido, processo a processo."*

**4. A extensão operando "outro site"** — abra `/sistemas/sei` numa aba nova. É
outro sistema, com a Cleo dirigindo por cima. Se a extensão estiver instalada, o
painel dourado aparece sozinho.

**5. A corrida (cena 19)** — duas barras largando juntas em escala real. A Cleo
cruza a linha em 3% do percurso. Nenhum número diz "29× mais rápido" tão bem
quanto ver.

---

## Roteiros por público

**Gestor (19 cenas)** — números, risco e decisão. O padrão.

**Técnico (9 cenas)** — como a máquina funciona por dentro: rito, execução
passo a passo, verificação, regra que dispara sozinha, extensão e cofre de
sessões, permissões no código, grafo do conhecimento.

**Gabinete (7 cenas)** — emenda, execução e território: de quem é o recurso,
onde virou obra, o relógio de dezembro, o mapa, o módulo Prefeitura e o
relatório de uma página para levar.

---

## Perguntas que vão fazer — e a resposta honesta

**"Isso está integrado de verdade?"**
Não nesta versão. É plataforma de apresentação: a execução é reconstrução de
tela com o mesmo contrato de eventos que um worker real emitiria. Trocar a
simulação por execução real é mudar a fonte, não a plataforma. A extensão do
Chrome é real e opera os nossos sistemas de demonstração.

**"E a segurança? Vocês guardam nossa senha?"**
Nunca. A extensão opera com a sessão que o próprio servidor já abriu — login
dele, certificado dele, gov.br dele. O que se captura são os cookies de sessão
já autenticada, e o cofre guarda só metadados mascarados, com validade contando.

**"Quem responde se a automação errar?"**
A pessoa que a acionou, com o perfil e a alçada dela — e está tudo na trilha de
auditoria. A Cleo nunca faz o que a pessoa não poderia fazer sozinha.

**"Funciona no celular?"**
Sim, as 23 telas. Mostre — abrir no telefone durante a reunião costuma valer
mais que dizer.

**"Quanto tempo para implantar?"**
O que existe aqui é a camada de apresentação e domínio completos. O que falta é
infraestrutura: autenticação real, isolamento por órgão, persistência em
servidor e a troca da simulação por execução. Está tudo isolado em um módulo de
acesso a dado — é reimplementar um módulo, não reescrever telas.

---

## Se algo der errado

- **Link caiu** → `http://127.0.0.1:4173` na máquina local
- **Tela travou** → F5; a sessão persiste (decisões, ritos, perfil, tema)
- **Perdeu-se no meio** → `Ctrl+K` e digite o nome da tela
- **Quer recomeçar** → `Ctrl+Shift+P` volta à cena 1
- **Tour por engano** → `Esc` fecha; `Ctrl+Shift+T` reabre

---

## Atalhos

| Tecla | Ação |
|-------|------|
| `Ctrl+K` | Busca global: proposta, proponente, parlamentar, emenda, rito, comando |
| `Ctrl+Shift+P` | Modo apresentação — escolha o público na barra |
| `Ctrl+Shift+T` | Tour guiado |
| `J` / `K` | Percorrer a fila de aprovações |
| `A` / `R` / `U` | Aprovar, recusar, desfazer |
| `←` / `→` | Trocar de cena na apresentação |
| `Esc` | Fecha widget, tour ou modo cinema |
