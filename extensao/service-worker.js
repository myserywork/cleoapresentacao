/*
 * Cleopatra — service worker.
 *
 * O cérebro fora da página. Faz três coisas:
 *  1. Captura a sessão autenticada — lê os cookies do domínio do sistema
 *     (inclusive os httpOnly, que a página não enxerga) via chrome.cookies e
 *     empacota como uma sessão que a Cleopatra pode usar para operar sozinha.
 *  2. Guarda as sessões capturadas e sua validade em chrome.storage.
 *  3. Em produção, é aqui que ficaria a conexão viva com a Cleopatra, entregando
 *     a sessão e recebendo as intenções. Na demonstração, guarda localmente.
 *
 * Nenhuma senha passa por aqui: o que se captura é a sessão já autenticada pelo
 * próprio usuário — o mesmo que ele já usa no navegador.
 */

const DURACAO_SESSAO_MS = 2 * 60 * 60 * 1000 // 2 horas, como uma sessão do SEI

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ modo: 'assistido', instaladoEm: Date.now() })
})

chrome.runtime.onMessage.addListener((msg, sender, responder) => {
  if (!msg || !msg.tipo) return

  if (msg.tipo === 'capturar-sessao') {
    capturar(msg.url, msg.sistema, msg.usuario).then(responder)
    return true
  }

  if (msg.tipo === 'listar-sessoes') {
    chrome.storage.local.get(['sessoes'], (d) => responder({ sessoes: sanitizar(d.sessoes) }))
    return true
  }

  if (msg.tipo === 'descartar-sessao') {
    chrome.storage.local.get(['sessoes'], (d) => {
      const s = d.sessoes || {}
      delete s[msg.sistema]
      chrome.storage.local.set({ sessoes: s }, () => responder({ ok: true, sessoes: sanitizar(s) }))
    })
    return true
  }
})

async function capturar(url, sistema, usuario) {
  let cookies = []
  try {
    cookies = await chrome.cookies.getAll({ url })
  } catch (e) {
    cookies = []
  }

  // A sessão de verdade são os cookies. Guardamos os nomes e uma amostra
  // mascarada do valor — nunca o valor inteiro em claro, nem em log.
  const agora = Date.now()
  const sessao = {
    sistema,
    dominio: new URL(url).host,
    usuario: usuario || 'Usuário autenticado',
    qtdCookies: cookies.length,
    cookies: cookies.slice(0, 8).map((c) => ({
      nome: c.name,
      amostra: mascarar(c.value),
      httpOnly: !!c.httpOnly,
      seguro: !!c.secure,
    })),
    capturadaEm: agora,
    expiraEm: agora + DURACAO_SESSAO_MS,
  }

  const { sessoes = {} } = await chrome.storage.local.get(['sessoes'])
  sessoes[sistema] = sessao
  await chrome.storage.local.set({ sessoes })
  return { ok: true, sessao: sanitizarUma(sessao) }
}

function mascarar(valor) {
  if (!valor) return '—'
  if (valor.length <= 8) return valor[0] + '•••'
  return valor.slice(0, 4) + '•'.repeat(6) + valor.slice(-3)
}

// Nunca devolve valor de cookie — só metadados.
function sanitizarUma(s) {
  return {
    sistema: s.sistema,
    dominio: s.dominio,
    usuario: s.usuario,
    qtdCookies: s.qtdCookies,
    cookies: (s.cookies || []).map((c) => ({ nome: c.nome, amostra: c.amostra, httpOnly: c.httpOnly, seguro: c.seguro })),
    capturadaEm: s.capturadaEm,
    expiraEm: s.expiraEm,
  }
}
function sanitizar(sessoes) {
  const out = {}
  for (const k of Object.keys(sessoes || {})) out[k] = sanitizarUma(sessoes[k])
  return out
}
