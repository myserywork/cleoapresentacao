/*
 * Cleo — service worker.
 *
 * Numa versão de produção, é aqui que a extensão manteria a conexão WebSocket
 * com a Cleopatra: recebendo as intenções ("autuar processo X") e devolvendo o
 * contrato de eventos que a plataforma consome. Na demonstração, o worker só
 * registra a instalação e guarda a preferência de execução assistida.
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ modo: 'assistido', instaladoEm: Date.now() })
})

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg?.tipo === 'estado') {
    chrome.storage.local.get(['modo'], (d) => responder({ modo: d.modo || 'assistido' }))
    return true
  }
})
