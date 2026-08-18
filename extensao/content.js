/*
 * Cleopatra — content script.
 *
 * Dois comportamentos, decididos pelo que a página é:
 *
 *  • Página de sistema (SEI/TransfereGov): injeta o ORBE — um botão pequeno no
 *    canto, com a marca da Cleo. Clicou, o painel abre; clicou de novo, some.
 *    Painel que fica aberto o tempo todo não é copiloto, é obstáculo: tapa
 *    justamente a tela que a pessoa veio operar. O orbe mostra o progresso em
 *    anel enquanto a Cleo executa, então dá para fechar o painel e continuar
 *    vendo que ela está trabalhando.
 *
 *  • Página da Cleopatra: age como ponte do Cofre de Sessões, sem interface.
 *
 * A extensão decide, a página executa. Nenhuma senha passa por aqui.
 */

;(function () {
  'use strict'

  const PROTOCOLO = 1
  const MARCA = chrome.runtime.getURL('icons/icon128.png')

  /* ==================== Ponte com a Cleopatra ==================== */

  // A página da Cleopatra pede a lista de sessões capturadas e pode descartá-las.
  // Aqui não há interface: a extensão é só o carteiro entre a página e o worker.
  function montarPonte() {
    window.addEventListener('message', (e) => {
      const d = e.data
      if (!d || d.source !== 'cleo-page') return

      if (d.cmd === 'listar-sessoes') {
        chrome.runtime.sendMessage({ tipo: 'listar-sessoes' }, (r) => {
          responder({ event: 'sessoes', sessoes: (r && r.sessoes) || {} })
        })
      }
      if (d.cmd === 'descartar-sessao') {
        chrome.runtime.sendMessage({ tipo: 'descartar-sessao', sistema: d.sistema }, (r) => {
          responder({ event: 'sessoes', sessoes: (r && r.sessoes) || {} })
        })
      }
    })

    // Anuncia presença já na entrada: sem isso o Cofre mostra o exemplo.
    responder({ event: 'presente' })
  }

  function responder(dados) {
    window.postMessage(Object.assign({ source: 'cleo-ext', v: PROTOCOLO }, dados), '*')
  }

  /* ==================== O que esta página é ==================== */

  const caminho = location.pathname
  const ehSistema = caminho.startsWith('/sistemas/')
  const sistema = caminho.includes('/sei') ? 'sei' : caminho.includes('/tgov') ? 'tgov' : null

  // A URL de origem fica guardada para o popup abrir os sistemas no endereço
  // certo — em outra máquina, o túnel tem outro host.
  try {
    chrome.storage.local.set({ origem: location.origin })
  } catch (e) {
    /* storage indisponível: a extensão segue, só não lembra a origem */
  }

  montarPonte()
  if (!ehSistema || !sistema) return

  /* ==================== Estado ==================== */

  const NOME_SISTEMA = sistema === 'sei' ? 'SEI' : 'TransfereGov'

  const RITOS = {
    sei: [
      {
        id: 'autuar',
        nome: 'Autuar processo',
        desc: 'Cria o processo e preenche tipo, especificação e interessado.',
        passos: 5,
      },
      {
        id: 'documento',
        nome: 'Redigir termo de análise',
        desc: 'Gera o documento da minuta e inclui no bloco de assinatura.',
        passos: 4,
      },
    ],
    tgov: [
      {
        id: 'extrair',
        nome: 'Localizar e baixar da proposta',
        desc: 'Abre a proposta e extrai extrato, contrapartidas e capacidade técnica.',
        passos: 8,
      },
    ],
  }

  const estado = {
    aberto: false,
    paginaPronta: false,
    executando: false,
    ritoAtual: null,
    passo: 0,
    total: 0,
    log: [],
    sessao: null,
  }

  /* ==================== O orbe ==================== */

  const orbe = document.createElement('button')
  orbe.className = 'clp-orbe'
  orbe.type = 'button'
  orbe.setAttribute('aria-label', 'Abrir o copiloto da Cleopatra')
  orbe.innerHTML =
    '<svg class="clp-anel" viewBox="0 0 44 44" aria-hidden="true">' +
    '<circle class="clp-anel-trilho" cx="22" cy="22" r="20" />' +
    '<circle class="clp-anel-arco" cx="22" cy="22" r="20" />' +
    '</svg>' +
    '<img class="clp-orbe-marca" src="' + MARCA + '" alt="" />' +
    '<span class="clp-orbe-selo"></span>'
  document.documentElement.appendChild(orbe)

  const arco = orbe.querySelector('.clp-anel-arco')
  const CIRCUNFERENCIA = 2 * Math.PI * 20
  arco.style.strokeDasharray = String(CIRCUNFERENCIA)
  arco.style.strokeDashoffset = String(CIRCUNFERENCIA)

  /* ==================== O painel ==================== */

  const painel = document.createElement('div')
  painel.className = 'clp-painel'
  painel.setAttribute('role', 'dialog')
  painel.setAttribute('aria-label', 'Copiloto da Cleopatra')
  painel.hidden = true
  document.documentElement.appendChild(painel)

  function alternar(forcar) {
    estado.aberto = typeof forcar === 'boolean' ? forcar : !estado.aberto
    painel.hidden = !estado.aberto
    orbe.classList.toggle('clp-orbe-ativo', estado.aberto)
    orbe.setAttribute(
      'aria-label',
      estado.aberto ? 'Fechar o copiloto da Cleopatra' : 'Abrir o copiloto da Cleopatra',
    )
    if (estado.aberto) {
      pedirSessao()
      // Abrir já rolando para o fim do log seria perder o contexto: o painel
      // abre no topo, onde estão as ações.
      painel.scrollTop = 0
    }
  }

  orbe.addEventListener('click', () => alternar())

  // Fecha ao clicar fora e no Esc — as duas saídas que todo mundo tenta.
  document.addEventListener('pointerdown', (e) => {
    if (!estado.aberto) return
    if (painel.contains(e.target) || orbe.contains(e.target)) return
    alternar(false)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && estado.aberto) alternar(false)
  })

  /* ==================== Desenho ==================== */

  function esc(t) {
    return String(t == null ? '' : t).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    )
  }

  function tempoRestante(ms) {
    if (ms <= 0) return 'expirada'
    const min = Math.floor(ms / 60000)
    const h = Math.floor(min / 60)
    return h > 0 ? h + 'h ' + (min % 60) + 'min' : min + 'min'
  }

  function blocoStatus() {
    if (estado.executando) {
      return (
        '<span class="clp-pulso"></span> executando · passo ' +
        estado.passo +
        ' de ' +
        estado.total
      )
    }
    if (!estado.paginaPronta) return 'aguardando a página do ' + esc(NOME_SISTEMA)
    return 'no ' + esc(NOME_SISTEMA) + ' · pronta'
  }

  function blocoRitos() {
    const lista = RITOS[sistema] || []
    return (
      '<div class="clp-secao">' +
      '<div class="clp-secao-titulo">Executar na sua sessão</div>' +
      '<div class="clp-ritos' +
      (estado.executando ? ' clp-ocupado' : '') +
      '">' +
      lista
        .map(
          (r) =>
            '<button class="clp-rito" data-rito="' +
            esc(r.id) +
            '"' +
            (estado.executando ? ' disabled' : '') +
            '>' +
            '<span class="clp-rito-nome">' +
            esc(r.nome) +
            '</span>' +
            '<span class="clp-rito-desc">' +
            esc(r.desc) +
            '</span>' +
            '<span class="clp-rito-meta">' +
            r.passos +
            ' passos · na sua sessão</span>' +
            '</button>',
        )
        .join('') +
      '</div></div>'
    )
  }

  function blocoExecucao() {
    if (estado.log.length === 0) return ''
    const pct = estado.total ? Math.round((estado.passo / estado.total) * 100) : 0
    return (
      '<div class="clp-secao">' +
      '<div class="clp-secao-titulo">' +
      (estado.executando ? 'Em execução' : 'Última execução') +
      '</div>' +
      '<div class="clp-barra-wrap"><div class="clp-barra" style="width:' +
      pct +
      '%"></div></div>' +
      '<div class="clp-log">' +
      estado.log
        .slice(-40)
        .map(
          (l) =>
            '<div class="clp-log-linha clp-' +
            esc(l.classe) +
            '"><span class="clp-log-marca">' +
            (l.classe === 'ok' ? '✓' : l.classe === 'fim' ? '●' : '•') +
            '</span>' +
            esc(l.texto) +
            '</div>',
        )
        .join('') +
      '</div></div>'
    )
  }

  function blocoSessao() {
    const s = estado.sessao
    if (!s) {
      return (
        '<div class="clp-secao">' +
        '<div class="clp-secao-titulo">Sessão autenticada</div>' +
        '<p class="clp-sessao-txt">Leve a sessão que você já abriu para a Cleopatra continuar ' +
        'sozinha, sem pedir seu login de novo. Nenhuma senha sai do navegador — só o ' +
        'cookie de sessão que o próprio servidor já emitiu.</p>' +
        '<button class="clp-btn-sessao" data-acao="capturar">Levar esta sessão para a Cleo</button>' +
        '</div>'
      )
    }
    const restante = s.expiraEm - Date.now()
    const faixa = restante <= 0 ? 'expirada' : restante < 15 * 60000 ? 'perto' : 'valida'
    return (
      '<div class="clp-secao">' +
      '<div class="clp-secao-titulo">Sessão autenticada</div>' +
      '<div class="clp-sessao-card clp-' +
      faixa +
      '">' +
      '<div class="clp-sessao-linha"><span class="clp-pino"></span>' +
      (faixa === 'expirada' ? 'Sessão expirada' : 'Sessão ativa na Cleo') +
      '<span class="clp-relogio">' +
      tempoRestante(restante) +
      '</span></div>' +
      '<div class="clp-sessao-meta">' +
      esc(s.qtdCookies) +
      ' cookies · ' +
      esc(s.usuario) +
      '</div>' +
      '<div class="clp-sessao-acoes">' +
      (faixa === 'expirada'
        ? '<button class="clp-btn-sessao" data-acao="capturar">Renovar a sessão</button>'
        : '<button class="clp-btn-sessao clp-fantasma" data-acao="descartar">Encerrar na Cleo</button>') +
      '</div></div></div>'
    )
  }

  function desenhar() {
    if (painel.hidden) {
      atualizarOrbe()
      return
    }
    painel.innerHTML =
      '<div class="clp-cabecalho">' +
      '<img class="clp-selo" src="' +
      MARCA +
      '" alt="" />' +
      '<div class="clp-marca-txt">' +
      '<div class="clp-titulo">CLEOPATRA</div>' +
      '<div class="clp-sub">' +
      blocoStatus() +
      '</div></div>' +
      '<span class="clp-sistema">' +
      esc(NOME_SISTEMA) +
      '</span>' +
      '<button class="clp-fechar" data-acao="fechar" aria-label="Fechar">✕</button>' +
      '</div>' +
      '<div class="clp-corpo">' +
      blocoRitos() +
      blocoExecucao() +
      blocoSessao() +
      '<div class="clp-rodape">Demonstração — opera apenas os sistemas de teste da ' +
      'Cleopatra. Nenhuma senha sai do navegador.</div>' +
      '</div>'
    atualizarOrbe()
  }

  function atualizarOrbe() {
    const frac = estado.total ? estado.passo / estado.total : 0
    arco.style.strokeDashoffset = String(CIRCUNFERENCIA * (1 - frac))
    orbe.classList.toggle('clp-orbe-executando', estado.executando)
    const selo = orbe.querySelector('.clp-orbe-selo')
    if (estado.executando) {
      selo.textContent = estado.passo + '/' + estado.total
      selo.hidden = false
    } else {
      selo.hidden = true
    }
  }

  /* ==================== Ações ==================== */

  painel.addEventListener('click', (e) => {
    const rito = e.target.closest('[data-rito]')
    if (rito) {
      executar(rito.getAttribute('data-rito'))
      return
    }
    const acao = e.target.closest('[data-acao]')
    if (!acao) return
    const nome = acao.getAttribute('data-acao')
    if (nome === 'fechar') alternar(false)
    if (nome === 'capturar') capturar()
    if (nome === 'descartar') descartar()
  })

  function executar(id) {
    if (estado.executando) return
    const rito = (RITOS[sistema] || []).find((r) => r.id === id)
    estado.executando = true
    estado.ritoAtual = id
    estado.passo = 0
    estado.total = rito ? rito.passos : 0
    estado.log = [{ classe: 'inicio', texto: rito ? rito.nome : id }]
    desenhar()
    // Fecha o painel: o que interessa agora é ver a Cleo operando a tela, e
    // o anel do orbe continua contando o progresso do lado de fora.
    setTimeout(() => alternar(false), 420)
    window.postMessage({ source: 'cleo-ext', v: PROTOCOLO, cmd: 'executar-rito', rito: id }, '*')
  }

  function capturar() {
    chrome.runtime.sendMessage(
      {
        tipo: 'capturar-sessao',
        url: location.origin,
        sistema,
        usuario: sistema === 'sei' ? 'usuário SNPDC' : 'usuário TransfereGov',
      },
      (r) => {
        if (r && r.sessao) estado.sessao = r.sessao
        desenhar()
      },
    )
  }

  function descartar() {
    chrome.runtime.sendMessage({ tipo: 'descartar-sessao', sistema }, () => {
      estado.sessao = null
      desenhar()
    })
  }

  function pedirSessao() {
    chrome.runtime.sendMessage({ tipo: 'listar-sessoes' }, (r) => {
      const s = r && r.sessoes ? r.sessoes[sistema] : null
      estado.sessao = s || null
      desenhar()
    })
  }

  /* ==================== Escuta a página ==================== */

  window.addEventListener('message', (e) => {
    const d = e.data
    if (!d || d.source !== 'cleo-sistema') return

    if (d.event === 'pronto') {
      if (!estado.paginaPronta) {
        estado.paginaPronta = true
        orbe.classList.add('clp-orbe-vivo')
        desenhar()
      }
      return
    }

    if (d.event === 'passo' && d.passo) {
      estado.executando = true
      estado.passo = d.passo.indice + (d.passo.estado === 'ok' ? 1 : 0)
      estado.total = d.passo.total
      const ultima = estado.log[estado.log.length - 1]
      const classe = d.passo.estado === 'ok' ? 'ok' : 'fazendo'
      // Substitui a linha em vez de empilhar "indo/fazendo/ok" do mesmo passo:
      // log que repete três vezes a mesma frase vira ruído.
      if (ultima && ultima.chave === d.passo.indice) {
        ultima.classe = classe
        ultima.texto = d.passo.rotulo
      } else {
        estado.log.push({ classe, texto: d.passo.rotulo, chave: d.passo.indice })
      }
      desenhar()
      return
    }

    if (d.event === 'fim') {
      estado.executando = false
      estado.passo = estado.total
      estado.log.push({ classe: 'fim', texto: 'Concluído na sua sessão.' })
      desenhar()
      // Um sinal curto no orbe: terminou, sem precisar reabrir o painel.
      orbe.classList.add('clp-orbe-concluido')
      setTimeout(() => orbe.classList.remove('clp-orbe-concluido'), 2600)
    }
  })

  // Relógio do cartão de sessão — a contagem precisa andar sozinha.
  setInterval(() => {
    if (estado.aberto && estado.sessao) desenhar()
  }, 30000)

  pedirSessao()
  desenhar()
})()
