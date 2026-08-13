/*
 * Cleo — content script.
 *
 * Roda dentro das páginas do SEI e do TransfereGov. Detecta que é uma página de
 * sistema (a marca data-cleo-sistema no <html>), injeta o painel do copiloto e
 * conversa com a página por postMessage: manda o rito a executar e recebe o
 * progresso de cada passo. É esta a arquitetura real de uma extensão que opera
 * o sistema pela sessão do próprio usuário — a extensão decide, a página executa.
 */

;(function () {
  const V = 1

  // Guarda a origem em que a Cleopatra está rodando (localhost ou o túnel do
  // Cloudflare). O popup lê daqui para abrir o SEI/TransfereGov no host certo —
  // sem isso, numa máquina remota o popup cairia num 127.0.0.1 que não existe.
  try {
    chrome.storage.local.set({ origem: location.origin })
  } catch (_) {}

  function detectarSistema() {
    return document.documentElement.getAttribute('data-cleo-sistema')
  }

  // A página React pode montar depois do content script; espera a marca aparecer
  let sistema = detectarSistema()
  if (!sistema) {
    const obs = new MutationObserver(() => {
      const s = detectarSistema()
      if (s) {
        obs.disconnect()
        iniciar(s)
      }
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-cleo-sistema'] })
    // Desiste após 8s se não for página de sistema
    setTimeout(() => obs.disconnect(), 8000)
  } else {
    iniciar(sistema)
  }

  function iniciar(sis) {
    sistema = sis
    injetarPainel(sis)
    window.addEventListener('message', (e) => {
      const d = e.data
      if (!d || d.source !== 'cleo-sistema') return
      if (d.event === 'pronto') marcarConectado()
      if (d.event === 'passo') mostrarPasso(d.passo)
      if (d.event === 'fim') concluir()
    })
    // Responde ao "pronto" da página confirmando presença
    window.postMessage({ source: 'cleo-ext', v: V, cmd: 'ping' }, '*')
  }

  /* ---------- Ritos disponíveis por sistema ---------- */

  const RITOS = {
    sei: [
      { id: 'autuar', nome: 'Autuar processo', desc: 'Cria o processo e preenche tipo, especificação e interessado.', passos: 5 },
      { id: 'documento', nome: 'Redigir termo de análise', desc: 'Gera o documento da minuta e inclui no bloco de assinatura.', passos: 4 },
    ],
    tgov: [
      { id: 'extrato', nome: 'Baixar extrato e contrapartidas', desc: 'Localiza a proposta e gera os PDFs para o SEI.', passos: 8 },
    ],
  }

  /* ---------- Painel injetado ---------- */

  let painel, elLog, elBarra, elStatus, elBotoes
  let conectado = false

  function injetarPainel(sis) {
    painel = document.createElement('div')
    painel.className = 'cleo-painel cleo-recolhido'
    painel.innerHTML = `
      <div class="cleo-cabecalho">
        <div class="cleo-marca">
          <span class="cleo-nucleo"></span>
          <div>
            <div class="cleo-titulo">Cleo</div>
            <div class="cleo-sub" id="cleo-status">conectando à página…</div>
          </div>
        </div>
        <button class="cleo-toggle" id="cleo-toggle">›</button>
      </div>
      <div class="cleo-corpo">
        <div class="cleo-consentimento" id="cleo-consent">
          <p>A Cleo vai operar <b>${sis === 'sei' ? 'o SEI' : 'o TransfereGov'}</b> nesta aba, usando a sua sessão. Nada é enviado para fora do seu navegador.</p>
        </div>
        <div class="cleo-ritos" id="cleo-botoes"></div>
        <div class="cleo-barra-wrap"><div class="cleo-barra" id="cleo-barra"></div></div>
        <div class="cleo-log" id="cleo-log"></div>
        <div class="cleo-rodape">Extensão de demonstração — opera apenas os sistemas de teste da Cleopatra.</div>
      </div>
    `
    document.body.appendChild(painel)

    elLog = painel.querySelector('#cleo-log')
    elBarra = painel.querySelector('#cleo-barra')
    elStatus = painel.querySelector('#cleo-status')
    elBotoes = painel.querySelector('#cleo-botoes')

    painel.querySelector('#cleo-toggle').addEventListener('click', () => {
      painel.classList.toggle('cleo-recolhido')
      painel.querySelector('#cleo-toggle').textContent = painel.classList.contains('cleo-recolhido') ? '‹' : '›'
    })

    for (const rito of RITOS[sis] || []) {
      const b = document.createElement('button')
      b.className = 'cleo-rito'
      b.innerHTML = `<span class="cleo-rito-nome">${rito.nome}</span><span class="cleo-rito-desc">${rito.desc}</span>`
      b.addEventListener('click', () => executar(rito))
      elBotoes.appendChild(b)
    }

    // Abre sozinho depois de um instante — é a estrela da demonstração
    setTimeout(() => {
      painel.classList.remove('cleo-recolhido')
      painel.querySelector('#cleo-toggle').textContent = '›'
    }, 700)
  }

  function marcarConectado() {
    if (conectado) return
    conectado = true
    elStatus.textContent = sistema === 'sei' ? 'no SEI · pronta' : 'no TransfereGov · pronta'
    painel.classList.add('cleo-ok')
  }

  function executar(rito) {
    limparLog()
    log(`▸ Iniciando: ${rito.nome}`, 'inicio')
    elBotoes.classList.add('cleo-ocupado')
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
    log('● Concluído na sua sessão — sem enviar nada para fora.', 'fim')
    elBotoes.classList.remove('cleo-ocupado')
    setTimeout(() => (elBarra.style.width = '0%'), 2200)
  }

  function log(texto, tipo) {
    const l = document.createElement('div')
    l.className = 'cleo-log-linha cleo-' + (tipo || 'txt')
    l.textContent = texto
    elLog.appendChild(l)
    elLog.scrollTop = elLog.scrollHeight
  }
  function limparLog() {
    elLog.innerHTML = ''
  }
})()
