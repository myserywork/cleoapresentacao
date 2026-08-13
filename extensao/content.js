/*
 * Cleopatra — content script.
 *
 * Roda em dois contextos e se comporta diferente em cada um:
 *
 *  • Nas páginas do SEI e do TransfereGov (marca data-cleo-sistema): injeta o
 *    painel do copiloto, dirige a página pelos ritos e oferece "levar a sessão
 *    para a Cleo" — capturando os cookies autenticados pelo service worker.
 *
 *  • Nas páginas da própria Cleopatra: age como ponte do Cofre de Sessões —
 *    lê as sessões guardadas e as entrega à página quando ela pede.
 *
 * A extensão decide, a página executa. Nenhuma senha passa por aqui.
 */

;(function () {
  const V = 1
  const MARCA = 'https://cleopatra' // apenas rótulo interno

  // Guarda a origem atual para o popup abrir o sistema no host certo (túnel ou local)
  try {
    chrome.storage.local.set({ origem: location.origin })
  } catch (_) {}

  const sistemaAtributo = () => document.documentElement.getAttribute('data-cleo-sistema')

  // ---- Ponte do Cofre: responde às páginas da Cleopatra ----
  window.addEventListener('message', (e) => {
    const d = e.data
    if (!d || d.source !== 'cleo-page') return
    if (d.cmd === 'listar-sessoes') {
      chrome.runtime.sendMessage({ tipo: 'listar-sessoes' }, (r) => {
        responderPagina('sessoes', { sessoes: (r && r.sessoes) || {} })
      })
    }
    if (d.cmd === 'descartar-sessao') {
      chrome.runtime.sendMessage({ tipo: 'descartar-sessao', sistema: d.sistema }, (r) => {
        responderPagina('sessoes', { sessoes: (r && r.sessoes) || {} })
      })
    }
  })
  function responderPagina(event, extra) {
    window.postMessage(Object.assign({ source: 'cleo-ext', v: V, event }, extra), '*')
  }
  // Anuncia presença para o Cofre saber que a extensão existe
  responderPagina('extensao-presente', {})

  // ---- Copiloto: só nas páginas de sistema ----
  let sistema = sistemaAtributo()
  if (sistema) iniciar(sistema)
  else {
    const obs = new MutationObserver(() => {
      const s = sistemaAtributo()
      if (s) {
        obs.disconnect()
        iniciar(s)
      }
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-cleo-sistema'] })
    setTimeout(() => obs.disconnect(), 8000)
  }

  const RITOS = {
    sei: [
      { id: 'autuar', nome: 'Autuar processo', desc: 'Cria o processo e preenche tipo, especificação e interessado.' },
      { id: 'documento', nome: 'Redigir termo de análise', desc: 'Gera o documento da minuta e inclui no bloco de assinatura.' },
    ],
    tgov: [
      { id: 'extrato', nome: 'Baixar extrato e contrapartidas', desc: 'Localiza a proposta e gera os PDFs que o SEI vai receber.' },
    ],
  }
  const ROTULO = { sei: 'SEI', tgov: 'TransfereGov' }

  let painel, elLog, elBarra, elStatus, elBotoes, elSessao
  let conectado = false
  let relogio = null

  function iniciar(sis) {
    sistema = sis
    injetarPainel(sis)
    window.addEventListener('message', (e) => {
      const d = e.data
      if (!d || d.source !== 'cleo-sistema') return
      if (d.event === 'pronto') marcarConectado(d.sistema)
      if (d.event === 'passo') mostrarPasso(d.passo)
      if (d.event === 'fim') concluir()
    })
    window.postMessage({ source: 'cleo-ext', v: V, cmd: 'ping' }, '*')
    atualizarSessao()
  }

  function injetarPainel(sis) {
    painel = document.createElement('div')
    painel.className = 'clp-painel clp-recolhido'
    painel.innerHTML = `
      <div class="clp-cabecalho">
        <div class="clp-marca">
          <span class="clp-selo"></span>
          <div>
            <div class="clp-titulo">CLEOPATRA</div>
            <div class="clp-sub" id="clp-status">conectando ao ${ROTULO[sis]}…</div>
          </div>
        </div>
        <button class="clp-toggle" id="clp-toggle" title="Recolher">›</button>
      </div>
      <div class="clp-corpo">
        <div class="clp-abas">
          <span class="clp-aba clp-ativa">Copiloto</span>
          <span class="clp-sistema">${ROTULO[sis]}</span>
        </div>

        <div class="clp-secao-titulo">Executar na sua sessão</div>
        <div class="clp-ritos" id="clp-botoes"></div>
        <div class="clp-barra-wrap"><div class="clp-barra" id="clp-barra"></div></div>
        <div class="clp-log" id="clp-log"></div>

        <div class="clp-divisor"></div>
        <div class="clp-secao-titulo">Sessão autenticada</div>
        <div class="clp-sessao" id="clp-sessao"></div>

        <div class="clp-rodape">Demonstração — opera apenas os sistemas de teste da Cleopatra. Nenhuma senha sai do navegador.</div>
      </div>
    `
    document.body.appendChild(painel)

    elLog = painel.querySelector('#clp-log')
    elBarra = painel.querySelector('#clp-barra')
    elStatus = painel.querySelector('#clp-status')
    elBotoes = painel.querySelector('#clp-botoes')
    elSessao = painel.querySelector('#clp-sessao')

    painel.querySelector('#clp-toggle').addEventListener('click', () => {
      painel.classList.toggle('clp-recolhido')
      painel.querySelector('#clp-toggle').textContent = painel.classList.contains('clp-recolhido') ? '‹' : '›'
    })

    for (const rito of RITOS[sis] || []) {
      const b = document.createElement('button')
      b.className = 'clp-rito'
      b.innerHTML = `<span class="clp-rito-nome">${rito.nome}</span><span class="clp-rito-desc">${rito.desc}</span>`
      b.addEventListener('click', () => executar(rito))
      elBotoes.appendChild(b)
    }

    setTimeout(() => {
      painel.classList.remove('clp-recolhido')
      painel.querySelector('#clp-toggle').textContent = '›'
    }, 650)
  }

  function marcarConectado(sis) {
    if (conectado) return
    conectado = true
    elStatus.textContent = `no ${ROTULO[sis || sistema]} · pronta`
    painel.classList.add('clp-ok')
  }

  function executar(rito) {
    limparLog()
    log(`▸ ${rito.nome}`, 'inicio')
    elBotoes.classList.add('clp-ocupado')
    window.postMessage({ source: 'cleo-ext', v: V, cmd: 'executar-rito', rito: rito.id }, '*')
  }

  function mostrarPasso(p) {
    if (!p) return
    const pct = Math.round(((p.indice + (p.estado === 'ok' ? 1 : 0.4)) / p.total) * 100)
    elBarra.style.width = pct + '%'
    if (p.estado === 'ok') log(`✓ ${p.rotulo}`, 'ok')
    else if (p.estado === 'fazendo') log(`• ${p.rotulo}`, 'fazendo')
  }

  function concluir() {
    elBarra.style.width = '100%'
    log('● Concluído na sua sessão.', 'fim')
    elBotoes.classList.remove('clp-ocupado')
    setTimeout(() => (elBarra.style.width = '0%'), 2000)
  }

  function log(texto, tipo) {
    const l = document.createElement('div')
    l.className = 'clp-log-linha clp-' + (tipo || 'txt')
    l.textContent = texto
    elLog.appendChild(l)
    elLog.scrollTop = elLog.scrollHeight
  }
  function limparLog() {
    elLog.innerHTML = ''
  }

  /* ---------- Sessão autenticada ---------- */

  function atualizarSessao() {
    chrome.runtime.sendMessage({ tipo: 'listar-sessoes' }, (r) => {
      const s = (r && r.sessoes && r.sessoes[sistema]) || null
      renderSessao(s)
    })
  }

  function capturarSessao() {
    const usuario =
      document.querySelector('[data-cleo-usuario]')?.getAttribute('data-cleo-usuario') ||
      'Usuário de serviço'
    chrome.runtime.sendMessage(
      { tipo: 'capturar-sessao', url: location.origin + '/', sistema, usuario },
      (r) => {
        if (r && r.ok) {
          log('🔒 Sessão levada para a Cleopatra.', 'fim')
          renderSessao(r.sessao)
        }
      },
    )
  }

  function descartar() {
    chrome.runtime.sendMessage({ tipo: 'descartar-sessao', sistema }, () => renderSessao(null))
  }

  function renderSessao(s) {
    if (relogio) {
      clearInterval(relogio)
      relogio = null
    }
    if (!s) {
      elSessao.innerHTML = `
        <p class="clp-sessao-txt">Leve sua sessão autenticada para a Cleopatra operar sozinha, mesmo sem esta aba aberta.</p>
        <button class="clp-btn-sessao" id="clp-capturar">Levar minha sessão para a Cleo</button>
      `
      elSessao.querySelector('#clp-capturar').addEventListener('click', capturarSessao)
      return
    }

    const pinta = () => {
      const restante = s.expiraEm - Date.now()
      const expirada = restante <= 0
      const perto = restante > 0 && restante < 20 * 60 * 1000
      const cls = expirada ? 'clp-expirada' : perto ? 'clp-perto' : 'clp-valida'
      elSessao.innerHTML = `
        <div class="clp-sessao-card ${cls}">
          <div class="clp-sessao-linha">
            <span class="clp-pino"></span>
            <span>${expirada ? 'Sessão expirada' : perto ? 'Sessão expira em breve' : 'Sessão ativa na Cleo'}</span>
            <span class="clp-relogio" id="clp-relogio">${formatar(restante)}</span>
          </div>
          <div class="clp-sessao-meta">${s.qtdCookies} cookies · usuário ${s.usuario}</div>
          <div class="clp-sessao-acoes">
            ${expirada || perto
              ? '<button class="clp-btn-sessao" id="clp-renovar">Renovar sessão</button>'
              : '<button class="clp-btn-sessao clp-fantasma" id="clp-descartar">Encerrar na Cleo</button>'}
          </div>
        </div>
      `
      const rn = elSessao.querySelector('#clp-renovar')
      if (rn) rn.addEventListener('click', capturarSessao)
      const dc = elSessao.querySelector('#clp-descartar')
      if (dc) dc.addEventListener('click', descartar)
    }
    pinta()
    relogio = setInterval(() => {
      const el = elSessao.querySelector('#clp-relogio')
      const restante = s.expiraEm - Date.now()
      if (!el || restante < 0 || (restante < 20 * 60 * 1000 && !elSessao.querySelector('#clp-renovar'))) {
        pinta()
      } else if (el) {
        el.textContent = formatar(restante)
      }
    }, 1000)
  }

  function formatar(ms) {
    if (ms <= 0) return 'expirada'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
    return `${m}min ${String(s).padStart(2, '0')}s`
  }
})()
