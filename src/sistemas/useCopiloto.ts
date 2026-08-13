import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Motor do copiloto que dirige uma página.
 *
 * É o coração do que a extensão faz de verdade: encontrar um elemento na tela,
 * levar o cursor até ele, destacá-lo e agir — clicar, digitar, escolher. Aqui
 * o cursor e a digitação são renderizados pela própria página (React controla
 * os campos), e a extensão apenas manda a ordem e recebe o progresso. É a
 * divisão real entre quem decide (extensão) e quem executa (a sessão do usuário).
 */

export interface Passo {
  /** data-alvo do elemento na página que o cursor procura. */
  alvo: string
  acao: 'clicar' | 'digitar' | 'selecionar' | 'aguardar'
  /** Valor a digitar/selecionar, aplicado progressivamente no caso de digitar. */
  valor?: string
  /** Chamado a cada avanço, com o valor parcial (digitação) ou final. */
  aoAplicar?: (parcial: string) => void
  rotulo: string
  /** Milissegundos que o passo leva além da animação do cursor. */
  duracao?: number
}

export interface EventoPasso {
  indice: number
  total: number
  rotulo: string
  estado: 'indo' | 'fazendo' | 'ok'
}

interface CursorState {
  x: number
  y: number
  visivel: boolean
  clicando: boolean
}

const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function useCopiloto(containerRef: React.RefObject<HTMLElement | null>) {
  const [cursor, setCursor] = useState<CursorState>({ x: 0, y: 0, visivel: false, clicando: false })
  const [alvoDestacado, setAlvoDestacado] = useState<string | null>(null)
  const [rodando, setRodando] = useState(false)
  const cancelar = useRef(false)

  const posicaoDoAlvo = useCallback(
    (alvo: string) => {
      const container = containerRef.current
      if (!container) return null
      const el = container.querySelector<HTMLElement>(`[data-alvo="${alvo}"]`)
      if (!el) return null
      const rc = container.getBoundingClientRect()
      const re = el.getBoundingClientRect()
      return {
        x: re.left - rc.left + re.width / 2,
        y: re.top - rc.top + re.height / 2,
        el,
      }
    },
    [containerRef],
  )

  /** Move o cursor até o alvo com uma curva de desaceleração. */
  const moverAte = useCallback(
    async (x: number, y: number) => {
      const inicio = { ...cursorRef.current }
      const quadros = 26
      for (let i = 1; i <= quadros; i++) {
        if (cancelar.current) return
        const t = i / quadros
        const eased = 1 - Math.pow(1 - t, 3)
        setCursor((c) => ({
          ...c,
          x: inicio.x + (x - inicio.x) * eased,
          y: inicio.y + (y - inicio.y) * eased,
          visivel: true,
        }))
        await espera(12)
      }
    },
    [],
  )

  const cursorRef = useRef(cursor)
  cursorRef.current = cursor

  const rodar = useCallback(
    async (passos: Passo[], aoProgresso?: (e: EventoPasso) => void) => {
      cancelar.current = false
      setRodando(true)
      // Cursor entra pela borda inferior, como se a mão viesse de fora
      const container = containerRef.current
      if (container) {
        const rc = container.getBoundingClientRect()
        setCursor({ x: rc.width * 0.5, y: rc.height + 40, visivel: true, clicando: false })
        await espera(120)
      }

      for (let i = 0; i < passos.length; i++) {
        if (cancelar.current) break
        const passo = passos[i]
        aoProgresso?.({ indice: i, total: passos.length, rotulo: passo.rotulo, estado: 'indo' })

        if (passo.acao === 'aguardar') {
          setAlvoDestacado(null)
          await espera(passo.duracao ?? 600)
          aoProgresso?.({ indice: i, total: passos.length, rotulo: passo.rotulo, estado: 'ok' })
          continue
        }

        const pos = posicaoDoAlvo(passo.alvo)
        if (pos) {
          await moverAte(pos.x, pos.y)
          setAlvoDestacado(passo.alvo)
        }
        if (cancelar.current) break

        aoProgresso?.({ indice: i, total: passos.length, rotulo: passo.rotulo, estado: 'fazendo' })

        if (passo.acao === 'clicar') {
          setCursor((c) => ({ ...c, clicando: true }))
          await espera(140)
          setCursor((c) => ({ ...c, clicando: false }))
          passo.aoAplicar?.(passo.valor ?? '')
          await espera(passo.duracao ?? 420)
        } else if (passo.acao === 'selecionar') {
          passo.aoAplicar?.(passo.valor ?? '')
          await espera(passo.duracao ?? 520)
        } else if (passo.acao === 'digitar') {
          const texto = passo.valor ?? ''
          for (let k = 1; k <= texto.length; k++) {
            if (cancelar.current) break
            passo.aoAplicar?.(texto.slice(0, k))
            await espera(26 + (k % 3) * 8)
          }
          await espera(passo.duracao ?? 260)
        }

        aoProgresso?.({ indice: i, total: passos.length, rotulo: passo.rotulo, estado: 'ok' })
      }

      setAlvoDestacado(null)
      // Cursor sai por onde entrou
      const cont = containerRef.current
      if (cont && !cancelar.current) {
        const rc = cont.getBoundingClientRect()
        await moverAte(rc.width * 0.5, rc.height + 40)
      }
      setCursor((c) => ({ ...c, visivel: false }))
      setRodando(false)
    },
    [containerRef, moverAte, posicaoDoAlvo],
  )

  const parar = useCallback(() => {
    cancelar.current = true
    setRodando(false)
    setAlvoDestacado(null)
    setCursor((c) => ({ ...c, visivel: false }))
  }, [])

  useEffect(() => () => {
    cancelar.current = true
  }, [])

  return { cursor, alvoDestacado, rodando, rodar, parar }
}

/* ---------- Ponte com a extensão ---------- */

export const PROTOCOLO = 1

export interface ComandoExtensao {
  source: 'cleo-ext'
  v: number
  cmd: 'executar-rito' | 'ping'
  rito?: string
}

export interface EventoParaExtensao {
  source: 'cleo-sistema'
  v: number
  event: 'pronto' | 'passo' | 'fim'
  sistema?: string
  passo?: EventoPasso
  rito?: string
}

/** A página anuncia à extensão que está viva e escuta comandos dela. */
export function useBridgeExtensao(
  sistema: 'sei' | 'tgov',
  aoComando: (rito: string) => void,
) {
  const [extensaoPresente, setExtensaoPresente] = useState(false)

  useEffect(() => {
    function ouvir(e: MessageEvent) {
      const d = e.data as ComandoExtensao
      if (!d || d.source !== 'cleo-ext') return
      setExtensaoPresente(true)
      if (d.cmd === 'executar-rito' && d.rito) aoComando(d.rito)
    }
    window.addEventListener('message', ouvir)
    // Anuncia presença — a extensão responde marcando extensaoPresente
    const anunciar: EventoParaExtensao = { source: 'cleo-sistema', v: PROTOCOLO, event: 'pronto', sistema }
    window.postMessage(anunciar, '*')
    const t = setInterval(() => window.postMessage(anunciar, '*'), 1500)
    return () => {
      window.removeEventListener('message', ouvir)
      clearInterval(t)
    }
  }, [sistema, aoComando])

  const emitir = useCallback(
    (event: 'passo' | 'fim', dados: Partial<EventoParaExtensao>) => {
      const msg: EventoParaExtensao = { source: 'cleo-sistema', v: PROTOCOLO, event, ...dados }
      window.postMessage(msg, '*')
    },
    [],
  )

  return { extensaoPresente, emitir }
}
