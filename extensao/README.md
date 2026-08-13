# Cleo — extensão de demonstração

Copiloto que opera **o nosso SEI** e **o nosso TransfereGov** de demonstração
dentro da sessão do próprio navegador. É uma extensão MV3 real: carrega no
Chrome, injeta um painel sobre a página do sistema e a dirige com o cursor —
exatamente a arquitetura que operaria os sistemas oficiais na sessão do usuário.

## Como instalar

1. Baixe e descompacte o `.zip` (ou use esta pasta direto).
2. Abra `chrome://extensions` no Chrome ou no Edge.
3. Ligue o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e aponte para esta pasta.
5. A Cleo aparece na barra de extensões.

## Como ver funcionando

- Abra a Cleopatra e vá em **Extensão → Abrir nosso SEI** (ou nosso TransfereGov).
- O painel da Cleo desliza da direita, conectado à página.
- Escolha um rito (ex.: *Autuar processo*) e acompanhe: o cursor voa pela tela,
  os campos se preenchem, o processo é autuado — tudo na página, ao vivo.

## O que ela demonstra

- **Sessão do usuário**: a extensão opera com a sessão já aberta. Nenhuma senha
  passa por ela.
- **Consentimento por ação**: cada rito é disparado por um clique do usuário.
- **Contrato de eventos**: a página devolve o progresso de cada passo — o mesmo
  contrato que a plataforma Cleopatra consome dos workers.

## Arquitetura

- `content.js` injeta o painel e conversa com a página por `postMessage`.
- A página do sistema (SEI/TransfereGov) executa os passos e devolve o progresso.
- `service-worker.js` é onde, em produção, ficaria a conexão com a Cleopatra.

Extensão de demonstração: os `matches` do manifesto cobrem apenas
`localhost`, `127.0.0.1` e `*.trycloudflare.com`. Para operar um domínio real do
SEI/TransfereGov, bastaria acrescentá-lo ao manifesto — o mecanismo é o mesmo.
