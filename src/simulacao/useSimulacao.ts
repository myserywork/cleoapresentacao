import { useEffect, useMemo, useRef, useState } from 'react'
import type { RoteiroSimulacao } from './tipos'

export interface EstadoSimulacao {
  /** Índice do passo em execução; igual ao total quando termina. */
  indice: number
  /** Progresso 0..1 dentro do passo atual. */
  progressoPasso: number
  tempoDecorridoMs: number
  logs: string[]
  terminado: boolean
  concluir: () => void
}

const TICK_MS = 60

/**
 * Reproduz um roteiro com cronometragem realista.
 *
 * O consumidor não sabe se os eventos vêm daqui ou de um worker: a troca por
 * execução real é substituição desta fonte.
 */
export function useSimulacao(roteiro: RoteiroSimulacao, velocidade = 1): EstadoSimulacao {
  const [decorrido, setDecorrido] = useState(0)
  const [pulado, setPulado] = useState(false)
  const inicioRef = useRef<number | null>(null)

  const total = useMemo(
    () => roteiro.passos.reduce((s, p) => s + p.duracaoMs, 0),
    [roteiro],
  )

  useEffect(() => {
    setDecorrido(0)
    setPulado(false)
    inicioRef.current = null
  }, [roteiro])

  useEffect(() => {
    if (pulado) return
    const id = window.setInterval(() => {
      if (inicioRef.current === null) inicioRef.current = performance.now()
      const t = (performance.now() - inicioRef.current) * velocidade
      setDecorrido(Math.min(t, total))
      if (t >= total) window.clearInterval(id)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [roteiro, total, velocidade, pulado])

  const tempoDecorridoMs = pulado ? total : decorrido

  const { indice, progressoPasso } = useMemo(() => {
    let restante = tempoDecorridoMs
    for (let i = 0; i < roteiro.passos.length; i++) {
      const d = roteiro.passos[i].duracaoMs
      if (restante < d) return { indice: i, progressoPasso: d ? restante / d : 1 }
      restante -= d
    }
    return { indice: roteiro.passos.length - 1, progressoPasso: 1 }
  }, [tempoDecorridoMs, roteiro])

  const terminado = tempoDecorridoMs >= total

  const logs = useMemo(() => {
    const acumulado: string[] = []
    for (let i = 0; i < roteiro.passos.length; i++) {
      const passo = roteiro.passos[i]
      if (i < indice || terminado) {
        acumulado.push(...passo.logs)
      } else if (i === indice) {
        // Dentro do passo corrente, as linhas aparecem conforme ele avança.
        const quantas = Math.floor(progressoPasso * passo.logs.length) + (progressoPasso > 0.05 ? 1 : 0)
        acumulado.push(...passo.logs.slice(0, Math.min(quantas, passo.logs.length)))
      }
    }
    return acumulado
  }, [roteiro, indice, progressoPasso, terminado])

  return {
    indice,
    progressoPasso,
    tempoDecorridoMs,
    logs,
    terminado,
    concluir: () => setPulado(true),
  }
}
