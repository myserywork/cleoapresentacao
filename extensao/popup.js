/*
 * Popup da extensão. Abre os sistemas no MESMO host da Cleopatra (túnel ou
 * local) e mostra as sessões já capturadas, com a validade restante.
 */
const ROTULO = { sei: 'SEI', tgov: 'TransfereGov' }

function montar(base) {
  document.getElementById('abrir').href = base + '/sistemas/sei'
  document.getElementById('abrir-tgov').href = base + '/sistemas/tgov'
}

function formatar(ms) {
  if (ms <= 0) return 'expirada'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`
}

function pintarSessoes() {
  chrome.storage.local.get(['sessoes'], (d) => {
    const sessoes = d.sessoes || {}
    const chaves = Object.keys(sessoes)
    const box = document.getElementById('sessoes')
    if (chaves.length === 0) {
      box.innerHTML = '<div class="sessao vazia">Nenhuma sessão capturada ainda.</div>'
      return
    }
    box.innerHTML = chaves
      .map((k) => {
        const s = sessoes[k]
        const restante = s.expiraEm - Date.now()
        return `<div class="sessao"><span class="pino"></span><span class="sistema">${ROTULO[k] || k}</span><span class="tempo">${restante > 0 ? 'expira em ' + formatar(restante) : 'expirada'}</span></div>`
      })
      .join('')
  })
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || ''
  try {
    const u = new URL(url)
    if (u.host.includes('trycloudflare.com') || u.host.includes('127.0.0.1') || u.host.includes('localhost')) {
      montar(u.origin)
      pintarSessoes()
      return
    }
  } catch (_) {}
  chrome.storage.local.get(['origem'], (d) => {
    montar(d.origem || 'http://127.0.0.1:4173')
    pintarSessoes()
  })
})
