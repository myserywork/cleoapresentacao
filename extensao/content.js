/*
 * Cleopatra — content script.
 *
 * Três comportamentos, decididos pelo que a página é:
 *
 *  • Página de sistema (SEI/TransfereGov): injeta o ORBE — um marcador discreto
 *    que vira painel ao toque. O orbe mostra progresso em anel enquanto a Cleo
 *    executa, e some do caminho quando não é chamado.
 *  • A Cleo lê o CONTEXTO da tela (data-cleo-contexto) e sugere o próximo passo
 *    certo: num processo sem documentos ela oferece redigir o termo; numa lista
 *    de propostas, localizar e baixar. Copiloto que não entende a tela é botão.
 *  • Página da Cleopatra: age como ponte do Cofre de Sessões.
 *
 * A extensão decide, a página executa. Nenhuma senha passa por aqui.
 */

;(function ()