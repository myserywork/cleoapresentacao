/*
 * Popup da extensão. Abre a página de sistema no MESMO host em que a Cleopatra
 * está rodando — o túnel do Cloudflare, quando é uma demonstração remota, ou
 * localhost. A origem é gravada pelo content script sempre que a Cleopatra é
 * aberta; aqui só lemos. Assim, numa máquina remota, o botão nunca cai num
 * 127.0.0.1 que não existe.
 */
function montar(base) {
  document.getElementById('abrir').href = base + '/sistemas/sei'
  const tg = document.getElementById('abrir-tgov')
  if (tg) tg.href = base + '/sistemas/tgov'
}

// 1ª escolha: a aba ativa, se já estiver num host da Cleopatra
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || ''
  try {
    const u = new URL(url)
    if (
      u.host.includes('trycloudflare.com') ||
      u.host.includes('127.0.0.1') ||
      u.host.includes('localhost')
    ) {
      montar(u.origin)
      return
    }
  } catch (_) {}

  // 2ª escolha: a última origem gravada pelo content script
  chrome.storage.local.get(['origem'], (d) => {
    montar(d.origem || 'http://127.0.0.1:4173')
  })
})
